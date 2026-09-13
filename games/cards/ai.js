
// ai.js
// CPUの「かんがえかた」(貪欲型 = greedy) を sim/ai.py から移植したもの。
// ブラウザでもNodeでも同じファイルが動くようにUMD風の書き出しにしてある。
//
// 今回のプロトタイプでは企画書v0.2に固定なので、sim/ai.py の4戦法のうち
// 基準AIである "greedy" のみ実装する（rush/sr/mid は移植対象外。指示書05の
// 「CPUの正はgreedy」に従う）。ロジックは sim/ai.py のコメントも含めてそのまま。
//
// 共通コア（sim/ai.py 冒頭コメントより）:
//   1. 出せるなら出す: コストと場の空きが許す限り召喚する。
//   2. 召喚の選び方: 手札から「コスト合計<=使えるコスト」「占有点合計<=場の空き」を
//      満たす組み合わせを全列挙し、評価値(ATK+DEF+HPの合計)最大の組み合わせを出す。
//   3. SRを出すための退却: 手札にSRがあり、使えるコストが4なら、場を全部退却して
//      SRを出す。ただし退却ダメージ合計>=自分の残りHPなら退却しない(自殺しない)。
//   4. ためる(チャージ): コスト置き場が4枚未満なら毎ターン必ず1枚置く。
//   5. 攻撃対象: 倒せる相手のうちレアリティ最大→なければ与ダメ最大。与ダメ0の攻撃はしない。

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.AI = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var FIELD_CAP = 4;

  function cardValue(c) {
    return c.atk + c.df + c.hp;
  }

  // 評価値タプル(配列)を辞書式に比較する。aがbより大きければ正の値。
  function compareKey(a, b) {
    var len = Math.max(a.length, b.length);
    for (var i = 0; i < len; i++) {
      var av = i < a.length ? a[i] : -Infinity;
      var bv = i < b.length ? b[i] : -Infinity;
      if (av > bv) return 1;
      if (av < bv) return -1;
    }
    return 0;
  }

  function comboKey(aiName, combo) {
    var baseValue = 0;
    var maxRarity = 0;
    for (var i = 0; i < combo.length; i++) {
      baseValue += cardValue(combo[i]);
      if (combo[i].rarityNum > maxRarity) maxRarity = combo[i].rarityNum;
    }
    var n = combo.length;
    if (aiName === 'rush') return [baseValue + n, n];
    if (aiName === 'mid') return [baseValue, maxRarity];
    return [baseValue];
  }

  // 手札から capacity(=コストと場の空きの小さい方)以内で評価値最大の組み合わせを返す。
  // コスト=占有点=レアリティ数(1〜4)なので、レアリティ(重さ)ごとの採用枚数を
  // 全探索する（各重さ内は価値の高い順に採用するのが常に最適）。
  function bestSummonCombo(hand, capacity, aiName) {
    if (capacity <= 0 || hand.length === 0) return [];
    var buckets = { 1: [], 2: [], 3: [], 4: [] };
    for (var i = 0; i < hand.length; i++) {
      buckets[hand[i].rarityNum].push(hand[i]);
    }
    [1, 2, 3, 4].forEach(function (w) {
      buckets[w].sort(function (a, b) { return cardValue(b) - cardValue(a); });
    });

    var bestKey = null;
    var bestCombo = [];
    var maxK4 = Math.min(buckets[4].length, Math.floor(capacity / 4));
    for (var k4 = 0; k4 <= maxK4; k4++) {
      var rem1 = capacity - k4 * 4;
      var maxK3 = Math.min(buckets[3].length, Math.floor(rem1 / 3));
      for (var k3 = 0; k3 <= maxK3; k3++) {
        var rem2 = rem1 - k3 * 3;
        var maxK2 = Math.min(buckets[2].length, Math.floor(rem2 / 2));
        for (var k2 = 0; k2 <= maxK2; k2++) {
          var rem3 = rem2 - k2 * 2;
          var k1 = Math.min(buckets[1].length, rem3);
          var combo = buckets[4].slice(0, k4)
            .concat(buckets[3].slice(0, k3))
            .concat(buckets[2].slice(0, k2))
            .concat(buckets[1].slice(0, k1));
          if (combo.length === 0) continue;
          var key = comboKey(aiName, combo);
          if (bestKey === null || compareKey(key, bestKey) > 0) {
            bestKey = key;
            bestCombo = combo;
          }
        }
      }
    }
    return bestCombo;
  }

  function fieldOccupancy(p) {
    var sum = 0;
    for (var i = 0; i < p.field.length; i++) sum += p.field[i].card.rarityNum;
    return sum;
  }

  function costAvailable(p) {
    return p.costTotal - p.costUsed;
  }

  // 条件を満たせば「場を全部retreat + SR召喚」のアクション列を返す。満たさなければ null。
  function tryForceSR(p, aiName) {
    var handSR = p.hand.filter(function (c) { return c.rarity === 'SR'; });
    if (handSR.length === 0) return null;
    var hasFieldSR = p.field.some(function (m) { return m.card.rarity === 'SR'; });
    if (hasFieldSR) return null;
    var cost = costAvailable(p);
    if (cost < FIELD_CAP) return null;
    var occ = fieldOccupancy(p);
    if (aiName === 'rush' && occ > 0) return null;
    var retreatTotal = 0;
    for (var i = 0; i < p.field.length; i++) retreatTotal += p.field[i].card.rarityNum;
    if (retreatTotal >= p.hp) return null; // 自殺しない
    var actions = p.field.map(function (m) { return { type: 'retreat', monster: m }; });
    actions.push({ type: 'summon', card: handSR[0] });
    return actions;
  }

  function decidePlayCommon(p, aiName, occCap) {
    var occ = fieldOccupancy(p);
    var cost = costAvailable(p);
    var room = FIELD_CAP - occ;
    if (occCap !== null && occCap !== undefined) {
      room = Math.min(room, Math.max(0, occCap - occ));
    }
    var capacity = Math.min(cost, room);
    var combo = bestSummonCombo(p.hand, capacity, aiName);
    return combo.map(function (c) { return { type: 'summon', card: c }; });
  }

  function decidePlayGreedy(p) {
    var forced = tryForceSR(p, 'greedy');
    if (forced !== null) return forced;
    return decidePlayCommon(p, 'greedy');
  }

  // 今回のプロトタイプでは greedy のみを実装対象とするが、将来の拡張に備えて
  // 同じ枠組みで呼び出せるようにしておく。
  function decidePlay(aiName, p, opp, cfg, ply) {
    if (aiName === 'greedy') return decidePlayGreedy(p);
    // 未対応の戦法は greedy にフォールバック。
    return decidePlayGreedy(p);
  }

  // コストに置くカードを1枚選ぶ。置かない方が良ければ null。
  function chooseChargeCard(aiName, p) {
    var hand = p.hand;
    if (hand.length === 0) return null;

    if (hand.length === 1) {
      var only = hand[0];
      var occRoom = FIELD_CAP - fieldOccupancy(p);
      if (only.rarityNum <= costAvailable(p) && only.rarityNum <= occRoom) {
        return null; // 出す方に回す。ためない
      }
    }

    var srCards = hand.filter(function (c) { return c.rarity === 'SR'; });
    var protectedSR = srCards.length ? srCards[0] : null;
    function isProtected(c) { return protectedSR !== null && c === protectedSR; }

    function notSummonableSoon(c) { return c.rarityNum > p.costTotal + 1; }

    var groupA = hand.filter(function (c) { return notSummonableSoon(c) && !isProtected(c); });
    if (groupA.length) {
      return groupA.reduce(function (m, c) { return cardValue(c) < cardValue(m) ? c : m; });
    }

    var seen = {};
    var dupCandidates = [];
    for (var i = 0; i < hand.length; i++) {
      var c = hand[i];
      seen[c.name] = (seen[c.name] || 0) + 1;
      if (seen[c.name] >= 2 && !isProtected(c)) dupCandidates.push(c);
    }
    if (dupCandidates.length) {
      return dupCandidates.reduce(function (m, c) { return cardValue(c) < cardValue(m) ? c : m; });
    }

    var remaining = hand.filter(function (c) { return !isProtected(c); });
    if (remaining.length === 0) remaining = hand.slice();
    return remaining.reduce(function (m, c) {
      return (cardValue(c) / c.rarityNum) < (cardValue(m) / m.rarityNum) ? c : m;
    });
  }

  // 「このターンに倒せる相手のうちレアリティ最大」→「なければ与ダメ最大」。
  // 与ダメ0にしかならない場合は null (=攻撃しない)。
  function chooseTarget(attackerCard, oppField) {
    if (!oppField || oppField.length === 0) return null;
    var bestKillIdx = null;
    var bestKillRarity = -1;
    var bestDmgIdx = null;
    var bestDmg = -1;
    for (var i = 0; i < oppField.length; i++) {
      var m = oppField[i];
      var dmg = Math.max(0, attackerCard.atk - m.card.df);
      var wouldKill = (m.damage + dmg) >= m.card.hp;
      if (wouldKill && m.card.rarityNum > bestKillRarity) {
        bestKillRarity = m.card.rarityNum;
        bestKillIdx = i;
      }
      if (dmg > bestDmg) {
        bestDmg = dmg;
        bestDmgIdx = i;
      }
    }
    if (bestKillIdx !== null) return bestKillIdx;
    if (bestDmg !== null && bestDmg > 0) return bestDmgIdx;
    return null;
  }

  return {
    FIELD_CAP: FIELD_CAP,
    cardValue: cardValue,
    fieldOccupancy: fieldOccupancy,
    costAvailable: costAvailable,
    bestSummonCombo: bestSummonCombo,
    tryForceSR: tryForceSR,
    decidePlay: decidePlay,
    chooseChargeCard: chooseChargeCard,
    chooseTarget: chooseTarget
  };
});

