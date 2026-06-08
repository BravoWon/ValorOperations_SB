// Capture every main screen for the design-consistency audit.
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

const BASE = process.argv[2] || 'http://localhost:3210';
const OUT = process.argv[3] || join(process.env.TEMP || '/tmp', 'valor-audit');
mkdirSync(OUT, { recursive: true });

const ROUTES = [
  ['login', '/login', false],
  ['launcher', '/', true],
  ['dashboard', '/dashboard', true],
  ['assets', '/assets', true],
  ['jobs', '/jobs', true],
  ['well-detail', '/wells/well-lf1', true],
  ['well-setup', '/wells/well-lf1/setup', true],
  ['hydraulics', '/tools/hydraulics', true],
  ['rig-day', '/rig-day', true],
  ['office-ops', '/office-ops', true],
];

const browser = await chromium.launch();
const errs = {};
try {
  for (const [name, path, auth] of ROUTES) {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
    if (auth) await ctx.addCookies([{ name: 'valor_demo_auth', value: '1', url: BASE }]);
    const p = await ctx.newPage();
    const e = [];
    p.on('pageerror', (x) => e.push(x.message));
    p.on('console', (m) => { if (m.type() === 'error') e.push(m.text()); });
    await p.goto(`${BASE}${path}`, { waitUntil: 'networkidle' }).catch(() => {});
    await p.waitForTimeout(700);
    await p.screenshot({ path: join(OUT, `${name}.png`), fullPage: true });
    if (e.length) errs[name] = e;
    console.log('captured', name);
    await ctx.close();
  }
  console.log('\nERRORS:', Object.keys(errs).length ? JSON.stringify(errs, null, 1) : 'NONE');
} finally {
  await browser.close();
}
