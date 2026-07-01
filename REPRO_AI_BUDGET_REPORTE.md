# Reproducción — Tools de presupuesto de la IA (B6)

> Estado detectado: **✅ TOOLS DE IA CORRECTOS**
>
> Generado por `scripts/repro-ai-budget.mjs` (`npm run repro:ai-budget`). Ejercita los
> executores REALES de los tools `add_budget_funds` y `set_budget` (vía el hook e2e
> `window.__spendwiseAI`, inerte en producción), con ingresos y apartados ya presentes —
> exactamente el caso que rompía antes del fix. El pool se lee derivado del snapshot.
>
> Fecha de ejecución: 2026-07-01T21:37:03.928Z

## Estado sembrado

- Efectivo: snapshot $500 + ingreso $400 − apartado $50 = pool **$850**
- Tarjeta: snapshot $800 + transferencia $200 = pool **$1000**

## Valores observados

| Momento | pool efectivo | snapshot efectivo | pool tarjeta | snapshot tarjeta |
|---|---|---|---|---|
| Inicial | $850.00 | $500.00 | $1000.00 | $800.00 |
| Tras add_budget_funds efectivo +$100 | $950.00 | $600.00 | $1000.00 | $800.00 |
| Tras add_budget_funds tarjeta +$250 | $950.00 | $600.00 | $1250.00 | $1050.00 |
| Tras set_budget efectivo = $1000 | $1350.00 | $1000.00 | $1250.00 | $1050.00 |

## Aserciones

| | Verificación | Detalle |
|---|---|---|
| ✅ | Setup — pool efectivo inicial = 850 (snapshot 500 + ingreso 400 − apartado 50) | $850.00 |
| ✅ | Setup — pool tarjeta inicial = 1000 (snapshot 800 + transferencia 200) | $1000.00 |
| ✅ | add_budget_funds — el pool efectivo sube por EXACTAMENTE $100 (no doble cuenta ingresos/apartados) | $950.00 (esperado $950.00; el bug daba $1300.00) |
| ✅ | add_budget_funds — sumó sobre el snapshot (500 → 600), no sobre el pool derivado | snapshot $600.00 |
| ✅ | add_budget_funds — mensaje de confirmación correcto | "Se añadieron $100 a tu presupuesto de efectivo." |
| ✅ | add_budget_funds — el pool tarjeta sube por EXACTAMENTE $250 | $1250.00 (esperado $1250.00) |
| ✅ | set_budget — fija el snapshot INICIAL en $1000 (no el total en vivo) | snapshot $1000.00 |
| ✅ | set_budget — el disponible se recalcula (1000 + 400 − 50 = 1350), NO queda clavado en 1000 | $1350.00 |
| ✅ | set_budget — el mensaje aclara que es el presupuesto INICIAL (copy para no técnicos) | "Listo: dejé tu presupuesto INICIAL de efectivo en $1000. Eso es tu punto de partida del mes; tus ingresos y apartados ya cargados se suman y se restan aparte, así que el disponible que ves puede ser distinto a esa cifra." |

## Conclusión

**✅ Los tools de presupuesto de la IA son correctos.** `add_budget_funds` suma sobre el
snapshot inicial, así que el pool disponible sube por **exactamente** el monto pedido, sin
doble contar ingresos ni apartados (con el bug previo, +$100 habría subido el pool en +$450).
`set_budget` fija el presupuesto INICIAL (misma semántica que el campo manual) y comunica en
lenguaje simple que ingresos y apartados se suman/restan aparte. Listo para commit.

---
*Reporte generado automáticamente — no editar a mano. Regenerar con `npm run repro:ai-budget`.*
