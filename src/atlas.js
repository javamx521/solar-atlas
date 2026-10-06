'use strict';

// State is deliberately independent from WebGL: every dossier remains usable
// when graphics are unavailable or the device loses its rendering context.
const bodies=[
{name:'太阳',en:'SUN',au:'0',r:4.5,orbit:0,color:'#ffb233',tex:'sun.jpg',period:1,phase:0,tilt:7.25,spin:25.4},
{name:'水星',en:'MERCURY',au:'0.39',r:.52,orbit:8,color:'#9b9182',tex:'mercury.jpg',period:87.969,phase:252,tilt:.03,spin:58.6},
{name:'金星',en:'VENUS',au:'0.72',r:.86,orbit:11.4,color:'#d7a85e',tex:'venus.jpg',period:224.701,phase:181,tilt:177.4,spin:-243},
{name:'地球',en:'EARTH',au:'1.00',r:.93,orbit:15,color:'#4c83bd',tex:'earth.jpg',period:365.256,phase:100,tilt:23.44,spin:1},
{name:'火星',en:'MARS',au:'1.52',r:.7,orbit:19,color:'#c45e35',tex:'mars.jpg',period:686.98,phase:355,tilt:25.19,spin:1.03},
{name:'木星',en:'JUPITER',au:'5.20',r:2.1,orbit:25,color:'#d1a578',tex:'jupiter.jpg',period:4332.59,phase:34,tilt:3.13,spin:.41},
{name:'土星',en:'SATURN',au:'9.58',r:1.8,orbit:32,color:'#dbc58c',tex:'saturn.jpg',period:10759.22,phase:50,tilt:26.73,spin:.45},
{name:'天王星',en:'URANUS',au:'19.2',r:1.2,orbit:39,color:'#8ed4d8',tex:'uranus.jpg',period:30688.5,phase:314,tilt:97.77,spin:-.72},
{name:'海王星',en:'NEPTUNE',au:'30.1',r:1.15,orbit:46,color:'#3859b7',tex:'neptune.jpg',period:60182,phase:304,tilt:28.32,spin:.67},
{name:'冥王星',en:'PLUTO',au:'39.5',r:.42,orbit:52,color:'#aa8b70',tex:null,period:90560,phase:238,tilt:119.6,spin:-6.39}
];
const bodyIds={'太阳':'sun','水星':'mercury','金星':'venus','地球':'earth','火星':'mars','木星':'jupiter','土星':'saturn','天王星':'uranus','海王星':'neptune','冥王星':'pluto'};
const bodyPinyin={'太阳':'taiyang ty','水星':'shuixing sx','金星':'jinxing jx','地球':'diqiu dq','火星':'huoxing hx','木星':'muxing mx','土星':'tuxing tx','天王星':'tianwangxing twx','海王星':'haiwangxing hwx','冥王星':'mingwangxing mwx'};
const $=selector=>document.querySelector(selector);
const ARROW_ICON='<svg class="arrow-icon" viewBox="0 0 20 20" aria-hidden="true"><path d="M4 16 16 4M5 4h11v11"/></svg>';
const $$=selector=>Array.from(document.querySelectorAll(selector));
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const preference={get(key,fallback){try{return localStorage.getItem(`solar-atlas:${key}`)||fallback}catch{return fallback}},set(key,value){try{localStorage.setItem(`solar-atlas:${key}`,value)}catch{}}};
let dossiers=[],selectedBody=null,view='perspective',lang=preference.get('language','zh'),autoRotate=!matchMedia('(prefers-reduced-motion: reduce)').matches;
let searchCursor=0,searchItems=[],audioState=null,routeRestoring=false,modalReturnFocus=null,drawerReturnFocus=null;
let graphicsReady=false,audioTransition=false;
if(!['zh','en'].includes(lang))lang='zh';
const I18N={
 zh:{views:['三维探索','行星排列','今日星位'],brand:'太阳系图谱',eyebrow:'我们的宇宙坐标',title:'在群星之间',description:'一颗恒星，八大行星。<br>从熟悉的蓝色家园，出发。',explore:'探索地球',archive:'天体档案',choose:'选择一个世界',hint:'拖动旋转 · 滚轮缩放',touchHint:'单指旋转 · 双指缩放',scale:'太阳系 · 示意尺度',live:'今日星位 · 简化模型',searchTitle:'你想去哪里？',searchPlaceholder:'搜索天体，中英文或拼音…',searchNote:'↑ ↓ 选择　Enter 前往　Esc 关闭',noMatch:'暂时找不到这个世界。试试“地球”或“Earth”。',guideTitle:'轻轻拖动，开始探索。',guideClose:'开始探索',guideNote:'为了看清每一个世界，天体大小与轨道距离采用不同的压缩比例。“今日星位”是依据轨道周期估算的示意位置，并非实时星历，不适用于天文导航。卫星、星空和大气为视觉示意。',facts:'世界的尺度',atmo:'大气组成',atmoNote:'主要成分的近似比例，可能因取整而不等于 100%。',features:'值得凝视的地方',articles:'再靠近一点',source:'继续探索',sourceLabel:'NASA 官方天体档案',textures:'贴图来源与许可',noneAtmo:'没有可按百分比列出的稳定大气。',previous:'上一个',next:'下一个',sound:'声音',soundOn:'环境音已开启',soundOff:'环境音已关闭',fallback:'当前设备无法呈现三维场景，你仍可选择天体、搜索并浏览档案。',search:'搜索天体',help:'操作指南',close:'关闭',zoomIn:'放大',zoomOut:'缩小',reset:'复位视角',auto:'自动环绕',layers:'轨道线',home:'返回太阳系总览',load:'正在展开太阳系…',ready:'准备就绪',partial:'部分详细资料暂不可用，仍可浏览天体。',motionNote:'已按系统偏好减少动态效果'},
 en:{views:['Explore','Planet lineup','Today'],brand:'OUR COSMIC NEIGHBOURHOOD',eyebrow:'OUR PLACE IN THE UNIVERSE',title:'Between<br>the worlds.',description:'One star. Eight planets.<br>A journey begins at our blue home.',explore:'Explore Earth',archive:'CELESTIAL DOSSIERS',choose:'CHOOSE A WORLD',hint:'DRAG TO ORBIT · SCROLL TO ZOOM',touchHint:'DRAG TO ORBIT · PINCH TO ZOOM',scale:'SOLAR SYSTEM · ILLUSTRATIVE SCALE',live:'TODAY · APPROXIMATE POSITIONS',searchTitle:'Where would you like to go?',searchPlaceholder:'Find a world…',searchNote:'↑ ↓ Select　Enter Explore　Esc Close',noMatch:'No world found. Try “Earth” or “Mars”.',guideTitle:'A little closer to the extraordinary.',guideClose:'Start exploring',guideNote:'Planet sizes and orbital distances use different compressed scales for clarity. Today’s positions are simplified estimates from orbital periods, not live ephemerides or navigation data. Moons, the starfield and atmospheres are illustrative.',facts:'A WORLD IN NUMBERS',atmo:'ATMOSPHERE',atmoNote:'Approximate major components; rounding may not total 100%.',features:'PLACES TO WONDER',articles:'A CLOSER LOOK',source:'KEEP EXPLORING',sourceLabel:'Official NASA dossier',textures:'Texture credits & licences',noneAtmo:'No stable atmosphere to list by percentage.',previous:'Previous',next:'Next',sound:'Sound',soundOn:'Ambient sound on',soundOff:'Ambient sound off',fallback:'3D graphics are unavailable on this device. You can still choose worlds, search and explore their dossiers.',search:'Search worlds',help:'Flight manual',close:'Close',zoomIn:'Zoom in',zoomOut:'Zoom out',reset:'Reset view',auto:'Auto orbit',layers:'Orbit lines',home:'Return to solar system',load:'Unfolding the solar system…',ready:'Ready to explore',partial:'Some detailed data is unavailable. You can still explore the worlds.',motionNote:'Reduced motion follows your system preference'}
};
const typeNames={zh:{sun:'恒星 · 太阳系的中心',rock:'类地行星',gas:'气态巨行星',ice:'冰巨行星',dwarf:'矮行星 · 柯伊伯带'},en:{sun:'STAR · AT THE HEART OF IT ALL',rock:'TERRESTRIAL PLANET',gas:'GAS GIANT',ice:'ICE GIANT',dwarf:'DWARF PLANET · KUIPER BELT'}};
const guideItems={zh:[['拖动','改变视角','单指或鼠标拖动，绕世界观察。'],['缩放','靠近与远离','滚轮、双指，或右侧 + / −。'],['← →','切换天体','方向键，或点击底部天体。'],['R / Esc','返回全景','R 复位；Esc 关闭当前面板。']],en:[['DRAG','Find a new angle','Drag with one finger or your mouse.'],['ZOOM','Closer or farther','Wheel, pinch, or use + and −.'],['← →','Visit the next world','Arrow keys or the planet dock.'],['R / Esc','Find your way home','R resets. Esc closes the current panel.']]};
function bodyType(index){return index===0?'sun':index<5?'rock':index<7?'gas':index<9?'ice':'dwarf'}
function t(key){return I18N[lang][key]}
function displayName(body){return lang==='zh'?body.name:body.en[0]+body.en.slice(1).toLowerCase()}
function textureStyle(body){return `--c:${body.color};${body.tex?`--texture:url('assets/${body.tex}')`:''}`}
function bodyDossier(body){return dossiers.find(d=>d.id===bodyIds[body.name])}
function translatedValue(value){if(lang==='zh')return value;return String(value).replace(/（月球）/g,' (Moon)').replace(/（/g,' (').replace(/）/g,')').replace(/天/g,' days').replace(/小时/g,' h').replace(/分钟/g,' min').replace(/个/g,'').replace(/有/g,'Yes').replace(/无/g,'None').replace(/约/g,'~')}

async function loadPhase2(){
 const response=await fetch('data/bodies.json');
 if(!response.ok)throw new Error(`Dossiers unavailable (${response.status})`);
 const data=await response.json();
 if(!Array.isArray(data)||!data.every(d=>d.id&&d.name_zh&&d.name_en))throw new Error('Invalid dossier data');
 dossiers=data;
}
function renderPlanetBar(){
 $('#planetBar').innerHTML=bodies.map((body,index)=>`<button class="planet ${selectedBody===body?'active':''}" data-body="${body.name}" style="${textureStyle(body)}" aria-label="${esc(displayName(body))}" aria-pressed="${selectedBody===body}"><i class="planet-swatch" aria-hidden="true"></i><b>${esc(displayName(body))}</b><small>${String(index+1).padStart(2,'0')} / ${index===0?'STAR':index===9?'DWARF':'PLANET'}</small></button>`).join('');
 $('#planetBar').onclick=event=>{const button=event.target.closest('[data-body]');if(button)navigateBody(button.dataset.body)};
}
function navigateBody(name){
 const body=bodies.find(b=>b.name===name);if(!body)return;
 closeSearch(false);closeGuide(false);
 if(graphicsReady&&typeof focusBody==='function')focusBody(name,true);else{selectedBody=body;showBodySummary(name)}
}
function changeView(next){
 closeDrawer(false);view=next;
 $$('.seg').forEach(b=>{b.classList.toggle('active',b.dataset.view===view);b.setAttribute('aria-pressed',String(b.dataset.view===view))});
 if(graphicsReady)applyView(view);
 updateSceneCaption();
}
function updateSceneCaption(){if($('#sceneCaption'))$('#sceneCaption').textContent=view==='live'?t('live'):t('scale')}
function resetExplorer(){closeDrawer(false);if(graphicsReady)resetCamera();window.AtlasScene?.requestRender()}
function syncRoute(name){if(routeRestoring)return;const hash=name?`#${bodyIds[name]}`:'';if(location.hash!==hash)history.pushState(null,'',location.pathname+location.search+hash)}
function readRoute(){const id=location.hash.slice(1);const body=bodies.find(b=>bodyIds[b.name]===id);routeRestoring=true;try{if(body){if(selectedBody!==body)navigateBody(body.name)}else if(selectedBody)closeDrawer()}finally{routeRestoring=false}}
function showBodySummary(name){
 const body=bodies.find(b=>b.name===name);if(!body)return;
 const wasOpen=$('#drawer').classList.contains('open'),dockHadFocus=!!document.activeElement?.closest('#planetBar');if(!wasOpen)drawerReturnFocus=document.activeElement;
 selectedBody=body;const index=bodies.indexOf(body);const dossier=bodyDossier(body);
 $('#drawerTag').textContent=`${String(index+1).padStart(2,'0')} / ${lang==='zh'?'天体档案':'CELESTIAL DOSSIER'}`;
 $('#bodyNumber').textContent=String(index+1).padStart(2,'0');
 $('#drawerTitle').innerHTML=`${esc(displayName(body))}<small>${esc(lang==='zh'?body.en:body.name)}</small>`;
 $('#bodyClass').textContent=typeNames[lang][bodyType(index)];
 $('#drawerBody').innerHTML=dossier?dossierPanel(dossier):`<p class="lead">${esc(t('partial'))}</p><div class="facts"><div class="fact"><small>${lang==='zh'?'平均距日距离':'MEAN DISTANCE'}</small><b>${body.au} AU</b></div></div>`;
 $('#drawerBody').scrollTop=0;$('#drawer').inert=false;$('#drawer').setAttribute('aria-hidden','false');$('#drawer').classList.add('open');document.body.classList.add('body-focused');
 renderPlanetBar();syncRoute(name);
 if(!wasOpen)$('#closeDrawer').focus({preventScroll:true});else if(dockHadFocus)$$('.planet').find(button=>button.dataset.body===name)?.focus({preventScroll:true});
 requestAnimationFrame(()=>window.AtlasScene?.resize());
}
function dossierPanel(d){
 const english=lang==='en';
 const params=(d.params||[]).map(p=>`<div class="fact"><small>${esc(english?(p.k_en||p.k_zh):p.k_zh)}</small><b>${esc((english&&p.v_en)?p.v_en:translatedValue(p.v))}</b></div>`).join('');
 const atmo=(d.atmosphere||[]).map(a=>`<div class="atmo-row"><span>${esc(english?a.name_en:a.name_zh)}</span><div class="atmo-bar"><i style="width:${Math.min(100,Math.max(.5,Number(a.pct)||0))}%"></i></div><em>${esc(a.pct)}%</em></div>`).join('');
 const landmarks=(d.landmarks||[]).map(p=>`<div class="feature"><b>${esc(english?p.name_en:p.name_zh)}</b><p>${esc(english?p.desc_en:p.desc_zh)}</p></div>`).join('');
 const articles=(d.articles||[]).map(a=>`<details class="article"><summary>${esc(english?a.title_en:a.title_zh)}</summary><p>${esc(english?a.body_en:a.body_zh)}</p></details>`).join('');
 const source=/^https:\/\/(science\.)?nasa\.gov\//.test(d.source_url||'')?`<a class="source-link" href="${esc(d.source_url)}" target="_blank" rel="noopener noreferrer">${t('sourceLabel')} ${ARROW_ICON}</a>`:'';
 return `<p class="lead">${esc(english?d.summary_en:d.summary_zh)}</p><section class="section"><h3>${t('facts')}</h3><div class="facts">${params}</div></section><section class="section"><h3>${t('atmo')}</h3>${atmo||`<p class="source-note">${t('noneAtmo')}</p>`}${atmo?`<p class="source-note">${t('atmoNote')}</p>`:''}</section>${landmarks?`<section class="section"><h3>${t('features')}</h3>${landmarks}</section>`:''}${articles?`<section class="section"><h3>${t('articles')}</h3>${articles}</section>`:''}<section class="section"><h3>${t('source')}</h3>${source}<a class="source-link" href="assets/credits.html" target="_blank" rel="noopener noreferrer">${t('textures')} ${ARROW_ICON}</a><p class="source-note">${lang==='zh'?'图景经过艺术化处理，物理参数为近似值。':'An artistic visualisation. Physical parameters are approximate.'}</p></section>`;
}
function closeDrawer(reset=true){
 const wasOpen=$('#drawer').classList.contains('open'),previousName=selectedBody?.name;$('#drawer').classList.remove('open');$('#drawer').setAttribute('aria-hidden','true');$('#drawer').inert=true;document.body.classList.remove('body-focused');selectedBody=null;renderPlanetBar();syncRoute(null);
 if(reset&&graphicsReady)resetCamera();window.AtlasScene?.requestRender();
 if(wasOpen){const restore=$$('.planet').find(button=>button.dataset.body===previousName)||$('#homeButton');restore.focus({preventScroll:true})}
 requestAnimationFrame(()=>window.AtlasScene?.resize());
}
function nextBody(direction){const index=selectedBody?bodies.indexOf(selectedBody):direction>0?-1:0;navigateBody(bodies[(index+direction+bodies.length)%bodies.length].name)}
function setLanguage(next){
 lang=next;preference.set('language',lang);document.documentElement.lang=lang==='zh'?'zh-CN':'en';document.title=lang==='zh'?'Solar Atlas · 太阳系图谱':'Solar Atlas · Between the worlds';
 $('.brand small').textContent=t('brand');$('#introEyebrow').textContent=t('eyebrow');$('#introTitle').innerHTML=t('title');$('#introDescription').innerHTML=t('description');$('#exploreLabel').textContent=t('explore');$('#introIndexLabel').textContent=t('archive');$('#dockLabel').textContent=t('choose');$('#dockHint').textContent=t(matchMedia('(pointer: coarse)').matches?'touchHint':'hint');
 $$('.seg').forEach((button,i)=>{button.textContent=t('views')[i];button.setAttribute('aria-pressed',String(button.dataset.view===view))});
 $('#langToggle').textContent=lang==='zh'?'EN':'中';$('#langToggle').setAttribute('aria-label',lang==='zh'?'Switch to English':'切换中文');$('#musicToggle span').textContent=t('sound');$('#searchTitle').textContent=t('searchTitle');$('#searchInput').placeholder=t('searchPlaceholder');$('#searchNote').textContent=t('searchNote');$('#fallbackMessage').textContent=t('fallback');
 for(const [id,key] of Object.entries({searchToggle:'search',helpToggle:'help',closeSearch:'close',closeDrawer:'close',guideX:'close',zoomIn:'zoomIn',zoomOut:'zoomOut',resetView:'reset',autoToggle:'auto',layersToggle:'layers',homeButton:'home'})){const el=$('#'+id);el.setAttribute('aria-label',t(key));el.title=t(key)}
 $('#previousBody span').textContent=t('previous');$('#nextBody span').textContent=t('next');$('#previousBody').setAttribute('aria-label',t('previous'));$('#nextBody').setAttribute('aria-label',t('next'));$('#searchInput').setAttribute('aria-label',t('search'));$('#planetBar').setAttribute('aria-label',t('choose'));
 renderPlanetBar();renderGuide();updateSceneCaption();
 if(selectedBody){const scroll=$('#drawerBody').scrollTop;showBodySummary(selectedBody.name);$('#drawerBody').scrollTop=scroll}if(!$('#searchOverlay').hidden)search();
 if(typeof labels!=='undefined')labels.forEach((label,i)=>label.textContent=displayName(bodies[i]));
}
function renderGuide(){
 $('#guideTitle').textContent=t('guideTitle');$('#guideGrid').innerHTML=guideItems[lang].map(item=>`<div class="guide-item"><div class="guide-key">${item[0]}</div><div><b>${item[1]}</b><span>${item[2]}</span></div></div>`).join('');$('#scaleNote').textContent=t('guideNote');$('#guideClose').innerHTML=`${t('guideClose')} <span aria-hidden="true">${ARROW_ICON}</span>`;
}
function openModal(element,focus){modalReturnFocus=document.activeElement;element.hidden=false;element.classList.add('open');focus.focus({preventScroll:true})}
function closeModal(element,restore=true){if(element.hidden)return;element.hidden=true;element.classList.remove('open');if(restore&&modalReturnFocus?.isConnected)modalReturnFocus.focus({preventScroll:true})}
function openGuide(){closeSearch(false);renderGuide();openModal($('#guide'),$('#guideX'))}
function closeGuide(restore=true){closeModal($('#guide'),restore)}
function openSearch(){closeGuide(false);openModal($('#searchOverlay'),$('#searchInput'));$('#searchInput').value='';search()}
function closeSearch(restore=true){closeModal($('#searchOverlay'),restore)}
function search(){
 const query=$('#searchInput').value.trim().toLowerCase();
 searchItems=bodies.filter(b=>!query||`${b.name} ${b.en} ${bodyPinyin[b.name]}`.toLowerCase().includes(query));searchCursor=0;
 $('#results').innerHTML=searchItems.length?searchItems.map((b,index)=>`<button class="result ${index===0?'selected':''}" id="search-result-${bodyIds[b.name]}" data-result="${index}" role="option" aria-selected="${index===0}" style="${textureStyle(b)}"><i class="planet-swatch" aria-hidden="true"></i><span><b>${esc(displayName(b))}</b><small>${esc(lang==='zh'?b.en:b.name)} · ${b.au} AU</small></span><span class="result-arrow" aria-hidden="true">${ARROW_ICON}</span></button>`).join(''):`<p class="no-results">${t('noMatch')}</p>`;
 $('#results').onclick=e=>{const row=e.target.closest('[data-result]');if(row)activateSearch(Number(row.dataset.result))};
 updateSearchActive();
}
function updateSearchActive(){
 $$('.result').forEach((row,index)=>{row.classList.toggle('selected',index===searchCursor);row.setAttribute('aria-selected',String(index===searchCursor))});
 const active=$$('.result')[searchCursor];if(active){$('#searchInput').setAttribute('aria-activedescendant',active.id);active.scrollIntoView({block:'nearest'})}else $('#searchInput').removeAttribute('aria-activedescendant');
}
function activateSearch(index){const b=searchItems[index];if(b)navigateBody(b.name)}
function searchKeys(event){if(!searchItems.length)return;if(event.key==='ArrowDown'||event.key==='ArrowUp'){event.preventDefault();searchCursor=(searchCursor+(event.key==='ArrowDown'?1:-1)+searchItems.length)%searchItems.length;updateSearchActive()}else if(event.key==='Enter'){event.preventDefault();activateSearch(searchCursor)}}
function trapModalFocus(event){
 const modal=!$('#guide').hidden?$('#guide'):!$('#searchOverlay').hidden?$('#searchOverlay'):null;if(!modal||event.key!=='Tab')return false;
 const controls=Array.from(modal.querySelectorAll('button,input,a[href],[tabindex="0"]')).filter(e=>!e.disabled);const first=controls[0],last=controls.at(-1);if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus()}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus()}return true;
}
function toast(message){const node=$('#toast');node.textContent=message;node.classList.add('show');clearTimeout(node._timer);node._timer=setTimeout(()=>node.classList.remove('show'),2400)}
async function toggleMusic(){
 if(audioTransition)return;
 audioTransition=true;$('#musicToggle').disabled=true;
 try{
  if(audioState){
   const state=audioState;audioState=null;
   state.master.gain.setTargetAtTime(0,state.ctx.currentTime,.08);
   state.nodes.forEach(node=>node.stop(state.ctx.currentTime+.2));
   await new Promise(resolve=>setTimeout(resolve,220));await state.ctx.close();
   $('#musicToggle').setAttribute('aria-pressed','false');toast(t('soundOff'));return;
  }
  const AC=window.AudioContext||window.webkitAudioContext;if(!AC)return;
  const ctx=new AC(),master=ctx.createGain();master.gain.value=0;master.connect(ctx.destination);
  const nodes=[55,82.4069,110.04].map((frequency,i)=>{const oscillator=ctx.createOscillator(),gain=ctx.createGain();oscillator.type='sine';oscillator.frequency.value=frequency;gain.gain.value=[.32,.11,.04][i];oscillator.connect(gain);gain.connect(master);oscillator.start();return oscillator});
  audioState={ctx,nodes,master};await ctx.resume();master.gain.setTargetAtTime(.025,ctx.currentTime,.4);
  $('#musicToggle').setAttribute('aria-pressed','true');toast(t('soundOn'));
 }catch(error){
  if(audioState){audioState.nodes.forEach(node=>{try{node.stop()}catch{}});await audioState.ctx.close().catch(()=>{});audioState=null}
  $('#musicToggle').setAttribute('aria-pressed','false');console.warn('Ambient audio unavailable',error);
 }finally{audioTransition=false;$('#musicToggle').disabled=false}
}

function initUI(){
 renderPlanetBar();setLanguage(lang);$('#autoToggle').classList.toggle('active',autoRotate);$('#autoToggle').setAttribute('aria-pressed',String(autoRotate));
 $$('.seg').forEach(button=>button.onclick=()=>changeView(button.dataset.view));
 $('#homeButton').onclick=resetExplorer;$('#resetView').onclick=resetExplorer;$('#exploreEarth').onclick=()=>navigateBody('地球');$('#closeDrawer').onclick=()=>closeDrawer();$('#previousBody').onclick=()=>nextBody(-1);$('#nextBody').onclick=()=>nextBody(1);
 $('#searchToggle').onclick=openSearch;$('#closeSearch').onclick=()=>closeSearch();$('#searchInput').addEventListener('input',search);$('#searchInput').addEventListener('keydown',searchKeys);$('#searchOverlay').onclick=e=>{if(e.target===$('#searchOverlay'))closeSearch()};
 $('#helpToggle').onclick=openGuide;$('#guideX').onclick=()=>closeGuide();$('#guideClose').onclick=()=>closeGuide();$('#guide').onclick=e=>{if(e.target===$('#guide'))closeGuide()};
 $('#langToggle').onclick=()=>setLanguage(lang==='zh'?'en':'zh');$('#musicToggle').onclick=toggleMusic;
 $('#zoomIn').onclick=()=>window.AtlasScene?.zoomBy(.8);$('#zoomOut').onclick=()=>window.AtlasScene?.zoomBy(1.25);
 $('#autoToggle').onclick=()=>{autoRotate=!autoRotate;$('#autoToggle').classList.toggle('active',autoRotate);$('#autoToggle').setAttribute('aria-pressed',String(autoRotate));if(matchMedia('(prefers-reduced-motion: reduce)').matches)window.AtlasScene?.setMotion(autoRotate);window.AtlasScene?.requestRender()};
 $('#layersToggle').onclick=()=>{if(graphicsReady)cycleLayers()};
 document.addEventListener('keydown',event=>{
  if(trapModalFocus(event))return;
  if(event.key==='Escape'){if(!$('#searchOverlay').hidden)closeSearch();else if(!$('#guide').hidden)closeGuide();else closeDrawer();return}
  if(event.ctrlKey||event.metaKey||event.altKey||event.target.matches('input,textarea,[contenteditable=true]'))return;
  if(!$('#guide').hidden||!$('#searchOverlay').hidden)return;
  if(event.key==='/'){event.preventDefault();openSearch()}else if(event.key.toLowerCase()==='r')resetExplorer();else if(['ArrowLeft','ArrowRight'].includes(event.key)){event.preventDefault();nextBody(event.key==='ArrowRight'?1:-1)}
 });
 addEventListener('popstate',readRoute);addEventListener('hashchange',readRoute);
 document.addEventListener('visibilitychange',()=>{if(audioState){if(document.hidden)audioState.ctx.suspend().catch(()=>{});else audioState.ctx.resume().catch(()=>{})}});
}
