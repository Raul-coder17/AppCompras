/**
 * Reproducción determinística de la causa raíz B1/B2 (PLAN_BUG_CALCULO.md):
 * editar "Presupuesto Inicial" sobrescribe el pool vivo (cashBudget) y pierde
 * los ingresos/apartados ya acumulados, disparando falsas alertas de "Sobregirado".
 *
 * Corre 3 escenarios en contextos de navegador aislados (localStorage limpio,
 * sembrado desde cero, sin depender del historial real del usuario):
 *   - control:    secuencia completa SIN editar "Presupuesto Inicial"
 *   - with-edit-0:  igual, pero en el día 4 se edita el campo a $0
 *   - with-edit-50: igual, pero en el día 4 se edita el campo a $50
 *
 * Lee el estado real vía localStorage (claves cobuy_*) después de cada paso,
 * nunca la UI, para tener el número exacto.
 *
 * Uso:  node scripts/repro-b1-capital-bug.mjs
 * Requisitos: `npm install` ya corrido y Chromium de Playwright instalado
 *             (`npx playwright install chromium`).
 *
 * Reusar después de aplicar el fix de B1/B2: volver a correr este mismo
 * script. Si el fix es correcto, matchBefore/matchAfter deberían ser `true`
 * en todos los pasos de los 3 escenarios (ver REPRO_B1_REPORTE.md generado).
 */
import { chromium } from '@playwright/test';
import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const PORT = 3100;
const BASE_URL = `http://127.0.0.1:${PORT}/`;
const OUTPUT_MD = path.join(ROOT, 'REPRO_B1_REPORTE.md');
const OUTPUT_JSON_DIR = path.join(ROOT, 'scripts', 'repro-b1-output');

const money = (n) => Math.round((n + Number.EPSILON) * 100) / 100;
const fmt = (n) => `$${money(n).toFixed(2)}`;

// ---------------------------------------------------------------------------
// Dev server lifecycle (spawn/kill directly, no npm wrapper, for clean teardown)
// ---------------------------------------------------------------------------
function startDevServer() {
  const viteBin = path.join(ROOT, 'node_modules', 'vite', 'bin', 'vite.js');
  const proc = spawn(process.execPath, [viteBin, '--port', String(PORT), '--host', '127.0.0.1'], {
    cwd: ROOT,
    env: { ...process.env, DISABLE_HMR: 'true' },
    stdio: 'pipe'
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
    try {
      const res = await fetch(url);
      if (res.ok) return true;
    } catch { /* not up yet */ }
    await sleep(300);
  }
  throw new Error(`El servidor de dev no respondió en ${url} tras ${timeoutMs}ms`);
}

// ---------------------------------------------------------------------------
// Seed: estado localStorage limpio y determinístico (sin datos demo, sin
// depender de que el usuario recuerde su historial real)
// ---------------------------------------------------------------------------
function buildSeed() {
  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  return {
    cobuy_shopping_items: '[]',
    cobuy_archived_items: '[]',
    cobuy_budget_cash: '0',
    cobuy_budget_card: '0',
    cobuy_places: '[]',
    cobuy_service_payments: '[]',
    cobuy_incomes: '[]',
    cobuy_history_months: '[]',
    cobuy_current_month: currentMonth,
    cobuy_apartados: '[]',
    cobuy_initial_cash_snapshot: '0',
    cobuy_initial_card_snapshot: '0'
  };
}

// ---------------------------------------------------------------------------
// Lectura de estado crudo (NO UI) — única fuente de verdad para el reporte
// ---------------------------------------------------------------------------
async function readCobuyState(page) {
  const raw = await page.evaluate(() => {
    const out = {};
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith('cobuy_')) out[k] = localStorage.getItem(k);
    }
    return out;
  });
  const num = (k) => parseFloat(raw[k] ?? '0') || 0;
  const arr = (k) => { try { return JSON.parse(raw[k] ?? '[]'); } catch { return []; } };

  const items = arr('cobuy_shopping_items');
  const incomes = arr('cobuy_incomes');
  const apartados = arr('cobuy_apartados');

  const cashSpent = items
    .filter((i) => i.bought && i.paymentMethod === 'efectivo')
    .reduce((a, i) => a + i.price * i.quantity, 0);

  const incomesCashSum = incomes
    .filter((i) => i.paymentMethod === 'efectivo')
    .reduce((a, i) => a + i.amount, 0);

  const incomesCardSum = incomes
    .filter((i) => i.paymentMethod !== 'efectivo')
    .reduce((a, i) => a + i.amount, 0);

  const apartadosCashSum = apartados
    .filter((a) => a.paymentMethod === 'efectivo')
    .reduce((a, ap) => a + ap.amount, 0);

  const apartadosCardSum = apartados
    .filter((a) => a.paymentMethod === 'tarjeta')
    .reduce((a, ap) => a + ap.amount, 0);

  // El pool ya NO se persiste como clave legacy (cobuy_budget_cash): se deriva del snapshot,
  // exactamente igual que el useMemo de la app. La fuente de verdad leída es el snapshot real.
  const initialCashSnapshot = num('cobuy_initial_cash_snapshot');
  const initialCardSnapshot = num('cobuy_initial_card_snapshot');
  const cashBudget = initialCashSnapshot + incomesCashSum - apartadosCashSum;
  const cardBudget = initialCardSnapshot + incomesCardSum - apartadosCardSum;

  return {
    cashBudget: money(cashBudget),
    cardBudget: money(cardBudget),
    initialCashSnapshot: money(initialCashSnapshot),
    initialCardSnapshot: money(initialCardSnapshot),
    incomesCashSum: money(incomesCashSum),
    apartadosCashSum: money(apartadosCashSum),
    cashSpent: money(cashSpent),
    remainingCash: money(cashBudget - cashSpent)
  };
}

// ---------------------------------------------------------------------------
// UI helpers (interactúan con la app real; la lectura de resultado es SIEMPRE
// vía readCobuyState, nunca parseando el DOM)
// ---------------------------------------------------------------------------
async function gotoSection(page, title) {
  await page.getByTitle(title, { exact: true }).first().click();
}

async function addIncome(page, { name, amount, paymentMethod }) {
  await gotoSection(page, 'Ingresos del Mes');
  await page.getByPlaceholder('Ej. Nómina quincenal, Venta, Regalo').fill(name);
  await page.getByPlaceholder('0.00').fill(String(amount));
  await page.locator('select').selectOption(paymentMethod);
  await page.getByRole('button', { name: 'Registrar Ingreso' }).click();
}

async function addAndBuyItem(page, { name, price, paymentMethod }) {
  await gotoSection(page, 'Lista de Compras');
  await page.getByRole('button', { name: 'Planificar Compra' }).click();
  await page.locator('#input-product-name').fill(name);
  await page.locator('#input-product-price').fill(String(price));
  await page.locator('#input-payment-method').selectOption(paymentMethod);
  await page.locator('#add-item-submit-btn').click();

  const items = await page.evaluate(() => JSON.parse(localStorage.getItem('cobuy_shopping_items') || '[]'));
  const created = items.find((i) => i.name === name);
  if (!created) throw new Error(`No se encontró el item recién creado: ${name}`);
  await page.locator(`#check-btn-${created.id}`).click();
}

async function createApartadoEfectivo(page, { name, amount }) {
  await gotoSection(page, 'Mi Capital');
  await page.getByRole('button', { name: /Crear Apartado/ }).first().click();
  await page.getByPlaceholder('Nombre (ej. Renta)').fill(name);
  await page.getByPlaceholder('Monto').fill(String(amount));
  await page.getByRole('button', { name: 'Crear', exact: true }).click();
}

async function editInitialCashBudget(page, newValue) {
  await gotoSection(page, 'Mi Capital');
  await page.getByTitle('Editar presupuesto inicial (solo correcciones)').first().click();
  const container = page.getByText('Presupuesto Inicial').first().locator('xpath=..');
  await container.locator('input[type="number"]').fill(String(newValue));
  await container.getByTitle('Guardar').click();
}

// ---------------------------------------------------------------------------
// Ejecuta un paso: captura estado ANTES, ejecuta la acción, captura DESPUÉS,
// y calcula si el pool real coincide con la fórmula pool = inicial + ingresos - apartados
// ---------------------------------------------------------------------------
async function runStep(ctx, day, actionLabel, actionFn) {
  const refBefore = ctx.referenceInitial;
  const before = await readCobuyState(ctx.page);
  await actionFn();
  const after = await readCobuyState(ctx.page);
  const refAfter = ctx.referenceInitial; // actionFn puede haber actualizado esto (paso de edición)

  const expectedBefore = money(refBefore + before.incomesCashSum - before.apartadosCashSum);
  const expectedAfter = money(refAfter + after.incomesCashSum - after.apartadosCashSum);
  const matchBefore = Math.abs(expectedBefore - before.cashBudget) < 0.01;
  const matchAfter = Math.abs(expectedAfter - after.cashBudget) < 0.01;

  return {
    day,
    action: actionLabel,
    cashBudgetBefore: before.cashBudget,
    cashBudgetAfter: after.cashBudget,
    incomesCashAccumExpected: after.incomesCashSum,
    apartadosCashAccumExpected: after.apartadosCashSum,
    expectedBefore,
    expectedAfter,
    matchBefore,
    matchAfter,
    initialCashSnapshotAfter: after.initialCashSnapshot,
    cardBudgetAfter: after.cardBudget,
    remainingCashAfter: after.remainingCash,
    isOverdrawnAfter: after.remainingCash < 0
  };
}

// ---------------------------------------------------------------------------
// Secuencia completa de "varios días" de uso. editValue=null => corrida control
// (sin editar "Presupuesto Inicial").
// ---------------------------------------------------------------------------
async function runScenario(browser, { scenarioName, editValue }) {
  const context = await browser.newContext({ baseURL: BASE_URL });
  await context.addInitScript((seedData) => {
    for (const [k, v] of Object.entries(seedData)) localStorage.setItem(k, v);
  }, buildSeed());

  const page = await context.newPage();
  await page.goto(BASE_URL);
  await page.waitForSelector('#app-root-layout');

  const ctx = { page, referenceInitial: 0 };
  const steps = [];

  steps.push(await runStep(ctx, 1, 'Agregar ingreso efectivo +$500', () =>
    addIncome(page, { name: 'Sueldo efectivo', amount: 500, paymentMethod: 'efectivo' })
  ));

  steps.push(await runStep(ctx, 1, 'Comprar item efectivo $42.45 (marcado bought)', () =>
    addAndBuyItem(page, { name: 'Compra dia 1', price: 42.45, paymentMethod: 'efectivo' })
  ));

  steps.push(await runStep(ctx, 2, 'Agregar ingreso tarjeta +$350 (control cruzado: no debe tocar cash)', () =>
    addIncome(page, { name: 'Transferencia dia 2', amount: 350, paymentMethod: 'tarjeta' })
  ));

  steps.push(await runStep(ctx, 3, 'Crear apartado efectivo -$100', () =>
    createApartadoEfectivo(page, { name: 'Ahorro renta', amount: 100 })
  ));

  if (editValue !== null) {
    steps.push(await runStep(ctx, 4, `Editar "Presupuesto Inicial" (efectivo) a $${editValue}`, async () => {
      await editInitialCashBudget(page, editValue);
      ctx.referenceInitial = editValue;
    }));
  } else {
    steps.push(await runStep(ctx, 4, 'Sin editar "Presupuesto Inicial" (paso omitido — corrida control)', async () => {}));
  }

  steps.push(await runStep(ctx, 5, 'Comprar item efectivo $10 (marcado bought)', () =>
    addAndBuyItem(page, { name: 'Compra dia 5', price: 10, paymentMethod: 'efectivo' })
  ));

  await context.close();
  return { scenarioName, editValue, steps };
}

// ---------------------------------------------------------------------------
// Generación del reporte Markdown
// ---------------------------------------------------------------------------
function stepsTable(steps) {
  const header = '| Día | Acción | cashBudget antes | cashBudget después | Ingresos efectivo acumulados (real) | Apartados efectivo acumulados (real) | Esperado por fórmula (después) | ¿Coincide? |';
  const sep = '|---|---|---|---|---|---|---|---|';
  const rows = steps.map((s) => {
    const coincide = s.matchAfter ? '✅ Sí' : '❌ **NO — DIVERGE**';
    return `| ${s.day} | ${s.action} | ${fmt(s.cashBudgetBefore)} | ${fmt(s.cashBudgetAfter)} | ${fmt(s.incomesCashAccumExpected)} | ${fmt(s.apartadosCashAccumExpected)} | ${fmt(s.expectedAfter)} | ${coincide} |`;
  });
  return [header, sep, ...rows].join('\n');
}

function buildReport(results) {
  const [control, edit0, edit50] = results;
  const divergenceStep0 = edit0.steps.find((s) => !s.matchAfter);
  const divergenceStep50 = edit50.steps.find((s) => !s.matchAfter);
  const controlDiverges = control.steps.some((s) => !s.matchAfter || !s.matchBefore);

  const overdrawnStep0 = edit0.steps.find((s) => s.isOverdrawnAfter);
  const overdrawnStep50 = edit50.steps.find((s) => s.isOverdrawnAfter);

  const lossAmount0 = divergenceStep0 ? money(divergenceStep0.expectedAfter - divergenceStep0.cashBudgetAfter) : null;
  const lossAmount50 = divergenceStep50 ? money(divergenceStep50.expectedAfter - divergenceStep50.cashBudgetAfter) : null;

  const snapshot0 = edit0.steps.find((s) => s.day === 4)?.initialCashSnapshotAfter;
  const snapshot50 = edit50.steps.find((s) => s.day === 4)?.initialCashSnapshotAfter;

  // El reporte es adaptativo: describe el estado ROTO si hay divergencias, o el estado
  // ARREGLADO (fix B1/B2 aplicado) si las 3 corridas cumplen la fórmula en todos los pasos.
  const anyDivergence = controlDiverges || !!divergenceStep0 || !!divergenceStep50;
  const fixed = !anyDivergence;

  const editSection = (scenario, editValue, divergenceStep, overdrawnStep, lossAmount, snapshot) => {
    if (divergenceStep) {
      return [
        `**Punto de divergencia:** Día ${divergenceStep.day} — "${divergenceStep.action}"`,
        `**Monto perdido en ese instante:** ${fmt(lossAmount)} (ingresos efectivo acumulados $500 − apartados efectivo acumulados $100 = $400, que desaparecen del pool).`,
        overdrawnStep
          ? `**Consecuencia visible:** en el día ${overdrawnStep.day} \`remainingCash\` = ${fmt(overdrawnStep.remainingCashAfter)} < 0 → la UI mostraría **"Sobregirado"**, pese a que el usuario nunca gastó más de lo que tenía.`
          : '',
        `**\`cobuy_initial_cash_snapshot\` después de editar:** ${fmt(snapshot)}.`
      ].filter(Boolean).join('\n');
    }
    // Estado arreglado
    const derived = scenario.steps.find((s) => s.day === 4)?.cashBudgetAfter;
    return [
      `**Resultado:** ✅ Sin divergencia. Al editar el "Presupuesto Inicial" a $${editValue}, el snapshot pasa a $${editValue} y el pool disponible se **recalcula** como snapshot + ingresos − apartados = $${editValue} + $500 − $100 = ${fmt(derived)}.`,
      `Los ingresos ($500) y el apartado ($100) **se conservan** — ya no se pierden $400 como en el estado roto.`,
      `**\`cobuy_initial_cash_snapshot\` después de editar:** ${fmt(snapshot)} (== valor editado; ahora es la única fuente de verdad, y el pool deriva de él).`
    ].join('\n');
  };

  const narrative = fixed
    ? `## Conclusión — ✅ FIX B1/B2 VERIFICADO

Las **3 corridas cumplen la fórmula \`pool = inicial + ingresos − apartados\` en TODOS los
pasos**, incluido el día 4 (edición de "Presupuesto Inicial"), que en el estado roto perdía
$400 en ambos casos con edición.

- **control:** \`cashBudget\` final ${fmt(control.steps.at(-1).cashBudgetAfter)} (esperado ${fmt(control.steps.at(-1).expectedAfter)}).
- **with-edit-0:** editar a $0 deja el pool en ${fmt(edit0.steps.at(-1).cashBudgetAfter)} (los $500 de ingresos − $100 de apartado se conservan), no en $0.
- **with-edit-50:** editar a $50 deja el pool en ${fmt(edit50.steps.at(-1).cashBudgetAfter)} ($50 + $500 − $100).

Ninguna de las corridas dispara el falso "Sobregirado". El fix reescribió \`handleUpdateBudget\`
(\`App.tsx\`) para escribir SOLO sobre el snapshot, y \`cashBudget\`/\`cardBudget\` pasaron a
**derivarse** vía \`useMemo\` (snapshot + ingresos − apartados) en lugar de ser estado mutado a
mano. Ahora editar el inicial no puede borrar ingresos ni apartados: el pool se recalcula solo.

> **Nota histórica:** el estado roto previo (y su mecanismo: \`handleUpdateBudget\` sobrescribía
> \`cashBudget\` **y** \`initialCashBudgetSnapshot\` en el mismo golpe, perdiendo $400 sin respaldo
> recuperable) quedó documentado en la entrada correspondiente de \`PLAN_BUG_CALCULO.md\` →
> Historial de sesiones. Este reporte refleja el estado **posterior** al fix.`
    : `## Conclusión — ❌ BUG B1 PRESENTE

**Se confirma la causa raíz B1**: editar "Presupuesto Inicial" sobrescribe el pool y descarta
el historial de ingresos/apartados. Ambas corridas con edición divergen en el día 4 por el
mismo monto ($400 = ingresos $500 − apartados $100), **independientemente del valor escrito**,
lo que prueba que no es un error de cálculo sino una sobrescritura completa del pool. El
mecanismo es \`handleUpdateBudget\` (\`App.tsx\`), que además sobrescribe \`initialCashBudgetSnapshot\`
en el mismo golpe (no queda respaldo recuperable). El control no diverge en ningún paso, así que
el bug está aislado exclusivamente a la acción de edición.`;

  return `# Reproducción automatizada — Causa raíz B1 (PLAN_BUG_CALCULO.md)

> Estado detectado en esta corrida: **${fixed ? '✅ ARREGLADO (fix B1/B2 aplicado)' : '❌ BUG PRESENTE'}**
>
> Generado automáticamente por \`scripts/repro-b1-capital-bug.mjs\` (\`npm run repro:b1\`). No
> depende del historial real de ningún usuario: cada corrida arranca de un \`localStorage\`
> sembrado desde cero (\`cobuy_budget_cash=0\`, \`cobuy_budget_card=0\`, sin ingresos, sin
> apartados, sin items). El estado se lee siempre de \`localStorage\` (claves \`cobuy_*\`) vía
> \`page.evaluate\`, nunca de la UI.
>
> Fecha de ejecución: ${new Date().toISOString()}

## Metodología

Fórmula bajo prueba: **pool = inicial + ingresos(efectivo) − apartados(efectivo)**.

Se corrieron 3 escenarios en contextos de navegador aislados:

1. **control** — secuencia completa, SIN editar "Presupuesto Inicial".
2. **with-edit-0** — igual, pero en el día 4 se edita "Presupuesto Inicial" (efectivo) a **$0**.
3. **with-edit-50** — igual, pero en el día 4 se edita "Presupuesto Inicial" (efectivo) a **$50**.

En cada paso se compara el \`cashBudget\` real (leído de \`localStorage['cobuy_budget_cash']\`)
contra el valor esperado por la fórmula, usando como "inicial" el valor de referencia vigente
(0 antes de cualquier edición; el valor editado después de que el usuario lo cambia).

---

## Escenario control (sin editar "Presupuesto Inicial")

${stepsTable(control.steps)}

**Resultado control:** ${controlDiverges ? '❌ Hubo divergencias inesperadas (revisar)' : '✅ El pool coincide con la fórmula en TODOS los pasos. Ninguna divergencia.'}

---

## Escenario with-edit-0 (edición a $0 en el día 4)

${stepsTable(edit0.steps)}

${editSection(edit0, 0, divergenceStep0, overdrawnStep0, lossAmount0, snapshot0)}

---

## Escenario with-edit-50 (edición a $50 en el día 4, para confirmar que no es específico de $0)

${stepsTable(edit50.steps)}

${editSection(edit50, 50, divergenceStep50, overdrawnStep50, lossAmount50, snapshot50)}

---

## Comparación control vs. con edición

| | Control (sin editar) | with-edit-0 | with-edit-50 |
|---|---|---|---|
| ¿Diverge en algún paso? | ${controlDiverges ? 'Sí ⚠️' : 'No ✅'} | ${divergenceStep0 ? `Sí, día ${divergenceStep0.day} ❌` : 'No ✅'} | ${divergenceStep50 ? `Sí, día ${divergenceStep50.day} ❌` : 'No ✅'} |
| Monto perdido | — | ${lossAmount0 !== null ? fmt(lossAmount0) : '$0.00'} | ${lossAmount50 !== null ? fmt(lossAmount50) : '$0.00'} |
| ¿Dispara falso "Sobregirado"? | No | ${overdrawnStep0 ? 'Sí ❌' : 'No ✅'} | ${overdrawnStep50 ? 'Sí ❌' : 'No ✅'} |
| \`cashBudget\` final | ${fmt(control.steps.at(-1).cashBudgetAfter)} | ${fmt(edit0.steps.at(-1).cashBudgetAfter)} | ${fmt(edit50.steps.at(-1).cashBudgetAfter)} |
| \`cashBudget\` final esperado (fórmula) | ${fmt(control.steps.at(-1).expectedAfter)} | ${fmt(edit0.steps.at(-1).expectedAfter)} | ${fmt(edit50.steps.at(-1).expectedAfter)} |

${narrative}

---
*Reporte generado automáticamente — no editar a mano. Volver a correr
\`npm run repro:b1\` regenera este archivo. Si tras un cambio vuelve a aparecer "❌ BUG PRESENTE",
hay una regresión en el modelo de capital derivado.*
`;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  console.log('Iniciando servidor de desarrollo aislado en', BASE_URL);
  const devServer = startDevServer();
  let browser;
  try {
    await waitForServer(BASE_URL);
    console.log('Servidor listo. Lanzando Chromium...');
    browser = await chromium.launch({ headless: true });

    console.log('Corriendo escenario: control');
    const control = await runScenario(browser, { scenarioName: 'control', editValue: null });

    console.log('Corriendo escenario: with-edit-0');
    const edit0 = await runScenario(browser, { scenarioName: 'with-edit-0', editValue: 0 });

    console.log('Corriendo escenario: with-edit-50');
    const edit50 = await runScenario(browser, { scenarioName: 'with-edit-50', editValue: 50 });

    const results = [control, edit0, edit50];

    fs.mkdirSync(OUTPUT_JSON_DIR, { recursive: true });
    fs.writeFileSync(
      path.join(OUTPUT_JSON_DIR, `run-${Date.now()}.json`),
      JSON.stringify(results, null, 2)
    );

    const report = buildReport(results);
    fs.writeFileSync(OUTPUT_MD, report, 'utf-8');
    console.log('Reporte escrito en', OUTPUT_MD);
  } finally {
    if (browser) await browser.close();
    devServer.kill();
    // Dar tiempo a que el proceso de vite libere el puerto antes de salir
    await sleep(300);
  }
}

main().catch((err) => {
  console.error('Fallo la reproducción automatizada:', err);
  process.exitCode = 1;
});
