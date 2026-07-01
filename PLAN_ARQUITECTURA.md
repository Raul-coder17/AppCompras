# PLAN DE ARQUITECTURA — Deuda técnica y seguridad

> Documento de trabajo para retomar en sesiones futuras. NO ejecutar cambios sin
> confirmar prioridad con el usuario. Estado inicial de todo: **Pendiente**.

---

## Sesión actual

- **Fecha:** 2026-07-01
- **Alcance:** Auditoría de deuda técnica ya identificada (App.tsx monolítico,
  AIAssistant.tsx, exposición de API key de Gemini, persistencia 100% localStorage).
- **Modo:** Solo análisis y documentación. No se tocó código.
- **Commit base:** `9998146` (fix bugs lógicos de estado, zona horaria y duplicados).

### Resumen de lo encontrado hoy
1. `App.tsx` es un "god component" (~2473 líneas, ~30 `useState`, sin Context/reducer).
   Es deuda de mantenibilidad **y** amplificador directo del bug de cálculo (Tarea 2):
   las mutaciones de capital están dispersas en ~8 handlers sin fuente única de verdad.
2. `AIAssistant.tsx` (~3878 líneas) hace llamadas REST directas a Gemini desde el cliente.
3. **Seguridad — API key:** NO está horneada en el bundle (bien), pero se guarda en
   `localStorage` solo con `btoa` (base64 = ofuscación, NO cifrado) y viaja client-side.
   El `.env.example` sugiere un `GEMINI_API_KEY` que **nunca se usa** en el código (engañoso).
4. **Persistencia:** 100% `localStorage` sin backup/restore real ni sync. Riesgo de
   pérdida total de datos (limpiar navegador / evicción de storage de la PWA).

---

## Tabla de hallazgos

| # | Problema | Archivo:línea | Severidad | Estado |
|---|----------|---------------|-----------|--------|
| A1 | `App.tsx` god component: todo el estado (~30 `useState`) y toda la lógica de negocio en un solo archivo (~2473 líneas), sin Context/reducer. Las mutaciones de `cashBudget`/`cardBudget` están repartidas en ~8 handlers. | `App.tsx:116-179` (estado), `App.tsx:452-546` (handlers capital), 2473 líneas totales | Media (mantenibilidad) / Alta como causa raíz indirecta del bug de capital | Pendiente |
| A2 | `AIAssistant.tsx` monolítico (~3878 líneas): UI + lógica de red + control de cuotas + 20 definiciones de tools + prompt de sistema, todo junto. | `AIAssistant.tsx` (archivo completo); `callGemini`/fetch en `AIAssistant.tsx:1107` | Media (mantenibilidad) | Pendiente |
| A3 | **API key en cliente solo con base64.** `btoa/atob` es ofuscación reversible; cualquier XSS o acceso al dispositivo (DevTools → Application → localStorage) la lee en claro. | `AIAssistant.tsx:34-51`, `App.tsx:779-785`, header en `App.tsx:843` y `AIAssistant.tsx:1107` | Media (clave propia del usuario, blast radius acotado a su cuota Gemini) | Pendiente |
| A4 | **`.env.example` engañoso:** documenta `GEMINI_API_KEY` pero NO hay `import.meta.env`/`process.env`/`define` que lo consuma. La clave real solo se obtiene del input del usuario. | `.env.example:4`; ausencia confirmada por grep en `src/` y `vite.config.ts` | Baja | Pendiente |
| A5 | **Sin backup/restore ni sync.** Persistencia 100% `localStorage` bajo prefijo `cobuy_*`. La exportación CSV no es un backup restaurable del estado completo. Limpiar datos del navegador o la evicción de storage de la PWA borra todo sin recuperación. | `App.tsx:322-427` (autosaves), claves `cobuy_*` | Alta (durabilidad de datos) | Pendiente |
| A6 | **Inconsistencia de naming** en localStorage: `spendwise_api_requests` rompe el prefijo `cobuy_*` usado por el resto. Dificulta limpieza/migración coherente. | `AIAssistant.tsx` (contador de requests RPM/RPD) | Baja | Pendiente |
| A7 | Dependencia muerta `@google/genai` (instalada, no importada — se usa fetch REST manual). Peso/confusión. | `package.json` (dependencies) | Baja | Pendiente |
| A8 | Manifest PWA con nombre distinto al de la UI ("CuentasCompras" vs "SpendWise Pro"). | `vite.config.ts` (VitePWA manifest) | Baja (cosmético) | Pendiente |

> **Sobre "¿la API key queda expuesta en el bundle?" (prioridad de seguridad):**
> **NO en el bundle** — no hay clave hardcodeada ni inyectada por Vite (`define`) ni
> leída de `import.meta.env`. La clave la ingresa el usuario en runtime.
> **SÍ en el cliente en runtime** — reside en `localStorage` solo con base64. Es
> intrínseco a llamar a Gemini sin backend: cualquier app 100% cliente que llame a
> Gemini expone la clave a quien controle ese navegador. Para una PWA personal de un
> solo usuario es aceptable; para un despliegue hosteado/multiusuario es un vector de fuga.

---

## Plan de acción (ordenado por prioridad)

### Prioridad 1 — Durabilidad de datos (A5)
1. Añadir **backup/restore de estado completo** (export/import JSON de todas las claves
   `cobuy_*`), distinto del export CSV. Botón "Exportar respaldo" / "Restaurar respaldo".
2. (Opcional futuro) Evaluar sync opcional (backend ligero o proveedor tipo
   Firebase/Supabase) — decisión de producto, ver "Decisiones tomadas".

### Prioridad 2 — Endurecer manejo de la API key (A3, A4)
1. Corregir/eliminar `.env.example` para no sugerir un flujo `GEMINI_API_KEY` inexistente.
2. Documentar explícitamente en UI/README que la clave se guarda solo ofuscada en el
   dispositivo y que no debe usarse en equipos compartidos.
3. (Si algún día se hostea multiusuario) mover las llamadas a Gemini detrás de un proxy
   backend que guarde la clave server-side. Requiere backend → ligado a Prioridad 1 opcional.

### Prioridad 3 — Reducir acoplamiento del estado (A1)
1. Extraer la lógica de capital (`cashBudget`, `cardBudget`, incomes, apartados,
   cierre de mes) a un **reducer o hook `useBudget`** con una única fuente de verdad.
   Esto es prerrequisito recomendable para arreglar el bug de cálculo de forma robusta
   (ver `PLAN_BUG_CALCULO.md`). No hacer refactor masivo sin cubrir primero el bug.
2. Extraer módulos de dominio de `App.tsx` de forma incremental (capital / compras /
   servicios / import CSV) hacia hooks o Context, sin reescritura big-bang.

### Prioridad 4 — Modularizar `AIAssistant.tsx` (A2) y limpieza (A6, A7, A8)
1. Separar en `AIAssistant.tsx`: capa de red (`geminiClient.ts`), definiciones de tools
   (`aiTools.ts`), prompt de sistema (`systemPrompt.ts`) y UI.
2. Renombrar `spendwise_api_requests` → `cobuy_api_requests` (con migración).
3. Eliminar dependencia `@google/genai` si se confirma que no se usará el SDK.
4. Alinear nombre del manifest con "SpendWise Pro".

---

## Historial de sesiones

- **2026-07-01** — Auditoría inicial. Se catalogaron 8 hallazgos (A1–A8) con evidencia
  archivo:línea y severidad. Se confirmó que la API key NO está en el bundle pero sí
  accesible en cliente (base64). No se modificó código. Todo queda **Pendiente**.
  _Falta:_ que el usuario priorice cuáles atacar y en qué orden; decidir si habrá backend.

---

## Decisiones tomadas

- (2026-07-01) El análisis se hizo en modo solo-lectura por instrucción explícita del
  usuario ("no toques nada aún"). Cualquier implementación requiere visto bueno previo.
- _Pendiente de decidir:_ ¿La app seguirá siendo 100% cliente sin backend? Esta decisión
  gobierna A3 (protección real de la key) y A5 (sync). Registrar aquí la respuesta cuando
  el usuario la dé, para no repreguntar.
