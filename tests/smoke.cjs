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
  const consoleWarnings = [];
  page.on('pageerror', error => pageErrors.push(error.message));
  page.on('console', message => { if (message.type() === 'warning' || message.type() === 'error') consoleWarnings.push(message.text()); });

  try {
    await page.goto(`http://127.0.0.1:${address.port}/`, { waitUntil: 'load' });
    await page.waitForSelector('#playBtn');
    await page.locator('#playBtn').click();
    await page.waitForFunction(() => document.querySelector('#game').classList.contains('active'));
    assert.equal(await page.locator('#stageLabel').textContent(), '01');
    try {
      await page.waitForFunction(() => window.__gkeetRigCount === 2 && window.__gkeetAnimationCount >= 18, null, { timeout: 20000 });
    } catch (error) {
      console.error('GKEET rig/animation load state:', await page.evaluate(() => window.__gkeetDebug()), 'console warnings:', consoleWarnings);
      throw error;
    }
    await page.screenshot({ path: '/tmp/gkeet-gameplay.png' });
    const kickButton = page.locator('[data-key="kick"]');
    await kickButton.dispatchEvent('pointerdown', { pointerId: 1, pointerType: 'touch', isPrimary: true });
    await page.waitForTimeout(180);
    await kickButton.dispatchEvent('pointerup', { pointerId: 1, pointerType: 'touch', isPrimary: true });
    await page.waitForFunction(() => (window.__gkeetKickCountByFighter?.[0] || 0) > 0, null, { timeout: 4000 });
    // Wait for the actual attack cooldown rather than relying on a fixed delay.
    await page.waitForFunction(() => window.__gkeetDebug().playerCool <= 0, null, { timeout: 5000 });
    await page.keyboard.down('j');
    await page.waitForTimeout(60);
    const punchState = await page.evaluate(() => window.__gkeetDebug());
    assert.equal(punchState.playerAttackKind, 'punch', 'keyboard punch should trigger the punch move');
    assert.ok(punchState.playerAttack > 0, 'punch animation should become active');
    await page.keyboard.up('j');

    await page.keyboard.down('h');
    await page.waitForTimeout(80);
    assert.equal((await page.evaluate(() => window.__gkeetDebug())).playerGuard, true, 'keyboard guard should activate');
    await page.keyboard.up('h');
    await page.waitForTimeout(80);
    assert.equal((await page.evaluate(() => window.__gkeetDebug())).playerGuard, false, 'keyboard guard should release');

    await page.keyboard.down('ArrowRight');
    await page.keyboard.up('ArrowRight');
    await page.waitForTimeout(90);
    await page.keyboard.down('ArrowRight');
    const dashState = await page.evaluate(() => window.__gkeetDebug());
    assert.ok(dashState.playerDashTimer > 0, 'double-tap movement should activate dash');
    await page.keyboard.up('ArrowRight');

    const before = Number(await page.locator('#timer').textContent());
    try { await page.waitForFunction(() => Number(document.querySelector('#timer').textContent) < 60, null, { timeout: 7000 }); } catch (error) { console.error('Classic timer state:', await page.evaluate(() => ({ timer: document.querySelector('#timer')?.textContent, debug: window.__gkeetDebug?.() })), 'browser errors:', pageErrors, 'console warnings:', consoleWarnings); throw error; }
    const after = Number(await page.locator('#timer').textContent());
    assert.ok(after < before, 'fight timer should run while playing');

    await page.locator('#pauseBtn').click();
    assert.ok(await page.locator('#overlay').evaluate(el => el.classList.contains('show')));
    const pausedAt = await page.locator('#timer').textContent();
    await page.waitForTimeout(1100);
    assert.equal(await page.locator('#timer').textContent(), pausedAt, 'timer must stop while paused');

    await page.getByRole('button', { name: 'RESUME' }).click();
    const resumedState = await page.evaluate(() => window.__gkeetDebug());
    assert.equal(resumedState.paused, false, 'resume must clear paused state');
    assert.equal(resumedState.over, false, 'resume must keep the round active');
    assert.equal(resumedState.loopActive, true, 'resume must leave the game loop scheduled');

    await page.locator('#pauseBtn').click();
    await page.getByRole('button', { name: 'MENU' }).click();
    await page.locator('#levelsBtn').click();
    assert.equal(await page.locator('#levelGrid button').count(), 20, 'all 20 stage slots should render');

    // Exercise the separate Battle Strike shooter mode as well as the classic fighter.
    await page.goto(`http://127.0.0.1:${address.port}/shooter.html?test=1`, { waitUntil: 'load' });
    await page.locator('#choose').click();
    await page.waitForFunction(() => document.querySelector('#maps').classList.contains('on'));
    assert.equal(await page.locator('#mapGrid button').count(), 20, 'all 20 Battle Strike zones should be listed');
    assert.ok(await page.locator('#mapGrid button').first().isEnabled(), 'first Battle Strike zone should be unlocked');
    await page.locator('#back').click();
    await page.locator('#quick').click();
    await page.waitForFunction(() => document.querySelector('#game').classList.contains('on'));
    assert.ok(await page.locator('#view').evaluate(el => el.width > 0 && el.height > 0), 'shooter canvas must be initialized');
    const weaponBefore = await page.locator('#weaponBtn').textContent();
    await page.locator('#weaponBtn').click();
    assert.notEqual(await page.locator('#weaponBtn').textContent(), weaponBefore, 'weapon switch must change the selected weapon');

    // Verify real-time movement, jump/landing physics, and firing consume ammunition.
    const initial = await page.evaluate(() => window.__gkeetShooterDebug());
    assert.ok(Math.abs(initial.y - (initial.ground - 4)) < 1, 'player should start standing on the ground');
    await page.keyboard.down('ArrowRight');
    await page.evaluate(() => window.__gkeetShooterTestStep(20));
    await page.keyboard.up('ArrowRight');
    const moved = await page.evaluate(() => window.__gkeetShooterDebug());
    assert.ok(moved.x > initial.x + 15, 'right input should move the player');
    await page.keyboard.down('ArrowUp');
    await page.evaluate(() => window.__gkeetShooterTestStep(6));
    await page.keyboard.up('ArrowUp');
    const airborne = await page.evaluate(() => window.__gkeetShooterDebug());
    assert.ok(airborne.y < airborne.ground - 20, 'jump input should lift the player');
    await page.evaluate(() => window.__gkeetShooterTestStep(100));
    const landed = await page.evaluate(() => window.__gkeetShooterDebug());
    assert.ok(Math.abs(landed.y - (landed.ground - 4)) < 1, 'player should land back on the ground');
    const ammoBefore = landed.ammo;
    await page.keyboard.down('j');
    await page.evaluate(() => window.__gkeetShooterTestStep(20));
    await page.keyboard.up('j');
    const fired = await page.evaluate(() => window.__gkeetShooterDebug());
    assert.ok(fired.ammo < ammoBefore, 'fire input should consume ammunition');

    await page.locator('#pause').click();
    assert.ok(await page.locator('#overlay').evaluate(el => el.classList.contains('on')), 'shooter pause overlay must open');
    await page.locator('#resume').click();
    assert.ok(!(await page.locator('#overlay').evaluate(el => el.classList.contains('on'))), 'shooter resume must close overlay');

    // Verify the mobile touch control path and the dedicated training mode.
    const touchStart = await page.evaluate(() => window.__gkeetShooterDebug().x);
    const rightPad = page.locator('[data-k="right"]');
    await rightPad.dispatchEvent('pointerdown', { pointerId: 7, pointerType: 'touch', isPrimary: true });
    await page.evaluate(() => window.__gkeetShooterTestStep(20));
    await rightPad.dispatchEvent('pointerup', { pointerId: 7, pointerType: 'touch', isPrimary: true });
    const touchMoved = await page.evaluate(() => window.__gkeetShooterDebug().x);
    assert.ok(touchMoved > touchStart + 10, 'mobile right touch control should move the player');

    await page.locator('#pause').click();
    await page.locator('#homeBtn').click();
    await page.locator('#training').click();
    const practice = await page.evaluate(() => window.__gkeetShooterDebug());
    assert.equal(practice.level, 1, 'training should start in zone one');
    assert.equal(practice.enemyCount, 2, 'training should spawn the reduced practice enemy set');
    assert.ok(await page.locator('#mapName').textContent().then(text => text.includes('WAVE 1/1')), 'training should use a single practice wave');

    await page.waitForTimeout(250);
    assert.deepEqual(pageErrors, [], 'browser must not report uncaught JavaScript errors');
    console.log('GKEET smoke test passed: classic fighter, 20-stage menus, Battle Strike movement/jump/landing/fire, touch controls, training, and pause/resume.');
  } finally {
    await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
