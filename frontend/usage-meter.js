// Render the capacity display at CSS-pixel scale so the 4px grid stays crisp at any DPI.
const pitch=4;
const dither=[0,8,2,10,12,4,14,6,3,11,1,9,15,7,13,5];
const ease=t=>1-(1-t)**3;
const clamp=t=>Math.min(1,Math.max(0,t));
const sum=values=>values.reduce((total,value)=>total+value,0);

export function createUsageMeter(canvas,onDraw){
 const ctx=canvas.getContext('2d');
 const reduced=matchMedia('(prefers-reduced-motion: reduce)');
 let sizes=[],colors=[],from=[],to=[],shown=[],focusLevels=[];
 let width=0,height=0,radius=0,scale=1,frame=0,start=0,duration=0,holdUntil=0,focus=-1,lastPaint=0;
 let busy=false,glint=false,visible=false,basis=1,dimLevel=0,ink='#fff';

 function queue(){
  if(ctx&&visible&&width&&height&&!frame)frame=requestAnimationFrame(draw);
 }
 function draw(now){
  frame=0;
  const progress=duration?clamp((now-start)/duration):1;
  if(progress===1&&now-lastPaint<30){queue();return}
  const blend=reduced.matches?1:1-Math.exp(-(now-lastPaint)/54);
  lastPaint=now;
  const step=(value,target)=>Math.abs(value-target)<.012?target:value+(target-value)*blend;
  dimLevel=step(dimLevel,Number(focus>=0));
  focusLevels=to.map((_,i)=>step(focusLevels[i]||0,Number(focus===i)));
  shown=to.map((value,i)=>{
   const delay=glint?i/Math.max(1,to.length-1)*.42:0;
   const phase=ease(clamp((progress-delay)/(1-delay)));
   return (from[i]??value)+(value-(from[i]??value))*phase;
  });
  onDraw(shown,progress===1);
  const total=sum(sizes);
  const scaleTotal=Math.max(basis,sum(shown));
  const range=shown.map(size=>size/scaleTotal);
  const end=width*sum(range);
  const moving=progress<1;
  const sweep=glint&&moving&&!reduced.matches?Math.sin(progress*Math.PI):0;
  const time=reduced.matches?0:now/1000;
  ctx.setTransform(scale,0,0,scale,0,0);
  ctx.clearRect(0,0,width,height);
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(0,0,width,height,radius);
  ctx.clip();

  let left=0;
  for(let i=0;i<range.length;i++){
   const span=range[i]*width;
   if(span<=0)continue;
   const lit=focusLevels[i];
   const dim=1-.66*dimLevel*(1-lit);
   ctx.fillStyle=colors[i];
   ctx.globalAlpha=(.12+.10*lit)*dim;
   ctx.fillRect(left,0,span,height);
   ctx.globalAlpha=.85*dim;
   ctx.shadowColor=colors[i];
   ctx.shadowBlur=5*scale;
   ctx.fillRect(left,0,span,1);
   ctx.fillRect(left,height-1,span,1);
   ctx.shadowBlur=0;
   if(left>0){
    ctx.fillStyle=ink;
    ctx.globalAlpha=.55*dim;
    ctx.fillRect(left-.5,1,1,height-2);
   }
   left+=span;
  }

  let column=0,kind=0,edge=(range[0]||0)*width;
  for(let x=2;x<width;x+=pitch,column++){
   const xHit=Math.min(x,width-.25);
   // Boundaries are calculated from the animated segment widths, including zero-width types.
   while(kind<range.length-1&&xHit>=edge){kind++;edge+=range[kind]*width}
   const used=xHit<end;
   const bright=focusLevels[kind]||0;
   const dim=1-.67*dimLevel*(1-bright);
   const beam=used?sweep*Math.exp(-(end-xHit)/19):0;
   ctx.fillStyle=used?colors[kind]:ink;
   for(let y=2,row=0;y<height;y+=pitch,row++){
    if(!used){
     ctx.globalAlpha=.085;
     ctx.fillRect(x-.75,y-.75,1.5,1.5);
     continue;
    }
    const rim=Math.max(0,1-Math.min(y,height-y)/15);
    const wave=(Math.sin(column*.22+Math.cos(row*.34+time*.6)*1.7+time*1.15)
      +Math.sin(column*.1-row*.47-time*.8))*.5;
    const lit=.39+.19*rim+.24*wave+.15*bright+beam*.67>(dither[(row%4)*4+column%4]+.5)/16;
    ctx.globalAlpha=(lit?.88:.26)*dim;
    const size=lit?3:1.5;
    const offset=lit?-2:-1;
    ctx.fillRect(x+offset,y+offset,size,size);
    if(lit){
     ctx.fillStyle=ink;
     ctx.globalAlpha=(.19+rim*.27+beam*.60+.15*bright)*dim;
     ctx.fillRect(x+offset,y+offset,size,size);
     ctx.fillStyle=colors[kind];
    }
   }
  }
  ctx.restore();
  ctx.globalAlpha=1;

  if(moving||(!reduced.matches&&(total>0||busy)))queue();
 }
 function resize(){
  const w=canvas.clientWidth,h=canvas.clientHeight;
  const dpr=Math.min(2,devicePixelRatio||1);
  radius=parseFloat(getComputedStyle(canvas).borderTopLeftRadius)||0;
  if(w===width&&h===height&&dpr===scale)return;
  width=w;height=h;scale=dpr;
  if(!w||!h)return;
  canvas.width=Math.round(w*dpr);
  canvas.height=Math.round(h*dpr);
  queue();
 }
 function update(next,scanning,reset,categoriesChanged){
  const changed=categoriesChanged||busy!==scanning||next.some((size,i)=>size!==sizes[i]);
  if(!changed&&!reset){queue();return}
  const now=performance.now();
  const oldTotal=sum(sizes);
  const nextTotal=sum(next);
  const wasBusy=busy;
  sizes=next;
  busy=scanning;
  const motion=!reduced.matches&&!reset;
  // Use the previous total as the scale when the new result is empty, so old pixels can drain.
  basis=nextTotal||oldTotal||1;
  from=categoriesChanged?next.map(()=>0):!motion?next:shown.length?shown:to;
  to=scanning&&!reduced.matches?next.map(()=>0):next;
  if(scanning&&motion&&!wasBusy)holdUntil=now+250;
  if(reset||!motion)holdUntil=0;
  start=scanning?now:Math.max(now,holdUntil);
  if(start>now)from=next.map(()=>0);
  duration=motion?(scanning?240:wasBusy?780:330):0;
  glint=wasBusy&&!scanning;
  if(!ctx||!motion)onDraw(to,true);
  queue();
 }
 if(ctx){
  new ResizeObserver(resize).observe(canvas);
  new IntersectionObserver(([entry])=>{
   visible=entry.isIntersecting;
   if(visible){resize();queue()}
   else{cancelAnimationFrame(frame);frame=0}
  }).observe(canvas);
  reduced.addEventListener('change',()=>{
   if(reduced.matches){duration=0;holdUntil=0;to=sizes}
   queue();
  });
 }
 function setColors(palette,textColor){
  if(ink===textColor&&palette.length===colors.length&&palette.every((color,i)=>color===colors[i]))return;
  colors=palette;
  ink=textColor;
  queue();
 }
 return {update,setColors,supported:!!ctx,focus:index=>{focus=index;queue()}};
}
