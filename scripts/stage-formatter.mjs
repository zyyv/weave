// Stage the pinned Node runtime and Oxfmt API inside a macOS app bundle.
import {chmod,cp,mkdir,readdir} from 'node:fs/promises';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';

const [bundle,arch]=process.argv.slice(2);
const platform={
 arm64:['node-bin-darwin-arm64','@oxfmt/binding-darwin-arm64'],
 amd64:['node-darwin-x64','@oxfmt/binding-darwin-x64']
}[arch];
if(!bundle||!platform)throw Error('Pass the app bundle and GOARCH (arm64 or amd64).');
const [runtime,binding]=platform;
const modules=fileURLToPath(new URL('../node_modules/',import.meta.url));
const resources=join(bundle,'Contents','Resources','formatter');
const executable=join(bundle,'Contents','MacOS','formatter-node');
await mkdir(join(resources,'node_modules','@oxfmt'),{recursive:true});
await cp(join(modules,runtime,'bin','node'),executable);
await chmod(executable,0o755);
for(const file of await readdir(join(modules,runtime))){
 if(/^license(\..*)?$/i.test(file))await cp(join(modules,runtime,file),join(resources,'NODE-'+file));
}
for(const dependency of ['oxfmt','tinypool',binding]){
 await cp(join(modules,dependency),join(resources,'node_modules',dependency),{recursive:true});
}
await cp(new URL('./format-preview.mjs',import.meta.url),join(resources,'format-preview.mjs'));
