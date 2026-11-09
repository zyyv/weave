import{a as E}from"./chunk-P2H6CKHI.mjs";import{a as B,b as W,c as x,d as Z,e as X,f as w,g as Y,h as u,i as f}from"./chunk-SXETYFM5.mjs";import{c as b,d as D,e as A,f as S}from"./chunk-TLIX2IGF.mjs";import"./chunk-DDLAJ7Z6.mjs";var F=e=>e.replace(/&/g,"&amp;").replace(/"/g,"&quot;").replace(/</g,"&lt;").replace(/>/g,"&gt;"),R={WHOLE_DOCUMENT:!0,USE_PROFILES:{html:!0,svg:!0,svgFilters:!0,mathMl:!0},ADD_TAGS:["use"],ADD_ATTR:["target","rel","download"],FORBID_TAGS:["script","iframe","object","embed","base","form","link"],FORBID_ATTR:["srcdoc"]},k=e=>e||globalThis.document||null,y=e=>/[A-Za-z0-9_-]/.test(e),G=(e,o)=>{let t=o+1,n=e[t]||"";if(!n)return{value:"",nextIndex:t};if(n==="\r"||n===`
`||n==="\f")return n==="\r"&&e[t+1]===`
`&&(t+=1),{value:"",nextIndex:t+1};let r="";for(;t<e.length&&r.length<6&&/[0-9a-f]/i.test(e[t]||"");)r+=e[t],t+=1;if(r){/\s/.test(e[t]||"")&&(t+=1);let a=Number.parseInt(r,16);return{value:a===0||a>1114111?"\uFFFD":String.fromCodePoint(a),nextIndex:t}}return{value:n,nextIndex:t+1}},K=e=>{let o="",t="",n=0;for(;n<e.length;){let r=e[n]||"";if(t){if(o+=r,r==="\\"){o+=e[n+1]||"",n+=2;continue}r===t&&(t=""),n+=1;continue}if(r==="/"&&e[n+1]==="*"){let i=e.indexOf("*/",n+2);n=i<0?e.length:i+2;continue}if(r==='"'||r==="'"){t=r,o+=r,n+=1;continue}if(r==="\\"){let i=G(e,n);o+=i.value,n=i.nextIndex;continue}let a=r.charCodeAt(0);o+=a<32&&r!=="	"&&r!==`
`&&r!=="\r"?" ":r,n+=1}return o},T=/^data:(?:image\/(?:avif|bmp|gif|jpeg|png|webp|x-icon)|font\/(?:collection|otf|sfnt|ttf|woff2?)|application\/(?:font-sfnt|font-woff|vnd\.ms-fontobject|x-font-opentype|x-font-ttf|x-font-woff));/i,J=e=>{let o=/^data:image\/svg\+xml(?:;charset=[A-Za-z0-9._-]+)?,([\s\S]*)$/i.exec(e);if(!o||o[1].length>1024*1024)return!1;let t;try{t=decodeURIComponent(o[1])}catch{return!1}if(!/^\s*<svg(?:\s|>)/i.test(t)||/<\/?(?:script|style|foreignObject|iframe|object|embed|form|link)\b/i.test(t)||/<!\s*(?:doctype|entity)\b/i.test(t)||/\son[a-z0-9_-]+\s*=/i.test(t)||/@import\b/i.test(t)||/url\s*\(\s*(?!["']?#)/i.test(t))return!1;for(let n of t.matchAll(/\s(?:href|xlink:href|src)\s*=\s*(["'])([\s\S]*?)\1/gi)){let r=Q(n[2]||"");if(!/^#[A-Za-z0-9_.:-]+$/.test(r)&&!T.test(r))return!1}return!0},v=e=>{let o="";for(let t of e){let n=t.charCodeAt(0);n<=32||n>=127&&n<=159||(o+=t)}return o.trim()},Q=v,ee=/^data:(?:image\/(?:avif|bmp|gif|jpeg|png|webp|x-icon)|audio\/[a-z0-9.+-]+|video\/[a-z0-9.+-]+|text\/vtt)(?:;[^,]*)?,/i,te=e=>{let o=v(e);return o?o.startsWith("#")||/^blob:/i.test(o)?!0:ee.test(o):!1},m=(e,o,t={})=>{if(!e.hasAttribute(o))return;let n=v(e.getAttribute(o)||"");(t.fragmentOnly?/^#[A-Za-z0-9_.:-]+$/.test(n):te(n))?e.setAttribute(o,n):e.removeAttribute(o)},re=e=>{let o=e.trim(),t=o[0];return(t==='"'||t==="'")&&o[o.length-1]===t&&(o=o.slice(1,-1).trim()),v(o)},ne=e=>{let o=re(e);return o?o.startsWith("#")||/^blob:/i.test(o)?!0:T.test(o)||J(o):!1},oe=(e,o)=>{let t="";for(let n=o;n<e.length;n+=1){let r=e[n]||"";if(t){r==="\\"?n+=1:r===t&&(t="");continue}if(r==='"'||r==="'")t=r;else if(r===")")return n}return-1},C=e=>{let o=!1,t=!1,n="",r=0;for(;r<e.length;){let a=e[r]||"";if(n){if(a==="\\"){r+=2;continue}a===n&&(n=""),r+=1;continue}if(a==="/"&&e[r+1]==="*"){let i=e.indexOf("*/",r+2);r=i<0?e.length:i+2;continue}if(a==='"'||a==="'"){n=a,r+=1;continue}if(a==="\\"){r+=2;continue}if(a==="@"&&e.slice(r+1,r+7).toLowerCase()==="import"){let i=e[r+7]||"";(!i||!y(i))&&(o=!0)}if(e.slice(r,r+3).toLowerCase()==="url"&&!y(e[r-1]||"")){let i=r+3;for(;/\s/.test(e[i]||"");)i+=1;e[i]==="("&&(t=!0)}r+=1}return{hasImport:o,hasUrl:t}},z=e=>{let o=K(e),t=C(o),n=C(e);if(t.hasImport||t.hasUrl&&!n.hasUrl)return"";if(!n.hasUrl)return e;let r="",a="",i=0;for(;i<e.length;){let p=e[i]||"";if(a){if(r+=p,p==="\\"){r+=e[i+1]||"",i+=2;continue}p===a&&(a=""),i+=1;continue}if(p==='"'||p==="'"){a=p,r+=p,i+=1;continue}if(p==="/"&&e[i+1]==="*"){let c=e.indexOf("*/",i+2);if(c<0){r+=e.slice(i);break}r+=e.slice(i,c+2),i=c+2;continue}if(p==="\\"){r+=p,r+=e[i+1]||"",i+=2;continue}if(e.slice(i,i+3).toLowerCase()==="url"&&!y(e[i-1]||"")){let c=i+3;for(;/\s/.test(e[c]||"");)c+=1;if(e[c]==="("){let l=oe(e,c+1);if(l<0)return"";let s=e.slice(c+1,l);r+=ne(s)?e.slice(i,l+1):"none",i=l+1;continue}}r+=p,i+=1}return r},V=e=>{let o=e.defaultView;if(!o)return null;let t=E(o);return t.isSupported?(t.addHook("afterSanitizeElements",n=>{var r;let a=n;if(((r=a.localName)===null||r===void 0?void 0:r.toLowerCase())!=="style")return;let i=z(a.textContent||"");i?a.textContent=i:a.remove()}),t.addHook("afterSanitizeAttributes",n=>{var r;let a=n,i=(r=a.localName)===null||r===void 0?void 0:r.toLowerCase();if(i==="a"&&(a.getAttribute("target")||"").trim().toLowerCase()==="_blank"&&a.setAttribute("rel","noopener noreferrer"),(i==="a"||i==="area")&&a.removeAttribute("ping"),a.hasAttribute("srcset")&&a.removeAttribute("srcset"),["img","audio","video","source","track","input"].includes(i||"")&&m(a,"src"),i==="video"&&m(a,"poster"),a.hasAttribute("background")&&m(a,"background"),a.namespaceURI==="http://www.w3.org/2000/svg"&&i!=="a"){let p=i==="use"||i==="mpath";m(a,"href",{fragmentOnly:p}),m(a,"xlink:href",{fragmentOnly:p})}if(a.hasAttribute("style")){let p=z(a.getAttribute("style")||"");p?a.setAttribute("style",p):a.removeAttribute("style")}}),t):null},ie=['<meta charset="utf-8" />','<meta name="viewport" content="width=device-width,initial-scale=1" />'].join(`
  `),I=(e,o)=>{let t=k(o),n=t?V(t):null;return n?`<!doctype html>
${String(n.sanitize(e,R)).replace("<head>",`<head>
  ${ie}`)}`:`<!doctype html>
<html lang="en"><head><meta charset="utf-8" /></head><body></body></html>`},_=e=>{let o=e.createElement("html");o.lang="en";let t=e.createElement("head"),n=e.createElement("meta");return n.setAttribute("charset","utf-8"),t.append(n),o.append(t,e.createElement("body")),o},ae=e=>{let o=e.querySelector(":scope > head");if(!o)return e;if(!o.querySelector("meta[charset]")){let t=e.ownerDocument.createElement("meta");t.setAttribute("charset","utf-8"),o.prepend(t)}if(!o.querySelector('meta[name="viewport"]')){let t=e.ownerDocument.createElement("meta");t.setAttribute("name","viewport"),t.setAttribute("content","width=device-width,initial-scale=1");let n=o.querySelector("meta[charset]");n?.after(t)}return e},O=(e,o)=>{let t=k(o);if(!t)throw new Error("A browser document is required to build printable DOM.");let n=V(t);if(!n)return _(t);let r=n.sanitize(e,{...R,RETURN_DOM:!0});return!r||r.nodeType!==1||r.localName.toLowerCase()!=="html"?_(t):ae(r)},pe=`
  * { box-sizing: border-box; }
  html, body { margin: 0; min-height: 100%; background: #f2f4f7; color: #172033; font-family: Aptos, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif; print-color-adjust: exact; -webkit-print-color-adjust: exact; }
  body { padding: 24px; }
  .viewer-export-shell { position: relative; min-height: calc(100vh - 48px); overflow: visible; background: #f2f4f7; }
  .viewer-export-content { position: relative; z-index: 1; contain: none; width: 100%; min-height: 100%; overflow: visible; }
  .viewer-export-watermark { position: absolute; inset: 0; pointer-events: none; z-index: 20; background-repeat: repeat; print-color-adjust: exact; -webkit-print-color-adjust: exact; }
  .viewer-export-content .file-render,
  .viewer-export-content .file-viewer,
  .viewer-export-content .viewer-stage,
  .viewer-export-content .content,
  .viewer-export-content .pdf-shell,
  .viewer-export-content .pdf-content,
  .viewer-export-content .pdf-viewport,
  .viewer-export-content .pdf-wrapper,
  .viewer-export-content .docx-fit-viewer,
  .viewer-export-content .docx-wrapper,
  .viewer-export-content .docx-canvas-wrapper,
  .viewer-export-content .msdoc-stage,
  .viewer-export-content .msdoc-paged-view,
  .viewer-export-content .code-viewer,
  .viewer-export-content .markdown-viewer,
  .viewer-export-content .email-shell,
  .viewer-export-content .archive-shell,
  .viewer-export-content .eda-shell,
  .viewer-export-content .ebook-shell,
  .viewer-export-content .umd-shell,
  .viewer-export-content .drawing-shell,
  .viewer-export-content .audio-shell,
  .viewer-export-content .cad-shell,
  .viewer-export-content .cad-body,
  .viewer-export-content .cad-canvas-wrap,
  .viewer-export-content .dwg-preview-frame {
    position: relative !important;
    inset: auto !important;
    contain: none !important;
    width: 100% !important;
    height: auto !important;
    min-height: 0 !important;
    max-height: none !important;
    overflow: visible !important;
  }
  .viewer-export-content .docx-wrapper {
    display: block !important;
    padding: 0 !important;
    background: transparent !important;
  }
  .viewer-export-content .docx-canvas-wrapper {
    display: block !important;
    padding: 0 !important;
    background: transparent !important;
  }
  .viewer-export-content .docx-print-document {
    display: block !important;
    width: fit-content !important;
    max-width: 100% !important;
    height: auto !important;
    overflow: visible !important;
    margin: 0 auto !important;
  }
  .viewer-export-content .docx-page-frame {
    position: relative !important;
    width: var(--viewer-print-page-width, fit-content) !important;
    height: var(--viewer-print-page-height, auto) !important;
    min-height: var(--viewer-print-page-height, 0) !important;
    max-width: 100% !important;
    margin: 0 auto 18px !important;
    overflow: hidden !important;
    break-inside: avoid;
    page-break-inside: avoid;
    break-after: page;
    page-break-after: always;
  }
  .viewer-export-content .docx-canvas-sheet {
    position: relative !important;
    contain: none !important;
    width: var(--viewer-print-page-width, 794px) !important;
    height: var(--viewer-print-page-height, 1123px) !important;
    min-height: var(--viewer-print-page-height, 1123px) !important;
    max-width: 100% !important;
    margin: 0 auto 18px !important;
    overflow: hidden !important;
    box-shadow: none !important;
    break-inside: avoid;
    page-break-inside: avoid;
    break-after: page;
    page-break-after: always;
  }
  .viewer-export-content .docx-canvas-sheet > img {
    display: block !important;
    width: 100% !important;
    height: 100% !important;
    max-width: none !important;
    object-fit: fill;
  }
  .viewer-export-content .msdoc-page {
    position: relative !important;
    width: var(--viewer-print-page-width, 794px) !important;
    min-height: var(--viewer-print-page-height, 1123px) !important;
    max-width: 100% !important;
    height: auto !important;
    margin: 0 auto 18px !important;
    overflow: visible !important;
    break-after: page;
    page-break-after: always;
  }
  .viewer-export-content .docx-page-frame:last-child,
  .viewer-export-content .docx-canvas-sheet:last-child,
  .viewer-export-content .msdoc-page:last-child {
    break-after: auto;
    page-break-after: auto;
  }
  .viewer-export-content .docx-page-frame > section.docx {
    position: relative !important;
    top: auto !important;
    left: auto !important;
    width: var(--viewer-print-page-width, auto) !important;
    min-height: var(--viewer-print-page-height, auto) !important;
    max-width: none !important;
    margin: 0 auto !important;
    overflow: visible !important;
    transform: none !important;
    box-shadow: none !important;
    break-inside: avoid;
    page-break-inside: avoid;
  }
  .viewer-export-content .msdoc-stage {
    display: block !important;
    padding: 0 !important;
    background: transparent !important;
  }
  .viewer-export-content .msdoc-paged-view {
    display: block !important;
    gap: 0 !important;
    padding: 0 !important;
    background: transparent !important;
  }
  .viewer-export-content .msdoc-page > .msdoc-root {
    margin: 0 auto !important;
    box-shadow: none !important;
    overflow: visible !important;
  }
  .viewer-export-content .pdf-toolbar,
  .viewer-export-content .pdf-nav-pane,
  .viewer-export-content .viewer-actions,
  .viewer-export-content .code-toolbar,
  .viewer-export-content .umd-toolbar,
  .viewer-export-content .drawing-toolbar,
  .viewer-export-content .cad-toolbar {
    display: none !important;
  }
  .viewer-export-content .pdf-content,
  .viewer-export-content .pdf-shell--nav-hidden .pdf-content,
  .viewer-export-content .cad-body.without-layers {
    display: block !important;
    grid-template-columns: none !important;
  }
  .viewer-export-content .pdfViewer { padding: 0 !important; }
  .viewer-export-content .pdfViewer .page {
    margin: 0 auto 16px !important;
    border: 0 !important;
    box-shadow: none !important;
    break-after: page;
    page-break-after: always;
  }
  .viewer-export-content .pdfViewer .page:last-child {
    break-after: auto;
    page-break-after: auto;
  }
  .viewer-export-content .pdf-export-document {
    display: grid;
    justify-items: center;
    gap: 18px;
    padding: 4px 0;
  }
  .viewer-export-content .pdf-export-page {
    width: var(--viewer-print-page-width, auto);
    height: var(--viewer-print-page-height, auto);
    max-width: 100%;
    overflow: hidden;
    background: #ffffff;
    box-shadow: 0 12px 32px rgba(15, 23, 42, 0.12);
    break-inside: avoid;
    page-break-inside: avoid;
    break-after: page;
    page-break-after: always;
  }
  .viewer-export-content .pdf-export-page:last-child {
    break-after: auto;
    page-break-after: auto;
  }
  .viewer-export-content .pdf-export-page img {
    display: block;
    width: 100%;
    height: 100%;
    object-fit: contain;
  }
  .viewer-export-content .pptx-wrapper {
    width: 100% !important;
    max-width: 100% !important;
    height: auto !important;
    overflow: visible !important;
    transform: none !important;
  }
  .viewer-export-content .pptx-wrapper .slide {
    margin: 0 auto 18px !important;
    break-inside: avoid;
    page-break-inside: avoid;
    break-after: page;
    page-break-after: always;
    box-shadow: none !important;
  }
  .viewer-export-content .pptx-wrapper .slide:last-child {
    break-after: auto;
    page-break-after: auto;
  }
  .viewer-export-content .ofd-stage {
    padding: 0 !important;
    overflow: visible !important;
  }
  .viewer-export-content .ofd-page,
  .viewer-export-content .drawing-svg,
  .viewer-export-content .cad-canvas-wrap,
  .viewer-export-content .dwg-preview-frame {
    break-inside: avoid;
    page-break-inside: avoid;
    break-after: page;
    page-break-after: always;
    box-shadow: none !important;
  }
  .viewer-export-content .ofd-page:last-child,
  .viewer-export-content .drawing-svg:last-child,
  .viewer-export-content .cad-canvas-wrap:last-child,
  .viewer-export-content .dwg-preview-frame:last-child {
    break-after: auto;
    page-break-after: auto;
  }
  .viewer-export-content .code-area {
    overflow: visible !important;
    white-space: pre-wrap !important;
    word-break: break-word !important;
  }
  .viewer-export-content .umd-body,
  .viewer-export-content .umd-stage-wrap,
  .viewer-export-content .umd-stage {
    display: block !important;
    height: auto !important;
    max-height: none !important;
    overflow: visible !important;
  }
  .viewer-export-content .umd-toc {
    display: none !important;
  }
  img, canvas, svg, video { max-width: 100%; }
  @media print {
    @page { margin: 12mm; }
    html, body { min-height: auto; background: #ffffff; }
    body { padding: 0; }
    .viewer-export-shell,
    .viewer-export-content {
      min-height: 0;
      overflow: visible;
      background: #ffffff;
    }
    .viewer-export-content .docx-print-document {
      width: auto !important;
      max-width: none !important;
      margin: 0 !important;
    }
    .viewer-export-content .pdf-export-document {
      display: block;
      padding: 0;
    }
    .viewer-export-content .pdf-export-page {
      width: var(--viewer-print-page-width, auto) !important;
      height: var(--viewer-print-page-height, auto) !important;
      max-width: none !important;
      margin: 0;
      overflow: hidden;
      box-shadow: none;
    }
    .viewer-export-content .docx-page-frame {
      width: var(--viewer-print-page-width, auto) !important;
      height: var(--viewer-print-page-height, auto) !important;
      min-height: var(--viewer-print-page-height, 0) !important;
      max-width: none !important;
      margin: 0 !important;
      overflow: hidden !important;
    }
    .viewer-export-content .docx-canvas-sheet {
      contain: none !important;
      width: var(--viewer-print-page-width, 794px) !important;
      height: var(--viewer-print-page-height, 1123px) !important;
      min-height: var(--viewer-print-page-height, 1123px) !important;
      max-width: none !important;
      margin: 0 !important;
      overflow: hidden !important;
      box-shadow: none !important;
    }
    .viewer-export-content .msdoc-page {
      width: var(--viewer-print-page-width, 794px) !important;
      min-height: var(--viewer-print-page-height, 1123px) !important;
      max-width: none !important;
      margin: 0 !important;
      overflow: visible !important;
    }
    .viewer-export-content .docx-page-frame > section.docx,
    .viewer-export-content .msdoc-page > .msdoc-root {
      width: var(--viewer-print-page-width, 100%) !important;
      max-width: none !important;
      border: 0 !important;
    }
    .viewer-export-content .pptx-wrapper .slide,
    .viewer-export-content .ofd-page,
    .viewer-export-content .drawing-svg,
    .viewer-export-content .cad-canvas-wrap,
    .viewer-export-content .dwg-preview-frame {
      box-shadow: none !important;
    }
  }
`,P=e=>{let o=k(e);return o?Array.from(o.querySelectorAll('style, link[rel="stylesheet"]')).map(t=>{var n;if(t.localName.toLowerCase()==="style")return`<style>${t.textContent||""}</style>`;let r=t;try{let a=Array.from(((n=r.sheet)===null||n===void 0?void 0:n.cssRules)||[]).map(i=>i.cssText).join(`
`);return a?`<style data-viewer-inlined-stylesheet>${a}</style>`:""}catch{return""}}).filter(Boolean).join(`
`):""},U=({contentHtml:e,includeDocumentStyles:o=!0,printStyle:t="",title:n,watermarkInlineStyle:r="",mask:a=null,documentRef:i})=>{var p,c;let l=r?`<div class="viewer-export-watermark" style="${F(r)}"></div>`:"",s=b(a),d=s?{...s,regions:(p=s.regions)===null||p===void 0?void 0:p.filter(g=>g.pageIndex===void 0),stamps:(c=s.stamps)===null||c===void 0?void 0:c.filter(g=>g.pageIndex===void 0)}:null,h=D(d),j=S(e,s),L=o?P(i):"",q=t?`<style data-viewer-print-style>${t}</style>`:"",N=s?`<style data-viewer-print-mask-style>${A}</style>`:"";return`<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>${F(n)}</title>
  ${L}
  <style>${pe}</style>
  ${N}
</head>
<body>
  <main class="viewer-export-shell">
    <div class="viewer-export-content">${j}</div>
    ${h}
    ${l}
  </main>
  ${q}
</body>
</html>`},H=e=>I(U(e),e.documentRef),M=e=>O(U(e),e.documentRef),$=async({source:e,mode:o="export",title:t,adapter:n=null,watermarkInlineStyle:r="",mask:a=null})=>{let i={mode:o,title:t},p=n?.toHtml,c=b(a);if(p){await f(e,n);let d=await w(await p(i)),h=await u(n,i);return{contentHtml:d,includeDocumentStyles:n.includeDocumentStyles!==!1,printStyle:h,title:t,watermarkInlineStyle:r,mask:c,documentRef:e.ownerDocument}}await f(e,n);let l=e.cloneNode(!0);l.querySelectorAll(".viewer-watermark").forEach(d=>d.remove()),x(e,l);let s=await u(n,i);return{contentHtml:await w(l.innerHTML),printStyle:s,title:t,watermarkInlineStyle:r,mask:c,documentRef:e.ownerDocument}},ce=async e=>H(await $(e)),le=async e=>M(await $(e));export{M as buildExportDomDocument,H as buildExportHtmlDocument,le as buildFileViewerRenderedDomDocument,ce as buildFileViewerRenderedHtmlDocument,P as collectDocumentStyles,w as inlineFileViewerBlobUrlsInHtml,f as prepareFileViewerRenderedContentForSnapshot,x as replaceFileViewerCanvasWithImages,u as resolveFileViewerPrintStyle,O as sanitizeFileViewerExportDocumentDom,I as sanitizeFileViewerExportDocumentHtml,B as triggerFileViewerBlobDownload,W as triggerFileViewerUrlDownload,X as waitForFileViewerImages,Z as waitForFileViewerNextPaint,Y as waitForFileViewerPrintWindowReady};
