// Function-level tests run the real UI controller with small deterministic DOM stubs.
// They do not substitute for a rendered-browser or WebGL visual audit.
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { root } from './server.mjs';

const source = await readFile(path.join(root, 'src/atlas.js'), 'utf8');
const dossierData = JSON.parse(await readFile(path.join(root, 'data/bodies.json'), 'utf8'));

function createHarness({ data = dossierData, ok = true } = {}) {
  const elements = new Map(), requests = [], storage = new Map(), listeners = new Map();
  let document;
  const createElement = selector => {
    const classes = new Set(), attributes = new Map();
    const element = {
      id: selector.replace(/^#/, ''), value: '', textContent: '', innerHTML: '', hidden: ['#guide', '#searchOverlay', '#fallback'].includes(selector),
      inert: false, isConnected: true, style: {}, dataset: {}, disabled: false,
      classList: {
        add: (...values) => values.forEach(value => classes.add(value)),
        remove: (...values) => values.forEach(value => classes.delete(value)),
        contains: value => classes.has(value),
        toggle(value, force = !classes.has(value)) { if (force) classes.add(value); else classes.delete(value); return force; }
      },
      setAttribute: (key, value) => attributes.set(key, String(value)),
      getAttribute: key => attributes.get(key) ?? null,
      removeAttribute: key => attributes.delete(key),
      focus() { document.activeElement = element; },
      scrollIntoView() {},
      matches: query => selector === '#searchInput' && query.includes('input'),
      closest: () => null,
      querySelectorAll: () => [],
      addEventListener(name, callback) { element[`on${name}`] = callback; }
    };
    return element;
  };
  const get = selector => { if (!elements.has(selector)) elements.set(selector, createElement(selector)); return elements.get(selector); };
  const segments = ['perspective', 'side', 'live'].map(view => { const element = createElement(view); element.dataset.view = view; return element; });
  document = {
    activeElement: null, documentElement: { lang: 'zh-CN', dataset: {} }, body: get('body'),
    querySelector: get,
    querySelectorAll: selector => selector === '.seg' ? segments : [],
    addEventListener(name, callback) { listeners.set(name, [...listeners.get(name) || [], callback]); }
  };
  document.activeElement = get('#spaceCanvas');
  const location = { pathname: '/', search: '', hash: '' };
  const sandbox = {
    document, location, URL, console, Map, Set,
    window: { matchMedia: () => ({ matches: false }), AtlasScene: { requestRender() {}, resize() {} } },
    localStorage: { getItem: key => storage.get(key), setItem: (key, value) => storage.set(key, value) },
    matchMedia: () => ({ matches: false }),
    requestAnimationFrame: callback => { callback(); return 1; },
    setTimeout: () => 1, clearTimeout() {}, addEventListener() {},
    history: { pushState(_state, _unused, url) { location.hash = new URL(url, 'https://example.invalid').hash; } },
    fetch: async url => { requests.push(url); return { ok, status: ok ? 200 : 503, json: async () => structuredClone(data) }; }
  };
  const context = vm.createContext(sandbox);
  vm.runInContext(`${source}\n;globalThis.testAPI={bodies,bodyIds,bodyPinyin,esc,bodyType,displayName,translatedValue,loadPhase2,navigateBody,closeDrawer,changeView,resetExplorer,readRoute,setLanguage,search,searchKeys,openSearch,closeSearch,openGuide,closeGuide,dossierPanel,initUI,getDossiers:()=>dossiers,getSelected:()=>selectedBody,getSearchItems:()=>searchItems,getSearchCursor:()=>searchCursor,getView:()=>view,getLanguage:()=>lang};`, context);
  return { api: context.testAPI, context, document, get, requests, storage, segments, location, listeners };
}

test('controller loads only body dossiers and rejects invalid or unavailable data', async () => {
  const harness = createHarness();
  await harness.api.loadPhase2();
  assert.deepEqual(harness.requests, ['data/bodies.json']);
  assert.equal(harness.api.getDossiers().length, 10);
  assert.equal(harness.api.bodies.length, 10);
  for (const body of harness.api.bodies) assert.ok(dossierData.some(dossier => dossier.id === harness.api.bodyIds[body.name]));
  await assert.rejects(createHarness({ ok: false }).api.loadPhase2(), /503/);
  await assert.rejects(createHarness({ data: {} }).api.loadPhase2(), /Invalid dossier/);
});

test('all ten dossiers can be navigated and dismissed without WebGL', async () => {
  const { api, get, location } = createHarness();
  await api.loadPhase2();
  for (const body of api.bodies) {
    api.navigateBody(body.name);
    assert.equal(api.getSelected().name, body.name);
    assert.equal(location.hash, `#${api.bodyIds[body.name]}`);
    assert.ok(get('#drawer').classList.contains('open'));
    assert.equal(get('#drawer').getAttribute('aria-hidden'), 'false');
    assert.ok(get('#drawerTitle').innerHTML.includes(body.name));
    assert.ok(get('#drawerBody').innerHTML.length > 500);
    api.closeDrawer();
    assert.equal(api.getSelected(), null);
    assert.equal(get('#drawer').inert, true);
    assert.equal(location.hash, '');
  }
});

test('search handles Chinese, English, pinyin, initials, blank and unmatched queries', () => {
  const { api, get } = createHarness();
  for (const [query, expected] of [['火星', '火星'], ['MARS', '火星'], ['huoxing', '火星'], ['hx', '火星'], ['hwx', '海王星'], ['Pluto', '冥王星']]) {
    get('#searchInput').value = query;
    api.search();
    assert.equal(api.getSearchItems().length, 1, query);
    assert.equal(api.getSearchItems()[0].name, expected, query);
  }
  get('#searchInput').value = 'unmatched-world'; api.search();
  assert.equal(api.getSearchItems().length, 0);
  assert.match(get('#results').innerHTML, /no-results/);
  get('#searchInput').value = ''; api.search();
  assert.equal(api.getSearchItems().length, 10);
  api.searchKeys({ key: 'ArrowUp', preventDefault() {} });
  assert.equal(api.getSearchCursor(), 9, 'up wraps from first to last');
  api.searchKeys({ key: 'ArrowDown', preventDefault() {} });
  assert.equal(api.getSearchCursor(), 0, 'down wraps back to first');
});

test('language switching preserves selected dossier and exposes official source links', async () => {
  const { api, get, document } = createHarness();
  await api.loadPhase2(); api.navigateBody('地球'); api.setLanguage('en');
  assert.equal(document.documentElement.lang, 'en');
  assert.equal(api.getSelected().name, '地球');
  assert.match(get('#drawerTitle').innerHTML, /Earth/);
  assert.match(get('#drawerBody').innerHTML, /Earth has vast liquid-water oceans/);
  assert.match(get('#drawerBody').innerHTML, /https:\/\/science.nasa.gov\/earth\/facts\//);
  api.setLanguage('zh');
  assert.equal(document.documentElement.lang, 'zh-CN');
  assert.match(get('#drawerBody').innerHTML, /地球拥有广阔的液态水海洋/);
});

test('view modes, deep links, reset and modal dismissal keep state consistent', async () => {
  const { api, get, location, segments } = createHarness();
  await api.loadPhase2();
  location.hash = '#neptune'; api.readRoute();
  assert.equal(api.getSelected().name, '海王星');
  for (const view of ['side', 'live', 'perspective']) {
    api.changeView(view);
    assert.equal(api.getView(), view);
    assert.equal(segments.filter(segment => segment.classList.contains('active')).length, 1);
    assert.equal(api.getSelected(), null);
  }
  api.navigateBody('地球'); api.resetExplorer();
  assert.equal(api.getSelected(), null);
  api.openSearch(); assert.equal(get('#searchOverlay').hidden, false);
  api.openGuide(); assert.equal(get('#searchOverlay').hidden, true); assert.equal(get('#guide').hidden, false);
  api.closeGuide(); assert.equal(get('#guide').hidden, true);
});

test('HTML generation escapes imported text and rejects non-NASA source links', () => {
  const { api } = createHarness();
  assert.equal(api.esc('<img onerror="x">'), '&lt;img onerror=&quot;x&quot;&gt;');
  const malicious = structuredClone(dossierData[0]);
  malicious.summary_zh = '<script>alert(1)</script>';
  malicious.source_url = 'javascript:alert(1)';
  const output = api.dossierPanel(malicious);
  assert.ok(!output.includes('<script>'));
  assert.ok(!output.includes('javascript:'));
  assert.ok(output.includes('&lt;script&gt;'));
});

test('keyboard Escape closes the active modal or dossier; R resets outside input', async () => {
  const { api, get, listeners } = createHarness();
  await api.loadPhase2(); api.initUI();
  const key = value => { for (const listener of listeners.get('keydown')) listener({ key: value, target: get('#spaceCanvas'), preventDefault() {} }); };
  api.openSearch(); key('Escape'); assert.equal(get('#searchOverlay').hidden, true);
  api.openGuide(); key('Escape'); assert.equal(get('#guide').hidden, true);
  api.navigateBody('木星'); key('Escape'); assert.equal(api.getSelected(), null);
  api.navigateBody('土星'); key('r'); assert.equal(api.getSelected(), null);
});


test('full boot handles a missing Three.js library without breaking body navigation', async () => {
  const harness = createHarness();
  harness.context.console = { ...console, warn() {} };
  vm.runInContext(await readFile(path.join(root, 'src/scene.js'), 'utf8'), harness.context);
  const bootSource = await readFile(path.join(root, 'src/boot.js'), 'utf8');
  vm.runInContext(bootSource.replace('boot().catch(', 'globalThis.bootPromise=boot().catch('), harness.context);
  await harness.context.bootPromise;
  assert.equal(harness.document.documentElement.dataset.ready, 'true');
  assert.equal(harness.get('#fallback').hidden, false);
  assert.equal(harness.get('#zoomIn').disabled, true);
  assert.equal(harness.get('#spaceCanvas').getAttribute('aria-hidden'), 'true');
  harness.api.navigateBody('火星');
  assert.equal(harness.api.getSelected().name, '火星');
  assert.match(harness.get('#drawerBody').innerHTML, /火星是一颗寒冷/);
});

test('planet-only page has no mission chronology or mission data loading', async () => {
  const html = await readFile(path.join(root, 'index.html'), 'utf8');
  assert.ok(!/id=["'](?:yearRange|replay|track|statAll|orbitCount)["']/.test(html));
  assert.ok(!/data\/(?:missions|aliases)\.json/.test(source));
  assert.match(html, /id="searchOverlay"[^>]*hidden/);
  assert.match(html, /id="guide"[^>]*hidden/);
  assert.match(html, /id="fallback"[^>]*hidden/);
});

test('literal DOM ID selectors in controller and boot exist in the page', async () => {
  const html = await readFile(path.join(root, 'index.html'), 'utf8');
  const ids = new Set([...html.matchAll(/\bid=["']([^"']+)["']/g)].map(match => match[1]));
  for (const file of ['src/atlas.js', 'src/boot.js']) {
    const javascript = await readFile(path.join(root, file), 'utf8');
    const references = new Set([...javascript.matchAll(/\$\(\s*['"]#([A-Za-z][\w:-]*)/g)].map(match => match[1]));
    for (const id of references) assert.ok(ids.has(id), `${file} refers to missing HTML ID #${id}`);
  }
});
