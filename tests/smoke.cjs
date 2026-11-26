const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { chromium } = require('playwright');

const root = path.resolve(__dirname, '..', 'www');
const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8' };
const server = http.createServer((req, res) => {
  const pathname = decodeURIComponent((req.url || '/').split('?')[0]);
  const file = path.resolve(root, '.' + (pathname === '/' ? '/index.html' : pathname));
  if (!file.startsWith(root + path.sep) && file !== path.join(root, 'index.html')) {
    res.writeHead(403).end('Forbidden');
    return;
  }
  fs.createReadStream(file)
    .on('error', () => res.writeHead(404).end('Not found'))
    .pipe(res.writeHead(200, { 'Content-Type': mime[path.extname(file)] || 'application/octet-stream' }));
});

(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--enable-webgl', '--use-gl=angle', '--use-angle=swiftshader', '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows', '--disable-frame-rate-limit']
  });
  const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(error.message));

  try {
    await page.goto(`http://127.0.0.1:${address.port}/`, { waitUntil: 'load' });
    await page.waitForSelector('#playBtn');
    await page.locator('#playBtn').click();
    await page.waitForFunction(() => document.querySelector('#game').classList.contains('active'));
    assert.equal(await page.locator('#stageLabel').textContent(), '01');
    await page.waitForFunction(() => window.__gkeetRigCount === 2, null, { timeout: 15000 });
    await page.screenshot({ path: '/tmp/gkeet-gameplay.png' });

    const before = Number(await page.locator('#timer').textContent());
    try {
      await page.waitForFunction(() => Number(document.querySelector('#timer').textContent) < 60, null, { timeout: 7000 });
    } catch (error) {
      console.error('GKEET state while timer should run:', await page.evaluate(() => window.__gkeetDebug()), 'page errors:', pageErrors);
      throw error;
    }
    const after = Number(await page.locator('#timer').textContent());
    assert.ok(after < before, 'fight timer should run while playing');

    await page.locator('#pauseBtn').click();
    assert.ok(await page.locator('#overlay').evaluate(el => el.classList.contains('show')));
    const pausedAt = await page.locator('#timer').textContent();
    await page.waitForTimeout(1100);
    assert.equal(await page.locator('#timer').textContent(), pausedAt, 'timer must stop while paused');

    await page.getByRole('button', { name: 'RESUME' }).click();
    try {
      await page.waitForFunction((previous) => Number(document.querySelector('#timer').textContent) < Number(previous), pausedAt, { timeout: 7000 });
    } catch (error) {
      console.error('GKEET state after resume:', await page.evaluate(() => window.__gkeetDebug()));
      throw error;
    }
    assert.ok(Number(await page.locator('#timer').textContent()) < Number(pausedAt), 'timer should resume');

    await page.locator('#pauseBtn').click();
    await page.getByRole('button', { name: 'MENU' }).click();
    await page.locator('#levelsBtn').click();
    assert.equal(await page.locator('#levelGrid button').count(), 20, 'all 20 stage slots should render');

    assert.deepEqual(pageErrors, [], 'browser must not report uncaught JavaScript errors');
    console.log('GKEET smoke test passed: launch, two rigged 3D fighters, fight loop, pause/resume, and 20-stage menu.');
  } finally {
    await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
