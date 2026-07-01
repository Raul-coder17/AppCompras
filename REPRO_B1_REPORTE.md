# Reproducción automatizada — Causa raíz B1 (PLAN_BUG_CALCULO.md)

> Estado detectado en esta corrida: **✅ ARREGLADO (fix B1/B2 aplicado)**
>
> Generado automáticamente por `scripts/repro-b1-capital-bug.mjs` (`npm run repro:b1`). No
> depende del historial real de ningún usuario: cada corrida arranca de un `localStorage`
> sembrado desde cero (`cobuy_budget_cash=0`, `cobuy_budget_card=0`, sin ingresos, sin
> apartados, sin items). El estado se lee siempre de `localStorage` (claves `cobuy_*`) vía
> `page.evaluate`, nunca de la UI.
>
> Fecha de ejecución: 2026-07-01T21:30:51.097Z

## Metodología

Fórmula bajo prueba: **pool = inicial + ingresos(efectivo) − apartados(efectivo)**.

Se corrieron 3 escenarios en contextos de navegador aislados:

1. **control** — secuencia completa, SIN editar "Presupuesto Inicial".
2. **with-edit-0** — igual, pero en el día 4 se edita "Presupuesto Inicial" (efectivo) a **$0**.
3. **with-edit-50** — igual, pero en el día 4 se edita "Presupuesto Inicial" (efectivo) a **$50**.

En cada paso se compara el `cashBudget` real (leído de `localStorage['cobuy_budget_cash']`)
contra el valor esperado por la fórmula, usando como "inicial" el valor de referencia vigente
(0 antes de cualquier edición; el valor editado después de que el usuario lo cambia).

---

## Escenario control (sin editar "Presupuesto Inicial")

| Día | Acción | cashBudget antes | cashBudget después | Ingresos efectivo acumulados (real) | Apartados efectivo acumulados (real) | Esperado por fórmula (después) | ¿Coincide? |
|---|---|---|---|---|---|---|---|
| 1 | Agregar ingreso efectivo +$500 | $0.00 | $500.00 | $500.00 | $0.00 | $500.00 | ✅ Sí |
| 1 | Comprar item efectivo $42.45 (marcado bought) | $500.00 | $500.00 | $500.00 | $0.00 | $500.00 | ✅ Sí |
| 2 | Agregar ingreso tarjeta +$350 (control cruzado: no debe tocar cash) | $500.00 | $500.00 | $500.00 | $0.00 | $500.00 | ✅ Sí |
| 3 | Crear apartado efectivo -$100 | $500.00 | $400.00 | $500.00 | $100.00 | $400.00 | ✅ Sí |
| 4 | Sin editar "Presupuesto Inicial" (paso omitido — corrida control) | $400.00 | $400.00 | $500.00 | $100.00 | $400.00 | ✅ Sí |
| 5 | Comprar item efectivo $10 (marcado bought) | $400.00 | $400.00 | $500.00 | $100.00 | $400.00 | ✅ Sí |

**Resultado control:** ✅ El pool coincide con la fórmula en TODOS los pasos. Ninguna divergencia.

---

## Escenario with-edit-0 (edición a $0 en el día 4)

| Día | Acción | cashBudget antes | cashBudget después | Ingresos efectivo acumulados (real) | Apartados efectivo acumulados (real) | Esperado por fórmula (después) | ¿Coincide? |
|---|---|---|---|---|---|---|---|
| 1 | Agregar ingreso efectivo +$500 | $0.00 | $500.00 | $500.00 | $0.00 | $500.00 | ✅ Sí |
| 1 | Comprar item efectivo $42.45 (marcado bought) | $500.00 | $500.00 | $500.00 | $0.00 | $500.00 | ✅ Sí |
| 2 | Agregar ingreso tarjeta +$350 (control cruzado: no debe tocar cash) | $500.00 | $500.00 | $500.00 | $0.00 | $500.00 | ✅ Sí |
| 3 | Crear apartado efectivo -$100 | $500.00 | $400.00 | $500.00 | $100.00 | $400.00 | ✅ Sí |
| 4 | Editar "Presupuesto Inicial" (efectivo) a $0 | $400.00 | $400.00 | $500.00 | $100.00 | $400.00 | ✅ Sí |
| 5 | Comprar item efectivo $10 (marcado bought) | $400.00 | $400.00 | $500.00 | $100.00 | $400.00 | ✅ Sí |

**Resultado:** ✅ Sin divergencia. Al editar el "Presupuesto Inicial" a $0, el snapshot pasa a $0 y el pool disponible se **recalcula** como snapshot + ingresos − apartados = $0 + $500 − $100 = $400.00.
Los ingresos ($500) y el apartado ($100) **se conservan** — ya no se pierden $400 como en el estado roto.
**`cobuy_initial_cash_snapshot` después de editar:** $0.00 (== valor editado; ahora es la única fuente de verdad, y el pool deriva de él).

---

## Escenario with-edit-50 (edición a $50 en el día 4, para confirmar que no es específico de $0)

| Día | Acción | cashBudget antes | cashBudget después | Ingresos efectivo acumulados (real) | Apartados efectivo acumulados (real) | Esperado por fórmula (después) | ¿Coincide? |
|---|---|---|---|---|---|---|---|
| 1 | Agregar ingreso efectivo +$500 | $0.00 | $500.00 | $500.00 | $0.00 | $500.00 | ✅ Sí |
| 1 | Comprar item efectivo $42.45 (marcado bought) | $500.00 | $500.00 | $500.00 | $0.00 | $500.00 | ✅ Sí |
| 2 | Agregar ingreso tarjeta +$350 (control cruzado: no debe tocar cash) | $500.00 | $500.00 | $500.00 | $0.00 | $500.00 | ✅ Sí |
| 3 | Crear apartado efectivo -$100 | $500.00 | $400.00 | $500.00 | $100.00 | $400.00 | ✅ Sí |
| 4 | Editar "Presupuesto Inicial" (efectivo) a $50 | $400.00 | $450.00 | $500.00 | $100.00 | $450.00 | ✅ Sí |
| 5 | Comprar item efectivo $10 (marcado bought) | $450.00 | $450.00 | $500.00 | $100.00 | $450.00 | ✅ Sí |

**Resultado:** ✅ Sin divergencia. Al editar el "Presupuesto Inicial" a $50, el snapshot pasa a $50 y el pool disponible se **recalcula** como snapshot + ingresos − apartados = $50 + $500 − $100 = $450.00.
Los ingresos ($500) y el apartado ($100) **se conservan** — ya no se pierden $400 como en el estado roto.
**`cobuy_initial_cash_snapshot` después de editar:** $50.00 (== valor editado; ahora es la única fuente de verdad, y el pool deriva de él).

---

## Comparación control vs. con edición

| | Control (sin editar) | with-edit-0 | with-edit-50 |
|---|---|---|---|
| ¿Diverge en algún paso? | No ✅ | No ✅ | No ✅ |
| Monto perdido | — | $0.00 | $0.00 |
| ¿Dispara falso "Sobregirado"? | No | No ✅ | No ✅ |
| `cashBudget` final | $400.00 | $400.00 | $450.00 |
| `cashBudget` final esperado (fórmula) | $400.00 | $400.00 | $450.00 |

## Conclusión — ✅ FIX B1/B2 VERIFICADO

Las **3 corridas cumplen la fórmula `pool = inicial + ingresos − apartados` en TODOS los
pasos**, incluido el día 4 (edición de "Presupuesto Inicial"), que en el estado roto perdía
$400 en ambos casos con edición.

- **control:** `cashBudget` final $400.00 (esperado $400.00).
- **with-edit-0:** editar a $0 deja el pool en $400.00 (los $500 de ingresos − $100 de apartado se conservan), no en $0.
- **with-edit-50:** editar a $50 deja el pool en $450.00 ($50 + $500 − $100).

Ninguna de las corridas dispara el falso "Sobregirado". El fix reescribió `handleUpdateBudget`
(`App.tsx`) para escribir SOLO sobre el snapshot, y `cashBudget`/`cardBudget` pasaron a
**derivarse** vía `useMemo` (snapshot + ingresos − apartados) en lugar de ser estado mutado a
mano. Ahora editar el inicial no puede borrar ingresos ni apartados: el pool se recalcula solo.

> **Nota histórica:** el estado roto previo (y su mecanismo: `handleUpdateBudget` sobrescribía
> `cashBudget` **y** `initialCashBudgetSnapshot` en el mismo golpe, perdiendo $400 sin respaldo
> recuperable) quedó documentado en la entrada correspondiente de `PLAN_BUG_CALCULO.md` →
> Historial de sesiones. Este reporte refleja el estado **posterior** al fix.

---
*Reporte generado automáticamente — no editar a mano. Volver a correr
`npm run repro:b1` regenera este archivo. Si tras un cambio vuelve a aparecer "❌ BUG PRESENTE",
hay una regresión en el modelo de capital derivado.*
