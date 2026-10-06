import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createServer } from './server.mjs';

test('development server serves public files and does not expose repository internals', async t => {
  const server = createServer();
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => new Promise(resolve => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}`;
  const index = await fetch(base);
  assert.equal(index.status, 200);
  assert.match(index.headers.get('content-type'), /text\/html/);
  assert.match(await index.text(), /spaceCanvas/);
  const data = await fetch(`${base}/data/bodies.json`);
  assert.equal(data.status, 200);
  assert.equal((await data.json()).length, 10);
  for (const url of ['/.git/config', '/package.json', '/tests/server.mjs', '/assets/missing.jpg', '/assets/%2e%2e/%2e%2e/etc/passwd']) {
    const response = await fetch(base + url);
    assert.equal(response.status, 404, url);
    await response.text();
  }
  assert.equal((await fetch(base, { method: 'POST' })).status, 405);
  const head = await fetch(base, { method: 'HEAD' });
  assert.equal(head.status, 200);
  assert.equal(await head.text(), '');
});
