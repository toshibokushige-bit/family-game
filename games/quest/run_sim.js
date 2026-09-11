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
     - カード209枚: desc()整合・え(イラスト/絵文字)の網羅・ぜんまい描画できること
     - ステージ2の敵・やみのまおう(HP220)の定義
     - 新パワー/新カード効果を最小戦闘で単体検証
       (megaton/grand_finale/jido_barrier/kaiten_geri/vibrato/nomikurabe/
        inazuma/kanko_chikara/shippu_mode/drone/yusha_sakazuki/audience)
     - やみのまおう いかりギミック / むずかしいボスの筋力ギミック
     - おんぷコスト(fc)・どく・すばやさ・ファンサ還元 など 各キャラの 新ギミック
     - god-mode 通し(5にん×normal/hard/easy)で 28階まで例外なく到達
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
  ok("cards_total_209", Object.keys(CARDS).length===209, Object.keys(CARDS).length+"枚");
  /* キャラごとの まいすう（v2.7で 1にん +10まい）*/
  {
    const per = {}; Object.keys(CARDS).forEach(id=>{ const c=CARDS[id].ch; per[c]=(per[c]||0)+1; });
    const want = {kento:40, taichi:40, nozomi:42, erika:42, yushi:40, none:5};
    const bad = Object.keys(want).filter(c=>per[c]!==want[c]);
    ok("cards_per_char", bad.length===0, JSON.stringify(per));
  }
  ok("cards_art_complete", ma.length===0, ma.join());
  /* えの 網羅 — イラスト(QUEST_CARD_ART)が なければ 絵文字(CARD_ART)に フォールバックする */
  {
    const qm = Object.keys(CARDS).filter(id=>!QUEST_CARD_ART[id]);
    ok("cards_art_or_emoji", qm.filter(id=>!CARD_ART[id]).length===0, qm.filter(id=>!CARD_ART[id]).join());
    globalThis.__NOART = qm.length;
    const badTier = Object.keys(QUEST_CARD_ART).filter(id=>["common","uncommon","rare"].indexOf(QUEST_CARD_ART[id].tier)<0);
    ok("cards_quest_art_tier_ok", badTier.length===0, badTier.join());
    const noEl = Object.keys(CARDS).filter(id=>{ try{ const h=cardEl(mkCard(id)).innerHTML; return h.indexOf("q-art")<0 && h.indexOf("cemo")<0; }catch(e){ return true; } });
    ok("cards_all_render", noEl.length===0, noEl.slice(0,8).join());
    const noEl2 = Object.keys(CARDS).filter(id=>{ try{ cardEl(mkCard(id,true)); return false; }catch(e){ return true; } });
    ok("cards_all_render_upgraded", noEl2.length===0, noEl2.slice(0,8).join());
  }
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
  ok("hard_ehp_132", DIFFS.hard.eHp===1.32 && DIFFS.normal.eHp===1.0 && DIFFS.easy.eHp===0.85, "hard eHp="+DIFFS.hard.eHp);   // むずかしい：てきHP +10%
  { /* じっさいに てきの HPに のっているか（1かい=スケール1.0 で はんてい）*/
    const lo=ENEMIES.golem.hp[0], hi=ENEMIES.golem.hp[1];
    const roll=dk=>{ DIFF=DIFFS[dk]; newRun("kento"); S.floor=1; startCombat(["golem"],"battle"); const h=S.combat.enemies[0].maxHp; S.combat=null; return h; };
    const inRange=(h,m)=>h>=Math.round(lo*m) && h<=Math.round(hi*m);
    let okN=true, okH=true;
    for(let i=0;i<40;i++){ if(!inRange(roll("normal"),1.0)) okN=false; if(!inRange(roll("hard"),1.32)) okH=false; }
    DIFF=DIFFS.normal;
    ok("hard_ehp_applied_to_enemy_hp", okN && okH, "golem "+lo+"-"+hi+" → hard "+Math.round(lo*1.32)+"-"+Math.round(hi*1.32));
  }
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

  /* --- v2.7 ついかカード(50まい)の たんたいけんしょう --- */
  {
    const v27 = {
      kento:["nagenaifu","suri_no_te","hayate_dash","kagefumi","kirikae_step","renkei_kick","zenryoku_shonen","otakara_dorobo","shinsoku_ranbu","chokasoku"],
      taichi:["dokugas_dan","jirai_settchi","haguruma","seimitsu_shageki","jetpack","kaiten_nokogiri","kikai_gundan","kinkyu_shuri","plasma_ho","hakase_mode"],
      nozomi:["harmony","yasashii_shirabe","tap_dance","sasayaki","duet","idol_smile","koe_no_mahou","crescendo","dai_gassho","densetsu_live"],
      erika:["gachikoi_beam","hachimaki","obento_power","zenryoku_jump","hi_touch","mamoru_chikara","mama_no_ikari","oshi_no_tame","kazoku_no_kizuna","kami_taio"],
      yushi:["oyaji_gag","ikki_nomi","ochazuke","kaminari_yobi","sake_no_chikara","zen_no_kokoro","raimei_ranbu","mottainai_seishin","daikenja_satori","banzai_kanpai"]
    };
    const miss=[], wrongCh=[];
    Object.keys(v27).forEach(ch=>v27[ch].forEach(id=>{
      if(!CARDS[id]) miss.push(id); else if(CARDS[id].ch!==ch) wrongCh.push(id);
    }));
    ok("v27_50cards_present", miss.length===0, miss.join());
    ok("v27_50cards_owner_ok", wrongCh.length===0, wrongCh.join());
    ok("v27_10_per_char", Object.keys(v27).every(ch=>v27[ch].length===10));
    /* ほうしゅうプールに 新カードが ちゃんと ならぶ */
    DIFF=DIFFS.normal; newRun("nozomi");
    const rp = Object.keys(CARDS).filter(id=>CARDS[id].ch==="nozomi" && CARDS[id].rar!=="S");
    ok("v27_in_reward_pool", v27.nozomi.every(id=>rp.indexOf(id)>=0));
  }

  DIFF=DIFFS.normal; newRun("taichi"); startCombat(["dsoldier"],"battle");
  const W=S.combat;
  const RE3=(h,n)=>{ W.enemies=[]; for(let i=0;i<(n||1);i++) W.enemies.push({id:"d",uid:i,name:"m",spr:"slime",sprScale:4,hp:h,maxHp:h,blk:0,st:{},turn:0,move:{t:"blk",b:0,txt:"x"},enraged:false}); };
  const BS3=()=>{W.wisdom=0;W.faith=0;W.played=0;W.blk=0;W.crit=0;W.critMul=2;W.stance=null;W.st={};W.powers={};W.busy=false;W.energy=99;W.hand=[];W.discard=[];W.draw=[];W.exhaust=[];};
  const PL3=id=>{W.energy=99;const cd=mkCard(id);W.hand.push(cd);playCard(W.hand.length-1,aliveEnemies()[0]);};
  const UP3=id=>{W.energy=99;const cd=mkCard(id,true);W.hand.push(cd);playCard(W.hand.length-1,aliveEnemies()[0]);};
  let x0;

  /* てふだ／すてふだ スケール */
  BS3();RE3(999);W.hand.push(mkCard("renda"),mkCard("renda"),mkCard("renda"));x0=W.enemies[0].hp;PL3("nagenaifu");
  ok("nagenaifu_hand_scale", (x0-W.enemies[0].hp)===8, "d="+(x0-W.enemies[0].hp));            // d2 + のこり3まい×2
  BS3();RE3(999);for(let i=0;i<6;i++)W.discard.push(mkCard("renda"));x0=W.enemies[0].hp;PL3("mottainai_seishin");
  ok("mottainai_discard_scale", (x0-W.enemies[0].hp)===6, "d="+(x0-W.enemies[0].hp));         // すてふだ6×1
  BS3();RE3(999);for(let i=0;i<5;i++)W.discard.push(mkCard("renda"));x0=W.enemies[0].hp;PL3("banzai_kanpai");
  ok("banzai_kanpai_wrath", (x0-W.enemies[0].hp)===26 && W.stance==="wrath", "d="+(x0-W.enemies[0].hp));  // (8+5)×2(ほろよい)

  /* すばやさ(dex) */
  BS3();RE3(999);PL3("hayate_dash"); ok("hayate_dash_dex", W.st.dex===2 && W.blk===5, "dex="+W.st.dex+" blk="+W.blk);  // b2+1(底上げ)+dex2(そのばで のる)
  BS3();PL3("zenryoku_shonen"); ok("zenryoku_shonen_power", W.powers.dexgain===2);
  BS3();RE3(999);W.powers={dexgain:3};startPlayerTurn(); ok("dexgain_per_turn", S.combat.st.dex===3);

  /* どく */
  S.combat.busy=false; BS3();RE3(999,2);PL3("jirai_settchi");
  ok("jirai_all_poison", W.enemies[0].st.poison===2 && W.enemies[1].st.poison===2 && W.wisdom===1);
  BS3();RE3(999);x0=W.enemies[0].hp;PL3("dokugas_dan");
  ok("dokugas_atk_poison", (x0-W.enemies[0].hp)===4 && W.enemies[0].st.poison===3);
  W.enemies[0].hp=999; W.enemies[0].st.poison=3; x0=W.enemies[0].hp;
  ok("poison_tick_damage", tickPoison()===false && (x0-W.enemies[0].hp)===3 && W.enemies[0].st.poison===2, "hp="+W.enemies[0].hp);
  W.enemies[0].hp=2; W.enemies[0].st.poison=5;
  ok("poison_tick_kills", tickPoison()===true && W.enemies[0].hp===0);
  /* どくで ぜんめつしたターンは endTurn が しょうりへ すすむ */
  BS3();RE3(3,1);W.enemies[0].st.poison=9;W.enemies.forEach(e=>e.hp=3);
  ok("poison_endturn_wipe", tickPoison()===true && aliveEnemies().length===0);
  BS3();RE3(999);PL3("kikai_gundan"); ok("kikai_gundan_power", W.powers.poison_start===2);
  BS3();RE3(999,2);W.powers={poison_start:2};startPlayerTurn();
  ok("poison_start_per_turn", S.combat.enemies[0].st.poison===2 && S.combat.enemies[1].st.poison===2);

  /* しきいち ボーナス */
  S.combat.busy=false; BS3();RE3(999);W.wisdom=5;x0=W.enemies[0].hp;PL3("seimitsu_shageki");
  ok("seimitsu_wge_hi", (x0-W.enemies[0].hp)===11);
  BS3();RE3(999);W.wisdom=4;x0=W.enemies[0].hp;PL3("seimitsu_shageki");
  ok("seimitsu_wge_lo", (x0-W.enemies[0].hp)===5);
  BS3();RE3(999);W.crit=0;x0=W.enemies[0].hp;PL3("zenryoku_jump");
  ok("zenryoku_jump_crge_lo", (x0-W.enemies[0].hp)===6);

  /* はつめい×n ダメージを ふくすうヒット */
  BS3();RE3(999);W.wisdom=4;x0=W.enemies[0].hp;PL3("kaiten_nokogiri");
  ok("kaiten_nokogiri_wm_hits", (x0-W.enemies[0].hp)===21, "d="+(x0-W.enemies[0].hp));   // (3+4)×3かい
  BS3();RE3(999);W.wisdom=6;x0=W.enemies[0].hp;PL3("plasma_ho");
  ok("plasma_ho_wm3", (x0-W.enemies[0].hp)===24);
  BS3();RE3(999);W.faith=4;x0=W.enemies[0].hp;PL3("crescendo");
  ok("crescendo_fc_hits", (x0-W.enemies[0].hp)===18 && W.faith===2, "d="+(x0-W.enemies[0].hp)+" f="+W.faith);  // 9×2かい / おんぷ2しょうひ

  /* おんぷ かいふく・ドローけい */
  BS3();S.hp=10;S.maxHp=100;W.faith=5;PL3("yasashii_shirabe"); ok("yasashii_shirabe_fc_heal", S.hp===20 && W.faith===3, "hp="+S.hp+" f="+W.faith);
  BS3();W.hand.push(mkCard("renda"),mkCard("renda"));W.draw=[mkCard("renda"),mkCard("renda"),mkCard("renda"),mkCard("renda")];
  PL3("kirikae_step"); ok("kirikae_step_redraw", W.hand.length===3 && W.discard.filter(c=>c.id==="renda").length===2, "hand="+W.hand.length);
  BS3();PL3("chokasoku"); ok("chokasoku_power", W.powers.drawgain===1);
  BS3();RE3(999);W.powers={drawgain:2};W.draw=[];for(let i=0;i<12;i++)W.draw.push(mkCard("renda"));startPlayerTurn();
  ok("drawgain_per_turn", S.combat.hand.length===7, "hand="+S.combat.hand.length);

  /* パワー：かいふく／おんぷ／気／ファンサ→きんりょく／おかね */
  S.combat.busy=false; BS3();PL3("koe_no_mahou"); ok("koe_no_mahou_power", W.powers.regen===2);
  BS3();RE3(999);W.powers={regen:2};S.hp=10;S.maxHp=100;startPlayerTurn(); ok("regen_per_turn", S.hp===12);
  S.combat.busy=false; BS3();PL3("densetsu_live"); ok("densetsu_live_power", W.powers.faithgain===2 && W.powers.drawgain===1);
  BS3();RE3(999);W.powers={faithgain:2};startPlayerTurn(); ok("faithgain_per_turn", S.combat.faith===2);
  S.combat.busy=false; BS3();PL3("daikenja_satori"); ok("daikenja_satori_power", W.powers.energygain===1);
  BS3();RE3(999);W.powers={energygain:1};startPlayerTurn(); ok("energygain_per_turn", S.combat.energy===S.combat.energyMax+1);
  S.combat.busy=false; BS3();UP3("daikenja_satori"); ok("daikenja_satori_up_block", W.powers.energygain===1 && W.powers.horoyoi_kenja===4);
  BS3();PL3("mama_no_ikari"); ok("mama_no_ikari_power", W.powers.crit_str===1);
  BS3();RE3(999);W.crit=100;W.powers={crit_str:2};PL3("bunmawashi"); ok("crit_str_on_crit", W.st.str===2, "str="+W.st.str);
  BS3();RE3(999);{ const g0=S.gold; PL3("otakara_dorobo"); ok("otakara_dorobo_gold", S.gold===g0+15, "gold="+S.gold); }

  /* かまえ／じこダメージ */
  BS3();RE3(999);PL3("zen_no_kokoro"); ok("zen_no_kokoro_calm", W.stance==="calm" && W.blk===11, "blk="+W.blk);  // (b5+1)+cb5
  BS3();RE3(999);S.hp=50;S.maxHp=100;W.energy=1;
  { const cd=mkCard("ikki_nomi"); W.hand.push(cd); playCard(W.hand.length-1,null); }
  ok("ikki_nomi_cost", S.hp===46 && W.energy===3, "hp="+S.hp+" e="+W.energy);

  /* --- v3.1 ついかカード(50まい)＋おんぷコストの たんたいけんしょう --- */
  {
    const v31 = {
      kento:["oyatsu_taimu","kaze_migawari","kaihi_step","makibishi","shukuchi","kabe_nobori","hayawaza_ren","kamaitachi","zettai_kaihi","tenchu_rush"],
      taichi:["dokubari","baikin_baramaki","doku_kenkyu","kagaku_hannou","mouduku_dan","sokushinzai","dokugaku_hakase","kaiho_ki","dai_dokugiri","saishu_heiki"],
      nozomi:["serenade","takaraka_voice","kokyu_seigyo","wa_no_uta","kassai","yume_no_stage","harmony_chain","kyoumei","zettai_onkan","hoshi_no_uta"],
      erika:["oshi_power","uchiwa_bariki","kansei_ouen","tokimeki","kanzen_nensho","ai_no_tate","fansa_bakuhatsu","mama_no_yuuki","kazoku_wo_mamoru","subete_wo_kakete"],
      yushi:["raimei_ichigeki","minna_kanpai","kaminari_ame","ippai_dake","kaminari_ranbu","raijin_kourin","oo_sakazuki","yoi_no_hate","tenku_ikazuchi","daikenja_kaigen"]
    };
    const miss=[], wrongCh=[];
    Object.keys(v31).forEach(ch=>v31[ch].forEach(id=>{ if(!CARDS[id]) miss.push(id); else if(CARDS[id].ch!==ch) wrongCh.push(id); }));
    ok("v31_50cards_present", miss.length===0, miss.join());
    ok("v31_50cards_owner_ok", wrongCh.length===0, wrongCh.join());
    ok("v31_10_per_char", Object.keys(v31).every(ch=>v31[ch].length===10));
    DIFF=DIFFS.normal; newRun("yushi");
    const rp = Object.keys(CARDS).filter(id=>CARDS[id].ch==="yushi" && CARDS[id].rar!=="S");
    ok("v31_in_reward_pool", v31.yushi.every(id=>rp.indexOf(id)>=0));
  }

  DIFF=DIFFS.normal; newRun("nozomi"); startCombat(["dsoldier"],"battle");
  let N=S.combat;
  const REN=(h,n)=>{ N.enemies=[]; for(let i=0;i<(n||1);i++) N.enemies.push({id:"d",uid:i,name:"m",spr:"slime",sprScale:4,hp:h,maxHp:h,blk:0,st:{},turn:0,move:{t:"blk",b:0,txt:"x"},enraged:false}); };
  const BSN=()=>{N.wisdom=0;N.faith=0;N.played=0;N.blk=0;N.crit=0;N.critMul=2;N.stance=null;N.st={};N.powers={};N.busy=false;N.energy=99;N.hand=[];N.discard=[];N.draw=[];N.exhaust=[];N.negate=0;};
  const PLN=id=>{N.energy=99;const cd=mkCard(id);N.hand.push(cd);playCard(N.hand.length-1,aliveEnemies()[0]);};
  let y0;

  /* ---- のぞみ：おんぷコスト(fc) ---- */
  BSN();REN(999);N.faith=0;
  ok("fc_blocks_play_without_faith", canPlay(mkCard("takaraka_voice"))===false && faithCost(mkCard("takaraka_voice"))===1);
  N.faith=1; ok("fc_playable_with_faith", canPlay(mkCard("takaraka_voice"))===true);
  BSN();REN(999);N.faith=3;y0=N.enemies[0].hp;PLN("takaraka_voice");
  ok("fc_consumes_faith", (y0-N.enemies[0].hp)===10 && N.faith===2, "d="+(y0-N.enemies[0].hp)+" f="+N.faith);
  BSN();REN(999);N.faith=5;N.blk=0;PLN("serenade"); ok("serenade_block_fc", N.blk===10 && N.faith===4, "blk="+N.blk);   // b9+1(底上げ)
  BSN();REN(999);N.faith=4;y0=N.enemies[0].hp;PLN("harmony_chain");
  ok("harmony_chain_fc", (y0-N.enemies[0].hp)===18 && N.faith===2, "d="+(y0-N.enemies[0].hp));
  BSN();REN(999,2);N.faith=3;y0=N.enemies[0].hp;PLN("hoshi_no_uta");
  ok("hoshi_no_uta_all_fc", (y0-N.enemies[0].hp)===14 && (y0-N.enemies[1].hp)===14 && N.faith===0);
  BSN();PLN("kyoumei"); ok("kyoumei_power", N.powers.fc_block===2);
  BSN();REN(999);N.powers={fc_block:2};N.faith=5;N.blk=0;PLN("harmony_chain");
  ok("kyoumei_block_on_spend", N.blk===4, "blk="+N.blk);   // おんぷ2しょうひ × 2
  BSN();REN(999);N.faith=4;y0=N.enemies[0].hp;PLN("miracle_voice");
  ok("miracle_voice_rebalanced", (y0-N.enemies[0].hp)===24 && N.faith===0, "d="+(y0-N.enemies[0].hp));   // d12+おんぷ4×3

  /* ---- けんと：すばやさ→火力 / むこうか ---- */
  DIFF=DIFFS.normal; newRun("kento"); startCombat(["dsoldier"],"battle"); N=S.combat;
  BSN();REN(999);N.st={dex:4};y0=N.enemies[0].hp;PLN("kamaitachi");
  ok("kamaitachi_dxm", (y0-N.enemies[0].hp)===8, "d="+(y0-N.enemies[0].hp));   // 4+すばやさ4×1
  BSN();REN(999);N.blk=0;PLN("kaze_migawari"); ok("kaze_migawari_dx", N.st.dex===1 && N.blk===8, "blk="+N.blk);  // b6+1+dex1
  BSN();REN(999);PLN("zettai_kaihi");
  { const set=N.negate===2; S.hp=100; N.blk=0; damagePlayer(9); damagePlayer(9);
    ok("zettai_kaihi_negate", set && S.hp===100 && N.negate===0, "hp="+S.hp); }
  BSN();REN(999);N.played=3;y0=N.enemies[0].hp;PLN("tenchu_rush");
  ok("tenchu_rush_combo", (y0-N.enemies[0].hp)===28, "d="+(y0-N.enemies[0].hp));   // (4+3)×4かい

  /* ---- たいち：どく軸 / はつめいの出口 ---- */
  DIFF=DIFFS.normal; newRun("taichi"); startCombat(["dsoldier"],"battle"); N=S.combat;
  BSN();REN(999);N.enemies[0].st.poison=5;y0=N.enemies[0].hp;PLN("kagaku_hannou");
  ok("kagaku_hannou_psnm", (y0-N.enemies[0].hp)===15, "d="+(y0-N.enemies[0].hp));   // 5+どく5×2
  BSN();REN(999);N.wisdom=4;N.enemies[0].st.poison=3;y0=N.enemies[0].hp;PLN("saishu_heiki");
  ok("saishu_heiki_double", (y0-N.enemies[0].hp)===21 && N.wisdom===4, "d="+(y0-N.enemies[0].hp));   // 4+はつめい4×2+どく3×3
  BSN();REN(999);N.wisdom=6;N.blk=0;PLN("kaiho_ki");
  ok("kaiho_ki_wallb", N.blk===18 && N.wisdom===0, "blk="+N.blk);
  BSN();PLN("dokugaku_hakase"); ok("dokugaku_hakase_power", N.powers.poison_plus===1);
  BSN();REN(999);N.powers={poison_plus:2};PLN("dokubari");
  ok("poison_plus_applies", N.enemies[0].st.poison===5, "psn="+N.enemies[0].st.poison);   // psn3 + 2
  BSN();REN(999,2);N.enemies.forEach(e=>{e.hp=100;e.st.poison=4;});y0=100;PLN("sokushinzai");
  ok("sokushinzai_ptick", N.enemies[0].hp===96 && N.enemies[0].st.poison===3 && N.enemies[1].hp===96, "hp="+N.enemies[0].hp);
  BSN();REN(999,2);N.powers={poison_start:2,poison_plus:1};startPlayerTurn();
  ok("poison_start_plus", S.combat.enemies[0].st.poison===3);

  /* ---- えりか：ファンサ→こうげき・ぼうぎょ ---- */
  S.combat.busy=false; DIFF=DIFFS.normal; newRun("erika"); startCombat(["dsoldier"],"battle"); N=S.combat;
  /* こうげきは crit=0 で けいさんする（ファンサの ランダム2ばいを のぞくため）*/
  BSN();REN(999);N.crit=0;y0=N.enemies[0].hp;PLN("oshi_power");
  ok("oshi_power_crd_zero", (y0-N.enemies[0].hp)===4, "d="+(y0-N.enemies[0].hp));
  BSN();REN(999);N.blk=0;N.crit=60;PLN("uchiwa_bariki");
  ok("uchiwa_bariki_crb", N.blk===11, "blk="+N.blk);   // b4+1(底上げ)+6×1
  BSN();REN(999);N.blk=0;N.crit=50;PLN("ai_no_tate");
  ok("ai_no_tate_crb", N.blk===20, "blk="+N.blk);      // b8+2(底上げ)+5×2
  BSN();REN(999);N.crit=70;y0=N.enemies[0].hp;PLN("subete_wo_kakete");
  ok("subete_wo_kakete_crall", (y0-N.enemies[0].hp)>=35 && N.crit===0, "d="+(y0-N.enemies[0].hp));   // 7×5=35（ファンサ発生で 2ばいの ことも）
  BSN();PLN("mama_no_yuuki"); ok("mama_no_yuuki_power", N.powers.crit_blk===3);
  BSN();REN(999);N.powers={crit_blk:3};N.crit=100;N.blk=0;PLN("bunmawashi");
  ok("crit_blk_on_crit", N.blk===3, "blk="+N.blk);

  /* ---- ゆうし：はでな カミナリ ---- */
  DIFF=DIFFS.normal; newRun("yushi"); startCombat(["dsoldier"],"battle"); N=S.combat;
  BSN();REN(999,3);y0=N.enemies[0].hp;PLN("kaminari_ranbu");
  ok("kaminari_ranbu_all", N.enemies.every(e=>(y0-e.hp)===12), "d="+(y0-N.enemies[0].hp));
  BSN();PLN("raijin_kourin"); ok("raijin_kourin_power", N.powers.thunder_start===6);
  BSN();REN(999);N.powers={thunder_start:6};y0=N.enemies[0].hp;startPlayerTurn();
  ok("thunder_start_per_turn", (y0-S.combat.enemies[0].hp)>=6, "d="+(y0-S.combat.enemies[0].hp));
  S.combat.busy=false; N=S.combat; BSN();PLN("daikenja_kaigen"); ok("daikenja_kaigen_power", N.powers.stance_dmg===5);
  BSN();REN(999,2);N.powers={stance_dmg:5};N.stance=null;y0=N.enemies[0].hp;setStance("wrath");
  ok("stance_dmg_on_change", N.enemies.every(e=>(y0-e.hp)>=5), "d="+(y0-N.enemies[0].hp));
  BSN();REN(999);y0=N.enemies[0].hp;PLN("yoi_no_hate");
  ok("yoi_no_hate_wrath", (y0-N.enemies[0].hp)===18 && N.stance==="wrath", "d="+(y0-N.enemies[0].hp));   // d9 ×2(ほろよい)

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
          for(let i=0;i<hand.length;i++){ if(canPlay(hand[i])){ const def=CARDS[hand[i].id]; playCard(i, def.type==='atk'?aliveEnemies()[0]:null); did=true; break; } }
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
  [["kento","normal"],["yushi","hard"],["erika","easy"],["nozomi","hard"],["taichi","normal"]].forEach(([c,dk])=>{
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
