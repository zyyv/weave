import {getLocale,t} from './i18n.js';

export class TimelineRail {
 constructor(root,formatSize,onJump){
  this.formatSize=formatSize;
  this.root=root;
  this.ticks=root.querySelector('.timeline-ticks');
  this.preview=root.querySelector('.timeline-node-preview');
  this.date=this.preview.querySelector('strong');
  this.summary=this.preview.querySelector('span');
  this.buttons=[];
  this.byDay=new Map();
  this.active=new Set();
  this.ticks.onclick=event=>{
   const button=event.target.closest('button');
   if(button)onJump(button.group);
  };
  this.ticks.onpointerover=event=>this.showPreview(event.target.closest('button'));
  this.ticks.onpointerleave=()=>this.showPreview(this.keyboardFocus());
  this.ticks.onfocusin=()=>this.showPreview(this.keyboardFocus());
  this.ticks.onfocusout=event=>{
   if(!this.ticks.contains(event.relatedTarget))this.showPreview(this.ticks.querySelector('button:hover'));
  };
  this.ticks.addEventListener('scroll',()=>this.positionPreview(),{passive:true});
  this.ticks.onkeydown=event=>{
   if(event.key==='Escape'){
    this.showPreview(null);
    return;
   }
   if(event.key!=='ArrowUp'&&event.key!=='ArrowDown')return;
   const next=event.key==='ArrowUp'?event.target.previousElementSibling:event.target.nextElementSibling;
   if(next){
    event.preventDefault();
    next.focus();
   }
  };
 }

 keyboardFocus(){return this.ticks.querySelector('button:focus-visible')}

 setGroups(groups,partial){
  const byDay=new Map();
  let cursor=this.ticks.firstElementChild;
  this.buttons=groups.map((group,index)=>{
   let button=this.byDay.get(group.day);
   if(!button){
    button=document.createElement('button');
    button.type='button';
   }
   button.group=group;
   const incomplete=partial&&index===groups.length-1;
   const count=group.count.toLocaleString(getLocale());
   const size=this.formatSize(group.bytes);
   const summary=count+' · '+size;
   button.summary=incomplete?t('timelineLoadedSummary',{summary}):summary;
   const files=t(incomplete?'timelineLoadedFiles':'files',{p0:count});
   const label=group.label+' · '+files+' · '+size;
   if(button.getAttribute('aria-label')!==label)button.setAttribute('aria-label',label);
   byDay.set(group.day,button);
   if(cursor===button)cursor=cursor.nextElementSibling;
   else this.ticks.insertBefore(button,cursor);
   return button;
  });
  for(const [day,button] of this.byDay)if(!byDay.has(day))button.remove();
  this.byDay=byDay;
  this.root.hidden=!groups.length;
  this.showPreview(this.previewButton?.isConnected?this.previewButton:null);
 }

 showVisible(first,last){
  const visible=first<0?[]:this.buttons.slice(first,last+1);
  const active=new Set(visible);
  for(const button of this.active)if(!active.has(button))button.classList.remove('in-viewport');
  for(const button of active)if(!this.active.has(button))button.classList.add('in-viewport');
  this.active=active;
  const current=visible[0];
  if(!current||this.ticks.matches(':hover')||this.keyboardFocus())return;
  const top=current.offsetTop;
  const bottom=top+current.offsetHeight;
  if(top<this.ticks.scrollTop||bottom>this.ticks.scrollTop+this.ticks.clientHeight){
   this.ticks.scrollTop=top-(this.ticks.clientHeight-current.offsetHeight)/2;
  }
 }

 showPreview(button){
  this.previewButton=button;
  if(button){
   this.date.textContent=button.group.label;
   this.summary.textContent=button.summary;
  }
  this.positionPreview();
 }

 positionPreview(){
  const button=this.previewButton;
  let center;
  if(button){
   const bounds=this.ticks.getBoundingClientRect(),tick=button.getBoundingClientRect();
   const y=tick.top+tick.height/2;
   if(y>=bounds.top&&y<=bounds.bottom)center=y-this.root.getBoundingClientRect().top;
  }
  this.preview.classList.toggle('visible',center!==undefined);
  if(center!==undefined){
   const half=this.preview.offsetHeight/2;
   const top=Math.max(half,Math.min(center,this.root.clientHeight-half));
   this.preview.style.top=top+'px';
  }
 }
}
