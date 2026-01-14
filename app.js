"use strict";
(function(){
  const canvas = document.getElementById('canvas');
  const ctx = canvas.getContext('2d');
  const scoreEl = document.getElementById('score');
  const overlay = document.getElementById('overlay');
  const startBtn = document.getElementById('startBtn');
  const tapBtn = document.getElementById('tapBtn');
  const superBtn = document.getElementById('superBtn');
  const storageBtn = document.getElementById('storageBtn');
  const powersPanel = document.getElementById('powersPanel');
  const storagePanel = document.getElementById('storagePanel');
  const resultPanel = document.getElementById('resultPanel');
  const resultMenu = document.getElementById('resultMenu');
  const diamondsEl = document.getElementById('diamonds');

  let DPR = window.devicePixelRatio || 1;
  function resize(){
    DPR = window.devicePixelRatio || 1;
    // make canvas fill the viewport for a fullscreen feel
    const cssW = window.innerWidth;
    const cssH = window.innerHeight;
    canvas.style.width = cssW + 'px';
    canvas.style.height = cssH + 'px';
    canvas.width = Math.floor(cssW * DPR);
    canvas.height = Math.floor(cssH * DPR);
    ctx.setTransform(DPR,0,0,DPR,0,0);
  }
  window.addEventListener('resize', resize);
  resize();

  // Game state
  let running = false;
  let holding = false;
  let score = 0;

  const state = {
    bird: { x: 80, y: 200, r: 14, vy: 0 },
    pipes: [],
    spawnTimer: 0
    ,t: 0
  };

  // Tuned to make falling gentler and slower; match upward acceleration to falling
  const GRAVITY = 0.08; // downward acceleration when not holding (smaller = slower fall)
  const LIFT = GRAVITY; // match upward acceleration to the falling acceleration
  const FALL_DAMP = 0.99; // damping applied while falling to slow acceleration
  // difficulty-tuned runtime variables (changed by selected mode)
  let PIPE_SPEED = 2.6;
  let PIPE_INTERVAL = 1500; // ms
  let GAP_FACTOR = 0.22;

  // Superpowers definitions (from best -> worst-ish)
  const powers = [
    { id: 'legend', name: 'Legendary Boost', mult: 1.5, cap: 150, price: 120, desc: 'Best boost — more diamonds (cap 150)' },
    { id: 'great', name: 'Great Aid', mult: 1.3, cap: 130, price: 90, desc: 'Strong boost (cap 130)' },
    { id: 'normal', name: 'Normal', mult: 1.0, cap: 100, price: 0, desc: 'Balanced (cap 100) — free' },
    { id: 'helpful', name: 'Helpful Charm', mult: 0.85, cap: 80, price: 60, desc: 'Slightly worse (cap 80)' },
    { id: 'quirky', name: 'Quirky Trinket', mult: 0.6, cap: 50, price: 30, desc: 'Least boost (cap 50)' }
  ];
  let selectedPowerIdx = 2; // default to 'Normal'
  // persistent resources
  const STORAGE_KEY = 'mrfb_state_v1';
  let diamonds = 0;
  let owned = new Set();
  let bestScore = 0;

  const bestEl = document.getElementById('best');
  const powerNameEl = document.getElementById('powerName');
  const powerCapEl = document.getElementById('powerCap');

  function updateBestUI(){ if(bestEl) bestEl.textContent = String(bestScore); }
  function updatePowerUI(){
    const pw = powers[selectedPowerIdx] || powers[2];
    if(powerNameEl) powerNameEl.textContent = pw.name;
    if(powerCapEl) powerCapEl.textContent = String(pw.cap);
  }

  function loadState(){
    try{
      const raw = localStorage.getItem(STORAGE_KEY);
      if(raw){
        const obj = JSON.parse(raw);
        diamonds = Number(obj.diamonds||0);
        owned = new Set(obj.owned||[]);
        // load best score if present
        if(typeof obj.best === 'number' || typeof obj.best === 'string') bestScore = Number(obj.best||0);
      }
    }catch(e){ diamonds = 0; owned = new Set(); }
    // ensure 'normal' is always available
    if(!owned.has('normal')) owned.add('normal');
    updateDiamondsUI();
    updateBestUI();
    updatePowerUI();
  }
  function updateDiamondsUI(){
    if(diamondsEl) diamondsEl.textContent = String(diamonds);
    if(storageBtn) storageBtn.textContent = `Storage (${diamonds}♦)`;
  }
  function saveState(){
    const obj = { diamonds: diamonds, owned: Array.from(owned), best: bestScore };
    try{ localStorage.setItem(STORAGE_KEY, JSON.stringify(obj)); }catch(e){}
  }
  loadState();

  // Difficulty modes
  const modes = [
    { id: 'easy', name: 'Easy', speed: 1.8, interval: 1800, gap: 0.28 },
    { id: 'medium', name: 'Medium', speed: 2.6, interval: 1500, gap: 0.22 },
    { id: 'hard', name: 'Hard', speed: 3.4, interval: 1200, gap: 0.18 },
    { id: 'veryhard', name: 'Very Hard', speed: 4.2, interval: 1000, gap: 0.16 }
  ];
  let selectedMode = 'medium';

  const modeBtn = document.getElementById('modeBtn');
  const modePanel = document.getElementById('modePanel');

  function applyMode(id){
    const m = modes.find(x=>x.id===id) || modes[1];
    selectedMode = m.id;
    PIPE_SPEED = m.speed;
    PIPE_INTERVAL = m.interval;
    GAP_FACTOR = m.gap;
    if(modeBtn) modeBtn.textContent = `Mode: ${m.name}`;
  }
  applyMode(selectedMode);

  function renderModePanel(){
    modePanel.innerHTML = '';
    modes.forEach(m=>{
      const div = document.createElement('div'); div.className='mode';
      const left = document.createElement('div'); left.textContent = m.name;
      const btn = document.createElement('button'); btn.textContent = (m.id===selectedMode)?'Selected':'Choose';
      btn.addEventListener('click', ()=>{ applyMode(m.id); renderModePanel(); modePanel.classList.add('hidden'); });
      div.appendChild(left); div.appendChild(btn); modePanel.appendChild(div);
    });
  }
  renderModePanel();

  if(modeBtn){
    modeBtn.addEventListener('click', e=>{ e.stopPropagation(); modePanel.classList.toggle('hidden'); });
    modePanel.addEventListener('pointerdown', e=>{ e.stopPropagation(); });
  }

  // Fullscreen support
  const fsBtn = document.getElementById('fsBtn');
  function updateFullscreenButton(){
    if(!fsBtn) return;
    fsBtn.textContent = document.fullscreenElement ? '⤢' : '⤢';
  }
  if(fsBtn){
    fsBtn.addEventListener('click', e=>{
      e.stopPropagation();
      if(!document.fullscreenElement){
        // request fullscreen on root so controls remain visible
        document.documentElement.requestFullscreen?.();
      } else {
        document.exitFullscreen?.();
      }
    });
  }
  document.addEventListener('fullscreenchange', ()=>{
    updateFullscreenButton();
    // hide scrollbars while fullscreen
    document.body.style.overflow = document.fullscreenElement ? 'hidden' : '';
    // recompute sizing
    resize();
  });
  // keyboard shortcut: F toggles fullscreen
  window.addEventListener('keydown', e=>{ if(e.key === 'f' || e.key === 'F') { e.preventDefault(); fsBtn && fsBtn.click(); } });

  function startGame(){
    state.bird.x = 80;
    state.bird.y = (canvas.clientHeight||480)/2;
    state.bird.vy = 0;
    state.pipes = [];
    state.spawnTimer = 0;
    state.t = 0;
    score = 0;
    scoreEl.textContent = score;
    // ensure selected power exists (normal free)
    if(!owned.has(powers[selectedPowerIdx].id) && powers[selectedPowerIdx].price>0){
      // fallback to Normal if selected isn't owned
      selectedPowerIdx = powers.findIndex(p=>p.id==='normal');
    }
    running = true;
    overlay.style.display = 'none';
    // ensure overlay text and start button label are reset for next game
    const hdr = overlay.querySelector('.menu h1');
    if(hdr) hdr.textContent = 'Mr Flappy Bird';
    startBtn.textContent = 'Start';
    // hide result panel if visible
    resultPanel.classList.add('hidden');
    lastTime = performance.now();
    requestAnimationFrame(loop);
  }

  function endGame(){
    running = false;
    // compute diamonds based on selected power
    const p = powers[selectedPowerIdx];
    const diamondsEarned = Math.min(Math.round(score * p.mult), p.cap);
    // add to persistent diamonds and save
    diamonds += diamondsEarned;
    // update best score if needed
    if(score > bestScore){ bestScore = score; }
    saveState();
    updateDiamondsUI();
    updateBestUI();
    // show the main overlay (Start button) and display results there
    const hdr = overlay.querySelector('.menu h1');
    const info = overlay.querySelector('.menu p');
    if(hdr) hdr.textContent = 'Game Over';
    if(info) info.innerHTML = `Score: <strong>${score}</strong><br>You earned <strong>${diamondsEarned}</strong> diamonds (${p.name})`;
    startBtn.textContent = 'Restart';
    overlay.style.display = 'flex';
  }

  function spawnPipe(){
    const h = canvas.clientHeight || 640;
    const gap = Math.max(90, Math.floor(h * GAP_FACTOR));
    const topMin = 30;
    const topMax = h - gap - 30;
    // amplitude of oscillation for the spike edge
    const amp = Math.floor(8 + Math.random() * 48);
    // choose a baseTop that leaves room for the oscillation amplitude
    const baseTop = Math.floor(topMin + amp + Math.random() * Math.max(1, topMax - topMin - amp*2));
    const freq = 0.4 + Math.random() * 1.0; // oscillation speed
    const phase = Math.random() * Math.PI * 2;
    const vDrift = (Math.random() - 0.5) * 12; // small px/sec vertical drift
    state.pipes.push({ x: (canvas.clientWidth||480) + 20, baseTop, top: baseTop, gap, amp, freq, phase, vDrift, passed:false });
  }

  // Powers panel rendering
  function renderPowersPanel(){
    powersPanel.innerHTML = '';
    powers.forEach((pw, i)=>{
      const div = document.createElement('div');
      div.className = 'power';
      const left = document.createElement('div');
      left.innerHTML = `<strong>${pw.name}</strong><div style=\"font-size:12px;color:#456\">${pw.desc}</div><div style=\"font-size:12px;color:#456\">Price: ${pw.price} ♦</div>`;
      const right = document.createElement('div');
      // buy/select logic
      if(pw.price > 0 && !owned.has(pw.id)){
        const buy = document.createElement('button');
        buy.textContent = `Buy ${pw.price}♦`;
        buy.addEventListener('click', ()=>{
          if(diamonds >= pw.price){
            diamonds -= pw.price;
            owned.add(pw.id);
            saveState();
            updateDiamondsUI();
            renderPowersPanel();
            // ensure the purchased item appears in storage and open storage
            renderStoragePanel();
            storagePanel.classList.remove('hidden');
          } else {
            buy.textContent = 'Not enough';
            setTimeout(()=>{ buy.textContent = `Buy ${pw.price}♦` }, 900);
          }
        });
        right.appendChild(buy);
      } else {
        const select = document.createElement('button');
        select.textContent = (i===selectedPowerIdx)?'Selected':'Select';
        select.addEventListener('click', ()=>{ selectedPowerIdx = i; superBtn.title = pw.name; renderPowersPanel(); powersPanel.classList.add('hidden'); updatePowerUI(); });
        right.appendChild(select);
      }
      div.appendChild(left);
      div.appendChild(right);
      powersPanel.appendChild(div);
    });
  }
  renderPowersPanel();

  // toggle panel
  superBtn.title = powers[selectedPowerIdx].name;
  superBtn.addEventListener('click', (e)=>{ e.stopPropagation(); powersPanel.classList.toggle('hidden'); });
  // prevent clicks inside storagePanel from closing it
  storagePanel.addEventListener('pointerdown', e=>{ e.stopPropagation(); });
  // prevent clicks inside panel from closing it
  powersPanel.addEventListener('pointerdown', e=>{ e.stopPropagation(); });
  // hide panel when clicking outside
  window.addEventListener('pointerdown', ()=>{ if(!powersPanel.classList.contains('hidden')) powersPanel.classList.add('hidden'); if(!storagePanel.classList.contains('hidden')) storagePanel.classList.add('hidden'); if(!modePanel.classList.contains('hidden')) modePanel.classList.add('hidden'); });

  // Result panel delegated handler (handles Restart click reliably)
  resultPanel.addEventListener('click', (e)=>{
    const t = e.target;
    if(t && t.id === 'restartBtn'){
      resultPanel.classList.add('hidden');
      // small timeout so UI updates before starting
      setTimeout(()=>startGame(), 10);
    }
  });

  // Storage panel render
  function renderStoragePanel(){
    storagePanel.innerHTML = '';
    // quick action to open the main powers list
    const browse = document.createElement('div');
    browse.style.marginBottom = '8px';
    const browseBtn = document.createElement('button');
    browseBtn.textContent = 'Browse Superpowers';
    browseBtn.addEventListener('click', ()=>{ powersPanel.classList.remove('hidden'); storagePanel.classList.add('hidden'); });
    browse.appendChild(browseBtn);
    storagePanel.appendChild(browse);
    const title = document.createElement('div');
    title.style.fontWeight = '700';
    title.style.marginBottom = '6px';
    title.textContent = 'Storage';
    storagePanel.appendChild(title);
    const ownedList = Array.from(owned).map(id=>powers.find(p=>p.id===id)).filter(Boolean);
    if(ownedList.length===0){
      const empty = document.createElement('div'); empty.textContent = 'No items'; storagePanel.appendChild(empty);
    }
    ownedList.forEach(pw=>{
      const div = document.createElement('div'); div.className='power';
      const left = document.createElement('div'); left.innerHTML=`<strong>${pw.name}</strong><div style=\"font-size:12px;color:#456\">${pw.desc}</div>`;
      const btn = document.createElement('button'); btn.textContent = (powers[selectedPowerIdx].id===pw.id)?'Equipped':'Equip';
      btn.addEventListener('click', ()=>{ selectedPowerIdx = powers.findIndex(x=>x.id===pw.id); renderStoragePanel(); storagePanel.classList.add('hidden'); updatePowerUI(); });
      div.appendChild(left); div.appendChild(btn); storagePanel.appendChild(div);
    });
  }
  renderStoragePanel();

  storageBtn.addEventListener('click', (e)=>{ e.stopPropagation(); renderStoragePanel(); storagePanel.classList.toggle('hidden'); });
  storagePanel.addEventListener('pointerdown', e=>{ e.stopPropagation(); });

  function update(dt){
    const cw = canvas.clientWidth || 480;
    const ch = canvas.clientHeight || 640;
    const bird = state.bird;

    // advance time (seconds)
    state.t += dt/1000;

    if(holding){
      bird.vy -= LIFT;
    } else {
      bird.vy += GRAVITY;
      // damping to reduce acceleration while falling
      bird.vy *= FALL_DAMP;
    }
    // limit vertical speed so movement feels less twitchy
    bird.vy = Math.max(Math.min(bird.vy, 6), -6);
    bird.y += bird.vy;

    // spawn pipes
    state.spawnTimer += dt;
    if(state.spawnTimer > PIPE_INTERVAL){ state.spawnTimer = 0; spawnPipe(); }

    // move pipes and animate their vertical position (oscillation + drift)
    for(let p of state.pipes){
      p.x -= PIPE_SPEED;
      p.baseTop += p.vDrift * (dt/1000);
      // recompute top position with sine oscillation
      p.top = p.baseTop + Math.sin(state.t * p.freq + p.phase) * p.amp;
      // clamp baseTop so gap stays on screen
      const minBase = 8 + p.amp;
      const maxBase = ch - p.gap - 8 - p.amp;
      if(p.baseTop < minBase) p.baseTop = minBase;
      if(p.baseTop > maxBase) p.baseTop = maxBase;
    }
    // remove offscreen
    state.pipes = state.pipes.filter(p=>p.x > -60);

    // scoring
    for(let p of state.pipes){
      if(!p.passed && p.x + 40 < bird.x - bird.r){ p.passed = true; score++; scoreEl.textContent = score; }
    }

    // collisions: top/bottom screen
    if(bird.y - bird.r < 0 || bird.y + bird.r > ch){ endGame(); }
    // collisions with spikes only (spikes anchored to top and bottom)
    for(let p of state.pipes){
      const pw = 52;
      const bx = bird.x;
      const by = bird.y;
      if(bx + bird.r > p.x && bx - bird.r < p.x + pw){
        const topDepth = p.top; // depth of top spikes from y=0
        const bottomApexY = p.top + p.gap; // y where bottom spikes reach up to
        if(by - bird.r < topDepth) { endGame(); }
        if(by + bird.r > bottomApexY) { endGame(); }
      }
    }
  }

  function draw(){
    const cw = canvas.clientWidth || 480;
    const ch = canvas.clientHeight || 640;
    ctx.clearRect(0,0,cw,ch);

    // ground
    ctx.fillStyle = '#dff3ff';
    ctx.fillRect(0, ch - 30, cw, 30);

    // pipes
    for(let p of state.pipes){
      drawPipe(p);
    }

    // bird
    drawBird(state.bird);
  }

  function drawPipe(p){
    const pw = 52;
    // draw spikes anchored to top (base at y=0) and bottom (base at y=ch)
    ctx.fillStyle = '#235e42';
    const spikeSize = 14;
    const topDepth = (typeof p.top === 'number') ? p.top : (p.baseTop || 0);
    const bottomApexY = topDepth + p.gap;
    const ch = canvas.clientHeight || 640;
    for(let sx = 0; sx < pw; sx += spikeSize){
      // top spikes: base along y=0, apex at topDepth
      ctx.beginPath();
      ctx.moveTo(p.x + sx, 0);
      ctx.lineTo(p.x + sx + spikeSize/2, topDepth);
      ctx.lineTo(p.x + sx + spikeSize, 0);
      ctx.closePath();
      ctx.fill();
      // bottom spikes: base along y=ch, apex at bottomApexY
      ctx.beginPath();
      ctx.moveTo(p.x + sx, ch);
      ctx.lineTo(p.x + sx + spikeSize/2, bottomApexY);
      ctx.lineTo(p.x + sx + spikeSize, ch);
      ctx.closePath();
      ctx.fill();
    }
  }

  function drawBird(b){
    // Draw an alien in an open-top spaceship centered at b.x,b.y
    ctx.save();
    ctx.translate(b.x, b.y);
    // spaceship base (saucer)
    ctx.fillStyle = '#9aa0a6';
    ctx.beginPath();
    ctx.ellipse(0, 4, b.r*1.6, b.r*0.9, 0, 0, Math.PI*2);
    ctx.fill();
    // rim highlight
    ctx.fillStyle = '#c8cdd0';
    ctx.beginPath();
    ctx.ellipse(0, 2, b.r*1.2, b.r*0.5, 0, 0, Math.PI*2);
    ctx.fill();
    // cockpit (open) - simple inner shadow
    ctx.fillStyle = 'rgba(0,0,0,0.12)';
    ctx.beginPath();
    ctx.ellipse(0, -2, b.r*0.9, b.r*0.6, 0, 0, Math.PI*2);
    ctx.fill();

    // alien head (peeks out of open top)
    ctx.fillStyle = '#6ee06e';
    ctx.beginPath(); ctx.arc(0, -6, b.r*0.6, 0, Math.PI*2); ctx.fill();
    // alien eyes
    ctx.fillStyle = '#072';
    ctx.beginPath(); ctx.ellipse(-3, -7, 1.6, 2.6, 0, 0, Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(3, -7, 1.6, 2.6, 0, 0, Math.PI*2); ctx.fill();
    // little antenna
    ctx.strokeStyle = '#6ee06e'; ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.moveTo(0, -10); ctx.lineTo(0, -14); ctx.stroke();
    ctx.fillStyle = '#6ee06e'; ctx.beginPath(); ctx.arc(0, -15, 2, 0, Math.PI*2); ctx.fill();

    ctx.restore();
  }

  // game loop
  let lastTime = performance.now();
  function loop(now){
    if(!running) return;
    const dt = now - lastTime;
    lastTime = now;
    update(dt);
    draw();
    requestAnimationFrame(loop);
  }

  // Inputs
  window.addEventListener('keydown', e=>{
    if(e.code === 'Space' || e.code === 'ArrowUp'){ e.preventDefault(); holding = true; }
  });
  window.addEventListener('keyup', e=>{ if(e.code === 'Space' || e.code === 'ArrowUp'){ holding = false; } });

  // pointer for desktop
  canvas.addEventListener('pointerdown', ()=>{ holding = true; });
  window.addEventListener('pointerup', ()=>{ holding = false; });

  // touch events
  window.addEventListener('touchstart', e=>{ holding = true; }, {passive:false});
  window.addEventListener('touchend', e=>{ holding = false; });

  // touch button
  tapBtn.addEventListener('pointerdown', e=>{ e.preventDefault(); holding = true; });
  tapBtn.addEventListener('pointerup', ()=>{ holding = false; });
  tapBtn.addEventListener('pointercancel', ()=>{ holding = false; });

  startBtn.addEventListener('click', startGame);

  // Prevent scrolling when holding space on page
  window.addEventListener('keydown', function(e){ if(e.code === 'Space') e.preventDefault(); });

  // initial draw
  draw();
  overlay.style.display = 'flex';
})();
