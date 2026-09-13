
// engine.js
// アニマルカードバトル(仮) ルールエンジン（企画書_v0.2 準拠）。
// sim/engine.py + sim/cards.py の v3 プールをブラウザ/Node両対応のJSに移植したもの。
// ブラウザでは <script src="engine.js"><\/script> で読み込み、Nodeでは require で使う。
//
// 設計方針:
//   - このプロトタイプは企画書v0.2の値に「固定」する（Config切り替えは実装しない）。
//   - CPU戦・ふたり戦のどちらのUIからも、フェーズごとの「1手」を刻んで進められるように
//     charge/play/battle の各フェーズは「1ステップ実行」できる関数を用意する。
//     これにより CPU の手も0.6秒間隔で1つずつ画面に反映でき、
//     test.js の自動対戦（高速に最後まで回す）も同じ関数で実現できる。

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(require('./ai.js'));
  } else {
    root.Engine = factory(root.AI);
  }
})(typeof self !== 'undefined' ? self : this, function (AI) {
  'use strict';

  var FIELD_CAP = 4;
  var RARITY_NUM = { C: 1, UC: 2, R: 3, SR: 4 };

  // ---------------------------------------------------------------------
  // カードプール v3（企画書_v0.2 3.5節 / sim/cards.py BASE_POOL_V3 そのまま）
  // ---------------------------------------------------------------------
  // icon: レアリティが上がるほど生き物が大きくなる階段(むし→どうぶつ→もうじゅう→きょうりゅう)。
  // 世界観は未確定のため、あとで本番の絵に差し替えやすいよう1か所(ここ)で管理する。
  function card(name, rarity, atk, df, hp, role, icon) {
    return { name: name, rarity: rarity, atk: atk, df: df, hp: hp, role: role || '', rarityNum: RARITY_NUM[rarity], icon: icon || '' };
  }

  var CARD_POOL_V3 = [
    card('C-バランス', 'C', 3, 1, 2, 'バランス', '🦗'),
    card('C-とっこう', 'C', 4, 0, 2, 'とっこう', '🐝'),
    card('C-かたい', 'C', 3, 2, 1, 'かたい', '🐞'),
    card('C-体力型', 'C', 3, 0, 3, '体力型', '🐛'),
    card('C-攻撃型', 'C', 4, 1, 1, '攻撃型', '🕷️'),
    card('C-よわい', 'C', 3, 1, 1, 'よわい', '🐜'),
    card('UC-バランス', 'UC', 4, 2, 3, 'バランス', '🦊'),
    card('UC-攻撃型', 'UC', 5, 1, 3, '攻撃型', '🐍'),
    card('UC-かたい', 'UC', 4, 3, 2, 'かたい', '🐢'),
    card('UC-とっこう', 'UC', 5, 0, 4, 'とっこう', '🐗'),
    card('UC-体力型', 'UC', 4, 1, 4, '体力型', '🦡'),
    card('UC-攻守型', 'UC', 5, 2, 2, '攻守型', '🐺'),
    card('R-バランス', 'R', 6, 3, 4, 'バランス', '🦁'),
    card('R-攻撃型', 'R', 7, 2, 4, '攻撃型', '🐅'),
    card('R-かたい', 'R', 5, 3, 5, 'かたい', '🦏'),
    card('R-攻守型', 'R', 6, 2, 5, '攻守型', '🐻'),
    card('R-とっこう', 'R', 7, 1, 5, 'とっこう', '🦬'),
    card('R-体力型', 'R', 5, 2, 6, '体力型', '🐘'),
    card('SR-バランス', 'SR', 8, 3, 7, 'バランス', '🦖'),
    card('SR-攻撃型', 'SR', 9, 2, 7, '攻撃型', '🐊'),
    card('SR-かたい', 'SR', 7, 3, 8, 'かたい', '🦣'),
    card('SR-攻撃寄り', 'SR', 9, 3, 6, '攻撃寄り', '🐉'),
    card('SR-攻守型', 'SR', 8, 2, 8, '攻守型', '🦈'),
    card('SR-体力型', 'SR', 7, 2, 9, '体力型', '🦕')
  ];

  var RARITY_RULES_V3 = {
    C: { budget: 6, atkCap: 4, defCap: 2, hpCap: 4 },
    UC: { budget: 9, atkCap: 5, defCap: 3, hpCap: 5 },
    R: { budget: 13, atkCap: 7, defCap: 3, hpCap: 7 },
    SR: { budget: 18, atkCap: 9, defCap: 3, hpCap: 9 }
  };
  var ATK_MIN_V3 = { C: 3, UC: 4, R: 5, SR: 6 };

  function validatePool(pool, rules, atkMin) {
    rules = rules || RARITY_RULES_V3;
    var errors = [];
    pool.forEach(function (c) {
      var r = rules[c.rarity];
      var total = c.atk + c.df + c.hp;
      if (total > r.budget) errors.push(c.name + ': 合計' + total + ' > 予算' + r.budget);
      if (c.atk > r.atkCap) errors.push(c.name + ': ATK' + c.atk + ' > 上限' + r.atkCap);
      if (c.df > r.defCap) errors.push(c.name + ': DEF' + c.df + ' > 上限' + r.defCap);
      if (c.hp > r.hpCap) errors.push(c.name + ': HP' + c.hp + ' > 上限' + r.hpCap);
      if (c.atk < 1) errors.push(c.name + ': ATKは1以上必要');
      if (c.hp < 1) errors.push(c.name + ': HPは1以上必要');
      if (c.df < 0) errors.push(c.name + ': DEFは0以上必要');
      if (atkMin && c.atk < atkMin[c.rarity]) errors.push(c.name + ': ATK' + c.atk + ' < 最低' + atkMin[c.rarity]);
    });
    return errors;
  }

  // ---------------------------------------------------------------------
  // 乱数（シード指定可能。テストの再現性のため mulberry32 系の簡易PRNG）
  // ---------------------------------------------------------------------
  function makeRng(seed) {
    var s = (seed === undefined ? Date.now() : seed) >>> 0;
    function next() {
      s |= 0; s = (s + 0x6D2B79F5) | 0;
      var t = Math.imul(s ^ (s >>> 15), 1 | s);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    }
    return {
      next: next,
      randint: function (a, b) { return a + Math.floor(next() * (b - a + 1)); },
      shuffle: function (arr) {
        for (var i = arr.length - 1; i > 0; i--) {
          var j = Math.floor(next() * (i + 1));
          var tmp = arr[i]; arr[i] = arr[j]; arr[j] = tmp;
        }
        return arr;
      }
    };
  }

  // ---------------------------------------------------------------------
  // デッキ生成（sim/run.py build_realistic_deck の移植。既定のdeck_mode）
  // 全デッキに SR sr_count枚、R 3〜4枚、UC 5〜7枚、残りC（同名3枚まで）。
  // ---------------------------------------------------------------------
  function buildDeck(pool, deckSize, rng, srCount) {
    var srs = pool.filter(function (c) { return c.rarity === 'SR'; });
    var rs = pool.filter(function (c) { return c.rarity === 'R'; });
    var ucs = pool.filter(function (c) { return c.rarity === 'UC'; });
    var cs = pool.filter(function (c) { return c.rarity === 'C'; });

    var used = {};
    var deck = [];

    function take(cards, n) {
      if (n <= 0 || cards.length === 0) return 0;
      var candidates = cards.slice();
      rng.shuffle(candidates);
      var taken = 0, idx = 0, guard = 0;
      var guardMax = n * 20 + 200;
      while (taken < n && guard < guardMax) {
        guard++;
        var c = candidates[idx % candidates.length];
        idx++;
        used[c.name] = used[c.name] || 0;
        if (used[c.name] < 3) {
          deck.push(c);
          used[c.name]++;
          taken++;
        }
      }
      return taken;
    }

    var numSr = Math.min(srCount, srs.length * 3);
    var numR = rs.length ? rng.randint(3, 4) : 0;
    var numUc = ucs.length ? rng.randint(5, 7) : 0;
    while (numSr + numR + numUc > deckSize && numUc > 0) numUc--;
    while (numSr + numR + numUc > deckSize && numR > 0) numR--;

    take(srs, numSr);
    take(rs, numR);
    take(ucs, numUc);
    var remaining = deckSize - deck.length;
    if (remaining > 0) remaining -= take(cs, remaining);
    remaining = deckSize - deck.length;
    if (remaining > 0) remaining -= take(ucs, remaining);
    remaining = deckSize - deck.length;
    if (remaining > 0) remaining -= take(rs, remaining);
    remaining = deckSize - deck.length;
    if (remaining > 0) take(srs, remaining);

    rng.shuffle(deck);
    return deck;
  }

  // ---------------------------------------------------------------------
  // 固定設定（企画書v0.2）
  // ---------------------------------------------------------------------
  var CONFIG = {
    playerHp: 10,
    deckSize: 20,
    srCount: 2,
    fieldCap: FIELD_CAP,
    maxPlies: 60 // 安全弁。企画書上は引き分けなしだが、万一の無限ループ防止。
  };

  // ---------------------------------------------------------------------
  // ゲーム状態
  // ---------------------------------------------------------------------
  function newPlayerState(idx, deck, controller) {
    return {
      idx: idx,
      hp: CONFIG.playerHp,
      deck: deck,
      hand: [],
      field: [],
      costTotal: 0,
      costUsed: 0,
      turnNo: 0,
      controller: controller, // 'human' | 'cpu'
      aiName: 'greedy',
      deckHasSR: deck.some(function (c) { return c.rarity === 'SR'; }),
      srDrawn: false,
      srLanded: false,
      srLandedTurn: null,
      srLandCount: 0,
      srKillCount: 0
    };
  }

  function newGame(deck0, deck1, firstPlayer, rng, controllers) {
    controllers = controllers || ['human', 'cpu'];
    var state = {
      players: [
        newPlayerState(0, deck0.slice(), controllers[0]),
        newPlayerState(1, deck1.slice(), controllers[1])
      ],
      firstPlayer: firstPlayer,
      acting: firstPlayer,
      ply: 0,
      phase: 'init', // init -> draw(自動) -> charge -> play -> battle -> (次のply) -> gameover
      winner: null,
      endReason: '',
      log: [],
      damageBySource: { death: 0, direct: 0, retreat: 0, deckout: 0 },
      isSecondFirstTurn: false,
      chargeLimit: 1,
      chargePlaced: 0,
      battleRemaining: [],
      rng: rng
    };
    rng.shuffle(state.players[0].deck);
    rng.shuffle(state.players[1].deck);
    // 初期手札5枚ずつ（企画書v0.2: 両者5枚、後攻は「ためる」で2枚補正）
    drawN(state, state.players[firstPlayer], 5, false);
    drawN(state, state.players[1 - firstPlayer], 5, false);
    pushLog(state, '初期手札: 先攻P' + state.players[firstPlayer].idx + '=5枚, 後攻P' + state.players[1 - firstPlayer].idx + '=5枚');
    return state;
  }

  function pushLog(state, msg) {
    state.log.push(msg);
  }

  function currentPlayer(state) { return state.players[state.acting]; }
  function currentOpp(state) { return state.players[1 - state.acting]; }

  function bodyDamage(state, p, amount, source) {
    if (amount <= 0) return;
    p.hp -= amount;
    state.damageBySource[source] = (state.damageBySource[source] || 0) + amount;
  }

  function checkWin(state) {
    var p0 = state.players[0], p1 = state.players[1];
    if (p0.hp <= 0 && p1.hp <= 0) {
      state.winner = null; state.endReason = '同時決着(引き分け)'; state.phase = 'gameover';
      return true;
    }
    if (p0.hp <= 0) { state.winner = 1; state.endReason = 'HP0'; state.phase = 'gameover'; return true; }
    if (p1.hp <= 0) { state.winner = 0; state.endReason = 'HP0'; state.phase = 'gameover'; return true; }
    return false;
  }

  function drawN(state, p, n, countAsDeckout) {
    if (countAsDeckout === undefined) countAsDeckout = true;
    for (var i = 0; i < n; i++) {
      if (p.deck.length === 0) {
        if (countAsDeckout) {
          bodyDamage(state, p, 1, 'deckout');
          pushLog(state, 'P' + p.idx + ' 山札切れ→本体1ダメージ (HP=' + p.hp + ')');
          if (checkWin(state)) return;
        }
        continue;
      }
      var c = p.deck.pop();
      p.hand.push(c);
      if (c.rarity === 'SR') p.srDrawn = true;
    }
  }

  // ---------------------------------------------------------------------
  // フェーズ1: ひく（自動実行。ターン開始時に1回だけ呼ぶ）
  // ---------------------------------------------------------------------
  function beginTurn(state) {
    if (state.phase === 'gameover') return state;
    state.ply += 1;
    if (state.ply > CONFIG.maxPlies) {
      state.endReason = '打ち切り(' + CONFIG.maxPlies + 'ply)';
      state.winner = null;
      state.phase = 'gameover';
      return state;
    }
    var p = currentPlayer(state);
    p.turnNo += 1;
    p.costUsed = 0;

    var isFirstOverallTurn = (p.turnNo === 1 && p.idx === state.firstPlayer);
    var isSecondFirstTurn = (p.turnNo === 1 && p.idx !== state.firstPlayer);
    state.isSecondFirstTurn = isSecondFirstTurn;

    pushLog(state, '--- ' + p.turnNo + 'たんめ: P' + p.idx + ' (HP P0=' + state.players[0].hp + ' P1=' + state.players[1].hp + ') ---');

    if (isFirstOverallTurn) {
      pushLog(state, 'P' + p.idx + ': 先攻1ターン目のためドローなし');
    } else {
      drawN(state, p, 1);
      if (state.phase === 'gameover') return state;
      pushLog(state, 'P' + p.idx + ': 1枚ドロー (手札' + p.hand.length + '枚)');
    }

    state.chargeLimit = isSecondFirstTurn ? 2 : 1;
    state.chargePlaced = 0;
    state.phase = 'charge';
    return state;
  }

  // ---------------------------------------------------------------------
  // フェーズ2: ためる
  // ---------------------------------------------------------------------
  function canChargeMore(state) {
    var p = currentPlayer(state);
    return state.chargePlaced < state.chargeLimit && p.costTotal < FIELD_CAP && p.hand.length > 0;
  }

  function chargeCard(state, cardObj) {
    var p = currentPlayer(state);
    var idx = p.hand.indexOf(cardObj);
    if (idx < 0) return false;
    if (!canChargeMore(state)) return false;
    p.hand.splice(idx, 1);
    p.costTotal += 1;
    state.chargePlaced += 1;
    pushLog(state, 'P' + p.idx + ': 「' + cardObj.name + '」をコストに置く (コスト' + p.costTotal + '枚)');
    return true;
  }

  // CPU: ためるフェーズの1手。置いたら true、もう置かない/置けないなら false。
  function aiChargeStep(state) {
    var p = currentPlayer(state);
    if (!canChargeMore(state)) return false;
    var c = AI.chooseChargeCard(p.aiName, p);
    if (!c) return false;
    return chargeCard(state, c);
  }

  function advanceToPlay(state) {
    state.phase = 'play';
  }

  // ---------------------------------------------------------------------
  // フェーズ3: だす（召喚・退却）
  // ---------------------------------------------------------------------
  function canSummon(state, cardObj) {
    var p = currentPlayer(state);
    if (p.hand.indexOf(cardObj) < 0) return { ok: false, reason: '手札にありません' };
    var cost = cardObj.rarityNum;
    if (AI.costAvailable(p) < cost) return { ok: false, reason: 'おうえんが たりない' };
    if (AI.fieldOccupancy(p) + cost > FIELD_CAP) return { ok: false, reason: 'ばがいっぱい' };
    return { ok: true, reason: '' };
  }

  function summon(state, cardObj) {
    var p = currentPlayer(state);
    var check = canSummon(state, cardObj);
    if (!check.ok) return false;
    var idx = p.hand.indexOf(cardObj);
    p.hand.splice(idx, 1);
    var cost = cardObj.rarityNum;
    p.costUsed += cost;
    p.field.push({ card: cardObj, damage: 0, enteredPly: state.ply });
    pushLog(state, 'P' + p.idx + ': 「' + cardObj.name + '」を召喚 (コスト' + cost + '消費, 場占有' + AI.fieldOccupancy(p) + '/4)');
    if (cardObj.rarity === 'SR') {
      p.srLanded = true;
      p.srLandCount += 1;
      if (p.srLandedTurn === null) p.srLandedTurn = p.turnNo;
    }
    return true;
  }

  // 退却: 自分の場のモンスターを捨て、レアリティ分の本体ダメージ。
  function retreat(state, monster) {
    var p = currentPlayer(state);
    var idx = p.field.indexOf(monster);
    if (idx < 0) return false;
    p.field.splice(idx, 1);
    pushLog(state, 'P' + p.idx + ': 「' + monster.card.name + '」を退却');
    bodyDamage(state, p, monster.card.rarityNum, 'retreat');
    pushLog(state, '  →退却ダメージ P' + p.idx + ' に' + monster.card.rarityNum + ' (HP=' + p.hp + ')');
    checkWin(state);
    return true;
  }

  // CPU: だすフェーズを全部決定する（sim/ai.pyのdecide_playは1回の呼び出しで
  // アクション列を全部返す。適用はUI側で1手ずつdelayを入れて呼び出す想定）。
  function aiDecidePlayActions(state) {
    var p = currentPlayer(state);
    var opp = currentOpp(state);
    return AI.decidePlay(p.aiName, p, opp, CONFIG, state.ply);
  }

  // 1個のアクション({type:'summon'|'retreat', ...}) を適用する。
  function applyPlayAction(state, action) {
    if (state.phase === 'gameover') return false;
    if (action.type === 'retreat') {
      return retreat(state, action.monster);
    } else if (action.type === 'summon') {
      return summon(state, action.card);
    }
    return false;
  }

  function advanceToBattle(state) {
    var p = currentPlayer(state);
    state.battleRemaining = p.field.filter(function (m) { return m.enteredPly !== state.ply; });
    state.phase = 'battle';
  }

  // ---------------------------------------------------------------------
  // フェーズ4: たたかう
  // ---------------------------------------------------------------------
  function attackDamagePreview(attackerCard, defenderCard) {
    return Math.max(0, attackerCard.atk - defenderCard.df);
  }

  function canAttack(state, monster) {
    return state.battleRemaining.indexOf(monster) >= 0;
  }

  // 直接攻撃 or 通常攻撃を実行する。targetMonster が null なら直接攻撃。
  // 戻り値: { ok, dmg, killed, direct, winnerDecided }
  function attack(state, attackerMonster, targetMonster) {
    var p = currentPlayer(state);
    var opp = currentOpp(state);
    if (!canAttack(state, attackerMonster)) return { ok: false };
    var ridx = state.battleRemaining.indexOf(attackerMonster);

    if (opp.field.length === 0) {
      // 直接攻撃
      var dmg = attackerMonster.card.rarityNum;
      bodyDamage(state, opp, dmg, 'direct');
      pushLog(state, 'P' + p.idx + ': 「' + attackerMonster.card.name + '」がちょくせつこうげき → P' + opp.idx + 'に' + dmg + ' (HP=' + opp.hp + ')');
      state.battleRemaining.splice(ridx, 1);
      var won = checkWin(state);
      return { ok: true, dmg: dmg, killed: false, direct: true, winnerDecided: won };
    }

    if (!targetMonster || opp.field.indexOf(targetMonster) < 0) return { ok: false };
    var dmgToDef = attackDamagePreview(attackerMonster.card, targetMonster.card);
    targetMonster.damage += dmgToDef;
    pushLog(state, 'P' + p.idx + ': 「' + attackerMonster.card.name + '」が P' + opp.idx + 'の「' + targetMonster.card.name + '」を攻撃 (' +
      attackerMonster.card.atk + '-' + targetMonster.card.df + '=' + dmgToDef + ', 蓄積' + targetMonster.damage + '/' + targetMonster.card.hp + ')');
    state.battleRemaining.splice(ridx, 1);

    var killed = (targetMonster.card.hp - targetMonster.damage) <= 0;
    var winnerDecided = false;
    if (killed) {
      var oidx = opp.field.indexOf(targetMonster);
      opp.field.splice(oidx, 1);
      bodyDamage(state, opp, targetMonster.card.rarityNum, 'death');
      pushLog(state, '  →「' + targetMonster.card.name + '」死亡。P' + opp.idx + 'に本体' + targetMonster.card.rarityNum + 'ダメージ (HP=' + opp.hp + ')');
      if (targetMonster.card.rarity === 'SR') opp.srKillCount += 1;
      winnerDecided = checkWin(state);
    }
    return { ok: true, dmg: dmgToDef, killed: killed, direct: false, winnerDecided: winnerDecided };
  }

  // CPU: たたかうフェーズの1手。処理したら {done:false, ...} / もう無ければ {done:true}
  function aiBattleStep(state) {
    if (state.battleRemaining.length === 0) return { done: true };
    var attackerMonster = state.battleRemaining[0];
    var opp = currentOpp(state);
    if (opp.field.length === 0) {
      var res = attack(state, attackerMonster, null);
      return { done: false, acted: true, result: res, attacker: attackerMonster };
    }
    var targetIdx = AI.chooseTarget(attackerMonster.card, opp.field);
    if (targetIdx === null) {
      // 攻撃しない（与ダメ0のため）。この攻撃者はスキップ。
      var ridx = state.battleRemaining.indexOf(attackerMonster);
      state.battleRemaining.splice(ridx, 1);
      return { done: false, acted: false, attacker: attackerMonster };
    }
    var target = opp.field[targetIdx];
    var res2 = attack(state, attackerMonster, target);
    return { done: false, acted: true, result: res2, attacker: attackerMonster, target: target };
  }

  function endTurn(state) {
    if (state.phase === 'gameover') return state;
    state.acting = 1 - state.acting;
    return beginTurn(state);
  }

  // ---------------------------------------------------------------------
  // 自動対戦（CPU vs CPU）をノーウェイトで最後まで回す。test.js / 統計用。
  // ---------------------------------------------------------------------
  function simulateGame(deck0, deck1, firstPlayer, rng) {
    var state = newGame(deck0, deck1, firstPlayer, rng, ['cpu', 'cpu']);
    beginTurn(state);
    while (state.phase !== 'gameover') {
      // charge
      while (state.phase === 'charge' && aiChargeStep(state)) { /* keep going */ }
      if (state.phase === 'gameover') break;
      advanceToPlay(state);

      // play
      var actions = aiDecidePlayActions(state);
      for (var i = 0; i < actions.length; i++) {
        if (state.phase === 'gameover') break;
        applyPlayAction(state, actions[i]);
      }
      if (state.phase === 'gameover') break;

      // battle
      advanceToBattle(state);
      while (state.phase === 'battle') {
        var step = aiBattleStep(state);
        if (state.phase === 'gameover') break;
        if (step.done) break;
      }
      if (state.phase === 'gameover') break;

      endTurn(state);
    }
    return state;
  }

  return {
    FIELD_CAP: FIELD_CAP,
    RARITY_NUM: RARITY_NUM,
    CARD_POOL_V3: CARD_POOL_V3,
    RARITY_RULES_V3: RARITY_RULES_V3,
    ATK_MIN_V3: ATK_MIN_V3,
    validatePool: validatePool,
    makeRng: makeRng,
    buildDeck: buildDeck,
    CONFIG: CONFIG,
    newGame: newGame,
    beginTurn: beginTurn,
    canChargeMore: canChargeMore,
    chargeCard: chargeCard,
    aiChargeStep: aiChargeStep,
    advanceToPlay: advanceToPlay,
    canSummon: canSummon,
    summon: summon,
    retreat: retreat,
    aiDecidePlayActions: aiDecidePlayActions,
    applyPlayAction: applyPlayAction,
    advanceToBattle: advanceToBattle,
    attackDamagePreview: attackDamagePreview,
    canAttack: canAttack,
    attack: attack,
    aiBattleStep: aiBattleStep,
    endTurn: endTurn,
    checkWin: checkWin,
    simulateGame: simulateGame,
    fieldOccupancy: AI.fieldOccupancy,
    costAvailable: AI.costAvailable
  };
});

