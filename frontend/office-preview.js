import {getLocale,t} from './i18n.js';

export class OfficePreviewError extends Error {}

export async function mountOfficePreview(root,item,{signal,loading,onEscape}){
 const [config,response]=await Promise.all([
  fetch('office-viewer',{signal}),
  fetch('document/'+encodeURIComponent(item.id),{signal})
 ]);
 if(response.status===413)throw new OfficePreviewError(t('errors.officePreviewSize'));
 if(!response.ok||!config.ok)throw new OfficePreviewError(t('errors.documentPreviewFailed'));
 const [origin,buffer]=await Promise.all([config.text(),response.arrayBuffer()]);
 if(signal.aborted)return;
 const url=new URL(origin);
 url.searchParams.set('parent',location.origin);
 const frame=document.createElement('iframe');
 frame.title=item.name;
 frame.className='office-preview-frame';
 frame.sandbox='allow-scripts allow-same-origin';
 frame.src=url.href;
 frame.inert=true;
 frame.setAttribute('aria-hidden','true');
 const stage=document.createElement('div');
 stage.className='office-preview-stage';
 const curtain=document.createElement('div');
 curtain.className='office-preview-loading';
 curtain.append(loading());
 stage.append(frame,curtain);
 root.replaceChildren(stage);

 await new Promise((resolve,reject)=>{
  const events=new AbortController();
  const timeout=setTimeout(()=>finish(new OfficePreviewError(t('errors.documentPreviewTimedOut'))),45000);
  function finish(error){
   clearTimeout(timeout);
   events.abort();
   if(error)reject(error);else resolve();
  }
  signal.addEventListener('abort',()=>finish(signal.reason),{once:true,signal:events.signal});
  frame.addEventListener('load',()=>{
   frame.contentWindow.postMessage({
    type:'office-source',buffer,filename:item.name,ext:item.ext,locale:getLocale(),
    theme:document.documentElement.dataset.theme
   },url.origin,[buffer]);
  },{once:true,signal:events.signal});
  window.addEventListener('message',event=>{
   if(event.origin!==url.origin||event.source!==frame.contentWindow)return;
   if(event.data?.type==='office-ready')finish();
   if(event.data?.type==='office-error')finish(new OfficePreviewError(t('errors.documentPreviewFailed')));
  },{signal:events.signal});
 });

 if(signal.aborted)return;
 curtain.remove();
 frame.inert=false;
 frame.removeAttribute('aria-hidden');
 window.addEventListener('message',event=>{
  if(event.origin===url.origin&&event.source===frame.contentWindow&&event.data?.type==='office-escape'){
   onEscape();
  }
 },{signal});
}
