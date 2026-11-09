import {t, getLocale, setLocale, translateStatic} from './i18n.js';
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
import {icon, iconSvg, renderIcons} from './icons.js';
import {VirtualList} from './virtual-list.js';
import {installSelects, syncSelects} from './select.js';
import {clearVideoCovers, observeVideoCovers} from './video-covers.js';
import {clearAudioCache} from './audio-cache.js';
import {createDirectorySwitcher} from './resource-directories.js';
import {createPrivateSpace} from './private-space.js';
import {NavigationHistory} from './navigation.js';
import {mountPlayer} from './player.js';
import {mountImageViewer} from './image-viewer.js';
import {mountDocumentPreview} from './document-preview.js';
import {documentCover} from './file-cover.js';
import {loadingMark} from './loading-state.js';
import {mountHistogram} from './image-histogram.js';
import {mountTagEditor} from './tag-editor.js';
import {mountImageMetadata} from './image-metadata.js';
import {relativeResourcePath,copyPath} from './path-actions.js';
let disposeTags=null,detailMetadata=null,detailHistogram=null;
import {createSettings} from './settings.js';
import {createSetupTour} from './setup-tour.js';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const bytes=n=>n<1024?n+' B':n<1048576?(n/1024).toFixed(1)+' KiB':n<1073741824?(n/1048576).toFixed(1)+' MiB':(n/1073741824).toFixed(2)+' GiB';
function compactBytes(n){
 const [amount,unit]=bytes(n).split(' ');
 return Number(amount)+unit;
}
const kindLabels=()=>({image:t('images'),video:t('videos'),audio:t('voiceAudio'),document:t('documents'),other:t('otherFiles')});
let labels=kindLabels();
const kindIcon=k=>k==='document'?'file':k==='other'?'box':k;
let prefs={locale:'zh-CN',theme:'dark',palette:'classic',grouped:true,typeColors:true,thumbs:false,density:'comfortable',view:'grid',sort:'date',volume:.8,speed:1,sidebarCollapsed:false},contacts={},source={mode:'auto',grouped:true},sourceBusy=false,state={groups:[],counts:{}},folder='',kind='',star=false,scope='',scopeKinds=[],offset=0,result={items:[],total:0},resultMode=true,selected=new Set(),detail=null,version=0,lastUpdate=0,page='library',disposePlayer=null,detailVersion=0,saveTimer,saveChain=Promise.resolve(),settingsUI,setupTour,choosingSource=false,development=false;
const systemTheme=matchMedia('(prefers-color-scheme: dark)');
const navigation=new NavigationHistory();
let inVault=false,vaultBusy=false,stateRefresh=Promise.resolve();
function routeSnapshot(){return {page,kind,star,scope,folder,scopeKinds:[...scopeKinds],offset,search:$('#search').value,sort:prefs.sort,thumbs:prefs.thumbs,view:prefs.view,settings:settingsUI?.location()||{tab:'general',hash:''},scroll:$(page==='settings'?'#settingsPage':'#resourceScroll').scrollTop}}
function navigationButtons(){$('#navigateBack').disabled=!navigation.canBack;$('#navigateForward').disabled=!navigation.canForward}
function navigate(change){navigation.replace(routeSnapshot());change();navigation.push(routeSnapshot());navigationButtons()}
async function travel(step){
 const route=navigation.move(step,routeSnapshot());if(!route)return;navigationButtons();clearTimeout(searchTimer);if($('#detail').open)closeDetail();
 kind=route.kind;star=route.star;scope=route.scope;folder=route.folder||'';scopeKinds=route.scopeKinds||[];offset=route.offset;$('#search').value=route.search;
 const changed=['sort','thumbs','view'].some(k=>prefs[k]!==route[k]);for(const k of ['sort','thumbs','view'])prefs[k]=route[k];applyTheme();if(changed)persistPrefs();$('#group').value=scope;
 if(route.page==='settings'){page='settings';$('#libraryPage').hidden=true;$('#settingsPage').hidden=false;settingsUI.open(route.settings.tab,route.settings.hash);$('#settingsPage').scrollTop=route.scroll;header();load()}
 else{showLibrary();header();await load({scrollTop:route.scroll})}
 document.body.classList.remove('mobile-nav');applyTheme();setupTour?.refresh();
}
$('#navigateBack').onclick=()=>travel(-1);$('#navigateForward').onclick=()=>travel(1);

async function api(path,data,signal){const r=await fetch('api/'+path,data===undefined?{signal}:{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});if(!r.ok)throw Error(await r.text());return r.json()}
const toastRoot=$('#toast');
const toastCards=[];
const toastDismissals=new WeakMap();
const toastGlyphs={
 success:'<path d="m6 10 2.5 2.5L14 7"/>',
 error:'<path d="M10 5.5v5M10 14.5h.01"/>',
 warning:'<path d="M10 7v4M10 14.5h.01"/>'
};
function toastGlyph(type){
 const shape=type==='warning'?'<path class="toast-icon-fill" d="M8.3 3.6a2 2 0 0 1 3.4 0l7 11.4a2 2 0 0 1-1.7 3H3a2 2 0 0 1-1.7-3Z"/>':'<circle class="toast-icon-fill" cx="10" cy="10" r="9"/>';
 return `<svg viewBox="0 0 20 20">${shape}${toastGlyphs[type]}</svg>`;
}
const toastResize=new ResizeObserver(layoutToasts);

function placeToasts(){
 const modal=$$(CSS.supports('selector(:modal)')?'dialog:modal':'dialog[open]').at(-1);
 const host=modal||document.body;
 if(toastRoot.parentElement!==host)host.append(toastRoot);
 if(toastRoot.childElementCount&&toastRoot.showPopover&&!toastRoot.matches(':popover-open')){
  toastRoot.showPopover();
 }
}

const toastLayers=new MutationObserver(()=>{
 if(toastRoot.childElementCount)placeToasts();
});
for(const dialog of $$('dialog')){
 toastLayers.observe(dialog,{attributes:true,attributeFilter:['open']});
}

function layoutToasts(){
 const frontHeight=toastCards[0]?.offsetHeight||0;
 let offset=0;
 toastCards.forEach((card,depth)=>{
  const scale=1-depth*.045;
  card.style.setProperty('--stack-scale',scale);
  card.style.setProperty('--stack-lift',(card.offsetHeight*scale-frontHeight-depth*9)+'px');
  card.style.setProperty('--expanded-offset',offset+'px');
  card.toggleAttribute('data-front',depth===0);
  offset+=card.offsetHeight+8;
 });
 toastRoot.style.setProperty('--stack-height',Math.max(0,offset-8)+'px');
 toastRoot.style.setProperty('--front-height',frontHeight+'px');
}

function toast(message,type='info'){
 let persistent=type==='loading';
 const card=document.createElement('div');
 card.className='toast-card';
 card.dataset.type=type;
 const mark=document.createElement('span');
 mark.className='toast-icon';
 if(type==='loading')mark.append(loadingMark());
 else if(toastGlyphs[type])mark.innerHTML=toastGlyph(type);
 mark.setAttribute('aria-hidden','true');
 const text=document.createElement('span');
 text.className='toast-message';
 text.setAttribute('role',type==='error'?'alert':'status');
 const close=document.createElement('button');
 close.type='button';
 close.className='toast-dismiss';
 close.setAttribute('aria-label',t('dismissToast'));
 close.innerHTML=icon('close');

 let timer,startedAt,remaining=4000;
 function dismiss(){
  if(card.classList.contains('is-leaving'))return;
  clearTimeout(timer);
  const last=toastCards.length===1;
  if(!last)card.style.transform=getComputedStyle(card).transform;
  card.classList.add(last?'is-sliding-out':'is-fading-out','is-leaving');
  card.inert=true;
  toastCards.splice(toastCards.indexOf(card),1);
  toastResize.unobserve(card);
  layoutToasts();
  function remove(){
   card.remove();
   if(!toastRoot.childElementCount&&toastRoot.hidePopover&&toastRoot.matches(':popover-open')){
    toastRoot.hidePopover();
   }
  }
  Promise.allSettled(card.getAnimations().map(animation=>animation.finished)).then(remove);
 }
 function updateTimer(){
  if(persistent)return;
  const paused=card.matches(':hover, :focus-within');
  if(paused&&timer){
   clearTimeout(timer);
   timer=undefined;
   remaining=Math.max(0,remaining-(performance.now()-startedAt));
  }else if(!paused&&!timer&&!card.inert){
   startedAt=performance.now();
   timer=setTimeout(dismiss,remaining);
  }
 }
 close.onclick=dismiss;
 toastDismissals.set(card,dismiss);
 if(mark.hasChildNodes())card.append(mark);
 card.append(text);
 if(type!=='loading')card.append(close);
 toastRoot.append(card);
 placeToasts();
 text.textContent=String(message??'');
 toastCards.unshift(card);
 toastResize.observe(card);
 layoutToasts();
 if(toastCards.length>3){
  const oldest=toastCards.findLast(item=>item.dataset.type!=='loading');
  if(oldest)toastDismissals.get(oldest)();
 }
 requestAnimationFrame(()=>requestAnimationFrame(()=>{
  if(!card.inert)card.classList.add('is-visible');
 }));
 for(const event of ['mouseenter','mouseleave','focusin','focusout']){
  card.addEventListener(event,()=>queueMicrotask(updateTimer));
 }
 updateTimer();
 return {
  update:message=>{if(text.textContent!==message)text.textContent=message},
  settle(message){
   card.dataset.type='info';
   mark.remove();
   text.textContent=message;
   card.append(close);
   persistent=false;
   updateTimer();
  }
 };
}
async function action(fn){try{await fn()}catch(e){toast(e.message,'error')}}
function color(el,k){el.style.setProperty('--kind-color',`var(--${k})`)}
function applyTheme(){const history=$('.history-controls');if(innerWidth<=720||prefs.sidebarCollapsed){if(history.parentElement!==$('.topbar'))$('.topbar').insertBefore(history,$('#expand'))}else if(history.parentElement!==$('.sidebar-tools'))$('.sidebar-tools').insertBefore(history,$('#collapse'));const root=document.documentElement;root.dataset.theme=prefs.theme==='system'?(systemTheme.matches?'dark':'light'):prefs.theme;root.dataset.palette=prefs.palette;root.dataset.typeColors=prefs.typeColors?'on':'off';document.body.dataset.density=prefs.density;document.body.classList.toggle('collapsed',prefs.sidebarCollapsed);$('#sidebar').inert=innerWidth<=720?!document.body.classList.contains('mobile-nav'):prefs.sidebarCollapsed;$('#collapse').setAttribute('aria-expanded',String(!prefs.sidebarCollapsed));$('#expand').setAttribute('aria-expanded',String(!prefs.sidebarCollapsed));syncGroupingControls();syncSelects();renderNavStats();$('#gridView').classList.toggle('active',prefs.view==='grid');$('#listView').classList.toggle('active',prefs.view==='list')}
function persistPrefs(){clearTimeout(saveTimer);$('#settingsState').textContent=t('saving');saveTimer=setTimeout(()=>{const value={...prefs};saveChain=saveChain.catch(()=>{}).then(()=>api('settings',value)).then(()=>{$('#settingsState').textContent=t('saved')}).catch(e=>{$('#settingsState').textContent=t('saveFailed');toast(t('couldNotSaveSettings')+e.message,'error')})},180)}
function setPref(k,v){prefs[k]=v;if(k==='locale'){applyLocale();persistPrefs();return}if(k==='volume'||k==='speed'){persistPrefs();return}applyTheme();persistPrefs();if(['thumbs','sort','view'].includes(k)){offset=0;load()}else if(k==='density')render()}
systemTheme.addEventListener('change',applyTheme);window.addEventListener('resize',applyTheme);
function isWechat(){return !inVault&&(source.mode==='auto'?(state.detectedMode||'folder'):source.mode)==='wechat'}
function groupingMode(){return source.timeline?'timeline':source.grouped?'grouped':'flat'}
function groupingOptions(){return [['grouped',t(isWechat()?'groupByConversation':'browseFolders')],['flat',t('allFiles')],['timeline',t('groupByTime')]]}
function changeGrouping(mode){
 if(inVault||mode===groupingMode()||!['grouped','flat','timeline'].includes(mode))return;
 return changeSource({grouped:mode==='grouped',timeline:mode==='timeline'});
}
function browseTimeline(){return !inVault&&groupingMode()==='timeline'}
function listSort(){return scope||browseTimeline()?'date':prefs.sort}
function syncGroupingControls(){
 const grouping=$('#scopeGrouping');
 const label=groupingOptions()[0][1];
 if(grouping.options[0].textContent!==label)grouping.options[0].textContent=label;
 grouping.value=groupingMode();
 grouping.hidden=inVault;
 grouping.disabled=!state.root||state.scanning||sourceBusy;
 $('#sort').value=listSort();
 $('#sort').disabled=!!scope||browseTimeline();
}
function browseFolders(){return inVault||!isWechat()&&groupingMode()==='grouped'}
function resultEndpoint(){return isScopes()?'scopes':browseFolders()?'browse':'list'}
function folderName(path){return path.split('/').filter(Boolean).pop()||(inVault?t('privateSpace'):directoryUI.name(state.root))}
function resourceCounts(){return (isWechat()&&!prefs.thumbs?state.counts:state.allCounts||state.counts)||{}}
function resourceKindBytes(){return (isWechat()&&!prefs.thumbs?state.kindBytes:state.allKindBytes)||{}}
function renderNavStats(){
 const counts=resourceCounts(),sizes=resourceKindBytes();
 const totalCount=Object.values(counts).reduce((sum,value)=>sum+(Number(value)||0),0);
 const totalBytes=Object.values(sizes).reduce((sum,value)=>sum+(Number(value)||0),0);
 $$('#nav [data-nav-stat]').forEach(button=>{
  const key=button.dataset.navStat;
  const stats=key==='all'?{total:totalCount,bytes:totalBytes}:key==='favorites'?{total:isWechat()&&!prefs.thumbs?state.favoriteCount||0:state.allFavoriteCount||0,bytes:isWechat()&&!prefs.thumbs?state.favoriteBytes||0:state.allFavoriteBytes||0}:key?{total:counts[key]||0,bytes:sizes[key]||0}:null;
  if(!stats)return;
  const count=stats.total.toLocaleString(getLocale());
  const display=button.querySelector('.nav-stats');
  const label=`${count} · ${compactBytes(stats.bytes)}`;
  if(display.textContent!==label)display.textContent=label;
  button.setAttribute('aria-label',`${button.querySelector('.nav-label').textContent} · ${t('filesAndSize',{p0:count,p1:bytes(stats.bytes)})}`);
 });
}
function renderBreakdown(){
 $('#breakdown').innerHTML=Object.entries(labels).map(([k,n])=>`<div data-type="${k}"><b class="dot"></b><span>${n}</span><strong>${(resourceCounts()[k]||0).toLocaleString(getLocale())}</strong></div>`).join('');$('#breakdown').querySelectorAll('[data-type]').forEach(e=>color(e,e.dataset.type));
 $('#typebar').replaceChildren(...Object.keys(labels).map(k=>{const e=document.createElement('span');color(e,k);const count=resourceCounts()[k]||0;e.style.flexGrow=count;e.hidden=count===0;return e}));
 renderNavStats();
}
function fileContext(x){return isWechat()?contactName(x.group):x.folder||folderName('')}
async function changeSource(change){
 if(sourceBusy||state.scanning||!state.root)return;
 const root=state.root;sourceBusy=true;$('#settingsState').textContent=t('saving');applyTheme();if(page==='settings')settingsUI.render();
 try{
  const snapshot=await api('source',{root,...source,...change});if(state.root!==root)return;
  source=snapshot.source;prefs.grouped=source.grouped;contacts=snapshot.contacts;
  scope='';folder='';scopeKinds=[];offset=0;
  clearCatalog();
  applyTheme();renderBreakdown();groupOptions();header();navigation.reset(routeSnapshot());navigationButtons();await load();$('#settingsState').textContent=t('saved');return true;
 }catch(e){$('#settingsState').textContent=t('saveFailed');toast(e.message,'error')}
 finally{sourceBusy=false;applyTheme();if(page==='settings')settingsUI.render()}
}
function contactName(hash){return hash==='未分组'?t('rootFiles'):contacts[hash]?.name||t('unboundConversation')}
function contactAvatar(hash){const c=contacts[hash];return c?.name?esc(c.name.slice(0,1)):icon('users')}
function groupOptions(){const g=$('#group');g.innerHTML=`<option value="">${t('allConversations')}</option>`+state.groups.map(hash=>`<option value="${esc(hash)}">${esc(hash==='未分组'?t('rootFiles'):contacts[hash]?.name||hash)}</option>`).join('');if(state.groups.includes(scope))g.value=scope;else{scope='';g.value=''}}
function isScopes(){return isWechat()&&groupingMode()==='grouped'&&!scope}
function header(){
 $('#lockVault').hidden=!inVault;
 $('#openVault').disabled=!state.root||!state.updated||state.scanning;
 $('#openVault').classList.toggle('active',inVault);
 $('#scopeFilters').hidden=!scope;$$('#scopeFilters button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.scopeKind?scopeKinds.includes(b.dataset.scopeKind):!scopeKinds.length)));
 $('#scopeFilters').setAttribute('aria-label',t('conversationResourceTypesMultipleSelection'));
 syncGroupingControls();
 const title=inVault?(folder?folderName(folder):t('privateSpace')):scope?contactName(scope):star?t('favorites'):labels[kind]||(browseFolders()?folderName(folder):t('allResources'));
 $('#summary').textContent=stateSummary();
 $('#title').textContent=title;renderBreadcrumb(page==='settings'?t('settings'):title);
 $('#backScope').hidden=!scope;$('#bindScope').hidden=!isWechat()||!scope||scope==='未分组';$('#bindScope').innerHTML=icon('edit')+(contacts[scope]?t('editConversation'):t('bindConversation'));
 $('#group').hidden=!isWechat()||!!scope;$('.view-controls').hidden=isScopes();
 $('#search').placeholder=t(isWechat()?'searchResourcesTagsOrConversations':'searchFilesTagsPaths');$('#search').setAttribute('aria-label',$('#search').placeholder);
 const privateFolder=$('#privateCurrentFolder');
 privateFolder.hidden=!(browseFolders()&&folder&&(!inVault||result.folderPrivateEntry));
 privateFolder.innerHTML=icon('lock')+t(inVault?'privateRestoreFolder':'privateAddFolder');
 privateFolder.onclick=()=>updatePrivacy(['folder:'+folder],!inVault);
 $$('#nav button').forEach(b=>b.classList.toggle('active',b.id==='openVault'?inVault:!inVault&&page==='library'&&(star?b.id==='stars':b.hasAttribute('data-kind')&&b.dataset.kind===kind)));$('#settingsButton').classList.toggle('active',page==='settings');
}

let breadcrumbKey;
function renderBreadcrumb(title){
 const root=$('.breadcrumb'),home=$('#homeCrumb');
 const folders=page==='library'&&browseFolders();
 const rootName=folders?folderName(''):'';
 const key=JSON.stringify([title,rootName,folders?folder:null]);
 if(key===breadcrumbKey)return;
 breadcrumbKey=key;
 root.replaceChildren(home);
 const append=(label,{path,active=false}={})=>{
  const separator=document.createElement('i');
  separator.setAttribute('aria-hidden','true');
  separator.innerHTML=iconSvg('chevron');
  root.append(separator);
  if(active){const current=document.createElement('span');current.className='crumb-current';current.textContent=label;current.setAttribute('aria-current','page');root.append(current);return}
  const button=document.createElement('button');button.className='crumb-link';button.textContent=label;button.dataset.folder=path;button.title=label;button.onclick=()=>enterFolder(path);root.append(button);
 };
 if(folders){
  const parts=folder?folder.split('/').filter(Boolean):[];
  if(!parts.length)append(rootName,{active:true});
  else{
   append(rootName,{path:''});
   parts.forEach((part,index)=>{
    const path=parts.slice(0,index+1).join('/');
    append(part,index===parts.length-1?{active:true}:{path});
   });
  }
 }else append(title,{active:true});
}

function selection(){
 const privacyButton=$('#privateSelected');
 privacyButton.hidden=!selected.size||inVault&&![...selected].every(id=>itemIndex.get(id)?.privateEntry);
 privacyButton.innerHTML=icon('lock')+t(inVault?'privateRestoreSelection':'privateAddSelection');
 $('#selectionCount').textContent=selected.size?`${t('selected', {p0: selected.size})}`:'';$('#clearSelection').hidden=!selected.size;$('#export').disabled=!selected.size;$$('.asset:not(.directory)').forEach(e=>{e.classList.toggle('selected',selected.has(e.dataset.id));e.querySelector('input').checked=selected.has(e.dataset.id)})}
function fileCover(x){
 if(x.kind==='document')return documentCover(x.ext);
 return `<div class="file-symbol">${icon(kindIcon(x.kind))}<span>${esc(x.ext.slice(1).toUpperCase()||'FILE')}</span></div>`;
}
function fallback(node,x){node.innerHTML=fileCover(x)}
function retryThumbnail(img,id,modified){if(img.dataset.retried||img.getAttribute('src')===`thumb/${id}?v=${modified}&thumb=2`)return false;img.dataset.retried='true';img.src=`thumb/${id}?v=${modified}&thumb=2`;return true}
function scopeCover(cover){
 if(!cover)return `<span>${icon(kindIcon(kind||'folder'))}</span>`;
 const image=cover.preview?`<img src="thumb/${esc(cover.preview)}?v=${cover.modified}&thumb=2" decoding="async" alt="" loading="eager">`:cover.kind==='video'?`<img data-video="${esc(cover.id)}" alt="" aria-hidden="true">`:icon('image');
 return `<span data-cover-kind="${esc(cover.kind)}" data-cover-id="${esc(cover.id)}" data-cover-modified="${cover.modified}">${image}</span>`;
}
// Keep overlapping cards attached so scrolling does not restart image decoding or video covers.
function reconcileCards(items,markups,scopes){
 const root=$('#items'),previous=new Map([...root.children].map(node=>[node.renderKey,node]));
 const nodes=items.map((item,index)=>{
  const key=JSON.stringify([state.root,scopes?'scope':item.directory?'folder':'file',scopes?item.hash:item.directory?[item.folder,item.name]:item.id]);
  let node=previous.get(key);
  if(!node||node.renderMarkup!==markups[index]){
   const template=document.createElement('template');template.innerHTML=markups[index];
   node=template.content.firstElementChild;node.renderKey=key;node.renderMarkup=markups[index];
  }
  return node;
 });
 const retained=new Set(nodes);
 for(const node of [...root.children])if(!retained.has(node))node.remove();
 let cursor=root.firstElementChild;
 for(const node of nodes){if(node===cursor)cursor=cursor.nextElementSibling;else root.insertBefore(node,cursor)}
}
function paint(visible){
 if(resultMode!==resultEndpoint())return;
 const scopes=isScopes();$('#items').className=scopes?'scopes':prefs.view;
 if(scopes){reconcileCards(visible,visible.map(g=>`<article class="scope-card" data-scope="${esc(g.hash)}"><div class="scope-head"><span class="avatar">${g.hash==='未分组'?icon('folder'):contactAvatar(g.hash)}</span><button class="scope-identity" title="${t('openConversation')}"><strong>${esc(contactName(g.hash))}</strong><small>${contacts[g.hash]?esc(contacts[g.hash].type==='group'?t('groupChat'):contacts[g.hash].type==='person'?t('contact'):t('customGroup'))+' · ':''}${g.hash==='未分组'?'':esc(g.hash.slice(0,12))+'…'}</small></button><button ${g.hash==='未分组'?'hidden':''} class="icon scope-bind" aria-label="${t('bindOrEditConversation')}" title="${t('bindOrEditConversation')}">${icon('edit')}</button></div><button class="scope-covers" style="grid-template-columns:repeat(${Math.max(1,g.covers.length)},minmax(0,1fr))" aria-label="${t('browseResourcesIn', {p6: esc(contactName(g.hash))})}">${(g.covers.length?g.covers:[null]).map(scopeCover).join('')}</button><div class="scope-footer"><span>${t('resources', {p8: g.count.toLocaleString(), p9: bytes(g.bytes)})}</span><span>${new Date(g.modified).toLocaleDateString(getLocale(),{month:'2-digit',day:'2-digit'})}</span></div><div class="scope-types">${Object.entries(g.counts).map(([k,n])=>`<span data-type="${k}">${icon(kindIcon(k))}${n.toLocaleString()}</span>`).join('')}</div></article>`),true);$$('[data-scope]').forEach(e=>{const hash=e.dataset.scope;e.querySelectorAll('.scope-identity,.scope-covers').forEach(b=>b.onclick=()=>enterScope(hash));e.querySelector('.scope-bind').onclick=()=>showSettings('bindings',hash);e.querySelectorAll('img:not([data-video])').forEach(img=>img.onerror=()=>{const slot=img.parentElement;if(slot.dataset.coverKind==='video'){img.removeAttribute('src');img.dataset.video=slot.dataset.coverId;observeVideoCovers(e)}else if(!retryThumbnail(img,slot.dataset.coverId,slot.dataset.coverModified))slot.innerHTML=icon('image')});e.querySelectorAll('[data-type]').forEach(el=>color(el,el.dataset.type))})}
 else{reconcileCards(visible,visible.map(x=>x.directory?`<article class="asset directory" data-folder="${esc([x.folder,x.name].filter(Boolean).join('/'))}"><button class="cover folder-cover" aria-label="${t('openFolder',{name:esc(x.name)})}">${icon('folder')}</button><button class="asset-name" title="${esc(x.name)}">${esc(x.name)}</button><div class="asset-meta">${t('folder')}</div><div class="asset-context">${t('folder')}</div></article>`:`<article class="asset" data-id="${x.id}"><input type="checkbox" aria-label="${t('select', {p1: esc(x.name)})}"><button class="cover" aria-label="${t('preview', {p2: esc(x.name)})}">${x.kind==='video'&&!x.preview?`<img data-video="${x.id}" alt="" aria-hidden="true">`:x.preview?`<img src="thumb/${x.preview}?v=${x.modified}&thumb=2" decoding="async" loading="eager" alt="">` :fileCover(x)}${x.kind==='video'?`<span class="media-kind">${icon('video')+t('video')}</span>`:''}${isWechat()&&x.thumbnail?`<span class="media-kind">${t('thumbnail')}</span>`:''}</button><button class="asset-name" title="${esc(x.name)}">${esc(x.name)}</button><div class="asset-meta"><span>${bytes(x.size)}${x.star?icon('star'):''}</span><span>${new Date(x.modified).toLocaleDateString(getLocale(),{month:'2-digit',day:'2-digit'})}</span></div><div class="asset-context"><span title="${esc(fileContext(x))}">${esc(fileContext(x))}</span><span>${esc(x.tags|| (isWechat()&&x.thumbnail?t('thumbnail'):t('originalFile')))}</span></div><div class="asset-format"><strong>${esc(x.ext.slice(1).toUpperCase()||'FILE')}</strong><span>${esc(labels[x.kind]||t('otherFiles'))}</span></div><div class="asset-size">${bytes(x.size)}</div><time class="asset-modified" datetime="${new Date(x.modified).toISOString()}"><span>${new Date(x.modified).toLocaleDateString(getLocale())}</span><span>${new Date(x.modified).toLocaleTimeString(getLocale(),{hour:'2-digit',minute:'2-digit',second:'2-digit'})}</span></time><div class="asset-flags">${x.star?icon('star'):''}${x.tags?icon('tag'):''}</div></article>`),false);$$('.asset:not(.directory)').forEach(e=>{const x=itemIndex.get(e.dataset.id);color(e,x.kind);e.querySelector('input').onchange=ev=>{if(ev.target.checked&&selected.size>=200){ev.target.checked=false;toast(t('selectUpToResourcesAtATime'));return}ev.target.checked?selected.add(x.id):selected.delete(x.id);selection()};e.querySelectorAll('button').forEach(b=>b.onclick=()=>openDetail(x));const img=e.querySelector('img');if(img&&!img.dataset.video)img.onerror=()=>{if(x.kind==='video'){img.removeAttribute('src');img.dataset.video=x.id;observeVideoCovers(e)}else if(!retryThumbnail(img,x.id,x.modified))fallback(e.querySelector('.cover'),x)}})}
 $$('.directory button').forEach(b=>b.onclick=()=>enterFolder(b.closest('[data-folder]').dataset.folder));observeVideoCovers($('#items'));selection();
}
let itemIndex=new Map(),loadingMore=false,loadFailed=false,requestParams='',listAbort=null;
let resultKey='',requestKey='';
const menuPages=new Map();
const virtual=new VirtualList($('#resourceScroll'),$('#items'),paint,()=>loadMore());
function emptyFolderView(){return state.root&&browseFolders()&&!kind&&!star&&!$('#search').value}
function emptyState(){
 if(emptyFolderView()){
  if(inVault&&!folder)return ['privateEmpty','privateEmptyHint','privateBackToLibrary',()=>leaveVault()];
  if(folder)return ['emptyFolder','emptyFolderDescription','parentFolder',()=>enterFolder(folder.split('/').slice(0,-1).join('/'))];
  return ['emptyFolder','emptyFolderDescription','changeResourceFolder',directoryUI.open];
 }
 if(!state.root)return ['noResourceFolderSelected','emptyLibraryHint','changeResourceFolder',directoryUI.open];
 if(star&&!$('#search').value)return ['emptyFavorites','emptyFavoritesHint','allResources',()=>setView('')];
 if(!kind&&!scope&&!$('#search').value)return ['emptyLibrary','emptyLibraryHint','changeResourceFolder',directoryUI.open];
 return ['noMatchingResources','tryDifferentKeywordsOrChangeTheFilters','clearFilters',()=>setView('',false,true)];
}
function renderEmpty(){
 const empty=$('#empty');
 empty.hidden=!!result.total||state.scanning||resultKey!==requestKey||loadFailed;
 if(empty.hidden)return;
 const [title,hint,action,reset]=emptyState();
 $('#empty h2').textContent=t(title);
 $('#empty p').textContent=t(hint);
 $('#reset').textContent=t(action);
 $('#reset').onclick=reset;
}
function render(){
 if(resultMode!==resultEndpoint()||resultKey!==requestKey)return;
 renderEmpty();
 itemIndex=new Map(result.items.map(x=>[x.id,x]));
 virtual.set(result.items,{scopes:isScopes(),list:!isScopes()&&prefs.view==='list',compact:prefs.density==='compact',group:browseTimeline()||isWechat()&&!!scope,stickyGroups:browseTimeline()});
 header();syncSelects();selection();
}
function setListLoading(label){
 const status=$('#loadState');
 status.replaceChildren(loadingMark(),document.createTextNode(label));
 status.classList.add('is-loading');
 status.disabled=true;
 $('#items').setAttribute('aria-busy','true');
}
function finishListLoading(){
 const status=$('#loadState');
 status.classList.remove('is-loading');
 status.disabled=false;
 $('#items').removeAttribute('aria-busy');
}
async function loadMore(){
 if(loadingMore||loadFailed||resultKey!==requestKey||result.items.length>=result.total)return;
 const v=version;loadingMore=true;setListLoading(t('loadingMore'));
 try{const p=new URLSearchParams(requestParams);p.set('offset',result.items.length);const r=await api((resultMode+'?')+p,undefined,listAbort?.signal);if(v!==version)return;if(!r.items.length){loadFailed=true;$('#loadState').textContent=t('theListHasChangedClickToRetry');return}result.items.push(...r.items);render()}
 catch(e){if(v===version&&e.name!=='AbortError'){loadFailed=true;$('#loadState').textContent=t('couldNotLoadClickToRetry')}}finally{if(v===version){loadingMore=false;finishListLoading();if(!loadFailed){$('#loadState').textContent=result.items.length<result.total?t('scrollToLoadMore'):t('allResourcesLoaded');virtual.draw()}}}
}
$('#loadState').onclick=()=>{if(resultKey!==requestKey||!result.items.length){load();return}loadFailed=false;loadMore()};
async function load({scrollTop,menu=false}={}){
 clearTimeout(searchTimer);
 listAbort?.abort();listAbort=new AbortController();const v=++version,endpoint=resultEndpoint();loadingMore=true;loadFailed=false;
 const restore=scrollTop??0;
 const p=new URLSearchParams({kind:scope?scopeKinds.join(','):kind,star:star?'1':'0',search:$('#search').value,group:scope,folder,private:inVault?'1':'0',sort:listSort(),thumbs:!isWechat()||prefs.thumbs?'1':'0',offset:0,limit:200});
 requestParams=p.toString();
 const key=requestKey=endpoint+'?'+requestParams;
 if(!menu||state.scanning)menuPages.clear();
 const cacheable=!!state.root&&!inVault&&!scope&&!folder&&!p.get('search')&&!restore;
 const cached=cacheable?menuPages.get(key):null;
 if(!cached){
  $('#empty').hidden=true;
  $('#items').hidden=resultKey!==key;
  $('#summary').textContent=stateSummary();
  setListLoading(t('loading'));
 }
 try{
 const r=cached??await api(key,undefined,listAbort.signal);
 if(v!==version)return;
 if(cacheable&&!state.scanning&&!cached){
  if(menuPages.size>=7)menuPages.delete(menuPages.keys().next().value);
  menuPages.set(key,r);
 }
 const next={...r,items:[...r.items]};
 // Restore enough metadata before restoring a deep history position.
 while(restore>0&&next.items.length<next.total&&next.items.length<Math.ceil(restore/78)*8+200){p.set('offset',next.items.length);const more=await api((endpoint+'?')+p,undefined,listAbort.signal);if(v!==version)return;if(!more.items.length)break;next.items.push(...more.items)}
 result=next;resultMode=endpoint;
 resultKey=key;
 $('#items').hidden=false;
 $('#resourceScroll').scrollTop=0;
 render();
 if(restore)$('#resourceScroll').scrollTop=restore;
 $('#loadState').textContent=result.items.length<result.total?t('scrollToLoadMore'):t('allResourcesLoaded');
 }catch(e){if(v===version&&e.name!=='AbortError'){resultKey='';$('#notice').textContent=t('couldNotLoadResources')+e.message;$('#loadState').textContent=t('clickToRetry');loadFailed=true}}
 finally{if(v===version){loadingMore=false;finishListLoading();virtual.draw()}}
}
function stateSummary(){
 if(state.scanning&&!result.items.length)return t('scanningFilesFound',{p0:(state.scanned||0).toLocaleString(getLocale())});
 if(!state.root||resultMode!==resultEndpoint()||resultKey!==requestKey)return t('readingLocalResources');
 if(isScopes())return t('resourcesLabel',{p0:(result.resources||0).toLocaleString(getLocale()),p1:bytes(result.bytes||0)});
 const count=browseFolders()?result.fileCount||0:result.total||0;
 return t('filesAndSize',{p0:count.toLocaleString(getLocale()),p1:bytes(result.bytes||0)});
}
function renderState(){$('#storage strong').textContent=bytes(state.bytes||0);$('#storage>span').textContent=`${t('files', {p0: (state.total||0).toLocaleString(getLocale())})}`;$('#summary').textContent=stateSummary();$('#notice').textContent=state.error?t('scanFailed')+state.error:state.scanning?t('buildingTheResourceIndexUpdatesAppearAutomatically'):state.skipped?`${t('skippedUnreadableResources', {p0: state.skipped})}`:'';$('#refresh').disabled=state.scanning;$('#freshness').textContent=state.scanning?t('scanning'):state.updated?t('updatedAt')+new Date(state.updated).toLocaleTimeString(getLocale()):t('waitingToScan');renderNavStats();
}
function refreshState(){
 stateRefresh=stateRefresh.catch(()=>{}).then(syncState);
 return stateRefresh;
}
async function syncState(){
 const previous=state;
 const next=await api('status');
 const rootChanged=next.root!==previous.root;
 const vaultClosed=inVault&&!next.vaultUnlocked;
 const snapshot=rootChanged?await api('settings'):null;
 state=next;
 if(next.scanning)menuPages.clear();
 if(previous.scanning!==next.scanning)renderEmpty();
 if(rootChanged || vaultClosed){
  inVault=false;
  resetLibraryView();
  navigation.reset(routeSnapshot());
  navigationButtons();
 }
 if(rootChanged){
  contacts=snapshot.contacts;
  source=snapshot.source;
  prefs.grouped=source.grouped;
  directoryUI.refresh().catch(()=>{});
 }
 renderState();applyTheme();header();directoryUI.renderTrigger();
 if(rootChanged || vaultClosed || next.updated!==lastUpdate){
  lastUpdate=next.updated;
  groupOptions();syncSelects();renderBreakdown();
  await load();
 }
 if(page==='settings'&&(rootChanged||previous.scanning!==next.scanning))settingsUI.render();
 setupTour?.refresh();
}
async function poll(){try{await refreshState()}catch(e){$('#notice').textContent=t('couldNotConnectToTheLocalService')+e.message}finally{setTimeout(poll,state.scanning?1000:5000)}}
function showLibrary(){page='library';$('#libraryPage').hidden=false;$('#settingsPage').hidden=true;document.body.classList.remove('mobile-nav');header()}
function enterFolder(path){navigate(()=>{if(inVault)selected.clear();folder=path;scope='';offset=0;showLibrary();load()})}
function enterScope(hash){navigate(()=>{scope=hash;scopeKinds=hash&&kind?[kind]:[];offset=0;$('#group').value=hash;$('#resourceScroll').scrollTop=0;showLibrary();load()})}
function setView(k,s=false,clearSearch=false){if(inVault)return leaveVault(()=>setView(k,s,clearSearch));navigate(()=>{if(clearSearch)$('#search').value='';kind=k;star=s;scope='';folder='';scopeKinds=[];offset=0;$('#group').value='';showLibrary();load({menu:true})})}
function showSettings(tab='general',hash=''){if(inVault)return leaveVault(()=>showSettings(tab,hash));navigate(()=>{if($('#detail').open)closeDetail();page='settings';$('#libraryPage').hidden=true;$('#settingsPage').hidden=false;document.body.classList.remove('mobile-nav');header();settingsUI.open(tab,hash);$('#settingsPage').scrollTop=0;setupTour?.refresh()})}
async function rescan(){await action(async()=>{await api('scan',{});menuPages.clear();state.scanning=true;renderEmpty();$('#refresh').disabled=true;toast(t('rescanStarted'))})}
async function choose(root,{reportError=true}={}){
 if(choosingSource||sourceBusy||state.scanning)return false;
 choosingSource=true;
 setupTour?.refresh();
 try{
  const opened=await api('choose',typeof root==='string'?{root}:{});
  if(!opened)return false;
  await refreshState();
  while(state.scanning){
   await new Promise(resolve=>setTimeout(resolve,350));
   await refreshState();
  }
  if(state.error)throw Error(state.error);
  return true;
 }catch(error){
  if(!reportError)throw error;
  toast(error.message,'error');
  return false;
 }finally{
  choosingSource=false;
  setupTour?.refresh();
 }
}

const directoryUI=createDirectorySwitcher({
 dialog:$('#directoryDialog'),trigger:$('#directorySwitcher'),api,choose,icon,esc,getState:()=>state,
 onChange:()=>{header();const name=$('.current-directory-name');if(name&&state.root)name.textContent=directoryUI.name(state.root)}
});
const privateUI=createPrivateSpace({dialog:$('#vaultDialog'),api});

function clearCatalog(){
 ++version;listAbort?.abort();clearTimeout(searchTimer);
 menuPages.clear();resultKey=requestKey='';
 if($('#detail').open)closeDetail();
 selected.clear();result={items:[],total:0};itemIndex.clear();
 resultMode=resultEndpoint();
 $('#items').hidden=false;
 virtual.set([],{scopes:isScopes(),list:prefs.view==='list'});
 $('#items').replaceChildren();
 $('#empty').hidden=true;
 selection();
 clearVideoCovers();clearAudioCache();
}
function resetLibraryView(){
 folder='';scope='';scopeKinds=[];kind='';star=false;offset=0;$('#search').value='';$('#group').value='';
 clearCatalog();
}
function displayVault(value){
 inVault=value;
 resetLibraryView();
 showLibrary();
 applyTheme();
 navigation.reset(routeSnapshot());navigationButtons();
}
async function enterVault(){
 if(inVault||vaultBusy||!state.root||state.scanning)return;
 const root=state.root;
 vaultBusy=true;
 try{
  if(!await privateUI.request(root,directoryUI.name(root),!state.vaultConfigured))return;
  const status=await api('status');
  if(status.root!==root||!status.vaultUnlocked)return;
  state=status;
  displayVault(true);
  await load();
 }catch(error){toast(error.message,'error')}
 finally{vaultBusy=false}
}
async function leaveVault(next){
 if(vaultBusy)return;
 vaultBusy=true;
 try{
  await api('vault-lock',{});
  displayVault(false);
  if(next)next();else await load();
 }catch(error){toast(error.message,'error')}
 finally{vaultBusy=false}
}
async function updatePrivacy(ids,makePrivate){
 if(vaultBusy||state.scanning||!ids.length)return;
 const root=state.root;
 vaultBusy=true;
 let created=false;
 try{
  if(makePrivate&&!state.vaultConfigured){
   created=await privateUI.request(root,directoryUI.name(root),true);
   if(!created)return;
  }
  await api('vault-items',{root,ids,private:makePrivate});
  if(state.root!==root)return;
  if(ids.includes('folder:'+folder))folder=folder.split('/').slice(0,-1).join('/');
  clearCatalog();
  navigation.reset(routeSnapshot());navigationButtons();
  toast(t(makePrivate?'privateAdded':'privateRestored'),'success');
 }catch(error){toast(error.message,'error')}
 finally{
  try{
   if(created)await api('vault-lock',{});
   await refreshState();
   renderBreakdown();
  }catch(error){toast(error.message,'error')}
  vaultBusy=false;
 }
}
$('#openVault').onclick=enterVault;
$('#lockVault').onclick=()=>leaveVault();
$('#privateSelected').onclick=()=>updatePrivacy([...selected],!inVault);
$('#privateItem').onclick=()=>{if(detail)updatePrivacy([detail.id],!inVault)};

settingsUI=createSettings({$,esc,icon,api,toast,getPrefs:()=>prefs,getState:()=>state,getContacts:()=>contacts,getSource:()=>source,isWechat,sourceBusy:()=>sourceBusy||choosingSource,changeSource,groupingMode,groupingOptions,changeGrouping,setPref,onNavigate:navigate,onContacts:c=>{contacts=c;groupOptions();syncSelects();load()},choose,rescan,openDirectories:directoryUI.open,directoryName:directoryUI.name,getDevelopment:()=>development,startTour:()=>setupTour.start({force:true}),replayTour:()=>{navigate(()=>showLibrary());setupTour.start({force:true,preview:true})}});
setupTour=createSetupTour({getState:()=>state,getRoute:()=>({page,tab:settingsUI.location().tab}),getBusy:()=>choosingSource,isDismissed:()=>prefs.setupTourDismissed,onDismiss:()=>setPref('setupTourDismissed',true),onComplete:()=>toast(t('tourComplete')),onPreviewComplete:()=>toast(t('tourPreviewComplete')),revealSettings:()=>{if(innerWidth<=720){document.body.classList.add('mobile-nav');applyTheme()}else if(prefs.sidebarCollapsed)setPref('sidebarCollapsed',false)}});
function renderImageOverview(img,item){
 const width=img.naturalWidth,height=img.naturalHeight;if(!width||!height)return;
 let a=width,b=height;while(b){const rest=a%b;a=b;b=rest}const w=width/a,h=height/a;
 const ratio=w<=32&&h<=32?`${w}:${h}`:width>=height?`${(width/height).toLocaleString(getLocale(),{maximumFractionDigits:2})}:1`:`1:${(height/width).toLocaleString(getLocale(),{maximumFractionDigits:2})}`;
 const facts=[new Date(item.modified).toLocaleString(getLocale(),{year:'numeric',month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'}),bytes(item.size),ratio,t(width===height?'squareImage':width>height?'landscapeImage':'portraitImage')];
 $('#detailSubtitle').replaceChildren(...facts.map(value=>{const span=document.createElement('span');span.textContent=value;return span}));
}
function openDetail(item){
 disposePlayer?.();disposePlayer=null;disposeTags?.();detailMetadata?.dispose();detailHistogram?.dispose();detailHistogram=null;const token=++detailVersion;detail={...item};const x=detail;const index=result.items.findIndex(r=>r.id===x.id);color($('#detail'),x.kind);$('#detailBadge').innerHTML=icon(kindIcon(x.kind))+t('resourceDetails');$('#detailType').textContent=(labels[x.kind]||t('other'))+' / '+x.ext.slice(1).toUpperCase();$('#detailName').textContent=x.name;$('#detailName').title=x.name;$('#fullscreenFilename').textContent=x.name;$('#detailSubtitle').replaceChildren();$('#detailSubtitle').hidden=x.kind!=='image';$('#detailPosition').textContent=browseFolders()?`${t('of', {p0: result.items.slice(0,index+1).filter(x=>!x.directory).length, p1: result.fileCount})}`:`${t('of', {p0: index+1, p1: result.total})}`;$('#prevDetail').disabled=!result.items.slice(0,index).some(x=>!x.directory);$('#nextDetail').disabled=!result.items.slice(index+1).some(x=>!x.directory)&&result.items.length>=result.total;$('#starItem').innerHTML=icon('star')+(x.star?t('favorited'):t('favorite'));detailMetadata=mountImageMetadata($('#metadata'),{...x,thumbnail:isWechat()&&x.thumbnail});disposeTags=mountTagEditor($('#tagEditor'),x.tags,async tags=>{await api('mark',{id:x.id,star:x.star,tags});x.tags=tags;load()});$('#detailPath').textContent=x.path;$('#detailPath').title=x.path;$('#detailLocationLabel').textContent=t(isWechat()?'conversationLabel':'containingFolder');$('#detailContact').innerHTML=isWechat()?`<span class="avatar">${x.group==='未分组'?icon('folder'):contactAvatar(x.group)}</span><span><strong>${esc(contactName(x.group))}</strong><small>${esc(contacts[x.group]?.username||x.group.slice(0,16)+'…')}</small></span>${icon('chevron')}`:`<span class="avatar">${icon('folder')}</span><span><strong>${esc(folderName(x.folder))}</strong><small>${esc(x.folder||folderName(''))}</small></span>${icon('chevron')}`;
 const privacyButton=$('#privateItem');
 privacyButton.hidden=inVault&&!x.privateEntry;
 privacyButton.innerHTML=icon('lock')+t(inVault?'privateRestoreItem':'privateAddItem');
 const histogramRoot=$('#detailHistogram');histogramRoot.replaceChildren();histogramRoot.hidden=x.kind!=='image';if(x.kind==='image'){detailHistogram=mountHistogram(histogramRoot);detailHistogram.load(x.id)}
 $('#detail .detail-info').scrollTop=0;const preview=$('#preview');preview.classList.toggle('image-preview',x.kind==='image');preview.replaceChildren();const unsupported=t=>{if(token===detailVersion)preview.innerHTML=icon(kindIcon(x.kind))+`<p>${esc(t)}</p>`};
 if(!$('#detail').open){setPreviewFullscreen(false);$('#detail').showModal()}
 if(x.kind==='image')disposePlayer=mountImageViewer(preview,x,{onLoad:img=>{if(token===detailVersion){detailMetadata.setDimensions(img);renderImageOverview(img,x)}}});
 else if(x.kind==='video'||x.kind==='audio')disposePlayer=mountPlayer(preview,x,prefs,setPref);
 else if(x.kind==='document')disposePlayer=mountDocumentPreview(preview,x,{onEscape:dismissDetail});
 else unsupported(t('exportThisFileOrOpenItWithThe'));
}
function disposeDetail(){setPreviewFullscreen(false);++detailVersion;detailHistogram?.dispose();detailHistogram=null;$('#detailHistogram').replaceChildren();$('#detailHistogram').hidden=true;disposeTags?.();disposeTags=null;detailMetadata?.dispose();detailMetadata=null;disposePlayer?.();disposePlayer=null;$('#preview').replaceChildren();for(const id of ['detailName','fullscreenFilename','detailPath','detailContact','metadata']){const node=$('#'+id);node.replaceChildren();node.removeAttribute('title')}detail=null}
function closeDetail(){$('#detail').close();disposeDetail()}
function setPreviewFullscreen(expanded,focus=false){
 const dialog=$('#detail'),button=$('#previewFullscreen');
 dialog.classList.toggle('preview-expanded',expanded);
 const label=t(expanded?'exitFullscreenPreview':'enterFullscreenPreview');
 button.innerHTML=icon(expanded?'fullscreenExit':'fullscreenEnter');
 button.setAttribute('aria-pressed',String(expanded));
 button.setAttribute('aria-label',label);
 button.title=label;
 if(focus)button.focus();
}
function dismissDetail(){
 if($('#detail').classList.contains('preview-expanded'))setPreviewFullscreen(false,true);
 else closeDetail();
}
$('#previewFullscreen').onclick=()=>setPreviewFullscreen(!$('#detail').classList.contains('preview-expanded'),true);
$('#detail').addEventListener('keydown',event=>{
 if(event.key!=='Escape'||event.defaultPrevented||event.isComposing)return;
 event.preventDefault();
 if(!event.repeat)dismissDetail();
});
$('#detail').addEventListener('cancel',event=>{event.preventDefault();dismissDetail()});
$('#closeDetail').onclick=closeDetail;$('#detail').addEventListener('close',()=>{if(!$('#detail').open)disposeDetail()});$('#detail').onclick=e=>{if(e.target===$('#detail')){const r=e.target.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)closeDetail()}};
async function adjacent(step){
 if(!detail)return;const current=detail.id;let i=result.items.findIndex(x=>x.id===current)+step;
 while(i>=0){
  if(i>=result.items.length){if(step<0||i>=result.total)return;await loadMore();if(i>=result.items.length)return}
  if(!result.items[i].directory){if(detail?.id===current)openDetail(result.items[i]);return}i+=step;
 }
}
$('#prevDetail').onclick=()=>adjacent(-1);$('#nextDetail').onclick=()=>adjacent(1);$('#detailContact').onclick=()=>{const x=detail;closeDetail();if(isWechat())enterScope(x.group);else if(browseFolders()){enterFolder(x.folder)}else{changeGrouping('grouped')?.then(saved=>{if(saved)enterFolder(x.folder)})}};
$$('[data-kind]').forEach(b=>b.onclick=()=>setView(b.dataset.kind));$('#stars').onclick=()=>setView('',true);$('#settingsButton').onclick=()=>showSettings();$('#homeCrumb').onclick=()=>setView('');$('#backScope').onclick=()=>enterScope('');$('#bindScope').onclick=()=>showSettings('bindings',scope);$('#scopeGrouping').onchange=e=>changeGrouping(e.target.value);
$$('#scopeFilters button').forEach(b=>b.onclick=()=>navigate(()=>{const k=b.dataset.scopeKind;scopeKinds=k?(scopeKinds.includes(k)?scopeKinds.filter(v=>v!==k):[...scopeKinds,k]):[];offset=0;load()}));
let searchTimer;$('#search').oninput=()=>{clearTimeout(searchTimer);offset=0;searchTimer=setTimeout(load,220)};$('#group').onchange=e=>enterScope(e.target.value);$('#sort').onchange=e=>setPref('sort',e.target.value);$('#clearSelection').onclick=()=>{selected.clear();selection()};$('#gridView').onclick=()=>setPref('view','grid');$('#listView').onclick=()=>setPref('view','list');$('#refresh').onclick=rescan;
async function doExport(ids){const r=await api('export',{ids});toast(r.count?t('exportedFiles', {p0: r.count}):t('exportCanceled'),r.count?'success':'info')}
$('#export').onclick=()=>action(async()=>{$('#export').disabled=true;try{await doExport([...selected])}finally{selection()}});$('#exportItem').onclick=()=>action(()=>doExport([detail.id]));$('#reveal').onclick=()=>action(()=>api('reveal',{ids:[detail.id]}));
$('#copyRelativePath').onclick=()=>action(async()=>{if(!detail)return;await copyPath(relativeResourcePath(detail.path,state.root));toast(t('relativePathCopied'),'success')});$('#copyAbsolutePath').onclick=()=>action(async()=>{if(!detail)return;await copyPath(detail.path);toast(t('absolutePathCopied'),'success')});
$('#starItem').onclick=()=>action(async()=>{if(!detail)return;const x=detail;$('#starItem').disabled=true;try{await api('mark',{id:x.id,star:!x.star,tags:x.tags});x.star=!x.star;if(detail?.id===x.id)$('#starItem').innerHTML=icon('star')+(x.star?t('favorited'):t('favorite'));toast(x.star?t('addedToFavorites'):t('removedFromFavorites'),'success');await refreshState();await load()}finally{$('#starItem').disabled=false}});
function sidebar(){if(innerWidth<=720){document.body.classList.toggle('mobile-nav');$('#sidebar').inert=!document.body.classList.contains('mobile-nav')}else setPref('sidebarCollapsed',!prefs.sidebarCollapsed)}$('#collapse').onclick=sidebar;$('#expand').onclick=sidebar;$('#sidebarShade').onclick=()=>{document.body.classList.remove('mobile-nav');$('#sidebar').inert=true};
document.addEventListener('keydown',e=>{const editing=['INPUT','TEXTAREA','SELECT'].includes(document.activeElement?.tagName);if($('#vaultDialog').open||$('#directoryDialog').open)return;if(!$('#detail').open&&((e.metaKey&&(e.key==='['||e.key===']'))||(e.altKey&&!editing&&(e.key==='ArrowLeft'||e.key==='ArrowRight')))){e.preventDefault();travel(e.key==='['||e.key==='ArrowLeft'?-1:1);return}if((e.metaKey||e.ctrlKey)&&e.key==='k'){e.preventDefault();if(page!=='library')navigate(()=>showLibrary());$('#search').focus()}if((e.metaKey||e.ctrlKey)&&e.key===','){e.preventDefault();showSettings()}if((e.metaKey||e.ctrlKey)&&e.key==='\\'){e.preventDefault();sidebar()}if($('#detail').open&&!$('#detail').classList.contains('preview-expanded')&&!e.defaultPrevented&&!['INPUT','TEXTAREA','SELECT'].includes(document.activeElement?.tagName)){if(e.key==='ArrowLeft')adjacent(-1);if(e.key==='ArrowRight')adjacent(1)}if(e.key==='Escape')document.body.classList.remove('mobile-nav')});
function applyLocale(){
 setLocale(prefs.locale);translateStatic();directoryUI.renderTrigger();labels=kindLabels();groupOptions();applyTheme();
 renderBreakdown();
 renderState();if(loadingMore)setListLoading(t('loading'));else $('#loadState').textContent=loadFailed?t('clickToRetry'):result.items.length<result.total?t('scrollToLoadMore'):t('allResourcesLoaded');render();header();if(page==='settings')settingsUI.render();setupTour?.refresh();
}
installSelects();renderIcons();selection();applyTheme();
async function start(){
 try{
  await api('vault-lock',{});
  const snapshot=await api('settings');
  development=snapshot.development===true;
  source=snapshot.source;
  prefs={...prefs,...snapshot.preferences,grouped:source.grouped};
  contacts=snapshot.contacts;
  await refreshState();
  directoryUI.refresh().catch(()=>{});
  applyLocale();
  navigation.reset(routeSnapshot());navigationButtons();
  setupTour.start();poll();
 }catch(e){$('#notice').textContent=t('couldNotStart')+e.message;toast(t('couldNotReadSettingsReopenTheApp'),'error')}
}
start();
