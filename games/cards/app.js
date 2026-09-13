
// app.js — ブラウザUIの制御。engine.js / ai.js が定義する window.Engine / window.AI を使う。
(function () {
  'use strict';

  function $(id) { return document.getElementById(id); }
  function sleep(ms) { return new Promise(function (resolve) { setTimeout(resolve, ms); }); }
  function escapeHtml(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
  function prefersReducedMotion() {
    return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  }

  // ---------------------------------------------------------------------
  // 効果音（Web Audio APIで合成。音声ファイルは使わない＝外部参照ゼロを維持）
  // AudioContextはブラウザの制約でユーザー操作後にしか鳴らせないため、
  // 実際の生成はresume()が呼ばれるまで遅延する(タイトル画面のタップ等)。
  // ---------------------------------------------------------------------
  var Sound = (function () {
    // family-gamesシリーズの作法(CLAUDE.md)によりlocalStorageは使わない。
    // 音のオン/オフは「ページを開いている間だけ」メモリ上で保持する(保存しない=開き直すとオンに戻る)。
    var ctx = null;
    var enabled = true;

    function ensureCtx() {
      if (ctx) return ctx;
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      try { ctx = new AC(); } catch (e) { ctx = null; }
      return ctx;
    }

    function resume() {
      var c = ensureCtx();
      if (c && c.state === 'suspended') {
        try { c.resume(); } catch (e) { /* ignore */ }
      }
    }

    function setEnabled(v) {
      enabled = !!v;
    }
    function isEnabled() { return enabled; }

    // 1つの音: freq(Hz)をtype波形でdur秒鳴らす。
    function tone(freq, dur, opts) {
      if (!enabled) return;
      var c = ensureCtx();
      if (!c) return;
      opts = opts || {};
      var t0 = c.currentTime + (opts.delay || 0);
      var osc = c.createOscillator();
      var gain = c.createGain();
      osc.type = opts.type || 'sine';
      osc.frequency.setValueAtTime(freq, t0);
      if (opts.freqEnd) osc.frequency.linearRampToValueAtTime(opts.freqEnd, t0 + dur);
      var vol = opts.vol !== undefined ? opts.vol : 0.15;
      gain.gain.setValueAtTime(0.0001, t0);
      gain.gain.linearRampToValueAtTime(vol, t0 + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      osc.connect(gain);
      gain.connect(c.destination);
      osc.start(t0);
      osc.stop(t0 + dur + 0.03);
    }

    // ノイズ音(バシッ/風切り音など)。
    function noise(dur, opts) {
      if (!enabled) return;
      var c = ensureCtx();
      if (!c) return;
      opts = opts || {};
      var t0 = c.currentTime + (opts.delay || 0);
      var bufferSize = Math.max(1, Math.floor(c.sampleRate * dur));
      var buffer = c.createBuffer(1, bufferSize, c.sampleRate);
      var data = buffer.getChannelData(0);
      for (var i = 0; i < bufferSize; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
      var src = c.createBufferSource();
      src.buffer = buffer;
      var gain = c.createGain();
      var vol = opts.vol !== undefined ? opts.vol : 0.12;
      gain.gain.setValueAtTime(vol, t0);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      if (opts.filterFreq) {
        var filt = c.createBiquadFilter();
        filt.type = opts.filterType || 'bandpass';
        filt.frequency.value = opts.filterFreq;
        src.connect(filt);
        filt.connect(gain);
      } else {
        src.connect(gain);
      }
      gain.connect(c.destination);
      src.start(t0);
    }

    return {
      resume: resume,
      setEnabled: setEnabled,
      isEnabled: isEnabled,
      charge: function () { tone(190, 0.09, { type: 'sine', vol: 0.11 }); },
      summon: function () {
        tone(440, 0.09, { type: 'triangle', vol: 0.13 });
        tone(660, 0.12, { type: 'triangle', vol: 0.13, delay: 0.08 });
      },
      hit: function () { noise(0.12, { vol: 0.18, filterFreq: 1200, filterType: 'bandpass' }); },
      hitZero: function () { tone(150, 0.1, { type: 'square', vol: 0.07, freqEnd: 120 }); },
      death: function () { tone(420, 0.32, { type: 'sawtooth', vol: 0.12, freqEnd: 80 }); },
      bodyDamage: function () { tone(90, 0.22, { type: 'sine', vol: 0.2, freqEnd: 55 }); },
      directAttack: function () { noise(0.25, { vol: 0.14, filterFreq: 2500, filterType: 'highpass' }); },
      retreat: function () { tone(320, 0.16, { type: 'sine', vol: 0.1, freqEnd: 140 }); },
      win: function () {
        tone(523, 0.12, { vol: 0.15 });
        tone(659, 0.12, { vol: 0.15, delay: 0.12 });
        tone(784, 0.22, { vol: 0.16, delay: 0.24 });
      },
      lose: function () {
        tone(392, 0.16, { vol: 0.12, delay: 0 });
        tone(294, 0.26, { vol: 0.12, delay: 0.16 });
      }
    };
  })();

  // 最初のタップ/クリックでAudioContextを起こす(以後はresumeが安全に何度呼ばれてもよい)。
  document.addEventListener('pointerdown', function () { Sound.resume(); }, { passive: true });

  // ---------------------------------------------------------------------
  // カード名 → icon の逆引き(ログ表示用)。engine.jsのCARD_POOL_V3から作る。
  // ---------------------------------------------------------------------
  var ICON_BY_NAME = {};
  Engine.CARD_POOL_V3.forEach(function (c) { ICON_BY_NAME[c.name] = c.icon; });
  function iconFor(name) {
    var i = ICON_BY_NAME[name];
    return i ? i + ' ' : '';
  }

  // ---------------------------------------------------------------------
  // 状態
  // ---------------------------------------------------------------------
  var mode = 'cpu'; // 'cpu' | 'hotseat' | 'tutorial'
  var humanIdx = 0; // CPU戦・チュートリアルでの「じぶん」のプレイヤー番号(固定)
  var gameState = null;
  var ui = { selectedAttacker: null, anim: null, deadGhost: null, fullLogReturn: 'screen-game', slots: [[null, null, null, null], [null, null, null, null]] };
  var jankenFirstPlayer = null;

  // ホットシート(ふたり対戦)以外は「じぶん/あいて」表記・自分視点固定で描く。
  function isSolo() { return mode !== 'hotseat'; }
  function selfIndex() { return isSolo() ? humanIdx : gameState.acting; }
  function oppIndex() { return 1 - selfIndex(); }
  function isMyInteractiveTurn() { return gameState && gameState.phase !== 'gameover' && gameState.acting === selfIndex(); }

  function showScreen(id) {
    if($('inspect-overlay'))$('inspect-overlay').classList.add('hidden');
    if($('modal-overlay'))$('modal-overlay').classList.add('hidden');
    var list = document.querySelectorAll('.screen');
    for (var i = 0; i < list.length; i++) list[i].classList.add('hidden');
    $(id).classList.remove('hidden');
  }
  function getCurrentScreenId() {
    var el = document.querySelector('.screen:not(.hidden)');
    return el ? el.id : 'screen-title';
  }

  // ---------------------------------------------------------------------
  // 音のオン/オフボタン
  // ---------------------------------------------------------------------
  var soundBtn = $('btn-sound-toggle');
  function refreshSoundBtn() {
    if (!soundBtn) return;
    soundBtn.textContent = Sound.isEnabled() ? '🔊' : '🔇';
    soundBtn.setAttribute('aria-label', Sound.isEnabled() ? '音を オフにする' : '音を オンにする');
  }
  if (soundBtn) {
    soundBtn.onclick = function () {
      Sound.resume();
      Sound.setEnabled(!Sound.isEnabled());
      refreshSoundBtn();
    };
    refreshSoundBtn();
  }

  // ---------------------------------------------------------------------
  // タイトル / ルール / じゃんけん
  // ---------------------------------------------------------------------
  function goToJanken() {
    jankenFirstPlayer = null;
    $('janken-result').textContent = '';
    $('btn-janken-go').textContent = 'たたかいはじめる';
    showScreen('screen-janken');
  }

  $('btn-tutorial').onclick = function () { Sound.resume(); startTutorial(); };
  $('btn-vs-cpu').onclick = function () { Sound.resume(); mode = 'cpu'; humanIdx = 0; goToJanken(); };
  $('btn-vs-human').onclick = function () { Sound.resume(); mode = 'hotseat'; goToJanken(); };
  $('btn-rules').onclick = function () { showScreen('screen-rules'); };
  $('btn-rules-back').onclick = function () { showScreen('screen-title'); };

  $('btn-janken-go').onclick = function () {
    if (jankenFirstPlayer === null) {
      jankenFirstPlayer = Math.random() < 0.5 ? 0 : 1;
      var label;
      if (mode === 'cpu') {
        label = (jankenFirstPlayer === humanIdx) ? 'あなたの せんこうです！' : 'あいての せんこうです！';
      } else {
        label = (jankenFirstPlayer === 0 ? 'プレイヤー1' : 'プレイヤー2') + ' の せんこうです！';
      }
      $('janken-result').textContent = label;
      $('btn-janken-go').textContent = 'たいせんを はじめる';
    } else {
      startGame();
    }
  };

  // ---------------------------------------------------------------------
  // ゲーム開始
  // ---------------------------------------------------------------------
  var rng = Engine.makeRng();

  function startGame() {
    var deck0 = Engine.buildDeck(Engine.CARD_POOL_V3, 20, rng, 2);
    var deck1 = Engine.buildDeck(Engine.CARD_POOL_V3, 20, rng, 2);
    var controllers = mode === 'cpu'
      ? (humanIdx === 0 ? ['human', 'cpu'] : ['cpu', 'human'])
      : ['human', 'human'];
    gameState = Engine.newGame(deck0, deck1, jankenFirstPlayer, rng, controllers);
    gameState.skillsEnabled=true;
    ui = { selectedAttacker: null, anim: null, deadGhost: null, fullLogReturn: 'screen-game', slots: [[null, null, null, null], [null, null, null, null]] };
    tut = null;
    Engine.beginTurn(gameState);
    enterTurnFlow();
  }

  function enterTurnFlow() {
    if (gameState.phase === 'gameover') { showVictory(); return; }
    if (mode === 'hotseat') {
      showPassScreen(function () {
        showScreen('screen-game');
        render();
        maybeRunCpu();
      });
    } else {
      showScreen('screen-game');
      render();
      if (mode === 'tutorial' && gameState.acting === humanIdx) tutNotify('myTurn');
      maybeRunCpu();
    }
  }

  function showPassScreen(onOk) {
    var p = gameState.players[gameState.acting];
    var name = p.idx === 0 ? 'プレイヤー1' : 'プレイヤー2';
    $('pass-text').innerHTML = name + 'さんの番です<br>スマホをわたしてね';
    showScreen('screen-pass');
    $('btn-pass-ok').onclick = function () { onOk(); };
  }

  function maybeRunCpu() {
    if (!gameState || gameState.phase === 'gameover') return;
    if (gameState.acting === humanIdx) return;
    if (mode === 'cpu') runCpuTurn();
    else if (mode === 'tutorial') runTutorialOppTurn();
  }

  // ---------------------------------------------------------------------
  // チュートリアル（はじめてあそぶ）
  // 実際のルールエンジンをそのまま使い、配るカードと あいての手を固定して
  // 「せんせい」の指示どおりに1手ずつ進めてもらう。ルールの数値には手を加えない。
  // ---------------------------------------------------------------------

  // ==== TUTORIAL_DATA_BEGIN ====
  // 配るカードと あいての手順。ここだけは検証ゲート(run_sim.js)が抜き出して
  // 「カード名が実在するか」「筋書きどおりに進むか」を毎回たしかめる。
  // deck0/deck1 は「ひく順」に並べる(実際に配るときは逆順にしてpopで引く)。
  var TUT_DATA = {
    hand0: ['C-とっこう', 'C-かたい', 'C-体力型', 'UC-バランス', 'R-バランス'],
    deck0: ['C-バランス', 'C-攻撃型', 'UC-かたい', 'R-かたい', 'UC-攻守型', 'C-よわい'],
    // あいては1体だけ弱いモンスターを出し、以後はおうえん(コスト)が足りずに何も出せない。
    hand1: ['C-よわい', 'SR-体力型', 'SR-かたい', 'SR-バランス', 'SR-攻撃型'],
    deck1: ['SR-攻撃寄り', 'SR-攻守型', 'SR-体力型', 'SR-かたい', 'SR-バランス'],
    oppScript: [
      { charge: ['SR-体力型', 'SR-かたい'], summon: 'C-よわい' },
      { charge: ['SR-バランス'], summon: null },
      { charge: [], summon: null }
    ]
  };
  // ==== TUTORIAL_DATA_END ====

  // t: 'info' = よんで「つぎへ」/ 'do' = 指定の操作をするまで待つ / 'oppturn' = あいての番 / 'end' = おわり
  // wait: 'charge' | 'summon' | 'phase:play' | 'phase:battle' | 'select' | 'attack' | 'endTurn'
  var TUT_STEPS = [
    // --- じぶんの 1ターンめ ---
    { t: 'info', target: 'opp-bar', msg: 'ようこそ！ ルールを おぼえよう。\nうえが あいて、したが じぶん。\nおたがい たいりょく(HP)は 10。さきに 0に したら かち！' },
    { t: 'info', target: 'phase-strip', msg: 'じぶんの ばんは この 4つの じゅんばんで すすむよ。\n「ひく」→「おうえん」→「だす」→「たたかう」' },
    { t: 'do', wait: 'charge', target: 'hand-wrap', msg: 'いまは【おうえん】。\nてふだを 1まい タップして「おうえんに まわす」を えらんでね。' },
    { t: 'info', target: 'my-bar', msg: 'おうえんに まわした なかまは、たたかわないで みんなを おうえんしてくれるよ。\n手ふだには もどらないから、いらない カードを えらぼう。' },
    { t: 'info', target: 'my-bar', msg: 'おうえんは つかっても いなく ならない。\nつぎの ターンには また おうえんしてくれるよ。\nまいターン 1にんずつ ふえて、4にんまで！' },
    { t: 'do', wait: 'phase:play', target: 'main-action', msg: 'つぎに すすもう。「つぎへ（だす）」を おしてね。' },
    { t: 'do', wait: 'summon', target: 'hand-wrap', msg: 'いまは【だす】。\nおうえんが 1にん いるね。あかるく なっている ★1の カードを タップして「だす」を えらぼう！' },
    { t: 'info', target: 'hand-wrap', msg: 'カードの ★＝ よぶのに ひつような おうえんの かず。\n★3の なかまは おうえんが 3にん いないと でてこないんだ。' },
    { t: 'do', wait: 'phase:battle', target: 'main-action', msg: '「つぎへ（たたかう）」を おしてね。' },
    { t: 'info', target: 'my-field', msg: 'いまは【たたかう】。\nでも だしたばかりの モンスターは まだ ねむっていて、この ターンは たたかえないんだ。' },
    { t: 'do', wait: 'endTurn', target: 'main-action', msg: 'きょうは ここまで。「ターンおわり」を おしてね。' },
    { t: 'oppturn', msg: 'あいての ばん…\nなにを するか みてみよう。' },
    // --- じぶんの 2ターンめ ---
    { t: 'info', target: 'opp-field', msg: 'あいてが モンスターを だしたよ。\nそして じぶんの ばん。さいしょに やまふだから 1まい ひいたよ。' },
    { t: 'do', wait: 'charge', target: 'hand-wrap', msg: 'また てふだを 1まい「おうえんに まわす」を えらんで、\nおうえんを ふやそう。' },
    { t: 'do', wait: 'phase:play', target: 'main-action', msg: '「つぎへ（だす）」を おしてね。' },
    { t: 'do', wait: 'phase:battle', target: 'main-action', msg: 'こんかいは だすのは おやすみ。「つぎへ（たたかう）」を おしてね。' },
    { t: 'do', wait: 'select', target: 'my-field', msg: 'いまは【たたかう】。\nじぶんの モンスターを タップして えらぼう！' },
    { t: 'info', target: 'opp-field', msg: 'あいての カードの みぎうえの すうじが ダメージ。\nダメージ ＝ こうげき力 − ぼうぎょ力 だよ。' },
    { t: 'do', wait: 'attack', target: 'opp-field', msg: 'あいての モンスターを タップして こうげき！' },
    { t: 'info', target: 'opp-bar', msg: 'やっつけた！\nやられた モンスターの もちぬしは、その カードの ★の かずだけ たいりょくが へるんだ。' },
    { t: 'do', wait: 'endTurn', target: 'main-action', msg: '「ターンおわり」を おしてね。' },
    { t: 'oppturn', msg: 'あいての ばん…' },
    // --- じぶんの 3ターンめ ---
    { t: 'info', target: 'opp-field', msg: 'あいての ばが からっぽに なったよ。\nこういう ときは あいての 本体を「ちょくせつこうげき」できる！' },
    { t: 'do', wait: 'phase:play', target: 'main-action', msg: '「つぎへ（だす）」を おしてね。' },
    { t: 'do', wait: 'phase:battle', target: 'main-action', msg: '「つぎへ（たたかう）」を おしてね。' },
    { t: 'do', wait: 'attack', target: 'opp-field', msg: 'あかい「ちょくせつこうげき」の ボタンを おそう！' },
    { t: 'info', target: 'opp-bar', msg: 'ちょくせつこうげきの ダメージは ★の かず。\nこうやって あいての HPを 0に したら かちだよ！' },
    { t: 'end' }
  ];

  var TUTOR_TARGET_IDS = ['opp-bar', 'opp-field', 'phase-strip', 'my-field', 'my-bar', 'hand-wrap', 'main-action'];
  var tut = null; // { i: 進行中のステップ, oppTurn: あいての手順の番号, busy: 演出まちで操作を止める }

  function cardByName(name) {
    for (var i = 0; i < Engine.CARD_POOL_V3.length; i++) {
      if (Engine.CARD_POOL_V3[i].name === name) return Engine.CARD_POOL_V3[i];
    }
    return null;
  }
  function cardsByName(names) { return names.map(cardByName); }
  function handCardByName(p, name) {
    for (var i = 0; i < p.hand.length; i++) if (p.hand[i].name === name) return p.hand[i];
    return null;
  }

  function startTutorial() {
    mode = 'tutorial';
    humanIdx = 0;
    jankenFirstPlayer = 0;
    gameState = Engine.newGame(cardsByName(TUT_DATA.deck0), cardsByName(TUT_DATA.deck1), 0, rng, ['human', 'cpu']);
    var p0 = gameState.players[0], p1 = gameState.players[1];
    p0.hand = cardsByName(TUT_DATA.hand0);
    p0.deck = cardsByName(TUT_DATA.deck0).reverse();
    p1.hand = cardsByName(TUT_DATA.hand1);
    p1.deck = cardsByName(TUT_DATA.deck1).reverse();
    ui = { selectedAttacker: null, anim: null, deadGhost: null, fullLogReturn: 'screen-game', slots: [[null, null, null, null], [null, null, null, null]] };
    tut = { i: 0, oppTurn: 0, busy: false };
    Engine.beginTurn(gameState);
    enterTurnFlow();
  }

  function tutStep() { return tut ? TUT_STEPS[tut.i] : null; }

  // いまのステップで ゆるされている操作だけを うけつける(まちがったタップで迷子にならないように)。
  function tutAllows(kind) {
    if (mode !== 'tutorial') return true;
    if (!tut || tut.busy) return false;
    var st = tutStep();
    if (!st || st.t !== 'do') return false;
    if (kind === 'hand') return st.wait === 'charge' || st.wait === 'summon';
    if (kind === 'main') return st.wait === 'phase:play' || st.wait === 'phase:battle' || st.wait === 'endTurn';
    if (kind === 'select') return st.wait === 'select' || st.wait === 'attack';
    if (kind === 'attack') return st.wait === 'attack';
    return false; // 退却はチュートリアルでは使わない
  }

  function tutAdvance() {
    if (!tut) return;
    tut.busy = false;
    tut.i += 1;
    var st = tutStep();
    if (st && st.t === 'end') { showScreen('screen-tutorial-end'); return; }
    render();
  }

  // 操作が完了したことを伝える。delayMs を渡すと、その間は操作を止めて演出を見せてから進む。
  function tutNotify(kind, delayMs) {
    if (mode !== 'tutorial' || !tut) return;
    var st = tutStep();
    if (!st) return;
    if (st.t === 'oppturn') {
      if (kind === 'myTurn') tutAdvance();
      return;
    }
    if (st.t !== 'do' || st.wait !== kind) return;
    if (delayMs) {
      tut.busy = true;
      setTimeout(tutAdvance, delayMs);
    } else {
      tutAdvance();
    }
  }

  // 「せんせい」パネルと 光るヒントを画面に反映する。render() の最後から毎回呼ぶ。
  function updateTutorUI() {
    var panel = $('tutor-panel');
    if (!panel) return;
    for (var i = 0; i < TUTOR_TARGET_IDS.length; i++) {
      var t = $(TUTOR_TARGET_IDS[i]);
      if (t) t.classList.remove('tutor-target');
    }
    var st = tutStep();
    if (mode !== 'tutorial' || !st) {
      panel.classList.add('hidden');
      $('phase-banner').classList.remove('hidden');
      $('log-area').classList.remove('hidden');
      return;
    }
    // チュートリアル中は画面をすっきりさせるため、フェーズ帯とログの代わりにパネルを出す。
    $('phase-banner').classList.add('hidden');
    $('log-area').classList.add('hidden');
    panel.classList.remove('hidden');
    $('tutor-text').textContent = friendlyText(st.msg || '');
    $('btn-tutor-next').classList.toggle('hidden', st.t !== 'info');
    if (st.target && !tut.busy && st.t !== 'oppturn') {
      var el = $(st.target);
      if (el) el.classList.add('tutor-target');
    }
  }

  // チュートリアルの あいて。CPUの思考は使わず TUT_DATA.oppScript のとおりに動く。
  async function runTutorialOppTurn() {
    var sc = TUT_DATA.oppScript[tut.oppTurn] || { charge: [], summon: null };
    tut.oppTurn += 1;
    var p = gameState.players[gameState.acting];
    await sleep(500);
    for (var i = 0; i < sc.charge.length; i++) {
      if (!Engine.canChargeMore(gameState)) break;
      var c = handCardByName(p, sc.charge[i]) || p.hand[0];
      if (!c || !Engine.chargeCard(gameState, c)) break;
      Sound.charge();
      render();
      await sleep(650);
    }
    Engine.advanceToPlay(gameState);
    render();
    await sleep(300);
    if (sc.summon) {
      var s = handCardByName(p, sc.summon);
      if (s && Engine.canSummon(gameState, s).ok) {
        Engine.summon(gameState, s);
        Sound.summon();
        ui.anim = { flash: [false, false], bodyDmg: null, summonedCard: p.field[p.field.length - 1] };
        render();
        ui.anim = null;
        await sleep(750);
      }
    }
    Engine.advanceToBattle(gameState);
    render();
    await sleep(400);
    doEndTurn();
  }

  $('btn-tutor-next').onclick = function () {
    var st = tutStep();
    if (st && st.t === 'info') tutAdvance();
  };
  $('btn-tutorial-cpu').onclick = function () { tut = null; mode = 'cpu'; humanIdx = 0; goToJanken(); };
  $('btn-tutorial-again').onclick = function () { startTutorial(); };
  $('btn-tutorial-title').onclick = function () { tut = null; mode = 'cpu'; showScreen('screen-title'); };

  // ---------------------------------------------------------------------
  // アニメーション用の補助
  // ---------------------------------------------------------------------
  function snapshotHp() { return [gameState.players[0].hp, gameState.players[1].hp]; }
  function flashFromHp(before, after) { return [after[0] < before[0], after[1] < before[1]]; }
  // 本体HPが減っていれば{idx, text:'−N'}を返す(直接攻撃/死亡/退却/山札切れ、どれでも共通)。
  function computeBodyDmg(before, after) {
    for (var i = 0; i < 2; i++) {
      var d = before[i] - after[i];
      if (d > 0) return { idx: i, text: '−' + d };
    }
    return null;
  }
  function buildAttackAnim(hpBefore, hpAfter, opts) {
    opts = opts || {};
    return {
      flash: flashFromHp(hpBefore, hpAfter),
      bodyDmg: computeBodyDmg(hpBefore, hpAfter),
      hitCard: opts.hitCard || null,
      dmgTargetMon: opts.dmgTargetMon || null,
      dmgText: opts.dmgText !== undefined ? opts.dmgText : null,
      attackerCard: opts.attackerCard || null,
      summonedCard: null
    };
  }

  // ---------------------------------------------------------------------
  // CPUのターン(1手ずつ0.6秒間隔で反映)
  // ---------------------------------------------------------------------
  async function runCpuTurn() {
    await sleep(400);

    // ためる
    while (gameState.phase === 'charge' && Engine.canChargeMore(gameState)) {
      var acted = Engine.aiChargeStep(gameState);
      if (!acted) break;
      Sound.charge();
      render();
      await sleep(600);
    }
    if (gameState.phase === 'gameover') { showVictory(); return; }
    Engine.advanceToPlay(gameState);
    render();
    await sleep(300);

    // だす
    var actions = Engine.aiDecidePlayActions(gameState);
    for (var i = 0; i < actions.length; i++) {
      if (gameState.phase === 'gameover') break;
      var hpBefore = snapshotHp();
      var actionType = actions[i].type;
      Engine.applyPlayAction(gameState, actions[i]);
      var hpAfter = snapshotHp();
      var summonedCard = null;
      if (actionType === 'summon') {
        Sound.summon();
        var pp = gameState.players[gameState.acting];
        summonedCard = pp.field[pp.field.length - 1];
      } else if (actionType === 'retreat') {
        Sound.retreat();
      }
      ui.anim = buildAttackAnim(hpBefore, hpAfter, {});
      ui.anim.summonedCard = summonedCard;
      render();
      ui.anim = null;
      if (gameState.phase === 'gameover') { showVictory(); return; }
      await sleep(600);
    }
    if (gameState.phase === 'gameover') { showVictory(); return; }
    Engine.advanceToBattle(gameState);
    render();
    await sleep(300);

    // たたかう
    while (gameState.phase === 'battle') {
      ui.deadGhost = null;
      var hb = snapshotHp();
      var step = Engine.aiBattleStep(gameState);
      var ha = snapshotHp();
      var animOpts = {};
      if (step.acted) {
        animOpts.attackerCard = step.attacker;
        if (step.result.direct) {
          Sound.directAttack();
        } else if (step.target) {
          if (step.result.dmg > 0) Sound.hit(); else Sound.hitZero();
          animOpts.dmgTargetMon = step.target;
          animOpts.dmgText = String(step.result.dmg);
          if (step.result.killed) {
            Sound.death();
            ui.deadGhost = { ownerIdx: 1 - gameState.acting, mon: step.target };
          } else {
            animOpts.hitCard = step.target;
          }
        }
      }
      ui.anim = buildAttackAnim(hb, ha, animOpts);
      render();
      ui.anim = null;
      if (gameState.phase === 'gameover') {
        if (ui.deadGhost) { await sleep(550); ui.deadGhost = null; render(); }
        showVictory();
        return;
      }
      if (step.done) break;
      await sleep(600);
    }

    if (ui.deadGhost) {
      await sleep(550);
      ui.deadGhost = null;
      render();
    } else {
      await sleep(400);
    }
    doEndTurn();
  }

  function doEndTurn() {
    var hpBefore = snapshotHp();
    var deckoutBefore = gameState.damageBySource.deckout || 0;
    Engine.endTurn(gameState);
    var deckoutAfter = gameState.damageBySource.deckout || 0;
    if (deckoutAfter > deckoutBefore) Sound.bodyDamage();
    var hpAfter = snapshotHp();
    ui.anim = { flash: flashFromHp(hpBefore, hpAfter), hitCard: null, bodyDmg: computeBodyDmg(hpBefore, hpAfter) };
    if (gameState.phase === 'gameover') {
      render();
      ui.anim = null;
      showVictory();
      return;
    }
    enterTurnFlow();
    ui.anim = null;
  }

  // ---------------------------------------------------------------------
  // 人間の操作
  // ---------------------------------------------------------------------
  function withAnim(fn, candidateHitMonster) {
    var hpBefore = snapshotHp();
    var extra = fn() || {};
    var hpAfter = snapshotHp();
    var hitCard = null;
    if (candidateHitMonster) {
      var stillThere = gameState.players[0].field.indexOf(candidateHitMonster) >= 0 ||
        gameState.players[1].field.indexOf(candidateHitMonster) >= 0;
      if (stillThere) hitCard = candidateHitMonster;
    }
    var animObj = { flash: flashFromHp(hpBefore, hpAfter), hitCard: hitCard, bodyDmg: computeBodyDmg(hpBefore, hpAfter) };
    for (var k in extra) { if (Object.prototype.hasOwnProperty.call(extra, k)) animObj[k] = extra[k]; }
    ui.anim = animObj;
    render();
    ui.anim = null;
    if (gameState.phase === 'gameover') showVictory();
  }

  // 攻撃(直接攻撃/通常攻撃)を実行し、音・アニメ(踏み込み・ダメージ数字・死亡フェード)をまとめて処理する。
  function performAttack(attacker, target) {
    ui.selectedAttacker = null;
    var hpBefore = snapshotHp();
    var res = Engine.attack(gameState, attacker, target);
    var hpAfter = snapshotHp();

    if (res.ok) {
      if (res.direct) {
        Sound.directAttack();
      } else {
        if (res.dmg > 0) Sound.hit(); else Sound.hitZero();
      }
      if (res.killed) Sound.death();
    }

    var animOpts = { attackerCard: attacker };
    if (res.ok && !res.direct && target) {
      animOpts.dmgTargetMon = target;
      animOpts.dmgText = String(res.dmg);
      if (!res.killed) animOpts.hitCard = target;
    }
    ui.anim = buildAttackAnim(hpBefore, hpAfter, animOpts);
    if (res.killed && target) ui.deadGhost = { ownerIdx: oppIndex(), mon: target };
    render();
    ui.anim = null;

    if (res.killed) {
      setTimeout(function () {
        ui.deadGhost = null;
        render();
        if (gameState.phase === 'gameover') showVictory();
      }, 550);
    } else if (gameState.phase === 'gameover') {
      showVictory();
    }
    if (res.ok) tutNotify('attack', res.killed ? 1100 : 900);
  }

  function onMainAction() {
    if (!isMyInteractiveTurn()) return;
    if (!tutAllows('main')) return;
    // チュートリアル中は「せんせい」が次にすることを指示しているので、確認ダイアログは出さない。
    var skipConfirm = (mode === 'tutorial');
    var message, remaining, proceed;
    if (gameState.phase === 'charge') {
      message = 'まだ おうえんに まわせるよ。つぎへ すすむ？';
      remaining = hasChargeRemaining();
      proceed = function () {
        ui.selectedAttacker = null;
        Engine.advanceToPlay(gameState);
        render();
        tutNotify('phase:play');
      };
    } else if (gameState.phase === 'play') {
      message = 'まだ モンスターを だせるよ。つぎへ すすむ？';
      remaining = hasPlayRemaining();
      proceed = function () {
        ui.selectedAttacker = null;
        Engine.advanceToBattle(gameState);
        render();
        tutNotify('phase:battle');
      };
    } else if (gameState.phase === 'battle') {
      message = 'まだ こうげき できるよ。ターンを おわる？';
      remaining = hasBattleRemaining();
      proceed = function () {
        ui.selectedAttacker = null;
        tutNotify('endTurn');
        doEndTurn();
      };
    } else {
      return;
    }
    if (remaining && !skipConfirm) openConfirmModal(message, proceed);
    else proceed();
  }
  $('btn-main-action').onclick = onMainAction;

  // 「まだ行動が残っている」判定 ------------------------------------------------
  function hasChargeRemaining() {
    return Engine.canChargeMore(gameState);
  }
  function hasPlayRemaining() {
    var self = gameState.players[selfIndex()];
    return self.hand.some(function (c) { return Engine.canSummon(gameState, c).ok; });
  }
  function hasBattleRemaining() {
    var self = gameState.players[selfIndex()];
    var opp = gameState.players[oppIndex()];
    var attackers = self.field.filter(function (m) { return Engine.canAttack(gameState, m); });
    if (attackers.length === 0) return false;
    if (opp.field.length === 0) return true; // 直接攻撃は常に1以上のダメージになる
    return attackers.some(function (a) {
      return opp.field.some(function (t) { return Engine.attackDamagePreview(a.card, t.card) > 0; });
    });
  }

  // --- モーダル共通 ---
  function mkModalButton(label, enabled, onClick) {
    var b = document.createElement('button');
    b.textContent = label;
    b.className = enabled ? 'btn-primary' : 'btn-plain';
    b.disabled = !enabled;
    if (onClick) b.onclick = onClick;
    return b;
  }
  function mkModalButtonClass(label, cls, onClick) {
    var b = document.createElement('button');
    b.textContent = label;
    b.className = cls;
    if (onClick) b.onclick = onClick;
    return b;
  }
  function mkReason(text) {
    var d = document.createElement('div');
    d.className = 'reason';
    d.textContent = text;
    return d;
  }
  function closeModal() { $('modal-overlay').classList.add('hidden');if(dialogReturnFocus&&dialogReturnFocus.isConnected)dialogReturnFocus.focus();else $('btn-main-action').focus(); }

  function setModalCard(cardLike, statsText) {
    var box = $('modal-card-big');
    box.style.display = '';
    box.className = 'rarity-' + cardLike.rarity;
    box.querySelector('.mcb-icon').innerHTML = animalPicture(cardLike);
    box.querySelector('.mcb-name').textContent = animalName(cardLike) + ' · ★' + cardLike.rarityNum;
    box.querySelector('.mcb-stats').textContent = (statsText+(mode==='tutorial'?'':' / '+Engine.skillText(cardLike))).replace(/ATK/g,'こうげき').replace(/DEF/g,'ぼうぎょ').replace(/HP/g,'たいりょく');
  }

  // 「まだ行動が残っているよ」の確認ダイアログ。カード表示は使わずメッセージのみ。
  function openConfirmModal(message, onProceed) {
    $('modal-card-big').style.display = 'none';
    $('modal-title').textContent = message;
    var buttonsEl = $('modal-buttons');
    buttonsEl.innerHTML = '';
    buttonsEl.appendChild(mkModalButtonClass('すすむ', 'btn-primary', function () {
      closeModal();
      onProceed();
    }));
    buttonsEl.appendChild(mkModalButtonClass('まだ やる', 'btn-secondary', closeModal));
    openModal();
  }

  function openHandCardModal(card, sourceEl) {
    setModalCard(card, 'ATK ' + card.atk + ' / DEF ' + card.df + ' / HP ' + card.hp);
    var buttonsEl = $('modal-buttons');
    buttonsEl.innerHTML = '';

    if (gameState.phase === 'charge') {
      $('modal-title').textContent = 'このカードを どうする？';
      var canCharge = Engine.canChargeMore(gameState);
      buttonsEl.appendChild(mkModalButton('おうえんに まわす（うら向き）', canCharge, function () {
        flyToCost(sourceEl);
        Sound.charge();
        withAnim(function () { Engine.chargeCard(gameState, card); });
        closeModal();
        tutNotify('charge', 500);
      }));
      if (!canCharge) buttonsEl.appendChild(mkReason('この ターンは もう おうえんに まわせません'));
      buttonsEl.appendChild(mkModalButton('だす（このフェーズではできない）', false, null));
    } else if (gameState.phase === 'play') {
      $('modal-title').textContent = 'このカードを だしますか？';
      var check = Engine.canSummon(gameState, card);
      buttonsEl.appendChild(mkModalButton('だす', check.ok, function () {
        Sound.summon();
        withAnim(function () {
          Engine.summon(gameState, card);
          var p = gameState.players[selfIndex()];
          return { summonedCard: p.field[p.field.length - 1] };
        });
        closeModal();
        tutNotify('summon', 600);
      }));
      if (!check.ok) buttonsEl.appendChild(mkReason(check.reason));
    }
    var cancel = mkModalButton('やめる', true, closeModal);
    buttonsEl.appendChild(cancel);
    openModal();
  }

  // 手札のカードをおうえん(コスト)置き場の方向へ滑らせて消す簡易フライング演出。
  // (画面全体を都度作り直す描画方式のため、実DOMのクローンを作って独立に動かす)
  function flyToCost(sourceEl) {
    if (!sourceEl || prefersReducedMotion()) return;
    var rect = sourceEl.getBoundingClientRect();
    var targetEl = $('my-bar');
    if (!targetEl) return;
    var trect = targetEl.getBoundingClientRect();
    var clone = sourceEl.cloneNode(true);
    clone.style.position = 'fixed';
    clone.style.left = rect.left + 'px';
    clone.style.top = rect.top + 'px';
    clone.style.width = rect.width + 'px';
    clone.style.margin = '0';
    clone.style.zIndex = '100';
    clone.style.pointerEvents = 'none';
    clone.style.transition = 'transform 0.4s ease-in, opacity 0.4s ease-in';
    document.body.appendChild(clone);
    var dx = (trect.left + trect.width / 2) - (rect.left + rect.width / 2);
    var dy = (trect.top + trect.height / 2) - (rect.top + rect.height / 2);
    requestAnimationFrame(function () {
      clone.style.transform = 'translate(' + dx + 'px,' + dy + 'px) scale(0.4)';
      clone.style.opacity = '0';
    });
    setTimeout(function () { if (clone.parentNode) clone.parentNode.removeChild(clone); }, 450);
  }

  function openRetreatConfirm(m) {
    setModalCard(m.card, 'たいきゃくすると ' + m.card.rarityNum + 'ダメージ うけます');
    $('modal-title').textContent = 'このモンスターを たいきゃくさせますか？';
    var buttonsEl = $('modal-buttons');
    buttonsEl.innerHTML = '';
    var yes = mkModalButton('たいきゃくする（' + m.card.rarityNum + 'ダメージ）', true, function () {
      Sound.retreat();
      withAnim(function () { Engine.retreat(gameState, m); });
      closeModal();
    });
    yes.classList.add('btn-danger');
    buttonsEl.appendChild(yes);
    buttonsEl.appendChild(mkModalButton('やめる', true, closeModal));
    openModal();
  }

  function confirmDirectAttack() {
    var attacker = ui.selectedAttacker;
    if (!attacker) return;
    setModalCard(attacker.card, 'ちょくせつこうげき: ' + attacker.card.rarityNum + 'ダメージ');
    $('modal-title').textContent = 'ちょくせつこうげき しますか？';
    var buttonsEl = $('modal-buttons');
    buttonsEl.innerHTML = '';
    buttonsEl.appendChild(mkModalButton('こうげきする', true, function () {
      var a = attacker;
      closeModal();
      performAttack(a, null);
    }));
    buttonsEl.appendChild(mkModalButton('やめる', true, closeModal));
    openModal();
  }

  function executeAttack(target) {
    var attacker = ui.selectedAttacker;
    if (!attacker) return;
    performAttack(attacker, target);
  }

  // 直接攻撃できる（=このバトルフェーズでまだ攻撃していない）自分のモンスター一覧。
  function getAttackableMonsters() {
    if (!(isMyInteractiveTurn() && gameState.phase === 'battle')) return [];
    var self = gameState.players[selfIndex()];
    return self.field.filter(function (m) { return Engine.canAttack(gameState, m); });
  }

  // ---------------------------------------------------------------------
  // 描画
  // ---------------------------------------------------------------------
  function animalName(c) { var key = typeof c === 'string' ? c : c.name; return ANIMAL_ART[key] ? ANIMAL_ART[key].label : key; }
  function friendlyText(text) { Object.keys(ANIMAL_ART).forEach(function(key){text=text.split(key).join(ANIMAL_ART[key].label);});return text; }
  function animalPicture(c) {
    var a=ANIMAL_ART[c.name];
    if(!a)return '<span>'+escapeHtml(c.icon||'')+'</span>';
    return '<span class="animal-art" role="img" aria-label="'+escapeHtml(a.label)+'" style="--atlas:var(--animals-'+a.sheet+');--ax:'+a.x+'%;--ay:'+a.y+'%;--abx:'+a.bx+'%;--aby:'+a.by+'%"></span>'+(mode==='tutorial'?'':'<small class="animal-skill">'+escapeHtml(Engine.skillText(c).split('：')[0])+'</small>');
  }
  function animalStats(c,hp){return '<span class="stat-atk" title="こうげき">⚔ '+c.atk+'</span><span class="stat-def" title="ぼうぎょ">🛡 '+c.df+'</span><span class="stat-hp" title="たいりょく">♥ '+(hp===undefined?c.hp:hp)+'</span>';}
  var dialogReturnFocus=null, inspectReturnFocus=null;
  function openModal(){dialogReturnFocus=document.activeElement;$('modal-overlay').classList.remove('hidden');var b=$('modal-buttons').querySelector('button:not(:disabled)');if(b)b.focus();}
  function openInspect(c,remain){
    inspectReturnFocus=document.activeElement;
    $('inspect-title').textContent=animalName(c);
    $('inspect-picture').innerHTML=animalPicture(c);
    $('inspect-detail').innerHTML='<div class="inspect-cost">'+c.rarity+' · おうえん '+c.rarityNum+'にんで だせる</div><div class="inspect-stats"><span class="stat-atk">こうげき<b>'+c.atk+'</b></span><span class="stat-def">ぼうぎょ<b>'+c.df+'</b></span><span class="stat-hp">たいりょく<b>'+(remain===undefined?c.hp:remain)+'<small> / '+c.hp+'</small></b></span></div>';
    if(mode!=='tutorial')$('inspect-detail').innerHTML+='<p class="skill-description">'+escapeHtml(Engine.skillText(c))+'</p>';
    $('inspect-overlay').classList.remove('hidden');$('inspect-close').focus();
  }
  function closeInspect(){ $('inspect-overlay').classList.add('hidden');if(inspectReturnFocus&&inspectReturnFocus.isConnected)inspectReturnFocus.focus(); }
  function cardAccess(div,c,remain){
    div.dataset.cardName=c.name;if(remain!==undefined)div.dataset.remain=String(remain);
    div.tabIndex=0;div.setAttribute('role','button');div.setAttribute('aria-label',animalName(c)+'、こうげき'+c.atk+'、ぼうぎょ'+c.df+'、たいりょく'+(remain===undefined?c.hp:remain)+'。長押しでくわしく');
    div.onkeydown=function(e){if(e.key==='Enter'||e.key===' '){e.preventDefault();div.click();}else if(e.key==='i'){e.preventDefault();openInspect(c,remain);}};
  }
  function initAnimalUI(){
    $('inspect-close').onclick=closeInspect;
    $('inspect-overlay').onclick=function(e){if(e.target===$('inspect-overlay'))closeInspect();};
    $('modal-overlay').onclick=function(e){if(e.target===$('modal-overlay'))closeModal();};
    document.addEventListener('keydown',function(e){
      var inspecting=!$('inspect-overlay').classList.contains('hidden'),modal=!$('modal-overlay').classList.contains('hidden');
      if(!inspecting&&!modal)return;
      if(e.key==='Escape'){e.preventDefault();if(inspecting)closeInspect();else closeModal();return;}
      if(e.key==='Tab'){var box=$(inspecting?'inspect-box':'modal-box'),items=Array.from(box.querySelectorAll('button:not(:disabled),[href],[tabindex="0"]'));if(!items.length)return;var first=items[0],last=items[items.length-1];if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}}
    });
    var hold=null,timer=null,suppressUntil=0;
    function clearHold(){if(timer)clearTimeout(timer);timer=null;hold=null;}
    document.addEventListener('pointerdown',function(e){
      if(e.button!==0)return;var el=e.target.closest('[data-card-name]');if(!el)return;
      clearHold();hold={x:e.clientX,y:e.clientY,el:el,id:e.pointerId};
      timer=setTimeout(function(){if(!hold||!el.isConnected)return;var c=Engine.CARD_POOL_V3.find(function(x){return x.name===el.dataset.cardName;});if(c){suppressUntil=Date.now()+900;openInspect(c,el.dataset.remain===undefined?undefined:Number(el.dataset.remain));}clearHold();},450);
    },{passive:true});
    document.addEventListener('pointermove',function(e){if(hold&&e.pointerId===hold.id&&Math.hypot(e.clientX-hold.x,e.clientY-hold.y)>10)clearHold();},{passive:true});
    document.addEventListener('pointerup',clearHold,{passive:true});document.addEventListener('pointercancel',clearHold,{passive:true});
    document.addEventListener('scroll',clearHold,true);
    document.addEventListener('click',function(e){if(Date.now()<suppressUntil&&e.target.closest('[data-card-name]')){e.preventDefault();e.stopImmediatePropagation();}},true);
    document.addEventListener('contextmenu',function(e){if(e.target.closest('[data-card-name]'))e.preventDefault();});
    var cards=Engine.CARD_POOL_V3;
    $('title-art').innerHTML=[cards[6],cards[18],cards[12]].map(function(c){return '<div class="showcard">'+animalPicture(c)+'<strong>'+animalName(c)+'</strong><small>'+c.rarity+' · '+'★'.repeat(c.rarityNum)+'</small></div>';}).join('');
  }

  function render() {
    if (!gameState || gameState.phase === 'gameover') return;
    var self = gameState.players[selfIndex()];
    var opp = gameState.players[oppIndex()];
    var oppName = isSolo() ? 'あいて' : (opp.idx === 0 ? 'プレイヤー1' : 'プレイヤー2');
    var selfName = isSolo() ? 'じぶん' : (self.idx === 0 ? 'プレイヤー1' : 'プレイヤー2');

    renderBar('opp-bar', opp, oppName, true);
    renderBar('my-bar', self, selfName, false);
    renderOppField(opp);
    renderMyField(self);
    renderPhaseStrip();
    renderPhaseBanner();
    renderLog();
    renderHand(self);
    renderMainButton();
    updateTutorUI();
  }

  // 指示書13 A-1: 「今どのフェーズか分かりにくい」への対応。
  // 主ボタン(つぎへ/ターンおわり)のすぐ上に、今のフェーズを大きく表示する帯。
  // 既存のフェーズ帯(phase-strip、4分割インジケーター)は残したまま、両方表示する。
  var PHASE_BANNER_INFO = {
    draw: { title: 'いまは【ひく】', desc: 'やまふだから 1まい ひくよ' },
    charge: { title: 'いまは【おうえん】', desc: 'てふだを 1まい おうえんに まわせるよ' },
    play: { title: 'いまは【だす】', desc: 'おうえんの かずで モンスターを だそう' },
    battle: { title: 'いまは【たたかう】', desc: 'モンスターを えらんで こうげき！' }
  };
  function renderPhaseBanner() {
    var titleEl = $('phase-banner-title'), descEl = $('phase-banner-desc');
    if (!titleEl || !descEl) return;
    if (!isMyInteractiveTurn()) {
      titleEl.textContent = 'あいての ターン…';
      descEl.textContent = '';
      return;
    }
    var info = PHASE_BANNER_INFO[gameState.phase];
    titleEl.textContent = info ? info.title.replace('いまは【','').replace('】','') : '';
    descEl.textContent = gameState.phase==='battle'&&ui.selectedAttacker?'あいてを えらんで こうげき！':(info ? info.desc : '');
  }

  // 内部の「コスト」は、画面では ぜんぶ「おうえん」と よぶ(企画・ルールは変えていない)。
  // おいた枚数(costTotal)ぶんの丸を出し、この ターン まだ つかっていない ぶんだけ色をつける。
  // 「つかっても いなく ならない/つぎの ターンには また おうえんできる」を目で分かるようにするため、
  // 数字ではなく丸(HPと同じ見た目)で出している。
  function cheerDotsHtml(p) {
    if (p.costTotal <= 0) return 'まだ いない';
    var available = p.costTotal - p.costUsed;
    var dots = '';
    for (var i = 0; i < p.costTotal; i++) {
      dots += '<span class="cheer-dot' + (i < available ? '' : ' used') + '"></span>';
    }
    return '<span class="cheer-dots">' + dots + '</span>';
  }

  function renderBar(elId,p,name,isOpp){
    var el=$(elId),dots='';for(var i=0;i<10;i++)dots+='<span class="hp-dot '+(i<p.hp?'':'empty')+'"></span>';
    var bodyDmg=(ui.anim&&ui.anim.bodyDmg&&ui.anim.bodyDmg.idx===p.idx)?ui.anim.bodyDmg:null;
    el.innerHTML='<span class="name">'+escapeHtml(name)+'</span><span class="player-life hp-pill'+(bodyDmg?' hp-hit':'')+'"><b class="hp-num">♥ '+Math.max(0,p.hp)+'</b><small>/ 10</small><span class="hp-dots" aria-hidden="true">'+dots+'</span>'+(bodyDmg?'<span class="dmg-float body">'+escapeHtml(bodyDmg.text)+'</span>':'')+'</span><span class="cheer-info">おうえん <strong>'+(p.costTotal-p.costUsed)+'</strong> / '+p.costTotal+'</span><span class="turn-tag">'+(gameState.acting===p.idx?'いまの ばん':'')+'</span><span class="bar-info">てふだ '+p.hand.length+'まい'+(isOpp?'（うら）':'')+'<span>やまふだ '+p.deck.length+'まい</span></span>';
    el.classList.remove('anim-flash');if(ui.anim&&ui.anim.flash&&ui.anim.flash[p.idx]){void el.offsetWidth;el.classList.add('anim-flash');}
  }
  function monCardHtml(m){var remain=Math.max(0,m.card.hp-m.damage);return animalPicture(m.card)+'<div class="mon-name">'+escapeHtml(animalName(m.card))+'</div><div class="mon-stats">'+animalStats(m.card,remain)+'</div>'+(m.damage?'<div class="mon-hp">のこり '+remain+' / '+m.card.hp+'</div>':'');}

  function decorateMonDiv(div, m) {
    cardAccess(div,m.card,Math.max(0,m.card.hp-m.damage));
    if(!div.onclick)div.onclick=function(){openInspect(m.card,Math.max(0,m.card.hp-m.damage));};
    if (!(ui.anim)) return;
    if (ui.anim.hitCard === m) div.classList.add('anim-hit');
    if (ui.anim.attackerCard === m) div.classList.add('anim-lunge');
    if (ui.anim.summonedCard === m) div.classList.add('anim-summon');
    if (ui.anim.dmgTargetMon === m && ui.anim.dmgText !== null) {
      var isZero = ui.anim.dmgText === '0';
      var f = document.createElement('div');
      f.className = 'dmg-float' + (isZero ? ' zero' : '');
      f.textContent = ui.anim.dmgText;
      div.appendChild(f);
    }
  }

  // 場のスロット(4枠)を固定する。モンスターが死んでも残りが左に詰めないようにする。
  // 空いた枠はそのまま空きとして残り、新しく出したモンスターが一番左の空き枠に入る。
  function syncSlots(player, ghost) {
    var slots = ui.slots[player.idx];
    var i, k;
    // 場から消えたモンスターの枠を空ける（死亡演出中のゴーストはその場に残す）
    for (i = 0; i < 4; i++) {
      if (slots[i] && player.field.indexOf(slots[i]) < 0 && slots[i] !== ghost) slots[i] = null;
    }
    // まだ枠を持っていないモンスターを一番左の空き枠に入れる
    for (i = 0; i < player.field.length; i++) {
      if (slots.indexOf(player.field[i]) >= 0) continue;
      for (k = 0; k < 4; k++) {
        if (slots[k] === null) { slots[k] = player.field[i]; break; }
      }
    }
    // ゴーストが枠を持っていない場合の保険
    if (ghost && slots.indexOf(ghost) < 0) {
      for (k = 0; k < 4; k++) {
        if (slots[k] === null) { slots[k] = ghost; break; }
      }
    }
    return slots;
  }

  function renderMyField(self) {
    var el = $('my-field');
    el.innerHTML = '';
    var interactive = isMyInteractiveTurn();
    var ghost = (ui.deadGhost && ui.deadGhost.ownerIdx === self.idx) ? ui.deadGhost.mon : null;
    var slots = syncSlots(self, ghost);
    for (var i = 0; i < 4; i++) {
      var m = slots[i];
      if (!m) {
        var empty = document.createElement('div');
        empty.className = 'field-slot';
        el.appendChild(empty);
        continue;
      }
      var div = document.createElement('div');
      div.className = 'mon-card rarity-' + m.card.rarity + (m === ghost ? ' anim-dead' : '');
      div.innerHTML = monCardHtml(m);
      if (m !== ghost && interactive && gameState.phase === 'play' && mode !== 'tutorial') {
        div.onclick = (function (mon) { return function () { openRetreatConfirm(mon); }; })(m);
      } else if (m !== ghost && interactive && gameState.phase === 'battle') {
        var attackable = Engine.canAttack(gameState, m);
        if (!attackable) {
          div.classList.add('dimmed');
        } else {
          div.classList.add('ready');
          if (ui.selectedAttacker === m) div.classList.add('selectable');
          if (tutAllows('select')) {
            div.onclick = (function (mon) {
              return function () { ui.selectedAttacker = mon; render(); tutNotify('select'); };
            })(m);
          }
        }
      }
      var state=document.createElement('span');state.className='card-state';state.textContent=ui.selectedAttacker===m?'えらんだ！':(Engine.canAttack(gameState,m)&&interactive&&gameState.phase==='battle'?'こうげき OK':gameState.phase==='battle'&&interactive?'おやすみ':'');div.appendChild(state);
      decorateMonDiv(div, m);
      el.appendChild(div);
    }
  }

  function renderOppField(opp) {
    var el = $('opp-field');
    el.innerHTML = '';
    var ghost = (ui.deadGhost && ui.deadGhost.ownerIdx === opp.idx) ? ui.deadGhost.mon : null;

    if (opp.field.length === 0 && !ghost) {
      var wrap = document.createElement('div');
      wrap.style.flex = '1';
      wrap.style.display = 'flex';
      wrap.style.alignItems = 'center';
      wrap.style.justifyContent = 'center';
      // 攻撃できるモンスターが1体もいなければボタンは出さない。
      // 選択中のモンスターが（既に攻撃済み等で）攻撃できない場合は無視し、
      // 攻撃可能な先頭のモンスターをデフォルトの攻撃者として扱う。
      var attackable = getAttackableMonsters();
      if (attackable.length > 0) {
        var chosen = (ui.selectedAttacker && attackable.indexOf(ui.selectedAttacker) >= 0)
          ? ui.selectedAttacker
          : attackable[0];
        var btn = document.createElement('button');
        btn.className = 'btn-danger';
        btn.style.width = '100%';
        btn.textContent = 'ちょくせつこうげき（' + chosen.card.rarityNum + 'ダメージ）';
        btn.disabled = !tutAllows('attack');
        btn.onclick = function () {
          ui.selectedAttacker = chosen;
          confirmDirectAttack();
        };
        wrap.appendChild(btn);
      } else {
        wrap.textContent = 'あいての ばは からっぽ';
        wrap.style.color = '#52735b';
        wrap.style.fontSize = '14px';
      }
      el.appendChild(wrap);
      return;
    }
    var slots = syncSlots(opp, ghost);
    for (var i = 0; i < 4; i++) {
      var m = slots[i];
      if (!m) {
        var empty = document.createElement('div');
        empty.className = 'field-slot';
        el.appendChild(empty);
        continue;
      }
      var div = document.createElement('div');
      div.className = 'mon-card rarity-' + m.card.rarity + (m === ghost ? ' anim-dead' : '');
      div.innerHTML = monCardHtml(m);
      if (m !== ghost && isMyInteractiveTurn() && gameState.phase === 'battle' && ui.selectedAttacker) {
        div.classList.add('targetable');
        var dmg = Engine.previewAttack(gameState,ui.selectedAttacker,m);
        var badge = document.createElement('div');
        badge.className = 'dmg-badge';
        badge.textContent = String(dmg);
        div.appendChild(badge);
        if (tutAllows('attack')) {
          div.onclick = (function (mon) { return function () { executeAttack(mon); }; })(m);
        }
      }
      decorateMonDiv(div, m);
      el.appendChild(div);
    }
  }

  function renderPhaseStrip() {
    var order = ['draw', 'charge', 'play', 'battle'];
    var curIdx = order.indexOf(gameState.phase);
    var steps = document.querySelectorAll('.phase-step');
    for (var i = 0; i < steps.length; i++) {
      var el = steps[i];
      var idx = order.indexOf(el.dataset.phase);
      el.classList.remove('active', 'done');
      if (idx === 0 || idx < curIdx) el.classList.add('done');
      if (idx === curIdx) el.classList.add('active');
    }
  }

  // ---------------------------------------------------------------------
  // ログの子ども向け表示変換
  // engine.js の内部ログ（「P0: 「C-とっこう」を召喚 (コスト1消費, 場占有1/4)」等）は
  // そのままにしておき、ここ(app.js)で表示用に日本語へ整形しなおす。
  // カード名の前にはICON_BY_NAMEから引いたアイコンを付ける。
  // ---------------------------------------------------------------------
  function playerLabel(pIdx) {
    if (isSolo()) {
      return pIdx === selfIndex() ? 'あなた' : 'あいて';
    }
    return pIdx === 0 ? 'プレイヤー1' : 'プレイヤー2';
  }

  // 1行の内部ログを表示用テキストに変換する。対応パターンが無ければ null。
  function translateLogLine(raw) {
    var m;

    m = raw.match(/^--- (\d+)たんめ: P(\d) \(HP P0=-?\d+ P1=-?\d+\) ---$/);
    if (m) return '── ' + playerLabel(Number(m[2])) + 'の ' + m[1] + 'ターンめ ──';

    m = raw.match(/^初期手札: 先攻P\d=(\d+)枚, 後攻P\d=(\d+)枚$/);
    if (m) return 'はじめの 手ふだ: せんこう' + m[1] + 'まい、こうこう' + m[2] + 'まい';

    m = raw.match(/^P(\d): 先攻1ターン目のためドローなし$/);
    if (m) return playerLabel(Number(m[1])) + 'は 1ターンめなので ひかない';

    m = raw.match(/^P(\d): 1枚ドロー \(手札\d+枚\)$/);
    if (m) return playerLabel(Number(m[1])) + 'が 1まい ひいた';

    m = raw.match(/^P\d 山札切れ→本体1ダメージ \(HP=-?\d+\)$/);
    if (m) return '山ふだが ない！ 1ダメージ';

    m = raw.match(/^P(\d): 「(.+)」をコストに置く \(コスト\d+枚\)$/);
    if (m) return playerLabel(Number(m[1])) + 'が ' + iconFor(m[2]) + m[2] + ' を おうえんに まわした';

    m = raw.match(/^P(\d): 「(.+)」を召喚 \(コスト\d+消費, 場占有\d+\/4\)$/);
    if (m) return playerLabel(Number(m[1])) + 'が ' + iconFor(m[2]) + m[2] + ' を だした';

    m = raw.match(/^P(\d): 「(.+)」がちょくせつこうげき → P(\d)に(\d+) \(HP=-?\d+\)$/);
    if (m) return playerLabel(Number(m[3])) + 'に ちょくせつこうげき！ ' + m[4] + 'ダメージ';

    m = raw.match(/^P(\d): 「(.+)」が P(\d)の「(.+)」を攻撃 \((\d+)-(\d+)=(\d+), 蓄積\d+\/\d+\)$/);
    if (m) {
      return playerLabel(Number(m[1])) + 'の ' + iconFor(m[2]) + m[2] + ' が ' +
        playerLabel(Number(m[3])) + 'の ' + iconFor(m[4]) + m[4] + ' を こうげき（' + m[5] + '−' + m[6] + '＝' + m[7] + '）';
    }

    m = raw.match(/^ {2}→「(.+)」死亡。P(\d)に本体(\d+)ダメージ \(HP=-?\d+\)$/);
    if (m) {
      var ownerLabel = playerLabel(Number(m[2]));
      return ownerLabel + 'の ' + iconFor(m[1]) + m[1] + ' が やられた！ ' + ownerLabel + 'に ' + m[3] + 'ダメージ';
    }

    return null;
  }

  // ログ全体（gameState.log の生配列）を表示用の行配列に変換する。
  // 「たいきゃく」だけは2行(名前/ダメージ)を1行にまとめて表示する。
  function buildDisplayLog(rawLog) {
    var out = [];
    var i = 0;
    while (i < rawLog.length) {
      var line = rawLog[i];
      var mRet = line.match(/^P(\d): 「(.+)」を退却$/);
      if (mRet && i + 1 < rawLog.length) {
        var mDmg = rawLog[i + 1].match(/^ {2}→退却ダメージ P\d に(\d+) \(HP=-?\d+\)$/);
        if (mDmg) {
          out.push(playerLabel(Number(mRet[1])) + 'の ' + iconFor(mRet[2]) + mRet[2] + ' が たいきゃく（' + mDmg[1] + 'ダメージ）');
          i += 2;
          continue;
        }
      }
      var t = translateLogLine(line);
      out.push(t !== null ? t : line);
      i += 1;
    }
    return out.map(friendlyText);
  }

  function renderLog(){var el=$('log-area'),display=buildDisplayLog(gameState.log);el.innerHTML='<span class="log-more">きろく ›</span>'+escapeHtml(display.length?display[display.length-1]:'まだ できごとは ないよ');el.onclick=openFullLog;el.tabIndex=0;el.setAttribute('role','button');el.setAttribute('aria-label','たたかいの きろくを みる');el.onkeydown=function(e){if(e.key==='Enter'||e.key===' '){e.preventDefault();openFullLog();}};}

  function openFullLog() {
    ui.fullLogReturn = getCurrentScreenId();
    $('fulllog-content').textContent = gameState ? buildDisplayLog(gameState.log).join('\n') : '';
    showScreen('screen-fulllog');
  }
  $('btn-fulllog-back').onclick = function () { showScreen(ui.fullLogReturn || 'screen-game'); };

  function renderHand(self){var el=$('hand-scroll'),scroll=el.scrollLeft;el.innerHTML='';var interactive=isMyInteractiveTurn();self.hand.forEach(function(c){var div=document.createElement('div');div.className='hand-card rarity-'+c.rarity;var usable=false;if(interactive&&tutAllows('hand')){if(gameState.phase==='charge')usable=Engine.canChargeMore(gameState);else if(gameState.phase==='play')usable=Engine.canSummon(gameState,c).ok;}div.classList.add(usable?'usable':'disabled');var hint=usable?(gameState.phase==='charge'?'おうえんに できる':'だせる！'):'なが押しで くわしく';div.innerHTML='<span class="cost-badge">★ '+c.rarityNum+' · '+c.rarity+'</span>'+animalPicture(c)+'<div class="hc-name">'+escapeHtml(animalName(c))+'</div><div class="hc-stats">'+animalStats(c)+'</div><div class="card-hint">'+hint+'</div>';cardAccess(div,c);div.onclick=function(){if(interactive&&tutAllows('hand')&&(gameState.phase==='charge'||gameState.phase==='play'))openHandCardModal(c,div);else openInspect(c);};el.appendChild(div);});el.scrollLeft=scroll;updateHandScrollHint();}

  function updateHandScrollHint() {
    var el = $('hand-scroll');
    var hint = $('hand-scroll-hint');
    if (!el || !hint) return;
    var overflow = el.scrollWidth > el.clientWidth + 4;
    var atEnd = el.scrollLeft + el.clientWidth >= el.scrollWidth - 4;
    hint.classList.toggle('hidden', !overflow || atEnd);
  }
  var handScrollEl = $('hand-scroll');
  if (handScrollEl) handScrollEl.addEventListener('scroll', updateHandScrollHint);

  function renderMainButton() {
    var btn = $('btn-main-action');
    var interactive = isMyInteractiveTurn();
    if (!interactive) {
      btn.textContent = isSolo() ? 'あいての ターン…' : '';
      btn.disabled = true;
      return;
    }
    btn.disabled = !tutAllows('main');
    if (gameState.phase === 'charge') btn.textContent = 'だす へ →';
    else if (gameState.phase === 'play') btn.textContent = 'たたかう へ →';
    else if (gameState.phase === 'battle') btn.textContent = 'ばんを おわる';
  }

  // ---------------------------------------------------------------------
  // 勝敗画面
  // ---------------------------------------------------------------------
  function showVictory() {
    var gs = gameState;
    var p0 = gs.players[0], p1 = gs.players[1];
    var title;
    if (gs.winner === null) {
      title = 'ひきわけ';
    } else if (isSolo()) {
      title = (gs.winner === humanIdx) ? 'あなたの かち！' : 'あいての かち…';
      if (gs.winner === humanIdx) Sound.win(); else Sound.lose();
    } else {
      title = (gs.winner === 0 ? 'プレイヤー1' : 'プレイヤー2') + ' の かち！';
      Sound.win();
    }
    $('victory-title').textContent = title;
    var d = gs.damageBySource;
    var firstName = gs.firstPlayer === 0 ? 'プレイヤー1' : 'プレイヤー2';
    var html =
      '<div>せんこう: ' + (isSolo() ? (gs.firstPlayer === humanIdx ? 'あなた' : 'あいて') : firstName) + '</div>' +
      '<div>ばんの かず: 1P=' + p0.turnNo + ' / 2P=' + p1.turnNo + '（ぜんぶで' + gs.ply + '）</div>' +
      '<table>' +
      '<tr><td>なかまが やられた</td><td>' + (d.death || 0) + '</td></tr>' +
      '<tr><td>ちょくせつこうげき</td><td>' + (d.direct || 0) + '</td></tr>' +
      '<tr><td>たいきゃく</td><td>' + (d.retreat || 0) + '</td></tr>' +
      '<tr><td>山ふだ切れ</td><td>' + (d.deckout || 0) + '</td></tr>' +
      '</table>';
    $('victory-detail').innerHTML = html;
    showScreen('screen-victory');
  }

  $('btn-again').onclick = function () { goToJanken(); };
  $('btn-title2').onclick = function () { showScreen('screen-title'); };

  // 初期画面
  initAnimalUI();
  showScreen('screen-title');
})();
