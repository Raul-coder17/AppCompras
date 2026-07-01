# Reproducción — Migración de datos legacy al pool derivado (B1/B2)

> Estado detectado: **✅ MIGRACIÓN CORRECTA**
>
> Generado por `scripts/repro-migracion.mjs` (`npm run repro:migracion`). Siembra
> `localStorage` en formato PRE-fix (pool vivo en `cobuy_budget_cash/card`, sin snapshot),
> carga la app, verifica la migración, recarga para probar estabilidad, y opera después.
>
> Fecha de ejecución: 2026-07-01T21:30:56.059Z

## Datos legacy sembrados (formato pre-fix)

- `cobuy_budget_cash` = $850.00 (pool vivo: inicial $500 + ingreso efectivo $400 − apartado $50)
- `cobuy_budget_card` = $1000.00 (pool vivo: inicial $800 + transferencia $200)
- `cobuy_incomes` = [efectivo $400, transferencia $200]
- `cobuy_apartados` = [efectivo $50]
- **Sin** `cobuy_initial_cash_snapshot` / `cobuy_initial_card_snapshot` (no existían pre-fix)

Snapshot esperado tras migrar (= pool − ingresos + apartados):
efectivo $500.00, tarjeta $800.00.

## Valores observados (leídos de localStorage, no de la UI)

| Momento | pool efectivo | pool tarjeta | snapshot efectivo | snapshot tarjeta |
|---|---|---|---|---|
| Tras migrar (1ª carga) | $850.00 | $1000.00 | $500.00 | $800.00 |
| Tras recargar (2ª carga) | $850.00 | $1000.00 | $500.00 | $800.00 |
| Tras editar inicial a $600 (paso 4) | $950.00 | $1000.00 | $600.00 | $800.00 |
| Tras recargar post-edición (paso 5a) | $1020.00 | $1000.00 | $600.00 | $800.00 |
| Tras inyectar legacy stale $99999 + recargar (paso 5b) | $1020.00 | $1000.00 | $600.00 | $800.00 |

## Aserciones

| | Verificación | Detalle |
|---|---|---|
| ✅ | Paso 2 — pool EFECTIVO derivado == pool legacy sembrado | derivado $850.00 vs legacy $850.00 |
| ✅ | Paso 2 — pool TARJETA derivado == pool legacy sembrado | derivado $1000.00 vs legacy $1000.00 |
| ✅ | Paso 2 — snapshot EFECTIVO reconstruido correctamente (pool − ingresos + apartados) | snapshot $500.00 vs esperado $500.00 |
| ✅ | Paso 2 — snapshot TARJETA reconstruido correctamente | snapshot $800.00 vs esperado $800.00 |
| ✅ | Paso 2 — claves legacy (cobuy_budget_cash/card) BORRADAS tras migrar | cobuy_budget_cash presente=false |
| ✅ | Paso 3 — centinela intacto: NO se re-sembró en la recarga | __migration_test_seeded=1 |
| ✅ | Paso 3 — pool EFECTIVO estable tras recargar (migración run-once/idempotente) | $850.00 (debía seguir $850.00) |
| ✅ | Paso 3 — pool TARJETA estable tras recargar | $1000.00 (debía seguir $1000.00) |
| ✅ | Paso 3 — snapshot EFECTIVO no re-derivado a otro valor | $500.00 (debía seguir $500.00) |
| ✅ | Paso 4a — tras editar inicial a $600, pool efectivo = 600 + ingresos − apartados | $950.00 vs esperado $950.00 |
| ✅ | Paso 4b — ingreso efectivo posterior +$100 se suma al pool (no se pierde) | $1050.00 (esperado $1050.00 = $950.00 + $100) |
| ✅ | Paso 4c — apartado efectivo posterior -$30 reduce el pool | $1020.00 (esperado $1020.00) |
| ✅ | Paso 4 — el snapshot editado ($600) se mantiene como fuente de verdad | snapshot $600.00 |
| ✅ | Paso 5a — tras recargar, el snapshot editado sigue en $600 (no vuelve al legacy) | snapshot $600.00 |
| ✅ | Paso 5a — tras recargar, el pool sigue en $1020 (no se re-deriva desde legacy) | $1020.00 (esperado $1020.00) |
| ✅ | Paso 5b — snapshot NO recalculado desde la clave legacy inyectada (sigue $600) | snapshot $600.00 (si fuera <600 la app recalculó desde legacy → BUG) |
| ✅ | Paso 5b — pool sigue en $1020 pese a la clave legacy stale ($99999 ignorada) | $1020.00 (esperado $1020.00) |

## Conclusión

**✅ La migración es correcta, estable y con guard explícito.** El pool derivado tras migrar
es idéntico al pool legacy que el usuario ya veía (no cambia ningún número), las claves legacy
(`cobuy_budget_cash/card`) se **borran** al migrar, y al recargar la PWA el snapshot es la única
fuente de verdad (guard: si el snapshot existe, jamás se recalcula desde legacy).

Puntos clave verificados:
- **Paso 4→5a:** tras editar el "Presupuesto Inicial" a $600 y recargar de verdad, la edición
  **persiste** (snapshot $600, pool $1020). No se pierde — que era el riesgo señalado.
- **Paso 5b (adversarial):** inyectando un `cobuy_budget_cash=99999` stale y recargando, la app
  lo **ignora** por completo (snapshot sigue $600, pool $1020). Confirma que no queda ningún
  camino de recálculo desde las claves legacy una vez migrado.

Listo para commit.

---
*Reporte generado automáticamente — no editar a mano. Regenerar con `npm run repro:migracion`.*
