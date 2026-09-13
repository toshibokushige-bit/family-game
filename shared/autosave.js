(function(root){
'use strict';
const clone=x=>JSON.parse(JSON.stringify(x));
function safeTree(x,depth=0){if(depth>40)return false;if(x===null||typeof x==='boolean')return true;if(typeof x==='number')return Number.isFinite(x);if(typeof x==='string')return x.length<=1500000;if(typeof x!=='object')return false;if(Array.isArray(x))return x.length<=20000&&x.every(v=>safeTree(v,depth+1));return Object.keys(x).length<=5000&&Object.keys(x).every(k=>!['__proto__','constructor','prototype'].includes(k)&&safeTree(x[k],depth+1));}
function checksum(s){let h=2166136261;for(let i=0;i<s.length;i++)h=Math.imul(h^s.charCodeAt(i),16777619);return(h>>>0).toString(36);}
function create(game,validate,storage){
 const key='higashiyama:'+game+':v1';let issue='';
 function pack(data){if(!safeTree(data)||!validate(data))throw Error('きろくの かたちが ちがうよ');return {version:1,game,data:clone(data)};}
 function read(raw){if(typeof raw!=='string'||raw.length>2000000)throw Error('きろくが おおきすぎるよ');const p=JSON.parse(raw);if(!safeTree(p)||p.version!==1||p.game!==game||!validate(p.data))throw Error('このゲームの きろくでは ないよ');return clone(p.data);}
 return {key,get issue(){return issue;},load(){try{const raw=storage().getItem(key);if(!raw)return null;return read(raw);}catch(e){issue='きろくを よめません。あいことばから もどせます。';return null;}},save(data){try{storage().setItem(key,JSON.stringify(pack(data)));issue='';return true;}catch(e){issue='このブラウザに ほぞんできません。あいことばを コピーしてね。';return false;}},encode(data){const s=JSON.stringify(pack(data));return 'HG1.'+checksum(s)+'.'+encodeURIComponent(s);},decode(code){if(typeof code!=='string'||code.length>6000000)throw Error('あいことばが ながすぎるよ');const m=/^HG1\.([a-z0-9]+)\.(.+)$/.exec(code.trim());if(!m)throw Error('あいことばが ちがうよ');let s;try{s=decodeURIComponent(m[2]);}catch(e){throw Error('あいことばが こわれているよ');}if(checksum(s)!==m[1])throw Error('あいことばが とぎれているよ');return read(s);}};
}
function mount(game,config){
 if(typeof root.addEventListener!=='function'||typeof document==='undefined'||!document.body||typeof document.createElement('button').setAttribute!=='function')return null;
 const store=create(game,config.validate,()=>root.localStorage);let saved=store.load(),last='',busy=false,dialog=null;
 if(saved&&config.progress)try{config.progress(clone(saved));}catch(e){saved=null;}
 function capture(){if(busy)return saved;try{const value=config.capture(saved&&clone(saved));if(value){const raw=JSON.stringify(value);if(raw!==last){if(!safeTree(value)||!config.validate(value))return saved;saved=clone(value);store.save(saved);last=raw;}}}catch(e){/* Keep the last valid checkpoint during transitions. */}if(button)button.textContent=store.issue?'⚠ ほぞん':'💾 きろく・つづき';return saved;}
 const button=document.createElement('button');button.textContent=store.issue?'⚠ ほぞん':'💾 きろく';button.type='button';button.setAttribute('aria-label','じどうほぞん・つづき・あいことば');button.style.cssText='position:fixed;right:8px;bottom:calc(8px + env(safe-area-inset-bottom));z-index:100005;min-height:40px;padding:8px 12px;border:2px solid #8eb59d;border-radius:20px;background:#f8fff5;color:#234936;font:14px sans-serif;opacity:.9';document.body.appendChild(button);
 button.onclick=()=>{
  capture();if(config.pause)config.pause();busy=true;
  dialog=document.createElement('dialog');dialog.style.cssText='max-width:460px;width:calc(100% - 48px);max-height:85svh;overflow:auto;padding:20px;border:2px solid #8eb59d;border-radius:18px;background:#f8fff5;color:#234936;font:16px sans-serif';
  for(const type of ['keydown','keyup','pointerdown','pointerup'])dialog.addEventListener(type,e=>e.stopPropagation());
  const title=document.createElement('h2');title.textContent='きろくと あいことば';dialog.appendChild(title);
  const note=document.createElement('p');note.textContent=store.issue||config.note||'じどうで ほぞんしています。';dialog.appendChild(note);
  const input=document.createElement('textarea');input.setAttribute('aria-label','バックアップの あいことば');input.rows=4;input.style.cssText='box-sizing:border-box;width:100%;user-select:text;font:14px monospace';dialog.appendChild(input);
  const add=(label,fn)=>{const b=document.createElement('button');b.textContent=label;b.type='button';b.style.cssText='display:block;width:100%;min-height:44px;margin-top:8px;font:inherit';b.onclick=async()=>{try{await fn();}catch(e){note.textContent=e.message||'きろくを たしかめてね';}};dialog.appendChild(b);return b;};
  add('ほぞんした つづきから',()=>{if(!saved)throw Error('まだ きろくが ないよ');config.restore(clone(saved));dialog.close();});
  add('あいことばを だす',()=>{if(!saved)throw Error('まだ きろくが ないよ');input.value=store.encode(saved);input.focus();input.select();note.textContent='ぜんぶ コピーして メモに のこしてね。';});
  add('コピー',async()=>{if(!input.value)return;input.focus();input.select();if(root.navigator?.clipboard)await root.navigator.clipboard.writeText(input.value);else note.textContent='えらばれた あいことばを コピーしてね。';});
  add('いれた きろくで つづける',()=>{const data=store.decode(input.value);config.restore(data);saved=config.capture(data)||data;store.save(saved);last=JSON.stringify(saved);dialog.close();});
  add('とじる',()=>dialog.close());dialog.addEventListener('close',()=>{busy=false;dialog.remove();dialog=null;if(config.unpause)config.unpause();capture();});document.body.appendChild(dialog);dialog.showModal();
 };
 const timer=setInterval(capture,config.interval||1000);root.addEventListener('pagehide',capture);document.addEventListener('click',()=>setTimeout(capture,0));document.addEventListener('visibilitychange',()=>{if(document.hidden)capture();});
 return {capture,store,get saved(){return saved;},stop(){clearInterval(timer);}};
}
root.HGSave={create,mount,safeTree,clone};if(typeof module!=='undefined'&&module.exports)module.exports=root.HGSave;
})(typeof globalThis!=='undefined'?globalThis:this);
