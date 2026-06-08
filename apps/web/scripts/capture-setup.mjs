// Capture the Well Setup → live wellbore diagram → export screen (slice 1).
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

const BASE = process.argv[2] || 'http://localhost:3210';
const OUT = join(process.env.TEMP || '/tmp', 'valor-shots');
mkdirSync(OUT, { recursive: true });
const shots = [];
async function shot(p, n, full = true) {
  const f = join(OUT, n);
  await p.screenshot({ path: f, fullPage: full });
  shots.push(f);
  console.log('captured', f);
}

const browser = await chromium.launch();
try {
  const ctx = await browser.newContext({ viewport: { width: 1480, height: 1024 }, deviceScaleFactor: 2 });
  await ctx.addCookies([{ name: 'valor_demo_auth', value: '1', url: BASE }]);
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.error('PAGEERROR', e.message));
  page.on('console', (m) => { if (m.type() === 'error') console.error('CONSOLE.ERROR', m.text()); });

  await page.goto(`${BASE}/wells/well-lf1/setup`, { waitUntil: 'networkidle' });
  await page.waitForSelector('svg', { timeout: 15000 });
  await page.waitForTimeout(900);
  await shot(page, '06-well-setup-default.png');

  // Diagram close-up
  const svg = await page.$('svg');
  if (svg) { const f = join(OUT, '07-wellbore-schematic.png'); await svg.screenshot({ path: f }); shots.push(f); console.log('captured', f); }

  // Best-effort unit flip → metric, to show live conversion
  try {
    const selects = await page.$$('select');
    for (const s of selects) {
      const opts = await s.$$eval('option', (os) => os.map((o) => (o.value || o.textContent || '').trim()));
      if (opts.includes('mm')) await s.selectOption('mm');                                  // diameter unit
      else if (opts.includes('m') && opts.includes('yd') && opts.length <= 3) await s.selectOption('m'); // depth unit
    }
    await page.waitForTimeout(700);
    await shot(page, '08-well-setup-metric.png');
  } catch (e) { console.error('unit-flip skipped:', e.message); }

  console.log('\nDONE', shots.length, 'screenshots');
} finally {
  await browser.close();
}
