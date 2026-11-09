import {t} from './i18n.js';
let worker=null,nextID=0,cacheBytes=0;
const jobs=new Map(),cache=new Map(),pending=new Map(),limit=24*1024*1024;
function decoder(){if(worker)return worker;worker=new Worker('audio-codec-worker.js',{type:'module'});worker.onmessage=({data})=>{const job=jobs.get(data.id);if(!job)return;clearTimeout(job.timer);jobs.delete(data.id);data.error?job.reject(Error(t(data.error))):job.resolve(data)};worker.onerror=()=>reset(Error(t('couldNotLoadTheAudioDecoder')));return worker}
function reset(error){worker?.terminate();worker=null;for(const job of jobs.values()){clearTimeout(job.timer);job.reject(error)}jobs.clear()}
function decode(buffer){return new Promise((resolve,reject)=>{const id=++nextID,w=decoder(),timer=setTimeout(()=>reset(Error(t('voiceDecodingTimedOut'))),20000);jobs.set(id,{resolve,reject,timer});w.postMessage({id,buffer},[buffer])})}
function trim(){for(const [key,value] of cache){if(cacheBytes<=limit&&cache.size<=12)break;if(value.refs)continue;cache.delete(key);cacheBytes-=value.bytes;URL.revokeObjectURL(value.url)}}
export async function acquireAudio(item,signal){
 const key=`${item.id}:${item.modified}:${item.size}`;let entry=cache.get(key);
 if(!entry){let task=pending.get(key);if(!task){task=(async()=>{if(item.size>16*1024*1024)throw Error(t('voiceFileExceedsTheMibDecodingLimit'));const response=await fetch('raw/'+item.id,{signal});if(!response.ok)throw Error(await response.text());const buffer=await response.arrayBuffer();signal?.throwIfAborted();const decoded=await decode(buffer);signal?.throwIfAborted();const value={url:URL.createObjectURL(new Blob([decoded.wav],{type:'audio/wav'})),peaks:decoded.peaks,duration:decoded.duration,codec:decoded.codec,bytes:decoded.wav.byteLength,refs:0};cache.set(key,value);cacheBytes+=value.bytes;return value})().finally(()=>pending.delete(key));pending.set(key,task)}try{entry=await task}catch(error){if(error.name==='AbortError'&&!signal?.aborted)return acquireAudio(item,signal);throw error}}
 cache.delete(key);cache.set(key,entry);entry.refs++;
 let released=false;const release=()=>{if(released)return;released=true;entry.refs--;queueMicrotask(trim)};
 if(signal?.aborted){release();throw new DOMException(t('canceled'),'AbortError')}
 trim();return {...entry,release};
}

export function clearAudioCache(){
 for(const entry of cache.values())URL.revokeObjectURL(entry.url);
 cache.clear();cacheBytes=0;
}
