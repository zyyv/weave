import {t} from './i18n.js';
import {icon} from './icons.js';

export function createCommandPalette({dialog, trigger, getGroups, getFiles, getPlaceholder}) {
 const input = dialog.querySelector('#commandQuery');
 const results = dialog.querySelector('#commandResults');
 const status = dialog.querySelector('#commandStatus');
 const categories = [...dialog.querySelectorAll('[data-category]')];
 const scroll = dialog.querySelector('.command-scroll');
 let category = 'all';
 let entries = [], options = [], active = -1;
 let timer, request, pointer;

 function select(index, reveal = false) {
  options[active]?.setAttribute('aria-selected', 'false');
  active = index;
  const option = options[index];
  if (!option) {
   input.removeAttribute('aria-activedescendant');
   return;
  }
  option.setAttribute('aria-selected', 'true');
  input.setAttribute('aria-activedescendant', option.id);
  if (reveal) option.scrollIntoView({block: 'nearest'});
 }

 function render(groups, message = '', preserve = false) {
  const previous = preserve ? entries[active]?.key : undefined;
  entries = [];
  options = [];
  active = -1;
  const sections = [];
  for (const {label, rows} of groups) {
   if (!rows.length) continue;
   const section = document.createElement('div');
   section.className = 'command-group';
   section.setAttribute('role', 'group');
   section.setAttribute('aria-label', label);
   const heading = document.createElement('div');
   heading.className = 'command-heading';
   heading.setAttribute('aria-hidden', 'true');
   heading.textContent = label;
   section.append(heading);
   for (const entry of rows) {
    const index = entries.length;
    entries.push(entry);
    const option = document.createElement('div');
    option.id = 'command-option-' + index;
    option.className = 'command-option';
    option.dataset.index = index;
    option.setAttribute('role', 'option');
    option.setAttribute('aria-selected', 'false');
    option.innerHTML = icon(entry.glyph);
    const title = document.createElement('span');
    title.className = 'command-label';
    title.textContent = entry.label;
    option.append(title);
    if (entry.meta) {
     const meta = document.createElement(entry.shortcut ? 'kbd' : 'span');
     meta.className = 'command-meta';
     meta.textContent = entry.meta;
     option.append(meta);
    }
    options.push(option);
    section.append(option);
   }
   sections.push(section);
  }
  results.replaceChildren(...sections);
  status.textContent = message || (entries.length ? '' : t('commandEmpty'));
  const index = entries.findIndex(entry => entry.key === previous);
  select(entries.length ? Math.max(0, index) : -1, preserve && index >= 0);
 }

 function stopRequest() {
  clearTimeout(timer);
  request?.abort();
 }

 function refresh() {
  stopRequest();
  const query = input.value.trim();
  const groups = getGroups(query, category).filter(group => category === 'all' || group.category === category);
  scroll.scrollTop = 0;
  if (category !== 'all' && category !== 'files') {
   render(groups);
   return;
  }
  const controller = request = new AbortController();
  render(groups, t('loading'));
  timer = setTimeout(async () => {
   try {
    const files = await getFiles(query, controller.signal);
    if (!controller.signal.aborted && dialog.open) render([...groups, files], '', true);
   } catch {
    if (!controller.signal.aborted && dialog.open) render(groups, t('commandSearchFailed'), true);
   }
  }, query ? 160 : 0);
 }

 function setCategory(value) {
  category = value;
  for (const button of categories) button.setAttribute('aria-pressed', String(button.dataset.category === category));
  refresh();
 }

 function close() {
  if (!dialog.open) return;
  stopRequest();
  dialog.close();
  input.setAttribute('aria-expanded', 'false');
  trigger.setAttribute('aria-expanded', 'false');
  render([]);
  status.textContent = '';
  input.value = '';
 }

 function open() {
  if (dialog.open) return;
  input.placeholder = getPlaceholder();
  input.setAttribute('aria-label', input.placeholder);
  input.value = '';
  pointer = null;
  dialog.showModal();
  input.setAttribute('aria-expanded', 'true');
  trigger.setAttribute('aria-expanded', 'true');
  input.focus();
  setCategory('all');
 }

 function run(index) {
  const entry = entries[index];
  if (!entry) return;
  close();
  entry.run();
 }

 input.addEventListener('input', event => { if (!event.isComposing) refresh(); });
 input.addEventListener('compositionend', refresh);
 dialog.addEventListener('keydown', event => {
  if (event.isComposing || event.keyCode === 229) return;
  if (event.key === 'Escape') {
   event.preventDefault();
   event.stopPropagation();
   close();
   return;
  }
  if (event.target !== input || !entries.length) return;
  if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
   event.preventDefault();
   const step = event.key === 'ArrowDown' ? 1 : -1;
   select((active + step + entries.length) % entries.length, true);
  } else if (event.key === 'Enter') {
   event.preventDefault();
   if (!event.repeat) run(active);
  }
 });
 results.addEventListener('pointermove', event => {
  const option = event.target.closest('.command-option');
  if (event.pointerType === 'touch' || !option || (pointer?.x === event.clientX && pointer?.y === event.clientY)) return;
  pointer = {x: event.clientX, y: event.clientY};
  select(Number(option.dataset.index));
 });
 results.addEventListener('click', event => {
  const option = event.target.closest('.command-option');
  if (option) run(Number(option.dataset.index));
 });
 for (const button of categories) button.addEventListener('click', () => {
  setCategory(button.dataset.category);
  input.focus();
 });
 dialog.querySelector('#closeCommands').addEventListener('click', close);
 dialog.addEventListener('cancel', event => { event.preventDefault(); close(); });
 dialog.addEventListener('click', event => {
  if (event.target === dialog) close();
 });
 return {open, close};
}
