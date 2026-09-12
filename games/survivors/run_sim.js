#!/usr/bin/env node
/* =====================================================================
   ひがしやまサバイバーズ 検証ゲート (run_sim.js)
   ---------------------------------------------------------------------
   index.html の <script> を抽出し、DOM/Canvas/AudioContext をスタブした
   ヘッドレス環境でゲームを自動プレイして検証する。

     node run_sim.js

   ぜんこうもく PASS でないと exit code 1（= push 禁止）。

   けんしょう項目:
     - <script> の構文チェック
     - ふかの じょうげん(てき/てきだん/ドロップ/エフェクト)が すべての
       わきぐちで きいているか ＝ ステージ6ボスせんで オーバーしないか
     - おと: どうじはつおん数の じょうげん、ノイズバッファの つかいまわし、
       れんだSEの スロットル ＝ スマホで タブが おちる げんいんの ふうじこみ
     - じどう ふかていげん(ECO)の きりかえ
     - ぜんステージ(1〜6)の ボスせんを とおして れいがいが でないこと
   ===================================================================== */
"use strict";
const fs = require("fs");
const path = require("path");

const HTML_PATH = path.join(__dirname, "index.html");
const html = fs.readFileSync(HTML_PATH, "utf8");
/* index.html は <script> が 4つに わかれている。ぜんぶ つなげて 1つとして じっこうする
   （src つきの そとぶ スクリプトは ない）*/
const blocks = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(x => x[1]);
if (!blocks.length) { console.error("FAIL: <script> ブロックが みつかりません"); process.exit(1); }
const game = blocks.join("\n");

/* ---- DOM / Canvas / AudioContext スタブ ---- */
const STUBS = `
"use strict";
const NOOP=()=>{};
const CTX2D=new Proxy({},{get:(t,p)=>{
  if(p==='canvas')return {width:1280,height:720};
  if(p==='createLinearGradient'||p==='createRadialGradient')return ()=>({addColorStop:NOOP});
  if(p==='measureText')return ()=>({width:10});
  if(p==='getImageData')return ()=>({data:new Uint8ClampedArray(4)});
  return NOOP;
},set:()=>true});
function FakeEl(id){ this.id=id||""; this._html=""; this.style=new Proxy({},{get:(t,p)=>(p==='setProperty'||p==='removeProperty')?NOOP:(t[p]!==undefined?t[p]:""),set:(t,p,v)=>{t[p]=v;return true;}});
  this.dataset={}; this.children=[]; this.className=""; this.textContent=""; this.value=""; this.width=1280; this.height=720;
  this.classList={_s:new Set(),add(){for(const a of arguments)this._s.add(a);},remove(){for(const a of arguments)this._s.delete(a);},toggle(){},contains(c){return this._s.has(c);}}; }
FakeEl.prototype.appendChild=function(c){this.children.push(c);return c;};
FakeEl.prototype.getContext=function(){return CTX2D;};
FakeEl.prototype.setAttribute=NOOP; FakeEl.prototype.removeAttribute=NOOP;
FakeEl.prototype.addEventListener=NOOP; FakeEl.prototype.removeEventListener=NOOP;
FakeEl.prototype.querySelector=function(){return new FakeEl();}; FakeEl.prototype.querySelectorAll=function(){return [];};
FakeEl.prototype.getBoundingClientRect=function(){return {left:0,top:0,width:1280,height:720};};
FakeEl.prototype.remove=NOOP; FakeEl.prototype.focus=NOOP; FakeEl.prototype.click=NOOP;
Object.defineProperty(FakeEl.prototype,"innerHTML",{get(){return this._html;},set(v){this._html=v;}});
Object.defineProperty(FakeEl.prototype,"offsetWidth",{get(){return 1280;}});
const _els={};
const document={ getElementById:id=>(_els[id]||(_els[id]=new FakeEl(id))), createElement:t=>new FakeEl(t),
  createTextNode:t=>({nodeType:3,textContent:t}), querySelector:()=>new FakeEl(), querySelectorAll:()=>[],
  addEventListener:NOOP, body:new FakeEl("body"), documentElement:new FakeEl("html"), hidden:false, visibilityState:'visible' };
/* AudioContext: つくられた ノードを かぞえて、きりはなし もれを けんしゅつする */
const AUDSTAT={nodes:0,live:0,buffers:0,bufferSamples:0};
function mkNode(kind){
  AUDSTAT.nodes++; AUDSTAT.live++;
  const n={_kind:kind,_ended:null,
    connect:NOOP, disconnect:()=>{ if(!n._disc){ n._disc=true; AUDSTAT.live--; } },
    start:function(){ if(n._kind!=='osc'&&n._kind!=='src')return; },
    stop:NOOP, frequency:{value:0,setValueAtTime:NOOP,exponentialRampToValueAtTime:NOOP},
    gain:{value:0,setValueAtTime:NOOP,exponentialRampToValueAtTime:NOOP,linearRampToValueAtTime:NOOP},
    type:'', buffer:null, loop:false, playbackRate:{value:1}};
  Object.defineProperty(n,'onended',{get(){return n._ended;},set(fn){n._ended=fn;}});
  return n;
}
const window={ matchMedia:()=>({matches:false}), devicePixelRatio:1,
  AudioContext:function(){ return {
    createGain:()=>mkNode('gain'), createOscillator:()=>mkNode('osc'),
    createBufferSource:()=>mkNode('src'), createBiquadFilter:()=>mkNode('filt'),
    createBuffer:(ch,n,sr)=>{ AUDSTAT.buffers++; AUDSTAT.bufferSamples+=n; return {getChannelData:()=>new Float32Array(n)}; },
    destination:{}, currentTime:0, sampleRate:44100, state:'running', resume:NOOP }; } };
window.webkitAudioContext=window.AudioContext;
window.innerWidth=1280; window.innerHeight=720;
window.addEventListener=NOOP;
const navigator={userAgent:'node',maxTouchPoints:0};
let innerWidth=1280, innerHeight=720, devicePixelRatio=1;
const matchMedia=()=>({matches:false,addEventListener:NOOP});
const alert=NOOP, confirm=()=>true, prompt=()=>null;
const addEventListener=NOOP, removeEventListener=NOOP;
const screen={width:1280,height:720,orientation:{lock:NOOP}};
const localStorage={getItem:()=>null,setItem:NOOP,removeItem:NOOP};
const setInterval=()=>0, clearInterval=NOOP, setTimeout=()=>0, clearTimeout=NOOP;
const requestAnimationFrame=()=>0, cancelAnimationFrame=NOOP;
const AudioContext=window.AudioContext;
const performance={now:()=>Date.now()};
const location={hash:'',href:''};
`;

/* ---- テストスイート ---- */
const SUITE = `
;(function(){
  const results=[]; const ok=(n,c,d)=>results.push({n,pass:!!c,d:d===undefined?"":String(d)});

  /* ---- じょうすう / こうぞう ---- */
  ok("limits_defined", typeof LIMITS==='object' && LIMITS.enemies>0 && LIMITS.ebullets>0 && LIMITS.drops>0 && LIMITS.fxs>0, JSON.stringify(LIMITS));
  ok("limits_base_defined", typeof LIMITS_BASE==='object' && LIMITS_BASE.enemies===230 && LIMITS_BASE.ebullets===300, JSON.stringify(LIMITS_BASE));
  ok("stage_count_6", MAX_STAGE===6 && STAGES.length===6);
  ok("helpers_exist", typeof canSpawnEnemy==='function' && typeof enemyRoom==='function' && typeof pushDrop==='function' && typeof trimEbullets==='function');

  /* ---- ボスせんを まわして じょうげんが きくか ---- */
  function bossRun(stage, sec, opt){
    opt=opt||{};
    newGame(); G.stage=stage; G.t=BOSS_AT-0.1; G.soul=12; G.level=30;
    const dt=1/30, steps=Math.round(sec/dt);
    const peak={eb:0,en:0,fx:0,drops:0,texts:0,gems:0};
    let err=null, phases={};
    for(let i=0;i<steps;i++){
      try{ update(dt); }catch(e){ err=e.message+" @t="+G.t.toFixed(1); break; }
      G.hp=stat.maxhp();
      const b=G.boss;
      if(b&&!b.dead&&!(b.invuln>0)){
        const f=b.hp/b.maxhp, floor=b.b25?0.02:b.b50?0.20:0.45;
        if(f>floor) hitEnemy(b, b.maxhp*0.02);
        phases[b.b25?'b25':b.b50?'b50':'normal']=1;
      }
      peak.eb=Math.max(peak.eb,G.ebullets.length); peak.en=Math.max(peak.en,G.enemies.length);
      peak.fx=Math.max(peak.fx,G.fxs.length); peak.drops=Math.max(peak.drops,G.drops.length);
      peak.texts=Math.max(peak.texts,G.texts.length); peak.gems=Math.max(peak.gems,G.gems.length);
    }
    return {peak, err, phases:Object.keys(phases)};
  }

  const r6 = bossRun(6, 300);
  ok("s6_no_exception", !r6.err, r6.err);
  ok("s6_reaches_b25", r6.phases.indexOf('b25')>=0, r6.phases.join());
  ok("s6_enemies_capped",  r6.peak.en<=LIMITS.enemies,  "さいだい"+r6.peak.en+" / じょうげん"+LIMITS.enemies);
  ok("s6_ebullets_capped", r6.peak.eb<=LIMITS.ebullets, "さいだい"+r6.peak.eb+" / じょうげん"+LIMITS.ebullets);
  ok("s6_fxs_capped",      r6.peak.fx<=LIMITS.fxs,      "さいだい"+r6.peak.fx);
  ok("s6_drops_capped",    r6.peak.drops<=LIMITS.drops, "さいだい"+r6.peak.drops);
  ok("s6_texts_capped",    r6.peak.texts<=14,           "さいだい"+r6.peak.texts);
  ok("s6_gems_capped",     r6.peak.gems<=440,           "さいだい"+r6.peak.gems);

  /* ぜんステージの ボスせんで れいがいが でない */
  const bad=[];
  for(let st=1; st<=6; st++){ const r=bossRun(st,120); if(r.err) bad.push("st"+st+": "+r.err);
    if(r.peak.en>LIMITS.enemies) bad.push("st"+st+" てき"+r.peak.en);
    if(r.peak.eb>LIMITS.ebullets) bad.push("st"+st+" だん"+r.peak.eb); }
  ok("all_stages_boss_ok", bad.length===0, bad.join(" / "));

  /* ---- おと: どうじはつおん・バッファ・スロットル ---- */
  audioInit();
  ok("audio_ctx_ready", !!AUD.ctx);
  /* ノイズバッファは 1ぽんだけ つくって つかいまわす */
  AUDSTAT.buffers=0; AUDSTAT.bufferSamples=0;
  for(let i=0;i<200;i++){ noise(0.3,0.3,900); if(typeof voiceFree==='function') voiceFree(); }
  ok("noise_buffer_reused", AUDSTAT.buffers<=1, "AudioBuffer を "+AUDSTAT.buffers+"かい さくせい");
  ok("noise_buffer_small", AUDSTAT.bufferSamples<=44100, "サンプル"+AUDSTAT.bufferSamples);
  /* どうじはつおん数の じょうげん */
  ok("voice_cap_exists", typeof AUD_MAX_VOICES==='number' && AUD_MAX_VOICES>0 && AUD_MAX_VOICES<=32, AUD_MAX_VOICES);
  AUD_VOICES=0;
  for(let i=0;i<500;i++) tone(440,0.1,'square',0.2);
  ok("voice_cap_enforced", AUD_VOICES<=AUD_MAX_VOICES, "どうじはつおん"+AUD_VOICES);
  AUD_VOICES=0;
  /* れんだSEの スロットル(hit/hurt/special) */
  ok("sfx_throttle_exists", typeof sfxOK==='function');
  {
    /* スロットルの まど を ちょくせつ たしかめる（じっこうじかんに たよらない）*/
    _sfxT.hit=-1e9; AUD_VOICES=0;
    const n0=AUDSTAT.nodes; SFX.hit();                 // 1かいめ: なる
    const made1=AUDSTAT.nodes-n0;
    AUD_VOICES=0;
    const n1=AUDSTAT.nodes; SFX.hit();                 // すぐ 2かいめ: スロットルで ならない
    const made2=AUDSTAT.nodes-n1;
    ok("sfx_throttled", made1>0 && made2===0, "1かいめ ノード"+made1+"こ / れんぞく2かいめ "+made2+"こ");
    /* まどが すぎれば また なる ＝ おとが きえて いない */
    _sfxT.hit-=1000; AUD_VOICES=0;
    const n2=AUDSTAT.nodes; SFX.hit();
    ok("sfx_still_plays", AUDSTAT.nodes-n2===made1, "ノード"+(AUDSTAT.nodes-n2)+"こ");
    /* hurt / special にも スロットルが かかっている */
    _sfxT.hurt=-1e9; _sfxT.special=-1e9; AUD_VOICES=0;
    SFX.hurt(); SFX.special(); AUD_VOICES=0;
    const n3=AUDSTAT.nodes; SFX.hurt(); SFX.special();
    ok("sfx_hurt_special_throttled", AUDSTAT.nodes-n3===0, "ノード"+(AUDSTAT.nodes-n3)+"こ");
    AUD_VOICES=0;
  }

  /* ---- はつおんわくが つまらないか(AudioContext が suspended の ばあい) ----
     スマホでは さいしょの タップまで おとが suspended で、onended が はっかしない。
     タイマーの ほけんが ないと はつおんわくが つまって おとが えいきゅうに とまる。 */
  ok("voice_release_exists", typeof voiceRelease==='function');
  {
    AUD_VOICES=0;
    const frees=[];
    const realTimeout=globalThis.__timeouts=[];
    // スタブの setTimeout は なにも しないので、voiceRelease が かえす free を ちょくせつ よぶ
    for(let i=0;i<AUD_MAX_VOICES;i++){ const f=voiceRelease([],0.1); frees.push(f); }
    ok("voice_take_then_release", AUD_VOICES===0, "はつおんわく "+AUD_VOICES);   // voiceRelease は take しない
    AUD_VOICES=0;
    for(let i=0;i<50;i++) tone(440,0.05,'square',0.1);
    const stuck=AUD_VOICES;
    // onended が はっかしなくても、ほけんの free で もどる ことを かくにん
    for(const f of frees) f();
    ok("voice_cap_reached_when_stuck", stuck===AUD_MAX_VOICES, "つまった とき "+stuck);
    AUD_VOICES=0;
    // ほけんの free は なんかい よんでも 1かいしか きかない
    const f1=voiceRelease([],0.1); AUD_VOICES=3; f1(); f1(); f1();
    ok("voice_release_idempotent", AUD_VOICES===2, "はつおんわく "+AUD_VOICES);
    AUD_VOICES=0;
  }

  /* ---- じどう ふかていげん(ECO) ---- */
  ok("eco_exists", typeof ecoTick==='function' && typeof ecoApply==='function' && typeof ecoReset==='function');
  ecoReset();
  ok("eco_starts_at_0", ECO===0 && LIMITS.ebullets===LIMITS_BASE.ebullets);
  for(let i=0;i<25;i++) ecoTick(frameInterval*2);      // おそい フレームを つづける
  ok("eco_steps_down", ECO>=1 && LIMITS.ebullets<LIMITS_BASE.ebullets, "ECO="+ECO+" だん"+LIMITS.ebullets);
  for(let i=0;i<25;i++) ecoTick(frameInterval*2);
  ok("eco_max_is_2", ECO<=2, "ECO="+ECO);
  for(let i=0;i<400;i++) ecoTick(1);                    // はやい フレームが つづけば もどる
  ok("eco_recovers", ECO<2, "ECO="+ECO);
  ecoReset();
  ok("eco_reset_restores", ECO===0 && LIMITS.enemies===LIMITS_BASE.enemies);
  /* ECO ちゅうでも じょうげんを こえない */
  ECO=2; ecoApply();
  { const r=bossRun(6,120); ok("eco_mode_still_capped", !r.err && r.peak.eb<=LIMITS.ebullets && r.peak.en<=LIMITS.enemies,
      (r.err||"")+" だん"+r.peak.eb+"/"+LIMITS.ebullets+" てき"+r.peak.en+"/"+LIMITS.enemies); }
  ecoReset();

  /* ---- ぜつぼうはどう(1フレームの さいだい しょうかん) ---- */
  {
    newGame(); G.stage=6; G.t=BOSS_AT+1;
    const b=makeBoss(100000, G.px, G.py-400);
    G.ebullets.length=0;
    doomBurst(b);
    const n=G.ebullets.length;
    ok("doomburst_reduced", n>0 && n<=60, "1かいで "+n+"はつ（もとは 120はつ）");
  }

  /* ---- ドロップ・ジェムの じょうげん(ちょくせつ おしこんで たしかめる) ---- */
  {
    newGame();
    for(let i=0;i<200;i++) pushDrop({x:0,y:0,type:'heal'});
    ok("drops_capped_by_helper", G.drops.length===LIMITS.drops, "ドロップ"+G.drops.length+" / じょうげん"+LIMITS.drops);
    /* killEnemy けいゆでも あふれない */
    newGame(); G.stage=6;
    for(let i=0;i<400;i++){
      const e={id:eid++,type:'grunt',x:G.px+10,y:G.py+10,hp:0,maxhp:10,spd:0,r:10,dmg:1,xp:2,elite:false,boss:false,hitCD:{},wob:0,dead:true};
      G.enemies.push(e); killEnemy(e);
    }
    ok("drops_capped_via_kills", G.drops.length<=LIMITS.drops, "ドロップ"+G.drops.length);
    ok("gems_capped_via_kills", G.gems.length<=440, "ジェム"+G.gems.length);
  }

  /* ---- てき・てきだんの じょうげんが すべての わきぐちで きく ---- */
  {
    newGame(); G.stage=6;
    for(let i=0;i<800;i++) spawnEnemy('grunt');
    ok("spawnEnemy_capped", G.enemies.length<=LIMITS.enemies, "てき"+G.enemies.length);
    for(let i=0;i<200;i++) spawnElite();
    ok("spawnElite_capped", G.enemies.length<=LIMITS.enemies, "てき"+G.enemies.length);
    G.ebullets.length=0;
    for(let i=0;i<2000;i++) EB(G.px+rnd(-2000,2000),G.py+rnd(-2000,2000),0,100,6,1,5,false);
    trimEbullets(); G.ebullets=G.ebullets.filter(b=>b.life>0);
    ok("trimEbullets_works", G.ebullets.length<=LIMITS.ebullets, "だん"+G.ebullets.length);
    /* がめんないの だんを ゆうせんして のこす */
    G.ebullets.length=0;
    for(let i=0;i<LIMITS.ebullets;i++) EB(G.px,G.py,0,0,6,1,9,false);            // がめんない
    for(let i=0;i<400;i++) EB(G.px+99999,G.py+99999,0,0,6,1,9,false);            // がめんがい
    trimEbullets(); G.ebullets=G.ebullets.filter(b=>b.life>0);
    const onScreen=G.ebullets.filter(b=>Math.abs(b.x-G.px)<W).length;
    ok("trim_prefers_offscreen", onScreen>=LIMITS.ebullets*0.9, "がめんないが "+onScreen+"/"+G.ebullets.length+" のこった");
  }

  /* ---- キャラ・ぶきの ていぎ ---- */
  ok("chars_5", Object.keys(CHARS).length>=5);
  ok("weapons_defined", Object.keys(WDEF).length>0 && Object.values(WDEF).every(w=>w.name&&w.icon));

  globalThis.__SR=results;
})();
`;

let runErr = null;
try {
  new Function(STUBS + "\n" + game + "\n" + SUITE)();
} catch (e) {
  runErr = e;
}

const results = (typeof globalThis !== "undefined" && globalThis.__SR) || [];

console.log("=== ひがしやまサバイバーズ  検証ゲート ===");
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
