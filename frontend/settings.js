import {getLocale,t} from './i18n.js';
export function createSettings({$,esc,icon,api,toast,getPrefs,getState,getContacts,getSource,isWechat,sourceBusy,changeSource,groupingMode,groupingOptions,changeGrouping,setPref,onContacts,choose,rescan,directoryName,directoryEntries,editDirectory,removeDirectory,directoryActivity,getPendingDirectory,onNavigate,startTour,getDevelopment=()=>false,replayTour}){
 let section='general',bindingHash='',historyAction=null,historySaving=false;
 const intro=(h,p)=>`<div class="settings-intro"><h2>${h}</h2><p>${p}</p></div>`;
 const toggle=(key,title,desc)=>`<div class="setting-row"><div><strong>${title}</strong><small>${desc}</small></div><button type="button" class="switch" role="switch" aria-label="${title}" aria-checked="${!!getPrefs()[key]}" data-toggle="${key}"></button></div>`;
 const select=(key,title,desc,options)=>`<div class="setting-row"><div><strong>${title}</strong><small>${desc}</small></div><select data-pref="${key}" aria-label="${title}">${options.map(([v,n])=>`<option value="${v}" ${String(getPrefs()[key])===String(v)?'selected':''}>${n}</option>`).join('')}</select></div>`;
 const groupingControl=st=>`<div class="setting-row"><div><strong>${t('resourceGrouping')}</strong><small>${t('sourceBrowseDescription')}</small></div><select id="settingsGrouping" aria-label="${t('resourceGrouping')}" ${!st.root||st.scanning||sourceBusy()?'disabled':''}>${groupingOptions().map(([v,n])=>`<option value="${v}" ${groupingMode()===v?'selected':''}>${n}</option>`).join('')}</select></div>`;
 const bindOptions=()=>getState().groups?.filter(g=>g!=='未分组').map(g=>`<option value="${esc(g)}">${esc(getContacts()[g]?.name||t('unboundConversation'))} · ${esc(g.slice(0,12))}</option>`).join('')||'';
 const directoryBusy=()=>getState().scanning||sourceBusy();
 function resourceFolder(st){
  const disabled=directoryBusy()?'disabled':'';
  const name=st.root?directoryName(st.root):t('noResourceFolderSelected');
  return `<section class="resource-folder" data-root="${esc(st.root)}" aria-labelledby="currentDirectoryHeading">
   <div class="resource-folder-header">
    <h3 id="currentDirectoryHeading">${t('resourceFolder')}</h3>
    <div class="resource-folder-actions">
     <button id="settingsChoose" type="button" ${disabled}>${icon('folderOpen')+t('directoryBrowse')}</button>
     <button id="settingsScan" type="button" ${!st.root?'disabled':disabled}>${icon('refresh')+t('rescan')}</button>
    </div>
   </div>
   <div class="resource-folder-current">${icon('folder')}<strong class="current-directory-name" title="${esc(name)}">${esc(name)}</strong></div>
   <form id="settingsDirectoryPath" class="settings-directory-path">
    <span id="directoryPathLabel">${t('directoryPath')}</span>
    <button type="button" id="editCurrentDirectoryPath" title="${t('editDirectoryPath')}" ${disabled}>${esc(st.root||t('directoryEnterPath'))}</button>
    <input id="resourceFolderInput" type="text" value="${esc(st.root)}" placeholder="${t('directoryPathPlaceholder')}" aria-labelledby="directoryPathLabel" autocomplete="off" spellcheck="false" hidden>
   </form>
   <div class="directory-status-line">
    <span id="settingsDirectoryStatus"></span>
    <div class="directory-progress" aria-hidden="true"></div>
   </div>
  </section>`;
 }
 function renderDirectoryHistory(){
  const content=$('#directoryHistoryContent');
  if(!content)return;
  const entries=directoryEntries();
  const key=JSON.stringify([getLocale(),historyAction,entries.map(entry=>[entry.path,entry.name,entry.broken]).sort()]);
  if(content.dataset.renderKey===key){
   syncHistoryControls(content);
   return;
  }
  content.dataset.renderKey=key;
  const disabled=directoryBusy()||historySaving?'disabled':'';
  content.innerHTML=entries.length?`<ul>${entries.map(entry=>{
   const name=directoryName(entry.path);
   const action=historyAction?.path===entry.path?historyAction.type:'';
   return `<li>
    <div class="directory-history-row">
     <div class="directory-history-item" title="${esc(entry.path)}">
      ${icon('folder')}<span><strong>${esc(name)}</strong><small>${esc(entry.path)}</small></span>
      ${entry.broken?`<span class="directory-history-status">${t('directoryBroken')}</span>`:''}
     </div>
     <div class="directory-history-actions">
      ${entries.length>1?`<button type="button" class="switch directory-history-switch" role="switch" aria-label="${esc(t('selectDirectoryNamed',{name}))}" title="${esc(t('selectDirectoryNamed',{name}))}" data-directory-select="${esc(entry.path)}" ${disabled}></button>`:''}
      <button type="button" class="icon" data-directory-edit="${esc(entry.path)}" aria-label="${esc(t('editDirectoryNamed',{name}))}" title="${t('edit')}" ${disabled}>${icon('edit')}</button>
      <button type="button" class="icon" data-directory-remove="${esc(entry.path)}" aria-label="${esc(t('removeDirectoryNamed',{name}))}" title="${t('removeDirectory')}" ${disabled}>${icon('trash')}</button>
     </div>
    </div>
    ${action==='edit'?`<form id="editDirectoryRecord" class="directory-history-form">
     <label>${t('directoryAlias')}<input name="alias" maxlength="80" value="${esc(entry.name)}" ${disabled}></label>
     <label>${t('directoryPath')}<input name="path" value="${esc(entry.path)}" required autocomplete="off" spellcheck="false" ${disabled}></label>
     <div class="directory-history-actions"><button type="button" data-history-cancel ${disabled}>${t('cancel')}</button><button type="submit" class="primary" ${disabled}>${t('saveDirectoryName')}</button></div>
    </form>`:action==='remove'?`<form id="removeDirectoryRecord" class="directory-history-confirm">
     <span>${esc(t('removeDirectoryPrompt',{name}))}</span>
     <div class="directory-history-actions"><button type="button" data-history-cancel ${disabled}>${t('cancel')}</button><button type="submit" class="directory-remove-confirm" ${disabled}>${t('removeDirectory')}</button></div>
    </form>`:''}
   </li>`;
  }).join('')}</ul>`:`<p class="directory-history-empty">${t('directoryHistoryEmpty')}</p>`;
  content.querySelectorAll('[data-directory-select]').forEach(button=>button.onclick=()=>{if(!historySaving&&button.getAttribute('aria-checked')==='false')choose(button.dataset.directorySelect,{stayInSettings:true})});
  for(const type of ['edit','remove']){
   content.querySelectorAll(`[data-directory-${type}]`).forEach(button=>button.onclick=()=>{
    if(historySaving)return;
    historyAction={type,path:button.getAttribute(`data-directory-${type}`)};
    renderDirectoryHistory();
    content.querySelector(type==='edit'?'input':'[data-history-cancel]')?.focus();
   });
  }
  const cancel=content.querySelector('[data-history-cancel]');
  if(cancel)cancel.onclick=()=>{
   const {type,path}=historyAction;
   historyAction=null;
   renderDirectoryHistory();
   [...content.querySelectorAll(`[data-directory-${type}]`)].find(button=>button.getAttribute(`data-directory-${type}`)===path)?.focus();
  };
  const form=content.querySelector('form');
  if(form)form.onsubmit=async e=>{
   e.preventDefault();
   if(historySaving||directoryBusy())return;
   const {type,path}=historyAction;
   historySaving=true;
   const controls=[...form.elements];
   controls.forEach(control=>control.disabled=true);
   try{
    if(type==='edit')await editDirectory(path,form.elements.path.value.trim(),form.elements.alias.value);
    else await removeDirectory(path);
    historyAction=null;
   }catch(error){
    toast(error.message,'error');
    controls.forEach(control=>control.disabled=false);
   }finally{
    historySaving=false;
    if(!historyAction||!form.isConnected)renderDirectoryHistory();
   }
  };
  syncHistoryControls(content);
 }
 function syncHistoryControls(content){
  const pending=getPendingDirectory();
  const selected=directoryEntries().some(entry=>entry.path===pending)?pending:getState().root;
  const busy=directoryBusy()||historySaving;
  content.querySelectorAll('button,input').forEach(control=>{control.disabled=busy});
  content.querySelectorAll('[data-directory-select]').forEach(button=>{
   button.setAttribute('aria-checked',String(button.dataset.directorySelect===selected));
  });
 }
 function renderDataContent(root,markup){
  const history=root.querySelector('.directory-history');
  if(!history){root.innerHTML=markup;return}
  // Keep the switches mounted while scan status updates the surrounding settings.
  const next=document.createElement('template');
  next.innerHTML=markup;
  const placeholder=next.content.querySelector('.directory-history');
  history.querySelector('h3').textContent=placeholder.querySelector('h3').textContent;
  for(const child of [...root.children])if(child!==history)child.remove();
  while(next.content.firstElementChild!==placeholder)history.before(next.content.firstElementChild);
  placeholder.remove();
  history.after(next.content);
 }
 function refreshDirectories(){
  const current=$('.current-directory-name');
  const root=getState().root;
  if(current&&root&&current.closest('.resource-folder').dataset.root===root){
   current.textContent=directoryName(root);
   current.title=current.textContent;
  }
  if(!historyAction&&!historySaving)renderDirectoryHistory();
 }
 function updateDirectoryStatus(){
  const status=$('#settingsDirectoryStatus');
  if(!status)return;
  const activity=directoryActivity();
  const error=getState().error;
  const text=activity||(error?t('scanFailed')+error:'');
  if(status.textContent!==text)status.textContent=text;
  status.closest('.resource-folder').classList.toggle('is-scanning',!!activity);
  status.classList.toggle('feature-error',!activity&&!!error);
 }
 function render(){
 if(!historySaving)historyAction=null;
 const p=getPrefs(),st=getState(),contacts=getContacts(),source=getSource(),wechat=isWechat();
 if(section==='bindings'&&!wechat)section='data';
 $('#settingsNav [data-section="bindings"]').hidden=!wechat;
 const modeLabel=mode=>t(mode==='wechat'?'wechatResources':'ordinaryFolder');
 const sourceSettings=st.root?`<div class="setting-row"><div><strong>${t('directoryMode')}</strong><small>${t('directoryModeDescription')}</small></div><select id="sourceMode" aria-label="${t('directoryMode')}" ${st.scanning||sourceBusy()?'disabled':''}>${[['auto',t('autoDetectDefault')],['folder',t('ordinaryFolder')],['wechat',t('wechatResources')]].map(([v,n])=>`<option value="${v}" ${source.mode===v?'selected':''}>${n}</option>`).join('')}</select></div><div class="setting-row"><div><strong>${t('detectedDirectoryType')}</strong><small>${t(st.scanning?'detectionPending':st.detectionReason||'ordinaryDirectory')}</small></div><span class="mode-value">${st.scanning?t('scanningLabel'):modeLabel(st.detectedMode)}</span></div><div class="setting-row"><div><strong>${t('activeDirectoryMode')}</strong><small>${t(source.mode==='auto'?'automaticModeDescription':'manualModeDescription')}</small></div><span class="mode-value">${modeLabel(wechat?'wechat':'folder')}</span></div>`:'';
 $('#settingsNav').querySelectorAll('button').forEach(b=>b.classList.toggle('active',b.dataset.section===section));const root=$('#settingsContent');
 if(section==='general')root.innerHTML=intro(t('general'),t('makeTheLibraryWorkTheWayYouDo'))+`<div class="settings-panel">${select('locale',t('language'),t('languageDescription'),[['zh-CN','简体中文'],['en','English']])}${groupingControl(st)}${wechat?toggle('thumbs',t('showThumbnailFiles'),t('showThumbnailsAlongsideOriginalFiles')):''}${select('sort',t('defaultSortOrder'),t('defaultSortDescription'),[['date',t('recentlyModified')],['size',t('largestFirst')],['name',t('name')]])}${select('view',t('resourceView'),t('fileViewDescription'),[['grid',t('grid')],['list',t('list')]])}</div><p class="settings-note">${t('shortcutsKSearchToggleSidebarSettings')}<br>${t('theToolbarStaysFixedWhileResourcesScrollIndependently')}</p>`;
 if(section==='appearance')root.innerHTML=intro(t('appearance'),t('aFamiliarDarkInterfaceThatLetsYourResources'))+`<div class="theme-options">${[['dark',t('dark')],['light',t('light')],['system',t('followSystem')]].map(([v,n])=>`<button class="theme-option" data-theme-choice="${v}" aria-pressed="${p.theme===v}"><span class="theme-mini ${v}"><span></span><div><b></b><b></b><b></b></div></span><span>${n}</span></button>`).join('')}</div><div class="settings-panel"><div class="setting-row"><div><strong>${t('colorPalette')}</strong><small>${t('chooseColorsForResourceTypesAndPlayers')}</small></div><div class="palette-options">${[['classic',t('classic'),['#83adf7','#d6a0c9','#7bc8b0']],['ocean',t('coast'),['#79baf2','#cd9bc0','#71cbbd']],['forest',t('forest'),['#9db7df','#dca3aa','#99c295']]].map(([v,n,colors])=>`<button data-palette="${v}" aria-label="${t('palette', {p1: n})}" title="${n}" aria-pressed="${p.palette===v}">${colors.map(c=>`<b data-swatch="${c}"></b>`).join('')}</button>`).join('')}</div></div>${toggle('typeColors',t('resourceTypeColors'),t('useDistinctColorsForStatisticsAndFileType'))}${select('density',t('displayDensity'),t('adjustCoverSizesAndSpacingBetweenResources'),[['comfortable',t('comfortable')],['compact',t('compact')]])}</div><div class="legend-preview">${Object.entries({image:t('images'),video:t('videos'),audio:t('audio'),document:t('documents'),other:t('other')}).map(([k,n])=>`<span data-kind-color="${k}"><b class="dot"></b>${n}</span>`).join('')}</div>`;
 if(section==='playback')root.innerHTML=intro(t('playback'),t('separateVideoAndAudioPlayersWithVoiceSupport'))+`<div class="settings-panel">${select('speed',t('defaultPlaybackSpeed'),t('speedChangesMadeInThePlayerAreSaved'),[[.5,'0.5×'],[.75,'0.75×'],[1,'1×'],[1.25,'1.25×'],[1.5,'1.5×'],[2,'2×']])}<div class="setting-row"><div><strong>${t('defaultVolume')}</strong><small id="volumeLabel">${Math.round(p.volume*100)}%</small></div><input aria-label="${t('defaultVolume')}" id="defaultVolume" type="range" min="0" max="1" step="0.01" value="${p.volume}"></div><div class="setting-row"><div><strong>${t('silkAmrNb')}</strong><small>${t('builtInDecodingConversionAndPlaybackStayOn')}</small></div><span class="muted">${t('enabled')}</span></div></div><p class="settings-note">${t('voiceMessagesDecodeOnDemandWithoutChangingOriginals')}</p>`;
 if(section==='bindings')root.innerHTML=intro(t('conversationBindings'),t('associateFolderIdentifiersWithContactsGroupChatsOr'))+`<p class="settings-note">${t('folderIdentifiersDescription')}</p><div class="settings-panel binding-form"><div class="form-field"><label for="bindingHash">${t('conversationFolder')}</label><select id="bindingHash">${bindOptions()}</select></div><div class="form-columns"><div class="form-field"><label for="bindingName">${t('contactGroupChatName')}</label><input id="bindingName" maxlength="200" placeholder="${t('enterAConfirmedConversationName')}"></div><div class="form-field"><label for="bindingType">${t('conversationType')}</label><select id="bindingType"><option value="person">${t('contact')}</option><option value="group">${t('groupChat')}</option><option value="custom">${t('customGroup')}</option></select></div></div><div class="form-field"><label for="bindingUsername">${t('accountOrGroupIdentifierOptional')}</label><input id="bindingUsername" maxlength="200" placeholder="${t('accountIdentifierPlaceholder')}"></div><div class="binding-actions"><button class="primary" id="saveBinding">${t('saveBinding')}</button><button id="removeBinding">${t('removeBinding')}</button></div></div><div class="import-row"><button id="importBindings">${icon('import')+t('importJsonMapping')}</button><span>${t('conversationsBound', {p2: Object.keys(contacts).length})}</span><input id="mappingFile" type="file" accept="application/json,.json" hidden></div><p class="settings-note">${t('formatFolderHashesAsKeysEachValueContains')}</p><div class="mapping-list">${Object.entries(contacts).map(([hash,c])=>`<div class="mapping-row"><span class="avatar">${esc(c.name.slice(0,1))}</span><div><strong>${esc(c.name)}</strong><small>${esc(c.username||hash)}</small></div><button data-edit-binding="${esc(hash)}">${t('edit')}</button></div>`).join('')}</div>`;
 if(section==='data')renderDataContent(root,intro(t('dataStorage'),t('keepResourcesInPlaceAndStoreLibraryMetadata'))+`${resourceFolder(st)}<section class="directory-history" aria-labelledby="directoryHistoryHeading"><h3 id="directoryHistoryHeading">${t('directoryHistory')}</h3><div id="directoryHistoryContent"></div></section><div class="settings-panel">${sourceSettings}<div class="setting-row"><div><strong>${t('scannedFiles')}</strong><small>${t('includesOriginalResourcesAndThumbnails')}</small></div><span>${t('count', {p1: (st.total||0).toLocaleString()})}</span></div><div class="setting-row"><div><strong>${t(wechat?'conversationFolders':'folders')}</strong><small>${t(wechat?'countedByTopLevelResourceFolder':'scannedFolderCount')}</small></div><span>${t('countLabel', {p2: wechat?st.groups?.filter(g=>g!=='未分组').length||0:st.folderCount||0})}</span></div><div class="setting-row"><div><strong>${t('libraryMetadata')}</strong><small>${t(wechat?'favoritesTagsAppearanceSettingsAndBindingsAreStored':'ordinaryMetadataDescription')}</small></div></div></div><div class="data-actions">${!st.root?`<button id="settingsTour">${t('tourRestart')}</button>`:''}${getDevelopment()?`<button id="settingsDevTour" title="${t('tourDevReplayDescription')}">${t('tourDevReplay')}</button>`:''}</div>`);
 root.querySelectorAll('[data-kind-color]').forEach(e=>e.style.setProperty('--kind-color',`var(--${e.dataset.kindColor})`));root.querySelectorAll('[data-swatch]').forEach(e=>e.style.background=e.dataset.swatch);
 if($('#sourceMode'))$('#sourceMode').onchange=e=>changeSource({mode:e.target.value});
 if($('#settingsGrouping'))$('#settingsGrouping').onchange=e=>changeGrouping(e.target.value);
 root.querySelectorAll('[data-toggle]').forEach(button=>button.onclick=()=>{
  const key=button.dataset.toggle;
  const checked=!getPrefs()[key];
  button.setAttribute('aria-checked',String(checked));
  setPref(key,checked);
 });
 root.querySelectorAll('[data-pref]').forEach(e=>e.onchange=()=>setPref(e.dataset.pref,['speed','volume'].includes(e.dataset.pref)?Number(e.value):e.value));root.querySelectorAll('[data-theme-choice]').forEach(b=>b.onclick=()=>{setPref('theme',b.dataset.themeChoice);render()});root.querySelectorAll('[data-palette]').forEach(b=>b.onclick=()=>{setPref('palette',b.dataset.palette);render()});
 if(section==='playback')$('#defaultVolume').oninput=e=>{$('#volumeLabel').textContent=Math.round(e.target.value*100)+'%';setPref('volume',Number(e.target.value))};
 if(section==='bindings'){
  const hash=$('#bindingHash');if(st.groups?.includes(bindingHash))hash.value=bindingHash;const fill=()=>{bindingHash=hash.value;const c=getContacts()[bindingHash];$('#bindingName').value=c?.name||'';$('#bindingUsername').value=c?.username||'';$('#bindingType').value=c?.type||'person';$('#removeBinding').disabled=!c;$('#saveBinding').disabled=!bindingHash};hash.onchange=fill;fill();
  $('#saveBinding').onclick=async()=>{const name=$('#bindingName').value.trim();if(!name){toast(t('enterAConversationName'),'warning');return}await bind({[hash.value]:{name,username:$('#bindingUsername').value.trim(),type:$('#bindingType').value}})};
  $('#removeBinding').onclick=()=>bind({[hash.value]:{name:'',username:'',type:'custom'}});
  root.querySelectorAll('[data-edit-binding]').forEach(b=>b.onclick=()=>{bindingHash=b.dataset.editBinding;render();$('#bindingName').focus()});$('#importBindings').onclick=()=>$('#mappingFile').click();$('#mappingFile').onchange=async e=>{try{const f=e.target.files[0];if(!f)return;if(f.size>2*1024*1024)throw Error(t('mappingFileExceedsMib'));const raw=JSON.parse(await f.text());const m=Array.isArray(raw)?Object.fromEntries(raw.map(v=>[v.hash,{name:v.name,username:v.username||'',type:v.type||'person'}])):raw;if(!m||typeof m!=='object')throw Error(t('invalidMappingFile'));for(const [k,v]of Object.entries(m)){if(!v||typeof v.name!=='string'||!k)throw Error(t('mappingsMustIncludeAFolderHashAndName'));v.type||='person';v.username||=''}await bind(m)}catch(err){toast(t('importFailed')+err.message,'error')}};
 }
 if(section==='data'){
  const input=$('#resourceFolderInput'), pathButton=$('#editCurrentDirectoryPath');
  const closePathEditor=(focus=false)=>{
   input.hidden=true;
   pathButton.hidden=false;
   if(focus)pathButton.focus();
  };
  pathButton.onclick=()=>{
   input.value=st.root||'';
   pathButton.hidden=true;
   input.hidden=false;
   input.focus();
   input.setSelectionRange(input.value.length,input.value.length);
  };
  input.onblur=()=>closePathEditor();
  input.onkeydown=e=>{
   if(e.key==='Escape'){e.stopPropagation();closePathEditor(true)}
  };
  $('#settingsDirectoryPath').onsubmit=e=>{
   e.preventDefault();
   const path=input.value.trim();
   closePathEditor(true);
   if(path&&path!==st.root&&!directoryBusy())choose(path);
  };
  renderDirectoryHistory();
  $('#settingsChoose').onclick=()=>choose();
  $('#settingsScan').onclick=rescan;
  if($('#settingsTour'))$('#settingsTour').onclick=startTour;
  if($('#settingsDevTour'))$('#settingsDevTour').onclick=replayTour;
  updateDirectoryStatus();
 }
 }
 async function bind(m){try{const snapshot=await api('bindings',m);onContacts(snapshot.contacts);toast(t('conversationBindingsSaved'),'success');render()}catch(e){toast(e.message,'error')}}
 $('#settingsNav').querySelectorAll('button').forEach(b=>b.onclick=()=>onNavigate(()=>{section=b.dataset.section;render()}));
 return{render,updateDirectoryStatus,refreshDirectories,location:()=>({tab:section,hash:bindingHash}),open:(tab='general',hash='')=>{section=tab;bindingHash=hash;render()}};
}
