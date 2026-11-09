import{a as L,b as ie,c as re}from"./chunk-24S7VC4A.mjs";import{a as R,b as O,e as $,f as B,l as H,m as q,n as V,o as ee,s as oe}from"./chunk-S2JSZNED.mjs";import{c as K,d as j}from"./chunk-SXETYFM5.mjs";import"./chunk-TLIX2IGF.mjs";import"./chunk-TGMQPTQW.mjs";import{d as X,e as G,k as J,l as Y}from"./chunk-GPFA75OB.mjs";import{c as Q}from"./chunk-ZEJMMPWF.mjs";import"./chunk-DDLAJ7Z6.mjs";function U(e,o){var r;if(!e)return o;let t=((r=e.ownerDocument.defaultView)===null||r===void 0?void 0:r.getComputedStyle(e).minHeight)||"",a=/^(\d+(?:\.\d+)?)px$/.exec(t.trim()),u=a?Number(a[1]):0;return Number.isFinite(u)&&u>0?u:o}function te(e,o,r){let t=e.querySelector(".docx-wrapper");if(!t)return()=>{};let a=e.ownerDocument.defaultView,u=a?.MutationObserver,s=!1,l=[],i=()=>{if(s||t.dataset.docxPaginating==="true"||t.dataset.docxPaginationScheduled==="true")return;let m=[];for(let d of Array.from(t.children))if(d.matches("section.docx")){let n=e.ownerDocument.createElement("div");n.className=o?"docx-page-frame":"docx-flow-frame",n.dataset.docxResponsiveFrame="true";let w=a?.getComputedStyle(d).backgroundColor;w&&n.style.setProperty("--file-viewer-docx-page-background",w),d.before(n),n.appendChild(d),m.push(n)}else d.getAttribute("data-docx-responsive-frame")==="true"&&m.push(d);(m.length!==l.length||m.some((d,n)=>d!==l[n]))&&(l=m,r([...l]))},v=u?new u(i):null;return v?.observe(t,{childList:!0,attributes:!0,attributeFilter:["data-docx-paginating","data-docx-pagination-scheduled","data-docx-paginated"]}),i(),()=>{s=!0,v?.disconnect(),l=[]}}var W={width:794,height:1123},ue=new Set(["file:","about:","data:"]),_=.24,T=3,ne=.15,ve=20555,fe=e=>{let o=typeof e.renderAsync=="function"?e:e.default;if(!o||typeof o.renderAsync!="function")throw new TypeError("@file-viewer/docx did not expose a compatible renderAsync function.");return o},me=(()=>{let e={module:null,async load(){return this.module||(this.module=import("./docx-preview-T4GMSXJZ.mjs")),this.module}};return async()=>fe(await e.load())})(),pe=(e,o)=>{if((e.byteLength>=4?new DataView(e).getUint16(0,!1):0)!==ve)throw new Error(Q(o?.options)("word.error.invalidDocx"))},S=e=>e.ownerDocument.defaultView,he=e=>{var o,r,t;let a=[e.ownerDocument.URL,(r=(o=S(e))===null||o===void 0?void 0:o.location)===null||r===void 0?void 0:r.href,(t=globalThis.location)===null||t===void 0?void 0:t.href].filter(Boolean);for(let u of a)try{return new URL(u).protocol}catch{}return""},we=(e,o)=>{var r,t;return o?.worker===!1?!1:o?.worker===!0?!0:!!(((t=(r=S(e))===null||r===void 0?void 0:r.Worker)!==null&&t!==void 0?t:globalThis.Worker)&&o?.workerUrl&&!ue.has(he(e)))},xe=e=>{var o;let r=S(e),t=(o=r?.matchMedia)!==null&&o!==void 0?o:globalThis.matchMedia;return typeof t=="function"&&t("(prefers-color-scheme: dark)").matches},ge=(e,o,r)=>{var t;if(r?.darkMode!==void 0)return r.darkMode;let a=oe((t=o?.options)===null||t===void 0?void 0:t.theme);return a==="dark"?!0:a==="light"?!1:xe(e)},ae=(e,o)=>!e||o?e:/[?&]file-viewer-docx=[^&#]*/.test(e)?e.replace(/([?&])file-viewer-docx=[^&#]*/,`$1file-viewer-docx=${R}`):`${e}${e.includes("?")?"&":"?"}file-viewer-docx=${R}`,ye=(e,o,r)=>{var t,a,u,s,l;let i=(t=o?.options)===null||t===void 0?void 0:t.docx,v=O(e.ownerDocument),m=we(e,i),d=i?.visualPagination===!0,n=ge(e,o,i),w=y=>{(y.phase==="render"||y.phase==="layout"||y.phase==="done")&&r()},F=(a=i?.externalLinkPolicy)!==null&&a!==void 0?a:"block",k=(u=i?.externalResourcePolicy)!==null&&u!==void 0?u:"block",f={useWorker:m,exposeDisplayTargets:i?.exposeDisplayTargets===!0,reviewMode:(s=i?.reviewMode)!==null&&s!==void 0?s:"all",breakPages:!0,fixedPageHeight:d,ignoreLastRenderedPageBreak:(l=i?.ignoreLastRenderedPageBreak)!==null&&l!==void 0?l:!d,externalLinkPolicy:F,externalResourcePolicy:k,darkMode:n,reviewPresentation:"inline",progress:w};return m&&(f.workerUrl=ae($(i,v),!!i?.workerUrl),f.workerJsZipUrl=ae(B(i,v),!!i?.workerJsZipUrl)),i?.workerTimeout!==void 0&&(f.workerTimeout=i.workerTimeout),i?.renderPageBatchSize!==void 0?f.renderPageBatchSize=i.renderPageBatchSize:i?.progressive===!1&&(f.renderPageBatchSize=Number.MAX_SAFE_INTEGER),i?.renderYieldEveryMs!==void 0&&(f.renderYieldEveryMs=i.renderYieldEveryMs),i?.strictWordCompatibility!==void 0&&(f.strictWordCompatibility=i.strictWordCompatibility),i?.paginationTolerance!==void 0&&(f.paginationTolerance=i.paginationTolerance),i?.maxDynamicPaginationPasses!==void 0&&(f.maxDynamicPaginationPasses=i.maxDynamicPaginationPasses),i?.awaitLayout!==void 0&&(f.awaitLayout=i.awaitLayout),i?.preserveComplexFieldResults!==void 0&&(f.preserveComplexFieldResults=i.preserveComplexFieldResults),i?.updatePageReferences!==void 0&&(f.updatePageReferences=i.updatePageReferences),i?.hideWebHiddenContent!==void 0&&(f.hideWebHiddenContent=i.hideWebHiddenContent),i?.renderAltChunks!==void 0&&(f.renderAltChunks=i.renderAltChunks),f},be=(e,o)=>{var r;let t=(r=S(o))===null||r===void 0?void 0:r.HTMLElement;return t?e instanceof t:e instanceof HTMLElement},Pe=`
.docx-fit-viewer {
  box-sizing: border-box;
  height: 100%;
  overflow: auto;
  background: var(--file-viewer-render-surface-background, #ececec);
  color-scheme: light;
}
.docx-fit-viewer[data-docx-dark-mode='true'] {
  background: var(--file-viewer-render-surface-background, #242424);
  color-scheme: dark;
}
.docx-fit-viewer .docx-wrapper {
  box-sizing: border-box;
  min-width: 0 !important;
  width: 100% !important;
  padding: 24px 14px 40px !important;
  background: var(--file-viewer-render-surface-background, #e7e9ec) !important;
}
.docx-fit-viewer[data-docx-dark-mode='true'] .docx-wrapper {
  background: var(--file-viewer-render-surface-background, #242424) !important;
}
.docx-fit-viewer .docx-page-frame {
  position: relative;
  width: 100%;
  min-width: 0;
  margin: 0 auto 24px;
  overflow: visible;
}
.docx-fit-viewer .docx-flow-frame {
  position: relative;
  width: 100%;
  min-width: 0;
  margin: 0 auto 28px;
  overflow: visible;
}
.docx-fit-viewer .docx-page-frame > section.docx,
.docx-fit-viewer .docx-flow-frame > section.docx {
  position: absolute;
  top: 0;
  left: 50%;
  margin: 0 !important;
  background-color: var(--file-viewer-docx-page-background, #fff);
  box-shadow: 0 2px 14px rgba(25, 35, 48, 0.18);
  box-sizing: border-box;
  overflow: hidden;
  transform-origin: top center;
}
.docx-fit-viewer[data-docx-dark-mode='true'] .docx-page-frame > section.docx,
.docx-fit-viewer[data-docx-dark-mode='true'] .docx-flow-frame > section.docx {
  box-shadow: 0 0 10px rgba(0, 0, 0, 0.8);
  outline: 1px solid rgba(255, 255, 255, 0.15);
  outline-offset: -1px;
}
.docx-fit-viewer .docx-flow-frame > section.docx {
  height: auto !important;
  min-height: var(--docx-page-height, auto) !important;
  overflow: visible !important;
}
.docx-fit-viewer .docx-page-frame > section.docx > article,
.docx-fit-viewer .docx-flow-frame > section.docx > article {
  position: relative;
  z-index: 1;
}
`;function Se(e){let o=e.ownerDocument.createElement("style");return o.textContent=Pe,e.prepend(o),o}function ke(e,o){var r,t;e.classList.add("docx-fit-viewer");let a=Se(e),u=((t=(r=o?.options)===null||r===void 0?void 0:r.docx)===null||t===void 0?void 0:t.visualPagination)===!0,s=[],l=S(e),i=l?.ResizeObserver,v=0,m=1,d=1,n=1,w=J(),F=c=>ie(c,_,T),k=()=>{let c=d,p=n,g=!1;s.forEach(b=>{let x=b.firstElementChild;if(!be(x,e))return;x.style.transform="translateX(-50%)";let E=x.offsetWidth,D=u?x.offsetHeight:Math.max(x.scrollHeight,x.offsetHeight);if(!E||!D)return;let z=Math.max(e.clientWidth-28,120),N=Math.min(1,Math.max(_,z/E)),A=F(N*m);g||(c=A,p=N,g=!0),x.style.transform=`translateX(-50%) scale(${A})`,b.style.width=`${Math.ceil(Math.max(E*A,e.clientWidth-28,120))}px`,b.style.maxWidth="none",b.style.height=`${Math.ceil(D*A)}px`}),g&&(d=c,n=p,w.emit())},f=()=>{if(!l){k();return}l.cancelAnimationFrame(v),v=l.requestAnimationFrame(()=>{k()})},y=()=>({scale:d,label:`${Math.round(d*100)}%`,canZoomIn:d<T,canZoomOut:d>_,canReset:m!==1,minScale:_,maxScale:T}),M=c=>(L(c)&&(m=c,l?.cancelAnimationFrame(v),k()),y()),I=c=>L(c)?M(F(c)/n):y(),de=()=>{for(let c of s){let p=C(c);if(p&&!(!p.offsetWidth||!p.offsetHeight))return{width:p.offsetWidth,height:P(c)?Math.max(p.scrollHeight,p.offsetHeight):p.offsetHeight}}return null},se=c=>{var p,g;let b=de(),x=re(e,c);if(!b||!x)return{applied:!1,mode:c.mode,resize:c.resize,source:c.source,reason:"unmeasurable",provider:"zoom"};let E=c.mode==="auto"?"width":c.mode,D=Y({mode:E,viewportWidth:x.width,viewportHeight:x.height,contentWidth:b.width,contentHeight:b.height,currentScale:d,minScale:(p=c.minScale)!==null&&p!==void 0?p:_,maxScale:(g=c.maxScale)!==null&&g!==void 0?g:T});if(!D||!L(D))return{applied:!1,mode:c.mode,resize:c.resize,source:c.source,reason:"unmeasurable",provider:"zoom"};let z=I(D);return{applied:!0,mode:c.mode,resize:c.resize,scale:z.scale,source:c.source,provider:"zoom"}};e.dataset.viewerZoomProvider="docx",X(e,{zoomIn:()=>M((d+ne)/Math.max(n,.01)),zoomOut:()=>M((d-ne)/Math.max(n,.01)),resetZoom:()=>M(1),setZoom:I,fit:se,getState:y,subscribe:w.subscribe});let h=i?new i(f):null;h?.observe(e);let ce=te(e,u,c=>{h?.disconnect(),h?.observe(e),s=c,s.forEach(p=>{let g=C(p);g&&h?.observe(g)}),f()});return k(),()=>{l?.cancelAnimationFrame(v),h?.disconnect(),ce(),G(e),a.remove(),e.classList.remove("docx-fit-viewer")}}function C(e){var o;let r=e.firstElementChild,t=(o=e.ownerDocument.defaultView)===null||o===void 0?void 0:o.HTMLElement;return t&&r instanceof t?r:null}function P(e){return!!e?.classList.contains("docx-flow-frame")}function le(e){return!!e?.classList.contains("docx-canvas-sheet")}function Z(e){let o=e?C(e):null;if(!o)return W;let r=q(o,W);return P(e)?{width:r.width,height:Math.max(o.scrollHeight||0,o.offsetHeight||0,U(o,W.height))}:r}function De(e,o){var r;if(le(e)){V(e,o),(r=e.dataset).viewerPrintPageIndex||(r.viewerPrintPageIndex="0"),e.classList.remove("docx-canvas-sheet-pending","docx-canvas-sheet-virtualized"),e.style.position="relative",e.style.contain="none",e.style.margin="0 auto 18px",e.style.boxShadow="none";return}let t=P(e),a=H(o.width),u=H(o.height);V(e,o,{heightMode:t?"min":"fixed"}),e.style.margin="0 auto 18px";let s=C(e);s&&(s.style.position="relative",s.style.top="auto",s.style.left="auto",s.style.width=a,s.style.maxWidth="none",s.style.minHeight=t?"0":u,s.style.height=t?"auto":u,s.style.margin="0 auto",s.style.transform="none",s.style.transformOrigin="top left",s.style.overflow=t?"visible":"hidden",s.style.boxShadow="none")}function Ee(e){let o=Array.from(e.querySelectorAll(".docx-page-frame, .docx-flow-frame, .docx-canvas-sheet")),r=o[0],t=Z(r),a=le(r)?".viewer-export-content .docx-canvas-sheet":P(r)?".viewer-export-content .docx-flow-frame":".viewer-export-content .docx-page-frame";return ee({selector:a,width:t.width,height:P(r)?U(C(r),W.height):t.height,heightMode:P(r)?"min":"fixed",pages:o.some(P)?void 0:o.map(Z)})}async function _e(e){let o=S(e),r=!!e.querySelector(".docx-canvas-sheet"),t=o?.__docxCanvasMaterializeAllPages,a=!1;r&&typeof t=="function"&&(await t.call(o,"file-viewer-print-snapshot"),await j(o),a=!0);try{let u=".docx-page-frame, .docx-flow-frame, .docx-canvas-sheet",s=Array.from(e.querySelectorAll(u)),l=e.cloneNode(!0);K(e,l);let i=l.querySelector(".docx-wrapper"),v=i?i.cloneNode(!1):e.ownerDocument.createElement("div");v.classList.add("docx-print-document"),v.style.padding="0",v.style.background="transparent";let m=Array.from(l.querySelectorAll("style")).filter(d=>{var n;return!(!((n=d.textContent)===null||n===void 0)&&n.includes(".docx-fit-viewer"))}).map(d=>d.outerHTML).join("");return l.querySelectorAll(u).forEach((d,n)=>{d.dataset.viewerPrintPageIndex=String(n),De(d,Z(s[n])),v.appendChild(d.cloneNode(!0))}),v.childElementCount?`${m}${v.outerHTML}`:l.innerHTML}finally{if(a&&o){let u=e.ownerDocument.createEvent("Event");u.initEvent("afterprint",!1,!1),o.dispatchEvent(u)}}}async function ze(e,o,r){var t,a;pe(e,r),o.replaceChildren();let u=!1,s=()=>{var n;u||(u=!0,(n=r?.onProgressiveRender)===null||n===void 0||n.call(r))},l=ye(o,r,s),{defaultOptions:i,renderAsync:v,disposeRenderedDocument:m}=await me();o.dataset.docxWorker=l.useWorker?"self":"false",o.dataset.docxDarkMode=l.darkMode?"true":"false",await v(e,o,void 0,{...i,...l}),s();let d=ke(o,r);return(t=r?.registerExportAdapter)===null||t===void 0||t.call(r,{includeDocumentStyles:!1,getPrintMaskPages:()=>Array.from(o.querySelectorAll(".docx-page-frame, .docx-flow-frame, .docx-canvas-sheet")),beforeSnapshot:()=>{let n=S(o);n&&n.dispatchEvent(new n.Event("resize"))},printStyle:()=>Ee(o),toHtml:()=>_e(o)}),(a=r?.registerThumbnailAdapter)===null||a===void 0||a.call(r,{getTarget:()=>o.querySelector(".docx-page-frame, .docx-flow-frame, .docx-canvas-sheet")||o}),{$el:o,unmount(){var n,w;(n=r?.registerExportAdapter)===null||n===void 0||n.call(r,null),(w=r?.registerThumbnailAdapter)===null||w===void 0||w.call(r,null),d(),m(o),delete o.dataset.docxWorker,delete o.dataset.docxDarkMode,o.replaceChildren()}}}export{ye as createDocxOptions,ze as default};
