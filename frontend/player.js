import {mountAudioPlayer} from './audio-player.js';
let videoBundle;
function loadVideo(){return videoBundle??=Promise.all([import('./vendor/videojs/video-neutral.js'),import('./vendor/videojs/locales/zh.js'),import('./vendor/videojs/i18n-Cyr03dAS.js')]).catch(e=>{videoBundle=null;throw e})}
export function mountPlayer(root,item,prefs,onPreference){
 if(item.kind==='audio')return mountAudioPlayer(root,item,prefs,onPreference);
 let disposed=false;const abort=new AbortController();
 root.innerHTML='<div class="media-player video-shell"><media-i18n lang="zh"><video-player><video-neutral-skin><video preload="metadata" playsinline></video></video-neutral-skin></video-player></media-i18n><p class="player-status" role="status">正在准备播放器…</p></div>';
 const media=root.querySelector('video'),status=root.querySelector('.player-status');
 media.addEventListener('loadedmetadata',()=>{if(!disposed)status.textContent=''}, {signal:abort.signal});
 media.addEventListener('error',()=>{if(!disposed){status.textContent='此编码暂无法播放，可导出后使用系统播放器打开。';status.classList.add('error')}},{signal:abort.signal});
 loadVideo().then(()=>{if(disposed)return;media.volume=prefs.volume;media.playbackRate=prefs.speed;media.addEventListener('volumechange',()=>onPreference('volume',media.volume),{signal:abort.signal});media.addEventListener('ratechange',()=>onPreference('speed',media.playbackRate),{signal:abort.signal});status.textContent='正在加载媒体…';media.src='media/'+item.id}).catch(e=>{if(!disposed)status.textContent='播放器加载失败：'+e.message});
 return()=>{disposed=true;abort.abort();media.pause();media.removeAttribute('src');media.load();root.replaceChildren()};
}
