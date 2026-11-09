import {t} from './i18n.js';
import {iconSvg} from './icons.js';
// Native form state + one shared listbox. Long labels wrap; only visible options mount.
const controls=new Map();
const optionGap=4;
let active=null,panel,viewport,spacer,query,filtered=[],rows=[],highlight=0,installed=false,totalHeight=0;
const measure=document.createElement('canvas').getContext('2d');
export function syncSelects(){
 for(const [select,button] of controls){
  if(!select.isConnected){button.remove();controls.delete(select);continue}
  button.hidden=select.hidden;button.disabled=select.disabled;
  const label=select.selectedOptions[0]?.textContent||t('pleaseSelect');
  if(button.querySelector('span').textContent!==label)button.querySelector('span').textContent=label;button.title=label;
  button.setAttribute('aria-label',select.getAttribute('aria-label')||document.querySelector(`label[for="${select.id}"]`)?.textContent||t('selectLabel'));
 }
 if(active&&(!active.isConnected||active.hidden||active.disabled))close();
}
function close(){if(active)controls.get(active)?.setAttribute('aria-expanded','false');active=null;panel?.hidePopover()}
function focusTarget(){return query.hidden?viewport:query}
function draw(){
 if(!active)return;
 let lo=0,hi=rows.length;
 while(lo<hi){const m=(lo+hi)>>1;if(rows[m].top+rows[m].height<viewport.scrollTop-80)lo=m+1;else hi=m}
 spacer.replaceChildren();spacer.style.height=Math.max(36,totalHeight)+'px';
 if(!filtered.length){const empty=document.createElement('div');empty.className='select-empty';empty.textContent=t('noMatchingOptions');spacer.append(empty)}
 let renderedHighlight=false;
 for(let i=lo;i<rows.length&&rows[i].top<viewport.scrollTop+viewport.clientHeight+80;i++){
  const {option,top,height}=rows[i],node=document.createElement('div');node.id='select-option-'+i;node.role='option';node.className='select-option'+(i===highlight?' highlighted':'');
  node.setAttribute('aria-selected',String(option.value===active.value));node.setAttribute('aria-disabled',String(option.disabled));node.style.top=top+'px';node.style.height=height+'px';
  const label=document.createElement('span');label.textContent=option.textContent;node.append(label);
  if(option.dataset.description){
   label.className='select-option-with-description';
   const description=document.createElement('small');
   description.textContent=option.dataset.description;
   description.title=description.textContent;
   label.append(description);
  }
  if(option.value===active.value){const check=document.createElement('span');check.className='select-check';check.innerHTML=iconSvg('check');check.setAttribute('aria-hidden','true');node.append(check)}
  node.onpointerdown=e=>e.preventDefault();node.onclick=()=>choose(i);spacer.append(node);if(i===highlight)renderedHighlight=true;
 }
 focusTarget().setAttribute('aria-activedescendant',renderedHighlight?'select-option-'+highlight:'');
}
function layout(){
 if(!active)return;
 const r=controls.get(active).getBoundingClientRect();measure.font='13px -apple-system, BlinkMacSystemFont, "PingFang SC", sans-serif';
 const longest=Math.max(0,...filtered.map(o=>measure.measureText(o.textContent).width));
 const width=Math.min(Math.max(query.hidden?0:220,active.dataset.optionDetails?350:0,r.width,longest+64),620,innerWidth-16);
 panel.style.width=width+'px';panel.style.left=Math.max(8,Math.min(r.left,innerWidth-width-8))+'px';
 let top=0;const available=width-64;
 rows=filtered.map(option=>{let lines=1,lineWidth=0;for(const char of option.textContent){const w=measure.measureText(char).width;if(char==='\n'||lineWidth+w>available){lines++;lineWidth=char==='\n'?0:w}else lineWidth+=w}const height=Math.max(38,lines*20+16+(option.dataset.description?18:0)),row={option,top,height};top+=height+optionGap;return row});totalHeight=Math.max(0,top-optionGap);
 const below=innerHeight-r.bottom-12,above=r.top-12,space=Math.max(below,above),searchHeight=query.hidden?0:44;
 const cap=Math.min(320,Math.max(38,space-searchHeight-14));const fitted=rows.filter(row=>row.top+row.height<=cap).at(-1);const listHeight=totalHeight<=cap?Math.max(38,totalHeight):fitted?fitted.top+fitted.height:cap;
 viewport.style.height=listHeight+'px';const height=listHeight+searchHeight+14;
 panel.style.top=(below>=height||below>=above?r.bottom+5:Math.max(8,r.top-height-5))+'px';
}
function reveal(){const row=rows[highlight];if(!row)return;if(row.top<viewport.scrollTop)viewport.scrollTop=row.top;else if(row.top+row.height>viewport.scrollTop+viewport.clientHeight)viewport.scrollTop=row.top+row.height-viewport.clientHeight}
function filter(){if(!active)return;const q=query.hidden?'':query.value.trim().toLocaleLowerCase();filtered=[...active.options].filter(o=>!o.hidden&&o.textContent.toLocaleLowerCase().includes(q));highlight=Math.max(0,filtered.findIndex(o=>o.value===active.value));layout();viewport.scrollTop=0;reveal();draw()}
function choose(i){const option=filtered[i];if(!option||option.disabled)return;const select=active,button=controls.get(select);select.value=option.value;close();select.dispatchEvent(new Event('change',{bubbles:true}));syncSelects();button.focus()}
function open(select){
 if(active===select){close();return}close();active=select;const button=controls.get(select);button.setAttribute('aria-expanded','true');query.value='';
 query.hidden=select.dataset.search==='never'||(select.dataset.search!=='always'&&select.options.length<=12);
 viewport.setAttribute('aria-label',button.getAttribute('aria-label'));
 (select.closest('dialog')||document.body).append(panel);panel.showPopover();filter();focusTarget().focus({preventScroll:true});
}
function onKey(e){
 if(!active)return;
 if(e.key==='Escape'){e.preventDefault();e.stopPropagation();const b=controls.get(active);close();b?.focus()}
 else if(e.key==='Enter'||(query.hidden&&e.key===' ')){e.preventDefault();e.stopPropagation();choose(highlight)}
 else if(['ArrowDown','ArrowUp','Home','End'].includes(e.key)){
  e.preventDefault();e.stopPropagation();const step=e.key==='ArrowUp'||e.key==='End'?-1:1;
  let next=e.key==='Home'?0:e.key==='End'?filtered.length-1:highlight+step;
  while(next>=0&&next<filtered.length&&filtered[next].disabled)next+=step;
  highlight=Math.max(0,Math.min(filtered.length-1,next));reveal();draw();
 }else if(e.key==='Tab')close();
}
export function installSelects(){
 if(installed)return;installed=true;panel=document.createElement('div');panel.className='select-popup';panel.popover='manual';
 panel.innerHTML=`<input class="select-search" data-i18n-aria-label="searchOptions" data-i18n-placeholder="searchConversations" role="combobox" aria-label="${t('searchOptions')}" aria-expanded="true" aria-controls="custom-options" placeholder="${t('searchConversations')}"><div class="select-viewport" id="custom-options" role="listbox" tabindex="0"><div class="select-spacer"></div></div>`;
 document.body.append(panel);query=panel.querySelector('input');viewport=panel.querySelector('.select-viewport');spacer=panel.querySelector('.select-spacer');query.oninput=filter;viewport.onscroll=draw;panel.onkeydown=onKey;
 const scan=()=>{
  document.querySelectorAll('select:not([data-custom])').forEach(select=>{
   select.dataset.custom='true';select.tabIndex=-1;select.setAttribute('aria-hidden','true');
   const b=document.createElement('button');b.type='button';b.className='custom-select';b.setAttribute('aria-haspopup','listbox');b.setAttribute('aria-expanded','false');b.setAttribute('aria-controls','custom-options');b.innerHTML=`<span></span>${iconSvg('down')}`;select.after(b);controls.set(select,b);
   b.onclick=()=>open(select);b.onkeydown=e=>{if(['ArrowDown','ArrowUp'].includes(e.key)){e.preventDefault();open(select)}};select.addEventListener('change',syncSelects);
  });syncSelects();
 };
 new MutationObserver(records=>{if(records.some(r=>{if(panel.contains(r.target)||r.target.closest?.('.custom-select'))return false;if(r.target.closest?.('select'))return true;return [...r.addedNodes,...r.removedNodes].some(n=>n.nodeType===1&&(n.matches('select')||n.querySelector('select')))}))scan()}).observe(document.body,{childList:true,subtree:true});scan();
 document.addEventListener('pointerdown',e=>{if(active&&!panel.contains(e.target)&&!controls.get(active)?.contains(e.target))close()},true);
 document.addEventListener('scroll',e=>{if(active&&!panel.contains(e.target))close()},true);window.addEventListener('resize',close);document.addEventListener('close',close,true);
 document.addEventListener('click',e=>{const label=e.target.closest('label[for]'),select=label&&document.getElementById(label.htmlFor);if(controls.has(select)){e.preventDefault();controls.get(select).focus()}});
}
