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
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--disable-background-timer-throttling', '--disable-renderer-backgrounding'] });
  const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(error.message));
  try {
    await page.goto('http://127.0.0.1:' + address.port + '/?test=1', { waitUntil: 'load' });
    await page.waitForURL('**/shooter.html');
    await page.locator('#choose').click();
    await page.waitForFunction(() => document.querySelector('#maps').classList.contains('on'));
    assert.equal(await page.locator('#mapGrid button').count(), 20, 'all 20 Battle Strike zones should be listed');
    assert.ok(await page.locator('#mapGrid button').first().isEnabled(), 'first zone should be unlocked');
    await page.locator('#back').click();
    await page.locator('#quick').click();
    await page.waitForFunction(() => document.querySelector('#game').classList.contains('on'));
    assert.ok(await page.locator('#view').evaluate(el => el.width > 0 && el.height > 0), 'game canvas should initialize');
    const initial = await page.evaluate(() => window.__gkeetShooterDebug());
    assert.ok(Math.abs(initial.y - (initial.ground - 4)) < 1, 'player should start on the ground');
    await page.keyboard.down('ArrowRight');
    await page.evaluate(() => window.__gkeetShooterTestStep(20));
    await page.keyboard.up('ArrowRight');
    const moved = await page.evaluate(() => window.__gkeetShooterDebug());
    assert.ok(moved.x > initial.x + 15, 'right input should move the player');
    await page.keyboard.down('ArrowUp');
    await page.evaluate(() => window.__gkeetShooterTestStep(6));
    await page.keyboard.up('ArrowUp');
    const airborne = await page.evaluate(() => window.__gkeetShooterDebug());
    assert.ok(airborne.y < airborne.ground - 20, 'jump should lift the player');
    await page.evaluate(() => window.__gkeetShooterTestStep(100));
    const landed = await page.evaluate(() => window.__gkeetShooterDebug());
    assert.ok(Math.abs(landed.y - (landed.ground - 4)) < 1, 'player should land');
    const ammoBefore = landed.ammo;
    await page.keyboard.down('j');
    await page.evaluate(() => window.__gkeetShooterTestStep(20));
    await page.keyboard.up('j');
    assert.ok((await page.evaluate(() => window.__gkeetShooterDebug())).ammo < ammoBefore, 'firing should consume ammunition');
    const weaponBefore = await page.locator('#weaponBtn').textContent();
    await page.locator('#weaponBtn').click();
    assert.notEqual(await page.locator('#weaponBtn').textContent(), weaponBefore, 'weapon switch should change weapon');
    await page.locator('#pause').click();
    assert.ok(await page.locator('#overlay').evaluate(el => el.classList.contains('on')), 'pause overlay should open');
    await page.locator('#resume').click();
    assert.ok(!(await page.locator('#overlay').evaluate(el => el.classList.contains('on'))), 'resume should close overlay');
    await page.locator('#pause').click();
    await page.locator('#homeBtn').click();
    await page.locator('#training').click();
    const practice = await page.evaluate(() => window.__gkeetShooterDebug());
    assert.equal(practice.level, 1, 'training should start in zone one');
    assert.equal(practice.enemyCount, 2, 'training should spawn two practice enemies');
    assert.ok((await page.locator('#mapName').textContent()).includes('WAVE 1/1'), 'training should use one wave');
    assert.deepEqual(pageErrors, [], 'browser should have no uncaught JavaScript errors');
    console.log('GKEET smoke test passed: Battle Strike launch, zones, movement, jumping, landing, shooting, weapons, training, and pause/resume.');
  } finally {
    await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
