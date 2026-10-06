'use strict';
/* Solar Atlas — local-first renderer. Planet imagery: assets/ATTRIBUTION.md. */
let scene, camera, renderer, group, raycaster, pointer;
let meshes = [], labels = [], orbitLines = [], moonSystems = [], atmospheres = [];
let humanLayer, naturalLayer, layerMode = 0, hovered = null, drag = null;
let starField, sunSurface, sunHalos = [], cloudShell;
const sceneHasThree = typeof THREE !== 'undefined';
const cam = {theta: .62, phi: .66, thetaGoal: .62, phiGoal: .66, radius: 92, radiusGoal: 92, fovGoal: 44,
  offsetX:0,offsetY:0,offsetXGoal:0,offsetYGoal:0,
  target: sceneHasThree ? new THREE.Vector3() : null, goal: sceneHasThree ? new THREE.Vector3() : null};
const sceneState = {
  ready: false, disposed: false, lost: false, frame: 0, timer: 0, lastTime: 0,
  elapsed: 0, lastLayout: 0, lastLabels: 0, lastRender: 0, quality: 'auto', tier: 2,
  textureLoads: [], texturesLoaded: 0, textureErrors: [], performanceMs: 16.7,
  slowSeconds: 0, layoutKey: '', safe: null, cleanup: [], textures: new Set(),
  bodyStates: [], pickTargets: [], pointers: new Map(), gesture: null, moonTexture: null,
  reducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  motionOverride: null, viewportWidth: 0, viewportHeight: 0
};
const sceneClamp = (v, a, b) => Math.max(a, Math.min(b, v));
const sceneVec = sceneHasThree ? new THREE.Vector3() : null, sceneVec2 = sceneHasThree ? new THREE.Vector3() : null;
const sceneUp = sceneHasThree ? new THREE.Vector3(0, 1, 0) : null;
function sceneListen(target, name, fn, options) {
  target.addEventListener(name, fn, options);
  sceneState.cleanup.push(() => target.removeEventListener(name, fn, options));
}
function sceneTexture(canvas, color = true) {
  const texture = new THREE.CanvasTexture(canvas);
  if (color) texture.encoding = THREE.sRGBEncoding;
  texture.anisotropy = renderer ? Math.min(8, renderer.capabilities.getMaxAnisotropy()) : 1;
  sceneState.textures.add(texture);
  return texture;
}
function seededRandom(seed) {
  return () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
}
/* A deterministic textured fallback is visible immediately, even offline or after an asset error. */
function fallbackTexture(body, index) {
  const canvas = document.createElement('canvas'); canvas.width = 512; canvas.height = 256;
  const ctx = canvas.getContext('2d'), random = seededRandom(971 + index * 7919);
  ctx.fillStyle = body.color; ctx.fillRect(0, 0, 512, 256);
  if (index === 3) {
    ctx.fillStyle = '#163f6d'; ctx.fillRect(0, 0, 512, 256);
    ctx.fillStyle = '#557757';
    // Stylized fallback only; the locally bundled day map supplies the real geography.
    [[.18,.3,.13,.2],[.26,.57,.065,.28],[.48,.4,.085,.22],[.66,.29,.2,.13],[.83,.73,.09,.07]].forEach(p => {
      ctx.beginPath();ctx.ellipse(p[0]*512,p[1]*256,p[2]*512,p[3]*256,.3,0,Math.PI*2);ctx.fill();
    });
    ctx.fillStyle = '#d2e3df';ctx.fillRect(0,0,512,10);ctx.fillRect(0,244,512,12);
  }
  for (let y = 0; y < 256; y++) {
    const gas = index >= 5 && index <= 8;
    const band = gas ? Math.sin(y * .27 + Math.sin(y * .071) * 4) : 0;
    ctx.fillStyle = band > 0 ? `rgba(255,240,218,${Math.abs(band)*.2})` : `rgba(30,20,18,${Math.abs(band)*.18})`;
    ctx.fillRect(0,y,512,1);
  }
  for (let i = 0; i < 3800; i++) {
    const alpha = random() * (index >= 5 ? .07 : .15);
    ctx.fillStyle = i % 2 ? `rgba(255,241,215,${alpha})` : `rgba(12,13,21,${alpha})`;
    const x = random()*512, y = random()*256, r = .5 + random() * (index >= 5 ? 8 : 3);
    ctx.beginPath();ctx.ellipse(x,y,r,index>=5?r*.15:r,0,0,Math.PI*2);ctx.fill();
  }
  return sceneTexture(canvas);
}
function loadSceneTexture(path, apply, color = true) {
  const promise = new Promise(resolve => {
    let settled=false;
    const finish=value=>{if(settled)return;settled=true;clearTimeout(timeout);resolve(value);};
    const fail=()=>{
      if(!sceneState.textureErrors.includes(path))sceneState.textureErrors.push(path);
      console.warn('Solar Atlas: using a generated texture for',path);
      requestSceneRender();finish(false);
    };
    // No image request can strand the loading screen. A late image may still upgrade the fallback.
    const timeout=setTimeout(fail,8000);
    sceneState.cleanup.push(()=>{clearTimeout(timeout);finish(false);});
    new THREE.TextureLoader().load(path,texture=>{
      if(sceneState.disposed){texture.dispose();finish(false);return;}
      if(color)texture.encoding=THREE.sRGBEncoding;
      texture.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());
      sceneState.textures.add(texture);apply(texture);sceneState.texturesLoaded++;
      sceneState.textureErrors=sceneState.textureErrors.filter(file=>file!==path);
      requestSceneRender();finish(true);
    },undefined,fail);
  });
  sceneState.textureLoads.push(promise);return promise;
}
function glowTexture() {
  const canvas=document.createElement('canvas');canvas.width=canvas.height=128;
  const ctx=canvas.getContext('2d'),g=ctx.createRadialGradient(64,64,0,64,64,64);
  g.addColorStop(0,'rgba(255,233,182,1)');g.addColorStop(.28,'rgba(255,166,54,.5)');
  g.addColorStop(.55,'rgba(255,101,18,.10)');g.addColorStop(1,'rgba(255,90,0,0)');
  ctx.fillStyle=g;ctx.fillRect(0,0,128,128);return sceneTexture(canvas);
}
function atmosphereMaterial(color, power, opacity) {
  return new THREE.ShaderMaterial({uniforms:{color:{value:new THREE.Color(color)},power:{value:power},opacity:{value:opacity}},
    vertexShader:'varying vec3 worldNormal;varying vec3 worldPosition;void main(){vec4 p=modelMatrix*vec4(position,1.);worldPosition=p.xyz;worldNormal=normalize(mat3(modelMatrix)*normal);gl_Position=projectionMatrix*viewMatrix*p;}',
    fragmentShader:'uniform vec3 color;uniform float power;uniform float opacity;varying vec3 worldNormal;varying vec3 worldPosition;void main(){vec3 n=normalize(worldNormal);vec3 v=normalize(cameraPosition-worldPosition);float rim=pow(1.-abs(dot(n,v)),power);float day=.22+.78*max(0.,dot(n,normalize(-worldPosition)));gl_FragColor=vec4(color,rim*opacity*day);}',
    side:THREE.BackSide,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending});
}
function sunMaterial(texture) {
  return new THREE.ShaderMaterial({uniforms:{map:{value:texture},t:{value:0}},
    vertexShader:'varying vec2 vTex;varying vec3 vNormalWorld;varying vec3 vWorld;void main(){vTex=uv;vNormalWorld=normalize(mat3(modelMatrix)*normal);vec4 p=modelMatrix*vec4(position,1.);vWorld=p.xyz;gl_Position=projectionMatrix*viewMatrix*p;}',
    fragmentShader:'uniform sampler2D map;uniform float t;varying vec2 vTex;varying vec3 vNormalWorld;varying vec3 vWorld;void main(){vec2 uv=vec2(fract(vTex.x+t*.001),vTex.y);vec3 tex=texture2D(map,uv).rgb;float limb=.68+.32*max(0.,dot(normalize(vNormalWorld),normalize(cameraPosition-vWorld)));gl_FragColor=vec4(tex*vec3(1.25,1.13,.92)*limb+vec3(.055,.018,0.),1.);}',toneMapped:false});
}
function ringTexture() {
  const canvas=document.createElement('canvas');canvas.width=1024;canvas.height=4;
  const ctx=canvas.getContext('2d'),random=seededRandom(1980);
  for(let x=0;x<1024;x++) {
    const r=x/1023, gap=r>.49&&r<.54;
    const alpha=gap?.025:(.48+.32*Math.sin(r*51)**2+.18*random())*Math.min(1,r*26,(1-r)*35);
    const bright=.72+.22*Math.sin(r*73)**2;
    ctx.fillStyle=`rgba(${Math.round(224*bright)},${Math.round(204*bright)},${Math.round(165*bright)},${alpha})`;ctx.fillRect(x,0,1,4);
  }
  return sceneTexture(canvas);
}
function addPlanetRing(mesh, inner, outer, texture, opacity) {
  const geometry=new THREE.RingGeometry(inner,outer,160,2),uv=geometry.attributes.uv,pos=geometry.attributes.position;
  for(let i=0;i<pos.count;i++) uv.setXY(i,(Math.hypot(pos.getX(i),pos.getY(i))-inner)/(outer-inner),.5);
  const material=new THREE.MeshStandardMaterial({map:texture,side:THREE.DoubleSide,transparent:true,opacity,depthWrite:false,roughness:1,color:0xfff1d0});
  // Analytic planet shadow avoids a costly omnidirectional 6-face shadow map.
  material.onBeforeCompile=shader=>{
    shader.uniforms.planetCenter={value:mesh.position};shader.uniforms.planetRadius={value:mesh.userData.r};
    shader.vertexShader='varying vec3 ringWorld;\n'+shader.vertexShader;
    shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nringWorld=(modelMatrix*vec4(position,1.)).xyz;');
    shader.fragmentShader='varying vec3 ringWorld;uniform vec3 planetCenter;uniform float planetRadius;\n'+shader.fragmentShader;
    shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>','#include <color_fragment>\nvec3 lightRay=normalize(-ringWorld);float along=dot(planetCenter-ringWorld,lightRay);float distanceToRay=length(ringWorld+along*lightRay-planetCenter);float shadow=(1.-smoothstep(planetRadius*.92,planetRadius*1.04,distanceToRay))*step(.0,along);diffuseColor.rgb*=1.-shadow*.85;');
  };
  const ring=new THREE.Mesh(geometry,material);ring.rotation.x=-Math.PI/2;ring.userData.pickBody=mesh;mesh.add(ring);sceneState.pickTargets.push(ring);return ring;
}
function addMoon(parentIndex,name,radius,distance,color,speed,inclination=0) {
  const root=new THREE.Group(),pivot=new THREE.Group();root.rotation.z=inclination;
  root.userData.parentIndex=parentIndex;root.add(pivot);group.add(root);
  const material=new THREE.MeshStandardMaterial({color,roughness:1,map:sceneState.moonTexture});
  const moon=new THREE.Mesh(new THREE.SphereGeometry(radius,20,14),material);moon.position.x=distance;moon.name=name;pivot.add(moon);
  moonSystems.push({root,pivot,moon,speed,phase:moonSystems.length*.93});return root;
}
function createStars() {
  const random=seededRandom(1657),positions=[],colors=[];
  for(let i=0;i<2400;i++) {
    const radius=220+random()*170,theta=random()*Math.PI*2,z=random()*2-1,s=Math.sqrt(1-z*z);
    positions.push(radius*s*Math.cos(theta),radius*z,radius*s*Math.sin(theta));
    const intensity=.45+random()*.5, warm=i%9===0;
    colors.push(intensity*(warm?1:.76),intensity*.83,intensity*(warm?.67:1));
  }
  const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geo.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
  starField=new THREE.Points(geo,new THREE.PointsMaterial({vertexColors:true,size:.65,sizeAttenuation:true,transparent:true,opacity:.65,depthWrite:false}));scene.add(starField);
  const dust=[],dustColors=[];
  for(let i=0;i<1200;i++) {
    const angle=random()*Math.PI*2,radius=21.7+random()*2.2;
    dust.push(Math.cos(angle)*radius,(random()-.5)*.45,Math.sin(angle)*radius);
    const c=.35+random()*.3;dustColors.push(c,c*.86,c*.69);
  }
  const beltGeo=new THREE.BufferGeometry();beltGeo.setAttribute('position',new THREE.Float32BufferAttribute(dust,3));beltGeo.setAttribute('color',new THREE.Float32BufferAttribute(dustColors,3));
  const belt=new THREE.Points(beltGeo,new THREE.PointsMaterial({vertexColors:true,size:.045,transparent:true,opacity:.6,depthWrite:false}));belt.name='asteroid-belt';group.add(belt);
}
function createBodies() {
  const ringMap=ringTexture();
  bodies.forEach((body,index)=>{
    const fallback=fallbackTexture(body,index),segments=index===0?80:64;
    const material=index===0?sunMaterial(fallback):new THREE.MeshStandardMaterial({map:fallback,roughness:index===3?.72:.95,metalness:0});
    const mesh=new THREE.Mesh(new THREE.SphereGeometry(body.r,segments,Math.round(segments*.67)),material);
    mesh.userData=body;mesh.name=body.name;group.add(mesh);meshes.push(mesh);
    const tilt=new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,0,1),(body.tilt||0)*Math.PI/180);
    sceneState.bodyStates.push({tilt,spin:index===3?3.8:0,spinQuaternion:new THREE.Quaternion()});
    if(index===0) sunSurface=material;
    if(body.tex) loadSceneTexture('assets/'+body.tex,texture=>{
      if(index===0) material.uniforms.map.value=texture;else {material.map=texture;material.needsUpdate=true;}
      fallback.dispose();sceneState.textures.delete(fallback);
    });
    if(index===0) {
      const glow=glowTexture();
      [[13,.70],[20,.22],[31,.07]].forEach(([size,opacity])=>{
        const sprite=new THREE.Sprite(new THREE.SpriteMaterial({map:glow,color:0xffa752,transparent:true,opacity,blending:THREE.AdditiveBlending,depthWrite:false}));
        sprite.scale.set(size,size,1);sprite.userData={size,opacity};group.add(sprite);sunHalos.push(sprite);
      });
      const corona=new THREE.Mesh(new THREE.SphereGeometry(body.r*1.035,48,32),atmosphereMaterial(0xffaa48,2.6,.78));mesh.add(corona);atmospheres.push(corona);
    } else if(index!==1&&index!==9) {
      const colors={2:0xf6cd91,3:0x68a6ff,4:0xd86a39,5:0xcebdac,6:0xdccb9b,7:0x7de0e6,8:0x618eff};
      const atmosphere=new THREE.Mesh(new THREE.SphereGeometry(body.r*(index===3?1.032:1.025),40,28),atmosphereMaterial(colors[index],3.2,index===3?.85:.34));
      mesh.add(atmosphere);atmospheres.push(atmosphere);
    }
    if(index===3) {
      loadSceneTexture('assets/earth-night.jpg',texture=>{
        material.emissive=new THREE.Color(0xffdb9c);material.emissiveMap=texture;material.emissiveIntensity=.8;
        material.onBeforeCompile=shader=>{
          shader.vertexShader='varying vec3 earthWorld;varying vec3 earthNormal;\n'+shader.vertexShader;
          shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nearthWorld=(modelMatrix*vec4(position,1.)).xyz;earthNormal=normalize(mat3(modelMatrix)*normal);');
          shader.fragmentShader='varying vec3 earthWorld;varying vec3 earthNormal;\n'+shader.fragmentShader;
          shader.fragmentShader=shader.fragmentShader.replace('#include <emissivemap_fragment>','#include <emissivemap_fragment>\ntotalEmissiveRadiance*=1.-smoothstep(-.15,.22,dot(normalize(earthNormal),normalize(-earthWorld)));');
        };material.needsUpdate=true;
      });
      loadSceneTexture('assets/earth-clouds.jpg',texture=>{
        cloudShell=new THREE.Mesh(new THREE.SphereGeometry(body.r*1.009,56,40),new THREE.MeshStandardMaterial({color:0xffffff,alphaMap:texture,transparent:true,opacity:.68,depthWrite:false,roughness:1}));
        mesh.add(cloudShell);
      },false);
    }
    if(index===6) addPlanetRing(mesh,2.22,3.9,ringMap,.92);
    if(index===7) addPlanetRing(mesh,1.58,1.9,ringMap,.23);
    if(index>0) {
      const points=[];for(let j=0;j<=240;j++){const angle=j/240*Math.PI*2;points.push(new THREE.Vector3(Math.cos(angle)*body.orbit,0,Math.sin(angle)*body.orbit));}
      const line=new THREE.Line(new THREE.BufferGeometry().setFromPoints(points),new THREE.LineBasicMaterial({color:0x8292aa,transparent:true,opacity:.14,depthWrite:false}));
      group.add(line);orbitLines.push(line);
    }
    const label=document.createElement('div');label.className='object-label';label.textContent=lang==='en'?body.en:body.name;label.setAttribute('aria-hidden','true');document.body.appendChild(label);labels.push(label);
  });
  loadSceneTexture('assets/moon.jpg',texture=>{
    sceneState.moonTexture=texture;moonSystems.forEach(m=>{m.moon.material.map=texture;m.moon.material.needsUpdate=true;});
  });
  addMoon(3,'月球',.22,1.8,0xd6d2c9,.17,.09);
  addMoon(5,'木卫一',.14,2.85,0xd9bd6a,.32,.02);addMoon(5,'木卫二',.12,3.35,0xd6d1be,.25,.01);
  addMoon(5,'木卫三',.19,3.95,0xb2a89d,.19,.03);addMoon(5,'木卫四',.17,4.55,0x8e8174,.13,.04);
  addMoon(6,'泰坦',.19,4.45,0xd9aa55,.13,.04);addMoon(8,'海卫一',.15,2.4,0xb7b6a9,-.13,.12);
}
function init3D() {
  if(!sceneHasThree)throw new Error('Three.js is unavailable');
  if(sceneState.ready) return Promise.allSettled(sceneState.textureLoads);
  const canvas=$('#spaceCanvas');
  renderer=new THREE.WebGLRenderer({canvas,antialias:devicePixelRatio<2,alpha:true,powerPreference:'high-performance'});
  scene=new THREE.Scene();camera=new THREE.PerspectiveCamera(44,innerWidth/innerHeight,.035,1100);
  renderer.outputEncoding=THREE.sRGBEncoding;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.12;
  renderer.setClearColor(0x03060b,0);renderer.shadowMap.enabled=false;
  group=new THREE.Group();scene.add(group);
  scene.add(new THREE.AmbientLight(0x6f83a7,.28));scene.add(new THREE.HemisphereLight(0xc3d9ff,0x221911,.3));
  // Distances are compressed for this exhibit, so constant attenuation preserves readable outer planets.
  group.add(new THREE.PointLight(0xffe8d0,2.05,0,0));
  const fill=new THREE.DirectionalLight(0xb6d2ff,.32);fill.position.set(30,35,65);scene.add(fill);
  createStars();createBodies();
  humanLayer=new THREE.Group();naturalLayer=new THREE.Group();group.add(humanLayer,naturalLayer);
  raycaster=new THREE.Raycaster();pointer=new THREE.Vector2();setupPointer();
  sceneState.ready=true;sceneState.tier=innerWidth<700||navigator.connection?.saveData?1:2;
  applySceneQuality();resizeScene();applyView(view||'perspective',true);
  cam.radius=cam.radiusGoal;cam.target.copy(cam.goal);cam.theta=cam.thetaGoal;cam.phi=cam.phiGoal;cam.offsetX=cam.offsetXGoal;cam.offsetY=cam.offsetYGoal;camera.fov=cam.fovGoal;updateCamera(1);
  setupSceneLifecycle();requestSceneRender();
  return Promise.allSettled(sceneState.textureLoads).then(()=>{
    if(!sceneState.disposed) document.dispatchEvent(new CustomEvent('atlas:scene-ready',{detail:sceneDiagnostics()}));
    return sceneDiagnostics();
  });
}
function planetAngle(body) {
  if(!body.orbit) return 0;
  if(view!=='live') return bodies.indexOf(body)*.69+.35;
  const days=(Date.now()-Date.UTC(2000,0,1,12))/86400000;
  return ((body.phase+days/body.period*360)%360)*Math.PI/180;
}
function positionBodies() {
  bodies.forEach((body,i)=>{
    if(!i) meshes[i].position.set(0,0,0);
    else if(view==='side') meshes[i].position.set(body.orbit,0,0);
    else {const angle=planetAngle(body);meshes[i].position.set(Math.cos(angle)*body.orbit,0,Math.sin(angle)*body.orbit);}
  });
  moonSystems.forEach(m=>m.root.position.copy(meshes[m.root.userData.parentIndex].position));
}
function sceneSafeArea() {
  const w=innerWidth,h=innerHeight,mobile=w<=760;
  const explicit=$('#sceneViewport');
  if(explicit){const rect=explicit.getBoundingClientRect();if(rect.width>40&&rect.height>40)return {left:rect.left,right:rect.right,top:rect.top,bottom:rect.bottom,width:rect.width,height:rect.height};}
  const drawer=$('#drawer'),focused=drawer?.classList.contains('open');
  let left=mobile?20:Math.max(40,w*.04),right=w-(mobile?20:40),top=mobile?132:112,bottom=h-(mobile?170:164);
  const dock=$('.planet-dock')||$('#planetBar');
  if(dock&&!focused){const r=dock.getBoundingClientRect();if(r.height)bottom=Math.min(bottom,r.top-34);}
  const intro=$('.scene-intro');
  if(intro&&!focused){
    const r=intro.getBoundingClientRect();
    if(mobile)top=Math.max(top,r.bottom+24);
    else left=Math.max(left,r.right+32);
  }
  if(focused) {
    const r=drawer.getBoundingClientRect();
    if(!mobile)right=Math.min(right,w-r.width-28);
    else {top=84;bottom=h-r.height-55;}
  }
  if(right-left<100){left=12;right=Math.max(112,right);}
  if(bottom-top<100){top=Math.max(62,bottom-150);bottom=Math.max(top+100,bottom);}
  return {left,right,top,bottom,width:right-left,height:bottom-top};
}
function refreshSceneLayout(force=false) {
  if(!camera)return;
  const rect=sceneSafeArea(),key=[innerWidth,innerHeight,rect.left,rect.right,rect.top,rect.bottom].map(Math.round).join(':');
  if(!force&&key===sceneState.layoutKey)return;
  sceneState.layoutKey=key;sceneState.safe=rect;
  cam.offsetXGoal=innerWidth/2-(rect.left+rect.right)/2;
  cam.offsetYGoal=innerHeight/2-(rect.top+rect.bottom)/2;
  if(selectedBody) cam.radiusGoal=focusRadius(selectedBody);else frameOverview(false);
  camera.updateProjectionMatrix();
}
function bodyExtent(body) { return body.name==='土星'?4.15:body.name==='天王星'?2:body.r; }
function focusRadius(body) {
  const rect=sceneState.safe||sceneSafeArea(),tangent=Math.tan(THREE.MathUtils.degToRad(38)*.5);
  const extent=bodyExtent(body),available=Math.max(80,Math.min(rect.width,rect.height));
  return sceneClamp(extent/(tangent*available/innerHeight)*1.48,extent*2.9,190);
}
function overviewCenter() {
  if(view==='side')return new THREE.Vector3(24,0,0);
  return new THREE.Vector3(0,0,0);
}
function frameOverview(resetAngles=true) {
  cam.fovGoal=44;cam.goal.copy(overviewCenter());
  if(resetAngles){cam.thetaGoal=view==='side'?Math.PI/2:.62;cam.phiGoal=view==='side'?1.27:innerWidth<=760?1.12:.66;}
  const rect=sceneState.safe||sceneSafeArea(),tangent=Math.tan(THREE.MathUtils.degToRad(44)*.5);
  const tanX=tangent*rect.width/innerHeight,tanY=tangent*rect.height/innerHeight;
  const theta=cam.thetaGoal,phi=cam.phiGoal;
  const right=new THREE.Vector3(Math.sin(theta),0,-Math.cos(theta));
  const up=new THREE.Vector3(-Math.cos(phi)*Math.cos(theta),Math.sin(phi),-Math.cos(phi)*Math.sin(theta));
  const toward=new THREE.Vector3(Math.sin(phi)*Math.cos(theta),Math.cos(phi),Math.sin(phi)*Math.sin(theta));
  let radius=40;
  meshes.forEach(mesh=>{
    sceneVec.copy(mesh.position).sub(cam.goal);const extent=bodyExtent(mesh.userData)+1;
    radius=Math.max(radius,(Math.abs(sceneVec.dot(right))+extent)/Math.max(.05,tanX)+sceneVec.dot(toward),(Math.abs(sceneVec.dot(up))+extent)/Math.max(.05,tanY)+sceneVec.dot(toward));
  });
  cam.radiusGoal=Math.min(500,radius*1.06);
}
function applyView(next,silent=false) {
  if(!renderer)return;
  view=['side','perspective','live'].includes(next)?next:'perspective';
  selectedBody=null;
  if(typeof closeDrawer==='function'&&$('#drawer')?.classList.contains('open'))closeDrawer(false);
  $$('.planet').forEach(el=>el.classList.remove('active'));
  $$('.seg').forEach(el=>{const active=el.dataset.view===view;el.classList.toggle('active',active);el.setAttribute('aria-pressed',String(active));});
  positionBodies();refreshSceneLayout(true);frameOverview();requestSceneRender();
  if(!silent&&view==='live')toast(lang==='en'?'Approximate orbital positions for today':'按当前日期显示近似轨道位置');
  document.dispatchEvent(new CustomEvent('atlas:view-change',{detail:{view}}));
}
function focusBody(name,open=true) {
  const index=bodies.findIndex(body=>body.name===name);if(index<0||!renderer)return;
  selectedBody=bodies[index];hovered=null;
  $$('.planet').forEach(el=>{const active=el.dataset.body===name;el.classList.toggle('active',active);el.setAttribute('aria-pressed',String(active));});
  if(open&&typeof showBodySummary==='function')showBodySummary(name);
  cam.goal.copy(meshes[index].position);cam.fovGoal=38;
  // Face a lit three-quarter hemisphere, with readable rings and a gentle orbital inclination.
  if(index===0){cam.thetaGoal=.3;cam.phiGoal=1.25;}
  else {cam.thetaGoal=Math.atan2(-cam.goal.z,-cam.goal.x)+.52;cam.phiGoal=index===6?.96:1.3;}
  refreshSceneLayout(true);cam.radiusGoal=focusRadius(selectedBody);requestSceneRender();
  document.dispatchEvent(new CustomEvent('atlas:body-focus',{detail:{name,index}}));
}
function resetCamera() {
  if(!renderer)return;selectedBody=null;hovered=null;
  $$('.planet').forEach(el=>{el.classList.remove('active');el.setAttribute('aria-pressed','false');});
  refreshSceneLayout(true);frameOverview();requestSceneRender();
}
function cycleLayers() {
  if(!renderer)return;layerMode=layerMode===0?3:0;
  orbitLines.forEach(line=>line.visible=layerMode===0);
  $('#layersToggle')?.classList.toggle('active',layerMode===0);
  $('#layersToggle')?.setAttribute('aria-pressed',String(layerMode===0));
  requestSceneRender();return layerMode===0;
}
function rayHit(event) {
  if(!renderer||!camera)return null;
  const rect=renderer.domElement.getBoundingClientRect();if(!rect.width||!rect.height)return null;
  pointer.set((event.clientX-rect.left)/rect.width*2-1,-(event.clientY-rect.top)/rect.height*2+1);
  raycaster.setFromCamera(pointer,camera);const hit=raycaster.intersectObjects([...meshes,...sceneState.pickTargets],false)[0]||null;
  if(hit&&hit.object.userData.pickBody)hit.object=hit.object.userData.pickBody;return hit;
}
function zoomScene(factor) {
  if(!renderer||!Number.isFinite(factor)||factor<=0)return;
  const min=selectedBody?bodyExtent(selectedBody)*1.55:3;
  cam.radiusGoal=sceneClamp(cam.radiusGoal*factor,min,600);requestSceneRender();
}
function startGesture() {
  const points=[...sceneState.pointers.values()];
  if(points.length>=2) {
    sceneState.gesture={kind:'pinch',distance:Math.max(1,Math.hypot(points[0].x-points[1].x,points[0].y-points[1].y)),radius:cam.radiusGoal};
    points.forEach(p=>p.moved=true);drag=sceneState.gesture;
  } else if(points.length) {
    const p=points[0];cam.thetaGoal=cam.theta;cam.phiGoal=cam.phi;sceneState.gesture={kind:'rotate',x:p.x,y:p.y,theta:cam.theta,phi:cam.phi};drag=sceneState.gesture;
  } else {sceneState.gesture=null;drag=null;}
}
function setupPointer() {
  const canvas=renderer.domElement;canvas.style.touchAction='none';
  sceneListen(canvas,'pointerdown',event=>{
    if(event.pointerType==='mouse'&&event.button!==0)return;
    event.preventDefault();sceneState.pointers.set(event.pointerId,{x:event.clientX,y:event.clientY,startX:event.clientX,startY:event.clientY,moved:false});
    try{canvas.setPointerCapture(event.pointerId);}catch(_){}
    startGesture();hovered=null;canvas.style.cursor='grabbing';requestSceneRender();
  });
  let lastHover=0;
  sceneListen(canvas,'pointermove',event=>{
    const point=sceneState.pointers.get(event.pointerId);
    if(!point) {
      if(event.pointerType==='touch'||performance.now()-lastHover<60)return;
      lastHover=performance.now();const hit=rayHit(event);hovered=hit?hit.object:null;canvas.style.cursor=hovered?'pointer':'grab';requestSceneRender();return;
    }
    point.x=event.clientX;point.y=event.clientY;
    if(Math.hypot(point.x-point.startX,point.y-point.startY)>6)point.moved=true;
    const gesture=sceneState.gesture;
    if(gesture?.kind==='pinch') {
      const points=[...sceneState.pointers.values()];if(points.length<2)return;
      const distance=Math.max(1,Math.hypot(points[0].x-points[1].x,points[0].y-points[1].y));
      const min=selectedBody?bodyExtent(selectedBody)*1.55:3;cam.radiusGoal=sceneClamp(gesture.radius*gesture.distance/distance,min,600);
    } else if(gesture) {
      cam.theta=cam.thetaGoal=gesture.theta-(point.x-gesture.x)*.005;
      cam.phi=cam.phiGoal=sceneClamp(gesture.phi+(point.y-gesture.y)*.005,.08,Math.PI-.08);
    }
    requestSceneRender();
  });
  function finishPointer(event,cancelled) {
    const point=sceneState.pointers.get(event.pointerId);if(!point)return;
    const tap=!cancelled&&!point.moved&&sceneState.pointers.size===1&&sceneState.gesture?.kind==='rotate';
    sceneState.pointers.delete(event.pointerId);
    try{if(canvas.hasPointerCapture(event.pointerId))canvas.releasePointerCapture(event.pointerId);}catch(_){}
    if(sceneState.pointers.size)sceneState.pointers.forEach(p=>p.moved=true);
    startGesture();canvas.style.cursor='grab';if(tap)pick(event);requestSceneRender();
  }
  sceneListen(canvas,'pointerup',event=>finishPointer(event,false));
  sceneListen(canvas,'pointercancel',event=>finishPointer(event,true));
  sceneListen(canvas,'lostpointercapture',event=>finishPointer(event,true));
  sceneListen(canvas,'pointerleave',()=>{hovered=null;requestSceneRender();});
  sceneListen(window,'blur',()=>{sceneState.pointers.clear();startGesture();hovered=null;});
  sceneListen(canvas,'wheel',event=>{
    event.preventDefault();const delta=event.deltaY*(event.deltaMode===1?16:event.deltaMode===2?innerHeight:1);
    zoomScene(Math.exp(sceneClamp(delta,-500,500)*.00125));
  },{passive:false});
  sceneListen(canvas,'dblclick',event=>{event.preventDefault();const hit=rayHit(event);if(hit)focusBody(hit.object.name,true);});
}
function pick(event){const hit=rayHit(event);if(hit)focusBody(hit.object.name,true);}
function sceneMotionEnabled(){return sceneState.motionOverride===null?!sceneState.reducedMotion:sceneState.motionOverride;}
function updateCamera(dt) {
  if(autoRotate&&sceneMotionEnabled()&&!drag&&!selectedBody&&view!=='side')cam.thetaGoal+=dt*.025;
  const smoothing=sceneState.reducedMotion?1:1-Math.exp(-6.2*dt);
  cam.theta+=Math.atan2(Math.sin(cam.thetaGoal-cam.theta),Math.cos(cam.thetaGoal-cam.theta))*smoothing;
  cam.phi+=(cam.phiGoal-cam.phi)*smoothing;
  cam.target.lerp(cam.goal,smoothing);cam.radius+=(cam.radiusGoal-cam.radius)*smoothing;
  const oldFov=camera.fov;camera.fov+=(cam.fovGoal-camera.fov)*smoothing;
  cam.offsetX+=(cam.offsetXGoal-cam.offsetX)*smoothing;cam.offsetY+=(cam.offsetYGoal-cam.offsetY)*smoothing;
  if(!camera.view||Math.abs(camera.view.offsetX-cam.offsetX)>.01||Math.abs(camera.view.offsetY-cam.offsetY)>.01||Math.abs(camera.fov-oldFov)>.0001)camera.setViewOffset(innerWidth,innerHeight,cam.offsetX,cam.offsetY,innerWidth,innerHeight);
  const s=Math.sin(cam.phi);camera.position.set(cam.target.x+cam.radius*s*Math.cos(cam.theta),cam.target.y+cam.radius*Math.cos(cam.phi),cam.target.z+cam.radius*s*Math.sin(cam.theta));
  camera.lookAt(cam.target);camera.updateMatrixWorld();
}
function updateLabels() {
  const rect=sceneState.safe||sceneSafeArea(),occupied=[];
  const indices=meshes.map((mesh,i)=>i).sort((a,b)=>(bodies[b]===selectedBody)-(bodies[a]===selectedBody)||camera.position.distanceToSquared(meshes[a].position)-camera.position.distanceToSquared(meshes[b].position));
  indices.forEach(i=>{
    const mesh=meshes[i],label=labels[i],selected=selectedBody===bodies[i];
    sceneVec.copy(mesh.position).project(camera);
    let visible=sceneVec.z>-1&&sceneVec.z<1&&Math.abs(sceneVec.x)<1&&Math.abs(sceneVec.y)<1;
    const distance=camera.position.distanceTo(mesh.position),radiusPx=bodies[i].r/(Math.max(.01,distance)*Math.tan(THREE.MathUtils.degToRad(camera.fov)*.5))*innerHeight*.5;
    const x=(sceneVec.x*.5+.5)*innerWidth,y=(-sceneVec.y*.5+.5)*innerHeight+radiusPx+17;
    const textWidth=lang==='en'?bodies[i].en.length*6.5+10:34,half=textWidth/2;
    visible=visible&&x-half>rect.left-10&&x+half<rect.right+10&&y>rect.top&&y+9<rect.bottom;
    if(selectedBody&&!selected&&distance>cam.radius*2.3)visible=false;
    // Analytical sphere occlusion: no DOM labels through foreground planets.
    if(visible) {
      sceneVec2.copy(mesh.position).sub(camera.position).normalize();
      for(let j=0;j<meshes.length;j++) {
        if(i===j)continue;sceneVec.copy(meshes[j].position).sub(camera.position);const along=sceneVec.dot(sceneVec2);
        if(along>0&&along<distance-bodies[i].r&&sceneVec.lengthSq()-along*along<bodies[j].r*bodies[j].r){visible=false;break;}
      }
    }
    const box={left:x-half-5,right:x+half+5,top:y-10,bottom:y+10};
    if(visible&&occupied.some(r=>box.left<r.right&&box.right>r.left&&box.top<r.bottom&&box.bottom>r.top))visible=false;
    label.style.display=visible?'block':'none';label.classList.toggle('focus',selected);
    if(visible){occupied.push(box);label.style.left=x+'px';label.style.top=y+'px';label.style.opacity=selected?'1':'.68';}
  });
}
function applySceneQuality() {
  if(!renderer)return;const tier=sceneState.quality==='high'?2:sceneState.quality==='low'?0:sceneState.tier;
  const limit=[1,1.35,1.8][tier];renderer.setPixelRatio(Math.min(devicePixelRatio||1,limit));
  renderer.setSize(innerWidth,innerHeight,false);
  if(starField)starField.geometry.setDrawRange(0,[900,1600,2400][tier]);
  sceneState.effectiveTier=tier;requestSceneRender();
}
function resizeScene() {
  if(!renderer||sceneState.disposed)return;
  camera.aspect=innerWidth/innerHeight;sceneState.viewportWidth=innerWidth;sceneState.viewportHeight=innerHeight;
  applySceneQuality();refreshSceneLayout(true);requestSceneRender();
}
function requestSceneRender() {
  if(!sceneState.ready||sceneState.disposed||sceneState.lost||document.hidden||sceneState.frame)return;
  sceneState.frame=requestAnimationFrame(animate);
}
function pauseScene() {
  if(sceneState.frame)cancelAnimationFrame(sceneState.frame);sceneState.frame=0;sceneState.lastTime=0;
  clearTimeout(sceneState.timer);sceneState.timer=0;
}
function animate(timestamp) {
  sceneState.frame=0;if(document.hidden||sceneState.disposed||sceneState.lost)return;
  const dt=sceneState.lastTime?Math.min(.06,(timestamp-sceneState.lastTime)/1000):1/60;sceneState.lastTime=timestamp;
  const minFrame=sceneState.effectiveTier===0?1000/30:1000/60;
  if(timestamp-sceneState.lastRender<minFrame-1){requestSceneRender();return;}
  const renderDt=sceneState.lastRender?Math.min(.06,(timestamp-sceneState.lastRender)/1000):dt;sceneState.lastRender=timestamp;
  if(timestamp-sceneState.lastLayout>250){refreshSceneLayout();sceneState.lastLayout=timestamp;}
  const motion=sceneMotionEnabled();if(motion)sceneState.elapsed+=renderDt;
  const t=sceneState.elapsed;
  if(view==='live'&&timestamp%1000<60)positionBodies();
  meshes.forEach((mesh,i)=>{
    const state=sceneState.bodyStates[i],spin=Math.max(.22,Math.min(2.4,1/Math.abs(bodies[i].spin||1)));
    if(motion)state.spin+=(bodies[i].spin<0?-1:1)*renderDt*.06*spin;
    mesh.quaternion.copy(state.tilt).multiply(state.spinQuaternion.setFromAxisAngle(sceneUp,state.spin));
  });
  moonSystems.forEach(m=>m.pivot.rotation.y=m.phase+t*m.speed*.4);
  if(cloudShell)cloudShell.rotation.y=t*.009;
  if(sunSurface)sunSurface.uniforms.t.value=t;
  orbitLines.forEach((line,i)=>line.material.opacity=selectedBody?(selectedBody===bodies[i+1]?.2:.035):.14);
  updateCamera(renderDt);
  if(!sceneState.lastLabels||timestamp-sceneState.lastLabels>55){updateLabels();sceneState.lastLabels=timestamp;}
  const start=performance.now();renderer.render(scene,camera);const elapsed=performance.now()-start;
  sceneState.performanceMs=sceneState.performanceMs*.97+Math.max(elapsed,renderDt*1000)*.03;
  if(sceneState.quality==='auto'&&sceneState.performanceMs>22&&motion) {
    sceneState.slowSeconds+=renderDt;
    if(sceneState.slowSeconds>3&&sceneState.tier>0){sceneState.tier--;sceneState.slowSeconds=0;applySceneQuality();}
  } else sceneState.slowSeconds=Math.max(0,sceneState.slowSeconds-renderDt);
  const moving=Math.abs(cam.offsetX-cam.offsetXGoal)>.01||Math.abs(cam.offsetY-cam.offsetYGoal)>.01||Math.abs(Math.sin(cam.thetaGoal-cam.theta))>.0001||Math.abs(cam.phiGoal-cam.phi)>.0001||cam.target.distanceToSquared(cam.goal)>.0001||Math.abs(cam.radius-cam.radiusGoal)>.005||Math.abs(camera.fov-cam.fovGoal)>.005;
  if(motion||moving||drag)requestSceneRender();
}
function setupSceneLifecycle() {
  sceneListen(window,'resize',resizeScene);
  sceneListen(document,'visibilitychange',()=>{if(document.hidden)pauseScene();else{sceneState.lastRender=0;requestSceneRender();}});
  sceneListen(window,'pagehide',pauseScene);
  sceneListen(window,'pageshow',()=>{sceneState.lastRender=0;requestSceneRender();});
  sceneListen(renderer.domElement,'webglcontextlost',event=>{
    event.preventDefault();sceneState.lost=true;pauseScene();toast(lang==='en'?'Graphics paused. Waiting for WebGL to recover.':'图形上下文暂时中断，正在等待恢复');
    document.dispatchEvent(new CustomEvent('atlas:context-lost'));
  });
  sceneListen(renderer.domElement,'webglcontextrestored',()=>{
    sceneState.lost=false;sceneState.lastRender=0;applySceneQuality();requestSceneRender();
    document.dispatchEvent(new CustomEvent('atlas:context-restored'));
  });
  const media=matchMedia('(prefers-reduced-motion: reduce)');
  sceneListen(media,'change',event=>{sceneState.reducedMotion=event.matches;sceneState.motionOverride=null;requestSceneRender();});
  const observer=new MutationObserver(()=>{sceneState.layoutKey='';requestSceneRender();});
  [$('#drawer'),$('#guide')].filter(Boolean).forEach(el=>observer.observe(el,{attributes:true,attributeFilter:['class','style']}));
  sceneState.cleanup.push(()=>observer.disconnect());
  if(window.ResizeObserver){const observer=new ResizeObserver(()=>{sceneState.layoutKey='';requestSceneRender();});[$('#planetBar'),$('#drawer'),$('#sceneViewport')].filter(Boolean).forEach(el=>observer.observe(el));sceneState.cleanup.push(()=>observer.disconnect());}
}
function sceneDiagnostics() {
  return {ready:sceneState.ready,paused:document.hidden||sceneState.lost||sceneState.disposed,reducedMotion:sceneState.reducedMotion,motion:sceneMotionEnabled(),quality:sceneState.quality,tier:sceneState.effectiveTier,pixelRatio:renderer?.getPixelRatio(),texturesLoaded:sceneState.texturesLoaded,textureErrors:[...sceneState.textureErrors],bodies:meshes.length,labels:labels.length,pointers:sceneState.pointers.size,drawCalls:renderer?.info.render.calls,triangles:renderer?.info.render.triangles};
}
function disposeScene() {
  pauseScene();sceneState.disposed=true;sceneState.cleanup.forEach(fn=>fn());sceneState.cleanup=[];
  scene?.traverse(object=>{object.geometry?.dispose();if(Array.isArray(object.material))object.material.forEach(m=>m.dispose());else object.material?.dispose();});
  sceneState.textures.forEach(texture=>texture.dispose());sceneState.textures.clear();labels.forEach(label=>label.remove());labels=[];renderer?.dispose();
}
window.AtlasScene={
  zoomBy:zoomScene,
  setQuality(value){if(!['auto','low','high'].includes(value))return;sceneState.quality=value;if(value==='auto')sceneState.tier=innerWidth<700?1:2;applySceneQuality();return value;},
  setMotion(value){sceneState.motionOverride=!!value;requestSceneRender();return sceneMotionEnabled();},
  requestRender:requestSceneRender,resize:resizeScene,getDiagnostics:sceneDiagnostics,dispose:disposeScene
};
