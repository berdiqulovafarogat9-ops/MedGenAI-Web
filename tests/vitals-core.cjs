"use strict";
const assert = require("node:assert/strict");
const Core = require("../vitals-core.js");

function makeCase(overrides = {}) {
  return {
    id: "unit_case",
    init: { hr: 138, sbp: 69, dbp: 39, spo2: 88, rr: 28 },
    actions: [
      { id: "epi", label: "IM adrenaline", effects: { hr: -20, sbp: 25, dbp: 15, spo2: 0, rr: -4 } },
      { id: "oxygen", label: "Oxygen", effects: { spo2: 8, rr: -3 } }
    ],
    worsen: { hr: 1, sbp: -1, dbp: -1, spo2: -1, rr: 1 },
    ...overrides
  };
}

function test(name, fn) {
  try { fn(); process.stdout.write("✓ " + name + "\n"); }
  catch (error) { process.stderr.write("✗ " + name + "\n" + error.stack + "\n"); process.exitCode = 1; }
}

test("creates an isolated initial state", () => {
  const a = Core.create(makeCase()), b = Core.create(makeCase());
  assert.deepEqual(a.state, makeCase().init);
  a.state.hr = 1;
  assert.equal(b.state.hr, 138);
});

test("accepts a known action exactly once and records simulation time", () => {
  const sim = Core.create(makeCase());
  const result = sim.act("epi");
  assert.equal(result.ok, true);
  assert.equal(result.label, "IM adrenaline");
  assert.equal(sim.log.length, 1);
  assert.deepEqual(sim.log[0], { id: "epi", t: 0 });
  assert.equal(sim.state.sbp, 94);
  assert.equal(sim.act("epi").reason, "duplicate");
  assert.equal(sim.log.length, 1);
});

test("rejects unknown actions without changing state or log", () => {
  const sim = Core.create(makeCase());
  const before = { ...sim.state };
  assert.equal(sim.act("not-a-real-action").reason, "unknown");
  assert.deepEqual(sim.state, before);
  assert.equal(sim.log.length, 0);
});

test("applies per-second worsening after checking stabilization", () => {
  const sim = Core.create(makeCase({ init: { hr: 80, sbp: 120, dbp: 80, spo2: 98, rr: 16 } }));
  sim.tick();
  assert.equal(sim.ended, true);
  assert.equal(sim.stabilized, true);
  assert.equal(sim.stabAt, 0);
  assert.equal(sim.state.hr, 80);
});

test("applies worsening and increments elapsed seconds when unstable", () => {
  const sim = Core.create(makeCase());
  sim.tick();
  assert.equal(sim.s, 1);
  assert.equal(sim.state.hr, 139);
  assert.equal(sim.state.spo2, 87);
  assert.equal(sim.ended, false);
});

test("clamps physiological values to configured bounds", () => {
  const sim = Core.create(makeCase({
    init: { hr: 249, sbp: 259, dbp: 159, spo2: 99, rr: 59 },
    actions: [{ id: "extreme", label: "Extreme test", effects: { hr: 50, sbp: 50, dbp: 50, spo2: 50, rr: 50 } }]
  }));
  assert.equal(sim.act("extreme").ok, true);
  assert.deepEqual(sim.state, { hr: 250, sbp: 260, dbp: 160, spo2: 100, rr: 60 });
});

test("stops accepting actions after the simulation ends", () => {
  const sim = Core.create(makeCase({ init: { hr: 80, sbp: 120, dbp: 80, spo2: 98, rr: 16 } }));
  sim.tick();
  assert.equal(sim.act("epi").reason, "ended");
  assert.equal(sim.log.length, 0);
});

test("ends at the maximum simulation duration", () => {
  const sim = Core.create(makeCase());
  for (let i = 0; i < Core.MAX; i++) sim.tick();
  assert.equal(sim.s, Core.MAX);
  assert.equal(sim.ended, false);
  sim.tick();
  assert.equal(sim.ended, true);
  assert.equal(sim.stabilized, false);
  assert.equal(sim.act("epi").reason, "ended");
});

test("exposes accepted action state without deriving it from UI controls", () => {
  var sim = Core.create({
    init: { hr: 120, sbp: 80, dbp: 50, spo2: 88, rr: 28 },
    actions: [{ id: "oxygen_high", label: "Oxygen", effects: { spo2: 5 } }],
    worsen: { hr: 1 }
  });
  assert.equal(sim.hasAction("oxygen_high"), false);
  assert.equal(sim.hasAction("unknown"), false);
  assert.equal(sim.act("oxygen_high").ok, true);
  assert.equal(sim.hasAction("oxygen_high"), true);
  assert.equal(sim.act("oxygen_high").reason, "duplicate");
  assert.equal(sim.hasAction("oxygen_high"), true);
});

if (process.exitCode) process.exit(process.exitCode);
else process.stdout.write("All clinical vitals core tests passed.\n");

