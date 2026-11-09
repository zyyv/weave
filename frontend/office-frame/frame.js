const appOrigin=new URLSearchParams(location.search).get('parent');
const target=document.querySelector('#office-document');
const vendor=name=>new URL('./vendor/'+name,import.meta.url).href;
const renderers={
 '.doc':word,'.docx':word,'.xls':spreadsheet,'.xlsx':spreadsheet,'.ppt':presentation,'.pptx':presentation
};
const abort=new AbortController();
let started=false,instance;

async function word(){
 return (await import('./vendor/word.mjs')).renderFileViewerWordDoc;
}
async function spreadsheet(){
 return (await import('./vendor/spreadsheet.mjs')).renderFileViewerSpreadsheet;
}
async function presentation(ext){
 const engine=await import('./vendor/presentation.mjs');
 return ext==='.ppt'?engine.renderFileViewerBinaryPresentation:engine.renderFileViewerPresentation;
}

window.addEventListener('message',async event=>{
 if(event.source!==parent||event.origin!==appOrigin||started)return;
 const {type,buffer,filename,ext,locale,theme}=event.data||{};
 if(type!=='office-source'||!(buffer instanceof ArrayBuffer)||!Object.hasOwn(renderers,ext))return;
 started=true;
 document.documentElement.lang=locale==='zh-CN'?'zh-CN':'en';
 document.documentElement.dataset.theme=theme==='light'?'light':'dark';
 target.dataset.viewerTheme=document.documentElement.dataset.theme;
 try{
  const render=await renderers[ext](ext);
  const options={
   locale:locale==='zh-CN'?'zh':'en',
   theme:document.documentElement.dataset.theme,
   docx:{
    worker:true,workerUrl:vendor('docx.worker.js'),workerJsZipUrl:vendor('jszip.min.js'),
    externalLinkPolicy:'block',externalResourcePolicy:'block'
   },
   spreadsheet:{workerUrl:vendor('sheet.worker.js')},
   presentation:{workerUrl:vendor('pptx.worker.js'),pptWorkerUrl:vendor('ppt.worker.js')}
  };
  instance=await render(buffer,target,ext.slice(1),{filename,signal:abort.signal,options});
  if(!abort.signal.aborted)parent.postMessage({type:'office-ready'},appOrigin);
 }catch(error){
  console.error('Office preview',error);
  if(!abort.signal.aborted)parent.postMessage({type:'office-error'},appOrigin);
 }
});
window.addEventListener('pagehide',()=>{
 abort.abort();
 instance?.destroy?.();
},{once:true});
document.addEventListener('keydown',event=>{
 if(event.key!=='Escape'||event.defaultPrevented||event.isComposing||event.repeat||document.fullscreenElement||!appOrigin)return;
 event.preventDefault();
 parent.postMessage({type:'office-escape'},appOrigin);
});
