import {t} from './i18n.js';
import {icon} from './icons.js';

const colorKey='weave.tag-colors.v1';
let colors=new Map();
try{colors=new Map(Object.entries(JSON.parse(localStorage.getItem(colorKey)||'{}')).filter(([,h])=>Number.isInteger(h)&&h>=0&&h<360).slice(-256))}catch{}
function tagHue(name){if(!colors.has(name)){if(colors.size>=256)colors.delete(colors.keys().next().value);let hue=0;for(let attempt=0;attempt<12;attempt++){hue=crypto.getRandomValues(new Uint16Array(1))[0]%360;if([...colors.values()].every(h=>Math.min(Math.abs(h-hue),360-Math.abs(h-hue))>=24))break}colors.set(name,hue);try{localStorage.setItem(colorKey,JSON.stringify(Object.fromEntries(colors)))}catch{}}return colors.get(name)}

export function mountTagEditor(root, initial, onChange) {
 let tags=[...new Set(String(initial||'').split(/[,，]/).map(v=>v.trim()).filter(Boolean))],saving=false,disposed=false,editing=false;
 const header=document.createElement('div');header.className='tag-heading';const title=document.createElement('h3');title.textContent=t('tags');
 const add=button('add',t('addTag'));add.className='tag-add';add.onclick=edit;header.append(title,add);
 const list=document.createElement('div');list.className='tag-list';list.setAttribute('aria-label',t('tags'));
 const status=document.createElement('span');status.className='tag-status';status.setAttribute('role','status');root.replaceChildren(header,list,status);
 function button(name,label){const b=document.createElement('button');b.type='button';b.innerHTML=icon(name);b.title=label;b.setAttribute('aria-label',label);return b}
 async function save(next){if(saving||disposed)return;const previous=tags;tags=next;saving=true;editing=false;status.textContent='';root.setAttribute('aria-busy','true');render();try{await onChange(tags.join(', '))}catch(e){if(disposed)return;tags=previous;status.textContent=e.message||t('saveFailed')}finally{saving=false;if(!disposed){root.setAttribute('aria-busy','false');render();add.focus()}}}
 function render(){list.replaceChildren();add.disabled=saving||editing;for(const name of tags){const chip=document.createElement('span');chip.className='tag-chip';chip.tabIndex=0;chip.style.setProperty('--tag-hue',tagHue(name));const label=document.createElement('span');label.textContent=name;const remove=button('close',t('removeTag',{name}));remove.className='tag-remove';remove.disabled=saving;remove.onclick=()=>save(tags.filter(v=>v!==name));chip.onkeydown=e=>{if((e.key==='Delete'||e.key==='Backspace')&&e.target===chip){e.preventDefault();save(tags.filter(v=>v!==name))}};chip.append(label,remove);list.append(chip)}}
 function edit(){if(editing||saving)return;editing=true;add.disabled=true;status.textContent='';const chip=document.createElement('span');chip.className='tag-chip tag-draft';const input=document.createElement('input');input.type='text';input.maxLength=80;input.placeholder=t('tagName');input.setAttribute('aria-label',t('tagName'));input.autocomplete='off';
  const confirm=button('check',t('addTag'));const cancel=button('close',t('cancel'));let ended=false;
  function commit(){if(ended)return;const values=input.value.split(/[,，]/).map(v=>v.trim()).filter(Boolean);if(!values.length){input.focus();return}ended=true;save([...new Set([...tags,...values])])}
  function abandon(){if(ended)return;ended=true;editing=false;render();add.focus()}
  confirm.onclick=commit;cancel.onclick=abandon;input.onkeydown=e=>{if(e.isComposing)return;if(e.key==='Enter'||e.key===','){e.preventDefault();commit()}else if(e.key==='Escape'){e.preventDefault();e.stopPropagation();abandon()}};chip.append(input,confirm,cancel);list.append(chip);input.focus();
 }
 render();return ()=>{disposed=true};
}
