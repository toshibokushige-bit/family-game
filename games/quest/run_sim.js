#!/usr/bin/env node
/* =====================================================================
   ひがしやまクエスト v2 検証ゲート (run_sim.js)
   ---------------------------------------------------------------------
   index.html の <script> を抽出し、DOM/AudioContext をスタブした
   ヘッドレス環境でゲームロジックを実行して自動検証する。

     node run_sim.js

   ぜんこうもく PASS でないと exit code 1（= push 禁止）。

   けんしょう項目:
     - <script> の構文チェック（Function 構築時に SyntaxError なら失敗）
     - あいことば v2: 1024パターン(10bit)往復一致 / 改ざん拒否 / 旧3文字互換
     - カード92枚: desc()整合・CARD_ART網羅
     - ステージ2の敵・やみのまおう(HP220)の定義
     - 新パワー/新カード効果を最小戦闘で単体検証
       (megaton/grand_finale/jido_barrier/kaiten_geri/vibrato/nomikurabe/
        inazuma/kanko_chikara/shippu_mode/drone/yusha_sakazuki/audience)
     - やみのまおう いかりギミック / むずかしいボスの筋力ギミック
     - god-mode 通し(normal/hard/easy)で 28階まで例外なく到達
   ===================================================================== */
"use strict";
const fs = require("fs");
const path = require("path");

const HTML_PATH = path.join(__dirname, "index.html");
const html = fs.readFileSync(HTML_PATH, "utf8");
const m = html.match(/<script>([\s\S]*?)<\/script>/);
if (!m) { console.error("FAIL: <script> ブロックが みつかりません"); process.exit(1); }
const game = m[1];

/* ---- DOM / window / AudioContext スタブ ---- */
const STUBS = `
"use strict";
const NOOP=()=>{};
const styleHandler={get:(t,p)=>(p==='setProperty'||p==='removeProperty'||p==='getPropertyValue')?NOOP:(t[p]!==undefined?t[p]:""), set:(t,p,v)=>{t[p]=v;return true;}};
function FakeEl(id){ this.id=id||""; this._html=""; this.style=new Proxy({},styleHandler); this.dataset={}; this.children=[]; this.className=""; this.textContent=""; this.value="";
  this.classList={_s:new Set(),add(){for(const a of arguments)this._s.add(a);},remove(){for(const a of arguments)this._s.delete(a);},toggle(c){this._s.has(c)?this._s.delete(c):this._s.add(c);},contains(c){return this._s.has(c);}}; }
FakeEl.prototype.appendChild=function(c){this.children.push(c);return c;}; FakeEl.prototype.setAttribute=NOOP; FakeEl.prototype.removeAttribute=NOOP; FakeEl.prototype.addEventListener=NOOP; FakeEl.prototype.removeEventListener=NOOP;
FakeEl.prototype.querySelector=function(){return new FakeEl();}; FakeEl.prototype.querySelectorAll=function(){return [];};
FakeEl.prototype.getContext=function(){return {fillRect:NOOP,drawImage:NOOP,clearRect:NOOP,fillStyle:""};}; FakeEl.prototype.getBoundingClientRect=function(){return {left:0,top:0,width:0,height:0};};
FakeEl.prototype.cloneNode=function(){return new FakeEl(this.id);}; FakeEl.prototype.remove=NOOP; FakeEl.prototype.focus=NOOP; FakeEl.prototype.click=NOOP;
Object.defineProperty(FakeEl.prototype,"innerHTML",{get(){return this._html;},set(v){this._html=v;this.children=[];}}); Object.defineProperty(FakeEl.prototype,"offsetWidth",{get(){return 0;}});
const _els={};
const document={ getElementById:id=>(_els[id]||(_els[id]=new FakeEl(id))), createElement:t=>new FakeEl(t), createTextNode:t=>({nodeType:3,textContent:t}), querySelector:()=>new FakeEl(), querySelectorAll:()=>[], addEventListener:NOOP, body:new FakeEl("body"), documentElement:new FakeEl("html") };
const window={ matchMedia:()=>({matches:false}), AudioContext:function(){return{createGain:()=>({gain:{value:0,setValueAtTime:NOOP,exponentialRampToValueAtTime:NOOP},connect:NOOP}),createOscillator:()=>({type:"",frequency:{setValueAtTime:NOOP,exponentialRampToValueAtTime:NOOP},connect:NOOP,start:NOOP,stop:NOOP}),createBuffer:()=>({getChannelData:()=>new Float32Array(8)}),createBufferSource:()=>({buffer:null,connect:NOOP,start:NOOP}),createBiquadFilter:()=>({type:"",frequency:{value:0},connect:NOOP}),destination:{},currentTime:0,sampleRate:44100,state:"running",resume:NOOP};} };
window.webkitAudioContext=window.AudioContext;
const setInterval=()=>0, clearInterval=NOOP, setTimeout=()=>0, clearTimeout=NOOP, requestAnimationFrame=()=>0; const AudioContext=window.AudioContext;
`;

/* ---- テストスイート（ゲームと同じスコープで実行） ---- */
const SUITE = `
;(function(){
  const results=[]; const ok=(n,c,d)=>results.push({n,pass:!!c,d:d===undefined?"":String(d)});

  /* --- あいことば v2 --- */
  let rt=0;
  for(let f=0;f<1024;f++){ const s1=f&31,s2=(f>>5)&31;
    CLEARED1=[0,1,2,3,4].map(i=>!!(s1&(1<<i))); CLEARED2=[0,1,2,3,4].map(i=>!!(s2&(1<<i)));
    const p=encodePass(); const dd=p.length===4?decodePass(p):null;
    if(!dd||!dd.c1.every((b,i)=>b===CLEARED1[i])||!dd.c2.every((b,i)=>b===CLEARED2[i])) rt++; }
  ok("pass_v2_roundtrip_1024", rt===0, rt+" mismatch");
  CLEARED1=[true,false,true,false,true];CLEARED2=[false,true,false,true,false];
  const good=encodePass();
  ok("pass_tamper_reject", decodePass(good.slice(0,3)+(good[3]==='0'?'1':'0'))===null);
  const fl=0b10101,bodyv="Q"+B36[fl]; let sm=0;for(const ch of bodyv)sm+=ch.charCodeAt(0); const v1=bodyv+B36[sm%36];
  const dv=decodePass(v1);
  ok("pass_v1_compat_3char", !!dv&&dv.c1[0]&&dv.c1[2]&&dv.c1[4]&&!dv.c1[1]&&dv.c2.every(b=>!b));
  ok("pass_bad_reject", decodePass("X12")===null&&decodePass("Q1")===null&&decodePass("Q12345")===null);

  /* --- カード / CARD_ART --- */
  const ma=[],df=[]; Object.keys(CARDS).forEach(id=>{ if(CARD_ART[id]===undefined)ma.push(id);
    try{CARDS[id].desc(Object.assign({},CARDS[id].v));CARDS[id].desc(Object.assign({},CARDS[id].v,CARDS[id].vu||{}));}catch(e){df.push(id);} });
  ok("cards_total_92", Object.keys(CARDS).length===92, Object.keys(CARDS).length+"枚");
  ok("cards_art_complete", ma.length===0, ma.join());
  ok("cards_desc_ok", df.length===0, df.join());
  const newIds=["nusumi_ashi","kaiten_geri","step_renshu","shippu_mode","final_rush","bakuhatsu_nut","kaizo_kyoka","jido_barrier","drone","megaton_bomb","rinsho","vibrato","maho_step","audience","grand_finale","ai_no_hakushu","megane_kirari","cyalume_rain","kanko_chikara","unmei_stage","nomikurabe","yoizamashi","inazuma_tsue","dai_rancho","yusha_sakazuki"];
  ok("cards_new25_present", newIds.filter(id=>!CARDS[id]).length===0, newIds.filter(id=>!CARDS[id]).join());

  /* --- 敵 / 定数 --- */
  ok("enemies_s2_present", ["dsoldier","redwyvern","shadowdemon","dknight","golem","darkmaou"].every(id=>ENEMIES[id]));
  ok("darkmaou_hp220_5moves", ENEMIES.darkmaou.hp[0]===220 && ENEMIES.darkmaou.moves.length===5);
  ok("maxfloor_28", MAX_FLOOR===28, MAX_FLOOR);
  ok("diffs_3", Object.keys(DIFFS).length===3);
  ok("stage_split", stageOf(14)===1 && stageOf(15)===2);
  ok("version_defined", typeof VERSION==="string" && VERSION.length>0, VERSION);

  /* --- ルート分岐マップ --- */
  const pathLen = cols => cols.reduce((n,c)=> n + (c.kind==="single"?1:c.lanes[0].nodes.length), 0);
  const laneBattles = cols => { const a=[]; cols.forEach(c=>{ if(c.kind==="branch") c.lanes.forEach(L=>a.push(L.nodes.filter(n=>n.t==="battle"||n.t==="elite").length)); }); return a; };
  DIFF=DIFFS.normal; const MN=buildMap(1);
  ok("map_pathlen_14", pathLen(MN)===14, pathLen(MN));
  ok("map_first_battle", MN[0].kind==="single" && MN[0].node.t==="battle");
  ok("map_last_boss", MN[MN.length-1].kind==="single" && MN[MN.length-1].node.t==="boss");
  ok("map_3_branches", MN.filter(c=>c.kind==="branch").length===3);
  ok("map_3_lanes_each", MN.filter(c=>c.kind==="branch").every(c=>c.lanes.length===3));
  ok("map_every_lane_2plus_battles", Math.min.apply(null, laneBattles(MN))>=2, "min="+Math.min.apply(null, laneBattles(MN)));
  DIFF=DIFFS.hard; const MH=buildMap(1);
  ok("map_hard_pathlen_14", pathLen(MH)===14);
  ok("map_hard_fewer_camps", MH[2].node.t==="event" && MN[2].node.t==="rest");
  ok("map_hard_lanes_2plus", Math.min.apply(null, laneBattles(MH))>=2);
  DIFF=DIFFS.normal;
  /* マップ ポインタ 走破（レーン0を えらび つづけて ボスに とうたつ） */
  (function(){
    newRun("kento"); const M=S.map; let steps=0, reached=false;
    while(steps++<80){ const col=M.cols[M.ci];
      if(col.kind==="single"){ if(col.node.t==="boss"){ reached=true; break; } col.node.done=true; M.ci++; M.lane=-1; M.li=0; }
      else { if(M.lane===-1){ M.lane=0; col.chosen=0; } col.lanes[M.lane].nodes[M.li].done=true; M.li++;
        if(M.li>=col.lanes[M.lane].nodes.length){ M.ci++; M.lane=-1; M.li=0; } } }
    ok("map_traverse_to_boss", reached && (steps-1)===13, "steps="+(steps-1));
  })();

  /* --- 新パワー/新カード 単体検証 --- */
  DIFF=DIFFS.normal; newRun("taichi"); startCombat(["dsoldier"],"battle"); const C=S.combat;
  const RE=h=>{C.enemies=[{id:"d",uid:0,name:"m",spr:"slime",sprScale:4,hp:h,maxHp:h,blk:0,st:{},turn:0,move:null,enraged:false}];};
  const BS=()=>{C.wisdom=0;C.faith=0;C.played=0;C.blk=0;C.crit=0;C.critMul=2;C.stance=null;C.st={};C.powers={};C.busy=false;C.energy=99;};
  const PL=id=>{C.energy=99;const cd=mkCard(id);C.hand.push(cd);playCard(C.hand.length-1,aliveEnemies()[0]);};
  let h0;
  BS();RE(999);C.wisdom=5;h0=C.enemies[0].hp;PL("megaton_bomb"); ok("megaton_bomb_wall", (h0-C.enemies[0].hp)===30&&C.wisdom===0);
  BS();RE(999);C.faith=4;h0=C.enemies[0].hp;PL("grand_finale"); ok("grand_finale_fall", (h0-C.enemies[0].hp)===24&&C.faith===0);
  BS();RE(999);C.wisdom=3;let b0=C.blk;PL("jido_barrier"); ok("jido_barrier_wb", (C.blk-b0)===11);
  BS();RE(999);C.played=3;h0=C.enemies[0].hp;PL("kaiten_geri"); ok("kaiten_geri_combo3_hi", (h0-C.enemies[0].hp)===16);
  BS();RE(999);C.played=1;h0=C.enemies[0].hp;PL("kaiten_geri"); ok("kaiten_geri_combo3_lo", (h0-C.enemies[0].hp)===10);
  BS();RE(999);C.faith=3;h0=C.enemies[0].hp;PL("vibrato"); ok("vibrato_fge_hi", (h0-C.enemies[0].hp)===11);
  BS();RE(999);h0=C.enemies[0].hp;PL("vibrato"); ok("vibrato_fge_lo", (h0-C.enemies[0].hp)===6);
  BS();RE(999);C.stance="wrath";h0=C.enemies[0].hp;PL("nomikurabe"); ok("nomikurabe_wrb", (h0-C.enemies[0].hp)===18);
  BS();RE(999);C.stance="calm";h0=C.enemies[0].hp;PL("inazuma_tsue"); ok("inazuma_tsue_cab", (h0-C.enemies[0].hp)===12);
  BS();PL("kanko_chikara"); ok("kanko_chikara_critmul", C.critMul===2.5);
  BS();RE(999);C.crit=100;C.critMul=2.5;h0=C.enemies[0].hp;PL("spanner"); ok("critmul_applied", (h0-C.enemies[0].hp)===15);
  BS();C.powers={shippu_mode:2};startPlayerTurn(); ok("shippu_mode_combo", S.combat.played===2);
  S.combat.busy=false;S.combat.wisdom=4;S.combat.powers={drone:{mul:1,flat:2}};RE(999);h0=S.combat.enemies[0].hp;startPlayerTurn(); ok("drone_turn_dmg", (h0-S.combat.enemies[0].hp)===6);
  S.combat.busy=false;S.combat.powers={yusha_sakazuki:2};S.combat.stance=null;S.combat.draw.push(mkCard("spanner"),mkCard("spanner"),mkCard("spanner"));let hn=S.combat.hand.length;setStance("wrath"); ok("yusha_sakazuki_draw", (S.combat.hand.length-hn)===2);
  S.combat.busy=false;S.combat.powers={audience:2};S.combat.faith=1;S.combat.enemies.forEach(e=>e.hp=0);endTurn(); ok("audience_endturn_faith", S.combat&&S.combat.faith===3);

  /* --- ボスギミック --- */
  newRun("taichi");
  S.combat={kind:"boss",enemies:[{id:"darkmaou",uid:0,name:"d",spr:"darkmaou",sprScale:5,hp:120,maxHp:220,blk:0,st:{},turn:0,boss:true,move:null,enraged:false}],turn:1,energyMax:3,energy:99,hand:[],draw:[],discard:[],exhaust:[],blk:0,st:{},faith:0,wisdom:0,played:0,stance:null,selected:null,crit:0,critMul:2,powers:{}};
  dealToEnemy(S.combat.enemies[0],20);
  ok("darkmaou_enrage", S.combat.enemies[0].enraged&&S.combat.enemies[0].st.str===3);
  const sA=S.combat.enemies[0].st.str; dealToEnemy(S.combat.enemies[0],10);
  ok("darkmaou_enrage_once", S.combat.enemies[0].st.str===sA);
  DIFF=DIFFS.hard; S.combat.busy=false; S.combat.turn=2; S.combat.powers={};
  S.combat.enemies=[{id:"maou",uid:0,name:"m",spr:"maou",sprScale:5,hp:130,maxHp:130,blk:0,st:{},turn:0,boss:true,move:null,enraged:false}];
  const s0=S.combat.enemies[0].st.str||0; startPlayerTurn();
  ok("hardboss_turn3_str", (S.combat.enemies[0].st.str||0)-s0===1 && S.combat.turn===3);
  DIFF=DIFFS.normal;

  /* --- god-mode 通し(28階まで例外なく到達) --- */
  function godRun(chId, diffKey){
    DIFF=DIFFS[diffKey]; newRun(chId); S.hp=S.maxHp=999999;
    const v={stage2:false, f14boss:false, f28boss:false, mid1:false, enrage:false};
    let guard=0;
    while(S && guard++<5000){
      if(S.floor>28) break;
      if(S.floor>=15) v.stage2=true;
      const boss=(S.floor===14||S.floor===28); const stg=stageOf(S.floor);
      let ids;
      if(S.floor===14){ ids=["maou"]; v.f14boss=true; }
      else if(S.floor===28){ ids=["darkmaou"]; v.f28boss=true; }
      else if(stg===2) ids=S.floor<=20?pick(POOL_S2):pick(POOL_S2_HARD);
      else ids=S.floor<=5?pick(POOL_EASY):pick(POOL_HARD);
      startCombat(ids, boss?"boss":"battle"); S.hp=S.maxHp=999999;
      let tg=0;
      while(S.combat && tg++<400){
        let pg=0;
        while(S.combat && aliveEnemies().length>0 && pg++<40){
          const hand=S.combat.hand; let did=false;
          for(let i=0;i<hand.length;i++){ if(cardCost(hand[i])<=S.combat.energy){ const def=CARDS[hand[i].id]; playCard(i, def.type==='atk'?aliveEnemies()[0]:null); did=true; break; } }
          if(!did) break;
        }
        if(!S.combat) break;
        if(S.combat.enemies.some(e=>e.enraged)) v.enrage=true;
        if(aliveEnemies().length===0){ victory(); break; }
        const C2=S.combat; C2.discard.push(...C2.hand); C2.hand=[];
        aliveEnemies().forEach(e=>{ if(e.move) doEnemyMove(e); });
        S.hp=S.maxHp=999999;
        const dec=o=>{if(o.weak)o.weak--;if(o.vuln)o.vuln--;}; dec(C2.st); C2.enemies.forEach(e=>dec(e.st));
        C2.enemies.forEach(e=>{ if(e.hp>0){e.blk=0;chooseMove(e);} });
        C2.busy=false; startPlayerTurn(); S.hp=S.maxHp=999999;
      }
      if(!S) break;
      if(S.floor===14){ const ci=CHAR_ORDER.indexOf(chId); if(CLEARED1[ci]) v.mid1=true; }
      if(S.floor===28) break;
      S.floor++;
    }
    return {ch:chId, diff:diffKey, floor:S?S.floor:-1, v};
  }
  CLEARED1=[false,false,false,false,false]; CLEARED2=[false,false,false,false,false];
  [["kento","normal"],["yushi","hard"],["erika","easy"]].forEach(([c,dk])=>{
    let r; try{ r=godRun(c,dk); }catch(e){ ok("godrun_"+c+"_"+dk, false, "例外:"+e.message); return; }
    ok("godrun_"+c+"_"+dk+"_reach28", r.floor===28 && r.v.f28boss && r.v.stage2 && r.v.f14boss && r.v.mid1, JSON.stringify(r.v)+" floor="+r.floor);
  });
  ok("stage2_clear_recorded", CLEARED2.some(x=>x), JSON.stringify(CLEARED2));

  globalThis.__QR=results;
})();
`;

let runErr = null;
try {
  new Function(STUBS + "\n" + game + "\n" + SUITE)();
} catch (e) {
  runErr = e;
}

const results = (typeof globalThis !== "undefined" && globalThis.__QR) || [];

console.log("=== ひがしやまクエスト v2  検証ゲート ===");
if (runErr) {
  console.error("実行中に れいがい が はっせいしました:");
  console.error(runErr && runErr.stack ? runErr.stack : runErr);
  process.exit(1);
}
if (results.length === 0) {
  console.error("FAIL: テストが 1つも じっこうされませんでした");
  process.exit(1);
}

let failed = 0;
for (const r of results) {
  const tag = r.pass ? "PASS" : "FAIL";
  console.log(`  [${tag}] ${r.n}${r.d ? "  (" + r.d + ")" : ""}`);
  if (!r.pass) failed++;
}
console.log("-----------------------------------------");
console.log(`  ${results.length - failed} / ${results.length} PASS`);
if (failed > 0) {
  console.error(`FAIL: ${failed}こう おちました。push しないでください。`);
  process.exit(1);
}
console.log("ぜんこうもく PASS ✔");
process.exit(0);
