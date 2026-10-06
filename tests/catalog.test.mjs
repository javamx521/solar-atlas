import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { root } from './server.mjs';

const readJSON = async file => JSON.parse(await readFile(path.join(root, 'data', file), 'utf8'));
const bodyIds = ['sun', 'mercury', 'venus', 'earth', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune', 'pluto'];
const validDate = value => /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
const nonempty = (value, label) => assert.ok(typeof value === 'string' && value.trim(), label);

test('all ten navigable bodies have complete bilingual dossiers', async () => {
  const bodies = await readJSON('bodies.json');
  assert.deepEqual(bodies.map(body => body.id), bodyIds);
  assert.equal(new Set(bodies.map(body => body.id)).size, bodies.length);
  for (const body of bodies) {
    for (const key of ['name_zh', 'name_en', 'surface_pressure', 'summary_zh', 'summary_en']) nonempty(body[key], `${body.id}.${key}`);
    assert.match(body.source_url, /^https:\/\/science\.nasa\.gov\//, `${body.id} official source URL`);
    assert.ok(Number.isFinite(Number(body.au)) && Number(body.au) >= 0, `${body.id}.au`);
    assert.ok(body.params.length >= 5, `${body.id} needs physical parameters`);
    for (const parameter of body.params) for (const key of ['k_zh', 'k_en', 'v']) nonempty(parameter[key], `${body.id}.params.${key}`);
    assert.ok(body.articles.length >= 1, `${body.id} needs articles`);
    for (const article of body.articles) for (const key of ['title_zh', 'title_en', 'body_zh', 'body_en']) nonempty(article[key], `${body.id}.articles.${key}`);
    assert.ok(body.sources.length >= 1, `${body.id} needs provenance`);
    for (const gas of body.atmosphere) {
      assert.ok(Number.isFinite(Number(gas.pct)) && Number(gas.pct) >= 0 && Number(gas.pct) <= 100, `${body.id} invalid atmosphere percentage`);
      nonempty(gas.name_zh, `${body.id} gas name`);
      nonempty(gas.name_en, `${body.id} gas name`);
    }
    for (const feature of body.landmarks) {
      for (const key of ['name_zh', 'name_en', 'desc_zh', 'desc_en']) nonempty(feature[key], `${body.id}.landmarks.${key}`);
      if (feature.lat != null) assert.ok(Math.abs(Number(feature.lat)) <= 90, `${body.id} latitude`);
      if (feature.lon != null) assert.ok(Math.abs(Number(feature.lon)) <= 360, `${body.id} longitude`);
    }
  }
});

test('archival mission JSON has stable IDs and chronological dates', async () => {
  const missions = await readJSON('missions.json');
  const ids = new Set();
  let previous = '';
  for (const mission of missions) {
    assert.match(mission.id, /^[a-z0-9]+(?:-[a-z0-9]+)*$/);
    assert.ok(!ids.has(mission.id), `Duplicate ID: ${mission.id}`);
    ids.add(mission.id);
    assert.ok(validDate(mission.launch_date), `${mission.id} launch date`);
    assert.ok(mission.launch_date >= previous, `${mission.id} out of chronological order`);
    previous = mission.launch_date;
    assert.equal(typeof mission.active, 'boolean');
    if (mission.end_date != null) {
      assert.ok(validDate(mission.end_date), `${mission.id} end date`);
      assert.ok(mission.end_date >= mission.launch_date, `${mission.id} ends before launch`);
      assert.equal(mission.active, false, `${mission.id} cannot be active with a known end date`);
    }
    for (const key of ['name_zh', 'name_en', 'summary_zh', 'summary_en', 'source']) nonempty(mission[key], `${mission.id}.${key}`);
  }
  const aliases = await readJSON('aliases.json');
  for (const id of Object.keys(aliases)) assert.ok(ids.has(id), `Orphan search alias: ${id}`);
});

test('planet texture files are present and nonempty', async () => {
  const entries = await readdir(path.join(root, 'assets'));
  for (const body of bodyIds.filter(id => id !== 'pluto')) {
    const filename = entries.find(entry => entry === `${body}.jpg` || entry === `${body}.webp`);
    assert.ok(filename, `Missing local texture for ${body}`);
    assert.ok((await stat(path.join(root, 'assets', filename))).size > 100, `Empty texture: ${filename}`);
  }
});

test('solar dossier explicitly rejects unsafe viewing methods', async () => {
  const sun = (await readJSON('bodies.json')).find(body => body.id === 'sun');
  assert.ok(sun.articles.some(article => article.body_zh.includes('烟熏玻璃和普通太阳镜不能安全观日')));
  assert.ok(sun.articles.some(article => article.body_en.includes('Smoked glass and ordinary sunglasses are unsafe')));
});

test('English physical values have explicit translations for Chinese units and names', async () => {
  const bodies = await readJSON('bodies.json');
  for (const body of bodies) for (const parameter of body.params) {
    const english = parameter.v_en ?? parameter.v;
    assert.ok(!/\p{Script=Han}/u.test(english), `${body.id}.${parameter.k_en} needs v_en: ${english}`);
  }
  const sun = bodies.find(body => body.id === 'sun');
  assert.equal(sun.params.find(parameter => parameter.k_en === 'Age').v_en, '~4.6 billion years');
  const venus = bodies.find(body => body.id === 'venus');
  assert.match(venus.params.find(parameter => parameter.k_en === 'Rotation period').v_en, /retrograde/);
  const pluto = bodies.find(body => body.id === 'pluto');
  assert.equal(pluto.params.find(parameter => parameter.k_en === 'Discovery').v_en, '1930, Clyde Tombaugh');
});
