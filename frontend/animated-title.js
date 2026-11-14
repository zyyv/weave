const reduceMotion=matchMedia('(prefers-reduced-motion: reduce)');
const titles=new WeakMap();
const graphemes=new Intl.Segmenter(undefined,{granularity:'grapheme'});

export function renderAnimatedTitle(root,text,{immediate=false}={}){
 const previous=titles.get(root);
 if(previous?.text===text)return;
 previous?.animations.forEach(animation=>animation.cancel());
 const animations=[];
 titles.set(root,{text,animations});
 if(root.hasAttribute('aria-label')||root.matches('h1,h2,h3'))root.setAttribute('aria-label',text);
 const segments=Array.from(graphemes.segment(text),part=>part.segment);
 const parts=segments.map(segment=>{
  if(/^\s+$/u.test(segment))return document.createTextNode(segment);
  const span=document.createElement('span');
  span.className='animated-title-character';
  span.textContent=segment;
  return span;
 });
 root.replaceChildren(...parts);

 if(immediate||reduceMotion.matches||!previous)return;
 parts.forEach((part,index)=>{
  if(part.nodeType!==Node.ELEMENT_NODE)return;
  animations.push(part.animate(
   [{opacity:.15,transform:'translateY(.26em)'},{opacity:1,transform:'translateY(0)'}],
   {duration:210,delay:Math.min(120,index*13),fill:'backwards',easing:'ease-out'}
  ));
 });
}
