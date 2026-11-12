import {t} from './i18n.js';
import {mountPDFPreview} from './pdf-preview.js';
import {mountOfficePreview,OfficePreviewError} from './office-preview.js';
import {codeLanguage,mountCodePreview} from './code-preview.js';
import {previewLoading} from './loading-state.js';
import {mountImageViewer} from './image-viewer.js';

const pdfAssets=new URL('./vendor/pdfjs/',import.meta.url).href;
const textExtensions=new Set(['.txt','.md','.markdown','.csv']);
const markdownTags=new Set('A B BLOCKQUOTE BR CODE DEL EM H1 H2 H3 H4 H5 H6 HR IMG LI OL P PRE S STRONG TABLE TBODY TD TH THEAD TR UL'.split(' '));

async function renderMarkdown(source) {
 const {Marked}=await import('./vendor/marked/marked.esm.js');
 const template=document.createElement('template');
 const marked=new Marked({renderer:{
  html:({text})=>text.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;')
 }});
 template.innerHTML=marked.parse(source);
 // Rebuild the fragment with only formatting tags. Links and images contribute
 // their labels, so a local preview cannot navigate or fetch embedded URLs.
 function safeNode(node) {
  if(node.nodeType===Node.TEXT_NODE)return document.createTextNode(node.data);
  if(!markdownTags.has(node.tagName))return document.createDocumentFragment();
  if(node.tagName==='IMG')return document.createTextNode(node.alt);
  const element=document.createElement(node.tagName==='A'?'span':node.tagName);
  if(node.tagName==='OL'&&node.hasAttribute('start'))element.start=node.start;
  element.append(...Array.from(node.childNodes,safeNode));
  return element;
 }
 const article=document.createElement('article');
 article.className='markdown-preview';
 article.append(...Array.from(template.content.childNodes,safeNode));
 return article;
}

export function mountDocumentPreview(root,item,{onEscape,autoFormat=false}) {
 const abort=new AbortController();
 const {signal}=abort;
 let pdfTask;
 const loading=()=>previewLoading(t('preparingDocumentPreview'),item.name);
 function failure(message,retry) {
  const state=document.createElement('div');
  state.className='document-error';
  state.setAttribute('role','status');
  const title=document.createElement('strong'),description=document.createElement('p');
  title.textContent=t('documentPreviewUnavailable');
  description.textContent=message;
  const retryButton=document.createElement('button');
  retryButton.type='button';
  retryButton.textContent=t('retry');
  retryButton.onclick=retry;
  state.append(title,description,retryButton);
  return state;
 }
 async function start() {
  root.replaceChildren(loading());
  try {
   const language=codeLanguage(item.ext);
   if(language||textExtensions.has(item.ext)){
    const response=await fetch('text?id='+encodeURIComponent(item.id),{signal});
    if(!response.ok)throw Error(t('errors.documentPreviewFailed'));
    const source=await response.text();
    if(signal.aborted)return;
    const truncated=response.headers.get('X-Weave-Preview-Truncated')==='1';
    if(language){
     const canFormat=response.headers.get('X-Weave-Can-Format')==='1';
     await mountCodePreview(root,item,source,{language,truncated,canFormat,autoFormat,signal});
     return;
    }
    const markdown=item.ext==='.md'||item.ext==='.markdown';
    const content=markdown?await renderMarkdown(source):document.createElement('pre');
    if(!markdown)content.textContent=source;
    if(signal.aborted)return;
    const surface=document.createElement('div');
    surface.className='text-preview';
    surface.tabIndex=0;
    surface.setAttribute('aria-label',item.name);
    surface.append(content);
    root.replaceChildren(surface);
    return;
   }
   if(item.ext!=='.pdf'){
    await mountOfficePreview(root,item,{signal,loading,onEscape});
    return;
   }
   const url=new URL('document/'+encodeURIComponent(item.id),document.baseURI).href;
   const pdfjs=await import('./vendor/pdfjs/pdf.min.mjs');
   if(signal.aborted)return;
   pdfjs.GlobalWorkerOptions.workerSrc=pdfAssets+'pdf.worker.min.mjs';
   pdfTask=pdfjs.getDocument({url,cMapUrl:pdfAssets+'cmaps/',standardFontDataUrl:pdfAssets+'standard_fonts/',wasmUrl:pdfAssets+'wasm/',iccUrl:pdfAssets+'iccs/',isEvalSupported:false});
   const pdf=await pdfTask.promise;
   if(!signal.aborted)await mountPDFPreview(root,pdf,{
    signal,loading,name:item.name,
    pageLabel:(page,total)=>t('previewPageCount',{page,total}),
    failure:retry=>failure(t('errors.documentPreviewFailed'),retry)
   });
  }catch(error){
   if(signal.aborted||error.name==='AbortException')return;
   const message=error instanceof OfficePreviewError?error.message:
    t(error.name==='PasswordException'?'passwordProtectedPreview':'errors.documentPreviewFailed');
   root.replaceChildren(failure(message,start));
   releasePDF();
  }
 }
 function releasePDF(){
  pdfTask?.destroy().catch(()=>{});
  pdfTask=null;
 }
 start();
 return ()=>{abort.abort();releasePDF()};
}

export function mountSVGPreview(root,item,{source,onModeChange,...imageOptions}){
 return mountImageViewer(root,item,{
  ...imageOptions,
  svg:{source,onModeChange,mountSource:panel=>mountDocumentPreview(panel,item,{autoFormat:true})}
 });
}
