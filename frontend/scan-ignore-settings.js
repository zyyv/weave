import {getLocale,t} from './i18n.js';
import {syncSelects} from './select.js';

const modes=[
 ['inherit',()=>t('ignoreInherit'),()=>t('ignoreInheritHelp')],
 ['append',()=>t('ignoreAppend'),()=>t('ignoreAppendHelp')],
 ['replace',()=>t('ignoreReplace'),()=>t('ignoreReplaceHelp')],
];
const inherit=()=>({mode:'inherit',rules:[]});
const encoder=new TextEncoder();
const examples=[
 ['*.tmp',()=>t('ignoreExampleExt')],
 ['/cache/',()=>t('ignoreExampleDir')],
 ['media/**/draft?.jpg',()=>t('ignoreExampleGlob')],
 ['!keep.tmp',()=>t('ignoreExampleInclude')],
];

export function createScanIgnoreSettings({esc,icon,api,toast,getState,directoryEntries,directoryName,directoryBusy,rescan,choose}){
 let panel,saved,scope,loading=false,loadError='',writing=false,editing=null,renderKey='',lastRoot;
 let savedToast;
 const drafts=new Map(),pending=new Map(),errors=new Map();
 const expanded=new Set();
 const value=key=>drafts.get(key)||(key?saved.projects[key]||inherit():{rules:saved.global});
 const paths=()=>[...new Set([getState().root,...directoryEntries().map(entry=>entry.path)].filter(Boolean))];
 const node=selector=>panel.querySelector(selector);
 const mounted=()=>panel?.isConnected;
 const scopeButton=()=>node('#ignoreScope + .custom-select');
 const emptyState=(message,action='',hidden=false)=>`<div class="ignore-empty" ${hidden?'hidden':''}><p>${message}</p>${action}</div>`;
 const syntaxExample=()=>`<pre class="ignore-example" tabindex="0"><code>${examples.map(([pattern,description])=>
  `<span class="ignore-example-comment"># ${esc(description())}</span>\n<span class="ignore-example-rule">${esc(pattern)}</span>`
 ).join('\n\n')}</code></pre><p>${t('ignoreParentHelp')}</p>`;
 const ruleGlyph=rule=>icon(rule.endsWith('/')?'folder':/[*?[!#]/.test(rule)?'code':'file');
 const ruleCode=rule=>`<code title="${esc(rule)}">${esc(rule)||'&nbsp;'}</code>`;
 const ruleText=(rule,i)=>`<button type="button" class="ignore-rule-text" data-edit-rule="${i}" aria-label="${esc(t('ignoreEditRule',{rule}))}">${ruleCode(rule)}</button>`;
 const rowButton=(action,i,label,glyph,disabled)=>`<button type="button" class="icon" data-rule-action="${action}" data-row="${i}"
  aria-label="${esc(label)}" title="${esc(label)}" ${disabled?'disabled':''}>${icon(glyph)}</button>`;
 const row=(rule,i,length)=>`<li class="ignore-rule-row" data-ignore-row="${i}" ${rule.startsWith('#')?'data-comment':''}>
  <span class="ignore-rule-glyph" aria-hidden="true">${ruleGlyph(rule)}</span>
  <div class="ignore-rule-value">${ruleText(rule,i)}</div>
  <div class="ignore-row-actions">
   ${rowButton('up',i,t('ignoreMoveUp',{line:i+1}),'down',i===0)}
   ${rowButton('down',i,t('ignoreMoveDown',{line:i+1}),'down',i>=length-1)}
   ${rowButton('delete',i,t('ignoreDeleteRule',{line:i+1}),'trash',false)}
  </div>
 </li>`;

 async function load(){
  loading=true;loadError='';render();
  try{saved=await api('scan-ignore')}
  catch(error){loadError=error.message}
  finally{loading=false;render()}
 }

 function queue(key,next){
  drafts.set(key,next);pending.set(key,next);errors.delete(key);
  status();
  if(!writing)flush();
 }

 async function flush(){
  writing=true;
  while(pending.size){
   const [key,next]=pending.entries().next().value;
   let committed=false;
   try{
    saved=await api('scan-ignore',{root:key,...next});
    if(drafts.get(key)===next){drafts.delete(key);committed=true}
   }catch(error){
    if(drafts.get(key)===next)errors.set(key,error.message);
   }
   if(pending.get(key)===next)pending.delete(key);
   if(committed)notifySaved(key);
   status();
  }
  writing=false;
 }

 function canScan(target,global){
  if(!target||!paths().includes(target)||directoryBusy()||editing)return false;
  const mode=value(target).mode;
  if(global&&mode==='replace')return false;
  if(pending.has(target)||errors.has(target))return false;
  return mode==='replace'||(!pending.has('')&&!errors.has(''));
 }

 function updateScanAction(){
  if(savedToast?.target)savedToast.notice.setActionDisabled(!canScan(savedToast.target,savedToast.global));
 }

 function notifySaved(key){
  const global=!key;
  const target=key||getState().root;
  const action=target&&(!global||value(target).mode!=='replace')?{
   label:t('rescan'),
   title:t('ignoreRescanTarget',{name:directoryName(target)}),
   run(){
    if(!canScan(target,global))return false;
    if(target===getState().root)rescan();
    else choose(target,{stayInSettings:true});
   }
  }:undefined;
  savedToast?.notice.dismiss();
  savedToast={target:action?target:'',global,notice:toast(t('ignoreSaved'),'success',action)};
 }

 function status(){
  updateScanAction();
  if(!mounted()||!saved)return;
  const statusLine=node('#ignoreSaveStatus');
  if(!statusLine)return;
  const error=errors.get(scope);
  statusLine.textContent=error||(pending.has(scope)?t('saving'):'');
  statusLine.classList.toggle('feature-error',!!error);
  node('#ignoreRetry').hidden=!error||!drafts.has(scope);
 }

 function reveal(key,heading,content){
  const open=expanded.has(key);
  return `<div class="ignore-disclosure">
   <button type="button" class="ignore-disclosure-toggle" aria-controls="ignore-${key}" aria-expanded="${open}" data-disclosure="${key}">
    ${icon('chevron')}<span>${heading}</span>
   </button>
   <div class="ignore-disclosure-body" id="ignore-${key}" ${open?'':'inert'}>
    <div class="ignore-disclosure-content"><div>${content}</div></div>
   </div>
  </div>`;
 }

 function scopeOptions(){
  const active=getState().root;
  return `<option value="" ${scope?'':'selected'}>${t('ignoreGlobalScope')}</option>
   ${paths().map(path=>`<option value="${esc(path)}" ${path===scope?'selected':''} ${path===active?`data-badge="${esc(t('ignoreCurrentProject'))}"`:''}>${esc(directoryName(path))}</option>`).join('')}`;
 }

 function render(){
  if(!mounted())return;
  if(!saved){
   panel.innerHTML=`<div class="settings-panel ignore-panel"><p role="status">${loadError?esc(loadError):t('loading')}</p>
    ${loadError?`<button type="button" data-retry-ignore>${t('retry')}</button>`:''}</div>`;
   node('[data-retry-ignore]')?.addEventListener('click',load);
   return;
  }
  const active=getState().root;
  if(scope===undefined||(scope&&!paths().includes(scope)))scope=active||'';
  if(!node('#ignoreScope')){
   panel.innerHTML=`<div class="ignore-scope">
    <label for="ignoreScope">${t('ignoreScope')}</label>
    <select id="ignoreScope" data-badged-options>${scopeOptions()}</select>
    <small id="ignoreScopeDescription"></small>
   </div><div class="ignore-content"></div>`;
   node('#ignoreScope').onchange=e=>setScope(e.target.value);
  }else{
   node('label[for="ignoreScope"]').textContent=t('ignoreScope');
   node('#ignoreScope').innerHTML=scopeOptions();
  }
  renderScope();
 }

 function setScope(key){
  if(scope===key)return;
  finishEdit();
  scope=key;
  node('#ignoreScope').value=key;
  syncSelects();renderScope();
  scopeButton()?.focus();
 }

 function renderScope(){
  const key=scope,{mode='inherit',rules}=value(key);
  const global=value('').rules;
  const editable=!key||mode!=='inherit';
  const editGlobal=`<button type="button" data-edit-global>${t('ignoreEditGlobal')}</button>`;
  const addRule=`<button type="button" class="ignore-add" ${rules.length>=500?'disabled':''}>${icon('add')}${t('ignoreAddRule')}</button>`;
  const description=node('#ignoreScopeDescription');
  description.textContent=key||t('ignoreGlobalHelp');
  description.classList.toggle('file-path',!!key);
  node('.ignore-content').innerHTML=`
   ${key?`<fieldset class="ignore-modes">
    <legend>${t('ignoreMode')}</legend>
    ${modes.map(([id,label,help])=>`<label><input type="radio" name="ignore-mode" value="${id}" ${id===mode?'checked':''}><span><strong>${label()}</strong><small>${help()}</small></span></label>`).join('')}
   </fieldset>`:''}
   ${key&&mode!=='replace'?reveal('global',t('ignoreInherited',{count:global.length}),
    global.length?`<ul class="ignore-inherited-list">${global.map(rule=>`<li class="ignore-rule-row" ${rule.startsWith('#')?'data-comment':''}>
     <span class="ignore-rule-glyph" aria-hidden="true">${ruleGlyph(rule)}</span>${ruleCode(rule)}
    </li>`).join('')}</ul>${editGlobal}`:
     emptyState(t('ignoreEmptyRules'),editGlobal)):''}
   <section class="ignore-section" aria-labelledby="ignoreRulesHeading">
    <div class="ignore-section-copy">
     <h3 id="ignoreRulesHeading">${t(key?'ignoreProjectRules':'ignoreGlobalRules')}</h3>
     <p>${t('ignoreOrder')}</p>
    </div>
    <div class="settings-panel ignore-panel">
     ${editable?`
      <div class="ignore-list-toolbar" ${rules.length?'':'hidden'}>
       <span class="ignore-rule-count">${t('ignoreRuleCount',{count:rules.length})}</span>
       ${rules.length?addRule:''}
      </div>
      <ul class="ignore-rule-list" ${rules.length?'':'hidden'}>${rules.map((rule,i)=>row(rule,i,rules.length)).join('')}</ul>
      ${emptyState(t(key&&mode==='replace'?'ignoreEmptyReplace':'ignoreEmptyRules'),rules.length?'':addRule,!!rules.length)}
      ${reveal('syntax',t('ignoreSyntax'),syntaxExample())}`:`<p>${t(rules.length?'ignorePausedRules':'ignoreInheritedOnly')}</p>`}
    </div>
   </section>
   <div class="ignore-save">
    <button type="button" id="ignoreRetry" hidden>${t('retry')}</button>
    <span id="ignoreSaveStatus" role="status"></span>
   </div>`;

  panel.querySelectorAll('[name="ignore-mode"]').forEach(input=>input.onchange=()=>{
   finishEdit();
   queue(key,{...value(key),mode:input.value});
   renderScope();
   node('[name="ignore-mode"]:checked').focus();
  });
  panel.querySelectorAll('[data-disclosure]').forEach(button=>button.onclick=()=>{
   const name=button.dataset.disclosure,open=!expanded.has(name);
   if(open)expanded.add(name);else expanded.delete(name);
   button.setAttribute('aria-expanded',String(open));
   node('#ignore-'+name).inert=!open;
  });
  node('[data-edit-global]')?.addEventListener('click',()=>setScope(''));
  node('.ignore-add')?.addEventListener('click',()=>{
   finishEdit();
   const i=value(scope).rules.length;
   if(i>=500)return;
   node('.ignore-rule-list').insertAdjacentHTML('beforeend',row('',i,i+1));
   node('.ignore-rule-list').hidden=false;
   node('.ignore-panel > .ignore-empty').hidden=true;
   startEdit(i,true);
  });
  node('.ignore-rule-list')?.addEventListener('click',e=>{
   const edit=e.target.closest('[data-edit-rule]'),action=e.target.closest('[data-rule-action]');
   if(edit)startEdit(Number(edit.dataset.editRule));
   if(action)changeOrder(Number(action.dataset.row),action.dataset.ruleAction);
  });
  node('#ignoreRetry').onclick=()=>queue(scope,value(scope));
  status();
 }

 function startEdit(i,added=false){
  finishEdit();
  const key=scope,rules=value(key).rules;
  const host=node(`[data-ignore-row="${i}"]`);
  if(!host)return;
  const slot=host.querySelector('.ignore-rule-value');
  const label=slot.querySelector('button');
  const input=document.createElement('input');
  input.className='ignore-pattern';
  input.setAttribute('aria-label',t('ignoreRuleLine',{line:i+1}));
  input.value=rules[i]??'';input.placeholder='*.tmp';input.spellcheck=false;input.autocomplete='off';input.maxLength=1024;
  editing={key,i,added,host,slot,input,label};
  host.classList.add('is-editing');
  label.hidden=true;
  slot.append(input);
  input.addEventListener('blur',()=>{if(editing?.input===input)finishEdit()});
  input.onkeydown=e=>{
   if(e.isComposing)return;
   if(e.key==='Enter'||e.key==='Escape'){
    e.preventDefault();e.stopPropagation();finishEdit({cancel:e.key==='Escape',focus:true,quietFocus:e.key==='Enter'});
   }
  };
  input.onpaste=e=>{
   const lines=e.clipboardData.getData('text').split(/\r\n?|\n/);
   if(lines.length<2)return;
   e.preventDefault();
   if(lines.at(-1)==='')lines.pop();
   if(rules.length+(added?0:-1)+lines.length>500||lines.some(line=>encoder.encode(line).length>1024)){
    input.setCustomValidity(t('ignorePasteLimit'));input.reportValidity();return;
   }
   finishEdit({lines,focus:true});
  };
  input.oninput=()=>input.setCustomValidity('');
  input.focus();
  if(added)host.scrollIntoView({block:'nearest'});else input.select();
  status();
 }

 function finishEdit({cancel=false,focus=false,quietFocus=false,lines}={}){
  if(!editing)return;
  const {key,i,added,host,slot,input,label}=editing;
  editing=null;
  host.classList.remove('is-editing');
  const before=value(key),next=[...before.rules];
  const text=input.value;
  if(cancel||(!lines&&!text.trim())){
   if(added){
    host.remove();
    updateRuleControls(next.length);
    if(focus)node('.ignore-add').focus();
   }else{
    input.remove();label.hidden=false;if(focus)focusLabel(label,quietFocus);
   }
   status();return;
  }
  next.splice(i,added?0:1,...(lines||[text]));
  if(lines)renderList(next);
  else{
   // Keep the other buttons mounted so a click that caused blur still lands.
   slot.innerHTML=ruleText(text,i);
   host.querySelector('.ignore-rule-glyph').innerHTML=ruleGlyph(text);
   host.toggleAttribute('data-comment',text.startsWith('#'));
   if(added){
    node(`[data-rule-action="down"][data-row="${i-1}"]`)?.removeAttribute('disabled');
    updateRuleControls(next.length);
   }
  }
  if(added||lines||before.rules[i]!==text)queue(key,{...before,rules:next});else status();
  if(focus)focusLabel(node(`[data-edit-rule="${i}"]`),quietFocus);
 }

 function focusLabel(label,quiet){
  if(!label)return;
  if(quiet){
   label.dataset.justSaved='';
   label.addEventListener('blur',()=>delete label.dataset.justSaved,{once:true});
  }
  label.focus({preventScroll:true});
 }

 function renderList(rules){
  const list=node('.ignore-rule-list'),scroll=list.scrollTop;
  list.innerHTML=rules.map((rule,i)=>row(rule,i,rules.length)).join('');
  updateRuleControls(rules.length);
  list.scrollTop=scroll;
 }

 function updateRuleControls(count){
  const empty=node('.ignore-panel > .ignore-empty');
  const toolbar=node('.ignore-list-toolbar');
  const add=node('.ignore-add');
  const container=count?toolbar:empty;
  if(add.parentElement!==container)container.append(add);
  empty.hidden=!!count;
  toolbar.hidden=!count;
  toolbar.querySelector('.ignore-rule-count').textContent=t('ignoreRuleCount',{count});
  node('.ignore-rule-list').hidden=!count;
  add.disabled=count>=500;
 }

 function changeOrder(i,action){
  finishEdit();
  const before=value(scope),next=[...before.rules];
  let target=i;
  if(action==='delete'){next.splice(i,1);target=Math.min(i,next.length-1)}
  else{
   target=i+(action==='up'?-1:1);
   if(target<0||target>=next.length)return;
   [next[i],next[target]]=[next[target],next[i]];
  }
  renderList(next);queue(scope,{...before,rules:next});
  (node(`[data-rule-action="${action}"][data-row="${target}"]:enabled`)||node(`[data-edit-rule="${target}"]`)||node('.ignore-add')).focus();
 }

 return {
  finishEdit,
  updateScanAction,
  mount(element){
   const key=JSON.stringify([getLocale(),getState().root,paths().map(path=>[path,directoryName(path)])]);
   if(element===panel&&key===renderKey){status();return}
   finishEdit();
   const root=getState().root;
   if(lastRoot&&scope===lastRoot&&lastRoot!==root)scope=root;
   lastRoot=root;
   panel=element;renderKey=key;
   if(!saved&&!loading&&!loadError)load();else render();
  },
 };
}
