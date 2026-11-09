import {getLocale} from './i18n.js';

const groupHeight=64;
// Viewport-only DOM. Grid cards keep their natural height; row offsets follow measured content.
export class VirtualList {
 constructor(scroller,root,paint,onEnd){
  Object.assign(this,{scroller,root,paint,onEnd,rows:[],groups:[],key:'',heights:new Map()});
  this.sticky=document.createElement('div');
  this.sticky.className='time-group-sticky';
  this.sticky.setAttribute('aria-hidden','true');
  this.sticky.hidden=true;
  this.stickyLabel=document.createElement('div');
  this.stickyLabel.className='time-group';
  this.sticky.append(this.stickyLabel);
  root.before(this.sticky);
  let frame;
  const schedule=()=>{if(frame)return;frame=requestAnimationFrame(()=>{frame=0;this.draw()})};
  scroller.addEventListener('scroll',schedule,{passive:true});this.observer=new ResizeObserver(()=>{this.rebuild();schedule()});this.observer.observe(scroller);
 }
 set(items,options){
  this.items=items;this.options=options;
  this.scroller.classList.toggle('has-sticky-groups',!!options.stickyGroups);
  this.sticky.hidden=true;
  this.rebuild();this.draw();
 }
 itemKey(item){return `${this.width}:${this.options.compact}:${this.options.scopes}:${item.hash||item.id}`}
 rebuild(){
  if(!this.options)return;const {scopes,list,compact,group}=this.options,width=this.root.clientWidth;
  this.width=width;
  this.columns=list?1:Math.max(1,Math.floor((width+16)/((scopes?270:compact?130:158)+16)));this.gap=list?0:16;this.height=scopes?(compact?200:228):list?88:compact?175:210;
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
     const heading={label:formatter.format(date),top,height:groupHeight};
     this.rows.push(heading);this.groups.push(heading);top+=groupHeight;
    }
   }
   bucket.push(item);if(bucket.length===this.columns)flush();
  }
  flush();this.contentHeight=top;this.root.style.height=top+'px';this.key='';
 }
 drawSticky(top){
  if(!this.options.stickyGroups||!this.groups.length||top<=0||top>=this.contentHeight){
   this.sticky.hidden=true;return;
  }
  // Locate the active heading even when its row has left the virtual window.
  let lo=0,hi=this.groups.length;
  while(lo<hi){
   const mid=(lo+hi)>>1;
   if(this.groups[mid].top<=top)lo=mid+1;else hi=mid;
  }
  const heading=this.groups[lo-1];
  const nextTop=this.groups[lo]?.top??this.contentHeight;
  if(this.stickyLabel.textContent!==heading.label)this.stickyLabel.textContent=heading.label;
  this.stickyLabel.style.transform=`translateY(${Math.min(0,nextTop-top-groupHeight)}px)`;
  this.sticky.hidden=false;
 }
 draw(){
  if(!this.options||this.root.hidden||!this.scroller.clientHeight)return;
  const viewportTop=this.scroller.getBoundingClientRect().top+this.scroller.clientTop-this.root.getBoundingClientRect().top;
  const top=Math.max(0,viewportTop),bottom=top+this.scroller.clientHeight;
  this.drawSticky(viewportTop);
  let lo=0,hi=this.rows.length;while(lo<hi){const mid=(lo+hi)>>1;if(this.rows[mid].top+this.rows[mid].height<top-350)lo=mid+1;else hi=mid}
  let end=lo;while(end<this.rows.length&&this.rows[end].top<bottom+350)end++;
  const key=lo+':'+end;
  if(key!==this.key){
   this.key=key;const rows=this.rows.slice(lo,end);this.root.querySelectorAll('.time-group').forEach(node=>node.remove());this.paint(rows.flatMap(r=>r.items||[]));let index=0;const nodes=[...this.root.children],measure=[];
   for(const row of rows){
    if(row.label){const h=document.createElement('h2');h.className='time-group';h.textContent=row.label;h.style.top=row.top+'px';this.root.insertBefore(h,nodes[index]||null);continue}
    for(let col=0;col<row.items.length;col++){
     const node=nodes[index++];node.style.position='absolute';node.style.top=row.top+'px';node.style.left=`calc(${col} * (100% + ${this.gap}px) / ${this.columns})`;node.style.width=`calc((100% - ${(this.columns-1)*this.gap}px) / ${this.columns})`;node.style.height=this.options.list?row.height+'px':'auto';
     if(!this.options.list)measure.push({node,item:row.items[col]});
    }
   }
   let changed=false;
   for(const {node,item} of measure){const key=this.itemKey(item),height=Math.ceil(node.getBoundingClientRect().height);if(height&&this.heights.get(key)!==height){this.heights.set(key,height);changed=true}}
   if(changed){const anchor=this.rows.find(r=>r.items&&r.top+r.height>top),id=anchor?.items[0];this.rebuild();if(id&&anchor.top<top){const next=this.rows.find(r=>r.items?.[0]===id);if(next)this.scroller.scrollTop+=next.top-anchor.top}this.draw();return}
  }
  if(bottom+600>=parseFloat(this.root.style.height))this.onEnd();
 }
}
