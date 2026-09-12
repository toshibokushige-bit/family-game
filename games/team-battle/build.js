const fs=require('fs'),path=require('path');
const root=__dirname;
fs.writeFileSync(path.join(root,'index.html'),fs.readFileSync(path.join(root,'template.html'),'utf8').replace('__ENGINE__',()=>fs.readFileSync(path.join(root,'engine.js'),'utf8')).replace('__ART__',()=>fs.readFileSync(path.join(root,'art.json'),'utf8')).replace('__UI__',()=>fs.readFileSync(path.join(root,'lan-client.js'),'utf8')+'\n'+fs.readFileSync(path.join(root,'tutorial.js'),'utf8')+'\n'+fs.readFileSync(path.join(root,'ui.js'),'utf8')));
console.log('Built single HTML');
