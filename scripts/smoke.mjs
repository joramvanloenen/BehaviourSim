import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, extname } from 'node:path';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const root = process.cwd();
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' };
const server = createServer(async (req, res) => {
  const relative = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  const file = resolve(root, '.' + (relative === '/' ? '/index.html' : relative));
  if (!file.startsWith(root + '/')) { res.writeHead(403); res.end(); return; }
  try {
    const bytes = await readFile(file);
    res.writeHead(200, { 'Content-Type': types[extname(file)] || 'application/octet-stream' });
    res.end(bytes);
  } catch { res.writeHead(404); res.end(); }
});
await new Promise(resolveListen => server.listen(4173, '127.0.0.1', resolveListen));
let browser;
try {
  browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(error.message));
  await page.goto('http://127.0.0.1:4173', { waitUntil: 'domcontentloaded' });
  await page.locator('#scene').waitFor();
  await page.locator('[data-speed="12"]').click();
  await page.waitForFunction(() => Number(document.querySelector('#interactions').textContent) >= 5, null, { timeout: 20000 });
  assert.ok(await page.locator('#concepts .concept-row').count() >= 3);
  const before = Number(await page.locator('#interactions').textContent());
  await page.locator('[data-spawn="berry"]').click();
  await page.locator('#scene').click({ position: { x: 210, y: 130 } });
  await page.locator('#selectedDetails').getByText('World truth: berry', { exact: false }).waitFor();
  await page.locator('#pause').click();
  const store = await page.evaluate(() => localStorage.getItem('behavioursim.prototype.v1'));
  console.log('Before reload', before, 'stored memory count', store ? JSON.parse(store).brain.totalInteractions : 'MISSING');
  await page.screenshot({ path: 'behavioursim-desktop.png', fullPage: true });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(550);
  console.log('After reload:', await page.locator('#interactions').textContent(), 'runtime errors:', pageErrors);
  await page.waitForFunction(v => Number(document.querySelector('#interactions').textContent) >= v, before, { timeout: 5000 });
  assert.deepEqual(pageErrors, [], 'Browser runtime errors: ' + pageErrors.join('; '));
  await page.screenshot({ path: 'behavioursim-desktop.png', fullPage: true });
  console.log('Desktop smoke passed; ' + before + ' interactions persist across reload.');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: 'behavioursim-mobile.png', fullPage: true });
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  assert.ok(overflow < 5, 'Unexpected horizontal overflow on mobile: ' + overflow + 'px');
  console.log('Mobile smoke passed without horizontal overflow.');
} finally {
  await browser?.close();
  await new Promise(resolveClose => server.close(resolveClose));
}
