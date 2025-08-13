// Ludo Lite — app.js
// Mobile-first pass-and-play simplified Ludo logic.
// Board implemented on a 15x15 grid; each cell has precomputed coordinates.
// Players: 0=red,1=green,2=yellow,3=blue (clockwise). Light theme, touch controls.

(() => {
  const canvas = document.getElementById('board');
  const ctx = canvas.getContext('2d', { alpha: false });
  const rollBtn = document.getElementById('rollBtn');
  const diceValEl = document.getElementById('diceVal');
  const playersInfo = document.getElementById('playersInfo');
  const hint = document.getElementById('hint');
  const modal = document.getElementById('modal');
  const modalTitle = document.getElementById('modalTitle');
  const modalBody = document.getElementById('modalBody');
  const modalClose = document.getElementById('modalClose');

  // sizes: we'll scale drawing to canvas size
  function resizeCanvas(){
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.floor(rect.width * dpr);
    canvas.height = Math.floor(rect.width * dpr); // keep square
    canvas.style.height = rect.width + 'px';
    draw();
  }
  window.addEventListener('resize', resizeCanvas);
  setTimeout(resizeCanvas,50);

  // Game state
  const PLAYER_COLORS = ['#ef4444','#10b981','#f59e0b','#06b6d4']; // red,green,yellow,blue
  const PLAYER_NAMES = ['Red','Green','Yellow','Blue'];
  let numPlayers = 4;
  let state = null;

  function newGame(){
    state = {
      players: Array.from({length:4}, (_,i) => ({
        id:i, name:PLAYER_NAMES[i], color:PLAYER_COLORS[i],
        pieces: [ -1, -1, -1, -1 ], // -1 = at home, 0..51 on main track, 52..57 in goal path, 99 finished
        finished:0
      })),
      turn: 0,
      dice: null,
      diceRolled: false,
      winner: null
    };
    updatePlayersInfo();
    draw();
  }

  // Main track path (standard 52 cells). We'll compute positions on a 15x15 grid.
  // Create coordinate map for 15x15 grid cells center points.
  const GRID = 15;
  function makeGridPositions(sizePx){
    const cells = [];
    // cell size based on virtual 15x15
    const s = sizePx / GRID;
    for(let r=0;r<GRID;r++){
      for(let c=0;c<GRID;c++){
        cells.push({x: Math.round((c+0.5)*s), y: Math.round((r+0.5)*s), r:c,r2:r});
      }
    }
    return {cells,s};
  }

  // Precompute path indices mapped to grid indices (approximate Ludo King layout).
  // We'll construct a track of 52 main positions around center.
  let trackMap = [];
  function makeTrack(gridCells){
    // heroically build a Ludo-style loop using grid coordinates.
    // We'll pick a square ring inside GRID using indices 0..14
    const ring = [];
    const min = 1, max = GRID-2; // ring from 1 to 13
    // top row left->right
    for(let c=min;c<=max;c++) ring.push({r:min, c});
    // right column top->bottom (exclude top)
    for(let r=min+1;r<=max;r++) ring.push({r, c:max});
    // bottom row right->left
    for(let c=max-1;c>=min;c--) ring.push({r:max, c});
    // left column bottom->top
    for(let r=max-1;r>min;r--) ring.push({r, c:min});
    // ring length should be 48 for this size; we only need 52, so we'll insert corners extra to reach ~52.
    // To get 52, we'll add inner offsets near corners.
    // Convert to indices in gridCells
    const positions = ring.map(p => (p.r*GRID + p.c));
    // If positions not 52, we will duplicate some corner-adjacent positions to reach 52
    while(positions.length < 52){
      // insert duplicates from near corners
      positions.splice(13,0,positions[13]);
      positions.splice(26,0,positions[26]);
      positions.splice(39,0,positions[39]);
    }
    return positions.slice(0,52);
  }

  // Convert piece logical position to pixel coords
  function posToXY(pos, gridInfo){
    // pos: -1 home, 0..51 main track, 52..57 goal path (depending on player)
    const center = Math.floor(GRID*GRID/2);
    if(pos === -1) return null;
    if(pos >=0 && pos <52){
      const idx = trackMap[pos];
      return {x: gridInfo.cells[idx].x, y: gridInfo.cells[idx].y};
    } else if(pos >=52 && pos < 100){
      // goal path encode: pos = 52 + player*6 + step (0..5)
      const off = pos - 52;
      const player = Math.floor(off/6);
      const step = off % 6; // 0..5
      // goal path goes from near center outward toward player's home color quadrant.
      const centerIdx = center;
      // small offsets
      const s = gridInfo.s/2;
      const dir = [
        {dx: s* -1, dy: s* -1}, // player 0 red -> top-left
        {dx: s*  1, dy: s* -1}, // player 1 green -> top-right
        {dx: s*  1, dy: s*  1}, // player 2 yellow -> bottom-right
        {dx: s* -1, dy: s*  1}  // player 3 blue -> bottom-left
      ][player];
      return {x: gridInfo.cells[centerIdx].x + dir.dx*(step+1), y: gridInfo.cells[centerIdx].y + dir.dy*(step+1)};
    } else {
      return null;
    }
  }

  // Draw board and pieces
function draw() {
    if (!ctx) return;
    const w = canvas.width;
    const gridInfo = makeGridPositions(w);
    if (trackMap.length === 0) trackMap = makeTrack(gridInfo.cells);

    // Background
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, w, w);

    // Player quadrants (gradient fill)
    const homeSize = gridInfo.s * 6;
    const hs = Math.floor(homeSize);
    const corners = [
        { cell: gridInfo.cells[(1 * GRID) + 1], color: PLAYER_COLORS[0] }, // Red
        { cell: gridInfo.cells[(1 * GRID) + (GRID - 2)], color: PLAYER_COLORS[1] }, // Green
        { cell: gridInfo.cells[((GRID - 2) * GRID) + (GRID - 2)], color: PLAYER_COLORS[2] }, // Yellow
        { cell: gridInfo.cells[((GRID - 2) * GRID) + 1], color: PLAYER_COLORS[3] }  // Blue
    ];
    corners.forEach((corner) => {
        const grad = ctx.createLinearGradient(
            corner.cell.x - hs / 2, corner.cell.y - hs / 2,
            corner.cell.x + hs / 2, corner.cell.y + hs / 2
        );
        grad.addColorStop(0, corner.color);
        grad.addColorStop(1, '#fff');
        ctx.fillStyle = grad;
        roundRect(ctx, corner.cell.x - gridInfo.s * 3, corner.cell.y - gridInfo.s * 3, hs, hs, 10, true, false);
    });

    // Goal paths (Ludo King style)
    const pathLen = 6;
    const goalPaths = [
        { color: PLAYER_COLORS[0], dir: 'down', start: { r: 6, c: 1 } }, // Red
        { color: PLAYER_COLORS[1], dir: 'left', start: { r: 1, c: 8 } }, // Green
        { color: PLAYER_COLORS[2], dir: 'up', start: { r: 8, c: 13 } }, // Yellow
        { color: PLAYER_COLORS[3], dir: 'right', start: { r: 13, c: 6 } } // Blue
    ];
    goalPaths.forEach(gp => {
        for (let i = 0; i < pathLen; i++) {
            let r = gp.start.r;
            let c = gp.start.c;
            if (gp.dir === 'down') r += i;
            if (gp.dir === 'up') r -= i;
            if (gp.dir === 'left') c -= i;
            if (gp.dir === 'right') c += i;
            const idx = r * GRID + c;
            const cell = gridInfo.cells[idx];
            ctx.fillStyle = gp.color;
            ctx.fillRect(cell.x - gridInfo.s / 2 + 2, cell.y - gridInfo.s / 2 + 2, gridInfo.s - 4, gridInfo.s - 4);
            ctx.strokeStyle = '#fff';
            ctx.strokeRect(cell.x - gridInfo.s / 2 + 2, cell.y - gridInfo.s / 2 + 2, gridInfo.s - 4, gridInfo.s - 4);
        }
    });

    // Center home triangles
    const center = { x: w / 2, y: w / 2 };
    const triSize = gridInfo.s * 3;
    const centerColors = [PLAYER_COLORS[0], PLAYER_COLORS[1], PLAYER_COLORS[2], PLAYER_COLORS[3]];
    const angles = [-Math.PI / 2, 0, Math.PI / 2, Math.PI];
    for (let i = 0; i < 4; i++) {
        ctx.beginPath();
        ctx.moveTo(center.x, center.y);
        ctx.lineTo(center.x + Math.cos(angles[i]) * triSize, center.y + Math.sin(angles[i]) * triSize);
        ctx.lineTo(center.x + Math.cos(angles[i] + Math.PI / 2) * triSize, center.y + Math.sin(angles[i] + Math.PI / 2) * triSize);
        ctx.closePath();
        ctx.fillStyle = centerColors[i];
        ctx.fill();
        ctx.strokeStyle = '#fff';
        ctx.stroke();
    }

    // Safe zone indexes (accurate Ludo King)
    const safeCells = [0, 8, 13, 21, 26, 34, 39, 47];

    // Draw main track + safe zones
    for (let i = 0; i < trackMap.length; i++) {
        const idx = trackMap[i];
        const cell = gridInfo.cells[idx];
        ctx.fillStyle = '#ffffff';
        roundRect(ctx, cell.x - gridInfo.s / 2 + 6, cell.y - gridInfo.s / 2 + 6, gridInfo.s - 12, gridInfo.s - 12, 6, true, false);
        ctx.strokeStyle = '#ccc';
        ctx.stroke();

        if (safeCells.includes(i)) {
            drawStar(ctx, cell.x, cell.y, gridInfo.s / 3, '#f4c542');
        }
    }

    // Draw pieces
    for (const p of state.players) {
        p.pieces.forEach((pos, i) => {
            let xy = posToXY(pos, gridInfo);
            if (pos === -1) {
                const baseCenters = [
                    { x: corners[p.id].cell.x - gridInfo.s, y: corners[p.id].cell.y - gridInfo.s },
                    { x: corners[p.id].cell.x + gridInfo.s, y: corners[p.id].cell.y - gridInfo.s },
                    { x: corners[p.id].cell.x - gridInfo.s, y: corners[p.id].cell.y + gridInfo.s },
                    { x: corners[p.id].cell.x + gridInfo.s, y: corners[p.id].cell.y + gridInfo.s }
                ];
                xy = baseCenters[i];
            }
            if (!xy) return;
            drawPiece(xy.x, xy.y, Math.floor(gridInfo.s / 2.2), p.color, `${p.id}-${i}`);
        });
    }

    // Highlight current player's turn
    const current = state.players[state.turn];
    ctx.fillStyle = current.color + '22';
    ctx.fillRect(0, 0, w, 40);
}

// Rounded rectangle helper
function roundRect(ctx, x, y, w, h, r, fill, stroke) {
    if (typeof r === 'undefined') r = 5;
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
    if (fill) ctx.fill();
    if (stroke) ctx.stroke();
}

// Draw glossy piece
function drawPiece(x, y, r, color, id) {
    // Outer glossy gradient
    const grad = ctx.createRadialGradient(x - r / 3, y - r / 3, r / 5, x, y, r);
    grad.addColorStop(0, lightenColor(color, 0.4));
    grad.addColorStop(1, color);
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();

    // White inner circle
    ctx.beginPath();
    ctx.arc(x, y, r / 2.8, 0, Math.PI * 2);
    ctx.fillStyle = '#fff';
    ctx.fill();

    // Piece number
    ctx.fillStyle = '#000';
    ctx.font = `${Math.max(10, Math.floor(r / 3))}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(id.split('-')[1], x, y);
}

// Draw star for safe zones
function drawStar(ctx, cx, cy, size, color) {
    let outerRadius = size;
    let innerRadius = size / 2;
    let rot = Math.PI / 2 * 3;
    let step = Math.PI / 5;
    ctx.beginPath();
    ctx.moveTo(cx, cy - outerRadius);
    for (let i = 0; i < 5; i++) {
        ctx.lineTo(cx + Math.cos(rot) * outerRadius, cy + Math.sin(rot) * outerRadius);
        rot += step;
        ctx.lineTo(cx + Math.cos(rot) * innerRadius, cy + Math.sin(rot) * innerRadius);
        rot += step;
    }
    ctx.lineTo(cx, cy - outerRadius);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
}

// Lighten color
function lightenColor(color, percent) {
    const num = parseInt(color.replace("#", ""), 16);
    let r = (num >> 16) + Math.floor(255 * percent);
    let g = ((num >> 8) & 0x00FF) + Math.floor(255 * percent);
    let b = (num & 0x0000FF) + Math.floor(255 * percent);
    r = (r < 255) ? r : 255;
    g = (g < 255) ? g : 255;
    b = (b < 255) ? b : 255;
    return `rgb(${r},${g},${b})`;
            }


  // game mechanics helpers
  function rollDice(){
    const val = Math.floor(Math.random()*6)+1;
    state.dice = val;
    state.diceRolled = true;
    diceValEl.textContent = val;
    hint.textContent = `Player ${PLAYER_NAMES[state.turn]} rolled ${val}. Tap piece to move.`;
    draw();
  }

  function updatePlayersInfo(){
    playersInfo.innerHTML = '';
    for(let i=0;i<numPlayers;i++){
      const p = state.players[i];
      const el = document.createElement('div');
      el.style.flex='1';
      el.style.textAlign='center';
      el.innerHTML = `<div style="font-weight:700;color:${p.color}">${p.name}</div><div style="font-size:12px;color:var(--muted)">Finished: ${p.finished}</div>`;
      if(i===state.turn) el.style.borderBottom = `3px solid ${p.color}`;
      playersInfo.appendChild(el);
    }
  }

  // move piece with rules (simplified):
  // - pieces[] stores positions: -1 home; 0..51 main loop; 52..57 goal encoded as 52 + player*6 + step
  // - entry to main track: for player 0 start at index 0; player1 at 13; player2 at 26; player3 at 39
  const startIndex = [0,13,26,39];

  function canMovePiece(player, pieceIndex, dice){
    const pos = player.pieces[pieceIndex];
    if(pos === 99) return false; // already finished
    if(pos === -1){
      return dice === 6; // can only move out on 6
    }
    // if on main track
    if(pos >=0 && pos <52){
      // compute target
      const target = (pos + dice) % 52;
      // if will enter goal path?
      const distanceToHome = (startIndex[player.id] - pos + 52) % 52;
      if(dice > distanceToHome){
        // allow entering goal path: step = dice - distanceToHome -1
        const step = dice - distanceToHome -1;
        if(step > 5) return false; // cannot jump past finish
        return true;
      }
      return true;
    }
    // goal path:
    if(pos >=52){
      const off = pos - 52;
      const pl = Math.floor(off/6);
      const step = off % 6;
      if(pl !== player.id) return false;
      if(step + dice <= 5) return true;
      return false;
    }
    return false;
  }

  function movePiece(player, pieceIndex, dice){
    const pos = player.pieces[pieceIndex];
    if(pos === -1 && dice === 6){
      // move to entry
      player.pieces[pieceIndex] = startIndex[player.id];
    } else if(pos >=0 && pos <52){
      const distanceToHome = (startIndex[player.id] - pos + 52) % 52;
      if(dice > distanceToHome){
        // enter goal path
        const step = dice - distanceToHome -1;
        player.pieces[pieceIndex] = 52 + player.id*6 + step;
        if(step === 5){
          player.pieces[pieceIndex] = 99; // finished
          player.finished++;
        }
      } else {
        player.pieces[pieceIndex] = (pos + dice) % 52;
      }
    } else if(pos >=52){
      const off = pos - 52;
      const pl = Math.floor(off/6);
      const step = off % 6;
      if(step + dice === 5){
        player.pieces[pieceIndex] = 99;
        player.finished++;
      } else {
        player.pieces[pieceIndex] = 52 + pl*6 + (step + dice);
      }
    }
    // check collision on main track
    if(player.pieces[pieceIndex] >=0 && player.pieces[pieceIndex] <52){
      const newPos = player.pieces[pieceIndex];
      for(const other of state.players){
        if(other.id === player.id) continue;
        for(let i=0;i<other.pieces.length;i++){
          if(other.pieces[i] === newPos){
            // send back to home
            other.pieces[i] = -1;
          }
        }
      }
    }
    // check if player finished all pieces
    if(player.finished === 4){
      state.winner = player.id;
      showModal(`${player.name} wins!`, `Player ${player.name} has moved all pieces to the finish.`);
    }
    state.diceRolled = false;
    state.dice = null;
    diceValEl.textContent = '-';
    // if rolled 6, same player plays again except if they just finished? We'll grant extra turn on 6
    if(dice === 6 && state.winner === null){
      hint.textContent = `${player.name} rolled 6 — roll again or move another piece.`;
    } else {
      // next player
      state.turn = (state.turn + 1) % numPlayers;
      updatePlayersInfo();
    }
    draw();
  }

  // show modal
  function showModal(title, body){
    modalTitle.textContent = title;
    modalBody.textContent = body;
    modal.classList.remove('hidden');
  }
  modalClose.addEventListener('click', ()=> modal.classList.add('hidden'));
  modal.addEventListener('click', (e)=>{ if(e.target===modal) modal.classList.add('hidden') });

  // handle canvas taps to select piece
  function handleTap(clientX, clientY){
    const rect = canvas.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    const w = canvas.width;
    const gridInfo = makeGridPositions(w);
    // check pieces of current player
    const player = state.players[state.turn];
    let moved = false;
    for(let i=0;i<player.pieces.length;i++){
      const pos = player.pieces[i];
      const xy = pos === -1 ? null : posToXY(pos, gridInfo);
      // home piece centers (recompute small home centers similar to draw)
      let homeCenters = [];
      const tl = gridInfo.cells[(1*GRID)+1];
      const tr = gridInfo.cells[(1*GRID)+(GRID-2)];
      const br = gridInfo.cells[((GRID-2)*GRID)+(GRID-2)];
      const bl = gridInfo.cells[((GRID-2)*GRID)+1];
      if(player.id === 0) homeCenters = [
        {x: tl.x - gridInfo.s, y: tl.y - gridInfo.s},
        {x: tl.x + gridInfo.s, y: tl.y - gridInfo.s},
        {x: tl.x - gridInfo.s, y: tl.y + gridInfo.s},
        {x: tl.x + gridInfo.s, y: tl.y + gridInfo.s}
      ];
      if(player.id === 1) homeCenters = [
        {x: tr.x - gridInfo.s, y: tr.y - gridInfo.s},
        {x: tr.x + gridInfo.s, y: tr.y - gridInfo.s},
        {x: tr.x - gridInfo.s, y: tr.y + gridInfo.s},
        {x: tr.x + gridInfo.s, y: tr.y + gridInfo.s}
      ];
      if(player.id === 2) homeCenters = [
        {x: br.x - gridInfo.s, y: br.y - gridInfo.s},
        {x: br.x + gridInfo.s, y: br.y - gridInfo.s},
        {x: br.x - gridInfo.s, y: br.y + gridInfo.s},
        {x: br.x + gridInfo.s, y: br.y + gridInfo.s}
      ];
      if(player.id === 3) homeCenters = [
        {x: bl.x - gridInfo.s, y: bl.y - gridInfo.s},
        {x: bl.x + gridInfo.s, y: bl.y - gridInfo.s},
        {x: bl.x - gridInfo.s, y: bl.y + gridInfo.s},
        {x: bl.x + gridInfo.s, y: bl.y + gridInfo.s}
      ];
      const center = pos === -1 ? homeCenters[i] : xy;
      if(!center) continue;
      const dx = x* (canvas.width / canvas.getBoundingClientRect().width) - center.x;
      const dy = y* (canvas.width / canvas.getBoundingClientRect().width) - center.y;
      const dist = Math.sqrt(dx*dx + dy*dy);
      if(dist < gridInfo.s/2.2){
        // tapped piece i
        if(!state.diceRolled){
          hint.textContent = 'Please roll dice first.';
          return;
        }
        if(!canMovePiece(player, i, state.dice)){
          hint.textContent = 'Cannot move that piece with current roll.';
          return;
        }
        movePiece(player, i, state.dice);
        moved = true;
        break;
      }
    }
    if(!moved){
      // maybe tapped to roll (if near dice area) — ignore
    }
  }

  // support touch events
  canvas.addEventListener('touchstart', (e)=> {
    const t = e.touches[0];
    handleTap(t.clientX, t.clientY);
    e.preventDefault();
  }, {passive:false});
  canvas.addEventListener('click', (e)=> handleTap(e.clientX, e.clientY));

  rollBtn.addEventListener('click', ()=> {
    rollDice();
    updatePlayersInfo();
  });

  // new game button
  document.getElementById('newGameBtn').addEventListener('click', ()=> {
    newGame();
  });

  // initial setup
  newGame();

})();
