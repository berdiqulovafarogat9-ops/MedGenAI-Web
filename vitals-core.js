(function (root) {
  var MAX = 180;
  var RANGES = { hr: [0, 250], sbp: [0, 260], dbp: [0, 160], spo2: [0, 100], rr: [0, 60] };

  function clamp(st) {
    for (var k in RANGES) { st[k] = Math.min(RANGES[k][1], Math.max(RANGES[k][0], st[k])); }
  }
  function apply(st, d) {
    for (var k in d) { st[k] = st[k] + d[k]; }
    clamp(st);
  }
  function normal(st) {
    return st.hr >= 60 && st.hr <= 100 && st.sbp >= 100 && st.dbp >= 60 && st.spo2 >= 94 && st.rr >= 12 && st.rr <= 20;
  }

  // Same rules as the server (_vit_replay). Order per second: actions -> stabilization check -> worsening.
  function create(def) {
    var st = {};
    for (var k in def.init) { st[k] = Number(def.init[k]); }
    var byId = {};
    def.actions.forEach(function (a) { byId[a.id] = a; });
    var sim = { s: 0, state: st, used: {}, log: [], ended: false, stabilized: false, stabAt: null, def: def };

    sim.act = function (id) {
      if (sim.ended || sim.s >= MAX) return { ok: false, reason: "ended" };
      var a = byId[id];
      if (!a) return { ok: false, reason: "unknown" };
      if (sim.used[id]) return { ok: false, reason: "duplicate" };
      sim.used[id] = true;
      sim.log.push({ id: id, t: sim.s });
      apply(st, a.effects);
      return { ok: true, label: a.label };
    };

    sim.tick = function () {
      if (sim.ended) return;
      if (sim.s >= MAX) { sim.ended = true; return; }
      if (normal(st)) { sim.ended = true; sim.stabilized = true; sim.stabAt = sim.s; return; }
      apply(st, def.worsen);
      sim.s += 1;
    };
    return sim;
  }

  var api = { create: create, normal: normal, MAX: MAX };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.VitalsCore = api;
})(typeof window !== "undefined" ? window : this);
