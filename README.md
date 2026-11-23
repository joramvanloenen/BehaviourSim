# BehaviourSim

**A small world, a learning mind.** An autonomous pixel-art pet that discovers its environment through exploration, physical interaction, and experience-driven action preferences.

## Try it

Once GitHub Pages has deployed, open **https://joramvanloenen.github.io/BehaviourSim/**.

To run locally without any tools beyond Python:

```bash
python -m http.server 8080
```

Then visit http://localhost:8080. (ES modules won't load reliably from a `file://` URL.)

### What to do

1. Watch Moss explore the little habitat on its own. Speed up to **4×** or **12×** to see experience accumulate.
2. Click an object to reveal what Moss thinks it looks like, what happened previously, and how it currently values possible actions.
3. Suggest **Look**, **Touch**, **Push**, **Bite**, or **Play** to guide an experiment. Moss will approach the selected object and experience the real consequences.
4. Choose a type in **Introduce an object**, then click the landscape to add something new.
5. Reload. The pet and its remembered experiences will persist using browser `localStorage`.
6. **Reset** deliberately clears the experience and starts a new creature.

## What is genuinely implemented

- An always-running **30 Hz pixel-world simulation**, with six interactive object classes: berry, stone, seed pod, twig, beetle, puddle.
- The world reacts physically to interaction: rolling, escaping, biting back, cracking, snapping, being eaten, splashing, respawning.
- An animal-like set of **homeostatic drives**: hunger, energy, stress, curiosity.
- Autonomous behavior selection from **previously learned action values**, a novelty/exploration bonus, current drives, distance, and some randomness.
- **Actual online associative learning**: each action produces sensory/body consequences, changes an expected reward estimate, and becomes part of episodic memory.
- **Visual-form prototypes computed from the rendered sprite pixels**. The pet's learning/policy code is **not passed the internal object kind**. The world still retains that type privately for physics and consequences.
- Learned trust, attraction, fear and interest associated with visual forms. An inspector exposes predictions, action values, experiences and the world's actual object kind for comparison.
- Persistent memories, drives, world objects and learned values, saved in the browser.
- No backend, API keys, compile step, Python installation, or hardware is needed to run the deployed site.

## Important scientific / engineering boundaries

This is a **small, inspectable demonstration of associative and reward-based learning**, not a neural network, a biological brain simulation, general object recognition, or an LLM-enabled reasoner. Its perceptual features are hand-designed measurements from small sprites, not a pretrained general visual model. It generalizes only to visually similar sprites, and can mistake one visual class for another. The reward function and primitive drives are designed by us; object-specific rewards are **not** simply assigned to the policy.

The thought text describes simple local state and prediction error, not introspective consciousness or language reasoning. AI-generated art, neural vision, long-horizon planning and ESP32-P4 execution are **future integrations** rather than features this version already includes. This prototype is intentionally web-native so the cognitive and physical interaction loop can be tested before hardware integration.

### Learning signal

The learner stores a running action-value estimate per **perceived visual concept** and action:

```text
Q(concept, action) ← Q + 0.32 × (observed_reward − Q)
```

Observed reward is derived from **changes in hunger, energy and stress**, plus signals for pleasure/painful reactions and decreasing novelty. Selection also includes intrinsic interest in less-tried experiments. It is a contextual action-value estimator, not a complete Q-learning or deep-RL implementation.

### Useful experiments

- Observe what happens when Moss repeatedly bites a stone versus a berry. Compare their learned bite values.
- Place another berry or stone and see whether the learned visual-form association transfers.
- Let Moss push the seed pod twice. If it cracks, a berry appears and the event is recorded.
- Make Moss bite a beetle, then observe whether its fearful association changes subsequent behavior.
- Reset, repeat, and compare memories. Random exploration means runs can differ.

## Architecture

- `index.html` — accessible, responsive inspector and world controls.
- `styles.css` — pixel-world dashboard, responsive desktop/mobile styling.
- `src/engine.js` — render, interactions, physical response, visual perception, learning, action selection, persistence state.
- `src/main.js` — lifecycle, controls, debugging UI, browser storage, fixed-step loop.
- `.github/workflows/pages.yml` — GitHub Pages static deployment.

## Next milestones

1. Expand the action system to dragging, stacking, climbing, chasing, and actual manipulable tool use.
2. Replace hand-engineered sprite features with a compact learned visual encoder, keeping the world truth isolated.
3. Add outcome prediction and multi-step planning so Moss can reason about causal interventions.
4. Make the beetle a second independently learning agent.
5. Add generated creature/world sprite atlases via an optional external AI server, cached consistently.
6. Attach an ESP32-P4 as a peripheral and display host, keeping expensive learning and generative models on a desktop.

Built as an experiment, not a claim of artificial general intelligence.
