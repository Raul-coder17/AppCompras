# PLAN DE BUG — Cálculo de capital (falsas alertas de sobregiro)

> Documento de trabajo para retomar en sesiones futuras. NO ejecutar cambios sin
> confirmar con el usuario. Estado inicial de todo: **Pendiente**.

---

## Sesión actual

- **Fecha:** 2026-07-01
- **Síntoma reportado:** La app alerta que "los gastos superan el capital" cuando los
  datos ingresados son correctos. Inconsistencia en `cashBudget`/`cardBudget`.
- **Modo:** Solo análisis. No se tocó código.
- **Commit base:** `9998146`.

### Modelo de datos actual (clave para entender el bug)
Los dos pools `cashBudget` y `cardBudget` son **saldos vivos**, no presupuestos iniciales:

```
pool  =  saldo_inicial  +  ingresos  −  apartados      (se mutan en tiempo real)
remainingCash = cashBudget − cashSpent                 (los gastos se restan SOLO al mostrar)
```

- Ingresos **mutan** el pool: `setCashBudget(prev => prev + amount)` (`App.tsx:460,462`).
- Apartados **mutan** el pool: `setCashBudget(prev => prev - amount)` (`App.tsx:495,497`).
- **Las compras/servicios NUNCA mutan el pool** — solo se descuentan en el render
  (`BudgetCard.tsx:304-305`). Verificado: no hay ningún `setCashBudget`/`setCardBudget`
  ligado a marcar un ítem como comprado.

Esta **asimetría** (ingresos/apartados mutan el pool; gastos no) es el terreno donde
nacen las falsas alertas. Hay **dos alertas distintas** y cada una tiene su causa:

---

## Las dos alertas y su mecanismo exacto

### Alerta 1 — Banner global "🚨 ¡PRESUPUESTO EXCEDIDO!"
- **Dónde:** `BudgetCard.tsx:316-322`.
- **Qué compara:** `percentTotal >= 100`, con
  `percentTotal = (spent + planned) / (cashBudget + cardBudget)` (`BudgetCard.tsx:302-303`).
- **Por qué es falsa con datos correctos:**
  1. Suma **`planned`** (ítems planificados aún NO comprados) al numerador. Planificar el
     mes completo (comportamiento normal y correcto) empuja el % a 100% aunque lo gastado
     real (`spent`) sea mínimo o cero. El banner dice "excedido" sin sobregiro real.
  2. El denominador `cashBudget + cardBudget` **ya viene reducido por los apartados**
     (que restaron del pool). Apartar dinero encoge el denominador e infla el %.
- **Reproducción:** Presupuesto tarjeta = 1000, $0 gastado, planificás compras por 1000.
  `percentTotal = (0 + 1000)/1000 = 100%` → banner "¡PRESUPUESTO EXCEDIDO!" con gasto real 0.

### Alerta 2 — Badge por pool "Sobregirado"
- **Dónde:** `BudgetCard.tsx:445` (efectivo) y `:555` (tarjeta); fórmula en `:304-305`.
- **Qué compara:** `remainingCash < 0` donde `remainingCash = cashBudget − cashSpent`.
- **Causas de falso positivo con datos correctos:**
  - **C1 (principal):** editar el "Presupuesto Inicial" borra ingresos/apartados
    acumulados en el pool (ver Causa raíz #1 abajo).
  - **C2:** `cashSpent`/`cardSpent` suman **todos** los ítems `bought` sin filtrar por mes
    (`App.tsx:1363-1366`), mientras los servicios sí se filtran por `currentMonth`
    (`App.tsx:1357`). Un ítem comprado con `createdAt` de otro mes (p. ej. alta manual o
    por IA con fecha pasada) infla `spent` y puede volver negativo el restante.

---

## Causas raíz (con evidencia)

### Causa raíz #1 — El campo "Presupuesto Inicial" edita el pool vivo (HIGH)
- **Evidencia:** el input etiquetado "Presupuesto Inicial" está ligado a `cashBudget`
  (el pool vivo) en `BudgetCard.tsx:526-542`; al guardar llama `onUpdateBudget` →
  `handleUpdateBudget` que hace `setCashBudget(newBudget)` **sobrescribiendo el pool
  completo** (`App.tsx:1148-1156`).
- **Problema:** el pool = inicial + ingresos − apartados. Al "corregir el inicial", el
  usuario reemplaza ese total acumulado por un número, **borrando silenciosamente los
  ingresos y apartados** ya sumados/restados.
- **Existe `initialCashBudgetSnapshot`** (`App.tsx:143-144`) pensado como verdadero
  "inicial", pero **NO se muestra en la tarjeta** — solo se consume al cerrar mes
  (`App.tsx:596-597`). Es decir, la UI muestra y edita la variable equivocada.
- **Reproducción exacta:**
  1. Inicio de mes: `cashBudget = 1000`.
  2. Agregás ingreso efectivo +2000 (sueldo) → pool = 3000. Restante = 3000. ✔️ correcto.
  3. Comprás 2500 en efectivo → Restante = 3000 − 2500 = 500. ✔️ correcto.
  4. Abrís "Editar Presupuesto Inicial": el campo muestra **3000** (el pool, mal
     etiquetado). Creés que tu inicial fue 1000 y escribís 1000 → guardar.
  5. Ahora `cashBudget = 1000`, Restante = 1000 − 2500 = **−1500 → "Sobregirado"**,
     aunque el ingreso de 2000 era real. El ingreso desapareció del pool.

### Causa raíz #2 — Semántica ambigua de `cashBudget`/`cardBudget` (MEDIUM-HIGH)
- Un mismo número representa a la vez "saldo inicial" (como lo muestra/edita la tarjeta)
  y "saldo vivo tras ingresos y apartados" (como lo usa `remaining`). No hay fuente única
  de verdad para el "inicial" visible. `initialCashBudgetSnapshot` existe pero está
  desconectado del display (`App.tsx:596-597` es su único consumidor).
- Consecuencia: cualquier operación que trate el número como "inicial" rompe el invariante
  del ledger. Es el suelo estructural de la Causa raíz #1.

### Causa raíz #3 — Numerador y denominador incoherentes en `percentTotal` (MEDIUM)
- `totalAllocated = spent + planned` (compromiso) se compara contra
  `totalBudget = cashBudget + cardBudget` (disponible ya reducido por apartados)
  (`BudgetCard.tsx:302-303`). Mezcla "comprometido" con "disponible neto" → banner
  "EXCEDIDO" sin sobregiro real (Alerta 1).

### Causa raíz #4 — `spent` de ítems sin filtro de mes (MEDIUM/LOW)
- `App.tsx:1363-1366`: los ítems `bought` se suman sin `startsWith(currentMonth)`,
  a diferencia de los servicios (`App.tsx:1357`). Un ítem comprado fechado en otro mes
  infla el gasto del mes activo (Alerta 2, causa C2).

### Descartado (no es el bug, pero revisado)
- **Race de persistencia con `isInitialized`:** la carga y el `setIsInitialized(true)`
  ocurren en un mismo `useEffect` (`App.tsx:190-319`, flag en `:317`), y todos los
  autosaves están protegidos con `if (!isInitialized) return` (`App.tsx:322-427`).
  No se observó carrera que sobrescriba con datos viejos. **Mitigado**, no es la causa.
  (Riesgo latente: los defaults no-cero `cardBudget = DEFAULT_BUDGET` en `:120` solo serían
  peligrosos si un save corriera antes del load; el guard lo impide.)
- **Cierre de mes (`handleConfirmCloseMonth`, `App.tsx:549-655`):** el snapshot y los
  restantes se calculan de forma coherente; el fallback de `initialCashBudget` vuelve a
  sumar apartados e ingresos (`:596-597`). No se detectó doble conteo aquí.

---

## Tabla de hallazgos

| # | Problema | Archivo:línea | Severidad | Estado |
|---|----------|---------------|-----------|--------|
| B1 | Editar "Presupuesto Inicial" sobrescribe el pool vivo y borra ingresos/apartados acumulados → falso "Sobregirado". | `BudgetCard.tsx:526-542`, `App.tsx:1148-1156` | Alta | Pendiente |
| B2 | Semántica ambigua del pool; `initialCashBudgetSnapshot` existe pero no se usa en el display (solo al cerrar mes). | `App.tsx:143-144`, `:596-597`, `BudgetCard.tsx:304-305` | Media-Alta | Pendiente |
| B3 | Banner "PRESUPUESTO EXCEDIDO" compara comprometido (spent+planned) contra disponible neto de apartados. Falsa alarma al planificar o apartar. | `BudgetCard.tsx:302-303, 316-322` | Media | **Resuelto (2026-07-01)** |
| B4 | `cashSpent`/`cardSpent` suman ítems `bought` sin filtrar por mes (servicios sí se filtran). | `App.tsx:1357` vs `:1363-1366` | Media/Baja | Pendiente |
| B5 | Asimetría del ledger: ingresos/apartados mutan el pool, gastos no. Terreno de raíz de todo lo anterior. | `App.tsx:460-497` vs `BudgetCard.tsx:304-305` | Media (estructural) | Pendiente |

---

## Plan de acción (ordenado por prioridad)

### Paso 1 — Arreglar B1/B2 (falso sobregiro tras editar): fuente única de verdad
- Opción recomendada: separar claramente **"saldo inicial del mes"** (editable, =
  `initialCashBudgetSnapshot`) de **"saldo disponible"** (derivado). Mostrar/editar el
  snapshot en la tarjeta; derivar el pool vivo como
  `snapshot + ingresos − apartados` en un `useMemo`, en vez de mutar `cashBudget` a mano.
- Trade-off: requiere reescribir cómo se actualiza el pool (hoy imperativo). Encaja con
  el hook `useBudget` propuesto en `PLAN_ARQUITECTURA.md` (A1). Se puede hacer acotado
  sin el refactor completo si hace falta rapidez.

### Paso 2 — Arreglar B3 (banner falso) — ✅ Resuelto 2026-07-01
- Separar dos indicadores: (a) "comprometido" = `(spent+planned)/presupuestoTotalBruto`
  y (b) "sobregiro real" = `spent > disponible`. Reservar el banner rojo "EXCEDIDO" solo
  para sobregiro real (`spent`), no para `spent+planned`. Sumar apartados de vuelta al
  denominador o usar el presupuesto bruto para el %.
- **Implementado en `BudgetCard.tsx`:** ver detalle en "Historial de sesiones".

### Paso 3 — Arreglar B4
- Filtrar los ítems de `cashSpent`/`cardSpent` por `currentMonth` igual que los servicios,
  o garantizar que `items` solo contenga ítems del mes activo.

### Paso 4 (opcional, estructural) — Unificar el ledger (B5)
- Migrar a un modelo donde el pool disponible siempre se **deriva** de inicial + ingresos
  − apartados − gastos, eliminando las mutaciones imperativas dispersas. Reduce a cero la
  clase de bugs de "doble conteo / pérdida de saldo".

---

## Historial de sesiones

- **2026-07-01 (mañana)** — Investigación root cause. Se identificaron 2 alertas
  distintas y 4 causas raíz (B1–B4) más la asimetría estructural (B5), con evidencia
  archivo:línea y una reproducción exacta para B1. Se descartó la sospecha de race con
  `isInitialized` y de doble conteo en el cierre de mes (revisados y correctos). No se
  modificó código. Todo quedó **Pendiente**.

- **2026-07-01 (tarde)** — Implementado el fix quirúrgico de B3, confirmado por el
  usuario como la alerta que estaba viendo (banner rojo global, no el badge por pool).
  Cambios en `src/components/BudgetCard.tsx`:
  - Se reemplazó `percentTotal` (spent+planned / totalBudget neto) por
    `percentCommitted` (spent+planned / `realTotalBudget`, el bruto que ya incluía a
    los apartados, ver var `realTotalBudget` línea ~298) — "comprometido" ya no se
    infla al apartar dinero.
  - Se agregó `isRealOverspend = remainingCash < 0 || remainingCard < 0` como señal de
    sobregiro real por pool (efectivo o tarjeta).
  - El banner rojo "🚨 ¡CAPITAL SOBREGIRADO!" ahora se dispara **solo** con
    `isRealOverspend`, no con planificación.
  - El banner ámbar "ADVERTENCIA" (comprometido ≥80%) ahora usa `percentCommitted` y
    se oculta si ya hay sobregiro real (para no duplicar alertas).
  - El borde de la tarjeta (`getContainerStyle`), las barras de progreso y su leyenda
    ahora usan `isRealOverspend` para el rojo y `percentCommitted` para el ámbar, en
    vez de la métrica mezclada anterior.
  - `npm run lint` (tsc --noEmit) pasó sin errores tras el cambio.
  - **No se tocó** B1/B2 (edición de "Presupuesto Inicial" sobrescribiendo el pool) ni
    B4/B5 — quedan pendientes para una sesión futura, fuera de alcance de esta.
  _Falta:_ verificación manual en el navegador (planificar sin gastar → no debe salir
  el banner rojo; forzar gasto > disponible → sí debe salir) y luego abordar B1/B2.

---

## Decisiones tomadas

- (2026-07-01) Análisis en modo solo-lectura por instrucción del usuario. No se aplicó
  ningún fix.
- _Pendiente de decidir:_ ¿Se prefiere un fix quirúrgico (mostrar/editar el snapshot y
  derivar el pool) o el refactor estructural completo del ledger (Paso 4)? Registrar la
  respuesta aquí para no repreguntar.
