import { Simulation, WIDTH, HEIGHT } from './engine.js';

const $ = selector => document.querySelector(selector);
const $$ = selector => [...document.querySelectorAll(selector)];
const STORAGE = 'behavioursim.prototype.v1';
const canvas = $('#scene');
const ctx = canvas.getContext('2d', { alpha: false });
const trend = $('#rewardChart');
let paused = false;
let rate = 1;
let selectedTool = null;
let saved = null;
try {
  const raw = localStorage.getItem(STORAGE);
  if (raw) {
    const data = JSON.parse(raw);
    if (data.version === 1) saved = data;
  }
} catch (error) { console.warn('Saved experience could not be loaded:', error); }
let toastTimer = null;
let sim = new Simulation(saved, message => showToast(message));
let last = performance.now();
let accumulator = 0;
let uiElapsed = 0;
let saveElapsed = 0;
const STEP = 1 / 30;

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[c]);
}

function showToast(message) {
  const el = $('#eventToast');
  el.textContent = message;
  el.classList.add('visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('visible'), 3500);
}

function formatTime(secs) {
  const day = Math.floor(secs / 180) + 1;
  const minute = Math.floor(secs % 180 / 3);
  return 'DAY ' + String(day).padStart(2, '0') + '  ·  ' +
    String(6 + Math.floor(minute / 60)).padStart(2, '0') + ':' +
    String(minute % 60).padStart(2, '0');
}

function setMeter(key, value) {
  const percent = Math.round(value);
  const bar = $('#' + key + 'Bar');
  const val = $('#' + key + 'Value');
  if (bar) bar.style.width = percent + '%';
  if (val) val.textContent = percent + '%';
}

function renderTrend() {
  const c = trend.getContext('2d');
  const w = trend.width, h = trend.height;
  c.clearRect(0, 0, w, h);
  c.strokeStyle = '#344845'; c.lineWidth = 1;
  c.beginPath(); c.moveTo(0, h / 2); c.lineTo(w, h / 2); c.stroke();
  const rewards = sim.brain.events.slice(0, 34).map(e => e.reward).reverse();
  if (rewards.length < 2) return;
  c.strokeStyle = '#afc38e'; c.lineWidth = 2;
  c.beginPath();
  rewards.forEach((r, i) => {
    const x = i * (w - 5) / (Math.max(34, rewards.length - 1));
    const y = h / 2 - r / 8 * (h / 2 - 7);
    if (i === 0) c.moveTo(x, y); else c.lineTo(x, y);
  });
  c.stroke();
  c.fillStyle = '#c9d8a2';
  const last = rewards.at(-1), x = (rewards.length - 1) * (w - 5) / Math.max(34, rewards.length - 1);
  c.fillRect(x - 2, h / 2 - last / 8 * (h / 2 - 7) - 2, 4, 4);
}

function renderKnowledge() {
  const root = $('#concepts');
  if (!sim.brain.categories.length) {
    root.innerHTML = '<p class="empty">No visual concepts formed yet. The creature is still exploring.</p>';
    return;
  }
  const categories = [...sim.brain.categories].sort((a, b) => b.encounters - a.encounters);
  root.innerHTML = categories.map(c => {
    const best = Object.entries(c.q).sort((a, b) => b[1] - a[1])[0];
    const cls = c.liking > 0.6 ? 'positive' : c.liking < -0.5 ? 'negative' : 'neutral';
    return '<div class="concept-row">' +
      '<span class="concept-icon" aria-hidden="true">' + (c.fear > 1.2 ? '!' : c.liking > 0.5 ? '♥' : '◇') + '</span>' +
      '<div class="concept-info"><strong>' + escapeHtml(c.label) + '</strong>' +
      '<small>' + c.encounters + ' experiments · ' + (best ? 'prefers ' + escapeHtml(best[0]) : 'still unfamiliar') + '</small></div>' +
      '<span class="concept-valence ' + cls + '">' + (c.liking > 0 ? '+' : '') + c.liking.toFixed(1) + '</span>' +
      '</div>';
  }).join('');
}

function renderSelected() {
  const o = sim.selected;
  const root = $('#selectedDetails');
  if (!o || !o.alive) {
    root.innerHTML = '<div class="empty-selection"><span class="scan-symbol">⌖</span><p>Select an object in the world to compare physical truth with what the creature has learned.</p></div>';
    $$('.suggest-btn').forEach(b => b.disabled = true);
    return;
  }
  $$('.suggest-btn').forEach(b => b.disabled = false);
  const c = sim.brain.findFor(o);
  const title = c?.label || 'Not yet perceived';
  const q = c ? Object.entries(c.q).sort((a, b) => b[1] - a[1]) : [];
  root.innerHTML =
    '<div class="object-heading"><span class="tiny-kicker">SELECTED OBJECT</span><strong>' + escapeHtml(title) + '</strong>' +
    '<small>World truth: ' + escapeHtml(o.kind) + ' · not exposed to its brain</small></div>' +
    '<div class="property-grid"><div><span>Encounters</span><strong>' + (c?.encounters || '0') + '</strong></div>' +
    '<div><span>Feeling</span><strong>' + (c ? (c.liking >= 0 ? '+' : '') + c.liking.toFixed(1) : 'Unknown') + '</strong></div>' +
    '<div><span>Fear</span><strong>' + (c?.fear?.toFixed(1) || '0.0') + '</strong></div>' +
    '<div><span>Surprise</span><strong>' + (sim.brain.lastPrediction >= 0 ? '+' : '') + sim.brain.lastPrediction.toFixed(1) + '</strong></div></div>' +
    '<div class="learned-heading">Learned action values</div>' +
    (q.length ? q.map(([name, value]) =>
      '<div class="q-row"><span>' + escapeHtml(name) + '</span><div class="q-track"><i style="width:' +
      Math.min(100, Math.abs(value) / 8 * 100).toFixed(0) + '%;background:' +
      (value >= 0 ? '#9fb88b' : '#c28a79') + '"></i></div><em>' +
      (value > 0 ? '+' : '') + value.toFixed(1) + '</em></div>').join('') :
      '<p class="empty">No outcomes learned for this visual form yet.</p>');
}

function renderMemories() {
  const root = $('#memories');
  if (!sim.brain.events.length) {
    root.innerHTML = '<p class="empty">Experiences will appear here as they happen. Memory survives reloads.</p>';
    return;
  }
  root.innerHTML = sim.brain.events.slice(0, 6).map(e =>
    '<div class="memory-entry"><span class="memory-mark ' + (e.reward < 0 ? 'bad' : 'good') + '"></span>' +
    '<div><strong>' + escapeHtml(e.category) + ' · ' + escapeHtml(e.action) + '</strong>' +
    '<p>' + escapeHtml(e.message) + '</p></div><span class="memory-reward">' +
    (e.reward > 0 ? '+' : '') + e.reward.toFixed(1) + '</span></div>'
  ).join('');
}

function updateUI() {
  const p = sim.pet;
  $('#mood').textContent = sim.mood();
  $('#worldClock').textContent = formatTime(sim.time);
  $('#mind').textContent = sim.brain.thought;
  $('#currentActivity').textContent = p.energy < 13 ? 'Resting' :
    p.target ? p.target.action[0].toUpperCase() + p.target.action.slice(1) + ' / approaching' : 'Considering';
  $('#interactions').textContent = String(sim.brain.totalInteractions).padStart(2, '0');
  $('#categories').textContent = String(sim.brain.categories.length).padStart(2, '0');
  $('#surprise').textContent = (sim.brain.lastPrediction > 0 ? '+' : '') + sim.brain.lastPrediction.toFixed(1);
  $('#lifeStage').textContent = p.age < 75 ? 'Infant' : p.age < 300 ? 'Juvenile' : 'Explorer';
  setMeter('hunger', p.hunger);
  setMeter('energy', p.energy);
  setMeter('curiosity', p.curiosity);
  setMeter('stress', p.stress);
  renderKnowledge();
  renderSelected();
  renderMemories();
  renderTrend();
}

function persist() {
  try { localStorage.setItem(STORAGE, JSON.stringify(sim.save())); }
  catch (error) { console.warn('Save failed:', error); }
}

function tick(now) {
  const elapsed = Math.min(0.05, (now - last) / 1000);
  last = now;
  if (!paused) {
    accumulator += elapsed * rate;
    let steps = 0;
    while (accumulator >= STEP && steps++ < 20) {
      sim.step(STEP);
      accumulator -= STEP;
    }
    if (steps >= 20) accumulator = 0;
    uiElapsed += elapsed;
    saveElapsed += elapsed;
    if (saveElapsed >= 6) { persist(); saveElapsed = 0; }
  }
  sim.render(ctx);
  if (uiElapsed > 0.18) { updateUI(); uiElapsed = 0; }
  requestAnimationFrame(tick);
}

$('#pause').addEventListener('click', () => {
  paused = !paused;
  $('#pause').textContent = paused ? 'Resume' : 'Pause';
  $('#runIndicator').textContent = paused ? 'PAUSED' : 'AUTONOMOUS';
  $('#runDot').classList.toggle('paused', paused);
  if (paused) persist();
});
$$('[data-speed]').forEach(btn => btn.addEventListener('click', () => {
  rate = Number(btn.dataset.speed);
  $$('[data-speed]').forEach(b => b.classList.toggle('active', b === btn));
  showToast('Simulation speed: ' + rate + '×');
}));
$('#reset').addEventListener('click', () => {
  if (!confirm('Reset all learned associations and memories? This cannot be undone.')) return;
  localStorage.removeItem(STORAGE);
  sim = new Simulation(null, message => showToast(message));
  updateUI();
  showToast('A new life begins. Everything is unfamiliar again.');
});
$$('[data-spawn]').forEach(btn => btn.addEventListener('click', () => {
  const value = btn.dataset.spawn;
  selectedTool = selectedTool === value ? null : value;
  $$('[data-spawn]').forEach(b => b.classList.toggle('active', b.dataset.spawn === selectedTool));
  canvas.style.cursor = selectedTool ? 'crosshair' : 'pointer';
  $('#sceneHint').textContent = selectedTool ? 'Tap the landscape to place ' + selectedTool : 'Tap an object to inspect it';
}));
canvas.addEventListener('pointerdown', event => {
  const rect = canvas.getBoundingClientRect();
  const x = Math.round((event.clientX - rect.left) / rect.width * WIDTH);
  if (selectedTool) {
    sim.spawn(selectedTool, x);
    selectedTool = null;
    $$('[data-spawn]').forEach(b => b.classList.remove('active'));
    canvas.style.cursor = 'pointer';
    $('#sceneHint').textContent = 'Tap an object to inspect it';
  } else {
    const o = sim.select(x);
    if (o) showToast('Examining the ' + o.kind + ' — the pet only knows its appearance.');
  }
  updateUI();
});
$$('[data-suggest]').forEach(btn => btn.addEventListener('click', () => {
  const o = sim.selected;
  if (!o || !o.alive) return;
  sim.pet.target = { objectId: o.id, action: btn.dataset.suggest, expected: 0 };
  sim.pet.cooldown = 0;
  paused = false; $('#pause').textContent = 'Pause';
  $('#runIndicator').textContent = 'AUTONOMOUS';
  $('#runDot').classList.remove('paused');
  showToast('Suggested ' + btn.dataset.suggest + '. The pet will try it and learn.');
}));

window.addEventListener('pagehide', persist);
document.addEventListener('visibilitychange', () => { if (document.hidden) persist(); });
updateUI();
requestAnimationFrame(tick);
