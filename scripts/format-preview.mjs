import {readFileSync} from 'node:fs';
import {format} from 'oxfmt';

const extension=process.argv[2];
const source=readFileSync(0,'utf8');
if(extension==='.json'){
 try{JSON.parse(source)}catch{process.exit(2)}
}
const result=await format('preview'+extension,source,{
 tabWidth:2,sortImports:false,sortPackageJson:false,sortTailwindcss:false,
});
if(result.errors.some(error=>error.severity==='Error'))process.exit(2);
if(Buffer.byteLength(result.code)>2*1024*1024)process.exit(1);
process.stdout.write(result.code);
