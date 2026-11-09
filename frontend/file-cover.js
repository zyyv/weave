// Document glyphs use the same page silhouette and a format-specific mark.
const families={
 word:{extensions:['doc','docx'],mark:'<path d="m24 37 4 16 5-11 5 11 4-16m6 2h14m-14 8h14m-14 8h10"/>'},
 sheet:{extensions:['xls','xlsx','csv'],mark:'<rect x="25" y="33" width="39" height="24" rx="2"/><path d="M25 41h39m-39 8h39M38 33v24m13-24v24"/>'},
 slide:{extensions:['ppt','pptx'],mark:'<path d="M42 32a13 13 0 1 0 13 13H42z"/><path d="M47 29v11h11a12 12 0 0 0-11-11Z"/>'},
 pdf:{extensions:['pdf'],mark:'<path d="M25 51c9-4 19-17 18-22-1-5-5 1-3 10 2 8 13 16 19 13 6-3 0-7-10-5-10 1-24 7-25 11-1 3 6 2 10-4"/>'},
 markdown:{extensions:['md','markdown'],mark:'<path d="M26 52V37l8 8 8-8v15m11-15v14m-5-5 5 5 5-5"/>'},
 config:{extensions:['json','jsonc','json5','yaml','yml','toml'],mark:'<path d="M38 33h-3a4 4 0 0 0-4 4v4l-4 4 4 4v4a4 4 0 0 0 4 4h3m12-24h3a4 4 0 0 1 4 4v4l4 4-4 4v4a4 4 0 0 1-4 4h-3"/>'},
 text:{extensions:['txt'],mark:'<path d="M29 36h30M29 45h30M29 54h21"/>'},
 code:{extensions:[],mark:'<path d="m36 36-9 9 9 9m16-18 9 9-9 9m-6-13-4 8"/>'}
};
const familyByExtension=new Map(Object.entries(families).flatMap(([family,{extensions}])=>extensions.map(ext=>[ext,family])));

export function documentCover(extension){
 const ext=extension.slice(1).toLowerCase();
 const family=familyByExtension.get(ext)||'code';
 const label=ext==='markdown'?'MD':ext.toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,8);
 return `<svg class="document-cover document-cover--${family}" viewBox="0 0 88 106" aria-hidden="true" focusable="false">
  <path class="document-sheet" d="M19 7h34l20 20v62a9 9 0 0 1-9 9H19a9 9 0 0 1-9-9V16a9 9 0 0 1 9-9Z"/>
  <path class="document-fold" d="M53 7v14a6 6 0 0 0 6 6h14"/>
  <g class="document-mark">${families[family].mark}</g>
  <text x="42" y="80" text-anchor="middle">${label}</text>
 </svg>`;
}
