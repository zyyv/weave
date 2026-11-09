import{a as _,b as V,c as I}from"./chunk-24S7VC4A.mjs";import{b as $,d as L,e as T}from"./chunk-PDZ5B7IR.mjs";import{l as M,n as Z,o as R}from"./chunk-S2JSZNED.mjs";import{d as O,e as H,k as W,l as F}from"./chunk-GPFA75OB.mjs";var j='<span class="msdoc-page-break"></span>',K='<p class="msdoc-paragraph"><br></p>',h={width:794,height:1123},y=.24,A=3,G=.15,X=`
.msdoc-stage{
  box-sizing:border-box;
  min-height:100%;
  padding:32px 24px 48px;
  background:var(--file-viewer-render-surface-background,#ececec);
  display:flex;
  flex-direction:column;
  align-items:center;
  gap:24px;
}
.msdoc-page{
  width:min(100%,794px);
  box-sizing:border-box;
}
.msdoc-page > .msdoc-root{
  box-sizing:border-box;
  width:100%;
  max-width:none;
  min-height:1123px;
  padding:clamp(24px,7%,96px) clamp(20px,6%,88px);
  background:#fff;
  border:1px solid #d9d9d9;
  box-shadow:0 1px 3px rgba(0,0,0,0.08), 0 12px 32px rgba(0,0,0,0.12);
  overflow-wrap:anywhere;
}
/* \u8868\u683C\u4E0D\u80FD\u6CBF\u7528\u6B63\u6587\u7684 anywhere \u65AD\u8BCD\uFF0C\u5426\u5219\u65E7 DOC \u7684\u5217\u5BBD\u548C\u5355\u5143\u683C\u5185\u5BB9\u4F1A\u88AB\u8FC7\u5EA6\u538B\u7F29\u3002 */
.msdoc-page .msdoc-table{
  display:table;
  width:auto;
  max-width:100%;
  table-layout:fixed;
  border-collapse:collapse;
  border-spacing:0;
}
.msdoc-page .msdoc-table tbody,
.msdoc-page .msdoc-table tr{
  width:auto;
}
.msdoc-page .msdoc-cell{
  min-width:1.5em;
  padding:4px 6px;
  vertical-align:top;
  word-break:normal;
  overflow-wrap:normal;
  white-space:normal;
}
.msdoc-page .msdoc-cell .msdoc-paragraph{
  margin:0 0 4px;
  word-break:normal;
  overflow-wrap:break-word;
}
.msdoc-page .msdoc-cell .msdoc-paragraph:last-child{
  margin-bottom:0;
}
.msdoc-page .msdoc-cell span{
  white-space:normal;
}
.msdoc-page .msdoc-page-break{
  display:none;
}
[data-viewer-theme='dark'] .msdoc-stage{
  background:var(--file-viewer-render-surface-background,#111827);
}
[data-viewer-theme='dark'] .msdoc-page > .msdoc-root{
  color-scheme:dark;
  background:#161b22;
  border-color:rgba(139,148,158,.24);
  color:#e6edf3;
  box-shadow:0 18px 44px rgba(0,0,0,.36);
}
[data-viewer-theme='dark'] .msdoc-page > .msdoc-root span[style*='color:#000000']{
  color:#e6edf3!important;
}
[data-viewer-theme='dark'] .msdoc-page .msdoc-link{
  color:#58a6ff;
}
[data-viewer-theme='dark'] .msdoc-page .msdoc-attachment{
  border-color:rgba(139,148,158,.3);
  background:#21262d;
  color:#58a6ff;
}
@media (prefers-color-scheme:dark){
  [data-viewer-theme='system'] .msdoc-stage{
    background:var(--file-viewer-render-surface-background,#111827);
  }
  [data-viewer-theme='system'] .msdoc-page > .msdoc-root{
    color-scheme:dark;
    background:#161b22;
    border-color:rgba(139,148,158,.24);
    color:#e6edf3;
    box-shadow:0 18px 44px rgba(0,0,0,.36);
  }
  [data-viewer-theme='system'] .msdoc-page > .msdoc-root span[style*='color:#000000']{
    color:#e6edf3!important;
  }
  [data-viewer-theme='system'] .msdoc-page .msdoc-link{
    color:#58a6ff;
  }
  [data-viewer-theme='system'] .msdoc-page .msdoc-attachment{
    border-color:rgba(139,148,158,.3);
    background:#21262d;
    color:#58a6ff;
  }
}
@media (max-width: 860px){
  .msdoc-stage{
    padding:16px 12px 24px;
    gap:16px;
  }
  .msdoc-page{
    width:100%;
  }
  .msdoc-page > .msdoc-root{
    min-height:auto;
    padding:24px 20px;
    box-shadow:none;
  }
}
`,U=`
.msdoc-zoom-viewer{
  box-sizing:border-box;
  height:100%;
  overflow:auto;
  background:var(--file-viewer-render-surface-background,#ececec);
}
[data-viewer-theme='dark'] .msdoc-zoom-viewer{
  background:var(--file-viewer-render-surface-background,#111827);
}
@media (prefers-color-scheme:dark){
  [data-viewer-theme='system'] .msdoc-zoom-viewer{
    background:var(--file-viewer-render-surface-background,#111827);
  }
}
.msdoc-zoom-viewer .msdoc-stage{
  min-width:max-content;
}
.msdoc-zoom-viewer .msdoc-page{
  position:relative;
  max-width:none;
  overflow:visible;
}
.msdoc-zoom-viewer .msdoc-page > .msdoc-root{
  position:absolute;
  top:0;
  left:50%;
  width:${h.width}px;
  max-width:none;
  margin:0;
  transform-origin:top center;
}
`,Y=i=>i.ownerDocument.defaultView;function J(i){return i.replace(/<(p|table|section)([^>]*?)style="([^"]*?\bbreak-before\s*:\s*page;?[^"]*?)"([^>]*)>/gi,r=>`${j}${r}`)}function Q(i){return`<div class="msdoc-stage">${J(i).split(j).map(d=>`<section class="msdoc-page"><div class="msdoc-root">${d||K}</div></section>`).join("")}</div>`}function q(i){let r=i.cloneNode(!0);return r.classList.remove("msdoc-zoom-viewer"),r.querySelectorAll("style[data-msdoc-zoom]").forEach(e=>e.remove()),r.querySelectorAll(".msdoc-stage, .msdoc-page, .msdoc-root").forEach(e=>{e.style.height="auto",e.style.maxHeight="none",e.style.overflow="visible",e.style.transform="none"}),r.querySelectorAll(".msdoc-page").forEach((e,d)=>{e.dataset.viewerPrintPageIndex=String(d),Z(e,h,{heightMode:"min"}),e.style.position="relative",e.style.width=M(h.width),e.style.maxWidth="none",e.style.margin="0 auto 18px";let t=e.querySelector(".msdoc-root");t&&(t.style.position="relative",t.style.top="auto",t.style.left="auto",t.style.width=M(h.width),t.style.maxWidth="none",t.style.minHeight=M(h.height),t.style.height="auto",t.style.transform="none",t.style.transformOrigin="top left",t.style.boxShadow="none",t.style.border="0",t.style.overflow="visible")}),r.innerHTML}function ee(){return R({selector:".viewer-export-content .msdoc-page",width:h.width,height:h.height,heightMode:"min"})}function oe(i){let r=Array.from(i.querySelectorAll(".msdoc-page"));if(!r.length)return()=>{};i.classList.add("msdoc-zoom-viewer");let e=Y(i),d=e?.ResizeObserver,t=i.ownerDocument.createElement("style");t.dataset.msdocZoom="true",t.textContent=U,i.prepend(t);let p=W(),n=0,c=1,s=1,l=1,m=o=>V(o,y,A),g=()=>{let o=s,a=l,f=!1;r.forEach(w=>{let v=w.querySelector(".msdoc-root");if(!v)return;let k=v.offsetWidth||h.width,b=Math.max(v.scrollHeight,v.offsetHeight,h.height),E=Math.max(i.clientWidth-48,120),C=Math.min(1,Math.max(y,E/k)),z=m(C*c);f||(o=z,a=C,f=!0),v.style.transform=`translateX(-50%) scale(${z})`,w.style.width=`${Math.ceil(Math.max(k*z,120))}px`,w.style.height=`${Math.ceil(b*z)}px`}),f&&(s=o,l=a,p.emit())},P=()=>{if(!e){g();return}e.cancelAnimationFrame(n),n=e.requestAnimationFrame(()=>{g()})},x=()=>({scale:s,label:`${Math.round(s*100)}%`,canZoomIn:s<A,canZoomOut:s>y,canReset:c!==1,minScale:y,maxScale:A}),S=o=>(_(o)&&(c=o,e?.cancelAnimationFrame(n),g()),x()),D=o=>_(o)?S(m(o)/l):x(),N=()=>{var o;let a=(o=r[0])===null||o===void 0?void 0:o.querySelector(".msdoc-root");return!a?.offsetWidth||!a.offsetHeight?null:{width:a.offsetWidth,height:Math.max(a.scrollHeight,a.offsetHeight)}},B=o=>{var a,f;let w=N(),v=I(i,o);if(!w||!v)return{applied:!1,mode:o.mode,resize:o.resize,source:o.source,reason:"unmeasurable",provider:"zoom"};let k=o.mode==="auto"?"width":o.mode,b=F({mode:k,viewportWidth:v.width,viewportHeight:v.height,contentWidth:w.width,contentHeight:w.height,currentScale:s,minScale:(a=o.minScale)!==null&&a!==void 0?a:y,maxScale:(f=o.maxScale)!==null&&f!==void 0?f:A});if(!b||!_(b))return{applied:!1,mode:o.mode,resize:o.resize,source:o.source,reason:"unmeasurable",provider:"zoom"};let E=D(b);return{applied:!0,mode:o.mode,resize:o.resize,scale:E.scale,source:o.source,provider:"zoom"}};i.dataset.viewerZoomProvider="doc",O(i,{zoomIn:()=>S((s+G)/Math.max(l,.01)),zoomOut:()=>S((s-G)/Math.max(l,.01)),resetZoom:()=>S(1),setZoom:D,fit:B,getState:x,subscribe:p.subscribe});let u=d?new d(P):null;return u?.observe(i),r.forEach(o=>{let a=o.querySelector(".msdoc-root");a&&u?.observe(a)}),g(),()=>{e?.cancelAnimationFrame(n),u?.disconnect(),H(i),t.remove(),i.classList.remove("msdoc-zoom-viewer")}}async function re(i,r,e){var d,t,p,n,c,s,l,m,g;let P=await T(i,{renderOptions:{reviewMode:(p=(t=(d=e?.options)===null||d===void 0?void 0:d.docx)===null||t===void 0?void 0:t.reviewMode)!==null&&p!==void 0?p:"all",css:$(),externalLinkPolicy:(s=(c=(n=e?.options)===null||n===void 0?void 0:n.docx)===null||c===void 0?void 0:c.externalLinkPolicy)!==null&&s!==void 0?s:"block",externalResourcePolicy:(g=(m=(l=e?.options)===null||l===void 0?void 0:l.docx)===null||m===void 0?void 0:m.externalResourcePolicy)!==null&&g!==void 0?g:"block"}});return te(P,r,e)}function te(i,r,e){var d,t;let p=r.ownerDocument.defaultView;if(!p)throw new Error("The DOC target must belong to a browser document");let n=r.ownerDocument.createElement("style");n.dataset.msdoc="",n.textContent=`${i.css}
${X}`;let c=r.ownerDocument.createElement("div");c.append(L(Q(i.html),p)),r.replaceChildren(n,...Array.from(c.childNodes));let s=oe(r);return(d=e?.registerExportAdapter)===null||d===void 0||d.call(e,{includeDocumentStyles:!1,getPrintMaskPages:()=>Array.from(r.querySelectorAll(".msdoc-page")),printStyle:ee,toHtml:()=>q(r)}),(t=e?.registerThumbnailAdapter)===null||t===void 0||t.call(e,{getTarget:()=>r.querySelector(".msdoc-page")||r}),{$el:r,unmount(){var l,m;(l=e?.registerExportAdapter)===null||l===void 0||l.call(e,null),(m=e?.registerThumbnailAdapter)===null||m===void 0||m.call(e,null),s(),r.replaceChildren()}}}export{re as a,te as b};
