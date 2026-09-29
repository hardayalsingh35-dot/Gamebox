'use strict';
/* ================================================================
   GameBox — core framework: helpers, sound, modals, toasts,
   confetti, dice, home + setup screens, navigation.
   ================================================================ */
const $  = (s, r) => (r || document).querySelector(s);
const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
const esc = s => String(s).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
const pick = a => a[Math.floor(Math.random() * a.length)];
const adv = (i, d, n) => ((i + d) % n + n) % n;

/* ---------- safe storage (works even in sandboxed preview) ---------- */
const store = {
  mem: {},
  get(k, d){ try{ const v = localStorage.getItem('gb_' + k); return v == null ? d : JSON.parse(v); }catch(e){ return k in this.mem ? this.mem[k] : d; } },
  set(k, v){ try{ localStorage.setItem('gb_' + k, JSON.stringify(v)); }catch(e){ this.mem[k] = v; } }
};
const SETT = {
  sound:   store.get('sound', true),
  haptics: store.get('haptics', true),
  level:   store.get('level', 'sharp'),
  names:   store.get('names', ['You', 'Nova', 'Pixel', 'Mochi'])
};
function saveSett(){ store.set('sound', SETT.sound); store.set('haptics', SETT.haptics); store.set('level', SETT.level); store.set('names', SETT.names); }

/* ---------- timers (auto-cleared when screens change) ---------- */
const Timers = {
  ids: new Set(),
  set(fn, ms){ const id = setTimeout(() => { Timers.ids.delete(id); fn(); }, ms); Timers.ids.add(id); return id; },
  interval(fn, ms){ const id = setInterval(fn, ms); Timers.ids.add(id); return id; },
  clear(id){ clearTimeout(id); clearInterval(id); Timers.ids.delete(id); },
  clearAll(){ for(const id of this.ids){ clearTimeout(id); clearInterval(id); } this.ids.clear(); }
};
const wait = ms => new Promise(r => Timers.set(r, ms));

/* ---------- gentle synthesized sound ---------- */
const Snd = {
  ctx: null,
  init(){
    if(!this.ctx){
      try{ this.ctx = new (window.AudioContext || window.webkitAudioContext)(); }catch(e){ return; }
    }
    if(this.ctx && this.ctx.state === 'suspended'){ try{ this.ctx.resume(); }catch(e){} }
  },
  tone(f1, dur, type, vol, f2, delay){
    if(!SETT.sound || !this.ctx) return;
    try{
      const t0 = this.ctx.currentTime + (delay || 0);
      const o = this.ctx.createOscillator(), g = this.ctx.createGain();
      o.type = type || 'sine';
      o.frequency.setValueAtTime(f1, t0);
      if(f2) o.frequency.exponentialRampToValueAtTime(Math.max(30, f2), t0 + dur);
      g.gain.setValueAtTime(0, t0);
      g.gain.linearRampToValueAtTime(vol || 0.09, t0 + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      o.connect(g); g.connect(this.ctx.destination);
      o.start(t0); o.stop(t0 + dur + 0.05);
    }catch(e){}
  },
  click(){ this.tone(640, 0.06, 'triangle', 0.05); },
  pop(){ this.tone(520, 0.09, 'sine', 0.08, 700); },
  card(){ this.tone(480, 0.1, 'triangle', 0.08, 720); this.tone(960, 0.07, 'sine', 0.04, 1200, 0.04); },
  draw(){ this.tone(300, 0.09, 'sine', 0.06, 390); },
  hop(){ this.tone(500, 0.05, 'sine', 0.05, 560); },
  dice(){ for(let i = 0; i < 5; i++) this.tone(1300 + Math.random() * 500, 0.025, 'square', 0.022, undefined, i * 0.055); },
  capture(){ this.tone(420, 0.28, 'sawtooth', 0.05, 140); },
  home(){ this.tone(660, 0.12, 'sine', 0.09); this.tone(990, 0.16, 'sine', 0.08, undefined, 0.1); },
  snake(){ this.tone(520, 0.4, 'triangle', 0.07, 170); },
  ladder(){ this.tone(330, 0.35, 'sine', 0.08, 720); },
  uno(){ this.tone(700, 0.12, 'sine', 0.1, 940); this.tone(940, 0.14, 'sine', 0.08, 1180, 0.1); },
  buzz(){ this.tone(130, 0.12, 'square', 0.045); },
  win(){ [523, 659, 784, 1046].forEach((f, i) => this.tone(f, 0.22, 'sine', 0.09, undefined, i * 0.13)); this.tone(1318, 0.4, 'sine', 0.06, undefined, 0.55); },
  sad(){ this.tone(330, 0.25, 'sine', 0.07, 220); }
};
document.addEventListener('pointerdown', () => Snd.init(), {passive:true});
function buzz(ms){ if(SETT.haptics){ try{ navigator.vibrate && navigator.vibrate(ms); }catch(e){} } }

/* ---------- toasts ---------- */
const Toast = {
  show(msg, ms){
    const root = $('#toasts');
    while(root.children.length >= 3) root.firstChild.remove();
    const t = document.createElement('div');
    t.className = 'toast'; t.innerHTML = msg;
    root.appendChild(t);
    setTimeout(() => { t.classList.add('out'); setTimeout(() => t.remove(), 260); }, ms || 2100);
  },
  clear(){ $('#toasts').innerHTML = ''; }
};

/* ---------- modal ---------- */
const Modal = {
  cur: null,
  open(opts){
    const root = $('#modals');
    root.innerHTML = '<div class="backdrop"></div><div class="modal"></div>';
    root.classList.add('show');
    const m = $('.modal', root);
    m.innerHTML = (opts.title ? '<h3>' + opts.title + '</h3>' : '') +
      '<div class="m-body">' + (opts.html || '') + '</div>' +
      (opts.actions && opts.actions.length ? '<div class="m-actions">' +
        opts.actions.map((a, i) => '<button class="btn ' + (a.cls || 'btn-ghost') + '" data-mi="' + i + '">' + esc(a.label) + '</button>').join('') +
      '</div>' : '');
    $$('.m-actions .btn', m).forEach(btn => {
      btn.addEventListener('click', () => {
        const a = opts.actions[+btn.dataset.mi];
        Snd.click();
        if(!a.keep) Modal.close();
        if(a.fn) a.fn();
      });
    });
    if(opts.dismiss !== false){
      $('.backdrop', root).addEventListener('click', () => { Modal.close(); if(opts.onClose) opts.onClose(); });
    }
    this.cur = opts;
  },
  close(){ const root = $('#modals'); root.classList.remove('show'); root.innerHTML = ''; this.cur = null; },
  isOpen(){ return $('#modals').classList.contains('show'); }
};

/* ---------- confetti ---------- */
const Confetti = {
  ps: [], raf: 0,
  colors: ['#b9a7ff','#8fe8c8','#ffc59e','#9cc8ff','#ff9fb4','#ffd98e'],
  burst(n){
    const cv = $('#confetti');
    if(!cv || !cv.getContext) return;
    cv.width = innerWidth; cv.height = innerHeight;
    const ctx = cv.getContext('2d');
    const W = cv.width, H = cv.height;
    for(let i = 0; i < (n || 90); i++){
      this.ps.push({
        x: W/2 + (Math.random()-0.5)*W*0.5, y: -20 - Math.random()*H*0.25,
        vx: (Math.random()-0.5)*2.4, vy: 1.6 + Math.random()*2.6,
        s: 5 + Math.random()*7, r: Math.random()*Math.PI, vr: (Math.random()-0.5)*0.2,
        c: pick(this.colors), sway: Math.random()*Math.PI*2
      });
    }
    if(!this.raf) this.loop(ctx, W, H);
  },
  loop(ctx, W, H){
    this.raf = requestAnimationFrame(() => this.loop(ctx, W, H));
    ctx.clearRect(0, 0, W, H);
    this.ps = this.ps.filter(p => p.y < H + 30);
    if(!this.ps.length){ cancelAnimationFrame(this.raf); this.raf = 0; ctx.clearRect(0,0,W,H); return; }
    for(const p of this.ps){
      p.sway += 0.06; p.x += p.vx + Math.sin(p.sway)*0.7; p.y += p.vy; p.r += p.vr;
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.r);
      ctx.fillStyle = p.c; ctx.globalAlpha = 0.9;
      ctx.beginPath(); ctx.roundRect ? ctx.roundRect(-p.s/2, -p.s/2, p.s, p.s*0.62, 2) : ctx.rect(-p.s/2, -p.s/2, p.s, p.s*0.62);
      ctx.fill(); ctx.restore();
    }
  }
};

/* ---------- dice ---------- */
const PIPS = {1:[4], 2:[0,8], 3:[0,4,8], 4:[0,2,6,8], 5:[0,2,4,6,8], 6:[0,2,3,5,6,8]};
function diceHTML(v){
  const on = new Set(PIPS[v] || []);
  let h = '';
  for(let i = 0; i < 9; i++) h += '<span class="pip' + (on.has(i) ? '' : ' hidden') + '"></span>';
  return h;
}
function rollDiceAnim(el, final, cb){
  if(!el) { cb(); return; }
  let k = 0;
  const iv = Timers.interval(() => {
    el.innerHTML = diceHTML(1 + Math.floor(Math.random()*6));
    if(++k >= 8){
      Timers.clear(iv);
      el.innerHTML = diceHTML(final);
      el.classList.remove('land'); void el.offsetWidth; el.classList.add('land');
      Snd.dice(); buzz(20);
      Timers.set(cb, 240);
    }
  }, 65);
}

/* ---------- flying element (card animations) ---------- */
function fly(fromEl, toEl, html, ms, cb){
  if(!fromEl || !toEl){ if(cb) cb(); return; }
  const r1 = fromEl.getBoundingClientRect(), r2 = toEl.getBoundingClientRect();
  const d = document.createElement('div');
  d.className = 'flyer'; d.innerHTML = html;
  d.style.left = r1.left + 'px'; d.style.top = r1.top + 'px';
  d.style.width = r1.width + 'px'; d.style.height = r1.height + 'px';
  document.body.appendChild(d);
  requestAnimationFrame(() => {
    d.style.transform = 'translate(' + (r2.left - r1.left + (r2.width - r1.width)/2) + 'px,' + (r2.top - r1.top + (r2.height - r1.height)/2) + 'px) scale(' + (r2.width / r1.width) + ')';
  });
  Timers.set(() => { d.remove(); if(cb) cb(); }, ms || 400);
}

/* ================================================================
   GAMES registry + rules text
   ================================================================ */
const BOT_NAMES = ['Nova', 'Pixel', 'Mochi', 'Sparky', 'Ziggy', 'Pebble'];
const GAMES = {
  uno:  { name:'UNO', sub:'The classic color-matching card game', tags:['2–4 players', 'Bots', 'Match to 500'],
    players:[2,3,4], icon:'uno',
    rules: [
      ['🎯','Match the top card by <b>color</b> or <b>number/symbol</b>. Wild cards go on anything.'],
      ['🃏','No playable card? Tap the draw pile — draw 1. If it is playable you may play it right away.'],
      ['⏭','<b>Skip</b> jumps the next player. <b>Reverse</b> flips direction (with 2 players it acts as a Skip).'],
      ['➕','<b>+2</b> / <b>Wild +4</b>: the next player draws and loses their turn. Wild +4 may only be played if you hold no card in the current color.'],
      ['📣','Down to one card? Tap the big <b>UNO!</b> button fast — or the bots catch you and you draw 2.'],
      ['🏆','Round ends when someone plays their last card. They score the value of all other hands (numbers = face value, actions = 20, wilds = 50). First to the target wins the match!']
    ]},
  ludo: { name:'Ludo', sub:'The timeless 4-token race around the board', tags:['2–4 players', 'Bots', 'Classic rules'],
    players:[2,3,4], icon:'ludo',
    rules: [
      ['🎲','Roll a <b>6</b> to bring a token out of its yard.'],
      ['➡️','Tokens travel clockwise around the whole board, then up their own colored column to the center.'],
      ['💥','Land on an opponent to send it back to its yard — but not on <b>★ safe cells</b> or colored start cells.'],
      ['🎁','Bonus rolls: rolling a 6, capturing, or getting a token all the way home. Three 6s in a row = turn lost!'],
      ['🎯','The home column needs an <b>exact</b> count — a roll that is too big bounces you back.'],
      ['🏆','First to bring all 4 tokens home wins.']
    ]},
  ttt:  { name:'Tic Tac Toe', sub:'Three in a row — quick & perfect', tags:['2 players', 'Perfect bot', 'Series play'],
    players:[2], icon:'ttt',
    rules: [
      ['❌','Players take turns marking a cell — <b>X</b> goes first.'],
      ['🏁','First to get <b>3 in a row</b> (across, down or diagonal) wins the round.'],
      ['🤖','The <b>Pro</b> bot plays perfectly — the best you can do is a draw!'],
      ['🥇','Win rounds to climb the series score.']
    ]},
  c4:   { name:'Connect Four', sub:'Drop discs, line up four to win', tags:['2 players', 'Smart bot', 'Series play'],
    players:[2], icon:'c4',
    rules: [
      ['🔵','Tap a column to drop your disc — it falls to the lowest empty slot.'],
      ['🏁','First to line up <b>4 in a row</b> — across, down or diagonal — wins.'],
      ['🤖','Bots: <b>Chill</b> plays casually, <b>Sharp</b> looks ahead, <b>Pro</b> searches 6 moves deep.'],
      ['🥇','Round wins build your series score.']
    ]},
  sl:   { name:'Snakes & Ladders', sub:'Climb the ladders, dodge the snakes', tags:['2–4 players', 'Bots', 'Classic board'],
    players:[2,3,4], icon:'sl',
    rules: [
      ['🎲','Roll the die and move that many squares, starting from square 1.'],
      ['🪜','Land at the bottom of a ladder → climb up! Land on a snake\'s head → slide down 😅'],
      ['6️⃣','Roll a 6 for a bonus roll.'],
      ['🎯','You need <b>exactly 100</b> to win — too big a roll bounces you back.'],
      ['🏆','First to square 100 wins!']
    ]}
};
function rulesModal(id){
  const g = GAMES[id];
  Modal.open({
    title: '📖 How to play — ' + g.name,
    html: '<ul class="rules-list">' + g.rules.map(r => '<li><span class="ri">' + r[0] + '</span><span>' + r[1] + '</span></li>').join('') + '</ul>',
    actions: [{label:'Got it!', cls:'btn-primary'}]
  });
}
function aboutModal(){
  Modal.open({
    title: '💫 About GameBox',
    html: '<b>GameBox v1.0</b> — five complete board & card classics in one calm, colorful app.<br><br>' +
      '• 2–4 players: pass & play on one device<br>' +
      '• Smart bots with three difficulty levels<br>' +
      '• Watch mode: make every seat a bot and enjoy the show<br>' +
      '• 100% offline, no ads, no tracking<br><br>' +
      '<span style="color:var(--faint);font-size:12px">UNO® is a trademark of Mattel — this is a fan-made, unofficial implementation. Made with ❤️ for game nights.</span>',
    actions: [{label:'Lovely', cls:'btn-primary'}]
  });
}

/* ---------- little SVG art for game cards ---------- */
function gameArt(kind){
  if(kind === 'uno') return '<svg width="66" height="60" viewBox="0 0 66 60">' +
    '<g transform="rotate(-14 24 34)"><rect x="8" y="10" width="24" height="36" rx="5" fill="#7fb8ff" stroke="#fff" stroke-width="2.5"/><ellipse cx="20" cy="28" rx="8" ry="13" fill="rgba(255,255,255,.92)" transform="rotate(-16 20 28)"/></g>' +
    '<g transform="rotate(8 34 30)"><rect x="24" y="8" width="24" height="36" rx="5" fill="#ff8f9d" stroke="#fff" stroke-width="2.5"/><ellipse cx="36" cy="26" rx="8" ry="13" fill="rgba(255,255,255,.92)" transform="rotate(-16 36 26)"/><text x="36" y="31" font-size="11" font-weight="900" text-anchor="middle" fill="#d84a5e" transform="rotate(-16 36 26)">7</text></g>' +
    '<g transform="rotate(26 48 34)"><rect x="38" y="14" width="22" height="33" rx="5" fill="#ffd47e" stroke="#fff" stroke-width="2.5"/></g></svg>';
  if(kind === 'ludo') return '<svg width="62" height="62" viewBox="0 0 62 62">' +
    '<rect x="2" y="2" width="27" height="27" rx="7" fill="#7fdcb0" opacity=".8"/><rect x="33" y="2" width="27" height="27" rx="7" fill="#ffd47e" opacity=".8"/>' +
    '<rect x="2" y="33" width="27" height="27" rx="7" fill="#ff8f9d" opacity=".8"/><rect x="33" y="33" width="27" height="27" rx="7" fill="#7fb8ff" opacity=".8"/>' +
    '<rect x="25" y="25" width="12" height="12" rx="4" fill="#eef1ff"/>' +
    '<circle cx="13" cy="13" r="4" fill="#fff"/><circle cx="49" cy="13" r="4" fill="#fff"/><circle cx="13" cy="49" r="4" fill="#fff"/><circle cx="49" cy="49" r="4" fill="#fff"/></svg>';
  if(kind === 'ttt') return '<svg width="58" height="58" viewBox="0 0 58 58">' +
    '<path d="M20 4 v50 M38 4 v50 M4 20 h50 M4 38 h50" stroke="rgba(255,255,255,.35)" stroke-width="4" stroke-linecap="round"/>' +
    '<path d="M8 8 l8 8 M16 8 l-8 8" stroke="#9cc8ff" stroke-width="5" stroke-linecap="round"/>' +
    '<circle cx="29" cy="29" r="6" stroke="#ffc59e" stroke-width="5" fill="none"/>' +
    '<path d="M42 42 l8 8 M50 42 l-8 8" stroke="#9cc8ff" stroke-width="5" stroke-linecap="round"/></svg>';
  if(kind === 'c4') return '<svg width="58" height="58" viewBox="0 0 58 58">' +
    '<rect x="2" y="2" width="54" height="54" rx="12" fill="#3d4478"/>' +
    '<circle cx="16" cy="16" r="5.5" fill="#ff8fa2"/><circle cx="30" cy="16" r="5.5" fill="#161a36"/>' +
    '<circle cx="44" cy="16" r="5.5" fill="#ffcf6e"/><circle cx="16" cy="30" r="5.5" fill="#161a36"/>' +
    '<circle cx="30" cy="30" r="5.5" fill="#ff8fa2"/><circle cx="44" cy="30" r="5.5" fill="#161a36"/>' +
    '<circle cx="16" cy="44" r="5.5" fill="#ffcf6e"/><circle cx="30" cy="44" r="5.5" fill="#161a36"/>' +
    '<circle cx="44" cy="44" r="5.5" fill="#ff8fa2"/></svg>';
  if(kind === 'sl') return '<svg width="58" height="58" viewBox="0 0 58 58">' +
    '<path d="M6 8 h8 v40 h8" stroke="#ffd98e" stroke-width="3.5" fill="none" stroke-linecap="round"/>' +
    '<path d="M8 16 h4 M8 24 h4 M8 32 h4 M8 40 h4" stroke="#ffd98e" stroke-width="2.5" stroke-linecap="round"/>' +
    '<path d="M52 8 C 38 16, 44 26, 34 34 C 26 41, 32 50, 24 54" stroke="#8fe8c8" stroke-width="5" fill="none" stroke-linecap="round"/>' +
    '<circle cx="52" cy="8" r="5" fill="#8fe8c8"/><circle cx="25.4" cy="53.6" r="2" fill="#8fe8c8"/></svg>';
  return '';
}

/* ================================================================
   Navigation / screens
   ================================================================ */
const UI = {
  screen: 'home', gameId: null, game: null,
  swap(html){
    Timers.clearAll(); Modal.close(); Toast.clear();
    if(this.game && this.game.destroy) this.game.destroy();
    this.game = null;
    $('#app').innerHTML = html;
    $('#app').classList.remove('fade-in'); void $('#app').offsetWidth; $('#app').classList.add('fade-in');
  },
  topbar(title, opts){
    opts = opts || {};
    return '<div class="topbar">' +
      '<button class="icon-btn" data-act="back">←</button>' +
      '<div class="tb-title"><span class="tt">' + title + '</span></div>' +
      '<button class="icon-btn" data-act="rules">?</button>' +
      (opts.restart ? '<button class="icon-btn" data-act="restart">↻</button>' : '') +
      '<button class="icon-btn' + (SETT.sound ? ' on' : '') + '" data-act="sound">' + (SETT.sound ? '🔊' : '🔇') + '</button>' +
      '</div>';
  },
  bindTopbar(root, gameId){
    const goHome = () => {
      if(UI.screen === 'game'){
        Modal.open({title:'🚪 Leave game?', html:'This game will be lost.',
          actions:[{label:'Keep playing', cls:'btn-primary'},{label:'Leave', cls:'btn-danger', fn:() => UI.home()}]});
      } else UI.home();
    };
    $('[data-act=back]', root).addEventListener('click', () => { Snd.click(); goHome(); });
    $('[data-act=rules]', root).addEventListener('click', () => { Snd.click(); rulesModal(gameId); });
    const rs = $('[data-act=restart]', root);
    if(rs) rs.addEventListener('click', () => {
      Snd.click();
      Modal.open({title:'↻ Restart game?', html:'Start this game over with the same players?',
        actions:[{label:'Cancel', cls:'btn-primary'},{label:'Restart', fn:() => UI.gameStart(gameId, UI.lastCfg)}]});
    });
    $('[data-act=sound]', root).addEventListener('click', function(){
      SETT.sound = !SETT.sound; saveSett();
      this.classList.toggle('on', SETT.sound);
      this.textContent = SETT.sound ? '🔊' : '🔇';
      Snd.click();
    });
  },

  /* ---------- HOME ---------- */
  home(){
    this.screen = 'home'; this.gameId = null;
    const cards = Object.keys(GAMES).map(id => {
      const g = GAMES[id];
      return '<div class="gcard" data-game="' + id + '">' +
        '<div class="art">' + gameArt(g.icon) + '</div>' +
        '<div style="flex:1;min-width:0"><div class="gc-name">' + g.name + '</div>' +
        '<div class="gc-sub">' + g.sub + '</div>' +
        '<div class="gc-tags">' + g.tags.map((t, i) => '<span class="tag' + (i === 1 ? ' t2' : '') + '">' + t + '</span>').join('') + '</div></div>' +
        '<div class="chev">›</div></div>';
    }).join('');
    this.swap(
      '<div class="screen"><div class="content">' +
      '<div class="hero"><div class="logo"><svg width="34" height="34" viewBox="0 0 34 34"><rect x="2" y="2" width="30" height="30" rx="9" fill="#fff" opacity=".95"/>' +
      '<circle cx="11" cy="11" r="3.2" fill="#ff8f9d"/><circle cx="23" cy="11" r="3.2" fill="#7fdcb0"/><circle cx="11" cy="23" r="3.2" fill="#ffd47e"/><circle cx="23" cy="23" r="3.2" fill="#7fb8ff"/></svg></div>' +
      '<div><h1>GameBox</h1><p>5 soothing classics • 2–4 players • smart bots • offline</p></div></div>' +
      '<div class="gcards">' + cards + '</div>' +
      '<div class="home-foot">' +
      '<button class="foot-chip" data-act="about">💫 About</button>' +
      '<button class="foot-chip" data-act="sound">' + (SETT.sound ? '🔊 Sound on' : '🔇 Sound off') + '</button>' +
      '</div>' +
      '<div class="credits">No ads • no internet needed • your data never leaves this device<br>GameBox v1.0</div>' +
      '</div></div>'
    );
    $$('.gcard').forEach(c => c.addEventListener('click', () => { Snd.click(); UI.setup(c.dataset.game); }));
    $('[data-act=about]').addEventListener('click', () => { Snd.click(); aboutModal(); });
    $('[data-act=sound]').addEventListener('click', function(){
      SETT.sound = !SETT.sound; saveSett();
      this.textContent = SETT.sound ? '🔊 Sound on' : '🔇 Sound off';
      Snd.click();
    });
  },

  /* ---------- SETUP ---------- */
  setup(id){
    this.screen = 'setup'; this.gameId = id;
    const g = GAMES[id];
    const maxP = g.players[g.players.length - 1];
    let count = Math.min(store.get('lastCount_' + id, maxP), maxP);
    let seats = store.get('lastSeats_' + id, null);
    if(!seats){ seats = []; for(let i = 0; i < 4; i++) seats.push(i === 0 ? {bot:false, name:'You'} : {bot:true, name:BOT_NAMES[i-1]}); }
    const AV = ['lav','mint','peach','sky'];
    const seatDot = i => '<div class="dot av-' + AV[i] + '">' + 'P' + (i+1) + '</div>';

    const render = () => {
      let seatRows = '';
      for(let i = 0; i < count; i++){
        const s = seats[i] || {bot: i > 0, name: i > 0 ? BOT_NAMES[i-1] : 'You'};
        seatRows += '<div class="seat">' + seatDot(i) +
          '<input class="txt" maxlength="12" data-seat="' + i + '" value="' + esc(s.name) + '" placeholder="Name">' +
          '<div class="seg small"><button data-hb="' + i + '" class="' + (!s.bot ? 'sel' : '') + '">Human</button><button data-hb2="' + i + '" class="' + (s.bot ? 'sel' : '') + '">🤖 Bot</button></div></div>';
      }
      let extra = '';
      if(id === 'uno'){
        const target = store.get('unoTarget', 200);
        extra = '<div class="opt-row"><div><div class="o-name">Match target</div><div class="o-hint">First to this score wins the match</div></div>' +
          '<div class="seg small" id="tgt-seg">' + [100,200,500,0].map(t =>
            '<button data-t="' + t + '" class="' + (target === t ? 'sel' : '') + '">' + (t === 0 ? 'Single round' : t) + '</button>').join('') + '</div></div>';
      }
      $('#app').innerHTML =
        '<div class="screen setup">' + this.topbar(g.name) +
        '<div class="content"><h2>' + g.name + '</h2><div class="sub">' + g.sub + '</div>' +
        '<div class="panel"><div class="p-label">Players</div>' +
        (g.players.length > 1 ? '<div class="seg" id="cnt-seg" style="margin-bottom:12px">' + g.players.map(p =>
          '<button data-p="' + p + '" class="' + (p === count ? 'sel' : '') + '">' + p + ' players</button>').join('') + '</div>' : '') +
        '<div id="seat-rows">' + seatRows + '</div></div>' +
        '<div class="panel"><div class="p-label">Bot difficulty</div><div class="opt-row"><div><div class="o-name">🤖 How smart?</div><div class="o-hint">Applies to every bot seat</div></div>' +
        '<div class="seg small" id="lvl-seg">' + [['chill','😌 Chill'],['sharp','🧠 Sharp'],['pro','🔥 Pro']].map(l =>
          '<button data-l="' + l[0] + '" class="' + (SETT.level === l[0] ? 'sel' : '') + '">' + l[1] + '</button>').join('') + '</div></div>' + extra + '</div>' +
        '<div class="setup-actions">' +
        '<button class="btn btn-lg btn-primary" id="start-btn">▶ Start game</button>' +
        '<button class="btn btn-ghost" id="rules-btn">📖 How to play</button></div>' +
        '<div class="tip">Tip: make every seat a 🤖 to watch bots battle, or keep 2+ Humans for pass-and-play.</div>' +
        '</div></div>';
      this.bindTopbar($('#app'), id);
      $('#rules-btn').addEventListener('click', () => { Snd.click(); rulesModal(id); });
      const cntSeg = $('#cnt-seg');
      if(cntSeg) $$('button', cntSeg).forEach(b => b.addEventListener('click', () => {
        count = +b.dataset.p; store.set('lastCount_' + id, count); Snd.click(); render();
      }));
      $$('[data-hb]').forEach(b => b.addEventListener('click', () => { seats[+b.dataset.hb].bot = false; Snd.click(); render(); }));
      $$('[data-hb2]').forEach(b => b.addEventListener('click', () => { seats[+b.dataset.hb2].bot = true; Snd.click(); render(); }));
      $$('[data-seat]').forEach(inp => inp.addEventListener('change', () => { seats[+inp.dataset.seat].name = inp.value.trim() || ('Player ' + (+inp.dataset.seat + 1)); }));
      $$('[data-l]').forEach(b => b.addEventListener('click', () => { SETT.level = b.dataset.l; saveSett(); Snd.click(); render(); }));
      const tgt = $('#tgt-seg');
      if(tgt) $$('button', tgt).forEach(b => b.addEventListener('click', () => { store.set('unoTarget', +b.dataset.t); Snd.click(); render(); }));
      $('#start-btn').addEventListener('click', () => {
        $$('[data-seat]').forEach(inp => { seats[+inp.dataset.seat].name = inp.value.trim() || ('Player ' + (+inp.dataset.seat + 1)); });
        store.set('lastSeats_' + id, seats);
        Snd.pop();
        const cfgSeats = [];
        for(let i = 0; i < count; i++){
          const s = seats[i] || {bot:i > 0, name: i > 0 ? BOT_NAMES[i-1] : 'You'};
          cfgSeats.push({name: s.name || ('Player ' + (i+1)), bot: !!s.bot});
        }
        UI.gameStart(id, {seats: cfgSeats, level: SETT.level, target: store.get('unoTarget', 200)});
      });
    };
    this.swap(''); render();
  },

  /* ---------- start a game ---------- */
  gameStart(id, cfg){
    if(!cfg) return;
    this.lastCfg = cfg; this.screen = 'game'; this.gameId = id;
    this.swap('');
    const makers = {uno: UnoUI, ludo: LudoUI, ttt: TttUI, c4: C4UI, sl: SlUI};
    this.game = makers[id](cfg, $('#app'));
  }
};

/* ---------- Android back button bridge ---------- */
window.__androidBack = function(){
  if(Modal.isOpen()){ Modal.close(); return; }
  if(UI.screen === 'game'){
    Modal.open({title:'🚪 Leave game?', html:'This game will be lost.',
      actions:[{label:'Keep playing', cls:'btn-primary'},{label:'Leave', cls:'btn-danger', fn:() => UI.home()}]});
  } else if(UI.screen === 'setup'){
    UI.home();
  } else {
    Modal.open({title:'👋 Exit GameBox?', html:'Close the app?',
      actions:[{label:'Stay', cls:'btn-primary'},
               {label:'Exit', cls:'btn-danger', fn:() => { try{ window.AndroidBridge && AndroidBridge.exitApp(); }catch(e){} }}]});
  }
};
document.addEventListener('keydown', e => { if(e.key === 'Escape') window.__androidBack(); });
document.addEventListener('contextmenu', e => e.preventDefault());

/* ---------- test hooks (used by automated visual tests) ---------- */
window.__qb = {
  home: () => UI.home(),
  start: id => UI.setup(id),
  startGame: (id, opts) => {
    const o = opts || {};
    const maxP = GAMES[id].players[GAMES[id].players.length - 1];
    const n = o.n || maxP;
    const seats = [];
    for(let i = 0; i < n; i++){
      const bot = o.allBots ? true : (i === 0 ? false : true);
      seats.push({name: bot ? BOT_NAMES[i] : (o.name || 'You'), bot});
    }
    UI.gameStart(id, {seats, level: o.level || 'sharp', target: o.target != null ? o.target : 200});
  },
  ui: () => UI, logic: () => LOGIC
};
