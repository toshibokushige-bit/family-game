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
  ok("cards_total_109", Object.keys(CARDS).length===109, Object.keys(CARDS).length+"枚");
  ok("cards_art_complete", ma.length===0, ma.join());
  ok("cards_desc_ok", df.length===0, df.join());
  const newIds=["nusumi_ashi","kaiten_geri","step_renshu","shippu_mode","final_rush","bakuhatsu_nut","kaizo_kyoka","jido_barrier","drone","megaton_bomb","rinsho","vibrato","maho_step","audience","grand_finale","ai_no_hakushu","megane_kirari","cyalume_rain","kanko_chikara","unmei_stage","nomikurabe","yoizamashi","inazuma_tsue","dai_rancho","yusha_sakazuki"];
  ok("cards_new25_present", newIds.filter(id=>!CARDS[id]).length===0, newIds.filter(id=>!CARDS[id]).join());
  const addIds=["hitamuki_lesson","jido_kenkyusho","kuchizusamu","mainichi_lesson","keiko_no_hibi","miyaburi","kakuran_kamae","misukashi_wink","gekisho_spot","kona_kemuri","dai_kemuridama","komoriuta","minna_komoriuta","horoyoi_iki","sakazuki_kamae","anc_barrier","anc_wall"];
  ok("cards_v25_add17_present", addIds.filter(id=>!CARDS[id]).length===0, addIds.filter(id=>!CARDS[id]).join());

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
  ok("map_every_lane_has_battle", Math.min.apply(null, laneBattles(MN))>=1, "min="+Math.min.apply(null, laneBattles(MN)));
  const battleNodes = cols => cols.reduce((n,c)=> n + (c.kind==="single" ? (c.node.t==="battle"?1:0) : c.lanes.reduce((m,L)=>m+L.nodes.filter(x=>x.t==="battle").length,0)), 0);
  const eventNodes  = cols => cols.reduce((n,c)=> n + (c.kind==="single" ? (c.node.t==="event"?1:0) : c.lanes.reduce((m,L)=>m+L.nodes.filter(x=>x.t==="event").length,0)), 0);
  ok("map_battles_reduced", battleNodes(MN)===17, "battles="+battleNodes(MN));   // 19→17（約1割減）
  ok("map_events_increased", eventNodes(MN)===6, "events="+eventNodes(MN));       // 4→6
  DIFF=DIFFS.hard; const MH=buildMap(1);
  ok("map_hard_same_camps", MH[2].node.t==="rest" && MN[2].node.t==="rest");      // むずかしいも 通常と同じ
  ok("map_hard_same_battles", battleNodes(MH)===17);
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

  /* --- v2.5: 初期デッキ・ポーション・デバフ・スケール・エンシェント --- */
  DIFF=DIFFS.normal;
  ok("starter_deck_8", (newRun("kento"), S.deck.length===8), "deck="+S.deck.length);
  ok("block_potion_15", POTIONS.block.desc.indexOf("15")>=0);
  ok("ancients_13", ANCIENT_POOL.length===13, ANCIENT_POOL.length);

  newRun("taichi"); startCombat(["dsoldier"],"battle");
  const V=S.combat;
  const RE2=h=>{V.enemies=[{id:"d",uid:0,name:"m",spr:"slime",sprScale:4,hp:h,maxHp:h,blk:0,st:{},turn:0,move:null,enraged:false}];};
  const BS2=()=>{V.wisdom=0;V.faith=0;V.played=0;V.blk=0;V.crit=0;V.critMul=2;V.stance=null;V.st={};V.powers={};V.busy=false;V.energy=99;V.negate=0;V.dmgTaken=0;V.freeUsed=false;V.fbUsed=true;V.hitc=0;};
  const PL2=id=>{V.energy=99;const cd=mkCard(id);V.hand.push(cd);playCard(V.hand.length-1,aliveEnemies()[0]);};

  BS2();RE2(999);PL2("miyaburi");      ok("debuff_vuln_skl", V.enemies[0].st.vuln===1);
  BS2();RE2(999);PL2("kona_kemuri");   ok("debuff_weak_skl", V.enemies[0].st.weak===1);
  BS2();V.enemies=[{id:"a",uid:0,name:"a",spr:"slime",sprScale:4,hp:999,maxHp:999,blk:0,st:{},turn:0,move:null,enraged:false},{id:"b",uid:1,name:"b",spr:"slime",sprScale:4,hp:999,maxHp:999,blk:0,st:{},turn:0,move:null,enraged:false}];
  PL2("kakuran_kamae");                ok("debuff_all_vuln", V.enemies[0].st.vuln===1 && V.enemies[1].st.vuln===1);

  BS2();PL2("hitamuki_lesson"); ok("scale_kento_combo",  V.powers.shippu_mode===1);
  BS2();PL2("jido_kenkyusho");  ok("scale_taichi_wisdom", V.powers.tensai_ou===1);
  BS2();PL2("kuchizusamu");     ok("scale_nozomi_faith",  V.powers.star_utahime===1);
  BS2();PL2("mainichi_lesson"); ok("scale_erika_crit",    V.powers.crit_gain===4);
  BS2();PL2("keiko_no_hibi");   ok("scale_yushi_block",   V.powers.horoyoi_kenja===3);
  BS2();V.powers={crit_gain:4};V.crit=0;RE2(999);startPlayerTurn(); ok("crit_gain_applies", S.combat.crit===4);

  { newRun("taichi"); const before=S.deck.length; giveRandomPower(); ok("give_random_power", S.deck.length===before+1 && CARDS[S.deck[S.deck.length-1].id].type==="pow"); }

  /* エンシェントレリック */
  newRun("kento"); S.relics.push("anc_mana"); startCombat(["dsoldier"],"battle");
  ok("anc_mana_energymax", S.combat.energyMax===4);
  newRun("kento"); const mh=S.maxHp; ANCIENTS.anc_maxhp30.onGain(); ok("anc_maxhp30", S.maxHp===mh+30);
  newRun("kento"); S.hp=1; S.relics.push("anc_heal8"); startCombat(["dsoldier"],"battle"); ok("anc_heal8", S.hp===9);
  newRun("kento"); S.relics.push("anc_berserk"); startCombat(["dsoldier"],"battle");
  ok("anc_berserk_str_dex", (S.combat.st.str||0)>=3 && (S.combat.st.dex||0)>=3);
  { const C3=S.combat; C3.busy=false; C3.energy=99; C3.st={dex:3}; C3.fbUsed=true; const b0=C3.blk; const cd=mkCard("step_guard"); C3.hand.push(cd); playCard(C3.hand.length-1,null); ok("dex_adds_block", (C3.blk-b0)===8); }
  newRun("taichi"); S.relics.push("anc_free1"); startCombat(["dsoldier"],"battle");
  { const C3=S.combat; C3.busy=false; C3.energy=3; const cd=mkCard("spanner"); C3.hand.push(cd); playCard(C3.hand.length-1, aliveEnemies()[0]); ok("anc_free1_first_free", C3.energy===3 && C3.freeUsed); }
  newRun("kento"); S.relics.push("anc_cap20"); startCombat(["dsoldier"],"battle");
  { const C3=S.combat; C3.busy=false; C3.blk=0; C3.dmgTaken=0; S.hp=100; damagePlayer(50); ok("anc_cap20_damage", S.hp===80); }
  newRun("kento"); S.relics.push("anc_negate5"); startCombat(["dsoldier"],"battle");
  { const C3=S.combat; C3.busy=false; C3.blk=0; S.hp=100; C3.hitc=0; for(let i=0;i<5;i++) damagePlayer(1); ok("anc_negate5_hit", S.hp===96); }
  newRun("kento"); startCombat(["dsoldier"],"battle");
  { const C3=S.combat; C3.busy=false; C3.energy=99; C3.negate=0; const cd=mkCard("anc_barrier"); C3.hand.push(cd); playCard(C3.hand.length-1,null); const set=C3.negate===2; S.hp=100; C3.blk=0; damagePlayer(10); damagePlayer(10); ok("anc_barrier_negate2", set && S.hp===100 && C3.negate===0); }
  newRun("kento"); ANCIENTS.anc_up6.onGain(); ok("anc_up6_upgrade", S.deck.filter(c=>c.up).length>=6);
  newRun("kento"); { const dl=S.deck.length; ANCIENTS.anc_wall_cards.onGain(); ok("anc_wall_cards_add2", S.deck.length===dl+2 && S.deck.slice(-2).every(c=>c.id==="anc_wall")); }
  newRun("kento"); ANCIENTS.anc_potion5.onGain(); ok("anc_potion5_slots", S.potions.length===5 && S.potions.every(p=>!p.used));

  /* --- v2.61 UI --- */
  ok("cardEl_rarity_badge", cardEl(mkCard("renda")).innerHTML.indexOf("crar")>=0);
  ok("cardEl_desc_span", cardEl(mkCard("fansa_wink")).innerHTML.indexOf('cdesc"><span>')>=0);
  S=null; ok("homeClick_no_run_navigates", homeClick({preventDefault:()=>{}})===true);
  { newRun("kento"); let pd=false; const r=homeClick({preventDefault:()=>{pd=true;}}); ok("homeClick_in_run_confirms", r===false && pd===true); }
  ok("screenShake_no_throw", (function(){ try{ newRun("kento"); startCombat(["dsoldier"],"battle"); screenShake(); return true; }catch(e){ return false; } })());

  /* --- ブロック底上げ（初期カードいがい 1マナ+1/2マナ+2） --- */
  ok("blockbuff_c1_plus1", CARDS.kaizo_kyoka.v.b===7 && CARDS.kaizo_kyoka.vu.b===10, "kaizo v="+CARDS.kaizo_kyoka.v.b);   // C cost1 b6->7 / b9->10
  ok("blockbuff_c2_plus2", CARDS.jido_barrier.v.b===10 && CARDS.jido_barrier.vu.b===13, "jido v="+CARDS.jido_barrier.v.b); // U cost2 b8->10 / b11->13
  ok("blockbuff_starter_unchanged", CARDS.step_guard.v.b===5 && CARDS.mama_tate.v.b===5);                                   // S は そのまま
  ok("blockbuff_cost0_unchanged", CARDS.shinkokyu.v.b===6 && CARDS.nusumi_ashi.v.b===2);                                    // 0マナは たいしょうがい
  ok("blockbuff_cost3_unchanged", CARDS.magnum_slash.v.b===undefined);                                                     // 3マナ(bなし)は むえいきょう

  /* --- ポーション(きゅうさいアイテム) --- */
  DIFF=DIFFS.normal; newRun("kento");
  ok("potions_3_at_start", S.potions.length===3 && S.potions.every(p=>!p.used) && S.potions.map(p=>p.id).join()==="mana,draw,block");
  usePotion("block");   // せんとうそとでは つかえない
  ok("potion_locked_out_of_combat", !S.potions.find(p=>p.id==="block").used);
  startCombat(["dsoldier"],"battle"); S.combat.busy=false;
  S.combat.energy=1; usePotion("mana");  ok("potion_mana_plus2", S.combat.energy===3 && S.potions.find(p=>p.id==="mana").used);
  S.combat.energy=1; usePotion("mana");  ok("potion_mana_oneshot", S.combat.energy===1);   // つかいきり（補填なし）
  S.combat.blk=0;    usePotion("block"); ok("potion_block_plus15", S.combat.blk===15);
  { const hb=S.combat.hand.length; usePotion("draw"); ok("potion_draw_cards", S.combat.hand.length>hb); }

  /* --- 新パワー/新カード 単体検証 --- */
  DIFF=DIFFS.normal; newRun("taichi"); startCombat(["dsoldier"],"battle"); const C=S.combat;
  const RE=h=>{C.enemies=[{id:"d",uid:0,name:"m",spr:"slime",sprScale:4,hp:h,maxHp:h,blk:0,st:{},turn:0,move:null,enraged:false}];};
  const BS=()=>{C.wisdom=0;C.faith=0;C.played=0;C.blk=0;C.crit=0;C.critMul=2;C.stance=null;C.st={};C.powers={};C.busy=false;C.energy=99;};
  const PL=id=>{C.energy=99;const cd=mkCard(id);C.hand.push(cd);playCard(C.hand.length-1,aliveEnemies()[0]);};
  let h0;
  BS();RE(999);C.wisdom=5;h0=C.enemies[0].hp;PL("megaton_bomb"); ok("megaton_bomb_wall", (h0-C.enemies[0].hp)===30&&C.wisdom===0);
  BS();RE(999);C.faith=4;h0=C.enemies[0].hp;PL("grand_finale"); ok("grand_finale_fall", (h0-C.enemies[0].hp)===24&&C.faith===0);
  BS();RE(999);C.wisdom=3;let b0=C.blk;PL("jido_barrier"); ok("jido_barrier_wb", (C.blk-b0)===13);   // b8+2(buff)+wisdom3
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
