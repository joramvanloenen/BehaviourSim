import test from 'node:test';
import assert from 'node:assert/strict';
import { Simulation } from '../src/engine.js';

// Minimal raster canvas for testing the *actual* sprite-feature extraction in Node.
// No browser packages or mocked object labels in the cognitive model.
globalThis.document = {
  createElement(name) {
    assert.equal(name, 'canvas');
    const canvas = { width: 32, height: 32 };
    let image = null;
    const ctx = {
      fillStyle: '#ffffff',
      globalAlpha: 1,
      fillRect(x, y, w, h) {
        // Background generation doesn't need retained pixels.
        if (canvas.width > 32 || canvas.height > 32) return;
        if (!image) image = new Uint8ClampedArray(canvas.width * canvas.height * 4);
        const color = this.fillStyle.replace('#', '');
        const r = Number.parseInt(color.slice(0, 2), 16);
        const g = Number.parseInt(color.slice(2, 4), 16);
        const b = Number.parseInt(color.slice(4, 6), 16);
        for (let cy = Math.max(0, Math.floor(y)); cy < Math.min(canvas.height, Math.ceil(y + h)); cy++) {
          for (let cx = Math.max(0, Math.floor(x)); cx < Math.min(canvas.width, Math.ceil(x + w)); cx++) {
            const off = (cy * canvas.width + cx) * 4;
            image[off] = r; image[off + 1] = g; image[off + 2] = b; image[off + 3] = 255;
          }
        }
      },
      getImageData() { return { data: image || new Uint8ClampedArray(32 * 32 * 4) }; },
      drawImage() {}, clearRect() {}, save() {}, restore() {}, translate() {}, scale() {}
    };
    canvas.getContext = () => ctx;
    return canvas;
  }
};

const sample = () => new Simulation(null);
const body = p => ({ hunger: p.hunger, energy: p.energy, stress: p.stress });

test('perception forms visual concepts from rasterized objects, not world labels', () => {
  const sim = sample();
  const berry = sim.objects.find(o => o.kind === 'berry');
  const stone = sim.objects.find(o => o.kind === 'stone');
  const a = sim.brain.recognize(berry);
  const aAgain = sim.brain.recognize({ ...berry, id: 998, x: 123 });
  const b = sim.brain.recognize(stone);
  assert.equal(a.id, aAgain.id);
  assert.notEqual(a.id, b.id);
  assert.equal(sim.brain.categories.length, 2);
});

test('biting an edible berry improves hunger and teaches a positive association', () => {
  const sim = sample(), berry = sim.objects.find(o => o.kind === 'berry');
  const category = sim.brain.recognize(berry);
  const before = body(sim.pet);
  const outcome = sim.interact(berry, 'bite');
  const reward = sim.brain.experience(category, 'bite', outcome, before, sim.pet, 10);
  assert.ok(sim.pet.hunger < before.hunger);
  assert.ok(reward > 0);
  assert.ok(category.q.bite > 0);
  assert.equal(berry.alive, false);
});

test('biting a stone hurts and teaches a negative action value and fearful association', () => {
  const sim = sample(), stone = sim.objects.find(o => o.kind === 'stone');
  const category = sim.brain.recognize(stone);
  const before = body(sim.pet);
  const outcome = sim.interact(stone, 'bite');
  const reward = sim.brain.experience(category, 'bite', outcome, before, sim.pet, 10);
  assert.ok(sim.pet.stress > before.stress);
  assert.ok(reward < 0);
  assert.ok(category.q.bite < 0);
  assert.ok(category.fear > 0);
});

test('the seed pod reacts to manipulation and reveals edible content', () => {
  const sim = sample(), pod = sim.objects.find(o => o.kind === 'pod');
  const length = sim.objects.length;
  sim.interact(pod, 'push');
  assert.equal(pod.damage, 1);
  const outcome = sim.interact(pod, 'push');
  assert.equal(pod.alive, false);
  assert.match(outcome.message, /cracked/i);
  assert.equal(sim.objects.length, length + 1);
});

test('free-running agent explores, accumulates experiences, and saves learned state', () => {
  const sim = sample();
  for (let frame = 0; frame < 2100; frame++) sim.step(1 / 30);
  assert.ok(sim.brain.totalInteractions >= 5, 'Expected autonomous physical experiments');
  assert.ok(sim.brain.categories.length >= 3, 'Expected several appearances');
  const saved = sim.save();
  const restored = new Simulation(saved);
  assert.equal(restored.brain.totalInteractions, sim.brain.totalInteractions);
  assert.equal(restored.brain.categories.length, sim.brain.categories.length);
  assert.equal(restored.objects.length, sim.objects.length);
  assert.ok(restored.brain.events.length);
});
