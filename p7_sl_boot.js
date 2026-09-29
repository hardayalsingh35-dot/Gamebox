'use strict';
/* ================================================================
   SNAKES & LADDERS — UI + flow  (+ app boot)
   ================================================================ */
function SlUI(cfg, root){
  const PC = ['lav','mint','peach','sky'];
  const seats = cfg.seats;
  const level = cfg.level;
  const G = { players: seats.map(s => ({...s, pos: 1, done: false})), turn: 0, over: false };
  let dead = false;
  let phase = 'idle';
  const el = {};

  root.innerHTML =
    '<div class="screen sl">' + UI.topbar('Snakes & Ladders', {restart:true}) +
    '<div class="sl-wrap">' +
    '<div class="pl-row" id="s-chips"></div>' +
    '<div class="slboard" id="s-board"></div>' +
    '<div class="lbottom">' +
      '<div class="lb-info"><div class="lb-name" id="s-name"></div><div class="lb-hint" id="s-hint"></div></div>' +
      '<div class="dice dim" id="s-dice">' + diceHTML(6) + '</div>' +
    '</div></div></div>';
  UI.bindTopbar(root, 'sl');
  el.chips = $('#s-chips'); el.board = $('#s-board'); el.dice = $('#s-dice');
  el.name = $('#s-name'); el.hint = $('#s-hint');

  /* ---------- board ---------- */
  function center(n){ const c = LOGIC.slCell(n); return {x: c.x + 0.5, y: c.y + 0.5}; }
  function boardHTML(){
    let cells = '';
    for(let n = 1; n <= 100; n++){
      const c = LOGIC.slCell(n);
      const alt = (c.x + c.y) % 2 === 0;
      let cls = 'slcell' + (alt ? ' alt' : '');
      if(LOGIC.SL.ladders[n]) cls += ' lad';
      if(LOGIC.SL.snakes[n]) cls += ' snk';
      cells += '<div class="' + cls + '" style="left:' + (c.x * 10) + '%;top:' + (c.y * 10) + '%;width:10%;height:10%;position:absolute"><span class="n">' + n + '</span></div>';
    }
    // svg overlay: ladders + snakes
    let svg = '<svg class="slsvg" viewBox="0 0 100 100" preserveAspectRatio="none">';
    const sc = p => ({x: p.x * 10, y: p.y * 10});
    for(const a in LOGIC.SL.ladders){
      const A = sc(center(+a)), B = sc(center(LOGIC.SL.ladders[a]));
      const dx = B.x - A.x, dy = B.y - A.y, len = Math.hypot(dx, dy);
      const px = -dy / len * 1.7, py = dx / len * 1.7;
      svg += '<line x1="' + (A.x + px) + '" y1="' + (A.y + py) + '" x2="' + (B.x + px) + '" y2="' + (B.y + py) + '" stroke="#ffd98e" stroke-width="1.1" stroke-linecap="round" opacity=".9"/>';
      svg += '<line x1="' + (A.x - px) + '" y1="' + (A.y - py) + '" x2="' + (B.x - px) + '" y2="' + (B.y - py) + '" stroke="#ffd98e" stroke-width="1.1" stroke-linecap="round" opacity=".9"/>';
      const rungs = Math.max(2, Math.round(len / 5));
      for(let i = 1; i < rungs; i++){
        const t = i / rungs;
        const mx = A.x + dx * t, my = A.y + dy * t;
        svg += '<line x1="' + (mx + px) + '" y1="' + (my + py) + '" x2="' + (mx - px) + '" y2="' + (my - py) + '" stroke="#ffe7b8" stroke-width="0.8" stroke-linecap="round" opacity=".85"/>';
      }
    }
    const snakeCols = ['#ff9fb4','#9cc8ff','#b9a7ff','#8fe8c8','#ffc59e','#ffd98e','#ff8f9d','#7fdcb0','#7fb8ff','#c9b6ff'];
    let si = 0;
    for(const h in LOGIC.SL.snakes){
      const H = sc(center(+h)), T = sc(center(LOGIC.SL.snakes[h]));
      const col = snakeCols[si++ % snakeCols.length];
      const dx = T.x - H.x, dy = T.y - H.y, len = Math.hypot(dx, dy);
      const px = -dy / len, py = dx / len;
      const c1 = {x: H.x + dx * 0.3 + px * 9, y: H.y + dy * 0.3 + py * 9};
      const c2 = {x: H.x + dx * 0.7 - px * 9, y: H.y + dy * 0.7 - py * 9};
      svg += '<path d="M ' + H.x + ' ' + H.y + ' C ' + c1.x + ' ' + c1.y + ', ' + c2.x + ' ' + c2.y + ', ' + T.x + ' ' + T.y + '" fill="none" stroke="' + col + '" stroke-width="1.9" stroke-linecap="round" opacity=".8"/>';
      svg += '<circle cx="' + H.x + '" cy="' + H.y + '" r="2.1" fill="' + col + '" opacity=".95"/>';
      svg += '<circle cx="' + (H.x - 0.7) + '" cy="' + (H.y - 0.6) + '" r="0.45" fill="#1a1f3a"/><circle cx="' + (H.x + 0.7) + '" cy="' + (H.y - 0.6) + '" r="0.45" fill="#1a1f3a"/>';
    }
    svg += '</svg>';
    return cells + svg;
  }
  el.board.innerHTML = boardHTML();

  /* pieces */
  const pieces = [];
  G.players.forEach((P, pi) => {
    const d = document.createElement('div');
    d.className = 'spiece c-' + PC[pi];
    d.textContent = P.name.slice(0, 1).toUpperCase();
    el.board.appendChild(d);
    pieces.push(d);
  });
  function layoutPieces(){
    const groups = {};
    G.players.forEach((P, pi) => {
      const c = center(P.pos);
      (groups[P.pos] = groups[P.pos] || []).push({el: pieces[pi], c, pi});
    });
    for(const k in groups){
      const g = groups[k];
      g.forEach((it, i) => {
        const off = g.length === 1 ? {x: 0, y: 0} :
          {x: Math.cos(i / g.length * Math.PI * 2) * 1.9, y: Math.sin(i / g.length * Math.PI * 2) * 1.9};
        it.el.style.left = ((it.c.x * 10) + off.x) + '%';
        it.el.style.top = ((it.c.y * 10) + off.y) + '%';
      });
    }
  }
  layoutPieces();

  /* ---------- panel ---------- */
  function renderChips(){
    el.chips.innerHTML = G.players.map((P, pi) =>
      '<div class="pl-chip' + (G.turn === pi && !G.over && !P.done ? ' active' : '') + (P.done ? ' done' : '') + '">' +
      '<div class="av av-' + PC[pi] + '">' + esc(P.name.slice(0,1).toUpperCase()) + (P.bot ? '<span style="position:absolute;bottom:-4px;right:-4px;font-size:12px">🤖</span>' : '') + '</div>' +
      '<div class="p-name">' + esc(P.name) + '</div>' +
      '<div class="p-sub">' + (P.done ? '🏅 finished' : 'sq ' + P.pos) + '</div></div>').join('');
  }
  function renderPanel(msg){
    const P = G.players[G.turn];
    el.name.innerHTML = '<span class="ndot" style="background:var(--' + (PC[G.turn] === 'lav' ? 'lav' : PC[G.turn]) + ')"></span>' + esc(P.name) + (P.bot ? ' 🤖' : '');
    el.hint.textContent = msg || '';
    el.dice.classList.toggle('dim', !(phase === 'roll' && !P.bot && !P.done));
  }

  /* ---------- flow ---------- */
  function toRoll(){
    if(dead || G.over) return;
    const P = G.players[G.turn];
    if(P.done){ endTurn(); return; }
    phase = 'roll';
    renderChips(); renderPanel(P.bot ? 'rolling…' : 'Your turn — tap the dice! 🎲');
    if(P.bot) Timers.set(() => { if(!dead) doRoll(); }, 800 + Math.random() * 600);
  }
  el.dice.addEventListener('click', () => {
    if(dead || phase !== 'roll' || G.players[G.turn].bot) return;
    doRoll();
  });
  async function doRoll(){
    if(dead) return;
    phase = 'anim';
    const pi = G.turn, P = G.players[pi];
    const v = LOGIC.ludoRollDie();
    renderPanel('rolling…');
    await new Promise(r => rollDiceAnim(el.dice, v, r));
    if(dead) return;
    const {target, bounced} = LOGIC.slNext(P.pos, v);
    // walk step by step
    pieces[pi].style.zIndex = 8;
    let n = P.pos;
    const seq = [];
    if(!bounced){ for(let s = n + 1; s <= target; s++) seq.push(s); }
    else { for(let s = n + 1; s <= 100; s++) seq.push(s); for(let s = 99; s >= target; s--) seq.push(s); }
    for(const s of seq){
      n = s;
      const c = center(s);
      pieces[pi].style.left = (c.x * 10) + '%';
      pieces[pi].style.top = (c.y * 10) + '%';
      Snd.hop();
      await wait(160);
      if(dead) return;
    }
    if(bounced){ Toast.show('🎯 Needs exactly 100 — bounced back to ' + target); Snd.sad(); }
    P.pos = target;
    layoutPieces();
    await wait(250);
    // snake or ladder?
    const jump = LOGIC.slJump(target);
    if(jump){
      pieces[pi].classList.add('glide');
      const c = center(jump.to);
      pieces[pi].style.left = (c.x * 10) + '%';
      pieces[pi].style.top = (c.y * 10) + '%';
      if(jump.kind === 'ladder'){ Snd.ladder(); Toast.show('🪜 Ladder! ' + target + ' → ' + jump.to); }
      else { Snd.snake(); Toast.show('🐍 Snake… ' + target + ' → ' + jump.to); }
      buzz(30);
      await wait(700);
      if(dead) return;
      pieces[pi].classList.remove('glide');
      P.pos = jump.to;
      layoutPieces();
      renderChips();
      await wait(250);
    }
    pieces[pi].style.zIndex = 5;
    // win?
    if(P.pos === 100){
      P.done = true;
      G.over = true;
      renderChips();
      Snd.win(); Confetti.burst(130); buzz([50,60,90]);
      Timers.set(() => {
        if(dead) return;
        Modal.open({
          title: '🏆 Winner!',
          html: '<div class="win-emoji">🎉</div><div class="win-name">' + esc(P.name) + '</div>' +
            '<div class="win-sub">reached square 100 first!</div>' +
            '<div class="podium">' + G.players.map((Q, i) =>
              '<div class="pod-row"><span class="medal">' + (Q.done ? '🥇' : '🏁') + '</span><span class="pn">' + esc(Q.name) + '</span><span class="pd">square ' + Q.pos + '</span></div>').join('') + '</div>',
          dismiss: false,
          actions: [
            {label:'🏠 Home', cls:'btn-ghost', fn:() => UI.home()},
            {label:'🔁 Rematch', cls:'btn-primary', fn:() => UI.gameStart('sl', UI.lastCfg)}
          ]
        });
      }, 900);
      return;
    }
    if(v === 6){
      Toast.show('6️⃣ Bonus roll for ' + P.name + '!');
      renderPanel('Bonus roll! 🎲');
      await wait(550);
      if(!dead) doRoll();
      return;
    }
    endTurn();
  }
  function endTurn(){
    if(dead || G.over) return;
    let guard = 0;
    do { G.turn = adv(G.turn, 1, G.players.length); } while(G.players[G.turn].done && ++guard < 8);
    toRoll();
  }
  renderChips();
  toRoll();
  return { destroy(){ dead = true; } };
}

/* ================================================================
   boot
   ================================================================ */
window.addEventListener('error', e => {
  // keep the app usable; surface unexpected errors gently in dev
  if(window.__qbErrors) window.__qbErrors.push(String(e.message));
});
window.__qbErrors = [];
UI.home();
// tell the Android shell (if any) that the page booted fine
try{ if(window.AndroidBridge && AndroidBridge.ready) AndroidBridge.ready(); }catch(e){}
