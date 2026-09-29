'use strict';
/* ================================================================
   UNO — UI + flow
   ================================================================ */
function UnoUI(cfg, root){
  const AV = ['lav','mint','peach','sky'];
  const CNAME = {r:'Red', y:'Yellow', g:'Green', b:'Blue'};
  const humans = cfg.seats.filter(s => !s.bot).length;
  const singleHuman = humans === 1 ? cfg.seats.findIndex(s => !s.bot) : -1;
  let G = LOGIC.unoNew(cfg.seats.length, {target: cfg.target});
  let dead = false;
  let phase = 'idle';        // idle | play | drawn | locked
  let pendingUno = null;     // {pi, timer}
  let viewIdx = singleHuman >= 0 ? singleHuman : null; // whose hand is on display
  const level = cfg.level;
  const seats = cfg.seats;

  root.innerHTML =
    '<div class="screen uno">' + UI.topbar('UNO', {restart:true}) +
    '<div class="uno-main">' +
    '<div class="pl-row" id="u-chips"></div>' +
    '<div class="u-center">' +
      '<div class="u-pilewrap"><div class="upile" id="u-pile"><span class="uback-glyph">🂠</span><span class="ucount" id="u-count"></span></div><span class="u-label">Draw</span></div>' +
      '<div class="u-discwrap"><div class="uring r" id="u-ring"></div><div class="u-discard" id="u-disc"></div><div class="udir" id="u-dir"><span class="arr">⟳</span></div></div>' +
    '</div>' +
    '<div class="u-ticker" id="u-ticker"></div>' +
    '<div class="u-me-bar"><div class="who" id="u-who"></div><div class="hcount" id="u-hcount"></div></div>' +
    '<div class="drawn-choice hidden" id="u-choice"></div>' +
    '<div class="hand-wrap"><button class="uno-btn hidden" id="u-unobtn">UNO!</button><div class="hand" id="u-hand"></div></div>' +
    '<div class="veil hidden" id="u-veil"></div>' +
    '</div></div>';
  UI.bindTopbar(root, 'uno');

  const el = {
    chips: $('#u-chips'), pile: $('#u-pile'), count: $('#u-count'), disc: $('#u-disc'),
    ring: $('#u-ring'), dir: $('#u-dir'), ticker: $('#u-ticker'), who: $('#u-who'),
    hcount: $('#u-hcount'), choice: $('#u-choice'), hand: $('#u-hand'),
    unobtn: $('#u-unobtn'), veil: $('#u-veil')
  };

  function cardHTML(c, extra){
    const g = LOGIC.unoGlyph(c);
    return '<div class="ucard c-' + c.c + (c.v === 'W4' ? ' W4' : '') + ' ' + (extra || '') + '">' +
      '<span class="cor tl">' + g + '</span><div class="ell"><span class="glyph">' + g + '</span></div><span class="cor br">' + g + '</span></div>';
  }
  function chipHTML(pi){
    const P = G.players[pi], s = seats[pi];
    const isTurn = G.turn === pi && !G.roundWinner;
    return '<div class="pl-chip' + (isTurn ? ' active' : '') + '" data-chip="' + pi + '">' +
      '<div class="av av-' + AV[pi] + '">' + esc((s.name || '?').slice(0,1).toUpperCase()) +
      (s.bot ? '<span style="position:absolute;bottom:-4px;right:-4px;font-size:12px">🤖</span>' : '') + '</div>' +
      '<div class="p-name">' + esc(s.name) + '</div>' +
      '<div class="p-sub"><span id="u-n' + pi + '">' + P.hand.length + '</span> cards • ' + P.score + 'pt</div></div>';
  }
  function renderChips(){ el.chips.innerHTML = G.players.map((_, i) => chipHTML(i)).join(''); }
  function bubble(pi, text){
    const chip = $('[data-chip="' + pi + '"]', el.chips);
    if(!chip) return;
    $$('.bubble', chip).forEach(b => b.remove());
    const b = document.createElement('div');
    b.className = 'bubble'; b.textContent = text;
    chip.appendChild(b);
    Timers.set(() => b.remove(), 2200);
  }
  function renderCenter(){
    const top = LOGIC.unoTop(G);
    el.disc.innerHTML = cardHTML(top);
    el.ring.className = 'uring ' + G.activeColor;
    el.dir.style.transform = G.dir === 1 ? 'scaleX(1)' : 'scaleX(-1)';
    el.count.textContent = G.deck.length + ' left';
    el.pile.classList.toggle('can', phase === 'play' && !G.players[G.turn].bot);
  }
  function handCardsHTML(pi){
    const P = G.players[pi], top = LOGIC.unoTop(G);
    const n = P.hand.length;
    return P.hand.map((c, i) => {
      const ok = LOGIC.unoCanPlay(c, G.activeColor, top.v, P.hand);
      const r = (i - (n - 1) / 2) * Math.min(3.5, 30 / Math.max(n, 1));
      return cardHTML(c, (G.turn === pi && phase === 'play' ? (ok ? 'ok' : 'dim') : '') )
        .replace('class="ucard', 'style="--r:' + r.toFixed(1) + 'deg" class="ucard');
    }).join('');
  }
  function renderHand(){
    const pi = viewIdx;
    if(pi == null){
      el.hand.innerHTML = '<div style="margin:auto;color:var(--faint);font-weight:700;font-size:13px">🙈 cards hidden — pass the phone</div>';
      el.who.innerHTML = '';
      el.hcount.textContent = '';
      return;
    }
    el.hand.innerHTML = handCardsHTML(pi);
    const s = seats[pi];
    el.who.innerHTML = '<span class="tdot' + (G.turn === pi ? ' turn' : '') + '"></span>' + esc(s.name) + (G.turn === pi ? ' — your turn' : '');
    el.hcount.textContent = G.players[pi].hand.length + ' cards';
    if(G.turn === pi && phase === 'play'){
      $$('.ucard', el.hand).forEach((cEl, i) => cEl.addEventListener('click', () => onCardTap(pi, i, cEl)));
    }
  }
  function ticker(t){ el.ticker.textContent = t || ''; }
  function renderAll(){ renderChips(); renderCenter(); renderHand(); }

  /* ---------- event animation queue ---------- */
  function runEvents(evs, done){
    let i = 0;
    const step = () => {
      if(dead) return;
      if(i >= evs.length){ if(done) done(); return; }
      const e = evs[i++];
      if(e.t === 'play'){
        Snd.card(); buzz(12);
        renderAll(); renderCenter();
        Timers.set(step, 260);
      } else if(e.t === 'color'){
        ticker((seats[e.pi].name) + ' picks ' + CNAME[e.c]);
        Snd.pop();
        renderCenter();
        Timers.set(step, 420);
      } else if(e.t === 'reverse'){
        ticker('Direction reversed!');
        renderCenter();
        Timers.set(step, 380);
      } else if(e.t === 'skip'){
        bubble(e.pi, 'skipped 😴');
        Snd.buzz();
        Timers.set(step, 420);
      } else if(e.t === 'draw'){
        if(e.forced){ bubble(e.pi, '+' + e.n + ' 😩'); Snd.sad(); buzz(40); }
        else Snd.draw();
        renderChips(); if(viewIdx === e.pi || (!G.players[G.turn].bot && G.turn === e.pi)) renderHand();
        Timers.set(step, 480);
      } else if(e.t === 'pass'){
        ticker(seats[e.pi].name + ' keeps the card — turn passes');
        Timers.set(step, 300);
      } else if(e.t === 'round'){
        handleRound(e);
      } else Timers.set(step, 100);
    };
    step();
  }

  /* ---------- turns ---------- */
  function beginTurn(){
    if(dead || G.roundWinner != null) return;
    renderAll();
    const pi = G.turn, P = G.players[pi];
    if(G.reshuffled){ Toast.show('🃏 Deck reshuffled'); G.reshuffled = false; }
    if(seats[pi].bot){
      phase = 'locked';
      ticker(seats[pi].name + ' is thinking');
      renderChips();
      Timers.set(() => { if(!dead) botAct(pi); }, 850 + Math.random() * 800);
    } else {
      phase = 'play';
      if(humans > 1) showVeil(pi, () => { viewIdx = pi; humanReady(pi); });
      else { viewIdx = pi; humanReady(pi); }
    }
  }
  function humanReady(pi){
    renderAll();
    const playable = LOGIC.unoPlayableIdx(G, pi);
    ticker(playable.length ? 'Tap a glowing card — or tap the draw pile' : 'No playable card — tap the draw pile');
  }
  function showVeil(pi, onReveal){
    const s = seats[pi];
    el.veil.innerHTML = '<div class="v-big">📵</div><div class="v-t1">Pass the phone to ' + esc(s.name) + '</div><div class="v-t2">Tap to reveal your cards</div>';
    el.veil.classList.remove('hidden');
    el.veil.onclick = () => { Snd.pop(); el.veil.classList.add('hidden'); el.veil.onclick = null; onReveal(); };
  }
  function onCardTap(pi, i, cardEl){
    if(dead || phase !== 'play' || G.turn !== pi) return;
    const P = G.players[pi];
    const card = P.hand[i];
    const top = LOGIC.unoTop(G);
    if(!LOGIC.unoCanPlay(card, G.activeColor, top.v, P.hand)){
      cardEl.classList.add('wiggle'); Snd.buzz();
      Timers.set(() => cardEl.classList.remove('wiggle'), 350);
      return;
    }
    if(card.c === 'w'){
      Modal.open({
        title:'🌈 Choose a color',
        html:'<div class="colorpick">' + ['r','y','g','b'].map(c =>
          '<button class="cp-' + c + '" data-c="' + c + '">' + CNAME[c] + '</button>').join('') + '</div>',
        dismiss:false,
        actions:[]
      });
      $$('.colorpick button').forEach(b => b.addEventListener('click', () => {
        Modal.close(); Snd.pop();
        fly(cardEl, el.disc, cardHTML(card), 380, () => commitPlay(pi, i, b.dataset.c));
      }));
    } else {
      fly(cardEl, el.disc, cardHTML(card), 380, () => commitPlay(pi, i, null));
    }
  }
  el.pile.addEventListener('click', () => {
    if(dead || phase !== 'play' || G.players[G.turn].bot) return;
    const pi = G.turn;
    phase = 'locked';
    const res = LOGIC.unoDrawTurn(G, pi);
    Snd.draw();
    runEvents(res.ev, () => {
      if(res.playable){
        phase = 'drawn';
        el.choice.classList.remove('hidden');
        el.choice.innerHTML =
          '<div class="ucard-mini">' + cardHTML(res.card).replace('class="ucard', 'style="--uw:42px;--uh:63px" class="ucard') + '</div>' +
          '<div class="dc-label">You drew <b>' + (res.card.c === 'w' ? 'a Wild' : CNAME[res.card.c] + ' ' + LOGIC.unoGlyph(res.card)) + '</b> — it\'s playable!</div>' +
          '<button class="btn btn-primary" id="dc-play">Play it</button><button class="btn btn-ghost" id="dc-keep">Keep</button>';
        $('#dc-play').addEventListener('click', () => {
          el.choice.classList.add('hidden'); Snd.click();
          const idx = G.players[pi].hand.length - 1;
          if(res.card.c === 'w'){
            Modal.open({ title:'🌈 Choose a color', dismiss:false,
              html:'<div class="colorpick">' + ['r','y','g','b'].map(c => '<button class="cp-' + c + '" data-c="' + c + '">' + CNAME[c] + '</button>').join('') + '</div>' });
            $$('.colorpick button').forEach(b => b.addEventListener('click', () => { Modal.close(); commitPlay(pi, idx, b.dataset.c); }));
          } else commitPlay(pi, idx, null);
        });
        $('#dc-keep').addEventListener('click', () => {
          el.choice.classList.add('hidden'); Snd.click();
          LOGIC.unoKeepDrawn(G, pi);
          ticker('You keep the card');
          Timers.set(beginTurn, 350);
        });
      } else {
        ticker('Not playable — turn passes');
        Timers.set(beginTurn, 500);
      }
    });
  });
  function commitPlay(pi, idx, color){
    if(dead) return;
    phase = 'locked';
    el.choice.classList.add('hidden');
    const P = G.players[pi];
    const wasTwo = P.hand.length === 2;
    const evs = LOGIC.unoPlay(G, pi, idx, color);
    runEvents(evs, () => {
      if(dead) return;
      // UNO call window for humans
      if(P.hand.length === 1 && !seats[pi].bot && !G.roundWinner){
        startUnoWindow(pi);
        return;
      }
      if(!G.roundWinner) beginTurn();
    });
  }
  function startUnoWindow(pi){
    pendingUno = {pi};
    el.unobtn.classList.remove('hidden');
    el.unobtn.onclick = () => {
      if(!pendingUno || pendingUno.pi !== pi) return;
      LOGIC.unoCall(G, pi);
      Snd.uno(); buzz(25);
      bubble(pi, 'UNO!');
      endUnoWindow();
      Timers.set(beginTurn, 300);
    };
    pendingUno.timer = Timers.set(() => {
      if(dead || !pendingUno) return;
      const caught = LOGIC.unoCatch(G, pi);
      if(caught){
        Snd.buzz(); Snd.sad(); buzz(60);
        Toast.show('😲 Bots caught you — forgot UNO! +2 cards');
        bubble(pi, '+2 😅');
      }
      endUnoWindow();
      beginTurn();
    }, 3100);
  }
  function endUnoWindow(){
    if(pendingUno && pendingUno.timer) Timers.clear(pendingUno.timer);
    pendingUno = null;
    el.unobtn.classList.add('hidden');
  }
  function botAct(pi){
    if(dead || G.roundWinner != null) return;
    const act = LOGIC.unoBotAction(G, pi, level);
    const chip = $('[data-chip="' + pi + '"]');
    if(act){
      const card = G.players[pi].hand[act.idx];
      if(card.c === 'w'){ bubble(pi, CNAME[act.color] + '!'); }
      fly(chip, el.disc, cardHTML(card), 420, () => commitPlay(pi, act.idx, act.color));
    } else {
      const res = LOGIC.unoDrawTurn(G, pi);
      runEvents(res.ev, () => {
        if(dead) return;
        if(res.playable){
          Timers.set(() => {
            if(dead || G.roundWinner != null) return;
            const idx = G.players[pi].hand.length - 1;
            const card = G.players[pi].hand[idx];
            const col = card.c === 'w' ? LOGIC.unoWildColor(G.players[pi].hand) : null;
            if(col) bubble(pi, CNAME[col] + '!');
            commitPlay(pi, idx, col);
          }, 600);
        } else Timers.set(beginTurn, 400);
      });
    }
  }

  /* ---------- round / match end ---------- */
  function handleRound(e){
    phase = 'locked';
    const winnerName = seats[e.pi].name;
    Snd.win(); Confetti.burst(120); buzz([40,60,80]);
    const rows = e.scores.map((s, i) =>
      '<tr class="' + (s >= Math.max.apply(null, e.scores) ? 'lead' : '') + '"><td>' + esc(seats[i].name) + (i === e.pi ? ' 🏆' : '') + '</td><td>' + G.players[i].hand.length + ' cards</td><td><b>' + s + '</b></td></tr>'
    ).join('');
    const over = e.over;
    Timers.set(() => {
      if(dead) return;
      Modal.open({
        title: over ? '👑 Match winner!' : '🎉 Round won!',
        html: '<div class="win-emoji">' + (over ? '👑' : '🎉') + '</div>' +
          '<div class="win-name">' + esc(winnerName) + '</div>' +
          '<div class="win-sub">' + (over ? 'First to ' + G.target + ' points — match over!' : 'collected <b>' + e.gained + ' points</b> this round') + '</div>' +
          (over ? '<div class="podium"><div class="pod-row"><span class="medal">🥇</span><span class="pn">' + esc(winnerName) + '</span><span class="pd">' + e.scores[e.pi] + ' pts</span></div></div>'
                : '<table class="score-tbl"><tr><th>Player</th><th>Hand</th><th>Score</th></tr>' + rows + '</table>' +
                  '<div class="round-gain">Next round: ' + G.target + ' to win the match</div>'),
        dismiss: false,
        actions: over
          ? [{label:'🏠 Home', cls:'btn-ghost', fn:() => UI.home()},
             {label:'🔁 New match', cls:'btn-primary', fn:() => restartMatch()}]
          : [{label:'🏠 Quit', cls:'btn-ghost', fn:() => UI.home()},
             {label:'Next round ▶', cls:'btn-primary', fn:() => nextRound(e.pi)}]
      });
    }, 900);
  }
  function nextRound(winnerPi){
    const scores = G.players.map(P => P.score);
    G = LOGIC.unoNew(G.n, {scores, target: G.target, startIdx: winnerPi});
    phase = 'idle';
    if(G.firstEffect === 'skip') Toast.show('First card is a Skip — ' + seats[G.turn].name + ' starts');
    if(G.firstEffect === 'd2') Toast.show('First card is +2 — ' + seats[0].name + ' draws 2');
    renderAll();
    Timers.set(beginTurn, 600);
  }
  function restartMatch(){
    G = LOGIC.unoNew(G.n, {target: G.target});
    phase = 'idle';
    renderAll();
    Timers.set(beginTurn, 500);
  }

  /* ---------- boot ---------- */
  if(G.firstEffect === 'skip') Toast.show('First card is a Skip — ' + seats[G.turn].name + ' starts');
  if(G.firstEffect === 'd2') Toast.show('First card is +2 — ' + seats[0].name + ' draws 2');
  renderAll();
  Timers.set(beginTurn, 700);

  return { destroy(){ dead = true; endUnoWindow(); } };
}
