'use strict';
/* ================================================================
   GameBox — pure game logic (no DOM). Everything here is testable
   in Node: rules engines, board geometry, and bot brains.
   ================================================================ */
const LOGIC = {};
const L_rnd  = n => Math.floor(Math.random() * n);
const L_pick = a => a[L_rnd(a.length)];
const L_adv  = (i, d, n) => ((i + d) % n + n) % n;
function L_shuffle(a){ for(let i = a.length - 1; i > 0; i--){ const j = L_rnd(i + 1); const t = a[i]; a[i] = a[j]; a[j] = t; } return a; }

/* ==================== UNO ==================== */
LOGIC.unoDeck = function(){
  const d = [], colors = ['r','y','g','b'];
  for(const c of colors){
    d.push({c, v:'0'});
    for(let n = 1; n <= 9; n++){ d.push({c, v:String(n)}); d.push({c, v:String(n)}); }
    for(const v of ['S','R','D2']){ d.push({c, v}); d.push({c, v}); }
  }
  for(let i = 0; i < 4; i++){ d.push({c:'w', v:'W'}); d.push({c:'w', v:'W4'}); }
  return d; // 108 cards
};
LOGIC.unoCardPoints = c => c.c === 'w' ? 50 : (isNaN(parseInt(c.v, 10)) ? 20 : parseInt(c.v, 10));
LOGIC.unoGlyph = c => ({S:'\u22F8', R:'\u21C4', D2:'+2', W:'\u2605', W4:'+4'}[c.v] || c.v);
LOGIC.unoCanPlay = function(card, activeColor, topV, hand){
  if(card.v === 'W') return true;
  if(card.v === 'W4') return !hand.some(h => h.c === activeColor); // official: only if you hold nothing in the active color
  return card.c === activeColor || card.v === topV;
};
function unoDraw(G, pi, n){
  const out = [];
  for(let i = 0; i < n; i++){
    if(!G.deck.length){
      const top = G.discard.pop();
      G.deck = L_shuffle(G.discard);
      G.discard = [top];
      G.reshuffled = true;
      if(!G.deck.length) break;
    }
    out.push(G.deck.pop());
  }
  G.players[pi].hand.push(...out);
  G.players[pi].uno = false;
  return out;
}
LOGIC.unoNew = function(n, opts = {}){
  const G = {
    n, target: opts.target != null ? opts.target : 200,
    players: Array.from({length: n}, (_, i) => ({ hand: [], score: opts.scores ? opts.scores[i] : 0, uno: false })),
    deck: L_shuffle(LOGIC.unoDeck()), discard: [], activeColor: null, dir: 1,
    turn: opts.startIdx != null ? opts.startIdx : 0, reshuffled: false
  };
  for(let k = 0; k < 7; k++) for(const P of G.players) P.hand.push(G.deck.pop());
  // flip first card (official first-card rules)
  let guard = 0;
  while(guard++ < 99){
    const c = G.deck.pop();
    if(c.c === 'w'){ G.deck.splice(L_rnd(G.deck.length), 0, c); continue; } // wild goes back, flip another
    G.discard.push(c); G.activeColor = c.c;
    if(c.v === 'S'){ G.turn = L_adv(0, 1, n); G.firstEffect = 'skip'; }
    else if(c.v === 'R'){
      if(n === 2){ G.turn = L_adv(0, 1, n); G.firstEffect = 'skip'; }
      else { G.dir = -1; G.firstEffect = 'reverse'; }
    }
    else if(c.v === 'D2'){ unoDraw(G, 0, 2); G.turn = L_adv(0, 1, n); G.firstEffect = 'd2'; }
    break;
  }
  return G;
};
LOGIC.unoTop = G => G.discard[G.discard.length - 1];
LOGIC.unoPlayableIdx = function(G, pi){
  const P = G.players[pi], top = LOGIC.unoTop(G);
  const idxs = [];
  for(let i = 0; i < P.hand.length; i++){
    if(LOGIC.unoCanPlay(P.hand[i], G.activeColor, top.v, P.hand)) idxs.push(i);
  }
  return idxs;
};
LOGIC.unoPlay = function(G, pi, idx, chosenColor){
  const P = G.players[pi], ev = [];
  const card = P.hand.splice(idx, 1)[0];
  G.discard.push(card);
  G.activeColor = card.c === 'w' ? (chosenColor || 'r') : card.c;
  ev.push({t:'play', pi, card});
  if(card.c === 'w') ev.push({t:'color', pi, c:G.activeColor});
  if(P.hand.length === 0){ // round over
    let gained = 0;
    G.players.forEach((Q, qi) => { if(qi !== pi) Q.hand.forEach(c => { gained += LOGIC.unoCardPoints(c); }); });
    P.score += gained;
    G.matchOver = P.score >= G.target;
    G.roundWinner = pi;
    ev.push({t:'round', pi, gained, scores: G.players.map(Q => Q.score), over: G.matchOver});
    return ev;
  }
  const nxt = L_adv(pi, G.dir, G.n);
  if(card.v === 'S'){ ev.push({t:'skip', pi:nxt}); G.turn = L_adv(nxt, G.dir, G.n); }
  else if(card.v === 'R'){
    if(G.n === 2){ ev.push({t:'skip', pi:nxt, two:true}); G.turn = L_adv(nxt, G.dir, G.n); }
    else { G.dir *= -1; ev.push({t:'reverse'}); G.turn = L_adv(pi, G.dir, G.n); }
  }
  else if(card.v === 'D2'){ const got = unoDraw(G, nxt, 2); ev.push({t:'draw', pi:nxt, n:got.length, forced:true}); ev.push({t:'skip', pi:nxt}); G.turn = L_adv(nxt, G.dir, G.n); }
  else if(card.v === 'W4'){ const got = unoDraw(G, nxt, 4); ev.push({t:'draw', pi:nxt, n:got.length, forced:true}); ev.push({t:'skip', pi:nxt}); G.turn = L_adv(nxt, G.dir, G.n); }
  else { G.turn = nxt; }
  return ev;
};
LOGIC.unoDrawTurn = function(G, pi){ // player chooses to draw 1
  const got = unoDraw(G, pi, 1);
  const ev = [{t:'draw', pi, n:got.length}];
  if(!got.length){ G.turn = L_adv(pi, G.dir, G.n); ev.push({t:'pass', pi}); return {ev, playable:false}; }
  const card = got[0], top = LOGIC.unoTop(G);
  const playable = LOGIC.unoCanPlay(card, G.activeColor, top.v, G.players[pi].hand);
  if(!playable){ G.turn = L_adv(pi, G.dir, G.n); ev.push({t:'pass', pi}); }
  return {ev, playable, card};
};
LOGIC.unoKeepDrawn = (G, pi) => { G.turn = L_adv(pi, G.dir, G.n); };
LOGIC.unoCall = (G, pi) => { G.players[pi].uno = true; };
LOGIC.unoCatch = function(G, pi){ // penalty if pi has 1 card and never called UNO
  const P = G.players[pi];
  if(P.hand.length === 1 && !P.uno){ return unoDraw(G, pi, 2).length; }
  return 0;
};
LOGIC.unoBotAction = function(G, pi, level){
  const P = G.players[pi], top = LOGIC.unoTop(G);
  const idxs = LOGIC.unoPlayableIdx(G, pi);
  if(!idxs.length) return null;
  if(level === 'chill' && Math.random() < 0.45) return {idx: L_pick(idxs), color: wildColorFor(P)};
  const nxt = G.players[L_adv(pi, G.dir, G.n)];
  const nxtLow = nxt.hand.length <= 2;
  const colorCount = {};
  P.hand.forEach(c => { if(c.c !== 'w') colorCount[c.c] = (colorCount[c.c] || 0) + 1; });
  let best = idxs[0], bestS = -1e9;
  for(const i of idxs){
    const c = P.hand[i];
    let s = L_rnd(4);
    if(c.v === 'W4')      s += nxtLow ? 70 : -10;
    else if(c.v === 'W')  s += nxtLow ? 40 : -8;
    else if(c.v === 'D2') s += 10 + (nxtLow ? 55 : 0);
    else if(c.v === 'S')  s += 8 + (nxtLow ? 45 : 0);
    else if(c.v === 'R')  s += 6 + (nxtLow ? 40 : 0) + (G.n === 2 && nxtLow ? 12 : 0);
    else                  s += 6 + (parseInt(c.v, 10) || 0) * (level === 'pro' ? 1.2 : 0.6);
    if(c.c !== 'w') s += 3 * ((colorCount[c.c] || 1) - 1);
    if(level === 'chill') s = s * 0.4 + L_rnd(20);
    if(s > bestS){ bestS = s; best = i; }
  }
  return {idx: best, color: wildColorFor(P)};
};
LOGIC.unoWildColor = P => wildColorFor(P);
function wildColorFor(P){
  const colorCount = {};
  P.hand.forEach(c => { if(c.c !== 'w') colorCount[c.c] = (colorCount[c.c] || 0) + 1; });
  let bc = 'r', bn = -1;
  for(const k of ['r','y','g','b']){ const v = colorCount[k] || 0; if(v > bn){ bn = v; bc = k; } }
  return bn === 0 ? L_pick(['r','y','g','b']) : bc;
}

/* ==================== LUDO ==================== */
/* 15x15 board, clockwise travel. Cells are [x,y], x = column, y = row. */
LOGIC.LUDO = (function(){
  const loop = [
    [7,0],[8,0],[8,1],[8,2],[8,3],[8,4],[8,5],
    [9,6],[10,6],[11,6],[12,6],[13,6],[14,6],
    [14,7],
    [14,8],[13,8],[12,8],[11,8],[10,8],[9,8],
    [8,9],[8,10],[8,11],[8,12],[8,13],[8,14],
    [7,14],
    [6,14],[6,13],[6,12],[6,11],[6,10],[6,9],
    [5,8],[4,8],[3,8],[2,8],[1,8],[0,8],
    [0,7],
    [0,6],[1,6],[2,6],[3,6],[4,6],[5,6],
    [6,5],[6,4],[6,3],[6,2],[6,1],[6,0]
  ];
  const def = {
    green:  { start:41, home:[[1,7],[2,7],[3,7],[4,7],[5,7]], base:[[1.5,1.5],[3.5,1.5],[1.5,3.5],[3.5,3.5]] },
    yellow: { start:2,  home:[[7,1],[7,2],[7,3],[7,4],[7,5]],   base:[[10.5,1.5],[12.5,1.5],[10.5,3.5],[12.5,3.5]] },
    blue:   { start:15, home:[[13,7],[12,7],[11,7],[10,7],[9,7]], base:[[10.5,10.5],[12.5,10.5],[10.5,12.5],[12.5,12.5]] },
    red:    { start:28, home:[[7,13],[7,12],[7,11],[7,10],[7,9]], base:[[1.5,10.5],[3.5,10.5],[1.5,12.5],[3.5,12.5]] }
  };
  const starts = {green:41, yellow:2, blue:15, red:28};
  const safeSet = new Set([41, 2, 15, 28, 49, 10, 23, 36]); // 4 starts + 4 stars
  return { loop, def, starts, safeSet, colors:['green','yellow','blue','red'] };
})();
LOGIC.ludoRollDie = () => 1 + Math.floor(Math.random() * 6);
LOGIC.ludoNew = seats => ({
  players: seats.map(s => ({ name:s.name, bot:s.bot, color:s.color, start:LOGIC.LUDO.starts[s.color], tokens:[-1,-1,-1,-1], finished:false, rank:0 })),
  turn:0, over:false, ranks:[]
});
LOGIC.ludoLegal = function(P, r){
  const mv = [];
  for(let i = 0; i < 4; i++){
    const t = P.tokens[i];
    if(t === 56) continue;               // already home
    if(t < 0){ if(r === 6) mv.push({i, from:-1, to:0}); continue; }
    let to = t + r;
    if(to > 56) to = 112 - to;           // bounce back inside home column
    mv.push({i, from:t, to});
  }
  return mv;
};
LOGIC.ludoStepCenter = function(P, step){ // -> {x,y} in board units (0..15), or {home:true}
  if(step < 0 || step > 56) return null;
  if(step <= 50){ const c = LOGIC.LUDO.loop[(P.start + step) % 52]; return {x:c[0] + 0.5, y:c[1] + 0.5}; }
  if(step <= 55){ const c = LOGIC.LUDO.def[P.color].home[step - 51]; return {x:c[0] + 0.5, y:c[1] + 0.5}; }
  return {home:true};
};
LOGIC.ludoCaptures = function(G, P, mv){
  if(mv.to > 50) return [];
  const g = (P.start + mv.to) % 52;
  if(LOGIC.LUDO.safeSet.has(g)) return [];
  const victims = [];
  for(const E of G.players){
    if(E === P || E.finished) continue;
    for(let j = 0; j < 4; j++){
      const st = E.tokens[j];
      if(st >= 0 && st <= 50 && (E.start + st) % 52 === g) victims.push({E, j});
    }
  }
  return victims;
};
LOGIC.ludoApply = function(G, pi, mv){
  const P = G.players[pi];
  P.tokens[mv.i] = mv.to;
  const victims = LOGIC.ludoCaptures(G, P, mv);
  for(const v of victims) v.E.tokens[v.j] = -1;
  const home = mv.to === 56;
  let finished = false;
  if(home && P.tokens.every(t => t === 56)){
    P.finished = true; P.rank = G.ranks.length + 1; G.ranks.push(pi); finished = true;
  }
  return {victims, home, finished};
};
LOGIC.ludoThreat = function(G, pi, step){ // could a token of pi sitting on this step be captured?
  if(step == null || step < 0 || step > 50) return false;
  const P = G.players[pi], g = (P.start + step) % 52;
  if(LOGIC.LUDO.safeSet.has(g)) return false;
  for(const E of G.players){
    if(E === P || E.finished) continue;
    for(const st of E.tokens){
      if(st < 0 || st > 50) continue;
      const d = (g - (E.start + st) % 52 + 52) % 52;
      if(d >= 1 && d <= 6 && st + d <= 50) return true;
    }
  }
  return false;
};
LOGIC.ludoBot = function(G, pi, roll, level){
  const P = G.players[pi];
  const moves = LOGIC.ludoLegal(P, roll);
  if(!moves.length) return null;
  let best = null, bs = -1e9;
  for(const mv of moves){
    const caps = LOGIC.ludoCaptures(G, P, mv);
    let s = Math.random() * 4;
    if(mv.from === -1) s += 40;
    if(caps.length) s += 115 + caps.length * 15;
    if(mv.to === 56) s += 90;
    if(mv.from >= 0 && mv.from <= 50 && LOGIC.ludoThreat(G, pi, mv.from)) s += 36;
    if(mv.to <= 50){
      if(LOGIC.ludoThreat(G, pi, mv.to)) s -= (level === 'pro' ? 55 : 25);
      else if(LOGIC.LUDO.safeSet.has((P.start + mv.to) % 52)) s += 22;
    }
    if(mv.to > 50) s += 16;
    s += mv.to * (level === 'pro' ? 0.7 : 0.35);
    if(level === 'chill') s = caps.length ? 60 : Math.random() * 50;
    if(s > bs){ bs = s; best = mv; }
  }
  return best;
};

/* ==================== TIC TAC TOE ==================== */
LOGIC.tttWinner = function(b){
  const L = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
  for(const l of L){ if(b[l[0]] && b[l[0]] === b[l[1]] && b[l[0]] === b[l[2]]) return {w:b[l[0]], line:l}; }
  return b.every(v => v) ? {w:0, line:null} : null;
};
function tttMin(b, cur, me, d){
  const r = LOGIC.tttWinner(b);
  if(r){ if(r.w === 0) return 0; return r.w === me ? 10 - d : d - 10; }
  let best = cur === me ? -1e9 : 1e9;
  for(let i = 0; i < 9; i++){
    if(b[i]) continue;
    b[i] = cur;
    const s = tttMin(b, 3 - cur, me, d + 1);
    b[i] = 0;
    best = cur === me ? Math.max(best, s) : Math.min(best, s);
  }
  return best;
}
LOGIC.tttBot = function(b, me, level){
  const empt = [];
  for(let i = 0; i < 9; i++) if(!b[i]) empt.push(i);
  if(!empt.length) return -1;
  if(level === 'chill' && Math.random() < 0.55) return L_pick(empt);
  const winNow = p => {
    for(const i of empt){ b[i] = p; const r = LOGIC.tttWinner(b); b[i] = 0; if(r && r.w === p) return i; }
    return -1;
  };
  let i = winNow(me); if(i >= 0) return i;
  i = winNow(3 - me); if(i >= 0) return i;
  if(level === 'pro'){
    let best = empt[0], bs = -1e9;
    for(const j of empt){
      b[j] = me;
      const s = tttMin(b, 3 - me, me, 1);
      b[j] = 0;
      if(s > bs){ bs = s; best = j; }
    }
    return best;
  }
  if(!b[4]) return 4;
  const cor = [0,2,6,8].filter(j => !b[j]);
  if(cor.length) return L_pick(cor);
  return L_pick(empt);
};

/* ==================== CONNECT FOUR ==================== */
LOGIC.c4New = () => new Array(42).fill(0);
LOGIC.c4Drop = function(g, col){
  for(let r = 5; r >= 0; r--) if(!g[r * 7 + col]) return r;
  return -1;
};
LOGIC.c4Winner = function(g){
  const dirs = [[1,0],[0,1],[1,1],[1,-1]];
  for(let r = 0; r < 6; r++) for(let c = 0; c < 7; c++){
    const p = g[r * 7 + c];
    if(!p) continue;
    for(const d of dirs){
      const cells = [];
      for(let k = 0; k < 4; k++){
        const rr = r + d[1] * k, cc = c + d[0] * k;
        if(rr < 0 || rr > 5 || cc < 0 || cc > 6 || g[rr * 7 + cc] !== p){ cells.length = 0; break; }
        cells.push(rr * 7 + cc);
      }
      if(cells.length === 4) return {w:p, cells};
    }
  }
  return g.every(v => v) ? {w:0, cells:null} : null;
};
let C4W = null;
function c4Windows(){
  if(C4W) return C4W;
  C4W = [];
  for(let r = 0; r < 6; r++) for(let c = 0; c < 7; c++){
    if(c + 3 < 7) C4W.push([r*7+c, r*7+c+1, r*7+c+2, r*7+c+3]);
    if(r + 3 < 6) C4W.push([r*7+c, (r+1)*7+c, (r+2)*7+c, (r+3)*7+c]);
    if(c + 3 < 7 && r + 3 < 6) C4W.push([r*7+c, (r+1)*7+c+1, (r+2)*7+c+2, (r+3)*7+c+3]);
    if(c - 3 >= 0 && r + 3 < 6) C4W.push([r*7+c, (r+1)*7+c-1, (r+2)*7+c-2, (r+3)*7+c-3]);
  }
  return C4W;
}
function c4Eval(g, me){
  let s = 0; const opp = 3 - me;
  for(const w of c4Windows()){
    let cm = 0, co = 0;
    for(const i of w){ const v = g[i]; if(v === me) cm++; else if(v === opp) co++; }
    if(cm && co) continue;
    if(cm) s += [0, 2, 14, 90][cm] || 0;
    else if(co) s -= [0, 3, 16, 110][co] || 0;
  }
  for(let r = 0; r < 6; r++){ if(g[r*7+3] === me) s += 4; else if(g[r*7+3] === opp) s -= 4; }
  return s;
}
function c4MM(g, cur, depth, alpha, beta){
  const w = LOGIC.c4Winner(g);
  if(w) return w.w === 0 ? 0 : -(100000 + depth * 100);
  if(depth === 0) return c4Eval(g, cur);
  const valid = [3,2,4,1,5,0,6].filter(c => LOGIC.c4Drop(g, c) >= 0);
  let best = -1e9;
  for(const c of valid){
    const r = LOGIC.c4Drop(g, c);
    g[r * 7 + c] = cur;
    const s = -c4MM(g, 3 - cur, depth - 1, -beta, -alpha);
    g[r * 7 + c] = 0;
    if(s > best) best = s;
    if(best > alpha) alpha = best;
    if(alpha >= beta) break;
  }
  return best;
}
LOGIC.c4Bot = function(g, me, level){
  const valid = [3,2,4,1,5,0,6].filter(c => LOGIC.c4Drop(g, c) >= 0);
  if(!valid.length) return -1;
  if(level === 'chill' && Math.random() < 0.4) return L_pick(valid);
  for(const c of valid){ const r = LOGIC.c4Drop(g,c); g[r*7+c] = me;  const w = LOGIC.c4Winner(g); g[r*7+c] = 0; if(w && w.w === me)  return c; }
  for(const c of valid){ const r = LOGIC.c4Drop(g,c); g[r*7+c] = 3-me; const w = LOGIC.c4Winner(g); g[r*7+c] = 0; if(w && w.w === 3-me) return c; }
  const depth = {chill:1, sharp:4, pro:6}[level] || 4;
  let bs = -1e9, bc = valid[0];
  for(const c of valid){
    const r = LOGIC.c4Drop(g, c);
    g[r * 7 + c] = me;
    const s = -c4MM(g, 3 - me, depth - 1, -1e9, 1e9);
    g[r * 7 + c] = 0;
    if(s > bs){ bs = s; bc = c; }
  }
  return bc;
};

/* ==================== SNAKES & LADDERS ==================== */
LOGIC.SL = {
  ladders: {1:38, 4:14, 9:31, 21:42, 28:84, 36:44, 51:67, 71:91, 80:100},
  snakes:  {16:6, 47:26, 49:11, 56:53, 62:19, 64:60, 87:24, 93:73, 95:75, 98:78}
};
LOGIC.slCell = function(n){ // -> {x,y} in 10x10 grid (0,0 = top-left)
  const r = Math.floor((n - 1) / 10), b = (n - 1) % 10;
  const c = r % 2 === 0 ? b : 9 - b;
  return {x:c, y:9 - r};
};
LOGIC.slNext = function(pos, roll){
  let target = pos + roll, bounced = false;
  if(target > 100){ target = 200 - target; bounced = true; } // bounce back from 100
  return {target, bounced};
};
LOGIC.slJump = function(t){
  if(LOGIC.SL.ladders[t]) return {to:LOGIC.SL.ladders[t], kind:'ladder'};
  if(LOGIC.SL.snakes[t])  return {to:LOGIC.SL.snakes[t],  kind:'snake'};
  return null;
};
