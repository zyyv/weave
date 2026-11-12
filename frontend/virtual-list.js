import {getLocale} from './i18n.js';
import {TimelineRail} from './timeline-rail.js';

const groupHeight=64;
// Viewport-only DOM. Grid cards keep their natural height; row offsets follow measured content.
export class VirtualList {
 constructor(scroller,root,paint,onEnd,timelineRoot,formatSize){
  Object.assign(this,{scroller,root,paint,onEnd,rows:[],groups:[],key:'',heights:new Map()});
  this.sticky=document.createElement('div');
  this.sticky.className='time-group-sticky';
  this.sticky.setAttribute('aria-hidden','true');
  this.sticky.hidden=true;
  this.stickyLabel=document.createElement('div');
  this.stickyLabel.className='time-group';
  this.sticky.append(this.stickyLabel);
  root.before(this.sticky);
  this.timeline=new TimelineRail(timelineRoot,formatSize,group=>this.jumpToGroup(group));
  this.jumpFrame=0;
  let frame;
  const schedule=()=>{if(frame)return;frame=requestAnimationFrame(()=>{frame=0;this.draw()})};
  scroller.addEventListener('scroll',()=>{if(!this.jumpFrame)schedule()},{passive:true});
  for(const event of ['wheel','pointerdown'])scroller.addEventListener(event,()=>this.stopJump(),{passive:true});
  this.observer=new ResizeObserver(()=>{
   if(!this.options||root.hidden||!scroller.clientHeight)return;
   if(root.clientWidth!==this.width)this.rebuild();
   schedule();
  });
  this.observer.observe(scroller);
 }
 stopJump(){
  cancelAnimationFrame(this.jumpFrame);
  this.jumpFrame=0;
 }
 viewportTop(){
  return this.scroller.getBoundingClientRect().top+this.scroller.clientTop-this.root.getBoundingClientRect().top;
 }
 jumpToGroup(group){
  this.stopJump();
  const index=this.groups.indexOf(group);
  const start=this.scroller.scrollTop;
  const destination=heading=>Math.max(0,Math.min(
   this.scroller.scrollHeight-this.scroller.clientHeight,
   this.scroller.scrollTop+heading.top-this.viewportTop()
  ));
  if(matchMedia('(prefers-reduced-motion: reduce)').matches){
   this.scroller.scrollTop=destination(group);
   return;
  }
  const duration=Math.min(480,240+Math.abs(destination(group)-start)/12);
  const started=performance.now();
  const step=now=>{
   const target=this.groups[index];
   if(this.root.hidden||!this.options.stickyGroups||target?.day!==group.day){
    this.stopJump();
    return;
   }
   // Virtual rows can change height as they are painted. Resolve the date again each frame.
   const progress=Math.min(1,(now-started)/duration);
   const eased=1-(1-progress)**3;
   this.scroller.scrollTop=start+(destination(target)-start)*eased;
   this.draw();
   if(progress<1){
    this.jumpFrame=requestAnimationFrame(step);
   }else{
    this.scroller.scrollTop=destination(this.groups[index]);
    this.jumpFrame=0;
    this.draw();
   }
  };
  this.jumpFrame=requestAnimationFrame(step);
 }
 set(items,options){
  this.stopJump();
  this.items=items;this.options=options;
  this.scroller.classList.toggle('has-sticky-groups',!!options.stickyGroups);
  this.sticky.hidden=true;
  this.rebuild();this.draw();
 }
 itemKey(item){return `${this.width}:${this.options.compact}:${this.options.scopes}:${item.hash||(item.directory?JSON.stringify([item.folder,item.name]):item.id)}`}
 rebuild(){
  if(!this.options)return;const {scopes,list,compact,group}=this.options,width=this.root.clientWidth;
  if(width!==this.width)this.heights.clear();
  this.width=width;
  this.columns=list?1:Math.max(1,Math.floor((width+16)/((scopes?270:compact?130:158)+16)));this.gap=list?0:16;const cardWidth=(width-(this.columns-1)*this.gap)/this.columns;
  this.height=scopes?(compact?200:228):list?88:Math.ceil(cardWidth+50);
  this.rows=[];this.groups=[];
  let top=0,bucket=[],dayKey;
  const formatter=group?new Intl.DateTimeFormat(getLocale(),{year:'numeric',month:'long',day:'numeric'}):null;
  const flush=()=>{if(!bucket.length)return;const height=list?this.height:Math.max(...bucket.map(item=>this.heights.get(this.itemKey(item))||this.height));this.rows.push({items:bucket,top,height});top+=height+this.gap;bucket=[]};
  for(const item of this.items||[]){
   if(formatter){
    const date=new Date(item.modified);
    const nextDay=date.getFullYear()*10000+(date.getMonth()+1)*100+date.getDate();
    if(nextDay!==dayKey){
     flush();dayKey=nextDay;
     const heading={day:nextDay,label:formatter.format(date),top,height:groupHeight,count:0,bytes:0};
     this.rows.push(heading);this.groups.push(heading);top+=groupHeight;
    }
    const heading=this.groups.at(-1);
    heading.count++;
    heading.bytes+=item.size;
   }
   bucket.push(item);if(bucket.length===this.columns)flush();
  }
  flush();this.contentHeight=top;this.root.style.height=top+'px';this.key='';
  this.timeline.setGroups(this.options.stickyGroups?this.groups:[],this.options.partialGroup);
 }
 drawSticky(top){
  if(!this.options.stickyGroups||!this.groups.length||top<=0||top>=this.contentHeight){
   this.sticky.hidden=true;return;
  }
  const index=this.groupAt(top);
  const heading=this.groups[index];
  const nextTop=this.groups[index+1]?.top??this.contentHeight;
  if(this.stickyLabel.textContent!==heading.label)this.stickyLabel.textContent=heading.label;
  this.stickyLabel.style.transform=`translateY(${Math.min(0,nextTop-top-groupHeight)}px)`;
  this.sticky.hidden=false;
 }
 groupAt(top,inclusive=true){
  let lo=0,hi=this.groups.length;
  while(lo<hi){
   const mid=(lo+hi)>>1;
   const position=this.groups[mid].top;
   if(position<top||(inclusive&&position===top))lo=mid+1;else hi=mid;
  }
  return lo-1;
 }
 draw(){
  if(!this.options||this.root.hidden||!this.scroller.clientHeight)return;
  const viewportTop=this.viewportTop();
  const top=Math.max(0,viewportTop),bottom=top+this.scroller.clientHeight;
  this.drawSticky(viewportTop);
  if(this.options.stickyGroups){
   const visibleBottom=viewportTop+this.scroller.clientHeight;
   const first=visibleBottom>0&&viewportTop<this.contentHeight?this.groupAt(top):-1;
   const end=first<0?first:this.groupAt(visibleBottom,false);
   this.timeline.showVisible(first,end);
  }
  let lo=0,hi=this.rows.length;while(lo<hi){const mid=(lo+hi)>>1;if(this.rows[mid].top+this.rows[mid].height<top-350)lo=mid+1;else hi=mid}
  let end=lo;while(end<this.rows.length&&this.rows[end].top<bottom+350)end++;
  const key=lo+':'+end;
  if(key!==this.key){
   this.key=key;const rows=this.rows.slice(lo,end);this.root.querySelectorAll('.time-group').forEach(node=>node.remove());this.paint(rows.flatMap(r=>r.items||[]));let index=0;const nodes=[...this.root.children],measure=[];
   for(const row of rows){
    if(row.label){const h=document.createElement('h2');h.className='time-group';h.textContent=row.label;h.style.top=row.top+'px';this.root.insertBefore(h,nodes[index]||null);continue}
    for(let col=0;col<row.items.length;col++){
     const node=nodes[index++];node.style.position='absolute';node.style.top=row.top+'px';node.style.left=`calc(${col} * (100% + ${this.gap}px) / ${this.columns})`;node.style.width=`calc((100% - ${(this.columns-1)*this.gap}px) / ${this.columns})`;node.style.height=this.options.list?row.height+'px':'auto';
     if(!this.options.list)measure.push({node,item:row.items[col],row});
    }
   }
   const measuredRows=new Set();
   for(const {node,item,row} of measure){
    const key=this.itemKey(item),height=Math.ceil(node.getBoundingClientRect().height);
    if(height&&this.heights.get(key)!==height){
     this.heights.set(key,height);
     measuredRows.add(row);
    }
   }
   const changed=[...measuredRows].some(row=>row.height!==Math.max(...row.items.map(item=>this.heights.get(this.itemKey(item))||this.height)));
   if(changed){const anchor=this.rows.find(r=>r.items&&r.top+r.height>top),id=anchor?.items[0];this.rebuild();if(!this.jumpFrame&&id&&anchor.top<top){const next=this.rows.find(r=>r.items?.[0]===id);if(next)this.scroller.scrollTop+=next.top-anchor.top}this.draw();return}
  }
  if(bottom+600>=parseFloat(this.root.style.height))this.onEnd();
 }
}
