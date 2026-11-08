import {t} from './i18n.js';
import {icon} from './icons.js';

// All transforms affect this preview only. The source file is never written.
export function mountImageViewer(container, item, {onLoad, onError}) {
 const shell=document.createElement('div');shell.className='image-viewer';
 const stage=document.createElement('div');stage.className='image-stage';stage.tabIndex=0;stage.setAttribute('aria-label',t('imageInteraction'));
 const img=new Image();img.alt=item.name;img.draggable=false;
 const status=document.createElement('span');status.className='image-status';status.textContent=t('loading');status.setAttribute('role','status');
 const tools=document.createElement('div');tools.className='image-tools';tools.setAttribute('role','toolbar');tools.setAttribute('aria-label',t('imageInteraction'));
 let zoom=1,x=0,y=0,loaded=false,disposed=false,idleTimer,keyboard=false;const pointers=new Map();let pinch=null;
 const minus=button('zoomOut','zoomOut',()=>scale(zoom/1.25));
 const value=button('restart','resetImageView',reset);
 const plus=button('zoomIn','zoomIn',()=>scale(zoom*1.25));
 const background=button('transparency','transparentBackground',()=>{const active=stage.classList.toggle('checkerboard');background.setAttribute('aria-pressed',String(active))});background.setAttribute('aria-pressed','false');
 const percentage=document.createElement('output');percentage.className='image-zoom-value';percentage.textContent='100%';percentage.setAttribute('aria-label',t('zoomLevel'));
 tools.append(minus,percentage,plus,value,background);stage.append(img,status);shell.append(stage,tools);container.replaceChildren(shell);
 function wake(){if(disposed)return;clearTimeout(idleTimer);shell.classList.remove('tools-hidden');tools.inert=false;idleTimer=setTimeout(hideTools,3000)}
 function hideTools(){if(disposed)return;if(pointers.size||(keyboard&&tools.contains(document.activeElement))){idleTimer=setTimeout(hideTools,1000);return}shell.classList.add('tools-hidden');tools.inert=true}
 shell.addEventListener('selectstart',e=>e.preventDefault());shell.addEventListener('dragstart',e=>e.preventDefault());
 shell.addEventListener('pointermove',wake);shell.addEventListener('pointerdown',()=>{keyboard=false;wake()});shell.addEventListener('wheel',wake,{passive:true});shell.addEventListener('keydown',()=>{keyboard=true;wake()});shell.addEventListener('focusin',wake);
 wake();
 function button(text,key,fn){const b=document.createElement('button');b.type='button';b.innerHTML=icon(text);b.title=t(key);b.setAttribute('aria-label',t(key));b.onclick=fn;return b}
 function bounds(){const base=Math.min(stage.clientWidth/img.naturalWidth,stage.clientHeight/img.naturalHeight,1);return {width:img.naturalWidth*base,height:img.naturalHeight*base}}
 function render(){if(!loaded)return;const b=bounds();x=Math.max(-b.width*zoom/2,Math.min(b.width*zoom/2,x));y=Math.max(-b.height*zoom/2,Math.min(b.height*zoom/2,y));img.style.width=b.width+'px';img.style.height=b.height+'px';img.style.transform=`translate(${x}px,${y}px) scale(${zoom})`;percentage.textContent=Math.round(zoom*100)+'%';minus.disabled=zoom<=1;plus.disabled=zoom>=8;stage.classList.toggle('zoomed',zoom>1)}
 function scale(next,cx=0,cy=0){if(!loaded)return;next=Math.max(1,Math.min(8,next));const ratio=next/zoom;x=cx-(cx-x)*ratio;y=cy-(cy-y)*ratio;zoom=next;if(zoom===1)x=y=0;render()}
 function reset(){zoom=1;x=y=0;render()}
 function point(e){const r=stage.getBoundingClientRect();return {x:e.clientX-r.left-r.width/2,y:e.clientY-r.top-r.height/2}}
 stage.addEventListener('wheel',e=>{e.preventDefault();const p=point(e);scale(zoom*Math.exp(-e.deltaY*.002),p.x,p.y)},{passive:false});
 stage.ondblclick=e=>{const p=point(e);scale(zoom>1?1:2,p.x,p.y)};
 stage.onpointerdown=e=>{if(e.button!==0)return;stage.focus();stage.setPointerCapture(e.pointerId);pointers.set(e.pointerId,point(e));pinch=null};
 stage.onpointermove=e=>{if(!pointers.has(e.pointerId))return;const prev=pointers.get(e.pointerId),p=point(e);pointers.set(e.pointerId,p);if(pointers.size===2){const [a,b]=[...pointers.values()];const distance=Math.hypot(a.x-b.x,a.y-b.y);if(pinch)scale(zoom*distance/pinch,(a.x+b.x)/2,(a.y+b.y)/2);pinch=distance}else if(zoom>1){x+=p.x-prev.x;y+=p.y-prev.y;render()}};
 stage.onpointerup=stage.onpointercancel=stage.onlostpointercapture=e=>{pointers.delete(e.pointerId);pinch=null};
 stage.onkeydown=e=>{if(['+','=','-','0'].includes(e.key)){e.preventDefault();if(e.key==='0')reset();else scale(e.key==='-'?zoom/1.25:zoom*1.25)}};
 img.onload=()=>{if(disposed)return;loaded=true;status.hidden=true;render();onLoad(img)};
 img.onerror=()=>{if(disposed)return;status.textContent=t('thisImageFormatCannotBePreviewedExportIt');img.hidden=true;onError?.()};
 img.src='media/'+item.id;
 const observer=new ResizeObserver(()=>render());observer.observe(stage);
 return ()=>{disposed=true;clearTimeout(idleTimer);observer.disconnect();img.onload=img.onerror=null;img.removeAttribute('src');pointers.clear()};
}
