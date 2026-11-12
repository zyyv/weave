const selectionLimit=200;

export function installListGestures(scroll,items,{enabled,context,getSelection,setSelection,move}){
 const box=document.createElement('div');
 box.className='resource-marquee';
 box.hidden=true;
 box.setAttribute('aria-hidden','true');
 scroll.append(box);
 let gesture,dragged,dropTarget,frame;

 function visibleCards(){
  return items.querySelectorAll('.asset[data-id]');
 }
 function updateMarquee(){
  if(!gesture?.active)return;
  if(!enabled()){finish();return}
  const viewport=scroll.getBoundingClientRect();
  const edge=30;
  if(gesture.y<viewport.top+edge)scroll.scrollTop-=12;
  else if(gesture.y>viewport.bottom-edge)scroll.scrollTop+=12;
  const currentY=Math.max(viewport.top,Math.min(viewport.bottom,gesture.y))+scroll.scrollTop;
  const startX=Math.max(viewport.left,Math.min(viewport.right,gesture.startX));
  const endX=Math.max(viewport.left,Math.min(viewport.right,gesture.x));
  const left=Math.min(startX,endX),right=Math.max(startX,endX);
  const top=Math.min(gesture.startY,currentY),bottom=Math.max(gesture.startY,currentY);
  box.style.left=left+'px';
  box.style.top=Math.max(viewport.top,top-scroll.scrollTop)+'px';
  box.style.width=right-left+'px';
  box.style.height=Math.max(0,Math.min(viewport.bottom,bottom-scroll.scrollTop)-Math.max(viewport.top,top-scroll.scrollTop))+'px';
  for(const card of visibleCards()){
   const bounds=card.getBoundingClientRect();
   gesture.cards.set(card.dataset.id,{left:bounds.left,right:bounds.right,top:bounds.top+scroll.scrollTop,bottom:bounds.bottom+scroll.scrollTop});
  }
  const ids=new Set(gesture.base);
  for(const [id,bounds] of gesture.cards){
   if(ids.size>=selectionLimit)break;
   if(bounds.left<right&&bounds.right>left&&bounds.top<bottom&&bounds.bottom>top)ids.add(id);
  }
  const previous=getSelection();
  if(ids.size!==previous.size||[...ids].some(id=>!previous.has(id)))setSelection(ids);
  frame=requestAnimationFrame(updateMarquee);
 }
 function finish(){
  const pointer=gesture?.pointer;
  gesture=null;
  box.hidden=true;
  cancelAnimationFrame(frame);
  if(pointer!==undefined&&scroll.hasPointerCapture(pointer))scroll.releasePointerCapture(pointer);
 }
 scroll.addEventListener('pointerdown',event=>{
  if(!enabled()||event.button!==0||event.pointerType==='touch'||event.target.closest('.asset,button,input,a,select'))return;
  const viewport=scroll.getBoundingClientRect();
  if(event.clientX>=viewport.left+scroll.clientWidth)return;
  gesture={
   pointer:event.pointerId,startX:event.clientX,startY:event.clientY+scroll.scrollTop,
   clientStartY:event.clientY,base:event.ctrlKey||event.metaKey||event.shiftKey?new Set(getSelection()):new Set(),
   cards:new Map(),active:false
  };
  event.preventDefault();
  scroll.setPointerCapture(event.pointerId);
 });
 scroll.addEventListener('pointermove',event=>{
  if(!gesture||event.pointerId!==gesture.pointer)return;
  gesture.x=event.clientX;
  gesture.y=event.clientY;
  if(!gesture.active&&Math.hypot(gesture.x-gesture.startX,gesture.y-gesture.clientStartY)>=5){
   gesture.active=true;
   box.hidden=false;
   updateMarquee();
  }
 });
 for(const type of ['pointerup','pointercancel','lostpointercapture']){
  scroll.addEventListener(type,event=>{if(event.pointerId===gesture?.pointer)finish()});
 }
 window.addEventListener('blur',finish);
 function markDropTarget(target){
  if(dropTarget===target)return;
  dropTarget?.classList.remove('resource-drop-target');
  dropTarget=target;
  target?.classList.add('resource-drop-target');
 }
 function targetFolder(event){
  const target=event.target.closest('.directory[data-id],.breadcrumb [data-move-destination]');
  if(!target||!dragged||!enabled()||dragged.context!==context()||dragged.ids.includes(target.dataset.id))return null;
  return target;
 }
 items.addEventListener('dragstart',event=>{
  const card=event.target.closest('.asset[data-id]');
  if(!card||!enabled()){event.preventDefault();return}
  const id=card.dataset.id;
  const ids=getSelection().has(id)?[...getSelection()]:[id];
  dragged={ids,context:context()};
  event.dataTransfer.effectAllowed='move';
  event.dataTransfer.setData('application/x-weave-resources',String(ids.length));
 });
 document.addEventListener('dragover',event=>{
  const target=targetFolder(event);
  markDropTarget(target);
  if(!target)return;
  event.preventDefault();
  event.dataTransfer.dropEffect='move';
 });
 document.addEventListener('dragleave',event=>{
  if(!dropTarget?.contains(event.relatedTarget))markDropTarget(null);
 });
 document.addEventListener('drop',event=>{
  const target=targetFolder(event);
  const ids=dragged?.ids;
  dragged=null;
  markDropTarget(null);
  if(!target)return;
  event.preventDefault();
  void move(ids,target.dataset.moveDestination??target.dataset.id);
 });
 document.addEventListener('dragend',()=>{dragged=null;markDropTarget(null)});
}
