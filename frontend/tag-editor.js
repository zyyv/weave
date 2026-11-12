import {t} from './i18n.js';

const colorLabels={
 red:()=>t('tagColor_red'),
 orange:()=>t('tagColor_orange'),
 yellow:()=>t('tagColor_yellow'),
 green:()=>t('tagColor_green'),
 blue:()=>t('tagColor_blue'),
 purple:()=>t('tagColor_purple'),
 gray:()=>t('tagColor_gray'),
};
const palette=Object.keys(colorLabels);

function parseTags(value){
 return [...new Set(String(value||'').split(/[,，]/).map(tag=>tag.trim()).filter(Boolean))];
}

function tagColor(tag){
 if(palette.includes(tag))return tag;
 // Assign older text tags a stable color without rewriting their stored names.
 let hash=0;
 for(const char of tag)hash=(Math.imul(31,hash)+char.codePointAt(0))>>>0;
 return palette[hash%palette.length];
}

function selectedColors(tags){
 const used=new Set(tags.map(tagColor));
 return palette.filter(color=>used.has(color));
}

export function tagColors(value){
 return selectedColors(parseTags(value));
}

function toggleTag(tags,color){
 return tags.some(tag=>tagColor(tag)===color)
  ? tags.filter(tag=>tagColor(tag)!==color)
  : [...tags,color];
}

export function toggleTagColor(value,color){
 return palette.includes(color)?toggleTag(parseTags(value),color).join(', '):value;
}

export function tagDots(value){
 const colors=tagColors(value);
 if(!colors.length)return '';
 return `<span class="tag-dots" role="img" aria-label="${t('tags')}: ${colors.map(color=>colorLabels[color]()).join(', ')}">${colors.map(color=>`<span class="tag-dot" data-color="${color}"></span>`).join('')}</span>`;
}

export function createTagPalette(onToggle, labelId){
 const element=document.createElement('div');
 element.className='tag-palette';
 element.setAttribute('role','group');
 if(labelId)element.setAttribute('aria-labelledby',labelId);
 else element.setAttribute('aria-label',t('tags'));
 const buttons=palette.map(color=>{
  const button=document.createElement('button');
  button.type='button';
  button.className='tag-choice';
  button.setAttribute('aria-label',colorLabels[color]());
  button.title=colorLabels[color]();
  const dot=document.createElement('span');
  dot.className='tag-dot';
  dot.dataset.color=color;
  button.append(dot);
  button.onclick=()=>onToggle(color);
  element.append(button);
  return button;
 });
 return {
  element,
  render(active){
   buttons.forEach((button,index)=>button.setAttribute('aria-pressed',String(active.includes(palette[index]))));
  },
 };
}

export function mountTagEditor(root, initial, onChange, labelId){
 let savedTags=parseTags(initial);
 let tags=savedTags;
 let saving=false,disposed=false;
 const list=createTagPalette(toggle,labelId);
 const status=document.createElement('span');
 status.className='tag-status';
 status.setAttribute('role','status');
 root.replaceChildren(list.element,status);
 render();

 function render(){
  list.render(selectedColors(tags));
  list.element.setAttribute('aria-busy',String(saving));
 }

 function toggle(color){
  if(disposed)return;
  tags=toggleTag(tags,color);
  status.textContent='';
  render();
  void save();
 }

 async function save(){
  if(saving)return;
  saving=true;
  render();
  try{
   while(tags!==savedTags){
    const next=tags;
    try{
     await onChange(next.join(', '));
     savedTags=next;
    }catch(error){
     if(tags===next){
      tags=savedTags;
      if(!disposed)status.textContent=error?.message||t('saveFailed');
     }
    }
   }
  }finally{
   saving=false;
   if(!disposed)render();
  }
 }

 return ()=>{disposed=true};
}
