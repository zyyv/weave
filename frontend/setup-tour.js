import {t, getLocale} from './i18n.js';

// The tour follows the app's actual route and uses the existing controls.
export function createSetupTour({getState,getRoute,getBusy,isDismissed,onDismiss,onComplete,onPreviewComplete}){
 const layer=document.createElement('div');
 layer.className='setup-tour';layer.hidden=true;
 layer.innerHTML=`<div class="tour-spotlight" aria-hidden="true"></div><section class="tour-panel" tabindex="-1" role="dialog" aria-modal="false" aria-labelledby="tourTitle" aria-describedby="tourDescription"><div class="tour-progress" aria-live="polite"></div><div class="tour-track" aria-hidden="true"><span></span><span></span><span></span></div><div class="tour-copy"><h2 id="tourTitle"></h2><p id="tourDescription"></p></div><div class="tour-actions"><button class="tour-dismiss" type="button"></button><button class="tour-next primary" type="button"></button></div></section>`;
 document.body.append(layer);
 const panel=layer.querySelector('.tour-panel'),spotlight=layer.querySelector('.tour-spotlight'),next=layer.querySelector('.tour-next'),dismiss=layer.querySelector('.tour-dismiss');
 const steps=[
  {target:'#settingsButton',title:'tourSettingsTitle',description:'tourSettingsDescription',action:'tourOpenSettings'},
  {target:'#settingsNav [data-section="data"]',title:'tourDataTitle',description:'tourDataDescription',action:'tourOpenData'},
  {target:'#settingsChoose',title:'tourFolderTitle',description:'tourFolderDescription',action:'tourChooseFolder'}
 ];
 const reducedMotion=matchMedia('(prefers-reduced-motion: reduce)'),ease='cubic-bezier(.22,1,.36,1)';
 let active=false,preview=false,step=-1,contentKey='',frame=0,previousFocus=null,layerMotion=null,panelMotion=null,copyMotion=null,layoutKey='';
 function animate(element,keyframes,options){return reducedMotion.matches?null:element.animate(keyframes,{easing:ease,fill:'none',...options})}
 function stop(){
  active=false;step=-1;contentKey='';cancelAnimationFrame(frame);frame=0;
  const opacity=getComputedStyle(layer).opacity;layerMotion?.cancel();
  const exit=animate(layer,[{opacity},{opacity:0}],{duration:160});layerMotion=exit;
  // A replay during the exit cancels it, so an old completion cannot hide the new tour.
  if(exit)exit.finished.then(()=>{if(layerMotion===exit){layer.hidden=true;layerMotion=null}}).catch(()=>{});
  else layer.hidden=true;
 }
 function skip(){stop();if(!preview)onDismiss();if(previousFocus?.isConnected)previousFocus.focus({preventScroll:true})}
 function schedule(){if(active&&!frame)frame=requestAnimationFrame(()=>{frame=0;refresh()})}
 function position(target,before){
  const r=target.getBoundingClientRect(),gap=16,edge=16,pad=5;
  Object.assign(spotlight.style,{left:`${r.left-pad}px`,top:`${r.top-pad}px`,width:`${r.width+pad*2}px`,height:`${r.height+pad*2}px`});
  const width=panel.offsetWidth,height=panel.offsetHeight;
  let x,y;
  if(r.right+gap+width<=innerWidth-edge){x=r.right+gap;y=r.top+(r.height-height)/2}
  else if(r.left-gap-width>=edge){x=r.left-gap-width;y=r.top+(r.height-height)/2}
  else{x=r.left;y=r.bottom+gap+height<=innerHeight-edge?r.bottom+gap:r.top-gap-height}
  x=Math.max(edge,Math.min(x,innerWidth-width-edge));y=Math.max(edge,Math.min(y,innerHeight-height-edge));
  const key=`${x}:${y}:${width}:${height}`;
  if(key===layoutKey)return;
  layoutKey=key;panelMotion?.cancel();
  panel.style.left=`${x}px`;panel.style.top=`${y}px`;
  if(before){
   const dx=before.left-x,dy=before.top-y;
   if(Math.abs(dx)+Math.abs(dy)>.5)panelMotion=animate(panel,[{transform:`translate(${dx}px,${dy}px)`},{transform:'translate(0,0)'}],{duration:320});
  }
 }
 function refresh(){
  if(!active)return;
  if(getState().root&&!preview){stop();onComplete();return}
  const entering=layer.hidden,before=entering?null:panel.getBoundingClientRect();
  const route=getRoute(),index=route.page!=='settings'?0:route.tab!=='data'?1:2,changed=index!==step;
  const current=steps[index],target=document.querySelector(current.target);
  if(!target)return;
  if(changed){step=index;target.scrollIntoView({block:'nearest',inline:'nearest'})}
  const phase=preview||index!==2?'ready':getState().scanning?'scanning':getBusy()?'choosing':'ready',busy=phase!=='ready',key=`${index}:${phase}:${preview}:${getLocale()}`;
  if(contentKey!==key){
   contentKey=key;
   layer.querySelectorAll('.tour-track span').forEach((segment,i)=>segment.dataset.complete=String(i<=index));
   layer.querySelector('.tour-progress').textContent=t('tourProgress',{current:index+1,total:steps.length});
   layer.querySelector('#tourTitle').textContent=t(current.title);
   layer.querySelector('#tourDescription').textContent=t(preview&&index===2?'tourPreviewFolderDescription':phase==='scanning'?'tourScanningDescription':busy?'tourWaitingDescription':current.description);
   next.textContent=t(preview&&index===2?'tourFinishPreview':phase==='scanning'?'tourScanning':busy?'tourWaiting':current.action);next.disabled=!!busy;
   dismiss.textContent=t('tourLater');
   copyMotion?.cancel();
   if(!entering)copyMotion=animate(layer.querySelector('.tour-copy'),[{opacity:0,transform:'translateY(5px)'},{opacity:1,transform:'translateY(0)'}],{duration:220,delay:60,fill:'backwards'});
  }
  if(entering)layer.dataset.entering='true';
  layer.hidden=false;position(target,before);
  if(entering){
   layerMotion=animate(layer,[{opacity:0},{opacity:1}],{duration:240});
   panelMotion=animate(panel,[{transform:'translateY(10px) scale(.985)'},{transform:'translateY(0) scale(1)'}],{duration:320});
   requestAnimationFrame(()=>delete layer.dataset.entering);
  }
  if(changed)panel.focus({preventScroll:true});
 }
 function start({force=false,preview:replay=false}={}){
  if(active||(!replay&&(getState().root||getState().scanning||(!force&&isDismissed()))))return;
  preview=replay;
  layerMotion?.cancel();layerMotion=null;panelMotion?.cancel();copyMotion?.cancel();
  layer.hidden=true;layoutKey='';previousFocus=document.activeElement;active=true;refresh();
 }
 next.onclick=()=>{if(preview&&step===steps.length-1){stop();onPreviewComplete();return}const target=document.querySelector(steps[step]?.target);if(target&&!target.disabled)target.click();schedule()};
 dismiss.onclick=skip;
 document.addEventListener('click',schedule,true);
 document.addEventListener('keydown',event=>{if(active&&event.key==='Escape'&&!event.target.closest?.('dialog[open]')){event.preventDefault();event.stopImmediatePropagation();skip()}},true);
 reducedMotion.addEventListener('change',()=>{if(reducedMotion.matches)for(const animation of [layerMotion,panelMotion,copyMotion])if(animation?.playState==='running')animation.finish()});
 window.addEventListener('resize',schedule);document.addEventListener('scroll',schedule,true);
 // Sidebar transitions can move the first target after its initial measurement.
 document.addEventListener('transitionend',schedule);
 return {start,refresh};
}
