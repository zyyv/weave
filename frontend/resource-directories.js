import {getLocale, t} from './i18n.js';
import {icon} from './icons.js';

export function createDirectorySwitcher({api, choose, openSettings, openResource, getState, getBusy, getPending, onChange, onError}) {
 const $ = selector => document.querySelector(selector);
 const info = $('#sourceInfo');
 const add = $('#newSource');
 let entries = [];
 let recentFiles = [];
 let refreshVersion = 0;
 let renderKey;
 let infoRow;
 let hideTimer;
 let pinBusy = false;
 const name = path => entries.find(entry => entry.path === path)?.name || path?.split(/[\\/]/).filter(Boolean).pop() || path || t('resourceFolder');

 function hideInfo() {
  clearTimeout(hideTimer);
  info.hidden = true;
  infoRow?.removeAttribute('aria-describedby');
  infoRow = null;
 }
 function scheduleHide() {
  clearTimeout(hideTimer);
  hideTimer = setTimeout(hideInfo, 140);
 }
 info.onpointerenter = () => clearTimeout(hideTimer);
 info.onpointerleave = scheduleHide;
 info.onfocusin = () => clearTimeout(hideTimer);
 info.onfocusout = event => { if (!info.contains(event.relatedTarget)) scheduleHide(); };
 $('.source-scroll').addEventListener('scroll', hideInfo);
 window.addEventListener('resize', hideInfo);
 document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && !info.hidden) {
   if (info.contains(document.activeElement)) infoRow?.focus();
   hideInfo();
  }
 });

 function showInfo(button, entry) {
  hideInfo();
  infoRow = button;
  const label = document.createElement('strong');
  label.textContent = name(entry.path);
  const path = document.createElement('span');
  path.className = 'source-info-path';
  path.textContent = entry.path;
  const status = document.createElement('span');
  status.textContent = [
   entry.pinned && t('sourcePinnedStatus'),
   entry.broken && t('directoryBroken'),
   entry.lastOpened && t('sourceLastOpened', {p0: new Date(entry.lastOpened).toLocaleString(getLocale(), {dateStyle:'medium', timeStyle:'short'})})
  ].filter(Boolean).join(' · ');
  const manage = document.createElement('button');
  manage.innerHTML = icon('settings');
  manage.append(t('manageSources'));
  manage.onclick = () => { hideInfo(); openSettings(); };
  const description = document.createElement('div');
  description.id = 'sourceInfoDescription';
  description.append(label, path);
  if (status.textContent) description.append(status);
  info.replaceChildren(description, manage);
  button.setAttribute('aria-describedby', description.id);
  info.hidden = false;
  const rect = button.getBoundingClientRect();
  const sidebar = $('#sidebar').getBoundingClientRect();
  const left = sidebar.right + 4;
  const fitsBeside = left + info.offsetWidth + 8 <= innerWidth;
  info.style.left = (fitsBeside ? left : Math.max(8, Math.min(rect.left, innerWidth - info.offsetWidth - 8))) + 'px';
  const top = fitsBeside ? rect.top : rect.bottom + 2;
  info.style.top = Math.max(8, Math.min(top, innerHeight - info.offsetHeight - 8)) + 'px';
 }

 function row(label, glyph, onclick) {
  const button = document.createElement('button');
  button.className = 'source-row';
  button.innerHTML = icon(glyph);
  const text = document.createElement('span');
  text.textContent = label;
  button.append(text);
  button.onclick = onclick;
  return button;
 }
 function sourceRow(entry, active, busy, canPin = true) {
  const wrapper = document.createElement('div');
  wrapper.className = 'source-entry';
  wrapper.dataset.sourcePath = entry.path;
  const button = row(name(entry.path), 'folder', () => { if (!busy) { hideInfo(); choose(entry.path); } });
  button.setAttribute('aria-current', active ? 'true' : 'false');
  if (busy) button.setAttribute('aria-disabled', 'true');
  button.onpointerenter = event => { if (event.pointerType !== 'touch') showInfo(button, entry); };
  button.onfocus = () => { if (button.matches(':focus-visible')) showInfo(button, entry); };
  wrapper.onpointerleave = scheduleHide;
  wrapper.onfocusout = event => { if (!wrapper.contains(event.relatedTarget)) scheduleHide(); };
  wrapper.append(button);
  if (canPin) {
   const pin = document.createElement('button');
   pin.className = 'icon source-pin';
   pin.innerHTML = icon('pin');
   const label = entry.pinned ? t('unpinSource') : t('pinSource');
   pin.title = label;
   pin.setAttribute('aria-label', label + ' · ' + name(entry.path));
   pin.setAttribute('aria-pressed', String(!!entry.pinned));
   pin.onclick = async () => {
    if (pinBusy) return;
    pinBusy = true;
    try {
     await update('directory-pin', {root: entry.path, pinned: !entry.pinned});
     if (document.activeElement === document.body && !pin.isConnected) {
      const list = entry.pinned ? $('#sourceRows') : $('#pinnedSourceRows');
      [...list.children].find(child => child.dataset.sourcePath === entry.path)?.querySelector('.source-pin')?.focus();
     }
    } catch (error) { onError(error); }
    finally { pinBusy = false; }
   };
   wrapper.append(pin);
  }
  return wrapper;
 }
 function empty(label) {
  const message = document.createElement('p');
  message.className = 'source-empty';
  message.textContent = label;
  return message;
 }

 function render() {
  const {root, scanning} = getState();
  const path = getPending()?.path || root;
  const busy = !!(scanning || getBusy());
  add.disabled = busy;
  const key = JSON.stringify([getLocale(), entries, recentFiles, root, path, busy]);
  if (key === renderKey) return;
  renderKey = key;
  hideInfo();
  const pinned = entries.filter(entry => entry.pinned);
  const sources = entries.filter(entry => !entry.pinned);
  if (root && !entries.some(entry => entry.path === root)) sources.unshift({path: root});
  const rows = list => list.map(entry => sourceRow(entry, path === entry.path, busy, entry.lastOpened !== undefined));
  $('#pinnedSources').hidden = !pinned.length;
  $('#pinnedSourceRows').replaceChildren(...rows(pinned));
  $('#sourceRows').replaceChildren(...(sources.length ? rows(sources) : [empty(pinned.length ? t('noUnpinnedSources') : t('noSources'))]));
  const recent = [
   ...entries.filter(entry => entry.lastOpened).map(entry => ({entry, time: entry.lastOpened})),
   ...recentFiles.filter(file => file.root === root || entries.some(entry => entry.path === file.root))
  ].sort((a, b) => b.time - a.time).slice(0, 12);
  $('#recentSourceRows').replaceChildren(...(recent.length ? recent.map(item => {
   if (item.entry) return sourceRow(item.entry, false, busy, false);
   const button = row(item.label, item.glyph, () => { if (!busy) openResource(item); });
   button.title = name(item.root) + ' / ' + item.label;
   if (busy) button.setAttribute('aria-disabled', 'true');
   return button;
  }) : [empty(t('noRecentSources'))]));
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
 function remember(root, {id, name: label, path}, glyph) {
  recentFiles = [{root, id, label, path, glyph, time: Date.now()}, ...recentFiles.filter(item => item.root !== root || item.id !== id)].slice(0, 12);
  render();
 }
 function forgetFile(root, id) {
  recentFiles = recentFiles.filter(item => item.root !== root || item.id !== id);
  render();
 }
 function forgetPrivate(root, ids) {
  const base = root.replace(/\\/g, '/').replace(/\/$/, '');
  const folders = ids.filter(id => id.startsWith('folder:')).map(id => base + '/' + id.slice(7) + '/');
  recentFiles = recentFiles.filter(item => !ids.includes(item.id) && !folders.some(folder => item.path.replace(/\\/g, '/').startsWith(folder)));
  render();
 }

 add.onclick = () => choose();
 return {
  open: openSettings, refresh, name, render, hideInfo, remember, forgetFile, forgetPrivate, entries: () => entries,
  recentFiles: () => recentFiles.slice(),
  edit: (root, path, name) => update('directory-edit', {root, path, name}),
  remove: root => update('directory-remove', {root})
 };
}
