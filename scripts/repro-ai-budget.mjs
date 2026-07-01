/**
 * Prueba de los tools de presupuesto de la IA (function-calling), fix B6.
 *
 * El bug (pre-fix): `add_budget_funds` sumaba el monto sobre el pool DERIVADO
 * (cashBudget = snapshot + ingresos − apartados) y lo escribía en el snapshot vía
 * onUpdateBudget, duplicando ingresos/apartados. Con ingresos/apartados presentes, el
 * pool subía por (amount + ingresos − apartados) en vez de por amount.
 *
 * El fix: `add_budget_funds` suma sobre el SNAPSHOT inicial (initialCashBudget/
 * initialCardBudget), de modo que el pool sube por EXACTAMENTE amount.
 *
 * Este script ejercita el executor REAL (no simula el edit manual, que usa otro camino):
 * la app expone `window.__spendwiseAI.{budgetFunds,setBudget}` SOLO cuando
 * window.__SPENDWISE_E2E__ está seteado (inerte en prod). Se siembra estado con ingresos
 * y apartados ya presentes — exactamente el caso que rompía antes del fix.
 *
 * Uso:  npm run repro:ai-budget   (o: node scripts/repro-ai-budget.mjs)
 * Salida: REPRO_AI_BUDGET_REPORTE.md. Exit code != 0 si alguna aserción falla.
 */
import { chromium } from '@playwright/test';
import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const PORT = 3102;
const BASE_URL = `http://127.0.0.1:${PORT}/`;
const OUTPUT_MD = path.join(ROOT, 'REPRO_AI_BUDGET_REPORTE.md');

const money = (n) => Math.round((n + Number.EPSILON) * 100) / 100;
const fmt = (n) => `$${money(n).toFixed(2)}`;
const approxEq = (a, b) => Math.abs(a - b) < 0.01;

function startDevServer() {
  const viteBin = path.join(ROOT, 'node_modules', 'vite', 'bin', 'vite.js');
  const proc = spawn(process.execPath, [viteBin, '--port', String(PORT), '--host', '127.0.0.1'], {
    cwd: ROOT, env: { ...process.env, DISABLE_HMR: 'true' }, stdio: 'pipe'
  });
  let out = '';
  proc.stdout.on('data', (d) => { out += d.toString(); });
  proc.stderr.on('data', (d) => { out += d.toString(); });
  proc.getLog = () => out;
  return proc;
}

async function waitForServer(url, timeoutMs = 30000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try { const res = await fetch(url); if (res.ok) return true; } catch { /* not up */ }
    await sleep(300);
  }
  throw new Error(`El servidor de dev no respondió en ${url} tras ${timeoutMs}ms`);
}

// Estado sembrado (formato ya migrado: snapshots presentes) con ingresos y apartados:
//   cash: snapshot 500 + ingreso efectivo 400 − apartado efectivo 50 => pool 850
//   card: snapshot 800 + transferencia 200                          => pool 1000
function buildSeed() {
  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const iso = `${currentMonth}-05T10:00:00`;
  return {
    cobuy_shopping_items: '[]',
    cobuy_archived_items: '[]',
    cobuy_service_payments: '[]',
    cobuy_history_months: '[]',
    cobuy_current_month: currentMonth,
    cobuy_initial_cash_snapshot: '500',
    cobuy_initial_card_snapshot: '800',
    cobuy_incomes: JSON.stringify([
      { id: 'inc-1', name: 'Sueldo', amount: 400, paymentMethod: 'efectivo', createdAt: iso },
      { id: 'inc-2', name: 'Transferencia', amount: 200, paymentMethod: 'transferencia', createdAt: iso }
    ]),
    cobuy_apartados: JSON.stringify([
      { id: 'ap-1', name: 'Ahorro', amount: 50, paymentMethod: 'efectivo', createdAt: iso }
    ])
  };
}

async function readState(page) {
  const raw = await page.evaluate(() => {
    const out = {};
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith('cobuy_')) out[k] = localStorage.getItem(k);
    }
    return out;
  });
  const num = (k) => parseFloat(raw[k] ?? 'NaN');
  const arr = (k) => { try { return JSON.parse(raw[k] ?? '[]'); } catch { return []; } };
  const incomes = arr('cobuy_incomes');
  const apartados = arr('cobuy_apartados');
  const incCash = money(incomes.filter(i => i.paymentMethod === 'efectivo').reduce((a, c) => a + c.amount, 0));
  const incCard = money(incomes.filter(i => i.paymentMethod !== 'efectivo').reduce((a, c) => a + c.amount, 0));
  const apCash = money(apartados.filter(a => a.paymentMethod === 'efectivo').reduce((a, c) => a + c.amount, 0));
  const apCard = money(apartados.filter(a => a.paymentMethod === 'tarjeta').reduce((a, c) => a + c.amount, 0));
  const snapCash = num('cobuy_initial_cash_snapshot');
  const snapCard = num('cobuy_initial_card_snapshot');
  return {
    snapshotCash: snapCash,
    snapshotCard: snapCard,
    cashBudget: money(snapCash + incCash - apCash),
    cardBudget: money(snapCard + incCard - apCard)
  };
}

// Espera a que el snapshot efectivo alcance un valor esperado (persistencia del effect).
async function waitForSnapshotCash(page, expected, timeoutMs = 6000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const v = await page.evaluate(() => localStorage.getItem('cobuy_initial_cash_snapshot'));
    if (v !== null && approxEq(parseFloat(v), expected)) return;
    await sleep(80);
  }
}
async function waitForSnapshotCard(page, expected, timeoutMs = 6000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const v = await page.evaluate(() => localStorage.getItem('cobuy_initial_card_snapshot'));
    if (v !== null && approxEq(parseFloat(v), expected)) return;
    await sleep(80);
  }
}

const checks = [];
function assert(label, pass, detail) {
  checks.push({ label, pass, detail });
  console.log(`${pass ? 'PASS' : 'FAIL'} — ${label}${detail ? ` (${detail})` : ''}`);
}

async function main() {
  console.log('Iniciando servidor de desarrollo aislado en', BASE_URL);
  const devServer = startDevServer();
  let browser;
  const snap = {};
  try {
    await waitForServer(BASE_URL);
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({ baseURL: BASE_URL });

    // Sembrar estado antes de que cargue la app. El hook e2e (window.__spendwiseAI) lo instala
    // la app cuando import.meta.env.DEV es true — y este repro corre contra el dev server, así
    // que no hace falta ningún flag de runtime.
    await context.addInitScript((seed) => {
      for (const [k, v] of Object.entries(seed)) localStorage.setItem(k, v);
    }, buildSeed());

    const page = await context.newPage();
    await page.goto(BASE_URL);
    await page.waitForSelector('#app-root-layout');
    // Esperar a que el hook e2e esté disponible.
    await page.waitForFunction(() => !!(window.__spendwiseAI && window.__spendwiseAI.budgetFunds), { timeout: 8000 });

    const before = await readState(page);
    snap.before = before;
    assert('Setup — pool efectivo inicial = 850 (snapshot 500 + ingreso 400 − apartado 50)',
      approxEq(before.cashBudget, 850), `${fmt(before.cashBudget)}`);
    assert('Setup — pool tarjeta inicial = 1000 (snapshot 800 + transferencia 200)',
      approxEq(before.cardBudget, 1000), `${fmt(before.cardBudget)}`);

    // === add_budget_funds EFECTIVO +100 (con ingresos y apartados presentes) ===
    console.log('\n[add_budget_funds] efectivo +$100 vía executor real de la IA...');
    const msgCash = await page.evaluate(() => window.__spendwiseAI.budgetFunds('cash', 100));
    await waitForSnapshotCash(page, before.snapshotCash + 100);
    const afterCash = await readState(page);
    snap.afterCash = afterCash;
    assert(
      'add_budget_funds — el pool efectivo sube por EXACTAMENTE $100 (no doble cuenta ingresos/apartados)',
      approxEq(afterCash.cashBudget, before.cashBudget + 100),
      `${fmt(afterCash.cashBudget)} (esperado ${fmt(before.cashBudget + 100)}; el bug daba ${fmt(before.cashBudget + 100 + 400 - 50)})`
    );
    assert(
      'add_budget_funds — sumó sobre el snapshot (500 → 600), no sobre el pool derivado',
      approxEq(afterCash.snapshotCash, 600),
      `snapshot ${fmt(afterCash.snapshotCash)}`
    );
    assert(
      'add_budget_funds — mensaje de confirmación correcto',
      typeof msgCash === 'string' && msgCash.includes('100'),
      JSON.stringify(msgCash)
    );

    // === add_budget_funds TARJETA +250 ===
    console.log('\n[add_budget_funds] tarjeta +$250 vía executor real de la IA...');
    await page.evaluate(() => window.__spendwiseAI.budgetFunds('card', 250));
    await waitForSnapshotCard(page, before.snapshotCard + 250);
    const afterCard = await readState(page);
    snap.afterCard = afterCard;
    assert(
      'add_budget_funds — el pool tarjeta sube por EXACTAMENTE $250',
      approxEq(afterCard.cardBudget, before.cardBudget + 250),
      `${fmt(afterCard.cardBudget)} (esperado ${fmt(before.cardBudget + 250)})`
    );

    // === set_budget EFECTIVO = 1000 (semántica snapshot, no total en vivo) ===
    console.log('\n[set_budget] efectivo = $1000 (fija el inicial, no el total)...');
    const msgSet = await page.evaluate(() => window.__spendwiseAI.setBudget('cash', 1000));
    await waitForSnapshotCash(page, 1000);
    const afterSet = await readState(page);
    snap.afterSet = afterSet;
    assert(
      'set_budget — fija el snapshot INICIAL en $1000 (no el total en vivo)',
      approxEq(afterSet.snapshotCash, 1000),
      `snapshot ${fmt(afterSet.snapshotCash)}`
    );
    assert(
      'set_budget — el disponible se recalcula (1000 + 400 − 50 = 1350), NO queda clavado en 1000',
      approxEq(afterSet.cashBudget, 1350),
      `${fmt(afterSet.cashBudget)}`
    );
    assert(
      'set_budget — el mensaje aclara que es el presupuesto INICIAL (copy para no técnicos)',
      typeof msgSet === 'string' && /INICIAL/i.test(msgSet) && /apartados/i.test(msgSet),
      JSON.stringify(msgSet)
    );

    await context.close();
  } finally {
    if (browser) await browser.close();
    devServer.kill();
    await sleep(300);
  }

  const allPass = checks.every((c) => c.pass);
  writeReport(allPass, snap);
  console.log(`\n${allPass ? '✅ TODAS las aserciones pasaron' : '❌ HAY ASERCIONES FALLIDAS'} — reporte en ${OUTPUT_MD}`);
  if (!allPass) process.exitCode = 1;
}

function writeReport(allPass, snap) {
  const row = (c) => `| ${c.pass ? '✅' : '❌'} | ${c.label} | ${c.detail || ''} |`;
  const b = snap.before || {};
  const ac = snap.afterCash || {};
  const acard = snap.afterCard || {};
  const as = snap.afterSet || {};
  const report = `# Reproducción — Tools de presupuesto de la IA (B6)

> Estado detectado: **${allPass ? '✅ TOOLS DE IA CORRECTOS' : '❌ FALLA EN TOOLS DE IA'}**
>
> Generado por \`scripts/repro-ai-budget.mjs\` (\`npm run repro:ai-budget\`). Ejercita los
> executores REALES de los tools \`add_budget_funds\` y \`set_budget\` (vía el hook e2e
> \`window.__spendwiseAI\`, inerte en producción), con ingresos y apartados ya presentes —
> exactamente el caso que rompía antes del fix. El pool se lee derivado del snapshot.
>
> Fecha de ejecución: ${new Date().toISOString()}

## Estado sembrado

- Efectivo: snapshot $500 + ingreso $400 − apartado $50 = pool **$850**
- Tarjeta: snapshot $800 + transferencia $200 = pool **$1000**

## Valores observados

| Momento | pool efectivo | snapshot efectivo | pool tarjeta | snapshot tarjeta |
|---|---|---|---|---|
| Inicial | ${fmt(b.cashBudget)} | ${fmt(b.snapshotCash)} | ${fmt(b.cardBudget)} | ${fmt(b.snapshotCard)} |
| Tras add_budget_funds efectivo +$100 | ${fmt(ac.cashBudget)} | ${fmt(ac.snapshotCash)} | ${fmt(ac.cardBudget)} | ${fmt(ac.snapshotCard)} |
| Tras add_budget_funds tarjeta +$250 | ${fmt(acard.cashBudget)} | ${fmt(acard.snapshotCash)} | ${fmt(acard.cardBudget)} | ${fmt(acard.snapshotCard)} |
| Tras set_budget efectivo = $1000 | ${fmt(as.cashBudget)} | ${fmt(as.snapshotCash)} | ${fmt(as.cardBudget)} | ${fmt(as.snapshotCard)} |

## Aserciones

| | Verificación | Detalle |
|---|---|---|
${checks.map(row).join('\n')}

## Conclusión

${allPass
  ? `**✅ Los tools de presupuesto de la IA son correctos.** \`add_budget_funds\` suma sobre el
snapshot inicial, así que el pool disponible sube por **exactamente** el monto pedido, sin
doble contar ingresos ni apartados (con el bug previo, +$100 habría subido el pool en +$450).
\`set_budget\` fija el presupuesto INICIAL (misma semántica que el campo manual) y comunica en
lenguaje simple que ingresos y apartados se suman/restan aparte. Listo para commit.`
  : `**❌ Falló al menos una aserción** (ver tabla). Revisar \`executeBudgetFunds\`/\`executeSetBudget\`
en \`AIAssistant.tsx\` (deben usar initialCashBudget/initialCardBudget como base).`}

---
*Reporte generado automáticamente — no editar a mano. Regenerar con \`npm run repro:ai-budget\`.*
`;
  fs.writeFileSync(OUTPUT_MD, report, 'utf-8');
}

main().catch((err) => {
  console.error('Fallo la reproducción de tools de IA:', err);
  process.exitCode = 1;
});
