import {getLocale,t} from './i18n.js';
import {iconSvg} from './icons.js';

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
  const count=activity.days[dateKey(day)]||0;
  const level=count?Math.max(1,Math.ceil(4*Math.sqrt(count/peak))):0;
  const label=`${fullDate.format(day)} · ${t('files',{p0:number(count)})}`;
  cells.push(`<button type="button" class="usage-day" data-level="${level}" tabindex="${+day===+last?0:-1}" aria-label="${label}" title="${label}" style="grid-column:${week};grid-row:${row+2}"></button>`);
 }
 return `<div class="usage-calendar-scroll"><div class="usage-calendar" style="--weeks:${week-1}" role="group" aria-label="${t('usageActivity')}">
  ${weekdays.join('')}${months.join('')}${cells.join('')}
 </div></div>
 <div class="usage-calendar-footer">
  <output>${fullDate.format(first)} – ${fullDate.format(last)}</output>
  <span class="usage-legend">${t('usageLess')}${[0,1,2,3,4].map(level=>`<i data-level="${level}"></i>`).join('')}${t('usageMore')}</span>
 </div>`;
}

export function renderUsage(root,{name,counts,sizes,folders,activity,status,retry,labels,bytes,esc}){
 const number=n=>n.toLocaleString(getLocale());
 const percent=new Intl.NumberFormat(getLocale(),{style:'percent',maximumFractionDigits:1});
 const categories=Object.entries(labels).map(([kind,label])=>({kind,label,count:counts[kind]||0,size:sizes[kind]||0}));
 const totalCount=categories.reduce((sum,row)=>sum+row.count,0);
 const totalSize=categories.reduce((sum,row)=>sum+row.size,0);
 const metric=(icon,label,value)=>`<div class="usage-metric" data-metric="${icon}">
  <dt><span class="usage-metric-icon" aria-hidden="true">${iconSvg(icon)}</span><span>${t(label)}</span></dt>
  <dd>${value}</dd>
 </div>`;
 root.innerHTML=`<header class="usage-heading">
  <h1 id="usageTitle" tabindex="-1">${t('usageOverview')}</h1>
  <p>${esc(name)}</p>
 </header>
 <dl class="usage-metrics">
  ${metric('drive','usageTotalSize',bytes(totalSize))}
  ${metric('folder','folders',number(folders))}
  ${metric('file','usageTotalFiles',number(totalCount))}
 </dl>
 <section class="usage-section" aria-labelledby="usageTypesTitle">
  <h2 id="usageTypesTitle">${t('usageTypes')}</h2>
  <div class="usage-share" aria-hidden="true" ${totalSize===0?'hidden':''}>${categories.filter(row=>row.size>0).map(row=>`<span data-kind="${row.kind}" style="flex-grow:${row.size/totalSize}"></span>`).join('')}</div>
  <table class="usage-types" aria-labelledby="usageTypesTitle">
   <thead><tr><th scope="col">${t('usageType')}</th><th scope="col">${t('usageTotalFiles')}</th><th scope="col">${t('usageTotalSize')}</th><th scope="col">${t('usageShare')}</th></tr></thead>
   <tbody>${categories.map(({kind,label,count,size})=>`<tr data-kind="${kind}"><th scope="row"><i></i>${label}</th><td>${number(count)}</td><td>${bytes(size)}</td><td>${percent.format(totalSize?size/totalSize:0)}</td></tr>`).join('')}</tbody>
  </table>
 </section>
 <section class="usage-section" aria-labelledby="usageActivityTitle">
  <h2 id="usageActivityTitle">${t('usageActivity')}</h2>
  ${activity?calendar(activity,number):`<p class="usage-status" role="status">${t(status)} ${retry?`<button type="button" class="usage-retry">${t('retry')}</button>`:''}</p>`}
 </section>`;
 if(retry)root.querySelector('.usage-retry').onclick=retry;
 const grid=root.querySelector('.usage-calendar');
 if(!grid)return;
 const scroll=grid.parentElement;
 scroll.scrollLeft=scroll.scrollWidth-scroll.clientWidth;
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
 grid.addEventListener('keydown',event=>{
  const delta={ArrowLeft:-7,ArrowRight:7,ArrowUp:-1,ArrowDown:1}[event.key];
  if(!delta)return;
  event.preventDefault();
  buttons[Math.max(0,Math.min(buttons.length-1,buttons.indexOf(event.target)+delta))].focus();
 });
}
