import {readFile,writeFile,mkdir} from 'node:fs/promises';
const pkg=JSON.parse(await readFile(new URL('../node_modules/exifr/package.json',import.meta.url),'utf8'));
const folder=new URL('../frontend/vendor/exifr/',import.meta.url);
const lock=JSON.parse(await readFile(new URL('../package-lock.json',import.meta.url),'utf8'));
const files={'exifr.js':await readFile(new URL('../node_modules/exifr/dist/full.esm.mjs',import.meta.url),'utf8'),'LICENSE':await readFile(new URL('../node_modules/exifr/LICENSE',import.meta.url),'utf8'),'VENDORED.json':JSON.stringify({package:pkg.name,version:pkg.version,license:pkg.license,source:'https://github.com/MikeKovarik/exifr',integrity:lock.packages['node_modules/exifr'].integrity},null,2)+'\n'};
await mkdir(folder,{recursive:true});
for(const [name,data] of Object.entries(files)){if(process.argv.includes('--check')){if(await readFile(new URL(name,folder),'utf8')!==data)throw Error('Outdated exifr: '+name)}else await writeFile(new URL(name,folder),data)}
console.log(`Verified local exifr ${pkg.version}`);
