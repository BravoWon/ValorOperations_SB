// Capture the Rig Day Recall & QC drawer (slice 4c).
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

const BASE = process.argv[2] || 'http://localhost:3210';
const OUT = join(process.env.TEMP || '/tmp', 'valor-shots');
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();
try {
  const ctx = await browser.newContext({ viewport: { width: 1480, height: 1024 }, deviceScaleFactor: 2 });
  await ctx.addCookies([{ name: 'valor_demo_auth', value: '1', url: BASE }]);
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', (e) => errs.push(e.message));
  p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });

  await p.goto(`${BASE}/rig-day`, { waitUntil: 'networkidle' });
  await p.waitForSelector('[data-testid="rig-block"]', { timeout: 15000 });
  await p.waitForTimeout(600);

  // Click the 3rd block (a DRL block — should have like-items to recall)
  const blocks = await p.$$('[data-testid="rig-block"]');
  await blocks[2].click();
  await p.waitForSelector('[data-testid="like-item"]', { timeout: 8000 });
  await p.waitForTimeout(500);
  const likeCount = (await p.$$('[data-testid="like-item"]')).length;
  console.log('like-items shown:', likeCount);
  await p.screenshot({ path: join(OUT, '12-recall-drawer.png') });
  console.log('captured 12-recall-drawer.png');

  // Approve QC, then screenshot to show the badge
  try {
    await p.getByRole('button', { name: /approve/i }).first().click();
    await p.waitForTimeout(400);
    await p.screenshot({ path: join(OUT, '13-recall-qc-approved.png') });
    console.log('captured 13-recall-qc-approved.png');
  } catch (e) { console.error('qc-approve skipped:', e.message); }

  console.log('PAGE ERRORS:', errs.length ? errs : 'NONE');
} finally {
  await browser.close();
}
