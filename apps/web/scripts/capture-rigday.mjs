// Capture the Rig Day timeline console (slice 4a).
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

const BASE = process.argv[2] || 'http://localhost:3210';
const OUT = join(process.env.TEMP || '/tmp', 'valor-shots');
mkdirSync(OUT, { recursive: true });
const shots = [];
async function shot(p, n) { const f = join(OUT, n); await p.screenshot({ path: f, fullPage: true }); shots.push(f); console.log('captured', f); }

const browser = await chromium.launch();
try {
  const ctx = await browser.newContext({ viewport: { width: 1480, height: 1024 }, deviceScaleFactor: 2 });
  await ctx.addCookies([{ name: 'valor_demo_auth', value: '1', url: BASE }]);
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', (e) => errs.push(e.message));
  p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });

  await p.goto(`${BASE}/rig-day`, { waitUntil: 'networkidle' });
  await p.waitForSelector('[data-testid="rig-day-track"]', { timeout: 15000 });
  await p.waitForTimeout(700);
  await shot(p, '10-rig-day-default.png');

  // Add a block from the Bank to show the live accounting update
  try {
    const before = (await p.$$('[data-testid="rig-block"]')).length;
    const cmt = await p.getByRole('button', { name: /Cementing/i }).first();
    await cmt.click();
    await p.waitForTimeout(500);
    const after = (await p.$$('[data-testid="rig-block"]')).length;
    console.log(`blocks: ${before} -> ${after} (added from Bank)`);
    await shot(p, '11-rig-day-after-add.png');
  } catch (e) { console.error('add-from-bank skipped:', e.message); }

  console.log('PAGE ERRORS:', errs.length ? errs : 'NONE');
} finally {
  await browser.close();
}
