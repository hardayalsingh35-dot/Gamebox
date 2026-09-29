'use strict';
/* ================================================================
   LUDO — UI + flow
   ================================================================ */
function LudoUI(cfg, root){
  const L = LOGIC.LUDO;
  const seatColors = {2:['green','blue'], 3:['green','yellow','blue'], 4:['green','yellow','blue','red']};
  const colors = seatColors[cfg.seats.length] || L.colors;
  const seats = cfg.seats.map((s, i) => ({name: s.name, bot: s.bot, color: colors[i]}));
  const G = LOGIC.ludoNew(seats);
  const level = cfg.level;
  const CDOT = {green:'#7fdcb0', yellow:'#ffd47e', blue:'#7fb8ff', red:'#ff8f9d'};
  let dead = false;
  let phase = 'idle';       // roll | anim | choose
  let sixStreak = 0;
  let rolled = 0;
  let pickResolve = null;

  root.innerHTML =
    '<div class="screen ludo">' + UI.topbar('Ludo', {restart:true}) +
    '<div class="ludo-wrap">' +
    '<div class="pl-row" id="l-chips"></div>' +
    '<div class="lboard" id="l-board"></div>' +
    '<div class="lbottom">' +
      '<div class="lb-info"><div class="lb-name" id="l-name"></div><div class="lb-hint" id="l-hint"></div></div>' +
      '<div class="dice dim" id="l-dice">' + diceHTML(6) + '</div>' +
    '</div></div></div>';
  UI.bindTopbar(root, 'ludo');

  const el = { chips: $('#l-chips'), board: $('#l-board'), dice: $('#l-dice'), name: $('#l-name'), hint: $('#l-hint') };

  /* ---------- board construction ---------- */
  function boardHTML(){
    let h = '';
    const baseRect = {green:[0,0], yellow:[9,0], blue:[9,9], red:[0,9]};
    for(const col of L.colors){
      const bx = baseRect[col][0], by = baseRect[col][1];
      const active = seats.some(s => s.color === col);
      let slots = '';
      L.def[col].base.forEach(s => {
        slots += '<div class="lslot" style="left:' + ((s[0] + 0.5 - bx) / 6 * 100) + '%;top:' + ((s[1] + 0.5 - by) / 6 * 100) + '%"></div>';
      });
      h += '<div class="lbase c-' + col + '" style="left:' + (bx / 15 * 100) + '%;top:' + (by / 15 * 100) + '%;' + (active ? '' : 'opacity:.4;') + '">' + slots + '</div>';
    }
    L.loop.forEach((c, idx) => {
      let cls = 'lcell';
      const startCol = Object.keys(L.starts).find(k => L.starts[k] === idx);
      if(startCol) cls += ' start c-' + startCol;
      else if(L.safeSet.has(idx)) cls += ' star';
      h += '<div class="' + cls + '" style="left:' + (c[0] / 15 * 100) + '%;top:' + (c[1] / 15 * 100) + '%"></div>';
    });
    for(const col of L.colors){
      for(const c of L.def[col].home){
        h += '<div class="lcell hcell c-' + col + '" style="left:' + (c[0] / 15 * 100) + '%;top:' + (c[1] / 15 * 100) + '%"></div>';
      }
    }
    h += '<div class="lcenter"><svg viewBox="0 0 100 100">' +
      '<polygon points="0,0 100,0 50,50" fill="#ffd47e" opacity=".72"/>' +
      '<polygon points="100,0 100,100 50,50" fill="#7fb8ff" opacity=".72"/>' +
      '<polygon points="0,100 100,100 50,50" fill="#ff8f9d" opacity=".72"/>' +
      '<polygon points="0,0 0,100 50,50" fill="#7fdcb0" opacity=".72"/>' +
      '<circle cx="50" cy="50" r="11" fill="#eef1ff" opacity=".92"/><text x="50" y="55" font-size="13" text-anchor="middle" fill="#2a3055" font-weight="900">★</text></svg></div>';
    return h;
  }
  function finishedSlot(color, i){
    const a = [6.6, 7.2, 7.8, 8.4][i];
    if(color === 'green')  return {x:6.35, y:a};
    if(color === 'yellow') return {x:a, y:6.35};
    if(color === 'blue')   return {x:8.65, y:a};
    return {x:a, y:8.65}; // red
  }
  function posOf(P, i, step){
    if(step === 56) return finishedSlot(P.color, i);
    if(step < 0){ const s = L.def[P.color].base[i]; return {x:s[0] + 0.5, y:s[1] + 0.5}; }
    const c = LOGIC.ludoStepCenter(P, step);
    return c && !c.home ? c : finishedSlot(P.color, i);
  }
  function setPos(elTok, p){ elTok.style.left = (p.x / 15 * 100) + '%'; elTok.style.top = (p.y / 15 * 100) + '%'; }

  /* build tokens */
  el.board.innerHTML = boardHTML();
  const tokEls = [];
  G.players.forEach((P, pi) => {
    tokEls[pi] = [];
    for(let j = 0; j < 4; j++){
      const t = document.createElement('div');
      t.className = 'ltok c-' + P.color;
      t.id = 'tk_' + pi + '_' + j;
      el.board.appendChild(t);
      tokEls[pi][j] = t;
    }
  });
  function layoutTokens(){
    const groups = {};
    G.players.forEach((P, pi) => {
      for(let j = 0; j < 4; j++){
        const st = P.tokens[j];
        const p = posOf(P, j, st);
        const t = tokEls[pi][j];
        t.classList.toggle('homeward', st === 56);
        t.classList.remove('stack', 'flyhome');
        if(st === 56){ setPos(t, p); continue; }
        const key = Math.round(p.x * 10) + '_' + Math.round(p.y * 10);
        (groups[key] = groups[key] || []).push({t, p});
      }
    });
    for(const key in groups){
      const g = groups[key];
      if(g.length === 1){ setPos(g[0].t, g[0].p); continue; }
      g.forEach((it, k) => {
        const ang = (k / g.length) * Math.PI * 2 - Math.PI / 2;
        it.t.classList.add('stack');
        setPos(it.t, {x: it.p.x + Math.cos(ang) * 0.24, y: it.p.y + Math.sin(ang) * 0.24});
      });
    }
  }
  layoutTokens();

  /* ---------- chips / panel ---------- */
  function renderChips(){
    el.chips.innerHTML = G.players.map((P, pi) => {
      const home = P.tokens.filter(t => t === 56).length;
      const isTurn = G.turn === pi && !G.over;
      return '<div class="pl-chip' + (isTurn ? ' active' : '') + (P.finished ? ' done' : '') + '" data-chip="' + pi + '">' +
        '<div class="av av-' + P.color + '">' + esc(P.name.slice(0,1).toUpperCase()) + (P.bot ? '<span style="position:absolute;bottom:-4px;right:-4px;font-size:12px">🤖</span>' : '') + '</div>' +
        '<div class="p-name">' + esc(P.name) + '</div>' +
        '<div class="p-sub">' + (P.finished ? '🏅 #' + P.rank : '🏠 ' + home + '/4') + '</div></div>';
    }).join('');
  }
  function renderPanel(msg){
    const P = G.players[G.turn];
    el.name.innerHTML = '<span class="ndot" style="background:' + CDOT[P.color] + '"></span>' + esc(P.name) + (P.bot ? ' 🤖' : '');
    el.hint.textContent = msg || '';
    el.dice.classList.toggle('dim', !(phase === 'roll' && !P.bot));
  }

  /* ---------- flow ---------- */
  function toRoll(){
    if(dead || G.over) return;
    phase = 'roll';
    renderChips(); renderPanel('');
    const P = G.players[G.turn];
    if(P.bot){
      renderPanel('thinking…');
      Timers.set(() => { if(!dead) doRoll(); }, 750 + Math.random() * 650);
    } else {
      renderPanel('Your turn — tap the dice! 🎲');
    }
  }
  el.dice.addEventListener('click', () => {
    if(dead || phase !== 'roll' || G.players[G.turn].bot) return;
    doRoll();
  });
  async function doRoll(){
    if(dead) return;
    phase = 'anim';
    const pi = G.turn, P = G.players[pi];
    renderPanel('rolling…');
    rolled = LOGIC.ludoRollDie();
    await new Promise(r => rollDiceAnim(el.dice, rolled, r));
    if(dead) return;
    if(rolled === 6){
      sixStreak++;
      if(sixStreak === 3){
        Toast.show('😬 Three 6s in a row — turn lost!');
        Snd.sad();
        sixStreak = 0;
        await wait(600); if(!dead) endTurn();
        return;
      }
    }
    const moves = LOGIC.ludoLegal(P, rolled);
    if(!moves.length){
      Toast.show(P.name + ' — no possible move');
      renderPanel('no move 😕');
      await wait(750); if(!dead) endTurn();
      return;
    }
    let mv;
    if(P.bot){
      renderPanel('choosing…');
      await wait(500 + Math.random() * 400);
      if(dead) return;
      mv = LOGIC.ludoBot(G, pi, rolled, level);
      await applyAndAnimate(pi, mv ? mv.i : null);
      return;
    } else {
      phase = 'choose';
      renderPanel(rolled === 6 ? 'A 6! Tap a glowing token' : 'Tap a glowing token to move ' + rolled);
      moves.forEach(m => { const t = tokEls[pi][m.i]; t.classList.add('canmove'); });
      const j = await new Promise(r => { pickResolve = r; });
      if(dead) return;
      moves.forEach(m => tokEls[pi][m.i].classList.remove('canmove'));
      await applyAndAnimate(pi, j);
    }
  }
  // token tap -> resolve the human's pick
  G.players.forEach((P, pi) => {
    for(let j = 0; j < 4; j++){
      tokEls[pi][j].addEventListener('click', function(){
        if(!pickResolve || !this.classList.contains('canmove') || pi !== G.turn) return;
        Snd.click(); buzz(10);
        const r = pickResolve; pickResolve = null;
        r(j);
      });
    }
  });
  async function applyAndAnimate(pi, j){
    if(dead) return;
    if(j == null){ endTurn(); return; }
    phase = 'anim';
    const P = G.players[pi];
    const mv = LOGIC.ludoLegal(P, rolled).find(m => m.i === j);
    if(!mv){ endTurn(); return; }
    renderPanel('moving…');
    // walk animation
    const tok = tokEls[pi][mv.i];
    let path = [];
    if(mv.from === -1) path = [0];
    else if(mv.from + rolled > 56){
      for(let s = mv.from + 1; s <= 56; s++) path.push(s);
      for(let s = 55; s >= mv.to; s--) path.push(s);
    } else {
      for(let s = mv.from + 1; s <= mv.to; s++) path.push(s);
    }
    tok.style.zIndex = 9;
    tok.classList.remove('stack');
    for(const st of path){
      setPos(tok, posOf(P, mv.i, st));
      Snd.hop();
      await wait(140);
      if(dead) return;
    }
    const res = LOGIC.ludoApply(G, pi, mv);
    // captures
    if(res.victims.length){
      Snd.capture(); buzz(45);
      for(const v of res.victims){
        const vt = tokEls[G.players.indexOf(v.E)][v.j];
        vt.classList.add('flyhome');
        setPos(vt, posOf(v.E, v.j, -1));
        Timers.set(() => vt.classList.remove('flyhome'), 600);
      }
      Toast.show('💥 ' + P.name + ' captured ' + res.victims[0].E.name + '!');
      await wait(650); if(dead) return;
    }
    if(res.home){
      Snd.home(); buzz(30);
      layoutTokens();
      Toast.show('🏠 ' + P.name + ' got a token home!');
      await wait(500); if(dead) return;
    } else layoutTokens();
    tok.style.zIndex = 5;
    if(res.finished){
      Snd.win(); Confetti.burst(90);
      Toast.show('🏅 ' + P.name + ' brought all tokens home!');
      renderChips();
      const unfinished = G.players.filter(p => !p.finished);
      if(unfinished.length <= 1){
        if(unfinished.length === 1){ unfinished[0].rank = G.ranks.length + 1; G.ranks.push(G.players.indexOf(unfinished[0])); }
        G.over = true;
        gameOverModal();
        return;
      }
      await wait(700); if(dead) return;
    }
    const extra = (rolled === 6) || res.victims.length > 0 || res.home;
    if(extra && !P.finished){
      renderPanel(rolled === 6 ? 'Bonus roll! 🎲' : 'Bonus roll! 🎁');
      await wait(500); if(!dead) doRoll();
    } else {
      sixStreak = 0;
      endTurn();
    }
  }
  function endTurn(){
    if(dead || G.over) return;
    do { G.turn = adv(G.turn, 1, G.players.length); } while(G.players[G.turn].finished);
    toRoll();
  }
  function gameOverModal(){
    renderChips(); renderPanel('game over');
    const ranks = G.ranks.map((pi, r) => ({pi, r}));
    Snd.win(); buzz([50,60,90]);
    Modal.open({
      title: '🏆 Game over!',
      html: '<div class="win-emoji">👑</div><div class="win-name">' + esc(G.players[G.ranks[0]].name) + ' wins!</div>' +
        '<div class="podium">' + ranks.map(rr =>
          '<div class="pod-row"><span class="medal">' + ['🥇','🥈','🥉','4️⃣'][rr.r - 1] + '</span><span class="pn">' + esc(G.players[rr.pi].name) + '</span><span class="pd">' + esc(G.players[rr.pi].color) + '</span></div>').join('') + '</div>',
      dismiss: false,
      actions: [
        {label:'🏠 Home', cls:'btn-ghost', fn:() => UI.home()},
        {label:'🔁 Rematch', cls:'btn-primary', fn:() => UI.gameStart('ludo', UI.lastCfg)}
      ]
    });
  }
  renderChips();
  toRoll();
  return { destroy(){ dead = true; if(pickResolve){ const r = pickResolve; pickResolve = null; r(null); } } };
}
