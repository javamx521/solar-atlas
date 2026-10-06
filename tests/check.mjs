import { readdir, readFile, stat } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import assert from 'node:assert/strict';
import { root } from './server.mjs';

for (const dir of ['src', 'tests']) {
  for (const entry of await readdir(path.join(root, dir))) {
    if (!/\.(?:m?js)$/.test(entry)) continue;
    const file = path.join(root, dir, entry);
    const result = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
  }
}
const html = await readFile(path.join(root, 'index.html'), 'utf8');
const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]);
assert.equal(new Set(ids).size, ids.length, 'Duplicate HTML IDs');
for (const match of html.matchAll(/(?:src|href)="([^"]+)"/g)) {
  if (/^(?:https?:|data:|#)/.test(match[1])) continue;
  assert.ok((await stat(path.join(root, match[1]))).isFile(), `Missing HTML asset: ${match[1]}`);
}
for (const entry of await readdir(path.join(root, 'data'))) {
  if (entry.endsWith('.json')) JSON.parse(await readFile(path.join(root, 'data', entry), 'utf8'));
}
console.log('Syntax, static HTML references, unique HTML IDs, and JSON parsing passed.');
