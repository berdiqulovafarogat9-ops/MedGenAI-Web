(function (root) {
  // Pure quiz logic for "Toping va bosing" (no DOM, no three.js): testable in isolation.
  function uniqueNames(names) {
    var seen = {}, out = [];
    names.forEach(function (n) {
      var s = String(n || "").trim();
      if (s && !seen[s]) { seen[s] = true; out.push(s); }
    });
    return out;
  }
  function newQuiz(names, rnd) {
    return { names: uniqueNames(names), rnd: rnd || Math.random, target: null, asked: 0, correct: 0, wrong: 0 };
  }
  function nextTarget(q) {
    if (!q.names.length) return null;
    q.target = q.names[Math.floor(q.rnd() * q.names.length) % q.names.length];
    return q.target;
  }
  function answer(q, clickedName) {
    if (!q.target) return { ok: false, reason: "no-target" };
    q.asked += 1;
    var ok = String(clickedName || "").trim() === q.target;
    if (ok) q.correct += 1; else q.wrong += 1;
    var target = q.target;
    q.target = null;
    return { ok: ok, target: target };
  }
  function accuracy(q) { return q.asked ? Math.round(100 * q.correct / q.asked) : 0; }
  var api = { uniqueNames: uniqueNames, newQuiz: newQuiz, nextTarget: nextTarget, answer: answer, accuracy: accuracy };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.MedGenAnatomyQuiz = api;
})(typeof window !== "undefined" ? window : this);
