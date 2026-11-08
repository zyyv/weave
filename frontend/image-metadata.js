import exifr from './vendor/exifr/exifr.js';
import {t,getLocale} from './i18n.js';
import {icon} from './icons.js';
const cache=new Map();
const bytes=n=>n<1048576?(n/1024).toFixed(1)+' KiB':(n/1048576).toFixed(1)+' MiB';
const meaningful=v=>v!==undefined&&v!==null&&v!=='';
function format(v){if(v instanceof Date)return Number.isNaN(v.valueOf())?'':v.toLocaleString(getLocale());if(Array.isArray(v))return v.length<=8?v.map(format).join(' · '):'';if(typeof v==='number')return Number.isFinite(v)?String(Math.round(v*100000)/100000):'';return typeof v==='string'?v.replaceAll('\0','').slice(0,600):''}
const enums={'Normal program':'metaProgramAuto','Manual':'metaManual','Aperture priority':'metaAperturePriority','Shutter priority':'metaShutterPriority','Auto':'metaAuto','Auto exposure':'metaAuto','Pattern':'metaPattern','CenterWeightedAverage':'metaCenterWeighted','Spot':'metaSpot','Flash did not fire, compulsory flash mode':'metaFlashOff','Flash did not fire':'metaNoFlash','Horizontal (normal)':'metaNormal','Rotate 90 CW':'metaRotate90','Rotate 180':'metaRotate180','Rotate 270 CW':'metaRotate270'};
const enumValue=v=>getLocale()==='zh-CN'&&enums[v]?t(enums[v]):format(v);
const exposure=v=>typeof v==='number'?(v<1?`1/${Math.round(1/v)} s`:`${v} s`):format(v);

export function mountImageMetadata(root,item){
 let disposed=false,data={},dimensions=null,state=item.kind==='image'?'loading':'';
 function row(symbol,label,value){const dt=document.createElement('dt');dt.innerHTML=icon(symbol);const text=document.createElement('span');text.textContent=t(label);dt.append(text);const dd=document.createElement('dd');dd.textContent=value;dd.title=value;dt.dataset.field=dd.dataset.field=label;return [dt,dd]}
 function render(){
  if(disposed)return;root.replaceChildren();
  function group(label,rows){rows=rows.filter(r=>meaningful(r[2]));if(!rows.length)return;const section=document.createElement('section');section.className='metadata-group';const title=document.createElement('h4');title.textContent=t(label);const dl=document.createElement('dl');for(const [sym,key,value] of rows)dl.append(...row(sym,key,String(value)));section.append(title,dl);root.append(section)}
  group('metaFile',[
   ['file','extension',item.ext.slice(1).toUpperCase()||t('noExtension')],['box','fileSize',bytes(item.size)],['calendar','modified',new Date(item.modified).toLocaleString(getLocale())],['layers','fileVersion',item.thumbnail?t('thumbnail'):t('originalFile')],
   ['ruler','dimensions',dimensions?`${dimensions[0]} × ${dimensions[1]}`:null]
  ]);
  function field(symbol,label,key,fn=enumValue){const value=data[key];return [symbol,label,meaningful(value)?fn(value):null]}
  group('metaCamera',[field('camera','metaMake','Make'),field('camera','metaModel','Model'),field('lens','metaLens','LensModel'),field('lens','metaLensMake','LensMake'),field('settings','metaSoftware','Software')]);
  group('metaExposure',[field('clock','metaShutter','ExposureTime',exposure),field('aperture','metaAperture','FNumber',v=>'ƒ/'+format(v)),field('camera','metaISO','ISO'),field('ruler','metaFocalLength','FocalLength',v=>format(v)+' mm'),field('ruler','metaFocal35','FocalLengthIn35mmFormat',v=>format(v)+' mm'),field('camera','metaProgram','ExposureProgram'),field('camera','metaCompensation','ExposureCompensation',v=>format(v)+' EV'),field('color','metaWhiteBalance','WhiteBalance'),field('camera','metaMetering','MeteringMode'),field('camera','metaFlash','Flash')]);
  group('metaCapture',[field('calendar','metaTaken','DateTimeOriginal'),field('calendar','metaDigitized','CreateDate'),field('clock','metaTimezone','OffsetTimeOriginal')]);
  group('metaImage',[field('color','metaColorSpace','ColorSpace',v=>v===1?'sRGB':v===2?'Adobe RGB':v===65535?t('metaUncalibrated'):format(v)),field('color','metaProfile','ProfileDescription'),field('layers','metaBitDepth','BitsPerSample'),field('image','metaOrientation','Orientation'),field('ruler','metaResolution','XResolution',v=>format(v)+(['inches',2].includes(data.ResolutionUnit)?' dpi':data.ResolutionUnit?' / '+format(data.ResolutionUnit):''))]);
  group('metaLocation',[field('location','metaLatitude','latitude'),field('location','metaLongitude','longitude'),field('location','metaAltitude','GPSAltitude',v=>format(v)+' m')]);
  group('metaAuthor',[field('users','metaArtist','Artist'),field('info','metaCopyright','Copyright'),field('file','metaDescription','ImageDescription')]);
  if(state){const note=document.createElement('p');note.className='metadata-status';note.setAttribute('role','status');note.textContent=t(state==='loading'?'readingMetadata':state==='empty'?'noEmbeddedMetadata':'metadataReadFailed');root.append(note)}
 }
 render();
 if(item.kind==='image'){
  const key=`${item.id}:${item.modified}:${item.size}`;
  if(!cache.has(key)){if(cache.size>=32)cache.delete(cache.keys().next().value);const pending=exifr.parse(new URL('media/'+item.id,document.baseURI).href,{tiff:true,xmp:true,iptc:true,icc:true,jfif:true,ihdr:true,multiSegment:false,chunked:true,chunkLimit:5,firstChunkSize:65536,chunkSize:65536,ifd1:false,makerNote:false,userComment:false});cache.set(key,pending);pending.catch(()=>cache.delete(key))}
  cache.get(key).then(value=>{if(disposed)return;data=value||{};state=Object.keys(data).length?'':'empty';render()}).catch(()=>{if(!disposed){state='error';render()}});
 }
 return {setDimensions(img){dimensions=[img.naturalWidth,img.naturalHeight];render()},dispose(){disposed=true}};
}
