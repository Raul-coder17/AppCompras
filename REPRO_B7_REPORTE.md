# Reproducción — Capital Neto Acumulado y Estado del Capital (B7)

> Estado detectado: **✅ B7 CORREGIDO**
>
> Generado por `scripts/repro-b7-networth.mjs` (`npm run repro:b7`). Bug de display: se lee el
> DOM renderizado (no localStorage). Dos escenarios con Tarjeta en sobregiro real.
>
> Fecha de ejecución: 2026-07-01T22:37:10.509Z

## Escenario A — sin apartados

Efectivo inicial $500 · Tarjeta inicial $1000 · ingreso transferencia +$700 · gasto tarjeta $1900.
→ remainingCash $500 · remainingCard −$200 · apartados $0 · **neto = $300** (bruto buggy $2200).

- "Capital Neto Acumulado": **$300,00** (300)
- "Estado del Capital": **ESTADO DEL CAPITAL 🚨 CAPITAL SOBREGIRADO**
- Banner sobregiro visible: **sí**

## Escenario B — con apartado de $100 en efectivo

Igual que A, pero con un apartado activo de $100 en efectivo antes de medir.
→ remainingCash $400 · remainingCard −$200 · apartados $100 · **neto = $300**
(el apartado solo mueve $100 de "libre" a "reservado"; el patrimonio neto no cambia).

- "Capital Neto Acumulado": **$300,00** (300)
- Encabezado (desglose): **CAPITAL NETO ACUMULADO $300,00 (MXN) Suma total de tu patrimonio en curso, combinando tu capital disponible y los ahorros protegidos en tus apartados. Libre: $200,00 | 🔒 Apartado: $100,00**
- "Estado del Capital": **ESTADO DEL CAPITAL 🚨 CAPITAL SOBREGIRADO**

## Aserciones

| | Verificación | Detalle |
|---|---|---|
| ✅ | A — Capital Neto Acumulado = $300 neto (no el bruto buggy $2200) | mostrado "$300,00" → 300 |
| ✅ | A — no muestra el bruto buggy $2200 | valor=300 |
| ✅ | A — Estado del Capital NO dice "Sano" | "ESTADO DEL CAPITAL 🚨 CAPITAL SOBREGIRADO" |
| ✅ | A — Estado del Capital indica sobregiro | "ESTADO DEL CAPITAL 🚨 CAPITAL SOBREGIRADO" |
| ✅ | A — banner rojo presente (control) | visible=true |
| ✅ | B — Capital Neto Acumulado = remainingCash($400) + remainingCard(−$200) + apartado($100) = $300 | mostrado "$300,00" → 300; si el apartado se perdiera daría $200, si se contara doble $400 |
| ✅ | B — el apartado NO se perdió (netWorth ≠ $200) | valor=300 |
| ✅ | B — el apartado NO se contó doble (netWorth ≠ $400) | valor=300 |
| ✅ | B — desglose muestra "Libre: $200" (remainingCash+remainingCard) | header: "CAPITAL NETO ACUMULADO $300,00 (MXN) Suma total de tu patrimonio en curso, combinando tu capital disponible y los ahorros protegidos en tus apartados. Libre: $200,00 | 🔒 Apartado: $100,00" |
| ✅ | B — desglose muestra "Apartado: $100" | header: "CAPITAL NETO ACUMULADO $300,00 (MXN) Suma total de tu patrimonio en curso, combinando tu capital disponible y los ahorros protegidos en tus apartados. Libre: $200,00 | 🔒 Apartado: $100,00" |
| ✅ | B — Estado del Capital indica sobregiro (no "Sano") | "ESTADO DEL CAPITAL 🚨 CAPITAL SOBREGIRADO" |

## Conclusión

**✅ B7 corregido y robusto ante apartados.** "Capital Neto Acumulado" muestra el patrimonio
NETO real ($300) en ambos escenarios: sin apartados (efectivo $500 − deuda tarjeta $200) y con
un apartado de $100 (libre $200 + reservado $100). El apartado **no se pierde ni se cuenta doble**.
La etiqueta "Estado del Capital" refleja el sobregiro (no dice "Sano"), consistente con el banner.
No se tocó realTotalBudget/percentCommitted (B3 intacto).

---
*Reporte generado automáticamente — regenerar con `npm run repro:b7`.*
