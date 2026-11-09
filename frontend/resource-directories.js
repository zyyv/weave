import {t} from './i18n.js';

export function createDirectorySwitcher({select, api, choose, openSettings, getState, getBusy, getPending, onChange}) {
 let entries = [];
 let optionsKey;
 let refreshVersion = 0;
 const displayName = path => path?.split('/').filter(Boolean).pop() || path || t('resourceFolder');
 const alias = path => entries.find(entry => entry.path === path)?.name || '';
 const name = path => alias(path) || displayName(path);
 const valueFor = path => path ? 'path:' + path : '';

 function render() {
  const {root, scanning} = getState();
  const pending = getPending();
  const path = pending?.path || root;
  const options = entries.map(entry => ({
   value: valueFor(entry.path),
   text: name(entry.path),
   description: entry.broken ? t('directoryBroken') + ' · ' + entry.path : entry.path
  }));
  for (const directory of new Set([root, path])) {
   if (directory && !options.some(option => option.value === valueFor(directory))) {
    options.unshift({value: valueFor(directory), text: name(directory), description: directory, disabled: true});
   }
  }
  if (!path) options.unshift({value: '', text: t('noResourceFolderSelected'), disabled: true});

  const key = JSON.stringify(options);
  if (key !== optionsKey) {
   optionsKey = key;
   select.replaceChildren(...options.map(({value, text, description, disabled}) => {
    const option = new Option(text, value);
    if (description) option.dataset.description = description;
    option.disabled = !!disabled;
    return option;
   }));
  }
  select.value = valueFor(path);
  select.disabled = scanning || getBusy() || !entries.length;
  const label = path ? name(path) : t('resourceFolder');
  select.setAttribute('aria-label', t('switchResourceFolder') + ' · ' + label);
 }

 async function refresh() {
  const version = ++refreshVersion;
  const snapshot = await api('directories');
  if (version !== refreshVersion) return;
  entries = snapshot.entries;
  render();
  onChange();
 }
 async function update(action, data) {
  await api(action, data);
  await refresh();
 }

 select.onchange = () => {
  const value = select.value;
  if (value.startsWith('path:') && value !== valueFor(getState().root)) {
   choose(value.slice(5));
  }
 };

 return {
  open: openSettings, refresh, name, render, entries: () => entries,
  edit: (root, path, name) => update('directory-edit', {root, path, name}),
  remove: root => update('directory-remove', {root})
 };
}
