/**
 * Prueba específica de la MIGRACIÓN de datos legacy al modelo de pool derivado
 * (fix B1/B2, ver PLAN_BUG_CALCULO.md).
 *
 * Contexto: antes del fix, cashBudget/cardBudget eran "pool vivo" persistido en
 * cobuy_budget_cash/card, con los ingresos ya sumados y los apartados ya restados.
 * Tras el fix, el pool se deriva de un snapshot inicial. La carga migra el pool viejo
 * a snapshot con: snapshot = pool_viejo − ingresos + apartados. Esta prueba verifica
 * que la migración:
 *
 *   Paso 2 — no cambia el número que el usuario ya veía (pool derivado == pool legacy).
 *   Paso 3 — es estable al recargar la PWA (no re-deriva a un valor distinto).
 *   Paso 4 — tras migrar, editar "Presupuesto Inicial" y agregar ingresos/apartados
 *            posteriores respeta la fórmula (ya no se pierde nada).
 *
 * Seeding run-once: addInitScript corre en cada navegación, así que la siembra usa un
 * centinela (__migration_test_seeded) para NO re-sembrar en la recarga — la segunda
 * carga debe usar lo que la app persistió, no los datos legacy otra vez.
 *
 * Uso:  npm run repro:migracion   (o: node scripts/repro-migracion.mjs)
 * Salida: REPRO_MIGRACION_REPORTE.md. Exit code != 0 si alguna aserción falla.
 */
import { chromium } from '@playwright/test';
import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const PORT = 3101;
const BASE_URL = `http://127.0.0.1:${PORT}/`;
const OUTPUT_MD = path.join(ROOT, 'REPRO_MIGRACION_REPORTE.md');

const money = (n) => Math.round((n + Number.EPSILON) * 100) / 100;
const fmt = (n) => `$${money(n).toFixed(2)}`;
const approxEq = (a, b) => Math.abs(a - b) < 0.01;

// --- Dev server ------------------------------------------------------------
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

// --- Legacy seed (formato PRE-fix) -----------------------------------------
// Pool vivo cash = 850 => inicial implícito = 850 − ingresos(400) + apartados(50) = 500
// Pool vivo card = 1000 => inicial implícito = 1000 − ingresos(200) + apartados(0) = 800
function buildLegacySeed() {
  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const iso = `${currentMonth}-05T10:00:00`;
  return {
    LEGACY_CASH_POOL: 850,
    LEGACY_CARD_POOL: 1000,
    EXPECTED_SNAPSHOT_CASH: 500,
    EXPECTED_SNAPSHOT_CARD: 800,
    seed: {
      cobuy_shopping_items: '[]',
      cobuy_archived_items: '[]',
      cobuy_service_payments: '[]',
      cobuy_history_months: '[]',
      cobuy_current_month: currentMonth,
      // Pool vivo viejo (con ingresos ya sumados / apartados ya restados):
      cobuy_budget_cash: '850',
      cobuy_budget_card: '1000',
      // Registros coherentes con ese pool viejo:
      cobuy_incomes: JSON.stringify([
        { id: 'inc-legacy-1', name: 'Sueldo previo', amount: 400, paymentMethod: 'efectivo', createdAt: iso },
        { id: 'inc-legacy-2', name: 'Transferencia previa', amount: 200, paymentMethod: 'transferencia', createdAt: iso }
      ]),
      cobuy_apartados: JSON.stringify([
        { id: 'ap-legacy-1', name: 'Ahorro previo', amount: 50, paymentMethod: 'efectivo', createdAt: iso }
      ])
      // NOTA: NO se siembran cobuy_initial_cash_snapshot / cobuy_initial_card_snapshot
      // (datos legacy pre-fix no tenían el snapshot como fuente de verdad).
    }
  };
}

// --- State reader (siempre localStorage, nunca UI) -------------------------
async function readState(page) {
  const raw = await page.evaluate(() => {
    const out = {};
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && (k.startsWith('cobuy_') || k === '__migration_test_seeded')) out[k] = localStorage.getItem(k);
    }
    return out;
  });
  const num = (k) => parseFloat(raw[k] ?? 'NaN');
  const arr = (k) => { try { return JSON.parse(raw[k] ?? '[]'); } catch { return []; } };
  const incomes = arr('cobuy_incomes');
  const apartados = arr('cobuy_apartados');
  const incomesCashSum = money(incomes.filter(i => i.paymentMethod === 'efectivo').reduce((a, c) => a + c.amount, 0));
  const incomesCardSum = money(incomes.filter(i => i.paymentMethod !== 'efectivo').reduce((a, c) => a + c.amount, 0));
  const apartadosCashSum = money(apartados.filter(a => a.paymentMethod === 'efectivo').reduce((a, c) => a + c.amount, 0));
  const apartadosCardSum = money(apartados.filter(a => a.paymentMethod === 'tarjeta').reduce((a, c) => a + c.amount, 0));
  const snapshotCash = num('cobuy_initial_cash_snapshot');
  const snapshotCard = num('cobuy_initial_card_snapshot');
  // El pool ya NO se persiste como clave legacy: se deriva del snapshot (igual que la app).
  return {
    raw,
    cashBudget: money(snapshotCash + incomesCashSum - apartadosCashSum),
    cardBudget: money(snapshotCard + incomesCardSum - apartadosCardSum),
    snapshotCash,
    snapshotCard,
    incomesCashSum,
    apartadosCashSum,
    // Estado crudo de las claves legacy, para verificar que la migración las borró / las ignora.
    legacyCashKeyPresent: raw['cobuy_budget_cash'] !== undefined,
    legacyCashKeyRaw: raw['cobuy_budget_cash'],
    seeded: raw['__migration_test_seeded'] === '1'
  };
}

// Espera a que la migración se persista (el snapshot pasa de 0 a su valor migrado).
async function waitForMigrationFlush(page, timeoutMs = 8000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const v = await page.evaluate(() => localStorage.getItem('cobuy_initial_cash_snapshot'));
    if (v !== null) return;
    await sleep(100);
  }
  throw new Error('La migración no persistió cobuy_initial_cash_snapshot a tiempo');
}

// --- UI helpers ------------------------------------------------------------
async function gotoSection(page, title) {
  await page.getByTitle(title, { exact: true }).first().click();
}

async function editInitialCashBudget(page, newValue) {
  await gotoSection(page, 'Mi Capital');
  await page.getByTitle('Editar presupuesto inicial (solo correcciones)').first().click();
  const container = page.getByText('Presupuesto Inicial').first().locator('xpath=..');
  await container.locator('input[type="number"]').fill(String(newValue));
  await container.getByTitle('Guardar').click();
}

async function addIncomeEfectivo(page, { name, amount }) {
  await gotoSection(page, 'Ingresos del Mes');
  await page.getByPlaceholder('Ej. Nómina quincenal, Venta, Regalo').fill(name);
  await page.getByPlaceholder('0.00').fill(String(amount));
  await page.locator('select').selectOption('efectivo');
  await page.getByRole('button', { name: 'Registrar Ingreso' }).click();
}

async function createApartadoEfectivo(page, { name, amount }) {
  await gotoSection(page, 'Mi Capital');
  await page.getByRole('button', { name: /Crear Apartado/ }).first().click();
  await page.getByPlaceholder('Nombre (ej. Renta)').fill(name);
  await page.getByPlaceholder('Monto').fill(String(amount));
  await page.getByRole('button', { name: 'Crear', exact: true }).click();
}

// --- Assertion collector ---------------------------------------------------
const checks = [];
function assert(label, pass, detail) {
  checks.push({ label, pass, detail });
  console.log(`${pass ? 'PASS' : 'FAIL'} — ${label}${detail ? ` (${detail})` : ''}`);
}

// --- Main ------------------------------------------------------------------
async function main() {
  const { LEGACY_CASH_POOL, LEGACY_CARD_POOL, EXPECTED_SNAPSHOT_CASH, EXPECTED_SNAPSHOT_CARD, seed } = buildLegacySeed();

  console.log('Iniciando servidor de desarrollo aislado en', BASE_URL);
  const devServer = startDevServer();
  let browser;
  const snapshots = {};
  try {
    await waitForServer(BASE_URL);
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({ baseURL: BASE_URL });

    // Seeding run-once mediante centinela: NO re-sembrar en recargas.
    await context.addInitScript((seedData) => {
      if (!localStorage.getItem('__migration_test_seeded')) {
        for (const [k, v] of Object.entries(seedData)) localStorage.setItem(k, v);
        localStorage.setItem('__migration_test_seeded', '1');
      }
    }, seed);

    const page = await context.newPage();

    // === PASO 1+2: primera carga (migración) ===
    console.log('\n[Paso 1-2] Primera carga con datos legacy...');
    await page.goto(BASE_URL);
    await page.waitForSelector('#app-root-layout');
    await waitForMigrationFlush(page);
    const afterMigration = await readState(page);
    snapshots.afterMigration = afterMigration;

    assert(
      'Paso 2 — pool EFECTIVO derivado == pool legacy sembrado',
      approxEq(afterMigration.cashBudget, LEGACY_CASH_POOL),
      `derivado ${fmt(afterMigration.cashBudget)} vs legacy ${fmt(LEGACY_CASH_POOL)}`
    );
    assert(
      'Paso 2 — pool TARJETA derivado == pool legacy sembrado',
      approxEq(afterMigration.cardBudget, LEGACY_CARD_POOL),
      `derivado ${fmt(afterMigration.cardBudget)} vs legacy ${fmt(LEGACY_CARD_POOL)}`
    );
    assert(
      'Paso 2 — snapshot EFECTIVO reconstruido correctamente (pool − ingresos + apartados)',
      approxEq(afterMigration.snapshotCash, EXPECTED_SNAPSHOT_CASH),
      `snapshot ${fmt(afterMigration.snapshotCash)} vs esperado ${fmt(EXPECTED_SNAPSHOT_CASH)}`
    );
    assert(
      'Paso 2 — snapshot TARJETA reconstruido correctamente',
      approxEq(afterMigration.snapshotCard, EXPECTED_SNAPSHOT_CARD),
      `snapshot ${fmt(afterMigration.snapshotCard)} vs esperado ${fmt(EXPECTED_SNAPSHOT_CARD)}`
    );
    assert(
      'Paso 2 — claves legacy (cobuy_budget_cash/card) BORRADAS tras migrar',
      afterMigration.legacyCashKeyPresent === false,
      `cobuy_budget_cash presente=${afterMigration.legacyCashKeyPresent}`
    );

    // === PASO 3: recargar (simula cerrar/reabrir la PWA) ===
    console.log('\n[Paso 3] Recargando (simula reabrir la PWA)...');
    await page.reload();
    await page.waitForSelector('#app-root-layout');
    await waitForMigrationFlush(page);
    const afterReload = await readState(page);
    snapshots.afterReload = afterReload;

    assert(
      'Paso 3 — centinela intacto: NO se re-sembró en la recarga',
      afterReload.seeded === true,
      `__migration_test_seeded=${afterReload.raw['__migration_test_seeded']}`
    );
    assert(
      'Paso 3 — pool EFECTIVO estable tras recargar (migración run-once/idempotente)',
      approxEq(afterReload.cashBudget, LEGACY_CASH_POOL),
      `${fmt(afterReload.cashBudget)} (debía seguir ${fmt(LEGACY_CASH_POOL)})`
    );
    assert(
      'Paso 3 — pool TARJETA estable tras recargar',
      approxEq(afterReload.cardBudget, LEGACY_CARD_POOL),
      `${fmt(afterReload.cardBudget)} (debía seguir ${fmt(LEGACY_CARD_POOL)})`
    );
    assert(
      'Paso 3 — snapshot EFECTIVO no re-derivado a otro valor',
      approxEq(afterReload.snapshotCash, EXPECTED_SNAPSHOT_CASH),
      `${fmt(afterReload.snapshotCash)} (debía seguir ${fmt(EXPECTED_SNAPSHOT_CASH)})`
    );

    // === PASO 4: editar inicial + ingresos/apartados posteriores ===
    console.log('\n[Paso 4] Editar "Presupuesto Inicial" y operar después...');
    // Editar inicial efectivo a 600: pool = 600 + ingresos(400) − apartados(50) = 950
    await editInitialCashBudget(page, 600);
    const afterEdit = await readState(page);
    snapshots.afterEdit = afterEdit;
    const expectedAfterEdit = money(600 + afterEdit.incomesCashSum - afterEdit.apartadosCashSum);
    assert(
      'Paso 4a — tras editar inicial a $600, pool efectivo = 600 + ingresos − apartados',
      approxEq(afterEdit.cashBudget, expectedAfterEdit),
      `${fmt(afterEdit.cashBudget)} vs esperado ${fmt(expectedAfterEdit)}`
    );

    // Nuevo ingreso efectivo +100: no debe perderse
    await addIncomeEfectivo(page, { name: 'Sueldo nuevo', amount: 100 });
    const afterIncome = await readState(page);
    snapshots.afterIncome = afterIncome;
    const expectedAfterIncome = money(afterEdit.snapshotCash + afterIncome.incomesCashSum - afterIncome.apartadosCashSum);
    assert(
      'Paso 4b — ingreso efectivo posterior +$100 se suma al pool (no se pierde)',
      approxEq(afterIncome.cashBudget, expectedAfterIncome) && approxEq(afterIncome.cashBudget, afterEdit.cashBudget + 100),
      `${fmt(afterIncome.cashBudget)} (esperado ${fmt(expectedAfterIncome)} = ${fmt(afterEdit.cashBudget)} + $100)`
    );

    // Nuevo apartado efectivo 30: reduce el pool
    await createApartadoEfectivo(page, { name: 'Reserva nueva', amount: 30 });
    const afterApartado = await readState(page);
    snapshots.afterApartado = afterApartado;
    const expectedAfterApartado = money(afterIncome.cashBudget - 30);
    assert(
      'Paso 4c — apartado efectivo posterior -$30 reduce el pool',
      approxEq(afterApartado.cashBudget, expectedAfterApartado),
      `${fmt(afterApartado.cashBudget)} (esperado ${fmt(expectedAfterApartado)})`
    );
    assert(
      'Paso 4 — el snapshot editado ($600) se mantiene como fuente de verdad',
      approxEq(afterApartado.snapshotCash, 600),
      `snapshot ${fmt(afterApartado.snapshotCash)}`
    );

    // Estado esperado tras el paso 4: snapshot 600, ingresos efectivo 500 (400+100),
    // apartados efectivo 80 (50+30) => pool 1020.
    const POOL_AFTER_STEP4 = 1020;

    // === PASO 5: recarga REAL tras editar — la edición NO debe perderse ===
    console.log('\n[Paso 5] Recarga real tras editar el inicial...');
    await page.reload();
    await page.waitForSelector('#app-root-layout');
    await waitForMigrationFlush(page);
    const afterEditReload = await readState(page);
    snapshots.afterEditReload = afterEditReload;
    assert(
      'Paso 5a — tras recargar, el snapshot editado sigue en $600 (no vuelve al legacy)',
      approxEq(afterEditReload.snapshotCash, 600),
      `snapshot ${fmt(afterEditReload.snapshotCash)}`
    );
    assert(
      'Paso 5a — tras recargar, el pool sigue en $1020 (no se re-deriva desde legacy)',
      approxEq(afterEditReload.cashBudget, POOL_AFTER_STEP4),
      `${fmt(afterEditReload.cashBudget)} (esperado ${fmt(POOL_AFTER_STEP4)})`
    );

    // === PASO 5b (adversarial): inyectar una clave legacy STALE y recargar ===
    // Simula que quedó un cobuy_budget_cash viejo/corrupto. Con el guard, la app YA está migrada
    // (snapshot presente) y debe IGNORARLo por completo — el snapshot no debe cambiar.
    console.log('\n[Paso 5b] Inyectando cobuy_budget_cash=99999 stale y recargando...');
    await page.evaluate(() => localStorage.setItem('cobuy_budget_cash', '99999'));
    await page.reload();
    await page.waitForSelector('#app-root-layout');
    await waitForMigrationFlush(page);
    const afterStaleInjection = await readState(page);
    snapshots.afterStaleInjection = afterStaleInjection;
    assert(
      'Paso 5b — snapshot NO recalculado desde la clave legacy inyectada (sigue $600)',
      approxEq(afterStaleInjection.snapshotCash, 600),
      `snapshot ${fmt(afterStaleInjection.snapshotCash)} (si fuera <600 la app recalculó desde legacy → BUG)`
    );
    assert(
      'Paso 5b — pool sigue en $1020 pese a la clave legacy stale ($99999 ignorada)',
      approxEq(afterStaleInjection.cashBudget, POOL_AFTER_STEP4),
      `${fmt(afterStaleInjection.cashBudget)} (esperado ${fmt(POOL_AFTER_STEP4)})`
    );

    await context.close();
  } finally {
    if (browser) await browser.close();
    devServer.kill();
    await sleep(300);
  }

  const allPass = checks.every((c) => c.pass);
  writeReport(allPass, snapshots, { LEGACY_CASH_POOL, LEGACY_CARD_POOL, EXPECTED_SNAPSHOT_CASH, EXPECTED_SNAPSHOT_CARD });
  console.log(`\n${allPass ? '✅ TODAS las aserciones pasaron' : '❌ HAY ASERCIONES FALLIDAS'} — reporte en ${OUTPUT_MD}`);
  if (!allPass) process.exitCode = 1;
}

function writeReport(allPass, snap, exp) {
  const row = (c) => `| ${c.pass ? '✅' : '❌'} | ${c.label} | ${c.detail || ''} |`;
  const a = snap.afterMigration || {};
  const r = snap.afterReload || {};
  const e = snap.afterEdit || {};
  const er = snap.afterEditReload || {};
  const si = snap.afterStaleInjection || {};
  const report = `# Reproducción — Migración de datos legacy al pool derivado (B1/B2)

> Estado detectado: **${allPass ? '✅ MIGRACIÓN CORRECTA' : '❌ MIGRACIÓN FALLIDA'}**
>
> Generado por \`scripts/repro-migracion.mjs\` (\`npm run repro:migracion\`). Siembra
> \`localStorage\` en formato PRE-fix (pool vivo en \`cobuy_budget_cash/card\`, sin snapshot),
> carga la app, verifica la migración, recarga para probar estabilidad, y opera después.
>
> Fecha de ejecución: ${new Date().toISOString()}

## Datos legacy sembrados (formato pre-fix)

- \`cobuy_budget_cash\` = ${fmt(exp.LEGACY_CASH_POOL)} (pool vivo: inicial $500 + ingreso efectivo $400 − apartado $50)
- \`cobuy_budget_card\` = ${fmt(exp.LEGACY_CARD_POOL)} (pool vivo: inicial $800 + transferencia $200)
- \`cobuy_incomes\` = [efectivo $400, transferencia $200]
- \`cobuy_apartados\` = [efectivo $50]
- **Sin** \`cobuy_initial_cash_snapshot\` / \`cobuy_initial_card_snapshot\` (no existían pre-fix)

Snapshot esperado tras migrar (= pool − ingresos + apartados):
efectivo ${fmt(exp.EXPECTED_SNAPSHOT_CASH)}, tarjeta ${fmt(exp.EXPECTED_SNAPSHOT_CARD)}.

## Valores observados (leídos de localStorage, no de la UI)

| Momento | pool efectivo | pool tarjeta | snapshot efectivo | snapshot tarjeta |
|---|---|---|---|---|
| Tras migrar (1ª carga) | ${fmt(a.cashBudget)} | ${fmt(a.cardBudget)} | ${fmt(a.snapshotCash)} | ${fmt(a.snapshotCard)} |
| Tras recargar (2ª carga) | ${fmt(r.cashBudget)} | ${fmt(r.cardBudget)} | ${fmt(r.snapshotCash)} | ${fmt(r.snapshotCard)} |
| Tras editar inicial a $600 (paso 4) | ${fmt(e.cashBudget)} | ${fmt(e.cardBudget)} | ${fmt(e.snapshotCash)} | ${fmt(e.snapshotCard)} |
| Tras recargar post-edición (paso 5a) | ${fmt(er.cashBudget)} | ${fmt(er.cardBudget)} | ${fmt(er.snapshotCash)} | ${fmt(er.snapshotCard)} |
| Tras inyectar legacy stale $99999 + recargar (paso 5b) | ${fmt(si.cashBudget)} | ${fmt(si.cardBudget)} | ${fmt(si.snapshotCash)} | ${fmt(si.snapshotCard)} |

## Aserciones

| | Verificación | Detalle |
|---|---|---|
${checks.map(row).join('\n')}

## Conclusión

${allPass
  ? `**✅ La migración es correcta, estable y con guard explícito.** El pool derivado tras migrar
es idéntico al pool legacy que el usuario ya veía (no cambia ningún número), las claves legacy
(\`cobuy_budget_cash/card\`) se **borran** al migrar, y al recargar la PWA el snapshot es la única
fuente de verdad (guard: si el snapshot existe, jamás se recalcula desde legacy).

Puntos clave verificados:
- **Paso 4→5a:** tras editar el "Presupuesto Inicial" a $600 y recargar de verdad, la edición
  **persiste** (snapshot $600, pool $1020). No se pierde — que era el riesgo señalado.
- **Paso 5b (adversarial):** inyectando un \`cobuy_budget_cash=99999\` stale y recargando, la app
  lo **ignora** por completo (snapshot sigue $600, pool $1020). Confirma que no queda ningún
  camino de recálculo desde las claves legacy una vez migrado.

Listo para commit.`
  : `**❌ La migración FALLÓ en al menos una aserción** (ver tabla). NO marcar como listo para
commit: revisar el guard de migración en la carga inicial de \`App.tsx\` (debe leer el snapshot
como fuente de verdad y no recalcular desde \`cobuy_budget_cash/card\` una vez migrado).`}

---
*Reporte generado automáticamente — no editar a mano. Regenerar con \`npm run repro:migracion\`.*
`;
  fs.writeFileSync(OUTPUT_MD, report, 'utf-8');
}

main().catch((err) => {
  console.error('Fallo la reproducción de migración:', err);
  process.exitCode = 1;
});
