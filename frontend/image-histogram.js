import {t} from './i18n.js';

export function mountHistogram(shell){
 const panel=document.createElement('section');panel.className='image-histogram';panel.setAttribute('aria-label',t('histogram'));
 const header=document.createElement('div');header.className='histogram-heading';const title=document.createElement('span');title.textContent=t('histogram');
 const modes=document.createElement('div');modes.className='histogram-modes';modes.setAttribute('role','group');modes.setAttribute('aria-label',t('histogramChannel'));
 const rgb=modeButton('RGB','rgb',t('rgbHistogram')),luma=modeButton('Y','luma',t('luminanceHistogram'));modes.append(rgb,luma);header.append(title,modes);
 const canvas=document.createElement('canvas');canvas.setAttribute('role','img');canvas.setAttribute('aria-label',t('histogramLoading'));
 const axis=document.createElement('div');axis.className='histogram-axis';const shadows=document.createElement('span'),highlights=document.createElement('span');shadows.textContent=t('histogramShadows');highlights.textContent=t('histogramHighlights');axis.append(shadows,highlights);
 panel.append(header,canvas,axis);shell.append(panel);
 let bins=null,mode='rgb',disposed=false;const request=new AbortController();
 function modeButton(text,value,label){const b=document.createElement('button');b.type='button';b.textContent=text;b.title=label;b.setAttribute('aria-label',label);b.setAttribute('aria-pressed',String(value==='rgb'));b.onclick=()=>{mode=value;rgb.setAttribute('aria-pressed',String(mode==='rgb'));luma.setAttribute('aria-pressed',String(mode==='luma'));draw()};return b}
 function draw(){if(disposed||panel.hidden)return;const width=canvas.clientWidth,height=canvas.clientHeight;if(!width||!height)return;const ratio=Math.min(devicePixelRatio||1,2);canvas.width=Math.round(width*ratio);canvas.height=Math.round(height*ratio);const ctx=canvas.getContext('2d');ctx.scale(ratio,ratio);const w=width,h=height-2;
  ctx.strokeStyle=getComputedStyle(panel).getPropertyValue('--line').trim()||'#ffffff12';ctx.lineWidth=1;for(const fraction of [0,.5,1]){const x=.5+fraction*(w-1);ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,h);ctx.stroke()}ctx.beginPath();ctx.moveTo(0,h);ctx.lineTo(w,h);ctx.stroke();
  if(!bins)return;const selected=mode==='rgb'?[0,1,2]:[3];let peak=0;for(const ch of selected)for(const n of bins.channels[ch])peak=Math.max(peak,n);if(!peak)return;
  const colors=['243,119,119','117,211,161','129,169,247',document.documentElement.dataset.theme==='light'?'65,70,78':'225,229,236'];
  for(const ch of selected){const values=bins.channels[ch];ctx.beginPath();ctx.moveTo(0,h);for(let i=0;i<256;i++)ctx.lineTo(i*w/255,h-values[i]/peak*(h-4));ctx.lineTo(w,h);ctx.closePath();ctx.fillStyle=`rgba(${colors[ch]},.17)`;ctx.fill();ctx.beginPath();for(let i=0;i<256;i++){const x=i*w/255,y=h-values[i]/peak*(h-4);i?ctx.lineTo(x,y):ctx.moveTo(x,y)}ctx.strokeStyle=`rgba(${colors[ch]},.9)`;ctx.lineWidth=1;ctx.stroke()}
 }
 const resize=new ResizeObserver(draw);resize.observe(canvas);
 return {panel,async load(id){try{const response=await fetch('api/histogram?id='+encodeURIComponent(id),{signal:request.signal});if(!response.ok)throw Error('histogram unavailable');const value=await response.json();if(disposed)return;bins=value;canvas.setAttribute('aria-label',t(bins.total?'histogramReady':'histogramTransparent'));panel.dataset.ready='true';draw()}catch{if(disposed)return;canvas.setAttribute('aria-label',t('histogramUnavailable'));panel.dataset.ready='error'}},dispose(){disposed=true;request.abort();resize.disconnect();bins=null}};
}
