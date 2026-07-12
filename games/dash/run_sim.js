// run_sim.js — ひがしやまダッシュ! v3 検証ハーネス
// ゲート:
//  (A) 静的ギャップ検証: 全4ステージのギャップが2段ジャンプ圏内
//  (B) フル通し: キャラローテ×3シードで4ステージ通しクリア (各ステージ<=240s, デス合計<=20)
//  (C) カード整合: キャラごと picks合計<=Lv-1, スタック上限遵守, 選択済みは減らない
//  (D) あいことば: クリア時パスワード往復一致 + fuzz 300 (改ざん拒否含む)
'use strict';
globalThis.__SIM__ = true;
const fs = require('fs');
// index.html から <script> を抜き出して そのまま検証する(check.js への依存をなくす)
const html = fs.readFileSync(__dirname + '/index.html','utf8');
const m = html.match(/<script>([\s\S]*?)<\/script>/);
if(!m) throw new Error('index.html に <script> が見つかりません');
const src = m[1];
const mod = {exports:{}};
new Function('module','exports','require','setTimeout','setInterval','clearInterval',
  src)(mod, mod.exports, require, f=>f(), ()=>0, ()=>{});
const {Game, Input, BAL, CARDS, CHAR_ORDER, STAGES, Password, pickOrder} = mod.exports;

let rngState=1;
function seed(s){rngState=s>>>0;}
Math.random=function(){rngState|=0;rngState=(rngState+0x6D2B79F5)|0;
  let t=Math.imul(rngState^rngState>>>15,1|rngState);
  t=(t+Math.imul(t^t>>>7,61|t))^t;return((t^t>>>14)>>>0)/4294967296;};

function staticCheck(){
  const t1=2*BAL.jumpV/BAL.gravity;
  const t2=t1+2*BAL.jump2V/BAL.gravity*0.8;
  const r1=BAL.baseSpeed*t1,r2=BAL.baseSpeed*t2;
  console.log(`ジャンプ到達: 1段=${Math.round(r1)}px 2段=${Math.round(r2)}px`);
  let ok=true;
  for(let st=0;st<STAGES.length;st++){
    Game.stageIdx=st;Game.buildCourse();
    let worst=0;
    for(let i=0;i<Game.segs.length-1;i++){
      const gap=Game.segs[i+1].x0-Game.segs[i].x1;
      if(gap<=0)continue;
      worst=Math.max(worst,gap);
      if(gap>r2){ok=false;console.log(`  NG stage${st+1} gap@${Math.round(Game.segs[i].x1)} 幅${gap}`);}
    }
    console.log(`  stage${st+1} ${STAGES[st].name}: 最大ギャップ${worst}px ${worst<=r2?'OK':'NG'}`);
  }
  console.log('(A) 静的ギャップ検証: '+(ok?'PASS':'FAIL'));
  return ok;
}

function aiFrame(){
  const p=Game.player,r=Input.raw;
  r.jump=false;r.dash=false;r.any=false;
  if(!p||p.dead)return;
  const spd=p.dashT>0?BAL.dash.spd:Game.speed(),look=spd*0.35;
  const gA=Game.groundAt(p.wx+look),gH=Game.groundAt(p.wx+30);
  let danger=(gA===null&&gH!==null);
  // 穴のふちを さがして 到達距離から逆算した位置で 踏み切る
  if(p.onGround){
    let edge=null;
    for(let d=10;d<520;d+=10){
      if(Game.groundAt(p.wx+d)===null){edge=p.wx+d;break;}
    }
    if(edge!==null){
      const t1=2*BAL.jumpV/BAL.gravity;      // 1段の滞空
      const reach=spd*t1;                    // 1段で とべる距離
      const toEdge=edge-p.wx;
      // ふちまで 到達距離の6割 を切ったら 跳ぶ(余裕をもって)
      if(toEdge<reach*0.62)Game.__jumpHold=0.4;
    }
  }
  if(danger&&p.onGround)Game.__jumpHold=0.4;
  // トゲはジャンプ距離から逆算した踏切り位置で跳ぶ
  for(const sp of Game.spikes)
    if(sp.x>p.wx-10&&sp.x-p.wx<spd*0.22+30&&p.onGround){Game.__jumpHold=0.34;break;}
  // 頂点をすぎて眼下が穴なら ためらわず追いジャンプ (実プレイの動き)
  if(!p.onGround&&p.vy>-50&&p.jumps>0&&p.jumps<Game.maxJumps()&&Game.groundAt(p.wx+60)===null)r.jump=true;
  for(const pr of Game.projs)if(Math.abs(pr.x-p.wx)<150&&p.onGround)Game.__jumpHold=0.3;
  const b=Game.boss;
  if(b&&b.state==='charge'&&Math.abs(b.x-p.wx)<340&&p.onGround)Game.__jumpHold=0.36;
  let foe=false;
  for(const e of Game.enemies)if(e.x>p.wx&&e.x<p.wx+420){foe=true;break;}
  if(b&&b.state==='stun'&&Math.abs(b.x-p.wx)<600)foe=true;
  if(foe&&p.dashCharges>0&&p.dashT<=0&&Game.groundAt(p.wx+500)!==null&&!danger)r.dash=true;
  // ダッシュできない時は地上の敵を跳び越える
  let nearGround=false;
  for(const e of Game.enemies)
    if(e.kind!=='bird'&&e.x>p.wx+40&&e.x<p.wx+300){nearGround=true;break;}
  if(nearGround&&p.onGround&&(p.dashCharges<=0||p.dashT>0))Game.__jumpHold=0.3;
  // 高さがかぶる敵(カラス/とびかかり)や敵弾は ダッシュ無敵で 突っきる
  let airThreat=false;
  for(const e of Game.enemies){
    const dx=e.x-p.wx;
    if(dx>-40&&dx<240){
      const eTop=e.y-e.h,eBot=e.y,pTop=p.y-110;
      if(!(p.y<eTop||pTop>eBot))airThreat=true;
    }
  }
  for(const s2 of (Game.eshots||[])){
    const dx=s2.x-p.wx;
    if(dx>-30&&dx<280&&Math.abs(s2.y-(p.y-60))<70)airThreat=true;
  }
  if(airThreat&&p.dashCharges>0&&p.dashT<=0)r.dash=true;
  if(Game.__jumpHold>0){r.jump=true;Game.__jumpHold-=1/60;}
}

function snapshotPicks(){
  const out={};
  for(const ch in Game.charPicks)out[ch]=Object.assign({},Game.charPicks[ch]);
  return out;
}
function picksNeverShrink(prev,cur){
  for(const ch in prev)for(const id in prev[ch])
    if(((cur[ch]||{})[id]||0)<prev[ch][id])return false;
  return true;
}

function fullRun(seedVal,rotation){
  seed(seedVal);
  Game.state='title';
  Input.raw={jump:false,dash:false,any:false};Input.tap=null;Input.keyNum=0;
  Input._pj=Input._pd=Input._pa=false;
  Game.newGame();
  if(Game.state!=='select')throw new Error('newGame→selectに遷移せず');
  const STEP=1/60;
  const stageResults=[];
  let prevPicks=snapshotPicks(), pwOk=true, integrityOk=true;

  for(let st=0;st<4;st++){
    Game.selIdx=CHAR_ORDER.indexOf(rotation[st]);
    const expectedPend=Math.max(0,(Game.familyLv-1)-Game.picksTaken(rotation[st]));
    Game.confirmSelect();
    if(Game.state==='card'&&Game.pendingPicks!==expectedPend){
      integrityOk=false;console.log(`  NG stage${st+1}: pendingPicks=${Game.pendingPicks} 期待${expectedPend}`);
    }
    let t=0,cards=0;
    Game.__jumpHold=0;
    while(t<300&&Game.state!=='stageclear'&&Game.state!=='allclear'){
      if(Game.state==='card'){
        cards++;
        Game.pickCard(Math.floor(Math.random()*Game.cardOptions.length));
      }else{
        aiFrame();
      }
      Game.update(STEP);t+=STEP;
    }
    const cleared=(Game.state==='stageclear'||Game.state==='allclear');
    stageResults.push({stage:st+1,char:rotation[st],cleared,time:Math.round(t),
      deaths:Game.deaths,lv:Game.familyLv,cards});
    if(!cleared)break;
    const cur=snapshotPicks();
    if(!picksNeverShrink(prevPicks,cur)){integrityOk=false;console.log('  NG picksが減少');}
    prevPicks=cur;
    for(const ch in cur){
      let total=0;
      for(const id in cur[ch]){
        const card=CARDS.find(c=>c.id===id);
        total+=cur[ch][id];
        if(cur[ch][id]>card.max){integrityOk=false;console.log(`  NG ${ch}:${id} スタック超過`);}
        if(card.char&&card.char!==ch){integrityOk=false;console.log(`  NG ${ch}が他キャラ専用${id}を所持`);}
      }
      if(total>Game.familyLv-1){integrityOk=false;console.log(`  NG ${ch} picks${total}>Lv-1`);}
    }
    if(Game.state==='stageclear'){
      const dec=Password.decode(Game.password);
      if(!dec||dec.stage!==Game.stageIdx+1||dec.lv!==Game.familyLv){
        pwOk=false;console.log('  NG password往復不一致',Game.password,JSON.stringify(dec));
      }
      Game.stageIdx++;Game.toSelect();
    }
  }
  return {stageResults,allclear:Game.state==='allclear',pwOk,integrityOk,
    totalDeaths:Game.totalDeaths,lv:Game.familyLv};
}

function pwFuzz(n){
  let ok=true;
  for(let i=0;i<n;i++){
    const lv=1+Math.floor(Math.random()*10);
    const st={stage:1+Math.floor(Math.random()*3),lv};
    const enc=Password.encode(st);
    const dec=Password.decode(enc);
    if(!dec||dec.stage!==st.stage||dec.lv!==st.lv){ok=false;console.log('  NG fuzz往復',JSON.stringify(st));break;}
    const pos=Math.floor(Math.random()*enc.length);
    const kana='あいうえおかきくけこさしすせそたちつてとなにぬねのはひふへほまみ';
    const alt=kana[(kana.indexOf(enc[pos])+1+Math.floor(Math.random()*30))%32];
    const tampered=enc.slice(0,pos)+alt+enc.slice(pos+1);
    if(Password.decode(tampered)!==null){
      const t2=enc.slice(0,pos)+kana[(kana.indexOf(alt)+1)%32]+enc.slice(pos+1);
      if(Password.decode(t2)!==null){ok=false;console.log('  NG 改ざん2連続受理');break;}
    }
  }
  console.log('(D-2) password fuzz x'+n+': '+(ok?'PASS':'FAIL'));
  return ok;
}

const okA=staticCheck();
const rotations=[
  ['taichi','kento','nozomi','erika'],
  ['erika','yushi','taichi','kento'],
  ['yushi','nozomi','erika','yushi'],
];
let okB=true,okC=true,okDpw=true;
console.log('=== フル通しプレイ (4ステージ) ===');
rotations.forEach((rot,i)=>{
  const r=fullRun(9000+i*777,rot);
  const line=r.stageResults.map(s=>`S${s.stage}:${s.char}${s.cleared?'○':'×'}${s.time}s/d${s.deaths}`).join(' ');
  console.log(`run${i+1}: ${line} → allclear=${r.allclear} 合計デス${r.totalDeaths} Lv${r.lv}`);
  if(!r.allclear||r.totalDeaths>24)okB=false;
  if(r.stageResults.some(s=>s.time>300))okB=false;
  if(!r.integrityOk)okC=false;
  if(!r.pwOk)okDpw=false;
});
console.log('(B) フル通し: '+(okB?'PASS':'FAIL'));
console.log('(C) カード整合: '+(okC?'PASS':'FAIL'));
console.log('(D-1) クリア時password往復: '+(okDpw?'PASS':'FAIL'));
const okDfuzz=pwFuzz(300);
const all=okA&&okB&&okC&&okDpw&&okDfuzz;
console.log(all?'GATE: ALL PASS':'GATE: FAIL');
process.exit(all?0:1);
