import {getLocale,t} from './i18n.js';

const firstOfMonth=(date,offset=0)=>new Date(date.getFullYear(),date.getMonth()+offset,1);
const fromValue=value=>new Date(value+'T00:00:00');
const dayValue=date=>[
 String(date.getFullYear()).padStart(4,'0'),
 String(date.getMonth()+1).padStart(2,'0'),
 String(date.getDate()).padStart(2,'0')
].join('-');
const orderedRange=(a,b)=>a<=b?[a,b]:[b,a];

export function createTimelineDatePicker(root,onChange){
 const summary=root.querySelector('summary');
 const label=summary.querySelector('span');
 const months=root.querySelector('#timelineMonths');
 const hint=root.querySelector('#timelineDateHint');
 const clear=root.querySelector('#timelineClearDates');
 const alignPanel=()=>root.style.setProperty('--timeline-trigger-left',root.offsetLeft+'px');
 const resize=new ResizeObserver(()=>{if(root.open)alignPanel()});
 resize.observe(root.parentElement);
 let range={start:'',end:''},month,anchor='',locale;

 function draw(){
  const monthFormat=new Intl.DateTimeFormat(locale,{month:'long',year:'numeric'});
  const dayFormat=new Intl.DateTimeFormat(locale,{dateStyle:'full'});
  const weekdayFormat=new Intl.DateTimeFormat(locale,{weekday:'short'});
  const today=dayValue(new Date());
  const weekdays=Array.from({length:7},(_,i)=>weekdayFormat.format(new Date(2024,0,7+i)));
  months.innerHTML=[month,firstOfMonth(month,1)].map(first=>{
   const count=new Date(first.getFullYear(),first.getMonth()+1,0).getDate();
   const cells=[];
   const target=[anchor,range.start,today].find(value=>value.slice(0,7)===dayValue(first).slice(0,7))||dayValue(first);
   for(let i=0;i<Math.ceil((first.getDay()+count)/7)*7;i++){
    const day=i-first.getDay()+1;
    const date=new Date(first.getFullYear(),first.getMonth(),day);
    if(day<1||day>count){
     cells.push('<span class="timeline-outside-day" aria-hidden="true">'+date.getDate()+'</span>');
     continue;
    }
    const value=dayValue(date);
    cells.push('<span class="timeline-day-cell"><button type="button" data-day="'+value+
     '" aria-label="'+dayFormat.format(date)+'" aria-pressed="false" tabindex="'+(target===value?0:-1)+
     '"'+(value===today?' aria-current="date"':'')+'>'+day+'</button></span>');
   }
   return '<section class="timeline-month"><h3>'+monthFormat.format(first)+'</h3><div class="timeline-month-grid">'+
    weekdays.map(day=>'<span class="timeline-weekday">'+day+'</span>').join('')+cells.join('')+'</div></section>';
  }).join('');
  highlight();
 }

 function highlight(preview=''){
  const [start,end]=anchor?orderedRange(anchor,preview||anchor):[range.start,range.end];
  for(const button of months.querySelectorAll('[data-day]')){
   const {day}=button.dataset;
   const selected=!!start&&day>=start&&day<=end;
   button.setAttribute('aria-pressed',String(selected));
   const cell=button.parentElement;
   cell.classList.toggle('in-range',selected);
   cell.classList.toggle('range-start',day===start);
   cell.classList.toggle('range-end',day===end);
  }
  hint.textContent=t(anchor?'timelineChooseEnd':'timelineChooseStart');
 }

 function finish(start,end){
  anchor='';
  onChange(start,end);
  highlight();
 }

 function shift(offset){
  month=firstOfMonth(month,offset);
  draw();
 }

 root.addEventListener('toggle',()=>{
  if(!root.open)return;
  alignPanel();
  anchor='';
  month=firstOfMonth(fromValue(range.start||dayValue(new Date())));
  if(range.end&&range.end.slice(0,7)!==range.start.slice(0,7)){
   month=firstOfMonth(fromValue(range.end),-1);
  }
  draw();
 });
 root.querySelector('#timelinePreviousMonth').onclick=()=>shift(-1);
 root.querySelector('#timelineNextMonth').onclick=()=>shift(1);
 clear.onclick=()=>finish('','');
 months.onclick=event=>{
  const day=event.target.closest('[data-day]')?.dataset.day;
  if(!day)return;
  if(anchor){
   finish(...orderedRange(anchor,day));
  }else{
   anchor=day;
   highlight();
  }
 };
 months.onpointerover=event=>{
  if(anchor)highlight(event.target.closest('[data-day]')?.dataset.day);
 };
 months.onpointerleave=()=>{if(anchor)highlight()};
 root.addEventListener('keydown',event=>{
  if(event.key==='Escape'&&root.open){
   event.preventDefault();
   root.open=false;
   summary.focus();
   return;
  }
  const day=event.target.dataset.day;
  const steps={ArrowLeft:-1,ArrowRight:1,ArrowUp:-7,ArrowDown:7};
  if(!day||!Object.hasOwn(steps,event.key))return;
  event.preventDefault();
  const date=fromValue(day);
  date.setDate(date.getDate()+steps[event.key]);
  const value=dayValue(date);
  const find=()=>months.querySelector('[data-day="'+value+'"]');
  let target=find();
  if(!target?.getClientRects().length){
   month=firstOfMonth(date);
   draw();
   target=find();
  }
  const grid=target.closest('.timeline-month');
  grid.querySelector('[tabindex="0"]')?.setAttribute('tabindex','-1');
  target.tabIndex=0;
  target.focus();
  if(anchor)highlight(value);
 });
 document.addEventListener('pointerdown',event=>{
  if(root.open&&!root.contains(event.target))root.open=false;
 });
 for(const button of root.querySelectorAll('[data-range-days],[data-range-months]')){
  button.onclick=()=>{
   const today=new Date();
   const start=button.dataset.rangeMonths?firstOfMonth(today,-Number(button.dataset.rangeMonths)):new Date(today);
   if(button.dataset.rangeMonths){
    const lastDay=new Date(start.getFullYear(),start.getMonth()+1,0).getDate();
    start.setDate(Math.min(today.getDate(),lastDay));
   }else{
    start.setDate(start.getDate()-Number(button.dataset.rangeDays)+1);
   }
   finish(dayValue(start),dayValue(today));
  };
 }

 return {update(nextRange,visible){
  const currentLocale=getLocale();
  const redraw=root.open&&locale!==currentLocale;
  const changed=range.start!==nextRange.start||range.end!==nextRange.end;
  locale=currentLocale;
  range=nextRange;
  root.hidden=!visible;
  if(!visible)root.open=false;
  const active=!!(range.start&&range.end);
  const format=new Intl.DateTimeFormat(locale,{dateStyle:'medium'});
  const start=active?format.format(fromValue(range.start)):'';
  label.textContent=active?(range.start===range.end?start:start+' – '+format.format(fromValue(range.end))):t('timelineDateFilter');
  summary.title=active?label.textContent:t('timelineModifiedDate');
  summary.classList.toggle('active',active);
  clear.hidden=!active;
  if(visible&&root.open&&month){
   if(redraw)draw();
   else if(changed)highlight();
  }
 }};
}
