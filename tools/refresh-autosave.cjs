// Refresh embedded sources for the three games maintained as single HTML files.
const fs=require('fs'),path=require('path'),root=path.join(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const common=read('shared/autosave.js');
for(const id of ['quest','ranger','survivors']){
 const p='games/'+id+'/index.html';let s=read(p);
 const modulePattern=/\(function\(root\)\{[\s\S]*?\}\)\(typeof globalThis!=='undefined'\?globalThis:this\);\s*/;
 const adapterPattern=/\/\/ AUTOSAVE ADAPTER\n[\s\S]*?(?=<\/script>)/;
 if(!modulePattern.test(s)||!adapterPattern.test(s))throw Error('Missing autosave markers: '+id);
 s=s.replace(modulePattern,()=>common.trimEnd()+'\n').replace(adapterPattern,()=>'// AUTOSAVE ADAPTER\n'+read('games/'+id+'/autosave.js').trimEnd()+'\n');
 fs.writeFileSync(path.join(root,p),s);
}
console.log('Updated quest / ranger / survivors autosave');
