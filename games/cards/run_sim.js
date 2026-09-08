// run_sim.js — アニマルカードバトル(仮) 検証ゲート
// games/dash/run_sim.js の方式を踏襲: index.html から <script> を抜き出してNode上で検証する。
//
// index.html には <script> が3つ(ai.js/engine.js/app.js)ある。app.jsはDOMを触るので
// Nodeでは動かせない。マーカーコメント(// ==== ai.js ==== / // ==== engine.js ====)で
// ブロックを識別し、ai と engine の2つだけを評価する。両ブロックはUMD形式(module.exports
// を持つ)なので、module/exportsを渡せばNodeで動く。engine.jsは内部で require('./ai.js')
// するため、その呼び出しだけ先に評価済みのAIモジュールへすり替える(games/cards単体で
// 完結させ、proto/のファイルはrequireしない)。
//
// 検証内容は proto/test.js の全項目を移植したもの:
//   (1) v3プールの予算・上限チェック(24種・レアリティ別6/6/6/6・icon設定)
//   (2) 先攻1ターン目ドローなし／後攻1ターン目のコスト2枚
//   (3) 召喚酔い／場の占有4点制限／コスト不足の拒否
//   (4) ダメージ計算・累積・死亡・直接攻撃・退却・山札切れ
//   (5) greedy同士1,000試合の自動対戦(打ち切り0件・引き分け0件・先攻勝率40〜55%)
'use strict';
const fs = require('fs');

const html = fs.readFileSync(__dirname + '/index.html', 'utf8');

function extractScriptBlock(marker) {
  const startIdx = html.indexOf(marker);
  if (startIdx === -1) throw new Error('index.html に ' + marker + ' が見つかりません');
  const afterMarker = startIdx + marker.length;
  const endIdx = html.indexOf('</script>', afterMarker);
  if (endIdx === -1) throw new Error(marker + ' に対応する </script> が見つかりません');
  return html.slice(afterMarker, endIdx);
}

function loadModule(src, requireFn) {
  const mod = { exports: {} };
  new Function('module', 'exports', 'require', src)(mod, mod.exports, requireFn || require);
  return mod.exports;
}

const aiSrc = extractScriptBlock('// ==== ai.js ====');
const engineSrc = extractScriptBlock('// ==== engine.js ====');

const AI = loadModule(aiSrc);
const Engine = loadModule(engineSrc, function (name) {
  if (name === './ai.js') return AI;
  return require(name);
});

// -----------------------------------------------------------------------
// 簡易テストハーネス(proto/test.jsと同じ方式)
// -----------------------------------------------------------------------
let failCount = 0;
let passCount = 0;

function ok(cond, msg) {
  if (cond) {
    passCount++;
  } else {
    failCount++;
    console.error('  NG: ' + msg);
  }
}
function eq(actual, expected, msg) {
  ok(actual === expected, msg + ' (期待=' + expected + ', 実際=' + actual + ')');
}
function section(title) {
  console.log('\n== ' + title + ' ==');
}
function makeCard(name, rarity, atk, df, hp) {
  const RARITY_NUM = Engine.RARITY_NUM;
  return { name: name, rarity: rarity, atk: atk, df: df, hp: hp, role: '', rarityNum: RARITY_NUM[rarity] };
}

// -----------------------------------------------------------------------
// (1) v3プール24種の予算・上限チェック
// -----------------------------------------------------------------------
section('(1) v3プールの予算・上限チェック');
{
  const pool = Engine.CARD_POOL_V3;
  eq(pool.length, 24, 'v3プールは24種');
  const errors = Engine.validatePool(pool, Engine.RARITY_RULES_V3, Engine.ATK_MIN_V3);
  ok(errors.length === 0, 'v3プールは予算・上限に違反がない: ' + errors.join('; '));

  ['C', 'UC', 'R', 'SR'].forEach(function (r) {
    const n = pool.filter(function (c) { return c.rarity === r; }).length;
    eq(n, 6, 'レアリティ' + r + 'は6種');
  });

  pool.forEach(function (c) {
    ok(typeof c.icon === 'string' && c.icon.length > 0, c.name + ' に icon が設定されている');
  });
}

// -----------------------------------------------------------------------
// (2) 先攻1ターン目ドローなし／後攻1ターン目のコスト2枚
// -----------------------------------------------------------------------
section('(2) 先攻1ターン目ドローなし／後攻1ターン目コスト2枚');
{
  const rng = Engine.makeRng(1);
  const deck0 = Engine.buildDeck(Engine.CARD_POOL_V3, 20, rng, 2);
  const deck1 = Engine.buildDeck(Engine.CARD_POOL_V3, 20, rng, 2);
  const state = Engine.newGame(deck0, deck1, 0, rng, ['human', 'human']);
  eq(state.players[0].hand.length, 5, '初期手札(先攻)は5枚');
  eq(state.players[1].hand.length, 5, '初期手札(後攻)は5枚');

  Engine.beginTurn(state);
  eq(state.acting, 0, '1ターン目は先攻(P0)');
  eq(state.players[0].hand.length, 5, '先攻1ターン目はドローなし(手札5枚のまま)');
  eq(state.chargeLimit, 1, '先攻1ターン目のためる上限は1枚');

  Engine.advanceToPlay(state);
  Engine.advanceToBattle(state);
  Engine.endTurn(state);

  eq(state.acting, 1, '2ターン目は後攻(P1)');
  eq(state.players[1].hand.length, 6, '後攻1ターン目は1枚ドローして6枚');
  eq(state.chargeLimit, 2, '後攻1ターン目のためる上限は2枚');

  let placed = 0;
  while (Engine.canChargeMore(state)) {
    const c = state.players[1].hand[0];
    if (Engine.chargeCard(state, c)) placed++;
  }
  eq(placed, 2, '後攻1ターン目は実際に2枚コストに置ける');
  eq(state.players[1].costTotal, 2, 'コスト置き場は2枚');
}

// -----------------------------------------------------------------------
// (3) 召喚酔い、場の占有4点制限、コスト不足の拒否
// -----------------------------------------------------------------------
section('(3) 召喚酔い／場の占有4点制限／コスト不足の拒否');
{
  const rng = Engine.makeRng(2);
  const deck0 = Engine.buildDeck(Engine.CARD_POOL_V3, 20, rng, 2);
  const deck1 = Engine.buildDeck(Engine.CARD_POOL_V3, 20, rng, 2);
  const state = Engine.newGame(deck0, deck1, 0, rng, ['human', 'human']);
  Engine.beginTurn(state);
  Engine.advanceToPlay(state);

  const p = state.players[0];
  const cCard = makeCard('テストC', 'C', 3, 1, 2);
  p.hand.push(cCard);
  p.costTotal = 1;

  const ucCard = makeCard('テストUC', 'UC', 4, 2, 3);
  p.hand.push(ucCard);
  const checkUC = Engine.canSummon(state, ucCard);
  eq(checkUC.ok, false, 'コスト不足のUCは出せない');

  const checkC = Engine.canSummon(state, cCard);
  eq(checkC.ok, true, 'コストが足りるCは出せる');
  Engine.summon(state, cCard);
  eq(p.field.length, 1, '召喚後、場に1体いる');

  Engine.advanceToBattle(state);
  eq(state.battleRemaining.length, 0, '召喚したばかりのモンスターは今ターン攻撃できない(召喚酔い)');

  const state2 = Engine.newGame(Engine.buildDeck(Engine.CARD_POOL_V3, 20, rng, 2), Engine.buildDeck(Engine.CARD_POOL_V3, 20, rng, 2), 0, rng, ['human', 'human']);
  Engine.beginTurn(state2);
  Engine.advanceToPlay(state2);
  const p2 = state2.players[0];
  const srOnField = makeCard('テストSR', 'SR', 8, 3, 7);
  p2.field.push({ card: srOnField, damage: 0, enteredPly: -999 });
  const anotherC = makeCard('テストC2', 'C', 3, 1, 2);
  p2.hand.push(anotherC);
  p2.costTotal = 4;
  const checkFull = Engine.canSummon(state2, anotherC);
  eq(checkFull.ok, false, '場が占有4点でいっぱいなら追加召喚できない');
}

// -----------------------------------------------------------------------
// (4) ダメージ計算・累積・死亡・直接攻撃・退却・山札切れ
// -----------------------------------------------------------------------
section('(4) ダメージ計算・累積・死亡・直接攻撃・退却・山札切れ');
{
  const atkCard = makeCard('こうげき', 'C', 3, 0, 2);
  const defCard = makeCard('かべ', 'UC', 4, 5, 3);
  eq(Engine.attackDamagePreview(atkCard, defCard), 0, 'ATK-DEFが負なら0');

  const rng = Engine.makeRng(3);
  const deck0 = Engine.buildDeck(Engine.CARD_POOL_V3, 20, rng, 2);
  const deck1 = Engine.buildDeck(Engine.CARD_POOL_V3, 20, rng, 2);
  const state = Engine.newGame(deck0, deck1, 0, rng, ['human', 'human']);
  Engine.beginTurn(state);
  Engine.advanceToPlay(state);

  const attacker = { card: makeCard('こうげき2', 'C', 3, 0, 2), damage: 0, enteredPly: -999 };
  const defender = { card: makeCard('たいきゅう', 'UC', 4, 0, 5), damage: 0, enteredPly: -999 };
  state.players[0].field.push(attacker);
  state.players[1].field.push(defender);

  Engine.advanceToBattle(state);
  const res1 = Engine.attack(state, attacker, defender);
  ok(res1.ok, '1回目の攻撃が成立する');
  eq(res1.dmg, 3, 'ダメージ=ATK3-DEF0=3');
  eq(defender.damage, 3, '防御側にダメージが蓄積される');
  eq(res1.killed, false, 'hp5に3ダメージではまだ死なない');

  Engine.endTurn(state);
  eq(defender.damage, 3, 'ターンをまたいでもダメージは残る');
  Engine.endTurn(state);
  Engine.advanceToPlay(state);
  Engine.advanceToBattle(state);
  eq(state.battleRemaining.indexOf(attacker) >= 0, true, '2ターン目も攻撃者は攻撃できる');
  const hpBeforeDeath = state.players[1].hp;
  const res2 = Engine.attack(state, attacker, defender);
  eq(res2.dmg, 3, '2回目のダメージも3');
  eq(defender.damage, 6, '累積ダメージは6 (3+3)');
  eq(res2.killed, true, '累積6 >= hp5 で死亡');
  eq(state.players[1].hp, hpBeforeDeath - defender.card.rarityNum, '死亡時、持ち主(P1)にレアリティ分(UC=2)の本体ダメージ');
  eq(state.damageBySource.death >= defender.card.rarityNum, true, 'damageBySource.deathが記録される');

  const rng2 = Engine.makeRng(4);
  const s2 = Engine.newGame(Engine.buildDeck(Engine.CARD_POOL_V3, 20, rng2, 2), Engine.buildDeck(Engine.CARD_POOL_V3, 20, rng2, 2), 0, rng2, ['human', 'human']);
  Engine.beginTurn(s2);
  Engine.advanceToPlay(s2);
  const directAttacker = { card: makeCard('とっしん', 'SR', 8, 2, 8), damage: 0, enteredPly: -999 };
  s2.players[0].field.push(directAttacker);
  Engine.advanceToBattle(s2);
  const hpBefore = s2.players[1].hp;
  const res3 = Engine.attack(s2, directAttacker, null);
  ok(res3.ok && res3.direct, '相手の場が空なら直接攻撃になる');
  eq(res3.dmg, directAttacker.card.rarityNum, '直接攻撃ダメージ=攻撃側のレアリティ数(SR=4)');
  eq(s2.players[1].hp, hpBefore - directAttacker.card.rarityNum, '直接攻撃で本体ダメージが入る');

  const rng3 = Engine.makeRng(5);
  const s3 = Engine.newGame(Engine.buildDeck(Engine.CARD_POOL_V3, 20, rng3, 2), Engine.buildDeck(Engine.CARD_POOL_V3, 20, rng3, 2), 0, rng3, ['human', 'human']);
  Engine.beginTurn(s3);
  Engine.advanceToPlay(s3);
  const retreatMon = { card: makeCard('たいきゃく', 'R', 6, 3, 4), damage: 0, enteredPly: -999 };
  s3.players[0].field.push(retreatMon);
  const hpBeforeRetreat = s3.players[0].hp;
  Engine.retreat(s3, retreatMon);
  eq(s3.players[0].hp, hpBeforeRetreat - retreatMon.card.rarityNum, '退却でレアリティ分(R=3)の本体ダメージ');
  eq(s3.players[0].field.length, 0, '退却したモンスターは場からいなくなる');

  const rng4 = Engine.makeRng(6);
  const s4 = Engine.newGame(Engine.buildDeck(Engine.CARD_POOL_V3, 20, rng4, 2), Engine.buildDeck(Engine.CARD_POOL_V3, 20, rng4, 2), 0, rng4, ['human', 'human']);
  s4.players[1].deck = [];
  Engine.beginTurn(s4);
  Engine.advanceToPlay(s4);
  Engine.advanceToBattle(s4);
  Engine.endTurn(s4);
  eq(s4.players[1].hp, 9, '山札切れで本体1ダメージ (10→9)');
  eq(s4.damageBySource.deckout, 1, 'damageBySource.deckoutが1になる');
}

// -----------------------------------------------------------------------
// (5) greedy同士1,000試合の自動対戦
// -----------------------------------------------------------------------
section('(5) greedy同士 1,000試合');
let simOk = true;
{
  const N = 1000;
  const rng = Engine.makeRng(20260906);
  let firstWins = 0;
  let draws = 0;
  let cutoffs = 0;
  let totalPlies = 0;
  let maxPlies = 0;

  for (let i = 0; i < N; i++) {
    const firstIdx = i % 2;
    const deckFirst = Engine.buildDeck(Engine.CARD_POOL_V3, 20, rng, 2);
    const deckSecond = Engine.buildDeck(Engine.CARD_POOL_V3, 20, rng, 2);
    const decks = firstIdx === 0 ? [deckFirst, deckSecond] : [deckSecond, deckFirst];
    const result = Engine.simulateGame(decks[0], decks[1], firstIdx, rng);

    totalPlies += result.ply;
    if (result.ply > maxPlies) maxPlies = result.ply;
    if (result.endReason.indexOf('打ち切り') === 0) cutoffs++;
    if (result.winner === null) {
      draws++;
    } else if (result.winner === firstIdx) {
      firstWins++;
    }
  }

  const firstWinRate = firstWins / N;
  const avgPlies = totalPlies / N;

  console.log('試合数=' + N + ', 先攻勝ち=' + firstWins + ', 引き分け/打ち切り=' + draws + ', 打ち切り数=' + cutoffs);
  console.log('先攻勝率=' + (firstWinRate * 100).toFixed(1) + '%, 平均ply(両者合計)=' + avgPlies.toFixed(2) + ', 最大ply=' + maxPlies);

  eq(cutoffs, 0, '打ち切りは0件(全試合が決着する)');
  eq(draws, 0, '引き分けは0件');
  ok(firstWinRate >= 0.40 && firstWinRate <= 0.55, '先攻勝率が40〜55%に入る (実際=' + (firstWinRate * 100).toFixed(1) + '%)');
  if (cutoffs !== 0 || draws !== 0 || !(firstWinRate >= 0.40 && firstWinRate <= 0.55)) simOk = false;
}

// -----------------------------------------------------------------------
// (6) チュートリアル(はじめてあそぶ)が筋書きどおりに進むか
// app.js ブロックの TUTORIAL_DATA マーカーから配りものと あいての手順を取り出し、
// 実際のルールエンジンで最後まで再現して確認する。カード名の打ちまちがいや
// バランス調整で筋書きが崩れたら、ここで落ちる。
// -----------------------------------------------------------------------
section('(6) チュートリアルの筋書き');
{
  ['id="btn-tutorial"', 'id="screen-tutorial-end"', 'id="tutor-panel"', 'id="btn-tutor-next"', 'id="hand-wrap"']
    .forEach(function (needle) {
      ok(html.indexOf(needle) >= 0, 'index.html に ' + needle + ' がある(ビルド忘れ検出)');
    });

  // 内部名「コスト」は画面ではすべて「おうえん」と呼ぶ。片方だけ直した状態を検出する。
  ['おうえんに まわす', 'いまは【おうえん】', '>おうえん<', 'おうえんが たりない']
    .forEach(function (needle) {
      ok(html.indexOf(needle) >= 0, '画面の言い方が「おうえん」に そろっている: ' + needle);
    });
  ['つかえるコスト', 'コストにする', 'いまは【ためる】'].forEach(function (needle) {
    ok(html.indexOf(needle) === -1, '古い「コスト」表記が のこっていない: ' + needle);
  });

  const appSrc = extractScriptBlock('// ==== app.js ====');
  const dataStart = appSrc.indexOf('// ==== TUTORIAL_DATA_BEGIN ====');
  const dataEnd = appSrc.indexOf('// ==== TUTORIAL_DATA_END ====');
  ok(dataStart >= 0 && dataEnd > dataStart, 'app.js に TUTORIAL_DATA ブロックがある');
  const TUT = new Function(appSrc.slice(dataStart, dataEnd) + '; return TUT_DATA;')();

  const WAITS = ['charge', 'summon', 'phase:play', 'phase:battle', 'select', 'attack', 'endTurn'];
  const waits = (appSrc.match(/wait: '([^']+)'/g) || []).map(function (s) { return s.slice(7, -1); });
  ok(waits.length > 0, 'チュートリアルの手順(wait)が定義されている');
  ok(waits.every(function (w) { return WAITS.indexOf(w) >= 0; }), 'wait はすべて既知の種類: ' + waits.join(','));

  const byName = {};
  Engine.CARD_POOL_V3.forEach(function (c) { byName[c.name] = c; });
  const allNames = [].concat(
    TUT.hand0, TUT.deck0, TUT.hand1, TUT.deck1,
    TUT.oppScript.reduce(function (acc, s) { return acc.concat(s.charge, s.summon ? [s.summon] : []); }, [])
  );
  const missing = allNames.filter(function (n) { return !byName[n]; });
  ok(missing.length === 0, 'チュートリアルのカード名がすべて実在する: ' + missing.join(', '));

  function names(list) { return list.map(function (n) { return byName[n]; }); }
  function handCardByName(p, name) {
    for (let i = 0; i < p.hand.length; i++) if (p.hand[i].name === name) return p.hand[i];
    return null;
  }

  const rng = Engine.makeRng(7);
  const state = Engine.newGame(names(TUT.deck0), names(TUT.deck1), 0, rng, ['human', 'cpu']);
  const p0 = state.players[0], p1 = state.players[1];
  p0.hand = names(TUT.hand0);
  p0.deck = names(TUT.deck0).reverse();
  p1.hand = names(TUT.hand1);
  p1.deck = names(TUT.deck1).reverse();

  // あいての1ターン(app.jsのrunTutorialOppTurnと同じ手順)。
  function runOppTurn(turnIdx) {
    const sc = TUT.oppScript[turnIdx] || { charge: [], summon: null };
    for (let i = 0; i < sc.charge.length; i++) {
      if (!Engine.canChargeMore(state)) break;
      const c = handCardByName(p1, sc.charge[i]) || p1.hand[0];
      if (!c) break;
      Engine.chargeCard(state, c);
    }
    Engine.advanceToPlay(state);
    const summonable = p1.hand.filter(function (c) { return Engine.canSummon(state, c).ok; });
    if (sc.summon) {
      const s = handCardByName(p1, sc.summon);
      ok(!!s && Engine.canSummon(state, s).ok, 'あいての' + (turnIdx + 1) + 'ターンめ: 「' + sc.summon + '」を だせる');
      Engine.summon(state, s);
    } else {
      eq(summonable.length, 0, 'あいての' + (turnIdx + 1) + 'ターンめ: だせるカードが1枚もない(コスト不足の説明どおり)');
    }
    Engine.advanceToBattle(state);
    Engine.endTurn(state);
  }

  // --- じぶんの1ターンめ: ためる1 → ★1を だす → 召喚酔いで こうげきできない ---
  Engine.beginTurn(state);
  eq(state.chargeLimit, 1, 'チュートリアル1ターンめ: コストは1枚だけ おける');
  Engine.chargeCard(state, p0.hand[0]);
  Engine.advanceToPlay(state);
  const firstSummon = p0.hand.filter(function (c) { return c.rarityNum === 1 && Engine.canSummon(state, c).ok; })[0];
  ok(!!firstSummon, '1ターンめの手札に コスト1で だせる★1のカードがある');
  const tooExpensive = p0.hand.filter(function (c) { return !Engine.canSummon(state, c).ok; });
  ok(tooExpensive.length > 0, '1ターンめの手札に まだ だせない(★が大きい)カードもある(★の説明用)');
  Engine.summon(state, firstSummon);
  Engine.advanceToBattle(state);
  eq(state.battleRemaining.length, 0, '1ターンめ: だしたばかりなので こうげきできない(召喚酔い)');
  Engine.endTurn(state);

  runOppTurn(0);
  eq(p1.field.length, 1, 'あいての1ターンめのあと、あいての ばに モンスターが1体いる');

  // --- じぶんの2ターンめ: ためる1 → だすは とばす → こうげきして やっつける ---
  const myMon = p0.field[0];
  Engine.chargeCard(state, p0.hand[0]);
  Engine.advanceToPlay(state);
  Engine.advanceToBattle(state);
  ok(Engine.canAttack(state, myMon), '2ターンめ: 1ターンめに だした モンスターは こうげきできる');
  const target = p1.field[0];
  ok(Engine.attackDamagePreview(myMon.card, target.card) > 0, '2ターンめ: あいてに 1いじょうの ダメージを あたえられる');
  const oppHpBefore = p1.hp;
  const res = Engine.attack(state, myMon, target);
  eq(res.killed, true, '2ターンめ: 1かいの こうげきで あいての モンスターを たおせる');
  eq(p1.hp, oppHpBefore - target.card.rarityNum, 'たおした とき、もちぬしに ★のかず だけ 本体ダメージ');
  eq(p1.field.length, 0, 'あいての ばが からっぽに なる');
  Engine.endTurn(state);

  runOppTurn(1);
  eq(p1.field.length, 0, 'あいての2ターンめのあとも あいての ばは からっぽ(ちょくせつこうげきの説明ができる)');

  // --- じぶんの3ターンめ: ちょくせつこうげき ---
  Engine.advanceToPlay(state);
  Engine.advanceToBattle(state);
  ok(Engine.canAttack(state, myMon), '3ターンめ: じぶんの モンスターは まだ ばにいて こうげきできる');
  const hpBeforeDirect = p1.hp;
  const res2 = Engine.attack(state, myMon, null);
  ok(res2.ok && res2.direct, '3ターンめ: あいての ばが からっぽなので ちょくせつこうげきになる');
  eq(p1.hp, hpBeforeDirect - myMon.card.rarityNum, 'ちょくせつこうげきの ダメージは ★のかず');
  eq(state.phase !== 'gameover', true, 'チュートリアルの とちゅうで しょうぶが ついてしまわない');
}

// -----------------------------------------------------------------------
console.log('\n=== 結果: PASS=' + passCount + ' FAIL=' + failCount + ' ===');
const all = failCount === 0 && simOk;
console.log(all ? 'GATE: ALL PASS' : 'GATE: FAIL');
process.exit(all ? 0 : 1);
