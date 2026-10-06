import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const THREE = require('../vendor/three.min.js');
const sceneSource = readFileSync(new URL('../src/scene.js', import.meta.url), 'utf8');
const atlasSource = readFileSync(new URL('../src/atlas.js', import.meta.url), 'utf8');
const bodyDeclaration = atlasSource.match(/const bodies\s*=\s*\[[\s\S]*?\n\];/)[0];

function fixture(width, height, options = {}) {
  let drawerOpen = false;
  const listeners = new Map();
  const target = () => ({
    addEventListener(type, callback) { listeners.set(`${this.name || 'window'}:${type}`, callback); },
    removeEventListener() {}
  });
  const drawerWidth = width <= 760 ? width : width <= 1100 ? 360 : 400;
  const drawerHeight = width <= 760 ? height * .47 : height;
  const drawer = {
    classList: { contains: () => drawerOpen },
    getBoundingClientRect: () => ({ width: drawerWidth, height: drawerHeight, left: width - drawerWidth, top: height - drawerHeight })
  };
  const intro = { getBoundingClientRect: () => width <= 760
    ? { left: 22, right: 242, top: 155, bottom: 333, width: 220, height: 178 }
    : { left: 44, right: 324, top: height * .27, bottom: height * .27 + 310, width: 280, height: 310 } };
  const dock = { getBoundingClientRect: () => ({ top: height - 132, height: 132 }) };
  const canvas = { ...target(), name: 'canvas', style: {}, setPointerCapture() {}, hasPointerCapture: () => false,
    getBoundingClientRect: () => ({ left: 0, top: 0, width, height }) };
  const media = { ...target(), matches: !!options.reducedMotion };
  const document = { ...target(), name: 'document', hidden: false,
    querySelector: selector => ({ '#drawer': drawer, '.scene-intro': intro, '.planet-dock': dock })[selector] || null,
    querySelectorAll: () => [], dispatchEvent() {} };
  const context = { THREE, document, innerWidth: width, innerHeight: height, devicePixelRatio: 1.5,
    window: { ...target(), matchMedia: () => media }, matchMedia: () => media,
    navigator: {}, console, performance, setTimeout, clearTimeout,
    requestAnimationFrame: () => 1, cancelAnimationFrame() {},
    CustomEvent: class { constructor(type, init) { this.type = type; this.detail = init?.detail; } },
    MutationObserver: class { observe() {} disconnect() {} }, fakeCanvas: canvas };
  vm.createContext(context);
  vm.runInContext(`${bodyDeclaration}\nlet selectedBody=null,view='perspective',lang='zh',autoRotate=false;\nconst $=selector=>document.querySelector(selector),$$=()=>[];function toast(){}`, context);
  vm.runInContext(sceneSource, context);
  vm.runInContext(`
    camera=new THREE.PerspectiveCamera(44,innerWidth/innerHeight,.035,1100);
    renderer={domElement:fakeCanvas};
    meshes=bodies.map(body=>{const mesh=new THREE.Mesh(new THREE.SphereGeometry(body.r,8,6));mesh.userData=body;mesh.name=body.name;return mesh;});
    positionBodies();refreshSceneLayout(true);frameOverview();
  `, context);
  return { context, listeners, canvas, document, openDrawer: value => { drawerOpen = value; },
    run: code => vm.runInContext(code, context),
    settle: () => vm.runInContext('for(let step=0;step<240;step++)updateCamera(1/60);', context) };
}

function projectedBounds(f, selectedOnly = false) {
  return f.run(`(() => {
    const rect={...sceneState.safe};
    const right=new THREE.Vector3(1,0,0).applyQuaternion(camera.quaternion);
    const up=new THREE.Vector3(0,1,0).applyQuaternion(camera.quaternion);
    const objects=meshes.filter(m=>${selectedOnly ? 'm.userData===selectedBody' : 'true'}).map(mesh=>{
      const points=[];
      for(let sample=0;sample<32;sample++){
        const angle=sample/32*Math.PI*2;
        const point=mesh.position.clone().addScaledVector(right,Math.cos(angle)*bodyExtent(mesh.userData)).addScaledVector(up,Math.sin(angle)*bodyExtent(mesh.userData)).project(camera);
        points.push({x:(point.x*.5+.5)*innerWidth,y:(-point.y*.5+.5)*innerHeight,z:point.z});
      }
      return {name:mesh.name,points};
    });
    return {rect,objects};
  })()`);
}

for (const [width, height] of [[1440, 1000], [820, 900], [390, 844], [390, 667]]) {
  test(`overview camera frames all worlds at ${width}×${height}`, () => {
    const f = fixture(width, height); f.settle();
    const { rect, objects } = projectedBounds(f);
    assert.ok(rect.width >= 100 && rect.height >= 100);
    for (const { name, points } of objects) for (const p of points) {
      assert.ok(p.z > -1 && p.z < 1, `${name} must lie in the camera frustum`);
      assert.ok(p.x >= rect.left - .1 && p.x <= rect.right + .1, `${name} must fit horizontally (${p.x})`);
      assert.ok(p.y >= rect.top - .1 && p.y <= rect.bottom + .1, `${name} must fit vertically (${p.y})`);
    }
    if (width > 760) assert.ok(rect.left >= 324, 'The desktop hero stays clear');
  });
  test(`Earth and Saturn focus avoid dossier bounds at ${width}×${height}`, () => {
    const f = fixture(width, height); f.openDrawer(true);
    for (const name of ['地球', '土星']) {
      f.run(`focusBody(${JSON.stringify(name)},false);`); f.settle();
      const { rect, objects } = projectedBounds(f, true);
      assert.equal(objects.length, 1);
      for (const p of objects[0].points) {
        assert.ok(p.x >= rect.left && p.x <= rect.right, `${name} focus fits horizontally`);
        assert.ok(p.y >= rect.top && p.y <= rect.bottom, `${name} focus fits vertically`);
      }
      if (width <= 760) assert.ok(rect.bottom <= height * .53 - 50, 'Clear mobile bottom sheet and controls');
      else assert.ok(rect.right <= width - (width <= 1100 ? 360 : 400), 'Clear desktop dossier');
      const center = f.run('cam.target.clone().project(camera).toArray()');
      assert.ok(Math.abs((center[0] * .5 + .5) * width - (rect.left + rect.right) / 2) < .02);
      assert.ok(Math.abs((-center[1] * .5 + .5) * height - (rect.top + rect.bottom) / 2) < .02);
    }
  });
}

test('camera angle damping follows the short arc across the ±π boundary', () => {
  const f = fixture(1440, 1000);
  f.run('cam.theta=Math.PI-.05;cam.thetaGoal=-Math.PI+.05;updateCamera(1/60);');
  const angle = f.run('cam.theta');
  assert.ok(angle > Math.PI - .05 && angle < Math.PI + .05, 'Must move a short positive arc, not nearly a full turn');
});

test('camera damping is independent of frame rate', () => {
  const values = [30, 60, 120].map(rate => {
    const f = fixture(1440, 1000);
    f.run(`cam.radius=80;cam.radiusGoal=12;cam.theta=0;cam.thetaGoal=1;for(let i=0;i<${rate};i++)updateCamera(1/${rate});`);
    return f.run('({radius:cam.radius,theta:cam.theta})');
  });
  for (const value of values) {
    assert.ok(Math.abs(value.radius - values[0].radius) < 1e-9);
    assert.ok(Math.abs(value.theta - values[0].theta) < 1e-9);
  }
});

test('extreme wheel input cannot create a negative or non-finite radius', () => {
  const f = fixture(390, 844);
  f.run('zoomScene(1e100)'); assert.equal(f.run('cam.radiusGoal'), 600);
  f.run('zoomScene(1e-100)'); assert.equal(f.run('cam.radiusGoal'), 3);
  f.run('zoomScene(NaN);zoomScene(-2)'); assert.equal(f.run('cam.radiusGoal'), 3);
});

test('two-pointer pinch cancellation releases all gesture state', () => {
  const f = fixture(390, 844); f.run('raycaster=new THREE.Raycaster();pointer=new THREE.Vector2();setupPointer();');
  const event = (id, x, y) => ({ pointerId: id, pointerType: 'touch', clientX: x, clientY: y, preventDefault() {} });
  f.listeners.get('canvas:pointerdown')(event(1, 100, 200));
  f.listeners.get('canvas:pointerdown')(event(2, 200, 200));
  f.listeners.get('canvas:pointermove')(event(2, 300, 200));
  assert.equal(f.run('sceneState.gesture.kind'), 'pinch');
  f.listeners.get('canvas:pointercancel')(event(1, 100, 200));
  f.listeners.get('canvas:pointercancel')(event(2, 300, 200));
  assert.equal(f.run('sceneState.pointers.size'), 0);
  assert.equal(f.run('drag'), null);
  assert.equal(f.run('sceneState.gesture'), null);
});

test('reduced-motion camera transitions settle immediately and decoration stays off', () => {
  const f = fixture(390, 844, { reducedMotion: true });
  f.run('cam.radius=80;cam.radiusGoal=12;updateCamera(1/60);');
  assert.equal(f.run('cam.radius'), 12);
  assert.equal(f.run('sceneMotionEnabled()'), false);
});

test('scene module parses when Three.js is unavailable so the dossier fallback can load', () => {
  const context = { window: { matchMedia: () => ({ matches: false }) } };
  vm.createContext(context);
  assert.doesNotThrow(() => vm.runInContext(sceneSource, context));
  assert.equal(typeof context.window.AtlasScene.getDiagnostics, 'function');
});
