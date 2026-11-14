const reduceMotion=matchMedia('(prefers-reduced-motion: reduce)');
const displays=new WeakMap();
const raw=String;

function paint(display){
 for(const {node,key} of display.parts){
  const text=display.formats[key](display.shown[key]);
  if(node.textContent!==text)node.textContent=text;
 }
}

export function setAnimatedText(root,text){
 const display=displays.get(root);
 if(display){
  cancelAnimationFrame(display.frame);
  displays.delete(root);
 }
 if(root.textContent!==text)root.textContent=text;
}

// The template keeps the locale's wording and order. Only its numeric slots change.
export function renderAnimatedNumbers(root,template,values,{formats={},immediate=false}={}){
 const previous=displays.get(root);
 const keys=Object.keys(values);
 const formatters=Object.fromEntries(keys.map(key=>[key,formats[key]||raw]));
 const signature=JSON.stringify(keys);
 const compatible=previous?.template===template&&previous.signature===signature;
 let display=previous;
 if(!compatible){
  if(previous)cancelAnimationFrame(previous.frame);
  display={template,signature,shown:{...values},target:{...values},parts:[],frame:0};
  const content=template.split(/(\{\w+\})/g).map(text=>{
   const key=text.slice(1,-1);
   if(!text.startsWith('{')||!Object.hasOwn(values,key))return document.createTextNode(text);
   const node=document.createElement('span');
   node.className='animated-number';
   display.parts.push({node,key});
   return node;
  });
  root.replaceChildren(...content);
  displays.set(root,display);
 }
 display.formats=formatters;
 if(!compatible||immediate||reduceMotion.matches){
  cancelAnimationFrame(display.frame);
  display.frame=0;
  display.shown={...values};
  display.target={...values};
  paint(display);
  return;
 }
 if(keys.every(key=>values[key]===display.target[key])){
  paint(display);
  return;
 }

 cancelAnimationFrame(display.frame);
 const from={...display.shown};
 const start=performance.now();
 const target={...values};
 display.target=target;
 function frame(now){
  const progress=reduceMotion.matches?1:Math.min(1,(now-start)/430);
  const ease=1-(1-progress)**3;
  for(const key of keys)display.shown[key]=from[key]+(target[key]-from[key])*ease;
  paint(display);
  display.frame=progress<1?requestAnimationFrame(frame):0;
 }
 display.frame=requestAnimationFrame(frame);
}
