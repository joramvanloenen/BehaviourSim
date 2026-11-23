// BehaviourSim — a tiny embodied, experience-driven learning system.
// No API keys, build chain, remote model, or object identity hints are required.
export const WIDTH = 480;
export const HEIGHT = 270;
const GROUND = 208;
const ACTIONS = ['observe', 'touch', 'push', 'bite', 'play'];
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const random = (a, b) => a + Math.random() * (b - a);
const pick = arr => arr[Math.floor(Math.random() * arr.length)];
const round = v => Math.round(v * 10) / 10;
let nextId = 1;

function fill(ctx, color, x, y, w, h) {
  ctx.fillStyle = color;
  ctx.fillRect(Math.round(x), Math.round(y), Math.max(1, Math.round(w)), Math.max(1, Math.round(h)));
}

export function paintObject(ctx, o, x = o.x, y = o.y, time = 0) {
  const t = o.kind, wobble = Math.sin(time * 4 + o.id) * 1.2;
  if (t === 'berry') {
    fill(ctx, '#345d43', x - 1, y - 12, 3, 4);
    fill(ctx, '#568c53', x - 5, y - 12, 6, 2);
    fill(ctx, '#ad474b', x - 5, y - 9, 10, 8);
    fill(ctx, '#da6655', x - 4, y - 8, 8, 7);
    fill(ctx, '#f2a473', x - 3, y - 7, 3, 2);
    fill(ctx, '#79353e', x + 2, y - 4, 2, 2);
  } else if (t === 'stone') {
    fill(ctx, '#465456', x - 9, y - 6, 18, 6);
    fill(ctx, '#64726d', x - 7, y - 10, 15, 7);
    fill(ctx, '#8b9990', x - 4, y - 12, 9, 4);
    fill(ctx, '#adbaa7', x - 3, y - 11, 5, 2);
    fill(ctx, '#364a4d', x + 5, y - 5, 3, 3);
  } else if (t === 'pod') {
    fill(ctx, '#4b5743', x - 5, y - 8, 11, 8);
    fill(ctx, '#6f7a4e', x - 6, y - 11, 12, 8);
    fill(ctx, '#a8a365', x - 3, y - 13, 7, 8);
    fill(ctx, '#d2ba76', x - 1, y - 11, 3, 4);
    fill(ctx, '#465e43', x + 3, y - 8, 2, 4);
    if (o.damage) fill(ctx, '#2f3935', x, y - 11, 2, 9);
  } else if (t === 'twig') {
    fill(ctx, '#755540', x - 10, y - 5, 21, 3);
    fill(ctx, '#a07749', x - 7, y - 7, 13, 3);
    fill(ctx, '#765239', x + 2, y - 11, 3, 6);
    fill(ctx, '#a67e51', x - 5, y - 10, 3, 6);
    fill(ctx, '#56834f', x + 2, y - 13, 7, 3);
    fill(ctx, '#719d5d', x - 9, y - 12, 6, 3);
  } else if (t === 'beetle') {
    const offset = Math.round(wobble);
    fill(ctx, '#3c534e', x - 5, y - 3 + offset, 12, 4);
    fill(ctx, '#365c67', x - 6, y - 8 + offset, 12, 7);
    fill(ctx, '#4c8b8a', x - 5, y - 9 + offset, 10, 5);
    fill(ctx, '#a6c8ad', x - 3, y - 8 + offset, 3, 2);
    fill(ctx, '#1d3035', x + 2, y - 7 + offset, 2, 2);
    fill(ctx, '#32434a', x + 6, y - 10 + offset, 2, 4);
    fill(ctx, '#32434a', x - 6, y - 10 + offset, 2, 4);
  } else if (t === 'puddle') {
    fill(ctx, '#315e6b', x - 15, y - 4, 30, 4);
    fill(ctx, '#458394', x - 12, y - 6, 23, 4);
    fill(ctx, '#81acac', x - 7, y - 6, 9, 2);
    fill(ctx, '#a2c4bd', x + 5, y - 4, 5, 1);
    if (o.splash > 0) {
      fill(ctx, '#86b9bc', x - 8, y - 8 - o.splash * 4, 2, 2);
      fill(ctx, '#accbc5', x + 8, y - 8 - o.splash * 3, 2, 2);
    }
  }
}

function visualSignature(o) {
  // Perception samples the exact rasterized sprite. No object kind is sent to the brain.
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 32;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  paintObject(ctx, o, 16, 23, 0);
  const rgba = ctx.getImageData(0, 0, 32, 32).data;
  let pixels = 0, r = 0, g = 0, b = 0, minX = 32, minY = 32, maxX = 0, maxY = 0;
  const cells = new Array(9).fill(0);
  for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) {
    const p = (y * 32 + x) * 4;
    if (rgba[p + 3] < 127) continue;
    pixels++;
    r += rgba[p]; g += rgba[p + 1]; b += rgba[p + 2];
    minX = Math.min(minX, x); maxX = Math.max(maxX, x);
    minY = Math.min(minY, y); maxY = Math.max(maxY, y);
    const cx = Math.min(2, Math.floor(x / (32 / 3)));
    const cy = Math.min(2, Math.floor(y / (32 / 3)));
    cells[cy * 3 + cx]++;
  }
  if (!pixels) return new Array(15).fill(0);
  return [
    r / pixels / 255, g / pixels / 255, b / pixels / 255,
    (maxX - minX + 1) / 32, (maxY - minY + 1) / 32,
    pixels / 250,
    ...cells.map(v => v / pixels)
  ];
}

function distance(a, b) {
  let sum = 0;
  const weights = [1.8, 1.8, 1.8, 1.5, 1.5, 0.6, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5];
  for (let i = 0; i < a.length; i++) sum += weights[i] * (a[i] - b[i]) ** 2;
  return Math.sqrt(sum);
}

export class Brain {
  constructor(saved = {}) {
    this.categories = saved.categories || [];
    this.events = saved.events || [];
    this.totalInteractions = saved.totalInteractions || 0;
    this.lastPrediction = 0;
    this.thought = 'Everything is new. I wonder what that is.';
  }
  recognize(obj) {
    const v = visualSignature(obj);
    let best = null, min = Infinity;
    for (const c of this.categories) {
      const d = distance(v, c.vector);
      if (d < min) { min = d; best = c; }
    }
    if (best && min < 0.27) {
      // An incremental perceptual prototype; membership is based on pixels.
      const alpha = 0.09;
      best.vector = best.vector.map((n, i) => n * (1 - alpha) + v[i] * alpha);
      return best;
    }
    const c = {
      id: this.categories.length + 1, label: 'Form ' + String(this.categories.length + 1).padStart(2, '0'),
      vector: v, encounters: 0, q: {}, counts: {}, outcomes: {},
      liking: 0, fear: 0, trust: 0, curiosity: 0.7, observations: 0
    };
    this.categories.push(c);
    return c;
  }
  findFor(obj) {
    const v = visualSignature(obj);
    let best = null, min = Infinity;
    for (const c of this.categories) {
      const d = distance(v, c.vector);
      if (d < min) { best = c; min = d; }
    }
    return min < 0.27 ? best : null;
  }
  propose(pet, objects) {
    let best = null, bestScore = -Infinity;
    for (const obj of objects) {
      if (!obj.alive || Math.abs(obj.x - pet.x) > 175) continue;
      const c = this.recognize(obj);
      const novelty = 1.25 / Math.sqrt(1 + c.encounters * 0.2);
      for (const action of ACTIONS) {
        const n = c.counts[action] || 0;
        const familiarity = 1 / Math.sqrt(1 + n);
        let bias = 0;
        if (action === 'bite') bias += pet.hunger / 42 - 0.7;
        if (action === 'touch') bias += pet.curiosity / 95;
        if (action === 'push') bias += pet.curiosity / 130;
        if (action === 'play') bias += pet.energy / 110 - pet.stress / 160;
        if (action === 'observe') bias += pet.stress / 90 + 0.2;
        const fearPenalty = c.fear * (action === 'observe' ? 0.1 : 1.1);
        const q = c.q[action] || 0;
        const score = q * 0.7 + novelty * 0.7 + familiarity * 1.25 +
          bias - fearPenalty - Math.abs(obj.x - pet.x) / 125 +
          random(-0.5, 0.5);
        if (score > bestScore) {
          bestScore = score;
          best = { objectId: obj.id, action, categoryId: c.id, expected: q };
        }
      }
    }
    return best;
  }
  experience(category, action, result, before, after, t) {
    const n = category.counts[action] || 0;
    const previousQ = category.q[action] || 0;
    const bodyGain = (before.hunger - after.hunger) * (0.08 + before.hunger / 850) +
      (after.energy - before.energy) * 0.045 +
      (before.stress - after.stress) * 0.12;
    const novelty = 1.1 / Math.sqrt(1 + n);
    const reward = clamp(bodyGain + (result.pleasure || 0) - (result.pain || 0) + novelty, -8, 8);
    const error = reward - previousQ;
    category.q[action] = round(previousQ + 0.32 * error);
    category.counts[action] = n + 1;
    category.encounters++;
    category.observations++;
    category.liking = round(clamp(category.liking * 0.86 + reward * 0.14, -5, 5));
    category.fear = round(clamp(category.fear * 0.85 + (result.pain || 0) * 0.12 - (result.pleasure || 0) * 0.045, 0, 4));
    category.trust = round(clamp(category.trust * 0.92 + Math.max(0, reward) * 0.035, 0, 3));
    category.curiosity = round(clamp(1.5 / Math.sqrt(1 + category.encounters * 0.13) + Math.abs(error) * 0.055, 0, 2));
    category.outcomes[action] = result.message;
    this.totalInteractions++;
    this.lastPrediction = round(error);
    this.thought = error < -1.5 ? 'That went worse than expected...' :
      error > 1.5 ? 'Oh! That was interesting.' :
      reward > 1 ? 'I think I like doing that.' :
      reward < -0.4 ? 'Maybe not again.' : 'I am learning how this works.';
    this.events.unshift({
      id: this.totalInteractions, time: Math.round(t), category: category.label,
      action, message: result.message, reward: round(reward), error: round(error)
    });
    this.events = this.events.slice(0, 80);
    return reward;
  }
  serialize() {
    return { categories: this.categories, events: this.events.slice(0, 50), totalInteractions: this.totalInteractions };
  }
}

function newObj(kind, x) {
  return { id: nextId++, kind, x: clamp(x, 20, WIDTH - 20), y: GROUND, vx: 0,
    alive: true, damage: 0, splash: 0, respawn: 0, homeX: x, phase: random(0, 10) };
}

export class Simulation {
  constructor(saved, notify = () => {}) {
    this.notify = notify;
    this.time = saved?.time || 0;
    this.weather = 'clear';
    this.pet = saved?.pet ? { ...saved.pet, target: null, cooldown: 0, thoughtTimer: 0 } : {
      x: 115, y: GROUND, face: 1, vx: 0, hunger: 30, energy: 88, stress: 8,
      curiosity: 82, age: 0, target: null, cooldown: 1, thoughtTimer: 0, anim: 0
    };
    this.brain = new Brain(saved?.brain);
    this.objects = saved?.objects?.length ? saved.objects.map(o => ({ ...o })) : [
      newObj('berry', 186), newObj('stone', 265), newObj('pod', 365),
      newObj('twig', 317), newObj('beetle', 438), newObj('puddle', 71)
    ];
    nextId = Math.max(nextId, ...this.objects.map(o => o.id + 1));
    this.lastAction = 'Waking up in a strange little world.';
    this.selectedId = null;
    this.particles = [];
    this.decor = this.createDecor();
    this.background = this.paintBackground();
    this.agentStep = 0;
    this.exploration = 0;
  }
  createDecor() {
    const stems = [];
    let seed = 8231;
    const rng = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
    for (let i = 0; i < 75; i++) stems.push({ x: Math.floor(rng() * WIDTH),
      y: GROUND + Math.floor(rng() * 25), h: 2 + Math.floor(rng() * 7),
      color: ['#405f48', '#4a7552', '#668757', '#879863'][Math.floor(rng() * 4)], bloom: rng() > 0.91 });
    return stems;
  }
  paintBackground() {
    const bg = document.createElement('canvas');
    bg.width = WIDTH; bg.height = HEIGHT;
    const c = bg.getContext('2d');
    const sky = ['#162c37', '#1c3540', '#23434a', '#2b5153', '#395d55'];
    sky.forEach((col, i) => fill(c, col, 0, i * 30, WIDTH, 45));
    fill(c, '#49695b', 0, 139, WIDTH, 40);
    for (let i = 0; i < 8; i++) {
      const x = i * 70 - 25, h = 38 + (i * 19) % 38;
      fill(c, '#345c58', x + 11, 165 - h, 7, h + 20);
      fill(c, '#375b55', x - 10, 165 - h + 7, 41, 18);
      fill(c, '#47705f', x - 4, 165 - h - 3, 32, 22);
      fill(c, '#507b64', x + 3, 165 - h - 10, 17, 10);
    }
    fill(c, '#536d50', 0, 176, WIDTH, 42);
    fill(c, '#50684b', 0, GROUND - 6, WIDTH, 6);
    fill(c, '#405746', 0, GROUND, WIDTH, HEIGHT - GROUND);
    fill(c, '#344c43', 0, 232, WIDTH, 28);
    fill(c, '#2a4140', 0, 260, WIDTH, 10);
    const rng = (x, y) => (Math.sin(x * 127.1 + y * 311.7) * 43758.5453) % 1;
    for (let i = 0; i < 300; i++) {
      const x = (i * 101 + 39) % WIDTH, y = GROUND + (i * 23) % (HEIGHT - GROUND);
      fill(c, i % 4 ? '#3b5343' : '#617051', x, y, i % 7 ? 2 : 5, 1);
    }
    for (let i = 0; i < 32; i++) {
      const x = (i * 59 + 21) % WIDTH, y = 173 + Math.abs(rng(i, 7)) * 23;
      fill(c, '#58785b', x - 2, y, 17, 4);
      fill(c, '#62805d', x + 1, y - 3, 10, 4);
    }
    return bg;
  }
  spawn(kind, x) {
    if (!['berry', 'stone', 'pod', 'twig', 'beetle', 'puddle'].includes(kind)) return;
    if (this.objects.filter(o => o.alive).length >= 35) {
      this.notify('The world is full. Remove an object first.');
      return;
    }
    const o = newObj(kind, x);
    this.objects.push(o);
    this.selectedId = o.id;
    this.notify('A new object appeared. Will the creature investigate?');
  }
  get selected() { return this.objects.find(o => o.id === this.selectedId) || null; }
  select(x) {
    let best = null, dist = 22;
    for (const o of this.objects) {
      if (!o.alive) continue;
      const d = Math.abs(x - o.x);
      if (d < dist) { best = o; dist = d; }
    }
    this.selectedId = best ? best.id : null;
    return best;
  }
  mood() {
    const p = this.pet;
    if (p.stress > 62) return 'Uneasy';
    if (p.energy < 20) return 'Sleepy';
    if (p.hunger > 68) return 'Hungry';
    if (p.curiosity > 62) return 'Curious';
    if (p.stress < 14 && p.hunger < 40) return 'Content';
    return 'Attentive';
  }
  interact(obj, action) {
    const p = this.pet;
    const result = { message: '', pleasure: 0, pain: 0 };
    const burst = (color, n = 7) => this.emit(obj.x, obj.y - 9, color, n);
    const shove = strength => { obj.vx += (p.x < obj.x ? 1 : -1) * strength; };
    if (action === 'observe') {
      result.message = 'Watched the object closely.';
      p.curiosity -= 3;
      result.pleasure = 0.2;
      if (obj.kind === 'beetle') result.message = 'Observed the creature moving on its own.';
    } else if (obj.kind === 'berry') {
      if (action === 'bite') {
        p.hunger -= 34; p.energy += 4; p.curiosity -= 8;
        result.pleasure = 3.1; result.message = 'Ate it. Sweet and satisfying.';
        burst('#e8a576', 9); obj.alive = false; obj.respawn = 26;
      } else if (action === 'push') {
        shove(45); result.message = 'It rolled across the grass.'; result.pleasure = 0.65;
      } else if (action === 'play') {
        shove(35); p.curiosity -= 4; result.message = 'Batted it playfully.'; result.pleasure = 0.9;
      } else {
        result.message = 'Soft and fragrant to the touch.'; result.pleasure = 0.6;
      }
    } else if (obj.kind === 'stone') {
      if (action === 'bite') {
        p.stress += 23; p.energy -= 2; result.pain = 3.2;
        result.message = 'Ouch! The hard surface hurt.'; burst('#df9272');
      } else if (action === 'push' || action === 'play') {
        shove(30); p.energy -= 1; result.message = 'The heavy stone shifted with effort.';
        result.pleasure = 0.4;
      } else { result.message = 'Cold, hard and unmoving.'; result.pleasure = 0.1; }
    } else if (obj.kind === 'pod') {
      if (action === 'push' || action === 'play') {
        obj.damage++;
        shove(23);
        if (obj.damage >= 2) {
          obj.alive = false; obj.respawn = 35;
          this.objects.push(newObj('berry', clamp(obj.x + 8, 20, WIDTH - 20)));
          result.message = 'The shell cracked! Something edible rolled out.';
          result.pleasure = 2.4; p.curiosity -= 12; burst('#d0b874', 12);
        } else { result.message = 'Its shell rattled. Something is inside.'; result.pleasure = 1.1; }
      } else if (action === 'bite') {
        obj.damage++;
        p.stress += 5; result.pain = 0.75;
        result.message = 'The shell is tough, but it made a small crack.';
      } else { result.message = 'A hollow, hard thing with something inside.'; result.pleasure = 0.45; }
    } else if (obj.kind === 'twig') {
      if (action === 'push' || action === 'bite' || action === 'play') {
        obj.damage++;
        if (obj.damage >= 2) {
          obj.alive = false; obj.respawn = 23;
          result.message = 'The branch snapped into pieces.';
          result.pleasure = 1.15; p.curiosity -= 5; burst('#b79565');
        } else { shove(18); result.message = 'The thin branch bent under force.'; result.pleasure = 0.8; }
      } else { result.message = 'A flexible, woody texture.'; result.pleasure = 0.3; }
    } else if (obj.kind === 'beetle') {
      if (action === 'bite') {
        p.stress += 17; p.energy -= 2; result.pain = 2.3;
        result.message = 'The beetle defended itself. That hurt!';
        obj.vx = (obj.x > p.x ? 1 : -1) * 70; burst('#78b3ac');
      } else if (action === 'touch' || action === 'push') {
        obj.vx = (obj.x > p.x ? 1 : -1) * 70;
        result.message = 'It startled and scurried away.'; result.pleasure = 0.7;
      } else {
        obj.vx = (obj.x > p.x ? 1 : -1) * 32;
        result.message = 'The little creature reacted and moved.';
        result.pleasure = 0.75;
      }
    } else if (obj.kind === 'puddle') {
      if (action === 'bite') {
        p.stress -= 3;
        result.message = 'Tasted cool water.'; result.pleasure = 0.55;
      } else {
        obj.splash = 1; p.curiosity -= 4; p.stress -= 2;
        result.message = 'Water splashed and rippled!';
        result.pleasure = 1.25; burst('#9abfc0', 10);
      }
    }
    p.hunger = clamp(p.hunger, 0, 100);
    p.energy = clamp(p.energy, 0, 100);
    p.curiosity = clamp(p.curiosity, 0, 100);
    p.stress = clamp(p.stress, 0, 100);
    return result;
  }
  emit(x, y, color, n) {
    for (let i = 0; i < n; i++) this.particles.push({
      x, y, vx: random(-22, 22), vy: random(-42, -12),
      life: random(0.4, 0.9), color
    });
  }
  step(dt) {
    dt = clamp(dt, 0, 0.09);
    this.time += dt;
    const p = this.pet; p.anim += dt;
    p.age += dt;
    p.hunger = clamp(p.hunger + dt * 0.46, 0, 100);
    p.energy = clamp(p.energy - dt * (p.target ? 0.12 : 0.025), 0, 100);
    p.curiosity = clamp(p.curiosity + dt * 0.42, 0, 100);
    p.stress = clamp(p.stress - dt * 0.13, 0, 100);
    p.cooldown = Math.max(0, p.cooldown - dt);
    p.thoughtTimer = Math.max(0, p.thoughtTimer - dt);
    for (const obj of this.objects) {
      if (!obj.alive) {
        obj.respawn -= dt;
        if (obj.respawn <= 0) { obj.alive = true; obj.damage = 0; obj.x = obj.homeX; }
      } else {
        if (obj.kind === 'beetle') obj.vx += Math.sin(this.time * 0.9 + obj.phase) * 1.9 * dt;
        obj.x = clamp(obj.x + obj.vx * dt, 18, WIDTH - 18);
        obj.vx *= Math.pow(0.82, dt * 30);
        obj.splash = Math.max(0, obj.splash - dt * 1.8);
      }
    }
    for (const z of this.particles) {
      z.life -= dt; z.x += z.vx * dt; z.y += z.vy * dt; z.vy += 80 * dt;
    }
    this.particles = this.particles.filter(z => z.life > 0).slice(-100);

    // An energy homeostat overrides exploration; this reflex isn't learned.
    if (p.energy < 13) {
      p.target = null; p.vx = 0; p.energy = clamp(p.energy + dt * 8, 0, 100);
      p.stress = clamp(p.stress - dt * 0.6, 0, 100);
      this.brain.thought = 'Need to rest for a while.';
      return;
    }

    if (!p.target || p.cooldown === 0 && !this.objects.some(o => o.id === p.target.objectId && o.alive)) {
      p.target = this.brain.propose(p, this.objects);
      p.cooldown = p.target ? random(0.6, 1.5) : 1;
    }
    const o = this.objects.find(obj => obj.id === p.target?.objectId && obj.alive);
    if (o) {
      const dx = o.x - p.x;
      if (Math.abs(dx) > 20) {
        const speed = clamp(Math.abs(dx) * 2.2, 14, 35);
        p.vx = (dx > 0 ? 1 : -1) * speed; p.face = p.vx > 0 ? 1 : -1;
        p.x = clamp(p.x + p.vx * dt, 18, WIDTH - 18);
      } else {
        p.vx = 0;
        if (p.cooldown <= 0) {
          const cat = this.brain.findFor(o) || this.brain.recognize(o);
          const before = { hunger: p.hunger, energy: p.energy, stress: p.stress };
          const result = this.interact(o, p.target.action);
          this.brain.experience(cat, p.target.action, result, before, p, this.time);
          this.lastAction = result.message;
          p.thoughtTimer = 3.5;
          p.target = null;
          p.cooldown = random(1.0, 1.8);
          this.notify(result.message);
        }
      }
    } else {
      p.vx = 0;
      if (p.cooldown <= 0) { p.target = null; p.cooldown = 0; }
    }
  }
  render(ctx) {
    ctx.clearRect(0, 0, WIDTH, HEIGHT);
    ctx.drawImage(this.background, 0, 0);
    const t = this.time;
    // Pixelated light shafts and sparse ambient motes.
    ctx.globalAlpha = 0.12;
    fill(ctx, '#e1c88c', 82 + Math.sin(t * 0.08) * 5, 22, 3, 150);
    fill(ctx, '#f5d6a0', 304 + Math.sin(t * 0.07) * 5, 18, 5, 150);
    ctx.globalAlpha = 1;
    for (const d of this.decor) {
      fill(ctx, d.color, d.x, d.y - d.h, 2, d.h);
      if (d.bloom) {
        fill(ctx, '#d0ad73', d.x - 1, d.y - d.h - 2, 4, 3);
        fill(ctx, '#e4c98d', d.x, d.y - d.h - 3, 2, 2);
      }
    }
    for (const o of this.objects) if (o.alive) {
      fill(ctx, '#263e3c', o.x - 9, GROUND + 1, 18, 3);
      paintObject(ctx, o, o.x, o.y, t);
    }
    this.drawPet(ctx);
    for (const z of this.particles) {
      ctx.globalAlpha = clamp(z.life * 1.5, 0, 1);
      fill(ctx, z.color, z.x, z.y, 2, 2);
    }
    ctx.globalAlpha = 1;
    if (this.selected && this.selected.alive) {
      const s = this.selected, y = s.y - (s.kind === 'puddle' ? 10 : 17);
      fill(ctx, '#e3c78f', s.x - 11, y, 5, 1);
      fill(ctx, '#e3c78f', s.x + 6, y, 5, 1);
      fill(ctx, '#e3c78f', s.x - 11, y, 1, 5);
      fill(ctx, '#e3c78f', s.x + 10, y, 1, 5);
    }
  }
  drawPet(ctx) {
    const p = this.pet, x = Math.round(p.x), y = Math.round(GROUND - 1);
    const moving = Math.abs(p.vx) > 1;
    const bounce = moving ? Math.round(Math.sin(p.anim * 17) * 2) : Math.round(Math.sin(p.anim * 3) * 1);
    const sleepy = p.energy < 13;
    ctx.save();
    ctx.translate(x, y + bounce);
    ctx.scale(p.face, 1);
    fill(ctx, '#263d3a', -11, 2 - bounce, 26, 3);
    // A little woodland quadruped: distinct tail, back, ears, muzzle, feet.
    fill(ctx, '#8c6550', -17, -16, 7, 4);
    fill(ctx, '#ba835d', -18, -19, 5, 5);
    fill(ctx, '#bd8d67', -11, -19, 19, 15);
    fill(ctx, '#daa57b', -8, -20, 20, 14);
    fill(ctx, '#d8ad86', 3, -29, 16, 17);
    fill(ctx, '#bd855e', 5, -35, 5, 10);
    fill(ctx, '#d7aa7b', 12, -34, 5, 9);
    fill(ctx, '#705344', 6, -33, 2, 5);
    fill(ctx, '#775346', 13, -32, 2, 4);
    fill(ctx, '#edc39a', 8, -20, 13, 8);
    fill(ctx, '#f4d1aa', 11, -17, 10, 5);
    fill(ctx, '#463e39', 16, -24, sleepy ? 5 : 3, sleepy ? 1 : 4);
    fill(ctx, '#f6e2b9', 17, -23, 1, sleepy ? 1 : 2);
    fill(ctx, '#7a5d4e', 20, -17, 3, 2);
    fill(ctx, '#a56e59', 10, -18, 3, 2);
    fill(ctx, '#8e604e', -8, -6, 5, 7);
    fill(ctx, '#ac7858', 2, -6, 5, 7);
    if (moving) {
      fill(ctx, '#744c41', -8, -1 + Math.sign(Math.sin(p.anim * 17)) * 2, 5, 2);
      fill(ctx, '#744c41', 2, -1 - Math.sign(Math.sin(p.anim * 17)) * 2, 5, 2);
    } else {
      fill(ctx, '#744c41', -8, 0, 5, 2);
      fill(ctx, '#744c41', 2, 0, 5, 2);
    }
    ctx.restore();
    if (p.thoughtTimer > 0) {
      fill(ctx, '#e4ddbf', clamp(x - 10, 2, 435), y - 49, 30, 2);
      fill(ctx, p.stress > 35 ? '#c2806c' : '#7ea394', clamp(x - 10, 2, 435), y - 49, 30 * (p.thoughtTimer / 3.5), 2);
    }
  }
  save() {
    return {
      version: 1, time: this.time,
      pet: { ...this.pet, target: null },
      objects: this.objects.map(o => ({ ...o })),
      brain: this.brain.serialize()
    };
  }
}
