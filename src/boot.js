'use strict';
async function boot(){
 let dataError=false;
 try{await loadPhase2()}catch(error){dataError=true;console.warn('Detailed planet data unavailable',error)}
 initUI();$('#loadfill').style.width='45%';$('#loadstatus').textContent=t('load');
 try{
  if(!window.THREE)throw new Error('3D engine unavailable');
  await Promise.resolve(init3D());graphicsReady=true;
 }catch(error){
  console.warn('3D scene unavailable; celestial dossiers remain accessible.',error);
  $('#fallback').hidden=false;$('#sceneStatus').textContent='CATALOG MODE';
  $('#spaceCanvas').setAttribute('aria-hidden','true');$('#spaceCanvas').tabIndex=-1;
  for(const id of ['zoomIn','zoomOut','autoToggle','layersToggle'])$('#'+id).disabled=true;
 }
 $('#loadfill').style.width='100%';$('#loadstatus').textContent=t('ready');$('#loading').classList.add('done');setTimeout(()=>$('#loading')?.remove(),450);
 if(dataError)toast(t('partial'));
 readRoute();
 document.documentElement.dataset.ready='true';
}
boot().catch(error=>{console.error('Atlas could not initialise',error);$('#loading')?.remove();$('#fallback').hidden=false});
