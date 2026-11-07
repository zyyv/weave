import {getLocale} from './i18n.js';
// Viewport-only DOM. Grid cards keep their natural height; row offsets follow measured content.
export class VirtualList {
 constructor(scroller,root,paint,onEnd){
  Object.assign(this,{scroller,root,paint,onEnd,rows:[],key:'',heights:new Map()});let frame;
  const schedule=()=>{if(frame)return;frame=requestAnimationFrame(()=>{frame=0;this.draw()})};
  scroller.addEventListener('scroll',schedule,{passive:true});this.observer=new ResizeObserver(()=>{this.rebuild();schedule()});this.observer.observe(scroller);
 }
 set(items,options){this.items=items;this.options=options;this.rebuild();this.draw()}
 itemKey(item){return `${this.root.clientWidth}:${this.options.compact}:${this.options.scopes}:${item.hash||item.id}`}
 rebuild(){
  if(!this.options)return;const {scopes,list,compact,group}=this.options,width=this.root.clientWidth;
  this.columns=list?1:Math.max(1,Math.floor((width+16)/((scopes?270:compact?130:158)+16)));this.gap=list?0:16;this.height=scopes?(compact?200:228):list?88:compact?175:210;
  this.rows=[];let top=0,bucket=[],date='';
  const flush=()=>{if(!bucket.length)return;const height=list?this.height:Math.max(...bucket.map(item=>this.heights.get(this.itemKey(item))||this.height));this.rows.push({items:bucket,top,height});top+=height+this.gap;bucket=[]};
  for(const item of this.items||[]){const next=group?new Date(item.modified).toLocaleDateString(getLocale(),{year:'numeric',month:'long',day:'numeric'}):'';if(next!==date){flush();date=next;this.rows.push({label:date,top,height:64});top+=64}bucket.push(item);if(bucket.length===this.columns)flush()}
  flush();this.root.style.height=top+'px';this.key='';
 }
 draw(){
  if(!this.options||!this.scroller.clientHeight)return;
  const top=Math.max(0,this.scroller.scrollTop-this.root.offsetTop+this.scroller.offsetTop),bottom=top+this.scroller.clientHeight;
  let lo=0,hi=this.rows.length;while(lo<hi){const mid=(lo+hi)>>1;if(this.rows[mid].top+this.rows[mid].height<top-350)lo=mid+1;else hi=mid}
  let end=lo;while(end<this.rows.length&&this.rows[end].top<bottom+350)end++;
  const key=lo+':'+end;
  if(key!==this.key){
   this.key=key;const rows=this.rows.slice(lo,end);this.paint(rows.flatMap(r=>r.items||[]));let index=0;const nodes=[...this.root.children],measure=[];
   for(const row of rows){
    if(row.label){const h=document.createElement('h2');h.className='time-group';h.textContent=row.label;h.style.top=row.top+'px';this.root.append(h);continue}
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
