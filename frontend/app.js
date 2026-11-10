import {renderUsage} from './usage-overview.js';
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
import {createTimelineDatePicker} from './timeline-date-picker.js';
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
import {createCommandPalette} from './command-palette.js';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const bytes=n=>n<1024?n+' B':n<1048576?(n/1024).toFixed(1)+' KiB':n<1073741824?(n/1048576).toFixed(1)+' MiB':(n/1073741824).toFixed(2)+' GiB';
function compactBytes(n){
 const [amount,unit]=bytes(n).split(' ');
 return Number(amount)+unit;
}
const kindLabels=()=>({image:t('images'),video:t('videos'),audio:t('voiceAudio'),document:t('documents'),other:t('otherFiles')});
let labels=kindLabels();
const kindIcon=k=>k==='document'?'file':k==='other'?'box':k;
let prefs={locale:'zh-CN',theme:'dark',palette:'classic',grouped:true,typeColors:true,thumbs:false,density:'comfortable',view:'grid',sort:'date',volume:.8,speed:1,sidebarCollapsed:false},contacts={},source={mode:'auto',grouped:true},sourceBusy=false,state={groups:[],counts:{}},folder='',kind='',star=false,scope='',scopeKinds=[],offset=0,result={items:[],total:0},resultMode=true,selected=new Set(),detail=null,version=0,lastUpdate=0,page='library',disposePlayer=null,detailVersion=0,saveTimer,saveChain=Promise.resolve(),settingsUI,setupTour,choosingSource=false,pendingDirectory=null,development=false;
let dateRange={start:'',end:''}, searchQuery='';
const systemTheme=matchMedia('(prefers-color-scheme: dark)');
const navigation=new NavigationHistory();
let inVault=false,vaultBusy=false,stateRefresh=Promise.resolve();
function routeSnapshot(){return {page,kind,star,scope,folder,dateRange,scopeKinds:[...scopeKinds],offset,search:searchQuery,sort:prefs.sort,thumbs:prefs.thumbs,view:prefs.view,settings:settingsUI?.location()||{tab:'general',hash:''},scroll:$(page==='settings'?'#settingsPage':page==='usage'?'#usagePage':'#resourceScroll').scrollTop}}
function navigationButtons(){$('#navigateBack').disabled=!navigation.canBack;$('#navigateForward').disabled=!navigation.canForward}
function navigate(change){navigation.replace(routeSnapshot());change();navigation.push(routeSnapshot());navigationButtons()}
async function travel(step){
 const route=navigation.move(step,routeSnapshot());if(!route)return;navigationButtons();if($('#detail').open)closeDetail();
 kind=route.kind;star=route.star;scope=route.scope;folder=route.folder||'';dateRange=route.dateRange;scopeKinds=route.scopeKinds||[];offset=route.offset;searchQuery=route.search;
 const changed=['sort','thumbs','view'].some(k=>prefs[k]!==route[k]);for(const k of ['sort','thumbs','view'])prefs[k]=route[k];applyTheme();if(changed)persistPrefs();$('#group').value=scope;
 if(route.page==='settings'){setPage('settings');settingsUI.open(route.settings.tab,route.settings.hash);$('#settingsPage').scrollTop=route.scroll;header();load()}
 else if(route.page==='usage'){showUsage();$('#usagePage').scrollTop=route.scroll}
 else{showLibrary();header();await load({scrollTop:route.scroll,reusePage:true})}
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
function applyTheme(){const root=document.documentElement;root.dataset.theme=prefs.theme==='system'?(systemTheme.matches?'dark':'light'):prefs.theme;root.dataset.palette=prefs.palette;root.dataset.typeColors=prefs.typeColors?'on':'off';document.body.dataset.density=prefs.density;document.body.classList.toggle('collapsed',prefs.sidebarCollapsed);syncSidebar();syncGroupingControls();syncSelects();renderNavStats();$('#gridView').classList.toggle('active',prefs.view==='grid');$('#listView').classList.toggle('active',prefs.view==='list')}
function persistPrefs(){clearTimeout(saveTimer);$('#settingsState').textContent=t('saving');saveTimer=setTimeout(()=>{const value={...prefs};saveChain=saveChain.catch(()=>{}).then(()=>api('settings',value)).then(()=>{$('#settingsState').textContent=t('saved')}).catch(e=>{$('#settingsState').textContent=t('saveFailed');toast(t('couldNotSaveSettings')+e.message,'error')})},180)}
function setPref(k,v){
 if(k==='view'&&prefs.view===v)return;
 prefs[k]=v;
 if(k==='locale'){applyLocale();persistPrefs();return}
 if(k==='volume'||k==='speed'){persistPrefs();return}
 applyTheme();persistPrefs();
 if(k==='thumbs'||k==='sort'){offset=0;load()}
 else if(k==='view'&&!isScopes()){
  $('#resourceScroll').scrollTop=0;
  render();
 }else if(k==='density')render();
}
systemTheme.addEventListener('change',applyTheme);window.addEventListener('resize',applyTheme);
function isWechat(){return !inVault&&(source.mode==='auto'?(state.detectedMode||'folder'):source.mode)==='wechat'}
function groupingMode(){return source.timeline?'timeline':source.grouped?'grouped':'flat'}
function groupingOptions(){return [['grouped',t(isWechat()?'groupByConversation':'browseFolders')],['flat',t('allFiles')],['timeline',t('groupByTime')]]}
function changeGrouping(mode){
 if(inVault||mode===groupingMode()||!['grouped','flat','timeline'].includes(mode))return;
 return changeSource({grouped:mode==='grouped',timeline:mode==='timeline'});
}
function browseTimeline(){return !searchQuery&&!inVault&&groupingMode()==='timeline'}
const datePicker=createTimelineDatePicker($('#timelineDates'),applyDateRange);
const hasDateRange=()=>!!(dateRange.start||dateRange.end);
function syncDatePicker(){datePicker.update(dateRange,browseTimeline())}
function applyDateRange(start,end){
 if(start===dateRange.start&&end===dateRange.end)return;
 navigate(()=>{dateRange={start,end};offset=0;syncDatePicker();load()});
}
function listSort(){return scope||browseTimeline()?'date':prefs.sort}
function syncGroupingControls(){
 const grouping=$('#scopeGrouping');
 const label=groupingOptions()[0][1];
 if(grouping.options[0].textContent!==label)grouping.options[0].textContent=label;
 grouping.value=groupingMode();
 grouping.hidden=inVault;
 grouping.disabled=!state.root||state.scanning||sourceBusy||choosingSource;
 $('#sort').value=listSort();
 $('#sort').disabled=!!scope||browseTimeline();
}
function browseFolders(){return !searchQuery&&(inVault||!isWechat()&&groupingMode()==='grouped')}
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
  const label=button.querySelector('.nav-label').textContent;
  button.title=label;
  button.setAttribute('aria-label',`${label} · ${t('filesAndSize',{p0:count,p1:bytes(stats.bytes)})}`);
 });
}
function renderBreakdown(){
 $('#breakdown').innerHTML=Object.entries(labels).map(([k,n])=>`<div data-type="${k}"><b class="dot"></b><span>${n}</span><strong>${(resourceCounts()[k]||0).toLocaleString(getLocale())}</strong></div>`).join('');$('#breakdown').querySelectorAll('[data-type]').forEach(e=>color(e,e.dataset.type));
 $('#typebar').replaceChildren(...Object.keys(labels).map(k=>{const e=document.createElement('span');color(e,k);const count=resourceCounts()[k]||0;e.style.flexGrow=count;e.hidden=count===0;return e}));
 renderNavStats();
}
function fileContext(x){return isWechat()?contactName(x.group):x.folder||folderName('')}
async function changeSource(change){
 if(sourceBusy||choosingSource||state.scanning||!state.root)return;
 const groupingOnly=!('mode' in change);
 const root=state.root;sourceBusy=true;updateDirectoryUI();$('#settingsState').textContent=t('saving');applyTheme();if(page==='settings')settingsUI.render();
 try{
  const snapshot=await api('source',{root,...source,...change});if(state.root!==root)return;
  const previousGrouping=groupingMode();
  source=snapshot.source;prefs.grouped=source.grouped;contacts=snapshot.contacts;
  if(groupingMode()!==previousGrouping)dateRange={start:'',end:''};
  scope='';if('mode' in change||isWechat())folder='';scopeKinds=[];offset=0;
  if(groupingOnly){
   commandPalette.close();
   if($('#detail').open)closeDetail();
   selected.clear();selection();
   $('#group').value='';
   $('#resourceScroll').scrollTop=0;
  }else{
   clearCatalog();
   renderBreakdown();groupOptions();
  }
  header();navigation.reset(routeSnapshot());navigationButtons();
  const loading=load({reusePage:groupingOnly,rebuilding:groupingOnly});
  if(!groupingOnly)await loading;
  $('#settingsState').textContent=t('saved');return true;
 }catch(e){$('#settingsState').textContent=t('saveFailed');toast(e.message,'error')}
 finally{sourceBusy=false;updateDirectoryUI();applyTheme();if(page==='settings')settingsUI.render()}
}
function contactName(hash){return hash==='未分组'?t('rootFiles'):contacts[hash]?.name||t('unboundConversation')}
function contactAvatar(hash){const c=contacts[hash];return c?.name?esc(c.name.slice(0,1)):icon('users')}
function groupOptions(){const g=$('#group');g.innerHTML=`<option value="">${t('allConversations')}</option>`+state.groups.map(hash=>`<option value="${esc(hash)}">${esc(hash==='未分组'?t('rootFiles'):contacts[hash]?.name||hash)}</option>`).join('');if(state.groups.includes(scope))g.value=scope;else{scope='';g.value=''}}
function isScopes(){return !searchQuery&&!inVault&&isWechat()&&groupingMode()==='grouped'&&!scope}
function header(){
 $('#lockVault').hidden=!inVault;
 $('#openVault').disabled=!state.root||!state.updated||state.scanning;
 $('#openVault').classList.toggle('active',inVault);
 $('#scopeFilters').hidden=!scope;$$('#scopeFilters button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.scopeKind?scopeKinds.includes(b.dataset.scopeKind):!scopeKinds.length)));
 $('#scopeFilters').setAttribute('aria-label',t('conversationResourceTypesMultipleSelection'));
 syncGroupingControls();syncDatePicker();
 const title=inVault?(folder?folderName(folder):t('privateSpace')):scope?contactName(scope):star?t('favorites'):labels[kind]||(folder?folderName(folder):t('allResources'));
 $('#summary').textContent=stateSummary();
 $('#title').textContent=title;renderBreadcrumb(page==='settings'?t('settings'):page==='usage'?t('usageOverview'):title);
 $('#backScope').hidden=!scope;$('#bindScope').hidden=!isWechat()||!scope||scope==='未分组';$('#bindScope').innerHTML=icon('edit')+(contacts[scope]?t('editConversation'):t('bindConversation'));
 $('#group').hidden=!isWechat()||!!scope;$('.view-controls').hidden=isScopes();
 const searchFilter=$('#clearSearch');
 searchFilter.hidden=!searchQuery;
 searchFilter.querySelector('span').textContent=searchQuery;
 const privateFolder=$('#privateCurrentFolder');
 privateFolder.hidden=!(browseFolders()&&folder&&(!inVault||result.folderPrivateEntry));
 privateFolder.innerHTML=icon('lock')+t(inVault?'privateRestoreFolder':'privateAddFolder');
 privateFolder.onclick=()=>updatePrivacy(['folder:'+folder],!inVault);
 $$('#nav button').forEach(b=>b.classList.toggle('active',b.id==='openVault'?inVault:!inVault&&page==='library'&&(star?b.id==='stars':b.hasAttribute('data-kind')&&b.dataset.kind===kind)));$('#settingsButton').classList.toggle('active',page==='settings');
}

let breadcrumbKey;
function renderBreadcrumb(title){
 const root=$('.breadcrumb');
 const library=page==='library';
 const folders=library&&(browseFolders()||!!folder);
 const rootName=library?folderName(''):'';
 const key=JSON.stringify([title,rootName,folders,folders?folder:null,kind,star,scope,inVault]);
 if(key===breadcrumbKey)return;
 breadcrumbKey=key;
 $('#breadcrumbIcon').innerHTML=iconSvg(library?(inVault?'lock':'folder'):page==='usage'?'info':'settings');
 root.replaceChildren();
 const append=(label,open)=>{
  if(root.childElementCount){
   const separator=document.createElement('i');
   separator.setAttribute('aria-hidden','true');
   separator.innerHTML=iconSvg('chevron');
   root.append(separator);
  }
  const crumb=document.createElement(open?'button':'span');
  crumb.textContent=label;
  crumb.title=label;
  if(open){
   crumb.type='button';
   crumb.onclick=open;
  }else{
   crumb.className='crumb-current';
   crumb.setAttribute('aria-current','page');
  }
  root.append(crumb);
 };
 if(!library){
  append(title);
 }else if(folders){
  const parts=folder?folder.split('/'):[];
  append(rootName,parts.length?()=>enterFolder(''):null);
  parts.forEach((part,index)=>{
   const path=parts.slice(0,index+1).join('/');
   append(part,index<parts.length-1?()=>enterFolder(path):null);
  });
 }else{
  const filtered=!!(kind||star||scope||searchQuery);
  append(rootName,filtered?()=>setView(''):null);
  if(filtered)append(searchQuery||title);
 }
}

function setSelected(id,checked){
 if(checked&&!selected.has(id)&&selected.size>=200){
  toast(t('selectUpToResourcesAtATime'));
 }else if(checked){
  selected.add(id);
 }else{
  selected.delete(id);
 }
 selection();
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
// Leave loopback HTTP connections available for list and navigation requests.
const watchedCovers=new Set(),waitingCovers=new Set(),activeCovers=new Map();
const coverObserver=new IntersectionObserver(entries=>{
 for(const {target,isIntersecting} of entries){
  if(isIntersecting&&watchedCovers.has(target))waitingCovers.add(target);
  else waitingCovers.delete(target);
 }
 loadImageCovers();
},{root:$('#resourceScroll'),rootMargin:'150px'});
function unwatchImageCover(img){
 coverObserver.unobserve(img);
 watchedCovers.delete(img);
 waitingCovers.delete(img);
}
function loadImageCovers(){
 for(const img of waitingCovers){
  if(activeCovers.size>=2)break;
  unwatchImageCover(img);
  if(!img.isConnected)continue;
  const complete=event=>{
   if(event.type==='load')delete img.dataset.coverLoading;
   cancel();
   loadImageCovers();
  };
  const cancel=()=>{
   img.removeEventListener('load',complete);
   img.removeEventListener('error',complete);
   activeCovers.delete(img);
  };
  activeCovers.set(img,cancel);
  img.addEventListener('load',complete);
  img.addEventListener('error',complete);
  img.dataset.coverLoading='';
  img.src=img.dataset.thumb;
  delete img.dataset.thumb;
 }
}
function watchImageCover(img){
 if(watchedCovers.has(img))return;
 watchedCovers.add(img);
 coverObserver.observe(img);
}
function observeImageCovers(root){
 for(const img of watchedCovers)if(!root.contains(img))unwatchImageCover(img);
 for(const [img,cancel] of activeCovers)if(!root.contains(img)){
  cancel();
  img.removeAttribute('src');
 }
 for(const img of root.querySelectorAll('img[data-thumb]'))watchImageCover(img);
 loadImageCovers();
}
function retryThumbnail(img,id,modified){
 const url=`thumb/${id}?v=${modified}&thumb=2`;
 if(img.dataset.retried||img.getAttribute('src')===url)return false;
 img.dataset.retried='true';
 img.dataset.thumb=url;
 watchImageCover(img);
 return true;
}
function scopeCover(cover){
 if(!cover)return `<span>${icon(kindIcon(kind||'folder'))}</span>`;
 const image=cover.preview?`<img data-thumb="thumb/${esc(cover.preview)}?v=${cover.modified}&thumb=2" decoding="async" alt="">`:cover.kind==='video'?`<img data-video="${esc(cover.id)}" alt="" aria-hidden="true">`:icon('image');
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
let coverDateLocale,coverDateFormats;
function paint(visible){
 if(resultMode!==resultEndpoint())return;
 const locale=getLocale();
 if(coverDateLocale!==locale){
  coverDateLocale=locale;
  coverDateFormats={
   short:new Intl.DateTimeFormat(locale,{month:'2-digit',day:'2-digit'}),
   date:new Intl.DateTimeFormat(locale),
   time:new Intl.DateTimeFormat(locale,{hour:'2-digit',minute:'2-digit',second:'2-digit'})
  };
 }
 const scopes=isScopes();$('#items').className=scopes?'scopes':prefs.view;
 if(scopes){reconcileCards(visible,visible.map(g=>`<article class="scope-card" data-scope="${esc(g.hash)}"><div class="scope-head"><span class="avatar">${g.hash==='未分组'?icon('folder'):contactAvatar(g.hash)}</span><button class="scope-identity" title="${t('openConversation')}"><strong>${esc(contactName(g.hash))}</strong><small>${contacts[g.hash]?esc(contacts[g.hash].type==='group'?t('groupChat'):contacts[g.hash].type==='person'?t('contact'):t('customGroup'))+' · ':''}${g.hash==='未分组'?'':esc(g.hash.slice(0,12))+'…'}</small></button><button ${g.hash==='未分组'?'hidden':''} class="icon scope-bind" aria-label="${t('bindOrEditConversation')}" title="${t('bindOrEditConversation')}">${icon('edit')}</button></div><button class="scope-covers" style="grid-template-columns:repeat(${Math.max(1,g.covers.length)},minmax(0,1fr))" aria-label="${t('browseResourcesIn', {p6: esc(contactName(g.hash))})}">${(g.covers.length?g.covers:[null]).map(scopeCover).join('')}</button><div class="scope-footer"><span>${t('resources', {p8: g.count.toLocaleString(), p9: bytes(g.bytes)})}</span><span>${coverDateFormats.short.format(g.modified)}</span></div><div class="scope-types">${Object.entries(g.counts).map(([k,n])=>`<span data-type="${k}">${icon(kindIcon(k))}${n.toLocaleString()}</span>`).join('')}</div></article>`),true);$$('[data-scope]').forEach(e=>{const hash=e.dataset.scope;e.querySelectorAll('.scope-identity,.scope-covers').forEach(b=>b.onclick=()=>enterScope(hash));e.querySelector('.scope-bind').onclick=()=>showSettings('bindings',hash);e.querySelectorAll('img:not([data-video])').forEach(img=>img.onerror=()=>{const slot=img.parentElement;if(slot.dataset.coverKind==='video'){img.removeAttribute('src');img.dataset.video=slot.dataset.coverId;observeVideoCovers(e)}else if(!retryThumbnail(img,slot.dataset.coverId,slot.dataset.coverModified))slot.innerHTML=icon('image')});e.querySelectorAll('[data-type]').forEach(el=>color(el,el.dataset.type))})}
 else{reconcileCards(visible,visible.map(x=>x.directory?`<article class="asset directory" data-folder="${esc([x.folder,x.name].filter(Boolean).join('/'))}"><button class="cover folder-cover" aria-label="${t('openFolder',{name:esc(x.name)})}">${icon('folder')}</button><button class="asset-name" title="${esc(x.name)}">${esc(x.name)}</button><div class="asset-meta">${t('folder')}</div><div class="asset-context">${t('folder')}</div></article>`:`<article class="asset" data-id="${x.id}"><input type="checkbox" aria-label="${t('select', {p1: esc(x.name)})}"><button class="cover" aria-label="${t('preview', {p2: esc(x.name)})}">${x.kind==='video'&&!x.preview?`<img data-video="${x.id}" alt="" aria-hidden="true">`:x.preview?`<img data-thumb="thumb/${x.preview}?v=${x.modified}&thumb=2" decoding="async" alt="">` :fileCover(x)}${x.kind==='video'?`<span class="media-kind">${icon('video')+t('video')}</span>`:''}${isWechat()&&x.thumbnail?`<span class="media-kind">${t('thumbnail')}</span>`:''}</button><button class="asset-name" title="${esc(x.name)}">${esc(x.name)}</button><div class="asset-meta"><span>${bytes(x.size)}${x.star?icon('star'):''}</span><span>${coverDateFormats.short.format(x.modified)}</span></div><div class="asset-context"><span title="${esc(fileContext(x))}">${esc(fileContext(x))}</span><span>${esc(x.tags|| (isWechat()&&x.thumbnail?t('thumbnail'):t('originalFile')))}</span></div><div class="asset-format"><strong>${esc(x.ext.slice(1).toUpperCase()||'FILE')}</strong><span>${esc(labels[x.kind]||t('otherFiles'))}</span></div><div class="asset-size">${bytes(x.size)}</div><time class="asset-modified" datetime="${new Date(x.modified).toISOString()}"><span>${coverDateFormats.date.format(x.modified)}</span><span>${coverDateFormats.time.format(x.modified)}</span></time><div class="asset-flags">${x.star?icon('star'):''}${x.tags?icon('tag'):''}</div></article>`),false);$$('.asset:not(.directory)').forEach(e=>{const x=itemIndex.get(e.dataset.id);color(e,x.kind);e.querySelector('input').onchange=ev=>setSelected(x.id,ev.target.checked);e.onclick=ev=>{
  if(ev.target.closest('input'))return;
  if(ev.metaKey||ev.ctrlKey){
   ev.preventDefault();
   setSelected(x.id,!selected.has(x.id));
  }else if(ev.target.closest('button'))openDetail(x);
 };const img=e.querySelector('img');if(img&&!img.dataset.video)img.onerror=()=>{if(x.kind==='video'){img.removeAttribute('src');img.dataset.video=x.id;observeVideoCovers(e)}else if(!retryThumbnail(img,x.id,x.modified))fallback(e.querySelector('.cover'),x)}})}
 $$('.directory button').forEach(b=>b.onclick=()=>enterFolder(b.closest('[data-folder]').dataset.folder));observeImageCovers($('#items'));observeVideoCovers($('#items'));selection();
}
let itemIndex=new Map(),loadingMore=false,loadFailed=false,requestParams='',listAbort=null;
let resultKey='',requestKey='',catalogIndexing=false,scanToast,listLoadingText;
const catalogPages=new Map();
$('#catalogLoadingMark').append(loadingMark());
const virtual=new VirtualList($('#resourceScroll'),$('#items'),paint,()=>loadMore(),$('#timelineRail'),compactBytes);
function emptyFolderView(){return state.root&&(browseFolders()||folder)&&!kind&&!star&&!searchQuery}
function emptyState(){
 if(browseTimeline()&&hasDateRange())return ['timelineNoMatchingDates','timelineTryDifferentDates','timelineClearDates',()=>applyDateRange('','')];
 if(emptyFolderView()){
  if(inVault&&!folder)return ['privateEmpty','privateEmptyHint','privateBackToLibrary',()=>leaveVault()];
  if(folder)return ['emptyFolder','emptyFolderDescription','parentFolder',()=>enterFolder(folder.split('/').slice(0,-1).join('/'))];
  return ['emptyFolder','emptyFolderDescription','changeResourceFolder',directoryUI.open];
 }
 if(!state.root)return ['noResourceFolderSelected','emptyLibraryHint','changeResourceFolder',directoryUI.open];
 if(star&&!searchQuery)return ['emptyFavorites','emptyFavoritesHint','allResources',()=>setView('')];
 if(!kind&&!scope&&!searchQuery)return ['emptyLibrary','emptyLibraryHint','changeResourceFolder',directoryUI.open];
 return ['noMatchingResources','tryDifferentKeywordsOrChangeTheFilters','clearFilters',()=>searchQuery?applyLibrarySearch(''):setView('')];
}
function renderEmpty(){
 const empty=$('#empty');
 empty.hidden=!!result.total||state.scanning||catalogIndexing||resultKey!==requestKey||loadFailed;
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
 virtual.set(result.items,{scopes:isScopes(),list:!isScopes()&&prefs.view==='list',compact:prefs.density==='compact',group:browseTimeline()||isWechat()&&!!scope,stickyGroups:browseTimeline(),partialGroup:result.items.length<result.total});
 header();syncSelects();selection();
}
function setListLoading(label){
 listLoadingText=label;
 const status=$('#loadState');
 status.replaceChildren(loadingMark(),document.createTextNode(label()));
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
 const v=version;loadingMore=true;setListLoading(()=>t('loadingMore'));
 try{const p=new URLSearchParams(requestParams);p.set('offset',result.items.length);const r=await api((resultMode+'?')+p,undefined,listAbort?.signal);if(v!==version)return;if(!r.items.length){loadFailed=true;$('#loadState').textContent=t('theListHasChangedClickToRetry');return}result.items.push(...r.items);for(const item of r.items)itemIndex.set(item.id,item);render()}
 catch(e){if(v===version&&e.name!=='AbortError'){loadFailed=true;$('#loadState').textContent=t('couldNotLoadClickToRetry')}}finally{if(v===version){loadingMore=false;finishListLoading();if(!loadFailed){$('#loadState').textContent=result.items.length<result.total?t('scrollToLoadMore'):t('allResourcesLoaded');virtual.draw()}}}
}
$('#loadState').onclick=()=>{if(resultKey!==requestKey||!result.items.length){load();return}loadFailed=false;loadMore()};
async function load({scrollTop,reusePage=false,rebuilding=false}={}){
 listAbort?.abort();listAbort=new AbortController();const v=++version,endpoint=resultEndpoint();loadingMore=true;loadFailed=false;
 const restore=scrollTop??0;
 const p=new URLSearchParams({kind:scope?scopeKinds.join(','):kind,star:star?'1':'0',search:searchQuery,group:scope,folder,private:inVault?'1':'0',sort:listSort(),thumbs:!isWechat()||prefs.thumbs?'1':'0',offset:0,limit:200});
 if(browseTimeline()){
  if(dateRange.start)p.set('modifiedFrom',new Date(dateRange.start+'T00:00:00').getTime());
  if(dateRange.end){
   const end=new Date(dateRange.end+'T00:00:00');
   end.setDate(end.getDate()+1);
   p.set('modifiedBefore',end.getTime());
  }
 }
 requestParams=p.toString();
 const key=requestKey=endpoint+'?'+requestParams;
 if(!reusePage||state.scanning)catalogPages.clear();
 const cacheable=!!state.root&&!inVault&&!state.scanning&&!p.get('search');
 const cached=cacheable?catalogPages.get(key):null;
 let rebuildNotice;
 if(!cached){
  $('#empty').hidden=true;
  $('#items').hidden=rebuilding||resultKey!==key;
  $('#summary').textContent=stateSummary();
  setListLoading(()=>t('loading'));
  if(rebuilding)rebuildNotice=setTimeout(()=>{
   if(v===version)setListLoading(()=>t('rebuildingResourceIndex'));
  },180);
 }
 try{
 const r=cached??await api(key,undefined,listAbort.signal);
 if(v!==version)return;
 if(folder&&typeof r.folderFallback==='string'){
  folder=r.folderFallback;
  offset=0;
  header();
  return load({reusePage,rebuilding});
 }
 if(cacheable&&!state.scanning){
  catalogPages.delete(key);
  if(catalogPages.size>=7)catalogPages.delete(catalogPages.keys().next().value);
  catalogPages.set(key,r);
 }
 const next={...r,items:[...r.items]};
 // Restore enough metadata before restoring a deep history position.
 while(restore>0&&next.items.length<next.total&&next.items.length<Math.ceil(restore/78)*8+200){p.set('offset',next.items.length);const more=await api((endpoint+'?')+p,undefined,listAbort.signal);if(v!==version)return;if(!more.items.length)break;next.items.push(...more.items)}
 result=next;resultMode=endpoint;
 itemIndex=new Map(next.items.map(item=>[item.id,item]));
 resultKey=key;
 const reveal=finishCatalogIndex(true);
 $('#items').hidden=false;
 $('#resourceScroll').scrollTop=0;
 render();
 if(reveal)($('#empty').hidden?$('#items'):$('#empty')).animate(
  [{opacity:0,transform:'translateY(5px)'},{opacity:1,transform:'translateY(0)'}],
  {duration:matchMedia('(prefers-reduced-motion: reduce)').matches?0:220,easing:'ease-out'}
 );
 if(restore)$('#resourceScroll').scrollTop=restore;
 $('#loadState').textContent=result.items.length<result.total?t('scrollToLoadMore'):t('allResourcesLoaded');
 }catch(e){if(v===version&&e.name!=='AbortError'){resultKey='';$('#notice').textContent=t('couldNotLoadResources')+e.message;$('#loadState').textContent=t('clickToRetry');loadFailed=true}}
 finally{clearTimeout(rebuildNotice);if(v===version){finishCatalogIndex();loadingMore=false;finishListLoading();virtual.draw()}}
}
function stateSummary(){
 if(state.scanning&&!result.items.length)return t('scanningFilesFound',{p0:(state.scanned||0).toLocaleString(getLocale())});
 if(!state.root||resultMode!==resultEndpoint()||resultKey!==requestKey)return t('readingLocalResources');
 if(isScopes())return t('resourcesLabel',{p0:(result.resources||0).toLocaleString(getLocale()),p1:bytes(result.bytes||0)});
 const count=browseFolders()?result.fileCount||0:result.total||0;
 return t('filesAndSize',{p0:count.toLocaleString(getLocale()),p1:bytes(result.bytes||0)});
}
function renderState(){$('#storage strong').textContent=bytes(state.bytes||0);$('#storage>span').textContent=`${t('files', {p0: (state.total||0).toLocaleString(getLocale())})}`;$('#summary').textContent=stateSummary();$('#notice').textContent=state.error?t('scanFailed')+state.error:state.skipped?`${t('skippedUnreadableResources', {p0: state.skipped})}`:'';$('#refresh').disabled=state.scanning;$('#freshness').textContent=state.scanning?t('scanning'):state.updated?t('updatedAt')+new Date(state.updated).toLocaleTimeString(getLocale()):t('waitingToScan');renderNavStats();
}
function refreshState(){
 stateRefresh=stateRefresh.catch(()=>{}).then(syncState);
 return stateRefresh;
}
async function syncState(){
 if(pendingDirectory&&!pendingDirectory.started)return;
 const previous=state;
 const next=await api('status');
 if(pendingDirectory&&!pendingDirectory.started)return;
 const rootChanged=next.root!==previous.root;
 const vaultClosed=inVault&&!next.vaultUnlocked;
 const snapshot=rootChanged?await api('settings'):null;
 const catalogChanged=rootChanged||vaultClosed||next.updated!==lastUpdate;
 const scanFinished=next.updated!==lastUpdate&&!next.scanning&&!next.error
  &&(previous.scanning||pendingDirectory?.started||!previous.updated);
 state=next;
 if(scanFinished)catalogIndexing=true;
 if(next.scanning)catalogPages.clear();
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
 renderState();applyTheme();header();updateDirectoryUI();updateUsage();
 if(page==='settings'&&(rootChanged||previous.scanning!==next.scanning))settingsUI.render();
 if(scanFinished&&!inVault&&pendingDirectory?.started&&!pendingDirectory.rescan&&!pendingDirectory.ready&&!pendingDirectory.stayInSettings){
  navigate(()=>{
   if(!rootChanged)resetLibraryView();
   showLibrary();
  });
 }
 if(catalogChanged){
  lastUpdate=next.updated;
  groupOptions();syncSelects();renderBreakdown();
  await load();
 }
 setupTour?.refresh();
}
async function poll(){try{await refreshState()}catch(e){$('#notice').textContent=t('couldNotConnectToTheLocalService')+e.message}finally{setTimeout(poll,state.scanning?1000:5000)}}
function closeMobileSidebar(){
 document.body.classList.remove('mobile-nav');
 const restoreFocus=innerWidth<=720&&$('#sidebar').contains(document.activeElement);
 syncSidebar();
 if(restoreFocus)$('#toggleSidebar').focus();
 directoryUI.hideInfo();
}
function setPage(next){
 page=next;
 $('#libraryPage').hidden=page!=='library';
 $('#settingsPage').hidden=page!=='settings';
 $('#usagePage').hidden=page!=='usage';
 $('#openUsage').classList.toggle('active',page==='usage');
}
function showLibrary(){setPage('library');closeMobileSidebar();header()}
let usageRequest,usageKey,usageData,usageFailed=false,usageRenderKey;
function updateUsage(){
 if(page!=='usage')return;
 const thumbs=!isWechat()||prefs.thumbs;
 const key=JSON.stringify([state.root,state.updated,thumbs,new Date().toDateString()]);
 if(key!==usageKey){
  usageRequest?.abort();
  usageKey=key;
  usageData=null;
  usageFailed=false;
  usageRequest=null;
 }
 if(!usageRequest&&!usageData&&!usageFailed&&state.root&&state.updated){
  const request=new AbortController();
  usageRequest=request;
  api('activity?thumbs='+(thumbs?1:0),undefined,request.signal).then(data=>{
   if(request!==usageRequest)return;
   usageRequest=null;
   if(data.root!==state.root||data.updated!==state.updated)return;
   usageData=data;
   updateUsage();
  }).catch(()=>{
   if(request!==usageRequest)return;
   usageRequest=null;
   usageFailed=true;
   updateUsage();
  });
 }
 const counts=resourceCounts(),sizes=resourceKindBytes();
 const name=state.root?directoryUI.name(state.root):t('waitingToScan');
 const status=usageFailed?'usageError':state.scanning?'scanning':state.updated?'usageLoading':'waitingToScan';
 const renderKey=JSON.stringify([key,counts,sizes,state.folderCount,name,status,!!usageData,getLocale()]);
 if(renderKey===usageRenderKey)return;
 usageRenderKey=renderKey;
 const root=$('#usageContent');
 const focusHeading=document.activeElement===root.querySelector('h1');
 renderUsage(root,{name,counts,sizes,folders:state.folderCount||0,activity:usageData,status,
  retry:usageFailed?()=>{usageFailed=false;updateUsage();$('#usageTitle').focus()}:null,labels,bytes,esc});
 if(focusHeading)$('#usageTitle').focus({preventScroll:true});
}
function showUsage(){
 setPage('usage');closeMobileSidebar();header();updateUsage();setupTour?.refresh();
}
function enterFolder(path){navigate(()=>{if(inVault)selected.clear();searchQuery='';folder=path;scope='';offset=0;showLibrary();load({reusePage:true})})}
function enterScope(hash){navigate(()=>{searchQuery='';scope=hash;scopeKinds=hash&&kind?[kind]:[];offset=0;$('#group').value=hash;$('#resourceScroll').scrollTop=0;showLibrary();load({reusePage:true})})}
function setView(k,s=false){if(inVault)return leaveVault(()=>setView(k,s));navigate(()=>{searchQuery='';kind=k;star=s;scope='';scopeKinds=[];offset=0;$('#group').value='';showLibrary();load({reusePage:true})})}
function showSettings(tab='general',hash=''){if(inVault)return leaveVault(()=>showSettings(tab,hash));navigate(()=>{if($('#detail').open)closeDetail();setPage('settings');closeMobileSidebar();header();settingsUI.open(tab,hash);$('#settingsPage').scrollTop=0;setupTour?.refresh()})}
async function rescan(){
 if(!state.root||state.scanning||sourceBusy||choosingSource)return;
 await scanDirectory(async()=>{
  await api('scan',{});
  return true;
 }, {path:state.root, rescan:true});
}
async function choose(root,{stayInSettings=false}={}){
 if(choosingSource||sourceBusy||state.scanning)return false;
 if(inVault){await leaveVault();if(inVault)return false}
 return scanDirectory(()=>api('choose',root?{root}:{}), {path:root,stayInSettings});
}
async function scanDirectory(startScan, pending){
 choosingSource=true;
 pendingDirectory=pending;
 updateDirectoryUI();
 if(page==='settings')settingsUI.render();
 setupTour?.refresh();
 try{
  if(!await startScan())return false;
  pending.started=true;
  await refreshState();
  while(state.scanning){
   await new Promise(resolve=>setTimeout(resolve,350));
   await refreshState();
  }
  if(state.error)throw Error(state.error);
  if(!pending.rescan)directoryUI.refresh().catch(()=>{});
  return true;
 }catch(error){
  toast(error.message,'error');
  return false;
 }finally{
  pendingDirectory=null;
  choosingSource=false;
  updateDirectoryUI();
  if(page==='settings')settingsUI.render();
  setupTour?.refresh();
 }
}

const directoryUI=createDirectorySwitcher({
 api, choose:root=>{
  if(root&&root===state.root){
   if(inVault)return leaveVault();
   navigate(showLibrary);
  }else choose(root);
 },openSettings:()=>showSettings('data'),openResource:openRecentResource,onError:error=>toast(error.message,'error'),
 getState:()=>state,getBusy:()=>choosingSource||sourceBusy,
 getPending:()=>pendingDirectory,
 onChange:()=>{
  header();
  syncSelects();
  settingsUI?.refreshDirectories();
 }
});
function directoryActivity(){
 if(catalogIndexing)return t('buildingResourceIndex');
 if(state.scanning){
  return state.scanned
   ? t('scanningFilesFound',{p0:state.scanned.toLocaleString(getLocale())})
   : t('scanningLabel');
 }
 if(pendingDirectory?.ready)return '';
 if(pendingDirectory?.rescan)return t('scanningLabel');
 if(pendingDirectory?.path)return t('switchingResourceFolder');
 return '';
}
function updateCatalogLoading(label){
 const panel=$('#catalogLoading');
 const visible=!!label;
 if(visible&&panel.hidden)$('#resourceScroll').scrollTop=0;
 panel.hidden=!visible;
 const progress=$('#catalogLoadingProgress');
 const detail=label===t('buildingResourceIndex')?'':label;
 if(progress.textContent!==detail)progress.textContent=detail;
 if(visible){
  if(scanToast)scanToast.update(label);
  else scanToast=toast(label,'loading');
 }else if(scanToast){
  scanToast.settle(t('resourceScanActivity'));
  scanToast=null;
 }
}
function finishCatalogIndex(succeeded=false){
 if(!catalogIndexing)return false;
 catalogIndexing=false;
 if(pendingDirectory)pendingDirectory.ready=true;
 updateDirectoryUI();
 if(succeeded)toast(t('resourceScanComplete'),'success');
 return true;
}
function updateDirectoryUI(){
 directoryUI.render();
 syncSelects();
 const label=directoryActivity();
 updateCatalogLoading(label);
 $('#directoryActivity').hidden=!label;
 if($('#directoryActivityLabel').textContent!==label)$('#directoryActivityLabel').textContent=label;
 $('#refresh').disabled=!state.root||state.scanning||choosingSource||sourceBusy;
 syncGroupingControls();
 settingsUI?.updateDirectoryStatus();
}
const privateUI=createPrivateSpace({dialog:$('#vaultDialog'),api});

function clearCatalog(){
 commandPalette.close();
 ++version;listAbort?.abort();
 catalogPages.clear();resultKey=requestKey='';
 if($('#detail').open)closeDetail();
 selected.clear();result={items:[],total:0};itemIndex.clear();
 resultMode=resultEndpoint();
 $('#items').hidden=false;
 virtual.set([],{scopes:isScopes(),list:prefs.view==='list'});
 $('#items').replaceChildren();
 observeImageCovers($('#items'));
 $('#empty').hidden=true;
 selection();
 clearVideoCovers();clearAudioCache();
}
function resetLibraryView(){
 dateRange={start:'',end:''};
 folder='';scope='';scopeKinds=[];kind='';star=false;offset=0;searchQuery='';$('#group').value='';
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
  if(makePrivate)directoryUI.forgetPrivate(root,ids);
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

settingsUI=createSettings({$,esc,icon,api,toast,getPrefs:()=>prefs,getState:()=>state,getContacts:()=>contacts,getSource:()=>source,isWechat,sourceBusy:()=>sourceBusy||choosingSource,changeSource,groupingMode,groupingOptions,changeGrouping,setPref,onNavigate:navigate,onContacts:c=>{contacts=c;groupOptions();syncSelects();load()},choose,rescan,directoryName:directoryUI.name,directoryEntries:directoryUI.entries,editDirectory:async (...args)=>{await directoryUI.edit(...args);await refreshState()},removeDirectory:async root=>{await directoryUI.remove(root);await refreshState()},directoryActivity,getPendingDirectory:()=>pendingDirectory?.path,getDevelopment:()=>development,startTour:()=>setupTour.start({force:true}),replayTour:()=>{navigate(()=>showLibrary());setupTour.start({force:true,preview:true})}});
setupTour=createSetupTour({getState:()=>state,getRoute:()=>({page,tab:settingsUI.location().tab}),getBusy:()=>choosingSource,isDismissed:()=>prefs.setupTourDismissed,onDismiss:()=>setPref('setupTourDismissed',true),onComplete:()=>toast(t('tourComplete')),onPreviewComplete:()=>toast(t('tourPreviewComplete'))});
function renderImageOverview(img,item){
 const width=img.naturalWidth,height=img.naturalHeight;if(!width||!height)return;
 let a=width,b=height;while(b){const rest=a%b;a=b;b=rest}const w=width/a,h=height/a;
 const ratio=w<=32&&h<=32?`${w}:${h}`:width>=height?`${(width/height).toLocaleString(getLocale(),{maximumFractionDigits:2})}:1`:`1:${(height/width).toLocaleString(getLocale(),{maximumFractionDigits:2})}`;
 const facts=[new Date(item.modified).toLocaleString(getLocale(),{year:'numeric',month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'}),bytes(item.size),ratio,t(width===height?'squareImage':width>height?'landscapeImage':'portraitImage')];
 $('#detailSubtitle').replaceChildren(...facts.map(value=>{const span=document.createElement('span');span.textContent=value;return span}));
}
let recentResourceOpening = false;
async function openRecentResource({root, id}) {
 if(recentResourceOpening)return;
 recentResourceOpening=true;
 try {
  if(inVault){await leaveVault();if(inVault)return}
  if(root!==state.root&&!await choose(root))return;
  const params=new URLSearchParams({root,id});
  const response=await fetch('api/resource?'+params);
  if(response.status===404){
   if(state.root===root&&!state.scanning){
    directoryUI.forgetFile(root,id);
    toast(t('recentResourceUnavailable'),'error');
   }
   return;
  }
  if(!response.ok)throw Error(await response.text());
  const item=await response.json();
  if(state.root!==root||state.scanning||choosingSource||inVault)return;
  navigate(showLibrary);
  openDetail(item);
 }catch(error){toast(error.message,'error')}
 finally{recentResourceOpening=false}
}
function openDetail(item){
 disposePlayer?.();disposePlayer=null;disposeTags?.();detailMetadata?.dispose();detailHistogram?.dispose();detailHistogram=null;const token=++detailVersion;detail={...item};const x=detail;const index=result.items.findIndex(r=>r.id===x.id);color($('#detail'),x.kind);$('#detailBadge').innerHTML=icon(kindIcon(x.kind))+t('resourceDetails');$('#detailType').textContent=(labels[x.kind]||t('other'))+' / '+x.ext.slice(1).toUpperCase();$('#detailName').textContent=x.name;$('#detailName').title=x.name;$('#fullscreenFilename').textContent=x.name;$('#detailSubtitle').replaceChildren();$('#detailSubtitle').hidden=x.kind!=='image';$('#detailPosition').textContent=browseFolders()?`${t('of', {p0: result.items.slice(0,index+1).filter(x=>!x.directory).length, p1: result.fileCount})}`:`${t('of', {p0: index+1, p1: result.total})}`;$('#prevDetail').disabled=!result.items.slice(0,index).some(x=>!x.directory);$('#nextDetail').disabled=!result.items.slice(index+1).some(x=>!x.directory)&&result.items.length>=result.total;$('#starItem').innerHTML=icon('star')+(x.star?t('favorited'):t('favorite'));detailMetadata=mountImageMetadata($('#metadata'),{...x,thumbnail:isWechat()&&x.thumbnail});disposeTags=mountTagEditor($('#tagEditor'),x.tags,async tags=>{await api('mark',{id:x.id,star:x.star,tags});x.tags=tags;load()});$('#detailPath').textContent=x.path;$('#detailPath').title=x.path;$('#detailLocationLabel').textContent=t(isWechat()?'conversationLabel':'containingFolder');$('#detailContact').innerHTML=isWechat()?`<span class="avatar">${x.group==='未分组'?icon('folder'):contactAvatar(x.group)}</span><span><strong>${esc(contactName(x.group))}</strong><small>${esc(contacts[x.group]?.username||x.group.slice(0,16)+'…')}</small></span>${icon('chevron')}`:`<span class="avatar">${icon('folder')}</span><span><strong>${esc(folderName(x.folder))}</strong><small>${esc(x.folder||folderName(''))}</small></span>${icon('chevron')}`;
 if(index<0){
  $('#detailPosition').textContent='';
  $('#prevDetail').disabled=$('#nextDetail').disabled=true;
 }
 if(!inVault)directoryUI.remember(state.root,x,kindIcon(x.kind));
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
 if(!detail)return;const current=detail.id;const index=result.items.findIndex(x=>x.id===current);if(index<0)return;let i=index+step;
 while(i>=0){
  if(i>=result.items.length){if(step<0||i>=result.total)return;await loadMore();if(i>=result.items.length)return}
  if(!result.items[i].directory){if(detail?.id===current)openDetail(result.items[i]);return}i+=step;
 }
}
$('#prevDetail').onclick=()=>adjacent(-1);$('#nextDetail').onclick=()=>adjacent(1);$('#detailContact').onclick=()=>{const x=detail;closeDetail();if(inVault)enterFolder(x.folder);else if(isWechat())enterScope(x.group);else if(groupingMode()==='grouped'){enterFolder(x.folder)}else{changeGrouping('grouped')?.then(saved=>{if(saved)enterFolder(x.folder)})}};
$$('[data-kind]').forEach(b=>b.onclick=()=>setView(b.dataset.kind));$('#stars').onclick=()=>setView('',true);$('#settingsButton').onclick=()=>showSettings();$('#backScope').onclick=()=>enterScope('');$('#bindScope').onclick=()=>showSettings('bindings',scope);$('#scopeGrouping').onchange=e=>changeGrouping(e.target.value);
$$('#scopeFilters button').forEach(b=>b.onclick=()=>navigate(()=>{const k=b.dataset.scopeKind;scopeKinds=k?(scopeKinds.includes(k)?scopeKinds.filter(v=>v!==k):[...scopeKinds,k]):[];offset=0;load()}));
$('#clearSearch').onclick=()=>applyLibrarySearch('');$('#group').onchange=e=>enterScope(e.target.value);$('#sort').onchange=e=>setPref('sort',e.target.value);$('#clearSelection').onclick=()=>{selected.clear();selection()};$('#gridView').onclick=()=>setPref('view','grid');$('#listView').onclick=()=>setPref('view','list');$('#refresh').onclick=rescan;
async function doExport(ids){const r=await api('export',{ids});toast(r.count?t('exportedFiles', {p0: r.count}):t('exportCanceled'),r.count?'success':'info')}
$('#export').onclick=()=>action(async()=>{$('#export').disabled=true;try{await doExport([...selected])}finally{selection()}});$('#exportItem').onclick=()=>action(()=>doExport([detail.id]));$('#reveal').onclick=()=>action(()=>api('reveal',{ids:[detail.id]}));
$('#copyRelativePath').onclick=()=>action(async()=>{if(!detail)return;await copyPath(relativeResourcePath(detail.path,state.root));toast(t('relativePathCopied'),'success')});$('#copyAbsolutePath').onclick=()=>action(async()=>{if(!detail)return;await copyPath(detail.path);toast(t('absolutePathCopied'),'success')});
$('#starItem').onclick=()=>action(async()=>{if(!detail)return;const x=detail;$('#starItem').disabled=true;try{await api('mark',{id:x.id,star:!x.star,tags:x.tags});x.star=!x.star;if(detail?.id===x.id)$('#starItem').innerHTML=icon('star')+(x.star?t('favorited'):t('favorite'));toast(x.star?t('addedToFavorites'):t('removedFromFavorites'),'success');await refreshState();await load()}finally{$('#starItem').disabled=false}});
function syncSidebar(){
 const expanded=innerWidth<=720?document.body.classList.contains('mobile-nav'):!prefs.sidebarCollapsed;
 const toggle=$('#toggleSidebar');
 const label=t(expanded?'collapseSidebar':'expandSidebar');
 $('#sidebar').inert=!expanded;
 toggle.setAttribute('aria-expanded',String(expanded));
 toggle.setAttribute('aria-label',label);
 toggle.title=label;
}
function sidebar(){
 directoryUI.hideInfo();
 if(innerWidth<=720){
  if(document.body.classList.contains('mobile-nav'))closeMobileSidebar();
  else{
   document.body.classList.add('mobile-nav');
   syncSidebar();
  }
 }else setPref('sidebarCollapsed',!prefs.sidebarCollapsed);
}
$('#openUsage').onclick=event=>{
 event.stopPropagation();
 if(page==='usage')return;
 const open=()=>navigate(()=>{
  if($('#detail').open)closeDetail();
  showUsage();
  $('#usagePage').scrollTop=0;
  $('#usageTitle').focus({preventScroll:true});
 });
 if(inVault)leaveVault(open);else open();
};
$('#toggleStorage').onclick=event=>{
 const button=event.currentTarget;
 const expanded=button.getAttribute('aria-expanded')!=='true';
 button.setAttribute('aria-expanded',String(expanded));
 $('#storageDetails').inert=!expanded;
};
$('#toggleSidebar').onclick=sidebar;
$('#sidebarShade').onclick=closeMobileSidebar;
function applyLibrarySearch(query, conversation=''){
 if($('#detail').open)closeDetail();
 navigate(()=>{
  searchQuery=query;
  folder='';scope=conversation;scopeKinds=[];kind='';star=false;offset=0;
  $('#group').value=conversation;
  showLibrary();
  load({reusePage:true});
 });
}
const commandBusy=()=>sourceBusy||choosingSource||state.scanning||vaultBusy;
const commandRow=(key,label,glyph,run,meta='',shortcut=false)=>({key,label,glyph,run,meta,shortcut});
function commandGroups(query,category){
 const needle=query.toLowerCase();
 const matches=(...fields)=>fields.some(field=>field?.toLowerCase().includes(needle));
 const route=callback=>()=>{
  if($('#detail').open)closeDetail();
  callback();
 };
 const actions=inVault?[
  commandRow('lock',t('privateLock'),'lock',leaveVault)
 ]:[
  ...(!commandBusy()?[commandRow('add',t('newSource'),'add',route(()=>choose()))]:[]),
  commandRow('favorites',t('favorites'),'star',route(()=>setView('',true))),
  commandRow('settings',t('settings'),'settings',route(()=>showSettings()),'⌘ ,',true),
  ...(state.root&&!commandBusy()?[commandRow('rescan',t('rescan'),'refresh',rescan)]:[])
 ];
 const root=state.root;
 const locations=[];
 if(!inVault&&!commandBusy()){
  const directories=directoryUI.entries();
  const sources=root&&!directories.some(entry=>entry.path===root)?[{path:root},...directories]:directories;
  for(const entry of sources){
   const name=directoryUI.name(entry.path);
   if(matches(name,entry.path)){
    locations.push(commandRow('source:'+entry.path,name,'folder',route(()=>{
     if(entry.path===state.root){applyLibrarySearch('');return}
     choose(entry.path);
    }),entry.path===root?t('commandCurrentSource'):entry.path));
   }
  }
  if(isWechat()){
   for(const hash of state.groups){
    const contact=contacts[hash];
    if(!query&&!contact?.name)continue;
    const name=hash==='未分组'?t('rootFiles'):contact?.name||hash;
    if(matches(name,contact?.username,hash)){
     locations.push(commandRow('scope:'+hash,name,'users',()=>{
      if(root===state.root&&!commandBusy())applyLibrarySearch('',hash);
     },contact?.username||t('conversationLabel')));
    }
   }
  }
 }
 return [
  {category:'actions',label:t('commandQuickActions'),rows:actions.filter(row=>matches(row.label))},
  {category:'locations',label:t('commandLocations'),rows:locations.slice(0,query||category==='locations'?24:3)}
 ];
}
async function commandFiles(query,signal){
 const root=state.root, privateOnly=inVault;
 const group={label:t(query?'commandFiles':'recentlyModified'),rows:[]};
 if(!root||commandBusy())return group;
 if(!query&&!privateOnly){
  const recents=directoryUI.recentFiles().filter(item=>item.root===root).slice(0,5);
  if(recents.length){
   return {label:t('commandRecentFiles'),rows:recents.map(item=>commandRow('file:'+item.id,item.label,item.glyph,()=>openRecentResource(item),relativeResourcePath(item.path,root)))};
  }
 }
 const params=new URLSearchParams({search:query,private:privateOnly?'1':'0',thumbs:!isWechat()||prefs.thumbs?'1':'0',limit:query?20:5});
 const response=await api('list?'+params,undefined,signal);
 if(root!==state.root||privateOnly!==inVault||commandBusy())return group;
 group.rows=response.items.map(item=>commandRow('file:'+item.id,item.name,kindIcon(item.kind),()=>{
  if(root!==state.root||privateOnly!==inVault||commandBusy())return;
  if(page!=='library')navigate(showLibrary);
  else closeMobileSidebar();
  openDetail(item);
 },fileContext(item)));
 if(query&&response.total){
  group.rows.push(commandRow('all-files',t('commandShowMatches',{count:response.total.toLocaleString(getLocale())}),'search',()=>{
   if(root===state.root&&privateOnly===inVault&&!commandBusy())applyLibrarySearch(query);
  }));
 }
 return group;
}
const commandDialog=$('#commandPalette');
const commandPalette=createCommandPalette({
 dialog:commandDialog,trigger:$('#sourceSearch'),getGroups:commandGroups,getFiles:commandFiles,
 getPlaceholder:()=>inVault?t('commandPrivateSearch'):t('commandSearch')
});
function toggleCommands(){
 if(commandDialog.open){commandPalette.close();return}
 if($$('dialog[open]').some(dialog=>dialog.id!=='detail'))return;
 directoryUI.hideInfo();
 commandPalette.open();
}
$('#sourceSearch').onclick=toggleCommands;
document.addEventListener('keydown',e=>{
 if(e.defaultPrevented||e.isComposing)return;
 const shortcut=(e.metaKey||e.ctrlKey)&&!e.altKey&&!e.shiftKey;
 if(shortcut&&e.key.toLowerCase()==='k'){
  e.preventDefault();
  if(!e.repeat)toggleCommands();
  return;
 }
 if($('#vaultDialog').open)return;
 if(commandDialog.open){
  if(shortcut&&e.key===','&&!inVault){
   e.preventDefault();
   commandPalette.close();
   showSettings();
  }
  return;
 }
 const editing=['INPUT','TEXTAREA','SELECT'].includes(document.activeElement?.tagName);
 if(!$('#detail').open&&((e.metaKey&&(e.key==='['||e.key===']'))||(e.altKey&&!editing&&(e.key==='ArrowLeft'||e.key==='ArrowRight')))){
  e.preventDefault();
  travel(e.key==='['||e.key==='ArrowLeft'?-1:1);
  return;
 }
 if((e.metaKey||e.ctrlKey)&&e.key===','){e.preventDefault();showSettings()}
 if((e.metaKey||e.ctrlKey)&&e.key==='\\'){e.preventDefault();sidebar()}
 if($('#detail').open&&!$('#detail').classList.contains('preview-expanded')&&!e.defaultPrevented&&!['INPUT','TEXTAREA','SELECT'].includes(document.activeElement?.tagName)){
  if(e.key==='ArrowLeft')adjacent(-1);
  if(e.key==='ArrowRight')adjacent(1);
 }
 if(e.key==='Escape'&&document.body.classList.contains('mobile-nav'))closeMobileSidebar();
});
function applyLocale(){
 setLocale(prefs.locale);translateStatic();updateDirectoryUI();labels=kindLabels();groupOptions();applyTheme();
 renderBreakdown();
 renderState();if(loadingMore&&listLoadingText)setListLoading(listLoadingText);else $('#loadState').textContent=loadFailed?t('clickToRetry'):result.items.length<result.total?t('scrollToLoadMore'):t('allResourcesLoaded');render();header();updateUsage();if(page==='settings')settingsUI.render();setupTour?.refresh();
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
