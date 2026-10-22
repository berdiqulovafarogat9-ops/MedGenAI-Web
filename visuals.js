(function () {
  var NS = "http://www.w3.org/2000/svg";

  function s(tag, attrs, text) {
    var n = document.createElementNS(NS, tag);
    Object.keys(attrs || {}).forEach(function (k) { n.setAttribute(k, attrs[k]); });
    if (text !== undefined) n.textContent = text;
    return n;
  }

  function h(tag, css, text) {
    var n = document.createElement(tag);
    if (css) n.style.cssText = css;
    if (text !== undefined) n.textContent = text;
    return n;
  }

  function num(v) { v = Number(v); return isFinite(v) ? v : 0; }

  function bioChart(el, data) {
    ["bioResultChart", "bioResultRawBtn"].forEach(function (id) {
      var old = document.getElementById(id);
      if (old) old.remove();
    });
    el.style.display = "";
    if (!data || ["DNA", "RNA"].indexOf(data.sequence_type) === -1) return;

    var c = data.composition || {};
    var isRna = data.sequence_type === "RNA";
    var A = num(c.A), C = num(c.C), G = num(c.G), T = num(isRna ? c.U : c.T);
    var total = num(data.length) || (A + C + G + T);
    if (!total) return;

    var gcPct = (G + C) / total * 100;
    var atPct = (A + T) / total * 100;
    var otherPct = Math.max(0, 100 - gcPct - atPct);
    if (!(A + C + G + T)) {
      gcPct = num(data.gc_content_percent);
      atPct = Math.max(0, 100 - gcPct);
      otherPct = 0;
    }

    var box = h("div", "display:flex;flex-wrap:wrap;gap:18px;align-items:center;border:1px solid rgba(128,128,128,.35);border-radius:14px;padding:14px;margin:12px 0");
    box.id = "bioResultChart";

    // Donut
    var left = h("div", "text-align:center;min-width:150px");
    var R = 52, CIRC = 2 * Math.PI * R;
    var svg = s("svg", { viewBox: "0 0 140 140", width: "150", height: "150", role: "img", "aria-label": "GC va AT ulushi" });
    svg.appendChild(s("circle", { cx: 70, cy: 70, r: R, fill: "none", stroke: "rgba(128,128,128,.25)", "stroke-width": 18 }));
    var parts = [[gcPct, "#56dcc0"], [atPct, "#8b7cf6"], [otherPct, "#8a96a3"]];
    var offset = 0;
    parts.forEach(function (p) {
      var len = CIRC * p[0] / 100;
      if (len <= 0) return;
      svg.appendChild(s("circle", {
        cx: 70, cy: 70, r: R, fill: "none", stroke: p[1], "stroke-width": 18,
        "stroke-dasharray": len + " " + (CIRC - len),
        "stroke-dashoffset": -offset,
        transform: "rotate(-90 70 70)"
      }));
      offset += len;
    });
    svg.appendChild(s("text", { x: 70, y: 68, "text-anchor": "middle", "font-size": 22, "font-weight": 700, fill: "currentColor" }, gcPct.toFixed(1) + "%"));
    svg.appendChild(s("text", { x: 70, y: 88, "text-anchor": "middle", "font-size": 12, fill: "currentColor", opacity: .7 }, "GC"));
    left.appendChild(svg);

    var legend = h("div", "font-size:13px;line-height:1.7");
    function legendRow(color, label) {
      var r = h("div");
      r.appendChild(h("span", "display:inline-block;width:10px;height:10px;border-radius:50%;margin-right:6px;background:" + color));
      r.appendChild(document.createTextNode(label));
      legend.appendChild(r);
    }
    legendRow("#56dcc0", "GC " + gcPct.toFixed(2) + "%");
    legendRow("#8b7cf6", (isRna ? "AU " : "AT ") + atPct.toFixed(2) + "%");
    if (otherPct > 0.005) legendRow("#8a96a3", "Boshqa " + otherPct.toFixed(2) + "%");
    left.appendChild(legend);
    box.appendChild(left);

    // Base bars
    var right = h("div", "flex:1;min-width:200px");
    right.appendChild(h("div", "font-weight:600;margin-bottom:8px", "Nukleotidlar tarkibi (" + total + " ta)"));
    var bars = [["A", A, "#f6c85f"], ["C", C, "#56dcc0"], ["G", G, "#6aa6ff"], [isRna ? "U" : "T", T, "#ff8a8a"]];
    var max = Math.max.apply(null, bars.map(function (b) { return b[1]; })) || 1;
    bars.forEach(function (b) {
      var row = h("div", "display:flex;align-items:center;gap:8px;margin:6px 0;font-size:13px");
      row.appendChild(h("span", "width:14px;font-weight:700", b[0]));
      var track = h("div", "flex:1;height:14px;background:rgba(128,128,128,.2);border-radius:7px;overflow:hidden");
      track.appendChild(h("div", "height:100%;border-radius:7px;background:" + b[2] + ";width:" + (b[1] / max * 100).toFixed(1) + "%"));
      row.appendChild(track);
      row.appendChild(h("span", "min-width:64px;text-align:right", b[1] + " (" + (b[1] / total * 100).toFixed(1) + "%)"));
      right.appendChild(row);
    });
    box.appendChild(right);

    el.before(box);

    // Raw JSON hidden behind a toggle
    el.style.display = "none";
    var btn = h("button", "margin:0 0 10px;padding:8px 14px;border-radius:10px;border:1px solid rgba(128,128,128,.4);background:transparent;color:inherit;font-size:13px", "Xom JSON ni ko'rsatish");
    btn.id = "bioResultRawBtn";
    btn.type = "button";
    btn.addEventListener("click", function () {
      var hidden = el.style.display === "none";
      el.style.display = hidden ? "" : "none";
      btn.textContent = hidden ? "Xom JSON ni yashirish" : "Xom JSON ni ko'rsatish";
    });
    box.after(btn);
  }

  window.MedGenVisuals = { bioChart: bioChart };
})();
