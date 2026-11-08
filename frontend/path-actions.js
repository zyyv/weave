import {t} from './i18n.js';

export function relativeResourcePath(path,root){const base=String(root||'').replace(/\/+$/,'');if(!root||!path.startsWith(base+'/'))throw Error(t('relativePathUnavailable'));return path.slice(base.length+1)}
export async function copyPath(value){
 if(navigator.clipboard?.writeText){try{await navigator.clipboard.writeText(value);return}catch{}}
 const previous=document.activeElement,field=document.createElement('textarea');field.value=value;field.readOnly=true;field.setAttribute('aria-label',t('fileLocation'));field.className='clipboard-fallback';const host=document.querySelector('dialog[open]')||document.body;host.append(field);field.focus();field.select();
 try{if(!document.execCommand('copy'))throw Error(t('couldNotCopyPath'))}finally{field.remove();previous?.focus({preventScroll:true})}
}
