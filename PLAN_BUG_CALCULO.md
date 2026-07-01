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
- **Corrección tras reproducción automatizada (2026-07-01, ver `REPRO_B1_REPORTE.md`):**
  `handleUpdateBudget` (`App.tsx:1148-1156`) sobrescribe `cashBudget` **y también**
  `initialCashBudgetSnapshot` con el mismo valor en el mismo golpe. El snapshot NO
  sobrevive intacto como se asumía originalmente — queda igual de corrompido que el
  pool visible, y no hay ninguna variable de respaldo en el estado de React para
  reconstruir el valor correcto tras el error. Sí sobreviven intactos los registros
  individuales en `cobuy_incomes`/`cobuy_apartados` (el dato para reconstruir el pool
  existe en localStorage, pero la función de edición no lo usa).
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
| B1 | Editar "Presupuesto Inicial" sobrescribe el pool vivo y borra ingresos/apartados acumulados → falso "Sobregirado". | `BudgetCard.tsx:526-542`, `App.tsx:1148-1156` | Alta | **Resuelto (2026-07-01)** |
| B2 | Semántica ambigua del pool; `initialCashBudgetSnapshot` existe pero no se usa en el display (solo al cerrar mes). | `App.tsx:143-144`, `:596-597`, `BudgetCard.tsx:304-305` | Media-Alta | **Resuelto (2026-07-01)** |
| B3 | Banner "PRESUPUESTO EXCEDIDO" compara comprometido (spent+planned) contra disponible neto de apartados. Falsa alarma al planificar o apartar. | `BudgetCard.tsx:302-303, 316-322` | Media | **Resuelto (2026-07-01)** |
| B4 | `cashSpent`/`cardSpent` suman ítems `bought` sin filtrar por mes (servicios sí se filtran). | `App.tsx:1357` vs `:1363-1366` | Media/Baja | Pendiente |
| B5 | Asimetría del ledger: ingresos/apartados mutan el pool, gastos no. Terreno de raíz de todo lo anterior. | `App.tsx:460-497` vs `BudgetCard.tsx:304-305` | Media (estructural) | **Resuelto (2026-07-01)** — el refactor B1/B2 eliminó TODA mutación imperativa del pool (grep de `setCashBudget`/`setCardBudget` = 0); ahora pool y restante son 100% derivados (`snapshot + ingresos − apartados`, y `remaining = pool − spent`). La clase "doble conteo / pérdida de saldo" que B5 marcaba como raíz queda cerrada. Nota: el filtro por mes de `spent` (B4) es un tema aparte, aún Pendiente; no reabre B5. |
| B6 | Regresión del fix B1/B2 en la capa de IA: `add_budget_funds` sumaba sobre el pool derivado y lo escribía en el snapshot → doble conteo de ingresos/apartados. `set_budget` con descripción/copy engañosos ("total exacto"). | `AIAssistant.tsx:1472-1489` (executores), `:776-786` (tool def) | Alta (efectivo cuando hay ingresos/apartados) | **Resuelto (2026-07-01)** |

---

## Plan de acción (ordenado por prioridad)

### Paso 1 — Arreglar B1/B2 (falso sobregiro tras editar): fuente única de verdad — ✅ Resuelto 2026-07-01
- Opción recomendada: separar claramente **"saldo inicial del mes"** (editable, =
  `initialCashBudgetSnapshot`) de **"saldo disponible"** (derivado). Mostrar/editar el
  snapshot en la tarjeta; derivar el pool vivo como
  `snapshot + ingresos − apartados` en un `useMemo`, en vez de mutar `cashBudget` a mano.
- Trade-off: requiere reescribir cómo se actualiza el pool (hoy imperativo). Encaja con
  el hook `useBudget` propuesto en `PLAN_ARQUITECTURA.md` (A1). Se puede hacer acotado
  sin el refactor completo si hace falta rapidez.
- **Implementado** exactamente con esta opción — ver detalle en "Historial de sesiones"
  (2026-07-01 madrugada) y verificación en `REPRO_B1_REPORTE.md`.

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

- **2026-07-01 (noche)** — Reproducción automatizada y determinística de B1 con
  Playwright, sin depender del historial real de ningún usuario. Se agregó
  `@playwright/test` como devDependency (`npx playwright install chromium` para el
  binario) y se creó `scripts/repro-b1-capital-bug.mjs`, reusable después de aplicar
  el fix (`npm run repro:b1`).
  - El script levanta su propio dev server aislado (puerto 3100), siembra
    `localStorage` limpio (`cobuy_*` en cero, sin items/ingresos/apartados) en un
    contexto de navegador nuevo por corrida, ejecuta la secuencia de "varios días"
    pedida, y lee el estado real vía `page.evaluate(() => localStorage)` — nunca la
    UI — después de cada paso.
  - Corrió 3 escenarios: **control** (sin editar "Presupuesto Inicial"), **with-edit-0**
    (edición a $0 en el día 4) y **with-edit-50** (edición a $50 en el día 4).
  - **Resultado:** el control cumple la fórmula `pool = inicial + ingresos − apartados`
    en los 6 pasos sin ninguna divergencia. Ambas corridas con edición divergen
    exactamente en el día 4 (el paso de editar "Presupuesto Inicial"), perdiendo
    **$400** en ambos casos (ingresos efectivo acumulados $500 − apartados efectivo
    acumulados $100), **independientemente del valor escrito** — confirma que el bug
    es una sobrescritura total del pool, no un error de cálculo sobre el valor
    ingresado. En el día 4/5 `remainingCash` queda negativo en ambas corridas con
    edición, confirmando que esto dispara el falso "Sobregirado" reportado
    originalmente por el usuario.
  - **Hallazgo nuevo respecto a lo documentado:** `handleUpdateBudget`
    (`App.tsx:1148-1156`) sobrescribe `cashBudget` **y** `initialCashBudgetSnapshot`
    en el mismo golpe — el snapshot NO sobrevive intacto como se asumía en la causa
    raíz #1 original; no queda ninguna variable de respaldo en el estado de React
    para reconstruir el valor correcto. Sí sobreviven intactos los registros
    individuales en `cobuy_incomes`/`cobuy_apartados` (el dato para reconstruir el
    pool correcto existe en localStorage, pero la función de edición no lo usa).
  - Reporte completo con tablas paso a paso: `REPRO_B1_REPORTE.md` (raíz del repo,
    regenerable con `npm run repro:b1`).
  - No se tocó lógica de la app en esta sesión — solo instrumentación de prueba.
  _Falta:_ aplicar el fix de B1/B2 (Paso 1 más arriba) y volver a correr
  `npm run repro:b1` para confirmar que las 3 corridas dejan de divergir.

- **2026-07-01 (madrugada) — FIX de B1/B2 aplicado y verificado.** Se implementó el
  modelo derivado (Paso 1). Cambios:
  - **`src/App.tsx`:**
    - `cashBudget`/`cardBudget` dejaron de ser `useState` y pasaron a **derivarse** con
      `useMemo`: `snapshot + ingresos(del pool) − apartados(del pool)`. Los snapshots
      `initialCashBudgetSnapshot`/`initialCardBudgetSnapshot` son la única fuente de verdad.
    - `handleUpdateBudget` reescrito para escribir **solo** sobre el snapshot (ya no
      existe `setCashBudget`/`setCardBudget` en ningún handler — verificado por grep global).
    - Handlers de ingresos (`handleAddIncome`/`handleDeleteIncome`) y de apartados
      (add/deposit/withdraw/delete) dejaron de mutar el pool: solo agregan/quitan el
      registro y el `useMemo` recalcula.
    - `handleConfirmImport` (CSV): eliminado `cardBudgetAdjustment`/`setCardBudget`; los
      ingresos importados entran a `incomes` y el pool los deriva (evita doble conteo).
    - `handleConfirmCloseMonth`: como los apartados persisten al cerrar y el `newCashBudget`
      del wizard ya viene neto de apartados, el snapshot se fija en
      `newCashBudget + totalApartadosCash` (y equivalente tarjeta) para que el pool libre
      derivado sea exactamente `newCashBudget`. Sin regresión de saldo ni doble resta.
    - `handleConfirmReset` y el `catch` de carga: quitados los `setCashBudget/setCardBudget`;
      el fallback fija snapshots (cash=0, card=`DEFAULT_BUDGET`).
    - **Migración en la carga inicial:** el viejo "pool vivo" (`cobuy_budget_cash/card`) se
      convierte a snapshot con `snapshot = pool − ingresos + apartados`, de modo que el pool
      derivado reproduce exactamente lo que el usuario ya veía (idempotente una vez migrado).
  - **`src/components/BudgetCard.tsx`:** el campo "Presupuesto Inicial" ahora muestra y
    edita `initialCashBudget`/`initialCardBudget` (nuevos campos de `BudgetSummary`), no el
    pool derivado. No se tocó el fix de B3 (`isRealOverspend`/`percentCommitted`).
  - **`src/types.ts`:** `BudgetSummary` ganó `initialCashBudget`/`initialCardBudget`.
  - **Verificación (`npm run repro:b1`):** las **3 corridas (control, with-edit-0,
    with-edit-50) dan CERO divergencias en los 6 pasos**, incluido el día 4. Editar a $0
    deja el pool en $400 (antes: $0, perdía $400) y a $50 lo deja en $450 — ingresos y
    apartados preservados; ningún falso "Sobregirado". `REPRO_B1_REPORTE.md` ahora reporta
    "✅ FIX B1/B2 VERIFICADO" (el `buildReport` del script se hizo adaptativo roto/arreglado).
  - `npm run lint` y `npm run build` pasan sin errores. Sin commit/push todavía (a pedido).

- **2026-07-01 (madrugada, cont.) — Prueba de migración de datos legacy.** Se creó
  `scripts/repro-migracion.mjs` (`npm run repro:migracion`) para validar específicamente que
  el fix no rompe a usuarios con datos del formato viejo (pool vivo en `cobuy_budget_cash/card`,
  sin snapshot). Siembra legacy run-once (centinela `__migration_test_seeded` para que la
  recarga NO re-siembre), carga, recarga y opera. **12/12 aserciones PASS**:
  - Paso 2: el pool derivado tras migrar es **idéntico** al pool legacy (efectivo $850,
    tarjeta $1000) — el usuario no ve cambiar ningún número. Snapshot reconstruido correcto
    (efectivo $500, tarjeta $800 = pool − ingresos + apartados).
  - Paso 3: tras **recargar** (simula reabrir la PWA), pool y snapshot **estables** — la
    migración es idempotente (re-deriva pero converge porque el pool persistido ya refleja
    ingresos/apartados). El centinela confirma que no hubo re-sembrado en la recarga.
  - Paso 4: tras editar el inicial a $600 el pool = $950 (600+400−50); un ingreso posterior
    +$100 → $1050 (no se pierde); un apartado posterior −$30 → $1020; el snapshot editado
    ($600) se mantiene como fuente de verdad.
  - Reporte: `REPRO_MIGRACION_REPORTE.md` → "✅ MIGRACIÓN CORRECTA". El script sale con código
    ≠ 0 si alguna aserción falla (para CI/pre-commit).

- **2026-07-01 (madrugada, cont. 2) — Guard de migración explícito + bug de StrictMode.**
  Se detectó un riesgo real (reportado por el usuario): sin un guard, la fórmula de migración
  se recalculaba en cada carga desde las claves legacy `cobuy_budget_cash/card` + los
  ingresos/apartados ACTUALES; una edición posterior del inicial podía perderse en la
  siguiente recarga. Cambios en `src/App.tsx`:
  - **Guard explícito:** si `cobuy_initial_cash_snapshot` **y** `cobuy_initial_card_snapshot`
    ya existen → "ya migrado": se leen directo y **nunca** se recalcula desde las claves legacy.
    Las lecturas de las claves legacy se movieron DENTRO de la rama de migración (no se leen
    una vez migrado).
  - **Borrado de claves legacy** al migrar (`removeItem` de `cobuy_budget_cash`,
    `cobuy_budget_card`, `cobuy_total_budget`) — sin ambigüedad futura.
  - **El pool ya NO se persiste**: se eliminó el effect que escribía `cobuy_budget_cash/card`
    (re-crearlas reabriría el riesgo). El pool vive solo en memoria (useMemo); la fuente de
    verdad persistida es el snapshot.
  - **Bug de `<StrictMode>` encontrado y corregido:** la doble invocación del effect de carga
    en dev hacía que la 1ª corrida migrara y borrara la clave legacy, y la 2ª re-migrara desde
    cero (snapshot efectivo quedaba en −$350). Fix: en la rama de migración se persiste el
    snapshot en `localStorage` **sincrónicamente** (además del `setState`), de modo que la 2ª
    invocación ya ve el snapshot y entra por la rama "ya migrado". Sin este fix el paso 2 fallaba.
  - **Scripts:** `readState`/`readCobuyState` de ambos repros ahora **derivan** el pool del
    snapshot (ya no leen la clave legacy `cobuy_budget_cash`, que dejó de persistirse).
  - **`repro-migracion.mjs` extendido (paso 5):** (5a) recarga real tras editar el inicial a
    $600 → snapshot sigue $600 y pool $1020 (la edición NO se pierde); (5b) adversarial: se
    inyecta un `cobuy_budget_cash=99999` stale y se recarga → la app lo **ignora** (snapshot
    sigue $600, pool $1020), probando que no hay recálculo desde legacy una vez migrado.
  - **Verificación:** `npm run repro:migracion` **15/15 PASS** ("✅ MIGRACIÓN CORRECTA"),
    `npm run repro:b1` sigue "✅ FIX B1/B2 VERIFICADO", `npm run lint` y `npm run build` OK.

- **2026-07-01 (madrugada, cont. 3) — B6: fix de los tools de presupuesto de la IA.** Un grep
  global de `cobuy_budget_cash/card` (pedido por el usuario) confirmó que NINGÚN archivo fuera
  del guard de migración lee esas claves. Pero destapó una regresión del fix B1/B2 en la capa de
  function-calling de la IA (`src/components/AIAssistant.tsx`):
  - **`add_budget_funds` (`executeBudgetFunds`) — BUG corregido:** sumaba el monto sobre el pool
    DERIVADO (`cashBudget`) y lo escribía en el snapshot vía `onUpdateBudget`, duplicando
    ingresos/apartados. Con ingresos $400 y apartado $50, "+$100" subía el pool en +$450 (a
    $1300). Fix: sumar sobre el snapshot (`initialCashBudget`/`initialCardBudget`, nuevos props
    pasados desde `App.tsx`), de modo que el pool sube por EXACTAMENTE el monto pedido.
  - **`set_budget` (`executeSetBudget`) — decisión + comunicación:** se mantiene la semántica de
    fijar el snapshot inicial (igual que el campo manual), pero se reescribió la descripción del
    tool (lo que ve Gemini) y el mensaje de confirmación al usuario para aclarar, en lenguaje
    simple para adultos mayores, que fija el punto de partida del mes y que ingresos/apartados se
    suman/restan aparte. No se fuerza un total exacto en vivo.
  - **Prueba nueva:** `scripts/repro-ai-budget.mjs` (`npm run repro:ai-budget`) ejercita los
    executores REALES vía un hook e2e (`window.__spendwiseAI`) con ingresos y apartados
    presentes. **10/10 PASS**: `add_budget_funds`
    sube el pool por exactamente $100/$250 (el bug daba +$450), `set_budget` fija el inicial en
    $1000 y el disponible se recalcula a $1350, con el copy aclaratorio verificado.
  - **Verificación completa:** `repro:ai-budget` 10/10, `repro:b1` y `repro:migracion` siguen en
    verde, `npm run lint` y `npm run build` OK.
  - **Ajuste del hook e2e (2026-07-01, cont.):** el hook `window.__spendwiseAI` en
    `AIAssistant.tsx` se gatea con `import.meta.env.DEV` (no con un flag de runtime), de modo que
    Vite/Rollup lo eliminan por dead-code elimination en `npm run build`. Verificado: `grep` del
    bundle `dist/assets/*.js` da **0 coincidencias** de `__spendwiseAI`/`__SPENDWISE_E2E__` (con
    un string de control confirmando que el grep sí inspecciona el bundle). Se agregó
    `src/vite-env.d.ts` (`/// <reference types="vite/client" />`) para tipar `import.meta.env`,
    ya que `tsconfig` limita `types` a `vite-plugin-pwa/client`. El repro corre contra dev
    (DEV=true), así que no necesita ningún flag.

---

## Decisiones tomadas

- (2026-07-01) Análisis en modo solo-lectura por instrucción del usuario. No se aplicó
  ningún fix.
- (2026-07-01) **Fix quirúrgico elegido sobre refactor total.** Se implementó el modelo
  derivado por `useMemo` con el snapshot como fuente de verdad (Paso 1), sin migrar aún al
  hook `useBudget` completo ni al ledger unificado (Paso 4 / B5, siguen pendientes). Cierra
  la pregunta "quirúrgico vs estructural": por ahora, quirúrgico.
- (2026-07-01) **Diseño del cierre de mes con pool derivado:** los apartados PERSISTEN al
  cerrar y el `newCashBudget` del wizard ya viene neto de apartados. Decisión: el snapshot
  del nuevo mes = `newCashBudget + totalApartados`, para que el pool libre derivado sea
  exactamente `newCashBudget` (preserva el comportamiento previo y el patrimonio neto). No
  re-preguntar; si se cambia, revisar `handleConfirmCloseMonth`.
- (2026-07-01) **Migración de datos existentes (diseño DEFINITIVO con guard):** la migración
  `snapshot = pool_viejo − ingresos + apartados` corre **una sola vez**, gobernada por un guard
  explícito: la presencia de `cobuy_initial_cash_snapshot` **y** `cobuy_initial_card_snapshot`
  es la única condición de "ya migrado". Una vez migrado NO se vuelve a leer ni recalcular desde
  las claves legacy (que además se borran al migrar). Prioriza **preservar el estado visible
  actual** del usuario por sobre "sanar" saldos ya corrompidos (verá lo mismo que antes hasta
  re-editar su inicial, que ahora funciona bien). El snapshot se persiste **sincrónicamente**
  en la rama de migración para ser seguro ante la doble invocación de `<StrictMode>`. No
  re-preguntar; si se cambia, revisar el guard en el `useEffect` de carga de `App.tsx`.
- (2026-07-01) **Semántica de `set_budget` (tool de IA):** fija el **presupuesto INICIAL**
  (snapshot) del mes, igual que el campo manual "Presupuesto Inicial" — NO fija el total
  disponible en vivo. Decisión tomada: NO se calcula un valor distinto para forzar que el total
  quede exacto; lo que se ajustó es la **comunicación** (descripción del tool que ve Gemini +
  mensaje de confirmación al usuario, en lenguaje simple: "es tu punto de partida del mes; tus
  ingresos y apartados se suman/restan aparte"). No re-preguntar. `add_budget_funds`, en cambio,
  sí sube el disponible por exactamente el monto pedido (suma sobre el snapshot).
