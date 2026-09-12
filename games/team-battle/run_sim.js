'use strict';
const assert=require('assert/strict'),fs=require('fs'),vm=require('vm');
const html=fs.readFileSync(__dirname+'/index.html','utf8');
const scripts=[...html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)].map(m=>m[1]);
const mod={exports:{}};new Function('module',scripts[0])(mod);const {Engine,CARDS}=mod.exports;
let checks=0;function test(name,f){f();checks++;console.log('PASS '+name);}
test('購入・売却・経済・配置',()=>{const e=new Engine(4),p=e.players[0];assert(e.buy(p,0));assert.equal(p.gold,0);assert(!e.buy(p,1));const u=p.board[0];assert(e.place(p,u.uid,'bench',2));assert.equal(p.board.length,0);assert.equal(p.bench[0].uid,u.uid);assert(e.sell(p,u.uid));assert.equal(p.gold,1);assert(!e.sell(p,u.uid));});
test('3枚合成は強化を保持し上位3択を付与',()=>{const e=new Engine(2),p=e.players[0];for(let i=0;i<3;i++){const u=e.unit(0);u.a+=2;e.add(p,u);}assert.equal(p.board.length,1);assert(p.board[0].star);assert.equal(p.board[0].a,CARDS[0].a*2+6);assert.equal(new Set(p.rewards[0]).size,3);assert(p.rewards[0].every(id=>CARDS[id].tier===2));assert(e.reward(p,1));assert.equal(p.board.length,2);});
test('キープと成長費用、戦闘ダメージのリセット',()=>{const e=new Engine(11),p=e.players[0];e.buy(p,0);p.freeze=true;const shop=p.shop.slice(),board=JSON.stringify(p.board);e.fight();assert.equal(JSON.stringify(p.board),board);e.next();for(let i=0;i<4;i++)if(shop[i]!==null)assert.equal(p.shop[i],shop[i]);assert.equal(p.gold,4);assert.equal(e.cost(p),4);assert(e.upgrade(p));assert.equal(p.tier,2);});
test('満員時の購入・報酬拒否',()=>{const e=new Engine(7),p=e.players[0];for(let i=0;i<8;i++)e.add(p,e.unit(i));p.gold=10;assert(!e.buy(p,0));p.rewards=[[6,7,8]];assert(!e.reward(p,0));assert.equal(p.rewards.length,1);});
test('召喚と戦闘上限・原本を破壊しない',()=>{const e=new Engine(71),a=e.players[0],b=e.players[1];a.board=[e.unit(0),e.unit(4)];b.board=[e.unit(7),e.unit(9)];const original=JSON.stringify(a.board);const r=e.battle(a,b);assert(r.frames.length>2);assert(r.frames.every(f=>f.sides.every(s=>s.length<=5)));assert.equal(JSON.stringify(a.board),original);});
let rounds=0,ghosts=0,ranks=Array(8).fill(0),limits=0;
test('300試合の8人自動対戦・順位・終了・組み合わせ・上限',()=>{for(let seed=1;seed<=300;seed++){const e=new Engine(seed,seed%5);let count=0;while(e.phase!=='end'){if(e.phase==='result')e.next();const living=e.players.filter(p=>p.hp>0).map(p=>p.id);const assigned=e.pairs.flat().filter(x=>x>=0);assert.deepEqual(assigned.slice().sort(),living.slice().sort());assert.equal(new Set(assigned).size,assigned.length);ghosts+=e.pairs.filter(p=>p[1]<0).length;if(e.players[0].hp>0)e.ai(e.players[0]);e.fight();limits+=e.results.filter(r=>r.limited).length;for(const p of e.players){assert(p.gold>=0);assert(p.board.length<=5&&p.bench.length<=3);assert(p.board.every(u=>Number.isFinite(u.a)&&u.h>0));}assert(++count<=20);}assert.deepEqual(e.players.map(p=>p.rank).sort((a,b)=>a-b),[1,2,3,4,5,6,7,8]);ranks[e.players[0].rank-1]++;rounds+=count;}});
test('全画面・モーダルの描画と実UIクリック',()=>{const noop=()=>{},context=new Proxy({createLinearGradient:()=>({addColorStop:noop})},{get:(o,k)=>o[k]||noop,set:(o,k,v)=>(o[k]=v,true)});const canvas={getContext:()=>context,style:{},addEventListener:noop};const box={replaceChildren:noop};const sandbox={console,structuredClone,setTimeout:()=>1,clearTimeout:noop,innerWidth:960,innerHeight:540,addEventListener:noop,document:{getElementById:id=>id==='game'?canvas:box,createElement:()=>({})}};vm.createContext(sandbox);scripts.forEach(s=>vm.runInContext(s,sandbox));vm.runInContext(`start();for(const m of ['help','ranks','opponent']){modal=m;render();}modal={shop:0};render();modal=null;g.buy(g.players[0],0);render();g.players[0].rewards=[[6,7,8]];modal='reward';render();modal=null;showFight();screen='result';render();next();screen='finish';g.players[0].rank=4;render();screen='title';render();`,sandbox);});
test('戦闘演出は攻撃→実ダメージ→退場の順で、最後まで記録する',()=>{
 let types=new Set();
 for(let seed=1;seed<=70;seed++){
  const e=new Engine(seed),a=e.players[0],b=e.players[1];
  a.leader=2;b.leader=3;a.board=[e.unit(0),e.unit(4),e.unit(1),e.unit(2),e.unit(3)];b.board=[e.unit(6),e.unit(7),e.unit(8),e.unit(9),e.unit(10)];
  const r=e.battle(a,b);assert.equal(r.frames[0].type,'start');assert.equal(r.frames.at(-1).type,'end');assert.deepEqual(r.frames.at(-1).sides,r.sides);
  r.frames.forEach((f,i)=>{types.add(f.type);assert(f.duration>0);assert(f.sides.every(s=>s.length<=5));for(const focus of f.focus||[])assert(f.sides[focus.side].some(u=>u.uid===focus.uid));if(f.type==='damage'){assert.equal(r.frames[i-1].type,'attack');for(const n of f.numbers){const old=r.frames[i-1].sides[n.side].find(u=>u.uid===n.uid),now=f.sides[n.side].find(u=>u.uid===n.uid);assert.equal(now.h,old.h+n.value);}}});
 }
 for(const type of ['attack','damage','death','summon','buff','ability','end'])assert(types.has(type));
});
test('購入・合成演出の完了後に操作が戻り、一時停止中は進まない',()=>{
 const noop=()=>{},context=new Proxy({createLinearGradient:()=>({addColorStop:noop})},{get:(o,k)=>o[k]||noop,set:(o,k,v)=>(o[k]=v,true)});
 const canvas={getContext:()=>context,style:{},addEventListener:noop},box={replaceChildren:noop};
 const sandbox={console,structuredClone,setTimeout:()=>1,clearTimeout:noop,innerWidth:844,innerHeight:390,addEventListener:noop,document:{hidden:false,getElementById:id=>id==='game'?canvas:box,createElement:()=>({})},assert};
 vm.createContext(sandbox);scripts.forEach(s=>vm.runInContext(s,sandbox));
 vm.runInContext(`
 start();g.players[0].shop=[0,0,0,1];g.players[0].gold=10;
 purchase(0);assert.equal(g.players[0].gold,7);assert.equal(fx.type,'buy');assert.equal(buttons.length,0);
 fxAge=960;render();assert.equal(fx,null);assert(buttons.some(b=>b.label==='じゅんび OK →'));
 purchase(1);fxAge=960;render();purchase(2);assert.equal(fx.type,'merge');assert.equal(g.players[0].board.length,1);assert(g.players[0].board[0].star);
 fxAge=1510;render();assert.equal(fx,null);assert(buttons.length>0);
 showFight();paused=true;let initial=frame;animate(100);animate(150);assert.equal(frame,initial);assert.equal(elapsed,0);
 paused=false;modal='help';animate(200);assert.equal(elapsed,0);modal=null;
 for(let i=0;i<replay.frames.length;i++){frame=i;elapsed=replay.frames[i].duration/2;render();}
 frame=0;elapsed=0;animate(250);assert(elapsed>0);
 buttons.find(b=>b.label==='けっかへ →').fn();assert.equal(screen,'result');animate(300);assert.equal(screen,'result');
 `,sandbox);
});

console.log(`GATE: ALL PASS (${checks} groups). Mean rounds ${(rounds/300).toFixed(1)}, ghost matches ${ghosts}, capped battles ${limits}, human-policy ranks ${ranks.join(',')}`);

require('./release_tests.js');

require('./endgame_tests.js');
