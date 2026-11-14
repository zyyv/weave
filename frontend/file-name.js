import {renderAnimatedTitle} from './animated-title.js';

export function splitFileName(name){
 const dot=name.lastIndexOf('.');
 return dot>0?[name.slice(0,dot),name.slice(dot)]:[name,''];
}

export function mountFileName(root, reduceMotion){
 const heading=root.querySelector('h2');
 const form=root.querySelector('form');
 const input=form.querySelector('input');
 const suffix=root.querySelector('.file-name-suffix');
 let widthAnimation;

 function render(name,{immediate=false}={}){
  const [stem,extension]=splitFileName(name);
  renderAnimatedTitle(heading,stem,{immediate});
  heading.setAttribute('aria-label',name);
  suffix.textContent=extension;
  root.title=name;
 }

 function setEditing(editing,{name,motion=true}={}){
  const start=root.getBoundingClientRect().width;
  widthAnimation?.cancel();
  if(name!==undefined)render(name,{immediate:true});
  root.classList.toggle('is-editing',editing);
  form.inert=!editing;
  heading.inert=editing;
  if(!motion||reduceMotion.matches)return;
  const end=root.getBoundingClientRect().width;
  if(Math.abs(end-start)<1)return;
  widthAnimation=root.animate(
   [{width:start+'px'},{width:end+'px'}],
   {duration:240,easing:'cubic-bezier(.2,.75,.25,1)'}
  );
 }

 function reset(){
  setEditing(false,{name:'',motion:false});
  input.value='';
  root.removeAttribute('title');
 }

 return {heading,form,input,suffix,render,setEditing,reset};
}
