/**
 * Verificación de B7: "Capital Neto Acumulado" y la etiqueta "Estado del Capital" deben
 * reflejar el sobregiro real, no el bruto que entró este mes.
 *
 * Es un bug de DISPLAY (qué variable se muestra), así que este repro lee el DOM renderizado
 * (no localStorage). Corre dos escenarios en contextos aislados:
 *
 *   A) sin apartados — Tarjeta en sobregiro real:
 *      efectivo inicial $500, tarjeta inicial $1000, ingreso transferencia +$700 (tarjeta),
 *      gasto tarjeta $1900 (comprado)
 *      → remainingCash 500, remainingCard −200, apartados 0
 *      → netWorth = 500 + (−200) + 0 = 300 ; bruto buggy = 500+1000+700 = 2200
 *
 *   B) igual, pero con un apartado activo de $100 en EFECTIVO antes de medir:
 *      → cashBudget = 500 − 100 = 400 ⇒ remainingCash 400, remainingCard −200, apartados 100
 *      → netWorth = 400 + (−200) + 100 = 300 (el apartado NO se pierde ni se cuenta doble)
 *      → desglose: Libre = 400 + (−200) = 200 ; Apartado = 100 (suman el neto 300)
 *
 * Uso:  npm run repro:b7   (o: node scripts/repro-b7-networth.mjs)
 */
import { chromium } from '@playwright/test';
import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const PORT = 3103;
const BASE_URL = `http://127.0.0.1:${PORT}/`;
const OUTPUT_MD = path.join(ROOT, 'REPRO_B7_REPORTE.md');

function startDevServer() {
  const viteBin = path.join(ROOT, 'node_modules', 'vite', 'bin', 'vite.js');
  return spawn(process.execPath, [viteBin, '--port', String(PORT), '--host', '127.0.0.1'], {
    cwd: ROOT, env: { ...process.env, DISABLE_HMR: 'true' }, stdio: 'pipe'
  });
}

async function waitForServer(url, timeoutMs = 30000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try { const res = await fetch(url); if (res.ok) return true; } catch { /* not up */ }
    await sleep(300);
  }
  throw new Error(`El servidor de dev no respondió en ${url} tras ${timeoutMs}ms`);
}

function currentMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

// Base común: tarjeta en sobregiro real. `apartadosCashEfectivo` agrega un apartado en efectivo.
function buildSeed({ apartadoEfectivo = 0 } = {}) {
  const cm = currentMonth();
  const iso = `${cm}-05T10:00:00`;
  const apartados = apartadoEfectivo > 0
    ? [{ id: 'ap-1', name: 'Ahorro', amount: apartadoEfectivo, paymentMethod: 'efectivo', createdAt: iso }]
    : [];
  return {
    cobuy_archived_items: '[]',
    cobuy_service_payments: '[]',
    cobuy_history_months: '[]',
    cobuy_current_month: cm,
    cobuy_initial_cash_snapshot: '500',
    cobuy_initial_card_snapshot: '1000',
    cobuy_incomes: JSON.stringify([
      { id: 'inc-1', name: 'Transferencia sueldo', amount: 700, paymentMethod: 'transferencia', createdAt: iso }
    ]),
    cobuy_apartados: JSON.stringify(apartados),
    cobuy_shopping_items: JSON.stringify([
      { id: 'it-1', name: 'Gastos tarjeta del mes', place: 'Varios', price: 1900, quantity: 1,
        category: 'otros', bought: true, paymentMethod: 'tarjeta', createdAt: iso }
    ])
  };
}

function parseMoney(text) {
  const m = (text || '').replace(/[^0-9.,-]/g, '');
  return parseFloat(m.replace(/\./g, '').replace(',', '.'));
}

const checks = [];
function assert(label, pass, detail) {
  checks.push({ label, pass, detail });
  console.log(`${pass ? 'PASS' : 'FAIL'} — ${label}${detail ? ` (${detail})` : ''}`);
}

async function measure(browser, seed) {
  const context = await browser.newContext({ baseURL: BASE_URL });
  await context.addInitScript((s) => {
    for (const [k, v] of Object.entries(s)) localStorage.setItem(k, v);
  }, seed);
  const page = await context.newPage();
  await page.goto(BASE_URL);
  await page.waitForSelector('#budget-card-container');
  await sleep(400);

  const netText = (await page.getByText('Capital Neto Acumulado').locator('xpath=following::h2[1]').innerText()).trim();
  const headerText = (await page.getByText('Capital Neto Acumulado')
    .locator('xpath=ancestor::div[contains(@class,"space-y-2.5")][1]').innerText()).replace(/\s+/g, ' ').trim();
  const estadoText = (await page.getByText('Estado del Capital').locator('xpath=..').innerText()).replace(/\s+/g, ' ').trim();
  const bannerVisible = (await page.getByText(/CAPITAL SOBREGIRADO/i).count()) > 0;

  await context.close();
  return { netText, netVal: parseMoney(netText), headerText, estadoText, bannerVisible };
}

async function main() {
  console.log('Iniciando servidor de desarrollo aislado en', BASE_URL);
  const devServer = startDevServer();
  let browser;
  const obs = {};
  try {
    await waitForServer(BASE_URL);
    browser = await chromium.launch({ headless: true });

    // === Escenario A: sin apartados ===
    console.log('\n[Escenario A] Tarjeta en sobregiro, sin apartados...');
    const a = await measure(browser, buildSeed());
    obs.a = a;
    assert('A — Capital Neto Acumulado = $300 neto (no el bruto buggy $2200)',
      Math.abs(a.netVal - 300) < 0.01, `mostrado "${a.netText}" → ${a.netVal}`);
    assert('A — no muestra el bruto buggy $2200', Math.abs(a.netVal - 2200) >= 0.01, `valor=${a.netVal}`);
    assert('A — Estado del Capital NO dice "Sano"', !/sano/i.test(a.estadoText), `"${a.estadoText}"`);
    assert('A — Estado del Capital indica sobregiro', /sobregir/i.test(a.estadoText), `"${a.estadoText}"`);
    assert('A — banner rojo presente (control)', a.bannerVisible, `visible=${a.bannerVisible}`);

    // === Escenario B: con apartado $100 en efectivo ===
    console.log('\n[Escenario B] Igual + apartado $100 en efectivo...');
    const b = await measure(browser, buildSeed({ apartadoEfectivo: 100 }));
    obs.b = b;
    // remainingCash 400, remainingCard −200, apartados 100 → netWorth 300
    const expectedB = 400 + (-200) + 100;
    assert('B — Capital Neto Acumulado = remainingCash($400) + remainingCard(−$200) + apartado($100) = $300',
      Math.abs(b.netVal - expectedB) < 0.01,
      `mostrado "${b.netText}" → ${b.netVal}; si el apartado se perdiera daría $200, si se contara doble $400`);
    assert('B — el apartado NO se perdió (netWorth ≠ $200)', Math.abs(b.netVal - 200) >= 0.01, `valor=${b.netVal}`);
    assert('B — el apartado NO se contó doble (netWorth ≠ $400)', Math.abs(b.netVal - 400) >= 0.01, `valor=${b.netVal}`);
    assert('B — desglose muestra "Libre: $200" (remainingCash+remainingCard)',
      /libre:\s*\$?200/i.test(b.headerText), `header: "${b.headerText}"`);
    assert('B — desglose muestra "Apartado: $100"',
      /apartado:\s*\$?100/i.test(b.headerText), `header: "${b.headerText}"`);
    assert('B — Estado del Capital indica sobregiro (no "Sano")',
      /sobregir/i.test(b.estadoText) && !/sano/i.test(b.estadoText), `"${b.estadoText}"`);
  } finally {
    if (browser) await browser.close();
    devServer.kill();
    await sleep(300);
  }

  const allPass = checks.every((c) => c.pass);
  writeReport(allPass, obs);
  console.log(`\n${allPass ? '✅ TODAS las aserciones pasaron' : '❌ HAY ASERCIONES FALLIDAS'} — reporte en ${OUTPUT_MD}`);
  if (!allPass) process.exitCode = 1;
}

function writeReport(allPass, o) {
  const row = (c) => `| ${c.pass ? '✅' : '❌'} | ${c.label} | ${c.detail || ''} |`;
  const a = o.a || {}; const b = o.b || {};
  const report = `# Reproducción — Capital Neto Acumulado y Estado del Capital (B7)

> Estado detectado: **${allPass ? '✅ B7 CORREGIDO' : '❌ B7 PRESENTE'}**
>
> Generado por \`scripts/repro-b7-networth.mjs\` (\`npm run repro:b7\`). Bug de display: se lee el
> DOM renderizado (no localStorage). Dos escenarios con Tarjeta en sobregiro real.
>
> Fecha de ejecución: ${new Date().toISOString()}

## Escenario A — sin apartados

Efectivo inicial $500 · Tarjeta inicial $1000 · ingreso transferencia +$700 · gasto tarjeta $1900.
→ remainingCash $500 · remainingCard −$200 · apartados $0 · **neto = $300** (bruto buggy $2200).

- "Capital Neto Acumulado": **${a.netText ?? 'N/D'}** (${a.netVal ?? 'N/D'})
- "Estado del Capital": **${a.estadoText ?? 'N/D'}**
- Banner sobregiro visible: **${a.bannerVisible ? 'sí' : 'no'}**

## Escenario B — con apartado de $100 en efectivo

Igual que A, pero con un apartado activo de $100 en efectivo antes de medir.
→ remainingCash $400 · remainingCard −$200 · apartados $100 · **neto = $300**
(el apartado solo mueve $100 de "libre" a "reservado"; el patrimonio neto no cambia).

- "Capital Neto Acumulado": **${b.netText ?? 'N/D'}** (${b.netVal ?? 'N/D'})
- Encabezado (desglose): **${b.headerText ?? 'N/D'}**
- "Estado del Capital": **${b.estadoText ?? 'N/D'}**

## Aserciones

| | Verificación | Detalle |
|---|---|---|
${checks.map(row).join('\n')}

## Conclusión

${allPass
  ? `**✅ B7 corregido y robusto ante apartados.** "Capital Neto Acumulado" muestra el patrimonio
NETO real ($300) en ambos escenarios: sin apartados (efectivo $500 − deuda tarjeta $200) y con
un apartado de $100 (libre $200 + reservado $100). El apartado **no se pierde ni se cuenta doble**.
La etiqueta "Estado del Capital" refleja el sobregiro (no dice "Sano"), consistente con el banner.
No se tocó realTotalBudget/percentCommitted (B3 intacto).`
  : `**❌ B7 presente.** Revisar \`BudgetCard.tsx\`: el número grande debe usar
\`netWorth = remainingCash + remainingCard + totalApartados\`; la etiqueta debe usar
\`isRealOverspend\`.`}

---
*Reporte generado automáticamente — regenerar con \`npm run repro:b7\`.*
`;
  fs.writeFileSync(OUTPUT_MD, report, 'utf-8');
}

main().catch((err) => { console.error('Fallo la reproducción B7:', err); process.exitCode = 1; });
