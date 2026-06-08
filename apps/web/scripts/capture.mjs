// Real-browser screenshot capture for the demo walkthrough.
// Drives the actual login flow, then walks each top-level workspace.
// Usage: node scripts/capture.mjs [baseUrl] [outDir]
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

const BASE = process.argv[2] || 'http://localhost:3210';
const OUT = process.argv[3] || join(process.env.TEMP || '/tmp', 'valor-shots');
const PASSWORD = 'valor1!';

mkdirSync(OUT, { recursive: true });

const shots = [];
async function shot(page, name) {
  const file = join(OUT, name);
  await page.screenshot({ path: file, fullPage: true });
  shots.push(file);
  console.log('captured', file);
}

const browser = await chromium.launch();
try {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.error('PAGEERROR', e.message));
  page.on('console', (m) => { if (m.type() === 'error') console.error('CONSOLE.ERROR', m.text()); });

  // 1) Login screen (no cookie -> gate forces /login)
  await page.goto(`${BASE}/`, { waitUntil: 'networkidle' });
  await page.waitForURL('**/login', { timeout: 15000 });
  await page.waitForTimeout(500); // let fade-up settle
  await shot(page, '01-login.png');

  // 2) Real login -> workspace launcher
  await page.fill('#password', PASSWORD);
  await Promise.all([
    page.waitForURL((url) => !url.pathname.startsWith('/login'), { timeout: 15000 }),
    page.click('button[type=submit]'),
  ]);
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(700);
  await shot(page, '02-launcher.png');

  // 3) Field Operations (live) -> dashboard
  await page.goto(`${BASE}/dashboard`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(900);
  await shot(page, '03-field-operations-dashboard.png');

  // 4) A coming-soon workspace
  await page.goto(`${BASE}/office-ops`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(500);
  await shot(page, '04-office-ops-coming-soon.png');

  // 5) Mobile launcher
  const mctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  const mpage = await mctx.newPage();
  await mpage.context().addCookies([{ name: 'valor_demo_auth', value: '1', url: BASE }]);
  await mpage.goto(`${BASE}/`, { waitUntil: 'networkidle' });
  await mpage.waitForTimeout(700);
  await shot(mpage, '05-launcher-mobile.png');

  console.log('\nDONE', shots.length, 'screenshots ->', OUT);
} finally {
  await browser.close();
}
