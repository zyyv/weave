import {getLocale,t} from './i18n.js';
import {iconSvg} from './icons.js';
import {createUsageMeter} from './usage-meter.js';
import {renderAnimatedNumbers} from './animated-number.js';

function dateKey(date){
 return [date.getFullYear(),date.getMonth()+1,date.getDate()].map(n=>String(n).padStart(2,'0')).join('-');
}

function calendar(activity,number){
 const first=new Date(activity.start+'T12:00:00');
 const last=new Date(activity.end+'T12:00:00');
 const day=new Date(first);
 day.setDate(day.getDate()-day.getDay());
 const fullDate=new Intl.DateTimeFormat(getLocale(),{dateStyle:'medium'});
 const month=new Intl.DateTimeFormat(getLocale(),{month:'short'});
 const weekday=new Intl.DateTimeFormat(getLocale(),{weekday:'short'});
 const weekdays=[],months=[],cells=[];
 let week=0,lastMonth=-1;
 const peak=Math.max(1,...Object.values(activity.days));
 for(let i=0;day<=last;i++,day.setDate(day.getDate()+1)){
  const row=day.getDay();
  week=Math.floor(i/7)+2;
  if(i<7&&[1,3,5].includes(row))weekdays.push(`<span style="grid-row:${row+2}">${weekday.format(day)}</span>`);
  if(day<first)continue;
  if((i===0||row===0||+day===+first)&&day.getMonth()!==lastMonth){
   months.push(`<span class="usage-month" style="grid-column:${week}">${month.format(day)}</span>`);
   lastMonth=day.getMonth();
  }
  const key=dateKey(day);
  const count=activity.days[key]||0;
  const level=count?Math.max(1,Math.ceil(4*Math.sqrt(count/peak))):0;
  const label=`${fullDate.format(day)} · ${t('files',{p0:number(count)})}`;
  cells.push(`<button type="button" class="usage-day" data-date="${key}" data-level="${level}" tabindex="${+day===+last?0:-1}" aria-label="${label}" title="${label}" style="grid-column:${week};grid-row:${row+2}"></button>`);
 }
 return `<div class="usage-calendar-scroll"><div class="usage-calendar" style="--weeks:${week-1}" role="group" aria-label="${t('usageActivity')}">
  ${weekdays.join('')}${months.join('')}${cells.join('')}
 </div></div>
 <div class="usage-calendar-footer">
  <output>${fullDate.format(first)} – ${fullDate.format(last)}</output>
  <span class="usage-legend">${t('usageLess')}${[0,1,2,3,4].map(level=>`<i data-level="${level}"></i>`).join('')}${t('usageMore')}</span>
 </div>`;
}

function sameCalendar(previous,next){
 if(!previous||previous.start!==next.start||previous.end!==next.end)return false;
 const dates=Object.keys(next.days);
 return dates.length===Object.keys(previous.days).length&&dates.every(date=>next.days[date]===previous.days[date]);
}

function bindCalendar(root,{date,scrollLeft,restoreFocus}={}){
 const grid=root.querySelector('.usage-calendar');
 if(!grid)return;
 const scroll=grid.parentElement;
 scroll.scrollLeft=scrollLeft??scroll.scrollWidth-scroll.clientWidth;
 const buttons=[...grid.querySelectorAll('.usage-day')];
 const output=root.querySelector('output');
 function selectDay(button){
  grid.querySelector('[tabindex="0"]').tabIndex=-1;
  button.tabIndex=0;
  output.textContent=button.getAttribute('aria-label');
 }
 grid.addEventListener('click',event=>{
  if(event.target.matches('.usage-day'))selectDay(event.target);
 });
 grid.addEventListener('focusin',event=>selectDay(event.target));
 const selected=date&&buttons.find(button=>button.dataset.date===date);
 if(selected){
  selectDay(selected);
  if(restoreFocus)selected.focus({preventScroll:true});
 }
 grid.addEventListener('keydown',event=>{
  const delta={ArrowLeft:-7,ArrowRight:7,ArrowUp:-1,ArrowDown:1}[event.key];
  if(!delta)return;
  event.preventDefault();
  buttons[Math.max(0,Math.min(buttons.length-1,buttons.indexOf(event.target)+delta))].focus();
 });
}

const categories=[
 ['image',()=>t('images'),'image'],
 ['video',()=>t('videos'),'video'],
 ['voice',()=>t('usageVoice'),'speech'],
 ['audio',()=>t('usageAudio'),'audio'],
 ['document',()=>t('documents'),'file'],
 ['text',()=>t('usageText'),'list'],
 ['design',()=>t('usageDesign'),'layers'],
 ['developer',()=>t('usageDeveloper'),'code'],
 ['data',()=>t('usageData'),'drive'],
 ['archive',()=>t('usageArchive'),'box'],
 ['app',()=>t('usageApps'),'grid'],
 ['other',()=>t('otherFiles'),'folder'],
];
const views=new WeakMap();
const glyph=name=>`<i aria-hidden="true">${iconSvg(name)}</i>`;

function mount(root){
 root.innerHTML=`<header class="usage-heading">
  <h1 id="usageTitle" tabindex="-1"></h1><p></p>
 </header>
 <section class="usage-storage" aria-label="">
   <div class="usage-storage-top">
    <p class="usage-total"><strong>0 B</strong><span></span></p>
    <button class="usage-rescan" type="button">${glyph('refresh')}<span></span></button>
   </div>
   <div class="usage-detail"><p></p></div>
   <div class="usage-meter" aria-hidden="true">
    <div class="usage-meter-glow"></div><div class="usage-meter-fallback"></div><canvas></canvas>
   </div>
   <div class="usage-legend-wrap"><div class="usage-legend-highlight"></div><ul class="usage-categories"></ul></div>
 </section>
 <section class="usage-section" aria-labelledby="usageActivityTitle">
  <h2 id="usageActivityTitle" tabindex="-1"></h2><div class="usage-activity-content"></div>
  <p class="usage-status usage-activity-status" role="status" hidden></p>
 </section>`;
 const get=selector=>root.querySelector(selector);
 const rescan=get('.usage-rescan');
 const chart=get('.usage-meter');
 const legend=get('.usage-categories');
 const highlight=get('.usage-legend-highlight');
 const detail=get('.usage-detail p');
 const glow=get('.usage-meter-glow');
 const fallback=get('.usage-meter-fallback');
 const activityContent=get('.usage-activity-content');
 const activityMessage=get('.usage-activity-status');
 const totalValue=get('.usage-total strong');
 const canvas=get('canvas');
 let rows=[],buttons=[],sizes=[],glows=[],fills=[],widths=[],formatBytes,options={},locale,shownActivity,activityStatus;
 let totalSize=0,totalCount=0,rebuilding=false;
 let active=-1,hover=-1,focused=-1,touched=-1,bounds=[],highlightPrimed=false;
 const reduced=matchMedia('(prefers-reduced-motion: reduce)');
 const number=n=>n.toLocaleString(getLocale());
 const setText=(el,text)=>{if(el.textContent!==text)el.textContent=text};
 const meter=createUsageMeter(canvas,(values,settled)=>{
  const total=values.reduce((sum,value)=>sum+value,0);
  renderAnimatedNumbers(totalValue,'{size}',{size:total},{formats:{size:formatBytes},immediate:true});
  const basis=Math.max(1,total,totalSize);
  rows.forEach((row,i)=>{
   const size=values[i]||0;
   widths[i]=size/basis;
   renderAnimatedNumbers(sizes[i],'{size}',{size},{formats:{size:formatBytes},immediate:true});
   for(const fill of meter.supported?[glows[i]]:[glows[i],fills[i]]){
    const width=`${widths[i]*100}%`;
    if(fill.style.width!==width)fill.style.width=width;
   }
  });
  if(rebuilding&&settled){
   rebuilding=false;
   syncScanButton();
   syncFocus(true);
  }
 });
 fallback.hidden=meter.supported;
 function updateMeterColors(){
  const palette=buttons.map(button=>getComputedStyle(button.firstElementChild).color);
  const ink=getComputedStyle(chart).color;
  meter.setColors(palette,ink);
 }
 new MutationObserver(updateMeterColors).observe(document.documentElement,{
  attributes:true,attributeFilter:['data-theme','data-palette','data-type-colors'],
 });
 function scanning(){return options.scanning||rebuilding}
 function syncScanButton(){
  rescan.setAttribute('aria-disabled',String(!options.canScan||scanning()));
  rescan.classList.toggle('is-scanning',scanning());
 }
 function positionHighlight(){
  const row=buttons[active];
  if(!row)return;
  const w=row.offsetWidth,h=row.offsetHeight,x=row.offsetLeft,y=row.offsetTop;
  if(!w||!h)return;
  const next=[w,h,x,y];
  if(next.every((value,i)=>value===bounds[i]))return;
  bounds=next;
  if(!highlightPrimed){
   highlight.style.transition='none';
   highlightPrimed=true;
  }else highlight.style.transition='';
  highlight.style.width=w+'px';
  highlight.style.height=h+'px';
  highlight.style.transform=`translate(${x}px,${y}px)`;
 }
 new ResizeObserver(positionHighlight).observe(legend);
 function showDetail(){
  const row=rows[active];
  if(row&&!scanning()){
   detail.innerHTML=`<span class="usage-color" data-category="${row.kind}">${glyph(row.icon)}</span><strong>${row.label}</strong>
    <span>${formatBytes(row.size)}</span><span class="usage-detail-note">${t('files',{p0:number(row.count)})} · ${row.share}</span>`;
  }else detail.textContent=scanning()?t('scanning'):options.ready?t('files',{p0:number(totalCount)}):t('waitingToScan');
  detail.getAnimations().forEach(animation=>animation.cancel());
  if(!reduced.matches){
   detail.animate([{opacity:0,transform:'translateY(3px)'},{opacity:1,transform:'translateY(0)'}],{duration:180,easing:'ease-out'});
  }
 }
 function syncFocus(force=false){
  const next=scanning()?-1:hover>=0?hover:focused>=0?focused:touched;
  if(next===active&&!force)return;
  active=next;
  positionHighlight();
  highlight.classList.toggle('visible',active>=0);
  if(active<0){
   highlightPrimed=false;
   bounds=[];
  }
  legend.classList.toggle('has-active',active>=0);
  rows.forEach((row,i)=>{
   buttons[i].classList.toggle('is-active',i===active);
   glows[i].classList.toggle('is-muted',active>=0&&i!==active);
  });
  meter.focus(active);
  showDetail();
 }
 function hoverOn(index){hover=index;syncFocus()}
 chart.addEventListener('pointermove',event=>{
  if(event.pointerType==='touch')return;
  const rect=chart.getBoundingClientRect();
  const x=(event.clientX-rect.left)/rect.width;
  let edge=0;
  hoverOn(widths.findIndex(width=>x<(edge+=width)));
 });
 chart.addEventListener('pointerleave',()=>hoverOn(-1));
 legend.addEventListener('pointerleave',()=>hoverOn(-1));
 root.addEventListener('pointerdown',event=>{
  if(event.pointerType==='touch'&&!event.target.closest('.usage-categories')){touched=-1;syncFocus()}
 });
 rescan.addEventListener('click',()=>{
  if(!options.canScan||scanning())return;
  hover=focused=touched=-1;
  options.rescan();
 });
 function mountLegend(){
  const previousKind=document.activeElement?.closest('.usage-categories')===legend
   ?document.activeElement.dataset.category:null;
  legend.parentElement.hidden=!rows.length;
  legend.innerHTML=rows.map(row=>`<li><button type="button" class="usage-category usage-color" data-category="${row.kind}">${glyph(row.icon)}<span>${row.label}</span><span></span></button></li>`).join('');
  buttons=[...legend.querySelectorAll('button')];
  sizes=buttons.map(button=>button.lastElementChild);
  glow.innerHTML=fallback.innerHTML=rows.map(row=>`<span class="usage-color" data-category="${row.kind}"></span>`).join('');
  glows=[...glow.children];fills=[...fallback.children];
  buttons.forEach((button,index)=>{
   button.addEventListener('pointerenter',event=>{if(event.pointerType!=='touch')hoverOn(index)});
   button.addEventListener('focus',()=>{if(button.matches(':focus-visible')){focused=index;syncFocus()}});
   button.addEventListener('blur',()=>{focused=-1;syncFocus()});
   button.addEventListener('click',event=>{
    if(event.pointerType==='touch'){touched=touched===index?-1:index;syncFocus()}
   });
  });
  return previousKind?buttons.find(button=>button.dataset.category===previousKind)||rescan:null;
 }
 return data=>{
  const localized=locale!==getLocale();
  const reset=localized||options.directory!==data.directory;
  const previousRows=rows;
  const previous=options;
  locale=getLocale();
  options=data;
  formatBytes=data.bytes;
  const percent=new Intl.NumberFormat(locale,{style:'percent',maximumFractionDigits:1});
  rows=categories.flatMap(([kind,label,icon])=>{
   const stats=data.categories[kind];
   return stats?.count?[{kind,label:label(),icon,size:stats.bytes,count:stats.count}]:[];
  });
  totalSize=rows.reduce((sum,row)=>sum+row.size,0);
  totalCount=rows.reduce((sum,row)=>sum+row.count,0);
  for(const row of rows)row.share=percent.format(totalSize?row.size/totalSize:0);
  const categoriesChanged=rows.length!==previousRows.length||rows.some((row,i)=>row.kind!==previousRows[i]?.kind);
  if(localized){
   get('#usageTitle').textContent=t('usageOverview');
   get('#usageActivityTitle').textContent=t('usageActivity');
   get('.usage-storage').setAttribute('aria-label',t('usageTypes'));
   get('.usage-total span').textContent=t('usageTotalSize');
   rescan.lastElementChild.textContent=t('rescan');
  }
  const restoreFocus=localized||categoriesChanged?mountLegend():null;
  if(localized||categoriesChanged)updateMeterColors();
  if(reset||categoriesChanged||data.scanning!==previous.scanning)hover=focused=touched=-1;
  if(reset||data.scanning!==previous.scanning){
   rebuilding=!reset&&!data.scanning&&!reduced.matches;
  }
  setText(get('.usage-heading p'),data.name);
  buttons.forEach((button,i)=>{
   const row=rows[i];
   button.setAttribute('aria-label',`${row.label} · ${data.bytes(row.size)} · ${t('files',{p0:number(row.count)})} · ${row.share}`);
  });
  syncScanButton();
  meter.update(rows.map(row=>row.size),data.scanning,reset||(categoriesChanged&&!rebuilding),categoriesChanged);
  syncFocus(reset||categoriesChanged||previous.scanning!==data.scanning||previous.ready!==data.ready
    ||rows.some((row,i)=>row.size!==previousRows[i]?.size||row.count!==previousRows[i]?.count));
  restoreFocus?.focus({preventScroll:true});
  if(data.activity&&(localized||data.activity!==shownActivity)){
   const focus=activityContent.querySelector('.usage-day[tabindex="0"]');
   const scroll=activityContent.querySelector('.usage-calendar-scroll');
   const hasSelection=activityContent.querySelector('output')?.textContent===focus?.getAttribute('aria-label');
   const saved=scroll&&!reset?{
    date:hasSelection?focus?.dataset.date:null,
    scrollLeft:scroll.scrollLeft,
    restoreFocus:focus===document.activeElement,
   }:undefined;
   if(localized||!sameCalendar(shownActivity,data.activity)){
    activityContent.innerHTML=calendar(data.activity,number);
    bindCalendar(activityContent,saved);
   }
  }else if(!data.activity&&shownActivity)activityContent.replaceChildren();
  shownActivity=data.activity;
  if(localized||data.status!==activityStatus||activityMessage.hidden!==!!(data.activity&&!data.retry)){
   activityStatus=data.status;
   activityMessage.hidden=!!(data.activity&&!data.retry);
   if(!activityMessage.hidden){
    activityMessage.textContent=t(data.status);
    if(data.retry){
     const button=document.createElement('button');
     button.type='button';
     button.className='usage-retry';
     button.textContent=t('retry');
     button.onclick=data.retry;
     activityMessage.append(' ',button);
    }
   }
  }
 };
}

export function renderUsage(root,data){
 if(!views.has(root))views.set(root,mount(root));
 views.get(root)(data);
}
