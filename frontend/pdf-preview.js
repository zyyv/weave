// Keep page positions in the scroll flow while allocating canvases only nearby.
export async function mountPDFPreview(root,pdf,{signal,loading,name,pageLabel,failure}) {
 const first=await pdf.getPage(1);
 const firstSize=first.getViewport({scale:1});
 first.cleanup();
 if(signal.aborted)return;

 const viewer=document.createElement('div');
 viewer.className='pdf-preview';
 const status=loading();
 status.classList.add('pdf-loading');
 const surface=document.createElement('div');
 surface.className='pdf-surface';
 surface.tabIndex=0;
 surface.setAttribute('aria-label',name);
 const pages=Array.from({length:pdf.numPages},(_,index)=>{
  const page=document.createElement('div');
  page.className='pdf-page';
  page.dataset.page=String(index+1);
  page.style.aspectRatio=String(firstSize.width/firstSize.height);
  return page;
 });
 for(const page of pages)surface.append(page);
 viewer.append(surface,status);
 root.replaceChildren(viewer);

 let activePage,renderTask;
 const nearby=new Set();
 const observer=new IntersectionObserver(entries=>{
  for(const {target,isIntersecting} of entries){
   if(isIntersecting)nearby.add(target);
   else {
    nearby.delete(target);
    if(activePage===target)renderTask?.cancel();
    target.replaceChildren();
   }
  }
  drawNext();
 },{root:surface,rootMargin:'480px 0px'});
 for(const page of pages)observer.observe(page);
 const resizeObserver=new ResizeObserver(drawNext);
 resizeObserver.observe(surface);
 signal.addEventListener('abort',()=>{
  observer.disconnect();
  resizeObserver.disconnect();
  renderTask?.cancel();
  nearby.clear();
 },{once:true});

 async function drawNext(){
  if(activePage||signal.aborted)return;
  const top=surface.getBoundingClientRect().top;
  const distance=page=>{const box=page.getBoundingClientRect();return Math.max(top-box.bottom,box.top-top,0)};
  let slot;
  for(const page of nearby){
   const existing=page.firstElementChild;
   if(existing&&(existing.tagName!=='CANVAS'||Number(existing.dataset.layoutWidth)>=page.clientWidth))continue;
   if(!slot||distance(page)<distance(slot))slot=page;
  }
  if(!slot)return;
  activePage=slot;
  let page;
  try{
   const number=Number(slot.dataset.page);
   page=await pdf.getPage(number);
   if(signal.aborted||!nearby.has(slot))return;
   const size=page.getViewport({scale:1});
   slot.style.aspectRatio=String(size.width/size.height);
   const dpr=Math.min(devicePixelRatio||1,2);
   const width=slot.clientWidth;
   const scale=Math.min(width*dpr/size.width,3200/Math.max(size.width,size.height));
   const viewport=page.getViewport({scale});
   const canvas=document.createElement('canvas');
   canvas.width=Math.max(1,Math.floor(viewport.width));
   canvas.height=Math.max(1,Math.floor(viewport.height));
   canvas.dataset.layoutWidth=String(width);
   canvas.setAttribute('role','img');
   canvas.setAttribute('aria-label',pageLabel(number,pdf.numPages));
   renderTask=page.render({canvas,viewport});
   await renderTask.promise;
   if(!signal.aborted&&nearby.has(slot))slot.replaceChildren(canvas);
  }catch(error){
   if(!signal.aborted&&nearby.has(slot)&&error.name!=='RenderingCancelledException'){
    slot.replaceChildren(failure(()=>{
     slot.replaceChildren();
     drawNext();
    }));
   }
  }finally{
   page?.cleanup();
   if(slot.firstChild)status.remove();
   renderTask=null;
   activePage=null;
   drawNext();
  }
 }
}
