import {getLocale, t} from './i18n.js';

export function createDirectorySwitcher({dialog, trigger, api, choose, icon, esc, getState, onChange}) {
 const list = dialog.querySelector('.directory-history');
 const notice = dialog.querySelector('[role=status]');
 const add = dialog.querySelector('#pickDirectory');
 const pathForm = dialog.querySelector('#openDirectoryPath');
 const pathInput = pathForm.elements.path;
 let history = {entries: [], lastRoot: ''}, editing = '', busy = false, loaded = false;

 const displayName = (path, alias) => alias || path?.split('/').filter(Boolean).pop() || path || t('resourceFolder');
 function name(path) {
  return displayName(path, history.entries.find(entry => entry.path === path)?.name);
 }
 function renderTrigger() {
  const root = getState().root;
  trigger.querySelector('span').textContent = root ? name(root) : t('resourceFolder');
  trigger.title = root ? `${t('directoryHistory')} · ${root}` : t('directoryHistory');
  trigger.setAttribute('aria-label', root ? `${t('directoryHistory')} · ${name(root)}` : t('directoryHistory'));
 }
 function render() {
  renderTrigger();
  if (!dialog.open) return;
  add.disabled = busy;
  pathForm.querySelector('button').disabled = busy;
  pathInput.disabled = busy;
  const root = getState().root;
  list.innerHTML = history.entries.length ? history.entries.map(entry => {
   const active = entry.path === root;
   const entryName = displayName(entry.path, entry.name);
   const status = entry.broken ? 'directoryBroken' : active ? 'directoryCurrent' : entry.path === history.lastRoot ? 'directoryLast' : '';
   const time = entry.lastOpened ? new Intl.DateTimeFormat(getLocale(), {dateStyle: 'medium', timeStyle: 'short'}).format(entry.lastOpened) : '';
   return `<li class="directory-record">
    <div class="directory-record-main">
     <button type="button" class="directory-open" data-open="${esc(entry.path)}" ${active && !entry.broken || busy ? 'disabled' : ''} title="${esc(entry.path)}">
      ${icon('folder')}<span><strong>${esc(entryName)}</strong><small>${esc(entry.path)}</small></span>
     </button>
     <div class="directory-record-meta">${status ? `<span class="directory-status ${entry.broken ? 'broken' : ''}">${t(status)}</span>` : ''}${time ? `<time datetime="${new Date(entry.lastOpened).toISOString()}">${esc(time)}</time>` : ''}</div>
     <button type="button" class="icon directory-edit" data-rename="${esc(entry.path)}" aria-label="${esc(t('renameDirectoryNamed', {name: entryName}))}" title="${t('renameDirectory')}" ${busy ? 'disabled' : ''}>${icon('edit')}</button>
    </div>
    ${editing === entry.path ? `<form class="directory-name-form"><label for="directoryName">${t('directoryAlias')}</label><div><input id="directoryName" name="alias" maxlength="80" value="${esc(entry.name)}" placeholder="${esc(entryName)}" ${busy ? 'disabled' : ''}><button type="submit" ${busy ? 'disabled' : ''}>${t('saveDirectoryName')}</button><button type="button" data-cancel>${t('cancel')}</button></div></form>` : ''}
   </li>`;
  }).join('') : `<li class="directory-history-empty">${t(!loaded&&busy?'loading':'directoryHistoryEmpty')}</li>`;
  list.querySelectorAll('[data-open]').forEach(button => button.onclick = () => openPath(button.dataset.open));
  list.querySelectorAll('[data-rename]').forEach(button => button.onclick = () => {
   editing = button.dataset.rename;
   render();
   const input = list.querySelector('#directoryName');
   input?.focus();
   input?.select();
  });
  const form = list.querySelector('.directory-name-form');
  if (form) {
   form.querySelector('[data-cancel]').onclick = () => { editing = ''; render(); };
   form.onsubmit = event => {
    event.preventDefault();
    const root = editing, name = form.elements.alias.value;
    run(async () => {
     await api('directory-name', {root, name});
     editing = '';
     await refresh();
    });
   };
  }
 }
 async function refresh() {
  history = await api('directories');
  loaded = true;
  render();
  onChange?.();
 }
 async function run(operation) {
  if (busy) return;
  busy = true;
  notice.textContent = '';
  render();
  try { await operation(); }
  catch (error) { notice.textContent = error.message; }
  finally { busy = false; render(); }
 }
 function openPath(path) {
  run(async () => {
   try {
    if (await choose(path, {reportError: false})) {
     dialog.close();
     pathForm.reset();
    }
   } finally {
    await refresh();
   }
  });
 }
 trigger.onclick = () => open();
 add.onclick = () => openPath();
 pathForm.onsubmit = event => { event.preventDefault(); if (pathInput.value.trim()) openPath(pathInput.value); };
 function open() {
  if (dialog.open) return;
  editing = '';
  notice.textContent = '';
  dialog.showModal();
  trigger.setAttribute('aria-expanded', 'true');
  run(refresh);
 }
 dialog.addEventListener('close', () => trigger.setAttribute('aria-expanded', 'false'));
 return {open, refresh, name, renderTrigger};
}
