const fs=require('fs'),vm=require('vm'),assert=require('assert');
const html=fs.readFileSync(__dirname+'/index.html','utf8'),source=fs.readFileSync(__dirname+'/source.html','utf8').replace(/\r\n/g,'\n');let assertions=0;
function ok(x,msg){assert(x,msg);assertions++;}
const ids={},listeners={},timers=new Map();let timerID=0;
class Element{
 constructor(tag='div',id=''){this.tagName=tag.toUpperCase();this.id=id;this.dataset={};this.style={setProperty(){}};this.attributes={};this.children=[];this.parentNode=null;this._classes=new Set();this._html='';this.textContent='';this.isConnected=true;this.scrollLeft=0;this.scrollWidth=400;this.clientWidth=300;this.disabled=false;this.classList={add:(...x)=>x.forEach(v=>this._classes.add(v)),remove:(...x)=>x.forEach(v=>this._classes.delete(v)),contains:x=>this._classes.has(x),toggle:(x,v)=>{v=v===undefined?!this._classes.has(x):v;if(v)this._classes.add(x);else this._classes.delete(x);return v;}};}
 set className(x){this._classes=new Set(x.split(/\s+/).filter(Boolean));}get className(){return [...this._classes].join(' ')}
 set innerHTML(x){this._html=x;this.children=[];}get innerHTML(){return this._html;}
 setAttribute(k,v){this.attributes[k]=String(v);}getAttribute(k){return this.attributes[k];}
 appendChild(x){x.parentNode=this;this.children.push(x);return x;}removeChild(x){this.children=this.children.filter(v=>v!==x);x.isConnected=false;}
 addEventListener(type,fn){(this.events??={})[type]=fn;}
 showModal(){this.open=true;}close(){this.open=false;}select(){}focus(){document.activeElement=this;}click(){if(this.disabled)return;if(this.onclick)return this.onclick({target:this});}
 querySelector(s){return this.querySelectorAll(s)[0]||null;}
 querySelectorAll(s){let all=this.children.flatMap(c=>[c,...c.querySelectorAll('*')]);if(s==='*')return all;if(s.includes('button'))return all.filter(c=>c.tagName==='BUTTON'&&!c.disabled);return all.filter(c=>s.startsWith('.')&&c.classList.contains(s.slice(1)));}
 closest(s){if(s==='[data-card-name]')return this.dataset.cardName?this:this.parentNode?.closest(s)||null;return null;}
 getBoundingClientRect(){return {left:0,top:0,width:100,height:100};}cloneNode(){let c=new Element();c.innerHTML=this.innerHTML;return c;}
}
for(const m of html.matchAll(/<([\w-]+)\b([^>]*\bid="([^"]+)"[^>]*)>/g)){const e=new Element(m[1],m[3]);e.className=m[2].match(/class="([^"]*)"/)?.[1]||'';ids[e.id]=e;}
const screens=Object.values(ids).filter(e=>e.classList.contains('screen'));
const steps=['draw','charge','play','battle'].map(p=>{const e=new Element();e.className='phase-step';e.dataset.phase=p;return e;});
for(const c of ['mcb-icon','mcb-name','mcb-stats']){const e=new Element();e.className=c;ids['modal-card-big'].appendChild(e);}
ids['modal-box'].appendChild(ids['modal-buttons']);ids['inspect-box'].appendChild(ids['inspect-close']);
const document={activeElement:null,body:new Element('body'),getElementById:id=>{if(!ids[id])throw Error('Unknown ID '+id);return ids[id];},createElement:t=>new Element(t),querySelectorAll:s=>s==='.screen'?screens:s==='.phase-step'?steps:[],querySelector:s=>s==='.screen:not(.hidden)'?screens.find(x=>!x.classList.contains('hidden')):null,addEventListener:(t,f,o)=>(listeners[t]??=[]).push({f,o})};
const ctx={document,console,Math:Object.assign(Object.create(Math),{random:()=>0}),Date,Promise,setTimeout:(f,ms)=>{timers.set(++timerID,{f,ms});return timerID},clearTimeout:id=>timers.delete(id),requestAnimationFrame:f=>f(),matchMedia:()=>({matches:true}),location:{},window:null,self:null};ctx.window=ctx;ctx.self=ctx;ctx.addEventListener=()=>{};vm.createContext(ctx);
let scripts=[...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(x=>x[1]);
scripts=scripts.map(s=>s.includes('// ==== app.js ====')?s.replace('  // 初期画面',"  window.__animalTest={state:function(){return gameState;},openInspect:openInspect,closeInspect:closeInspect,render:render,showScreen:showScreen,animalName:animalName,renderHand:renderHand};\n  // 初期画面"):s);
for(const s of scripts){new vm.Script(s);vm.runInContext(s,ctx);}
const api=ctx.__animalTest;
ok(!!api,'UI initialization');ok(!ids['screen-title'].classList.contains('hidden'),'Title visible');ok((ids['title-art'].innerHTML.match(/class="showcard"/g)||[]).length===3,'Title uses3 real card pictures');
ids['btn-vs-cpu'].click();ok(!ids['screen-janken'].classList.contains('hidden'),'CPU selection');ids['btn-janken-go'].click();ids['btn-janken-go'].click();ok(!ids['screen-game'].classList.contains('hidden'),'Battle begins');
let gs=api.state();ok(gs.phase==='charge','First charge phase');ok(ids['hand-scroll'].children.length===gs.players[0].hand.length,'Every hand card renders');
let card=ids['hand-scroll'].children[0];ok(card.attributes['aria-label'].includes('こうげき'),'Card accessible labels');ok(card.innerHTML.includes('animal-art'),'Generated art on hand');card.click();ok(!ids['modal-overlay'].classList.contains('hidden'),'Action dialog opens');ok(document.activeElement===ids['modal-buttons'].children[0],'Action dialog focus');
const oldHand=gs.players[0].hand.length;ids['modal-buttons'].children[0].click();ok(gs.players[0].hand.length===oldHand-1,'Charge action remains functional');ok(ids['modal-overlay'].classList.contains('hidden'),'Action dialog closes');
function emit(t,e={}){e.preventDefault??=()=>{e.prevented=true};e.stopImmediatePropagation??=()=>{e.stopped=true};for(const {f}of listeners[t]||[])f(e);return e;}
card=ids['hand-scroll'].children[0];const unchanged=JSON.stringify(gs);emit('pointerdown',{button:0,clientX:0,clientY:0,pointerId:1,target:card});let hold=[...timers].find(([,t])=>t.ms===450);ok(!!hold,'Long press scheduled');timers.delete(hold[0]);hold[1].f();ok(!ids['inspect-overlay'].classList.contains('hidden'),'Long press opens read-only details');ok(JSON.stringify(gs)===unchanged,'Inspect does not change battle');ok(document.activeElement===ids['inspect-close'],'Inspect focus');let ce=emit('click',{target:card});ok(ce.stopped&&ce.prevented,'Long press suppresses summon/attack click');emit('keydown',{key:'Escape'});ok(ids['inspect-overlay'].classList.contains('hidden'),'Escape closes details');
emit('pointerdown',{button:0,clientX:0,clientY:0,pointerId:2,target:card});emit('pointermove',{pointerId:2,clientX:30,clientY:0});ok(![...timers.values()].some(t=>t.ms===450),'Swipe cancels long press');
api.openInspect(gs.players[0].hand[0]);api.showScreen('screen-pass');ok(ids['inspect-overlay'].classList.contains('hidden'),'Pass screen hides private card details');
api.showScreen('screen-game');ids['btn-main-action'].click();if(!ids['modal-overlay'].classList.contains('hidden'))ids['modal-buttons'].children[0].click();ok(gs.phase==='play','Advance to summon phase');
for(const c of ctx.Engine.CARD_POOL_V3){api.openInspect(c);ok(ids['inspect-title'].textContent!==c.name,'Friendly unique animal name');ok(ids['inspect-picture'].innerHTML.includes('animal-art'),'Art in every detail');api.closeInspect();}
const pool=ctx.Engine.CARD_POOL_V3,map=ctx.ANIMAL_ART;ok(Object.keys(map).length===24,'24 art assignments');ok(new Set(Object.values(map).map(a=>a.pixelHash)).size===24,'24 unique drawings');
for(const marker of ['// ==== ai.js ====','// ==== engine.js ====']){let block=s=>s.slice(s.indexOf(marker),s.indexOf('</script>',s.indexOf(marker))).trim();ok(block(source)===block(html),'Core unchanged '+marker);}
ok(html.includes('<!-- HOME_BUTTON -->'),'Home button retained');ok(!html.includes('user-scalable=no'),'Browser text zoom enabled');
console.log('UI checks PASS: '+assertions);fs.writeFileSync(__dirname+'/ui-test-result.json',JSON.stringify({passed:assertions,environment:'Node with DOM/event stubs; no browser visual QA'},null,2));

// Exercise the actual private LAN client inside the same app, with two independently
// authenticated seats and a lost response after an accepted charge.
async function checkLan(){
 const service=require('./lan-server').createServer();
 const nonce=()=>require('crypto').randomBytes(20).toString('hex');
 ctx.crypto=require('crypto').webcrypto;ctx.Uint8Array=Uint8Array;ctx.AbortController=AbortController;ctx.URL=URL;
 ctx.setInterval=()=>1;ctx.clearInterval=()=>{};ctx.location={hostname:'127.0.0.1',port:'8771',protocol:'http:',hash:''};
 let drop=false;
 ctx.fetch=async(url,options)=>{const data=JSON.parse(options.body);try{const v=service.request(data);if(drop&&data.op==='action'){drop=false;throw Error('lost response');}return {ok:true,status:200,json:async()=>JSON.parse(JSON.stringify(v))};}catch(e){if(!e.status)throw e;return{ok:false,status:e.status,json:async()=>({error:e.message})};}};
 let app=scripts.find(s=>s.includes('// ==== app.js ===='));
 app=app.replace('  // 初期画面',"window.__lanTest={enter:enterLan,poll:pollLan,leave:leaveLan,send:sendLan,state:()=>gameState,session:()=>online,interactive:isMyInteractiveTurn};\n  // 初期画面");
 app=app.replace('window.__lanTest={enter:', 'window.__lanTest={normalize:normalizeHomeUrl,open:openLan,home:homeHostFromHash,enter:');
 vm.runInContext(app,ctx);const lan=ctx.__lanTest;
 for(const input of ['192.168.0.50','192.168.0.50:8771','http://192.168.0.50:8771/'])ok(lan.normalize(input)==='http://192.168.0.50:8771/#lan','Home URL normalization');
 ok(lan.normalize('')===''&&lan.normalize('javascript:alert(1)')==='','Invalid address rejected');
 ctx.location={hostname:'public.example',protocol:'https:',port:'',hash:'#home=192.168.0.50%3A8771'};lan.open();
 ok(!ids['lan-home-wrap'].hidden&&ids['lan-create'].hidden,'Public site shows home entry');ok(ids['lan-home-address'].value==='192.168.0.50:8771','Bookmark prefill');
 ids['lan-home-go'].click();ok(ctx.location.href==='http://192.168.0.50:8771/#lan','Public entry navigates to LAN');ok(ctx.location.hash==='home=192.168.0.50%3A8771','Home address retained in URL');
 ctx.location.hash='#home=%ZZ';ok(lan.home()==='','Malformed bookmark handled');
 ctx.location={hostname:'127.0.0.1',port:'8771',protocol:'http:',hash:''};lan.open();ok(ids['lan-home-wrap'].hidden&&!ids['lan-create'].hidden,'LAN page keeps room entry');
 ids['lan-code'].value='';await lan.enter('create');
 ok(!ids['screen-lan-wait'].classList.contains('hidden'),'Waiting screen');
 const session=lan.session(),guest=service.request({op:'join',room:session.room,requestId:nonce()});await lan.poll();
 ok(!ids['screen-game'].classList.contains('hidden'),'Joined battle renders');ok(lan.state().players[1].hand.every(c=>c===null),'Opponent hidden in UI');
 if(lan.state().acting===1){for(const action of ['play','battle','end']){const v=service.request({op:'state',room:session.room,token:guest.token});service.request({op:'action',room:session.room,token:guest.token,rev:v.rev,action,command:nonce()});}await lan.poll();}
 ok(lan.interactive(),'Host turn enabled');const before=lan.state().players[0].hand.length;
 drop=true;ids['hand-scroll'].children[0].click();ids['modal-buttons'].children[0].click();await new Promise(r=>setImmediate(r));
 ok(!!lan.session().pending&&!lan.interactive(),'Lost response blocks extra actions');await lan.poll();
 ok(!lan.session().pending&&lan.interactive(),'Retry restores controls');ok(lan.state().players[0].hand.length===before-1,'Charge applied exactly once');
 const secret=session.room+'.'+session.token;lan.leave();ids['lan-code'].value=secret;await lan.enter('resume');ok(lan.state().players[0].hand.length===before-1,'Client resumes existing hand');
 lan.leave();ids['btn-vs-human'].click();ids['btn-janken-go'].click();ids['btn-janken-go'].click();ok(!ids['screen-pass'].classList.contains('hidden'),'Hotseat still uses privacy pass screen');
 service.server.close();console.log('UI + LAN client PASS: '+assertions);
}
checkLan().catch(e=>{console.error(e);process.exitCode=1;});
