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
 function capture(){if(busy)return saved;try{const value=config.capture(saved&&clone(saved));if(value){const raw=JSON.stringify(value);if(raw!==last){if(!safeTree(value)||!config.validate(value))return saved;saved=clone(value);store.save(saved);last=raw;}}}catch(e){/* Keep the last valid checkpoint during transitions. */}
 if(button)button.textContent=store.issue?'⚠ ほぞん':'💾 きろく・つづき';
 if(homeMark)homeMark.textContent=store.issue?' ⚠':'';    // ほぞんできない ときだけ しるしを だす
 return saved;}
 /* ひだりうえの「ゲームセンター」ボタンに メニューを まとめる。
    みぎしたに ボタンを おくと、ゲームの そうさボタン(だす・たたかう など)と
    かさなって しまうため。ホームのリンクが みつからない ときだけ、
    ほけんとして みぎしたの ボタンを つくる。 */
 const byId=id=>{try{return typeof document.getElementById==='function'?document.getElementById(id):null;}catch(e){return null;}};
 let button=null,homeMark=null,homeLink=null,homeHref='../../index.html',homeOrig=null;
 /* ホームのリンクは ページの いちばん さいごに おかれる ゲームが おおく、
    スクリプトの じっこうじには まだ そんざいしない。DOMが そろってから むすびつける。
    ※ここに body の とじタグを かくと inject_home.py が ごにんしきするので かかない */
 function attachHome(){
  if(homeLink)return true;
  const el=byId('homeBtn')||byId('home');
  if(!el)return false;
  homeLink=el;homeHref=el.getAttribute('href')||'../../index.html';homeOrig=el.onclick;
  el.onclick=e=>{ if(e&&e.preventDefault)e.preventDefault(); openMenu(); return false; };
  el.setAttribute('aria-haspopup','dialog');
  homeMark=document.createElement('span');homeMark.style.cssText='color:#ffb35c';el.appendChild(homeMark);
  if(button){try{button.remove();}catch(e){}button=null;}
  return true;
 }
 function fallbackButton(){
  if(button||homeLink)return;
  button=document.createElement('button');button.type='button';button.textContent=store.issue?'⚠ ほぞん':'💾 きろく・つづき';
  button.setAttribute('aria-label','じどうほぞん・つづき・あいことば');
  button.style.cssText='position:fixed;right:8px;bottom:calc(8px + env(safe-area-inset-bottom));z-index:100005;min-height:40px;padding:8px 12px;border:2px solid #8eb59d;border-radius:20px;background:#f8fff5;color:#234936;font:14px sans-serif;opacity:.9';
  document.body.appendChild(button);button.onclick=openMenu;
 }
 if(!attachHome()){
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>{if(!attachHome())fallbackButton();});
  else fallbackButton();
 }
 function openMenu(){
  if(dialog)return;
  capture();if(config.pause)config.pause();busy=true;
  dialog=document.createElement('dialog');dialog.style.cssText='max-width:460px;width:calc(100% - 48px);max-height:85svh;overflow:auto;padding:20px;border:2px solid #8eb59d;border-radius:18px;background:#f8fff5;color:#234936;font:16px sans-serif';
  for(const type of ['keydown','keyup','pointerdown','pointerup'])dialog.addEventListener(type,e=>e.stopPropagation());
  const title=document.createElement('h2');title.style.cssText='margin:0 0 8px';dialog.appendChild(title);
  const note=document.createElement('p');dialog.appendChild(note);
  const body=document.createElement('div');dialog.appendChild(body);
  const input=document.createElement('textarea');input.setAttribute('aria-label','バックアップの あいことば');input.rows=4;
  input.style.cssText='box-sizing:border-box;width:100%;user-select:text;font:14px monospace';
  const add=(parent,label,fn,accent)=>{const b=document.createElement('button');b.textContent=label;b.type='button';
   b.style.cssText='display:block;width:100%;min-height:44px;margin-top:8px;font:inherit'+(accent?';border:2px solid #8eb59d;background:#e7f6ec':'');
   b.onclick=async()=>{try{await fn();}catch(e){note.textContent=e.message||'きろくを たしかめてね';}};parent.appendChild(b);return b;};

  function menuView(){
   title.textContent='メニュー';
   note.textContent=store.issue||config.note||'じどうで ほぞんしています。';
   body.replaceChildren();
   add(body,'タイトル画面へ もどる',()=>{ capture(); dialog.close(); if(config.toTitle)config.toTitle(); else root.location.reload(); });
   add(body,'ゲームセンターへ もどる',()=>{ capture(); dialog.close();
    if(homeOrig){ const ev={preventDefault(){},stopPropagation(){},type:'click'};
     if(homeOrig.call(homeLink,ev)===false)return; }      // ゲームがわの かくにんダイアログに まかせる
    root.location.href=homeHref; });
   add(body,'きろく（あいことばを だす）',()=>recordView());
   add(body,'つづき（きろくから もどる）',()=>continueView());
   add(body,'とじる',()=>dialog.close());
  }
  function recordView(){
   title.textContent='きろく';
   if(!saved){note.textContent='まだ きろくが ないよ。';}
   else {input.value=store.encode(saved);note.textContent='ぜんぶ コピーして メモに のこしてね。';}
   body.replaceChildren();body.appendChild(input);
   if(saved){input.focus();input.select();
    add(body,'コピー',async()=>{input.focus();input.select();
     /* クリップボードは つかえない ことが ある(おうちの LANは http なので とくに)。
        しっぱいしても なまの えいごエラーを だささず、てで コピーする ように あんないする。 */
     let done=false;
     try{ if(root.navigator?.clipboard?.writeText){ await root.navigator.clipboard.writeText(input.value); done=true; } }catch(e){}
     if(!done){ try{ done=!!(document.execCommand&&document.execCommand('copy')); }catch(e){} }
     note.textContent=done?'コピーしたよ。メモに のこしてね。':'えらんである あいことばを、ながおしして コピーしてね。';
     input.focus();input.select();},true);}
   add(body,'もどる',()=>menuView());
  }
  function continueView(){
   title.textContent='つづき';
   note.textContent='ほぞんした つづきから さいかいするか、あいことばを いれてね。';
   input.value='';body.replaceChildren();
   add(body,'ほぞんした つづきから',()=>{if(!saved)throw Error('まだ きろくが ないよ');config.restore(clone(saved));dialog.close();},true);
   body.appendChild(input);
   add(body,'いれた きろくで つづける',()=>{const data=store.decode(input.value);config.restore(data);saved=config.capture(data)||data;store.save(saved);last=JSON.stringify(saved);dialog.close();});
   add(body,'もどる',()=>menuView());
  }
  menuView();
  dialog.addEventListener('close',()=>{busy=false;dialog.remove();dialog=null;if(config.unpause)config.unpause();capture();});
  document.body.appendChild(dialog);dialog.showModal();
 }
 const timer=setInterval(capture,config.interval||1000);root.addEventListener('pagehide',capture);document.addEventListener('click',()=>setTimeout(capture,0));document.addEventListener('visibilitychange',()=>{if(document.hidden)capture();});
 return {capture,store,get saved(){return saved;},stop(){clearInterval(timer);}};
}
root.HGSave={create,mount,safeTree,clone};if(typeof module!=='undefined'&&module.exports)module.exports=root.HGSave;
})(typeof globalThis!=='undefined'?globalThis:this);
