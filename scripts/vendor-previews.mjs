// Install the versions in the vendor manifest into a scratch directory, then
// run: node scripts/vendor-previews.mjs /path/to/scratch/node_modules
import {cp, mkdir, readdir, readFile, rm, writeFile} from 'node:fs/promises';
import {resolve, join} from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';

if(!process.argv[2])throw Error('Pass the path to the dependency node_modules directory.');
const modules=resolve(process.argv[2]);
const root=fileURLToPath(new URL('../frontend/',import.meta.url));
const office=join(root,'office-frame/vendor');
const prism=join(root,'vendor/prism');
const {build}=await import(pathToFileURL(join(modules,'esbuild/lib/main.js')));
const manifest=JSON.parse(await readFile(join(office,'VENDORED.json'),'utf8'));
for(const [name,version] of Object.entries(manifest.buildDependencies)){
 const installed=JSON.parse(await readFile(join(modules,name,'package.json'),'utf8'));
 if(installed.version!==version)throw Error(`Expected ${name}@${version}, got ${installed.version}`);
}
for(const dir of [office,prism])await mkdir(dir,{recursive:true});

const bundled=[];
const base={absWorkingDir:modules,bundle:true,format:'esm',target:'safari15.4',minify:true,
 legalComments:'inline',metafile:true};
const engines={
 word:['@file-viewer/renderer-word','renderFileViewerWordDoc'],
 spreadsheet:['@file-viewer/renderer-spreadsheet','renderFileViewerSpreadsheet'],
 presentation:['@file-viewer/renderer-presentation','renderFileViewerBinaryPresentation, renderFileViewerPresentation'],
};
const officeEntries=await Promise.all(Object.entries(engines).map(async ([entry,[pkg,exports]])=>{
 const file=join(modules,'..',`weave-${entry}.mjs`);
 await writeFile(file,`export {${exports}} from '${pkg}';\n`);
 return {in:file,out:entry};
}));
// The upstream spreadsheet renderer themes the scrollbar thumb but leaves
// its canvas-painted track white. Use the same theme color as the cells.
const spreadsheetScrollbar={
 name:'spreadsheet-scrollbar-theme',
 setup(builder){
  builder.onLoad({filter:/renderer-spreadsheet[\/]dist[\/]spreadsheet[\/]view\.js$/},async ({path})=>{
   const source=await readFile(path,'utf8');
   const anchor="SCROLLER_COLOR: darkMode ? '#475569' : '#c1c7d0',";
   if(!source.includes(anchor))throw Error('Recheck the upstream spreadsheet scrollbar theme.');
   return {contents:source.replace(anchor,anchor+"\n        SCROLLER_TRACK_COLOR: darkMode ? EXCEL_DARK_BODY_BG : '#ffffff',")};
  });
 }
};
const officeBuild=await build({...base,entryPoints:officeEntries,outdir:office,splitting:true,
 outExtension:{'.js':'.mjs'},chunkNames:'chunks/[name]-[hash]',plugins:[spreadsheetScrollbar]});
bundled.push(officeBuild);
const emitted=new Set(Object.keys(officeBuild.metafile.outputs).map(file=>resolve(modules,file)));
const chunks=join(office,'chunks');
for(const file of await readdir(chunks)){
 const path=join(chunks,file);
 if(file.endsWith('.mjs')&&!emitted.has(path))await rm(path);
}

await build({...base,outfile:join(prism,'prism.mjs'),stdin:{
 resolveDir:modules,sourcefile:'weave-prism.js',contents:`
 import Prism from 'prismjs/components/prism-core.js';
 import 'prismjs/components/prism-clike.js';
 import 'prismjs/components/prism-markup.js';
 import 'prismjs/components/prism-javascript.js';
 import 'prismjs/components/prism-typescript.js';
 import 'prismjs/components/prism-jsx.js';
 import 'prismjs/components/prism-tsx.js';
 import 'prismjs/components/prism-css.js';
 import 'prismjs/components/prism-scss.js';
 import 'prismjs/components/prism-less.js';
 import 'prismjs/components/prism-json.js';
 import 'prismjs/components/prism-json5.js';
 import 'prismjs/components/prism-yaml.js';
 import 'prismjs/components/prism-toml.js';
 import 'prismjs/components/prism-graphql.js';
 import 'prismjs/components/prism-markdown.js';
 export default Prism;
 `
}});
await cp(join(modules,'prismjs/LICENSE'),join(prism,'LICENSE'));

const workers={
 'docx.worker.js':'@file-viewer/docx/dist/docx-preview.worker.js',
 'sheet.worker.js':'@file-viewer/renderer-spreadsheet/dist/worker/sheet.worker.js',
 'ppt.worker.js':'@file-viewer/ppt/dist/pptjs.worker.js',
 'pptx.worker.js':'@file-viewer/pptx/dist/worker/pptx.worker.js',
 'jszip.min.js':'jszip/dist/jszip.min.js',
};
for(const [dest,source] of Object.entries(workers))await cp(join(modules,source),join(office,dest));

const packages=new Set(Object.values(workers).map(source=>source.startsWith('@')?source.split('/').slice(0,2).join('/'):source.split('/')[0]));
for(const {metafile} of bundled)for(const file of Object.keys(metafile.inputs)){
 if(file.startsWith('../'))continue;
 packages.add(file.startsWith('@')?file.split('/').slice(0,2).join('/'):file.split('/')[0]);
}
const licenses=join(office,'licenses');
await mkdir(licenses,{recursive:true});
const packageVersions={};
for(const pkg of [...packages].sort()){
 const dir=join(modules,pkg);
 const data=JSON.parse(await readFile(join(dir,'package.json'),'utf8'));
 packageVersions[pkg]={version:data.version,license:data.license};
 for(const file of await readdir(dir)){
  if(/^(licen[sc]e|copying|notice|third_party_notices)(\..*)?$/i.test(file))
   await cp(join(dir,file),join(licenses,pkg.replace('/','-')+'-'+file));
 }
}
await writeFile(join(office,'DEPENDENCIES.json'),JSON.stringify(packageVersions,null,2)+'\n');
