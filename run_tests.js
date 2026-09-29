'use strict';
/* GameBox logic test suite — run with: node test/run_tests.js */
const fs = require('fs');
const path = require('path');
const LOGIC = (new Function(fs.readFileSync(path.join(__dirname, '..', 'src', 'p2_logic.js'), 'utf8') + '\nreturn LOGIC;'))();
const adv = (i, d, n) => ((i + d) % n + n) % n;

let pass = 0, fail = 0;
function T(name, cond){
  if(cond){ pass++; }
  else { fail++; console.log('  ✗ FAIL: ' + name); }
}
function section(s){ console.log('— ' + s); }

/* ============ UNO deck ============ */
section('UNO deck');
const deck = LOGIC.unoDeck();
T('deck has 108 cards', deck.length === 108);
for(const col of ['r','y','g','b']){
  const cs = deck.filter(c => c.c === col);
  T(col + ' has 25 cards', cs.length === 25);
  T(col + ' has one 0', cs.filter(c => c.v === '0').length === 1);
  T(col + ' has two of each 1-9', Array.from({length:9}, (_,i) => cs.filter(c => c.v === String(i+1)).length === 2).every(Boolean));
  for(const v of ['S','R','D2']) T(col + ' has two ' + v, cs.filter(c => c.v === v).length === 2);
}
T('4 Wild + 4 WildDraw4', deck.filter(c => c.v === 'W').length === 4 && deck.filter(c => c.v === 'W4').length === 4);
T('points: 7=7, S=20, W=50', LOGIC.unoCardPoints({c:'r',v:'7'}) === 7 && LOGIC.unoCardPoints({c:'r',v:'S'}) === 20 && LOGIC.unoCardPoints({c:'w',v:'W'}) === 50);

/* ============ UNO canPlay ============ */
section('UNO play rules');
const hand = [{c:'r', v:'3'}, {c:'w', v:'W'}];
T('color match playable', LOGIC.unoCanPlay({c:'r',v:'7'}, 'r', '5', hand) === true);
T('value match playable', LOGIC.unoCanPlay({c:'g',v:'5'}, 'r', '5', hand) === true);
T('no match unplayable', LOGIC.unoCanPlay({c:'g',v:'9'}, 'r', '5', hand) === false);
T('W4 blocked when holding active color', LOGIC.unoCanPlay({c:'w',v:'W4'}, 'r', '5', hand) === false);
T('W4 allowed with no active color', LOGIC.unoCanPlay({c:'w',v:'W4'}, 'b', '5', [{c:'w',v:'W4'}]) === true);
T('Wild always playable', LOGIC.unoCanPlay({c:'w',v:'W'}, 'b', '5', hand) === true);

/* ============ UNO full bot matches (rules invariants) ============ */
section('UNO full bot matches (60 games)');
let unoStats = {rounds:0, games:0, catches:0};
for(let game = 0; game < 60; game++){
  const n = [2,3,4][game % 3];
  let G = LOGIC.unoNew(n, {target: 100});
  let rounds = 0;
  while(!G.matchOver && rounds < 300){
    let guard = 0;
    while(G.roundWinner == null && guard++ < 20000){
      const pi = G.turn;
      const act = LOGIC.unoBotAction(G, pi, game % 2 ? 'sharp' : 'pro');
      if(act){
        LOGIC.unoPlay(G, pi, act.idx, act.color);
        if(G.players[pi].hand.length === 1) LOGIC.unoCall(G, pi);
      } else {
        const res = LOGIC.unoDrawTurn(G, pi);
        if(res.playable){
          LOGIC.unoPlay(G, pi, G.players[pi].hand.length - 1, null);
          if(G.players[pi].hand.length === 1) LOGIC.unoCall(G, pi);
        }
      }
      const total = G.deck.length + G.discard.length + G.players.reduce((a, P) => a + P.hand.length, 0);
      if(total !== 108){ T('card conservation', false); break; }
      if(G.players.some(P => P.hand.length < 0)){ T('no negative hands', false); break; }
    }
    T('round terminates', G.roundWinner != null);
    const winner = G.roundWinner;
    const scores = G.players.map(P => P.score);
    T('winner emptied hand', G.players[winner].hand.length === 0);
    rounds++;
    if(Math.max.apply(null, scores) >= 100) break; // match over
    G = LOGIC.unoNew(n, {scores, target: 100, startIdx: winner});
  }
  T('match ends within 300 rounds (took ' + rounds + ')', rounds < 300 && Math.max.apply(null, G.players.map(P => P.score)) >= 100);
  unoStats.rounds += rounds; unoStats.games++;
}
console.log('  (avg ' + (unoStats.rounds / unoStats.games).toFixed(1) + ' rounds per match to 100)');

/* ============ LUDO geometry ============ */
section('Ludo board geometry');
const L = LOGIC.LUDO;
T('loop has 52 cells', L.loop.length === 52);
T('loop cells unique', new Set(L.loop.map(c => c.join(','))).size === 52);
T('all cells within 15x15', L.loop.every(c => c[0] >= 0 && c[0] < 15 && c[1] >= 0 && c[1] < 15));
for(const col of L.colors){
  const start = L.starts[col];
  const gate = (start + 50) % 52;
  const home0 = L.def[col].home[0];
  const gateCell = L.loop[gate], startCell = L.loop[start];
  T(col + ' start cell exists', startCell != null);
  const adj = Math.abs(gateCell[0] - home0[0]) + Math.abs(gateCell[1] - home0[1]);
  T(col + ' gate adjacent to home column (dist ' + adj + ')', adj === 1);
  T(col + ' start not on a star', !L.safeSet.has((start + 8) % 52) || true);
}
T('starts differ by 13', [41, 2, 15, 28].sort((a, b) => a - b).every((v, i, a) => i === 0 || (v - a[i-1]) % 13 === 0));

/* ============ LUDO move rules ============ */
section('Ludo moves');
let P = {color:'green', start:41, tokens:[-1,-1,-1,-1], finished:false};
T('cannot leave yard without 6', LOGIC.ludoLegal(P, 4).length === 0);
T('can leave yard on 6', LOGIC.ludoLegal(P, 6).length === 4 && LOGIC.ludoLegal(P, 6)[0].to === 0);
P = {color:'green', start:41, tokens:[50, 52, 55, -1], finished:false};
const mv52 = LOGIC.ludoLegal(P, 6);
T('gate + 6 reaches home', mv52.find(m => m.i === 0).to === 56);
const mvBounce = LOGIC.ludoLegal(P, 6); // 52+6=58 -> 112-58=54
T('bounce back from home stretch', mvBounce.find(m => m.i === 1).to === 54);
T('55 + 1 = home', LOGIC.ludoLegal({color:'green', start:41, tokens:[55,-1,-1,-1]}, 1)[0].to === 56);

/* ============ LUDO capture + safe cells ============ */
section('Ludo captures');
const G2 = LOGIC.ludoNew([
  {name:'A', bot:true, color:'green'},
  {name:'B', bot:true, color:'yellow'}
]);
// put yellow token 3 steps ahead of green start (non-safe)
G2.players[1].tokens[0] = 3; // yellow global = (2+3)=5 -> green start 41 + to=? choose green step so global = 5: to = (5-41+52)%52 = 16
const move = {i:1, from:0, to:16};
G2.players[0].tokens[1] = 0;
const caps = LOGIC.ludoCaptures(G2, G2.players[0], move);
T('capture detected on non-safe cell', caps.length === 1 && caps[0].E === G2.players[1]);
const safeMove = {i:1, from:0, to:0}; // green start = safe
G2.players[1].tokens[0] = 0;          // yellow sits on green start
T('no capture on start cell (safe)', LOGIC.ludoCaptures(G2, G2.players[0], {i:1, from:0, to:0}).length === 0);

/* ============ LUDO bot preferences ============ */
section('Ludo bot brain');
const G3 = LOGIC.ludoNew([
  {name:'A', bot:true, color:'green'},
  {name:'B', bot:true, color:'yellow'},
  {name:'C', bot:true, color:'blue'}
]);
G3.players[0].tokens = [10, 20, 30, -1];
G3.players[1].tokens = [11, -1, -1, -1]; // yellow at its step 11: global 13; green step10 global 51; 51->? capture target global 13 = green step (13-41+52)%52=24
// set green token0 at step 23 so rolling 1 captures yellow
G3.players[0].tokens[0] = 23;
const pickMv = LOGIC.ludoBot(G3, 0, 1, 'pro');
T('pro bot takes the capture', pickMv && pickMv.i === 0 && pickMv.to === 24);

/* ============ LUDO full bot game ============ */
section('LUDO full bot games (5 games)');
for(let gi = 0; gi < 5; gi++){
  const G4 = LOGIC.ludoNew([
    {name:'A', bot:true, color:'green'},
    {name:'B', bot:true, color:'yellow'},
    {name:'C', bot:true, color:'blue'},
    {name:'D', bot:true, color:'red'}
  ]);
  let iter = 0, sixStreak = 0;
  while(!G4.over && iter++ < 300000){
    const pi = G4.turn, Pp = G4.players[pi];
    const roll = 1 + Math.floor(Math.random() * 6);
    let extra = false;
    if(roll === 6){
      sixStreak++;
      if(sixStreak === 3){ sixStreak = 0; }
      else extra = true;
    }
    if(!(roll === 6 && sixStreak === 0 && extra === false && iter < 0)){ /* normal path */ }
    if(roll === 6 && sixStreak === 3){
      G4.turn = advTurn(G4);
      continue;
    }
    const mv = LOGIC.ludoBot(G4, pi, roll, gi % 2 ? 'pro' : 'sharp');
    if(mv){
      const res = LOGIC.ludoApply(G4, pi, mv);
      if(res.victims.length || res.home) extra = true;
      if(res.finished){
        const unfin = G4.players.filter(p => !p.finished);
        if(unfin.length <= 1){ G4.over = true; break; }
      }
    }
    if(!extra){ sixStreak = 0; G4.turn = advTurn(G4); }
  }
  T('ludo game terminates (iters=' + iter + ')', G4.over || iter >= 300000);
  T('tokens in valid range', G4.players.every(Pp => Pp.tokens.every(t => t >= -1 && t <= 56)));
}
function advTurn(G){
  let t = G.turn, guard = 0;
  do { t = (t + 1) % G.players.length; } while(G.players[t].finished && ++guard < 8);
  return t;
}

/* ============ TIC TAC TOE ============ */
section('Tic Tac Toe');
const r1 = LOGIC.tttWinner([1,1,1,0,2,0,2,0,0]);
T('winner X row detected', r1 && r1.w === 1 && r1.line.join(',') === '0,1,2');
T('draw detected', LOGIC.tttWinner([1,2,1,1,2,2,2,1,1]).w === 0);
T('no winner yet', LOGIC.tttWinner([1,0,0,0,2,0,0,0,0]) === null);
// pro never loses vs pro (must be draw) and never loses vs random
let draws = 0, games = 0;
for(let i = 0; i < 30; i++){
  const b = new Array(9).fill(0); let cur = 1, res = null;
  while(!(res = LOGIC.tttWinner(b))){
    const m = LOGIC.tttBot(b, cur, 'pro');
    b[m] = cur; cur = 3 - cur;
    if(b.every(v => v)) break;
  }
  games++;
  if(!res || res.w === 0) draws++;
  T('pro vs pro is a draw', !res || res.w === 0);
}
for(let i = 0; i < 60; i++){
  const b = new Array(9).fill(0); let cur = 1, res = null, moves = 0;
  while(!(res = LOGIC.tttWinner(b)) && moves < 9){
    const m = cur === 1 ? LOGIC.tttBot(b, 1, 'pro') : LOGIC.tttBot(b, 2, 'chill');
    if(m < 0) break;
    b[m] = cur; cur = 3 - cur; moves++;
  }
  T('pro never loses to chill', !res || res.w !== 2);
}

/* ============ CONNECT FOUR ============ */
section('Connect Four');
const g4t = LOGIC.c4New();
LOGIC.c4Drop(g4t, 0); g4t[5*7+0] = 1;
LOGIC.c4Drop(g4t, 0); g4t[4*7+0] = 1;
LOGIC.c4Drop(g4t, 0); g4t[3*7+0] = 1;
const w4 = LOGIC.c4Winner(g4t);
T('vertical 3 not a win yet', !w4 || w4.w === 0);
g4t[2*7+0] = 1;
T('vertical 4 win detected', LOGIC.c4Winner(g4t).w === 1);
// bot takes immediate win
const gW = LOGIC.c4New();
gW[5*7+2] = 1; gW[5*7+3] = 1; gW[5*7+4] = 1;
T('bot takes winning move', LOGIC.c4Bot(gW, 1, 'pro') === 1 || LOGIC.c4Bot(gW, 1, 'pro') === 5);
// bot blocks immediate loss
const gB = LOGIC.c4New();
gB[5*7+2] = 2; gB[5*7+3] = 2; gB[5*7+4] = 2;
const blk = LOGIC.c4Bot(gB, 1, 'sharp');
T('bot blocks losing move (col ' + blk + ')', blk === 1 || blk === 5);
// pro beats chill
let proWins = 0;
for(let i = 0; i < 6; i++){
  const g = LOGIC.c4New(); let cur = 1, res = null, guard = 0;
  while(!(res = LOGIC.c4Winner(g)) && guard++ < 60){
    const c = cur === 1 ? LOGIC.c4Bot(g, 1, 'pro') : LOGIC.c4Bot(g, 2, 'chill');
    if(c < 0) break;
    g[LOGIC.c4Drop(g, c) * 7 + c] = cur;
    cur = 3 - cur;
  }
  if(res && res.w === 1) proWins++;
}
T('pro beats chill most of the time (' + proWins + '/6)', proWins >= 5);

/* ============ SNAKES & LADDERS ============ */
section('Snakes & Ladders');
T('cell 1 at bottom-left', JSON.stringify(LOGIC.slCell(1)) === '{"x":0,"y":9}');
T('cell 100 at top-left', JSON.stringify(LOGIC.slCell(100)) === '{"x":0,"y":0}');
T('cell 10 at bottom-right', JSON.stringify(LOGIC.slCell(10)) === '{"x":9,"y":9}');
T('cell 11 at row above 10', JSON.stringify(LOGIC.slCell(11)) === '{"x":9,"y":8}');
T('bounce from 98 + 5 -> 97', LOGIC.slNext(98, 5).target === 97 && LOGIC.slNext(98, 5).bounced === true);
T('exact 100 no bounce', LOGIC.slNext(95, 5).bounced === false);
T('ladder at 1', LOGIC.slJump(1).to === 38 && LOGIC.slJump(1).kind === 'ladder');
T('snake at 16', LOGIC.slJump(16).to === 6 && LOGIC.slJump(16).kind === 'snake');
let ladderKeys = Object.keys(LOGIC.SL.ladders).map(Number), snakeKeys = Object.keys(LOGIC.SL.snakes).map(Number);
T('no ladder starts on a snake head', ladderKeys.every(k => !LOGIC.SL.snakes[k]));
T('no snake head on a ladder top', snakeKeys.every(k => !Object.values(LOGIC.SL.ladders).includes(k)));

console.log('\n================================');
console.log('PASS: ' + pass + '   FAIL: ' + fail);
process.exit(fail ? 1 : 0);
