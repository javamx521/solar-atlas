// Optional Playwright smoke suite. Runtime and data checks need no npm dependencies.
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { access, mkdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { createServer } from './server.mjs';

const require = createRequire(import.meta.url);
let playwright;
for (const candidate of [process.env.PLAYWRIGHT_MODULE, 'playwright', '/opt/codex/runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs'].filter(Boolean)) {
  try { playwright = await import(candidate.startsWith('/') ? pathToFileURL(candidate).href : require.resolve(candidate)); break; } catch {}
}
if (!playwright) throw new Error('Optional browser tests require Playwright. Set PLAYWRIGHT_MODULE to an existing installation; npm run check has no external dependencies.');
let executablePath = process.env.CHROMIUM_PATH;
if (!executablePath) { try { await access('/usr/bin/chromium'); executablePath = '/usr/bin/chromium'; } catch {} }
const server = createServer();
server.listen(0, '127.0.0.1');
await once(server, 'listening');
const base = `http://127.0.0.1:${server.address().port}`;
const screenshots = process.env.SMOKE_ARTIFACT_DIR || path.join(os.tmpdir(), 'solar-atlas-smoke');
await mkdir(screenshots, { recursive: true });
let browser;

async function startPage({ mobile = false, noWebGL = false } = {}) {
  const context = await browser.newContext({ viewport: mobile ? { width: 390, height: 844 } : { width: 1440, height: 1000 }, deviceScaleFactor: 1, isMobile: mobile, hasTouch: mobile, reducedMotion: 'reduce' });
  const page = await context.newPage();
  page.setDefaultTimeout(10_000);
  const errors = [], missing = [], external = [], requests = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('response', response => { if (response.status() >= 400) missing.push(`${response.status()} ${response.url()}`); });
  await page.route('**/*', route => {
    const url = route.request().url();
    requests.push(url);
    if (url.startsWith(base) || url.startsWith('data:') || url.startsWith('blob:')) return route.continue();
    external.push(url);
    return route.abort();
  });
  if (noWebGL) await page.addInitScript(() => {
    const getContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (kind, ...args) { return /webgl/i.test(kind) ? null : getContext.call(this, kind, ...args); };
  });
  await page.goto(base, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => document.documentElement.dataset.ready === 'true' && document.querySelectorAll('#planetBar [data-body]').length === 10);
  const skip = page.locator('#skipIntro');
  if (await skip.isVisible()) await skip.click();
  await page.waitForFunction(() => { const loading = document.querySelector('#loading'); return !loading || loading.classList.contains('done') || getComputedStyle(loading).display === 'none'; });
  await page.waitForTimeout(700);
  if (await page.locator('#guide').isVisible()) await page.locator('#guideClose').click();
  return { page, context, errors, missing, external, requests };
}

async function assertClean(run, label) {
  assert.deepEqual(run.errors, [], `${label}: uncaught browser errors`);
  assert.deepEqual(run.missing, [], `${label}: missing local assets`);
  assert.deepEqual(run.external, [], `${label}: unexpected external runtime dependencies`);
  assert.equal(run.requests.some(url => /data\/(?:missions|aliases)\.json/.test(url)), false, `${label}: planet explorer must not fetch mission archives`);
  assert.equal(await run.page.locator('#yearRange, #replay, .timeline').count(), 0, `${label}: removed chronology returned`);
}

try {
  browser = await playwright.chromium.launch({ headless: true, executablePath, args: ['--no-sandbox', '--disable-dev-shm-usage', '--enable-unsafe-swiftshader', '--use-angle=swiftshader'] });
  const desktop = await startPage();
  const page = desktop.page;
  const names = await page.locator('#planetBar [data-body]').evaluateAll(buttons => buttons.map(button => button.dataset.body));
  for (const name of names) {
    await page.locator(`#planetBar [data-body="${name}"]`).click();
    await page.waitForFunction(() => document.querySelector('#drawer').classList.contains('open'));
    assert.ok((await page.locator('#drawerTitle').innerText()).includes(name), `${name} opens its own dossier`);
    assert.ok((await page.locator('#drawerBody').innerText()).length > 300, `${name} has content`);
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('#drawer').evaluate(element => element.classList.contains('open')), false);
  }
  await page.locator('#planetBar [data-body="地球"]').click();
  await page.locator('#langToggle').click();
  assert.equal(await page.locator('html').getAttribute('lang'), 'en');
  assert.match(await page.locator('#drawerTitle').innerText(), /EARTH/i);
  assert.match(await page.locator('#drawerBody').innerText(), /Earth|Radius|PHYSICAL/);
  await page.locator('#langToggle').click();
  await page.keyboard.press('Escape');
  await page.keyboard.press('/');
  await page.locator('#searchInput').fill('hx');
  await page.locator('#searchInput').press('ArrowDown');
  await page.locator('#searchInput').press('Enter');
  assert.match(await page.locator('#drawerTitle').innerText(), /火星|MARS/);
  await page.keyboard.press('Escape');
  await page.locator('#searchToggle').click();
  await page.locator('#searchInput').fill('neptune');
  assert.match(await page.locator('#results').innerText(), /海王星|NEPTUNE/i);
  await page.locator('#searchInput').fill('zzzz-no-such-planet');
  assert.equal(await page.locator('#results [data-result]').count(), 0);
  await page.keyboard.press('Escape');
  await page.locator('#searchInput').evaluate(input => input.blur());
  for (const view of ['side', 'perspective', 'live']) {
    await page.locator(`.seg[data-view="${view}"]`).click();
    assert.ok(await page.locator(`.seg[data-view="${view}"]`).evaluate(element => element.classList.contains('active')));
  }
  await page.keyboard.press('r');
  await page.locator('#helpToggle').click();
  assert.ok(await page.locator('#guide').evaluate(element => element.classList.contains('open')));
  await page.keyboard.press('Escape');
  assert.equal(await page.locator('#guide').evaluate(element => element.classList.contains('open')), false);
  const diagnostics = await page.evaluate(() => window.AtlasScene.getDiagnostics());
  assert.deepEqual(diagnostics.textureErrors, []);
  assert.equal(diagnostics.bodies, 10);
  assert.equal(diagnostics.texturesLoaded, 12);
  const rendered = await page.evaluate(() => typeof renderer !== 'undefined' && renderer && renderer.info.render.calls > 0);
  assert.ok(rendered, 'WebGL scene rendered');
  await page.screenshot({ path: path.join(screenshots, 'desktop.png') });
  await assertClean(desktop, 'desktop');
  await desktop.context.close();
  console.log('PASS desktop: 10 dossiers, bilingual switching, search, keyboard, views, rendering, local assets');

  const mobile = await startPage({ mobile: true });
  await mobile.page.locator('#planetBar [data-body="地球"]').click();
  assert.match(await mobile.page.locator('#drawerTitle').innerText(), /地球|EARTH/);
  await mobile.page.locator('#closeDrawer').click();
  await mobile.page.locator('#searchToggle').click();
  await mobile.page.locator('#searchInput').fill('mars');
  assert.match(await mobile.page.locator('#results').innerText(), /火星|MARS/i);
  await mobile.page.keyboard.press('Escape');
  assert.ok(await mobile.page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'No horizontal document overflow on mobile');
  await mobile.page.screenshot({ path: path.join(screenshots, 'mobile.png') });
  await assertClean(mobile, 'mobile');
  await mobile.context.close();
  console.log('PASS mobile: navigation, drawer, search, responsive width, local assets');

  const fallback = await startPage({ noWebGL: true });
  await fallback.page.locator('#planetBar [data-body="火星"]').click();
  assert.match(await fallback.page.locator('#drawerTitle').innerText(), /火星|MARS/);
  assert.ok((await fallback.page.locator('#drawerBody').innerText()).length > 300);
  await fallback.page.keyboard.press('Escape');
  await fallback.page.locator('#searchToggle').click();
  await fallback.page.locator('#searchInput').fill('venus');
  assert.match(await fallback.page.locator('#results').innerText(), /金星|VENUS/i);
  await fallback.page.screenshot({ path: path.join(screenshots, 'fallback.png') });
  await assertClean(fallback, 'no-WebGL fallback');
  await fallback.context.close();
  console.log('PASS no-WebGL: page remains navigable with dossiers and search');
  console.log(`Screenshots: ${screenshots}`);
} finally {
  if (browser) await browser.close();
  await new Promise(resolve => server.close(resolve));
}
