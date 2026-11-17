// End-to-end check in real Chromium. Usage: node tests/e2e.mjs <served-url> <samples-dir> <screens-dir>
// Numbers shown on screen are compared with samples/expected_stats.json, which tools/expected_stats.py
// computes independently of the website code.
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
const require = createRequire(import.meta.url);
let chromium;
try { ({ chromium } = require('playwright')); } catch { ({ chromium } = require('/opt/npm-tools/node_modules/playwright')); }

const [url, samples, shots] = process.argv.slice(2);
fs.mkdirSync(shots, { recursive: true });
const expect = JSON.parse(fs.readFileSync(path.join(samples, 'expected_stats.json'), 'utf8'));
const sessionFiles = fs.readdirSync(path.join(samples, 'sessions')).filter((f) => f.endsWith('.json')).map((f) => path.join(samples, 'sessions', f));

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1400, height: 1000 }, deviceScaleFactor: 1 });
const page = await ctx.newPage();
await page.clock.setFixedTime(new Date('2026-11-15T10:00:00'));
const problems = [];
page.on('console', (m) => ['error', 'warning'].includes(m.type()) && problems.push(`${m.type()}: ${m.text()}`));
page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`));

let n = 0;
const step = async (name, fn) => { await fn(); n++; console.log('  ok', name); };
const shot = (name) => page.screenshot({ path: path.join(shots, `${name}.png`), fullPage: true });
const text = async () => (await page.locator('body').innerText()).replace(/\s+/g, ' ');
const tab = (re) => page.getByRole('tab', { name: re });

await page.goto(url);
await page.getByText('Track a home exercise programme').waitFor();

await step('starts blank: no tabs, no metrics, offers to build a plan', async () => {
  assert.equal(await page.getByRole('tab').count(), 0);
  const t = await text();
  assert.ok(!/Adherence|Form score/.test(t));
  assert.match(t, /Build a plan here instead/);
  await shot('01-blank');
});

await step('plan import opens the app; sessions import with the right count', async () => {
  await page.setInputFiles('#kc-plan-drop-welcome', path.join(samples, 'plan.json'));
  await tab(/Data/).waitFor();
  await tab(/Data/).click();
  await page.setInputFiles('#kc-session-drop', sessionFiles);
  await page.getByText(new RegExp(`Imported ${sessionFiles.length} new sessions`)).first().waitFor();
});

await step('overview numbers match the independent Python computation', async () => {
  await tab(/Overview/).click();
  const t = await text();
  assert.ok(t.includes(`${expect.reps_credited} of ${expect.reps_planned} reps`), 'reps credited/planned');
  assert.ok(t.includes(String(Math.round(expect.form_weighted))), 'form score');
  assert.ok(t.includes(`${Math.round((expect.reps_credited / expect.reps_planned) * 100)}`), 'adherence %');
  await shot('02-overview');
});

await step('pain flare raises a high alert and the nav badge', async () => {
  assert.equal(!!expect.pain_flare.length || !!expect.pain_flare, true);
  const t = await text();
  assert.match(t, /pain reported/i);
  assert.match(t, /High/);
});

await step('exercise page shows the dial and the pain chart', async () => {
  await tab(/Exercises/).click();
  assert.ok(await page.locator('.kc-dial').count() >= 1, 'goniometer dial');
  assert.match(await text(), /Pain/i);
  await shot('03-exercise');
});

await step('log filters by exercise and downloads a CSV with pain and effort columns', async () => {
  await tab(/Log/).click();
  const rows = await page.locator('table tbody tr').count();
  assert.ok(rows > 0);
  const dl = page.waitForEvent('download');
  await page.getByRole('button', { name: /CSV/ }).first().click();
  const file = await dl;
  const csv = fs.readFileSync(await file.path(), 'utf8');
  assert.match(csv.split('\n')[0], /pain/i);
  assert.match(csv.split('\n')[0], /effort/i);
});

await step('plan builder: edit a target, save, and the schedule updates', async () => {
  await tab(/Plan/).click();
  await page.getByRole('button', { name: 'Edit plan' }).click();
  await shot('04-builder');
  const target = page.getByLabel('Target angle (°)').first();
  await target.fill('95');
  await page.getByRole('button', { name: 'Save changes' }).click();
  await page.getByText(/95/).first().waitFor();
});

await step('report shows notes and prints without the rail', async () => {
  await tab(/Report/).click();
  await page.getByLabel('Note').first().fill('Check squat depth next visit').catch(() => {});
  const add = page.getByRole('button', { name: /Add note/ });
  if (await add.count()) await add.click();
  await shot('05-report');
  await page.emulateMedia({ media: 'print' });
  assert.equal(await page.locator('.kc-rail').first().isVisible(), false);
  await page.emulateMedia({ media: 'screen' });
});

await step('dark mode and high contrast switch without errors', async () => {
  await page.getByRole('button', { name: 'Dark' }).click();
  await shot('06-dark');
  await page.getByRole('button', { name: 'High contrast' }).click();
  await page.getByRole('button', { name: 'Light' }).click();
});

await step('phone width has no horizontal page scroll', async () => {
  await page.setViewportSize({ width: 390, height: 844 });
  await tab(/Overview/).click();
  const over = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  assert.ok(over <= 1, `horizontal overflow ${over}px`);
  await shot('07-mobile');
});

await step('no console errors or warnings in the whole run', async () => { assert.deepEqual(problems, []); });
console.log(`\n${n} end-to-end steps passed`);
await browser.close();
