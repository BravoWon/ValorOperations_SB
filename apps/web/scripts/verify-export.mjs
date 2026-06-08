import { chromium } from 'playwright';
import { join } from 'node:path';
import { statSync, readFileSync } from 'node:fs';

const BASE = 'http://localhost:3210';
const OUT = join(process.env.TEMP || '/tmp', 'valor-shots');
const b = await chromium.launch();
try {
  const ctx = await b.newContext({ viewport: { width: 1480, height: 1024 }, deviceScaleFactor: 2, acceptDownloads: true });
  await ctx.addCookies([{ name: 'valor_demo_auth', value: '1', url: BASE }]);
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', (e) => errs.push(e.message));
  p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });

  await p.goto(`${BASE}/wells/well-lf1/setup`, { waitUntil: 'networkidle' });
  await p.waitForSelector('svg', { timeout: 15000 });

  // Flip to metric (depth m, dia mm)
  for (const s of await p.$$('select')) {
    const opts = await s.$$eval('option', (os) => os.map((o) => (o.value || o.textContent || '').trim()));
    if (opts.includes('mm')) await s.selectOption('mm');
    else if (opts.includes('m') && opts.includes('yd') && opts.length <= 3) await s.selectOption('m');
  }
  await p.waitForTimeout(500);

  // VERIFY FIX: weight stays canonical (54/40/17) under metric
  const weights = await p.$$eval('input[aria-label="Weight (lb/ft)"]', (els) => els.map((e) => e.value));
  console.log('WEIGHTS under metric (expect 54,40,17):', weights.slice(0, 3).join(','));

  // VERIFY EXPORT: PNG download fires and produces a real raster
  try {
    const [download] = await Promise.all([
      p.waitForEvent('download', { timeout: 15000 }),
      p.getByRole('button', { name: /export png/i }).click(),
    ]);
    const path = join(OUT, '09-exported.png');
    await download.saveAs(path);
    const size = statSync(path).size;
    const head = readFileSync(path).subarray(0, 8).toString('hex');
    const isPng = head.startsWith('89504e47'); // PNG magic
    console.log(`EXPORT: file=${download.suggestedFilename()} bytes=${size} pngMagic=${isPng}`);
  } catch (e) {
    console.error('EXPORT DOWNLOAD FAILED:', e.message);
  }

  await p.screenshot({ path: join(OUT, '08-well-setup-metric.png'), fullPage: true });
  console.log('PAGE ERRORS:', errs.length ? errs : 'NONE');
} finally {
  await b.close();
}
