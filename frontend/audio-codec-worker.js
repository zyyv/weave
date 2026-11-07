// One warm decoder. All PCM traversal and WAV construction stay off the UI thread.
import {decode} from './vendor/silk.mjs';
let chain=Promise.resolve(),amr=null;
function decodeAMR(buffer){return new Promise((resolve,reject)=>{amr??=new Worker('vendor/amr-worker.js');amr.onmessage=e=>e.data.error?reject(Error(e.data.error)):resolve(e.data.amr);amr.onerror=e=>reject(Error(e.message));amr.postMessage({command:'decode',buffer:new Uint8Array(buffer)},[buffer])})}
async function process({id,buffer}){
 try{
  const signature=new TextDecoder().decode(buffer.slice(0,12));let pcm,rate,codec;
  if(signature.includes('#!SILK')){const result=await decode(buffer,24000);pcm=new Int16Array(result.data.buffer,result.data.byteOffset,result.data.byteLength/2);rate=24000;codec='SILK'}
  else if(signature.startsWith('#!AMR\n')){const samples=await decodeAMR(buffer);pcm=new Int16Array(samples.length);for(let i=0;i<samples.length;i++)pcm[i]=Math.max(-32768,Math.min(32767,samples[i]*32768));rate=8000;codec='AMR-NB'}
  else throw Error('errors.voiceCodec');
  if(!pcm.length||pcm.length>rate*900)throw Error('errors.voiceDuration');
  const count=Math.min(2048,pcm.length),peaks=new Float32Array(count*2),stride=Math.ceil(pcm.length/count);
  for(let i=0;i<count;i++){let peak=0;for(let j=i*stride;j<Math.min((i+1)*stride,pcm.length);j++)peak=Math.max(peak,Math.abs(pcm[j])/32768);peaks[i*2]=peak;peaks[i*2+1]=-peak}
  const wav=new ArrayBuffer(44+pcm.byteLength),view=new DataView(wav);const text=(offset,value)=>[...value].forEach((c,i)=>view.setUint8(offset+i,c.charCodeAt(0)));
  text(0,'RIFF');view.setUint32(4,wav.byteLength-8,true);text(8,'WAVEfmt ');view.setUint32(16,16,true);view.setUint16(20,1,true);view.setUint16(22,1,true);view.setUint32(24,rate,true);view.setUint32(28,rate*2,true);view.setUint16(32,2,true);view.setUint16(34,16,true);text(36,'data');view.setUint32(40,pcm.byteLength,true);new Uint8Array(wav,44).set(new Uint8Array(pcm.buffer,pcm.byteOffset,pcm.byteLength));
  self.postMessage({id,wav,peaks,duration:pcm.length/rate,codec},[wav,peaks.buffer]);
 }catch(error){self.postMessage({id,error:error.message})}
}
self.onmessage=e=>{chain=chain.then(()=>process(e.data))};
