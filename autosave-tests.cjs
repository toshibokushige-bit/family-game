const fs=require('fs'),vm=require('vm'),assert=require('assert/strict');
const root=__dirname,read=p=>fs.readFileSync(root+'/'+p,'utf8'),Save=require('./shared/autosave');let count=0;
const ok=(x,m)=>{assert(x,m);count++;};
const memory=new Map(),storage={getItem:k=>memory.get(k)||null,setItem:(k,v)=>memory.set(k,v)};
for(const game of ['quest','ranger','dash','cards','team-battle','survivors']){
 const s=Save.create(game,d=>d&&Number.isInteger(d.n)&&d.n>=0,()=>storage),data={n:3};ok(s.save(data),'save '+game);assert.deepEqual(s.load(),data);assert.deepEqual(s.decode(s.encode(data)),data);count+=2;
 assert.throws(()=>s.decode(s.encode(data)+'x'));assert.throws(()=>s.decode(Save.create('other',()=>true,()=>storage).encode(data)));count+=2;
 memory.set(s.key,'{"version":99}');ok(s.load()===null,'unknown version');memory.set(s.key,'{bad');ok(s.load()===null,'broken JSON');
 const bad=Save.create(game,()=>true,()=>{throw Error('blocked');});ok(bad.load()===null&&!bad.save(data),'storage unavailable');
 assert.throws(()=>s.encode(JSON.parse('{"n":3,"__proto__":{}}')));count++;
}
ok(memory.size===6,'keys isolated');
// The real mount path: write after a change, reload progress, and survive a quota error.
{
 const handlers={},elements=[],timers=[];function el(){const e={style:{},textContent:'',setAttribute(){},appendChild(){},addEventListener(){}};elements.push(e);return e;}
 const ctx={console,localStorage:storage,document:{body:{appendChild(){}},createElement:el,addEventListener:(k,f)=>handlers[k]=f},addEventListener:(k,f)=>handlers[k]=f,setInterval:f=>{timers.push(f);return 1;},clearInterval(){},setTimeout:f=>f()};vm.createContext(ctx);vm.runInContext(read('shared/autosave.js'),ctx);
 let value=7,loaded=0;const config={validate:d=>d&&Number.isInteger(d.n),capture:()=>({n:value}),progress:d=>loaded=d.n,restore(){}};
 ctx.HGSave.mount('mount-test',config);handlers.pagehide();ok(JSON.parse(memory.get('higashiyama:mount-test:v1')).data.n===7,'pagehide writes');value=9;timers[0]();ctx.HGSave.mount('mount-test',config);ok(loaded===9,'mount reloads latest progress');ctx.localStorage={getItem(){throw Error('blocked');},setItem(){throw Error('quota');}};const m=ctx.HGSave.mount('quota-test',config);m.capture();ok(!!m.store.issue,'quota reported without crashing');
}
function stubs(game){const s=read('games/'+game+'/run_sim.js').match(/const STUBS = `([\s\S]*?)`;/)[1];return Function('return `'+s+'`')();}
function gameAdapter(id,setup,tests){let html=read('games/'+id+'/index.html'),game=[...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m=>m[1]).join('\n');
 game=game.replace('function mount(game,config){','function mount(game,config){if(globalThis.__adapterTest){globalThis.adapters[game]=config;return {capture(){return config.capture(null);}};}');
 const context={console,performance,innerWidth:1000,innerHeight:700,location:{hash:'',hostname:'localhost',origin:'http://localhost',reload(){}},navigator:{},__adapterTest:true,adapters:{},__SIM__:true,ok,assert};
 vm.runInNewContext(stubs(id==='quest'?'quest':'survivors')+'\nwindow.addEventListener=()=>{};\n'+setup+'\n'+game+'\n'+tests,context,{timeout:20000});console.log('PASS adapter '+id);
}
gameAdapter('quest','',`
newRun('kento');const a=adapters.quest,d=a.capture(null);ok(a.validate(d),'quest checkpoint valid');ok(d.run.s.combat===null,'quest map checkpoint');const gold=S.gold;S.gold=0;a.restore(d);ok(S.gold===gold&&S.ch===CHARS.kento,'quest restores character and resources');
const bad=HGSave.clone(d);bad.run.s.deck[0].id='missing';ok(!a.validate(bad),'quest rejects unknown card');a.progress({c1:[true,false,false,false,false],c2:[false,false,false,false,false]});ok(CLEARED1[0],'quest record union');
`);
gameAdapter('survivors','',`
newGame();state='play';const a=adapters.survivors,d=a.capture(null);ok(a.validate(d),'survivors current run valid');const hp=G.hp;G.hp=1;a.restore(d);ok(G.hp===hp&&state==='pause','survivors resumes paused');const bad=HGSave.clone(d);bad.run.g.char='missing';ok(!a.validate(bad),'survivors bad char');
`);
gameAdapter('dash','',`
const a=adapters.dash;Game.newGame();const d=a.capture(null);ok(a.validate(d),'dash valid');Game.familyLv=5;const e=a.capture(d);a.restore(e);ok(Game.familyLv===5&&Game.state==='select','dash restores progress');ok(!a.validate({...e,stage:99}),'dash rejects invalid stage');
`);
gameAdapter('ranger','',`
const a=adapters.ranger;Save.coins=123;Save.stars[0]=3;const d=a.capture(null);ok(a.validate(d),'ranger valid');Save.coins=0;a.restore(d);ok(Save.coins===123&&Save.stars[0]===3,'ranger coins and stars');ok(!a.validate({...d,lv:[999]}),'ranger bad levels');
`);
const E=require('./games/cards/engine');
function isolatedAdapter(id,vars){let config;const ctx={...vars,console,location:{origin:'http://localhost',hash:'',reload(){}},HGSave:{clone:Save.clone,mount:(id,c)=>{config=c;return {};}}};vm.createContext(ctx);vm.runInContext(read('games/'+id+'/autosave.js'),ctx);return {ctx,config};}
{
 const Team=require('./games/team-battle/engine').Engine,g=new Team(123,0),{ctx,config}=isolatedAdapter('team-battle',{Engine:Team,g,online:null,render(){},screen:'prep',difficulty:1,leader:0,modal:null,fx:null,undoState:null,selected:null});const d=config.capture(null);ok(config.validate(d),'team checkpoint valid');ctx.g=null;config.restore(d);ok(JSON.stringify(ctx.g.checkpoint())===JSON.stringify(g.checkpoint()),'team adapter restores shop');ok(!config.validate({})&&!config.validate({run:{version:99},lan:null}),'team bad data');
 const lan={run:null,lan:{origin:'http://elsewhere',room:'123456',token:'a'.repeat(48)}};assert.throws(()=>config.restore(lan));count++;
}
function make(){const r=E.makeRng(77),s=E.newGame(E.buildDeck(E.CARD_POOL_V3,20,r,2),E.buildDeck(E.CARD_POOL_V3,20,r,2),0,r,['human','human']);s.skillsEnabled=true;E.beginTurn(s);return s;}
let state=make();const restored=E.restore(E.serialize(state));assert.deepEqual(E.serialize(restored),E.serialize(state));count++;ok(state.rng.next()===restored.rng.next(),'cards RNG continuation');
{
 const {ctx,config}=isolatedAdapter('cards',{Engine:E,online:null,gameState:state,mode:'cpu',humanIdx:0,tut:null,ui:{},Sound:{resume(){}},showScreen(){},render(){}});const d=config.capture(null);ok(config.validate(d),'cards adapter valid');ctx.gameState=null;config.restore(d);ok(ctx.gameState.phase===state.phase&&ctx.gameState.skillsEnabled,'cards resumes with traits');ok(!config.validate({}),'cards missing schema');
}
const bad=E.serialize(state);bad.players[0].hand[0].hp=999;assert.throws(()=>E.restore(bad));count++;
function mon(name,damage=0){return {card:E.CARD_POOL_V3.find(c=>c.name===name),damage,enteredPly:0};}
state=make();state.players[0].field=[mon('C-バランス')];state.players[0].field[0].enteredPly=state.ply;E.advanceToBattle(state);ok(E.canAttack(state,state.players[0].field[0]),'haste');
E.endTurn(state);ok(E.restore(E.serialize(state)).battleRemaining.length===0,'Ending with unused attacks still saves the next turn');
state=make();const attack=mon('UC-攻撃型'),shell=mon('UC-かたい');state.players[0].field=[attack];state.players[1].field=[shell];E.advanceToBattle(state);const preview=E.previewAttack(state,attack,shell),res=E.attack(state,attack,shell);ok(res.dmg===preview&&shell.shellUsed,'pierce and shell agree with preview');
state=make();state.players[0].field=[mon('C-体力型',2)];E.beginTurn(state);ok(state.players[0].field[0].damage===1,'heal at turn start');
state=make();const pack=mon('C-よわい');state.players[0].field=[pack,mon('C-バランス')];ok(E.previewAttack(state,pack,mon('C-体力型'))===4,'pack bonus');const fury=mon('UC-とっこう',1);ok(E.previewAttack(state,fury,mon('C-体力型'))===6,'wounded bonus');
for(const c of E.CARD_POOL_V3)ok(!!E.skillText(c),'ability '+c.name);
// Every human checkpoint round-trips while playing full games with traits enabled.
let wins=[0,0],draws=0;
for(let match=0;match<100;match++){const rng=E.makeRng(match+100),s=E.newGame(E.buildDeck(E.CARD_POOL_V3,20,rng,2),E.buildDeck(E.CARD_POOL_V3,20,rng,2),match%2,rng);s.skillsEnabled=true;E.beginTurn(s);let n=0;
 while(s.phase!=='gameover'&&n++<300){E.restore(E.serialize(s));while(E.canChargeMore(s))if(!E.aiChargeStep(s))break;E.advanceToPlay(s);for(const a of E.aiDecidePlayActions(s)){E.applyPlayAction(s,a);if(s.phase==='gameover')break;}if(s.phase==='gameover')break;E.advanceToBattle(s);let k=0;while(s.phase==='battle'&&k++<10){if(E.aiBattleStep(s).done)break;}if(s.phase!=='gameover')E.endTurn(s);}
 ok(s.phase==='gameover','skills game completed');if(s.winner===null)draws++;else wins[s.winner]++;
}
console.log('PASS autosave / traits: '+count+' checks; 100 trait games; winners '+wins+'; draws '+draws);
