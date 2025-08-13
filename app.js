// Ludo PWA — full board + pass-and-play gameplay
// Works with your existing index.html and styles.css

const qs  = (s) => document.querySelector(s);
const qsa = (s) => [...document.querySelectorAll(s)];

// Screens & UI
const screenStart = qs('#screen-start');
const screenGame  = qs('#screen-game');
const btnStart    = qs('#btnStart');
const playersSel  = qs('#players');
const targetSel   = qs('#target');

const boardSVG    = qs('#board');
const btnRoll     = qs('#btnRoll');
const rollValueEl = qs('#rollValue');
const turnInfo    = qs('#turnInfo');

const winnerModal = qs('#winnerModal');
const winnerTitle = qs('#winnerTitle');
const winnerText  = qs('#winnerText');
const btnAgain    = qs('#btnAgain');
const btnHome     = qs('#btnHome');

const offlineBadge = qs('#offlineBadge'); // optional
window.addEventListener('online',  () => offlineBadge && (offlineBadge.hidden = true));
window.addEventListener('offline', () => offlineBadge && (offlineBadge.hidden = false));
if (offlineBadge && !navigator.onLine) offlineBadge.hidden = false;

// --- Geometry / Layout ---
const SIZE = 600;
const CELL = SIZE / 15;  // classic 15x15 grid

// Outer path (52 steps). Start at red entry going clockwise.
// Coords are [row, col] on a 15x15 grid (0..14)
const PATH = (() => {
  const seq = [
    [6,0],[6,1],[6,2],[6,3],[6,4],[5,5],[4,6],[3,6],[2,6],[1,6],[0,6],[0,7],[0,8],
    [1,8],[2,8],[3,8],[4,8],[5,9],[6,10],[6,11],[6,12],[6,13],[6,14],
    [7,14],
    [8,14],[8,13],[8,12],[8,11],[8,10],[9,9],[10,8],[11,8],[12,8],[13,8],[14,8],
    [14,7],
    [14,6],[13,6],[12,6],[11,6],[10,6],[9,5],[8,4],[8,3],[8,2],[8,1],[8,0],
    [7,0],
    [6,0]
  ];
  seq.pop(); // keep 52
  return seq;
})();

// Entry indices into PATH for each color
// 0=Red, 1=Green, 2=Yellow, 3=Blue
const ENTRY = { 0:0, 1:13, 2:26, 3:39 };

// Home stretches (6 steps to center), then center (index 6)
const HOME_COL = {
  0: [[7,1],[7,2],[7,3],[7,4],[7,5],[7,6]],        // Red to center (7,7)
  1: [[1,7],[2,7],[3,7],[4,7],[5,7],[6,7]],        // Green
  2: [[7,13],[7,12],[7,11],[7,10],[7,9],[7,8]],    // Yellow
  3: [[13,7],[12,7],[11,7],[10,7],[9,7],[8,7]]     // Blue
};
const CENTER = [7,7];

// Safe tiles (no capture). Traditionally: all start squares + star/safe cells.
// Using common set for classic Ludo layouts:
const SAFE_PATH_IDXS = new Set([0, 8, 13, 21, 26, 34, 39, 47]);

// Colors
const COLORS = ['var(--red)','var(--green)','var(--yellow)','var(--blue)'];
const COLOR_NAMES = ['Red','Green','Yellow','Blue'];

// --- Game State ---
let G = null;

// Utility
function rcToXY([r,c]) { return { x: c*CELL, y: r*CELL }; }

// --- Board Drawing ---
function drawBoard() {
  boardSVG.innerHTML = '';
  boardSVG.setAttribute('viewBox', `0 0 ${SIZE} ${SIZE}`);

  // Background
  rect(0,0,SIZE,SIZE,'#0b1325', null, 0);

  // Grid + cross arms
  for (let r=0;r<15;r++){
    for (let c=0;c<15;c++){
      const isCross = (r===7 || c===7);
      rect(c*CELL, r*CELL, CELL, CELL, isCross ? '#0f1a33' : 'transparent', '#1f2a44', 1, 4);
    }
  }

  // Four home quadrants (6x6 each)
  const homes = [
    {r:0, c:0,  color:'var(--red)'},
    {r:0, c:9,  color:'var(--green)'},
    {r:9, c:9,  color:'var(--yellow)'},
    {r:9, c:0,  color:'var(--blue)'}
  ];
  for (const h of homes) {
    roundedRect(h.c*CELL, h.r*CELL, CELL*6, CELL*6, 12, h.color, 0.2, '#1f2a44');
  }

  // Home stretches (6 tiles towards center)
  const stretchColor = {0:'var(--red)',1:'var(--green)',2:'var(--yellow)',3:'var(--blue)'};
  for (let p=0;p<4;p++){
    HOME_COL[p].forEach(([r,c])=>{
      rect(c*CELL, r*CELL, CELL, CELL, getVar(stretchColor[p], .8), '#1f2a44', 1);
    });
  }

  // Start tiles (entry squares) — slightly brighter colored rings
  for (let p=0;p<4;p++){
    const idx = ENTRY[p];
    const [r,c] = PATH[idx];
    roundedRect(c*CELL, r*CELL, CELL, CELL, 8, getVar(COLORS[p], .35), 1, '#1f2a44');
    starIcon(c*CELL + CELL/2, r*CELL + CELL/2, CELL*0.18, getVar(COLORS[p], 1));
  }

  // Other safe/star tiles
  SAFE_PATH_IDXS.forEach(i=>{
    if (i===ENTRY[0]||i===ENTRY[1]||i===ENTRY[2]||i===ENTRY[3]) return;
    const [r,c] = PATH[i];
    roundedRect(c*CELL, r*CELL, CELL, CELL, 8, '#14244a', 1, '#1f2a44');
    starIcon(c*CELL + CELL/2, r*CELL + CELL/2, CELL*0.16, '#8ba3c7');
  });

  // Center
  circle(CENTER[1]*CELL + CELL/2, CENTER[0]*CELL + CELL/2, CELL*1.55, '#12203d', '#1f2a44', 2);
}

// --- SVG helpers ---
function rect(x,y,w,h, fill, stroke=null, sw=0, rx=0) {
  const n = el('rect');
  n.setAttribute('x',x); n.setAttribute('y',y);
  n.setAttribute('width',w); n.setAttribute('height',h);
  if (rx) n.setAttribute('rx',rx);
  if (fill) n.setAttribute('fill', fill);
  if (stroke){ n.setAttribute('stroke', stroke); n.setAttribute('stroke-width', sw); }
  boardSVG.appendChild(n);
  return n;
}
function roundedRect(x,y,w,h,rx, color, opacity=1, stroke=null) {
  const n = rect(x,y,w,h,color, stroke||'#1f2a44', stroke?1:0, rx);
  n.setAttribute('opacity', opacity);
  return n;
}
function circle(cx,cy,r, fill, stroke=null, sw=0) {
  const n = el('circle');
  n.setAttribute('cx',cx); n.setAttribute('cy',cy); n.setAttribute('r',r);
  if (fill) n.setAttribute('fill', fill);
  if (stroke){ n.setAttribute('stroke', stroke); n.setAttribute('stroke-width', sw); }
  boardSVG.appendChild(n);
  return n;
}
function starIcon(cx, cy, r, fill) {
  // Simple 4-point diamond star
  const pts = [
    [cx, cy-r], [cx+r*0.9, cy], [cx, cy+r], [cx-r*0.9, cy]
  ].map(p=>p.join(',')).join(' ');
  const n = el('polygon');
  n.setAttribute('points', pts);
  n.setAttribute('fill', fill);
  n.setAttribute('opacity', .9);
  boardSVG.appendChild(n);
}
function el(name){ return document.createElementNS('http://www.w3.org/2000/svg', name); }
function getVar(cssVar, alpha=1){ // returns rgba(var(--x)) via computed style
  // fall back: set opacity via element attribute; for simplicity return cssVar directly if alpha==1
  if (alpha===1) return cssVar;
  // approximate: use currentColor overlay — or simply return cssVar and rely on element opacity
  // We'll use element opacity on the caller.
  return cssVar;
}

// --- Game Setup ---
function newGame() {
  const numPlayers = parseInt(playersSel.value, 10);
  const target    = parseInt(targetSel.value, 10);

  const names = [
    qs('#p0name')?.value || 'Red',
    qs('#p1name')?.value || 'Green',
    qs('#p2name')?.value || 'Yellow',
    qs('#p3name')?.value || 'Blue'
  ];

  G = {
    players: numPlayers,
    target,
    names,
    // Tokens: 4 per player
    tokens: Array.from({length:4}, (_,p)=>(
      Array.from({length:4}, ()=>({
        p, state:'base', pos:0, svg:null
      }))
    )),
    turn: 0,
    rolled: null
  };

  screenStart.classList.remove('active');
  screenGame.classList.add('active');

  drawBoard();
  drawAllTokens();
  updateHUD();
}

// Token positioning
function tokenToXY(token){
  if (token.state === 'base'){
    // distribute in 2x2 inside 6x6 home quadrant
    const offsets = [[1.5,1.5],[1.5,4.5],[4.5,1.5],[4.5,4.5]]; // (row,col) offsets within quadrant
    const idx = G.tokens[token.p].indexOf(token);
    const [or, oc] = offsets[idx];

    // top-left of that player's quadrant
    const tl = (
      token.p === 0 ? [0,0]   :
      token.p === 1 ? [0,9]   :
      token.p === 2 ? [9,9]   :
                      [9,0]
    ); // [row, col]

    const r = (tl[0] + or) * CELL;
    const c = (tl[1] + oc) * CELL;
    return { x: c, y: r };
  }

  if (token.state === 'path'){
    const abs = (ENTRY[token.p] + token.pos) % 52;
    const [r,c] = PATH[abs];
    const {x,y} = rcToXY([r,c]);
    return { x, y };
  }

  // home column (0..6) — 6 is center
  const i = token.pos;
  if (i <= 5){
    const [r,c] = HOME_COL[token.p][i];
    const {x,y} = rcToXY([r,c]);
    return { x, y };
  } else {
    const {x,y} = rcToXY(CENTER);
    return { x, y };
  }
}

function drawAllTokens(){
  qsa('.token').forEach(n=>n.remove());
  for (let p=0;p<4;p++){
    if (p >= G.players) continue;
    for (let t=0;t<4;t++){
      const tk = G.tokens[p][t];
      const g = el('g');
      g.classList.add('token');

      const ring = el('circle');
      ring.setAttribute('r', CELL*0.38);
      ring.setAttribute('fill', 'rgba(0,0,0,0.35)');
      g.appendChild(ring);

      const body = el('circle');
      body.setAttribute('r', CELL*0.32);
      body.setAttribute('fill', COLORS[p]);
      body.setAttribute('stroke', '#0b1325');
      body.setAttribute('stroke-width', '2');
      g.appendChild(body);

      const pip = el('circle');
      pip.setAttribute('r', CELL*0.12);
      pip.setAttribute('fill', '#0b1325');
      g.appendChild(pip);

      const pos = tokenToXY(tk);
      g.setAttribute('transform', `translate(${pos.x + CELL/2}, ${pos.y + CELL/2})`);
      g.addEventListener('click', ()=>tryMoveToken(tk));
      g.style.cursor = 'pointer';

      boardSVG.appendChild(g);
      tk.svg = g;
    }
  }
}

function moveVisual(token){
  const pos = tokenToXY(token);
  token.svg.setAttribute('transform', `translate(${pos.x + CELL/2}, ${pos.y + CELL/2})`);
}

// --- Turn / Dice ---
btnStart.addEventListener('click', newGame);
btnRoll.addEventListener('click', roll);
btnAgain.addEventListener('click', ()=>{ winnerModal.close(); newGame(); });
btnHome.addEventListener('click', ()=>{ winnerModal.close(); screenGame.classList.remove('active'); screenStart.classList.add('active'); });

function roll(){
  if (G.rolled != null) return;
  G.rolled = 1 + Math.floor(Math.random()*6);
  rollValueEl.textContent = String(G.rolled);
  updateHUD();
}

function updateHUD(){
  if (!G) return;
  turnInfo.textContent = `Turn: ${COLOR_NAMES[G.turn]} — ${G.names[G.turn]}`;
  btnRoll.disabled = (G.rolled != null); // disable until a move is made or turn passes
  rollValueEl.textContent = (G.rolled ?? '—');
}

// --- Movement / Rules ---
function legalMovesFor(p){
  const v = G.rolled;
  if (v == null) return [];
  const moves = [];

  for (const tk of G.tokens[p]){
    if (tk.state === 'base'){
      if (v === 6) moves.push({tk, kind:'enter'});
    } else if (tk.state === 'path'){
      // Distance from current absolute index to home entry
      const distToEntry = (52 - ((ENTRY[p] + tk.pos) % 52)) % 52;
      // If move would require >6 after crossing entry, it's illegal (overshoot center)
      if (v > distToEntry + 6) continue;
      moves.push({tk, kind:'advance'});
    } else {
      // home column 0..6 (6 = center)
      if (tk.pos + v <= 6) moves.push({tk, kind:'home'});
    }
  }

  return moves;
}

function tryMoveToken(token){
  if (G.rolled == null) return;
  const p = G.turn;
  const move = legalMovesFor(p).find(m => m.tk === token);
  if (!move) return;

  const v = G.rolled;

  if (move.kind === 'enter'){
    token.state = 'path';
    token.pos = 0;
  } else if (move.kind === 'advance'){
    token.pos += v;
  } else if (move.kind === 'home'){
    token.state = 'home';
    token.pos += v;
  }

  // Capture (only when on path, not on home/base)
  if (token.state === 'path'){
    const abs = (ENTRY[p] + token.pos) % 52;

    // Skip captures on safe tiles
    if (!SAFE_PATH_IDXS.has(abs)){
      const [r,c] = PATH[abs];
      for (let op=0; op<G.players; op++){
        if (op === p) continue;
        for (const ot of G.tokens[op]){
          if (ot.state !== 'path') continue;
          const oabs = (ENTRY[op] + ot.pos) % 52;
          const [or, oc] = PATH[oabs];
          if (or===r && oc===c){
            // send opponent back to base
            ot.state = 'base';
            ot.pos = 0;
            moveVisual(ot);
          }
        }
      }
    }
  }

  moveVisual(token);

  // Win check: tokens exactly at center (home pos 6)
  const atHome = G.tokens[p].filter(t=>t.state==='home' && t.pos===6).length;
  if (atHome >= G.target){
    winnerTitle.textContent = `${COLOR_NAMES[p]} Wins! 🏆`;
    winnerText.textContent = `${G.names[p]} reached ${G.target} token${G.target>1?'s':''} home.`;
    if (!winnerModal.open) winnerModal.showModal();
  }

  // Handle turn passing
  const extra = (G.rolled === 6);
  G.rolled = null;
  rollValueEl.textContent = '—';
  if (!extra){
    G.turn = (G.turn + 1) % G.players;
  }
  updateHUD();
}

// Initial board preview on load
drawBoard();
