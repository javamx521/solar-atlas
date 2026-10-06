import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import vm from 'node:vm';
const manifest=await readFile(new URL('../src/asset-manifest.js',import.meta.url),'utf8');
const versions=vm.runInNewContext(manifest+';ATLAS_ASSET_VERSIONS');
test('all image/data version hashes match their published file contents',async()=>{
 assert.ok(Object.keys(versions).length>=14);
 for(const [file,version] of Object.entries(versions)){
  const bytes=await readFile(new URL('../'+file,import.meta.url));
  assert.equal(createHash('sha256').update(bytes).digest('hex').slice(0,12),version,`${file}: run npm run version:assets`);
 }
});
test('body data, navigation thumbnails and WebGL maps share content-versioned URLs',async()=>{
 const atlas=await readFile(new URL('../src/atlas.js',import.meta.url),'utf8');
 const scene=await readFile(new URL('../src/scene.js',import.meta.url),'utf8');
 const fn=atlas.match(/^function assetURL\(path\)\{.*\}$/m)[0];
 const url=vm.runInNewContext(manifest+';'+fn+";assetURL('assets/earth.jpg')");
 assert.equal(url,'assets/earth.jpg?v='+versions['assets/earth.jpg']);
 assert.ok(atlas.includes("fetch(assetURL('data/bodies.json'))"));
 assert.ok(atlas.includes("assetURL('assets/'+body.tex)"));
 assert.ok(scene.includes('new THREE.TextureLoader().load(assetURL(path),'));
});
