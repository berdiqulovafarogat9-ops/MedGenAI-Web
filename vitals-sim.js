(function () {
  var API = window.MEDGEN_API_BASE || "https://medgenai-web-1.onrender.com/api/v1";
  var Core = window.VitalsCore;

  function token() { return sessionStorage.getItem("medgen_access_token") || ""; }
  async function call(path, method, body) {
    var res = await fetch(API + path, {
      method: method || "GET",
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + token() },
      body: body ? JSON.stringify(body) : undefined
    });
    var data = {};
    try { data = await res.json(); } catch (e) {}
    if (!res.ok) { throw new Error(typeof data.detail === "string" ? data.detail : "Xatolik (" + res.status + ")"); }
    return data;
  }
  function el(tag, css, text) {
    var n = document.createElement(tag);
    (css || "").split(";").forEach(function (d) {
      var i = d.indexOf(":");
      if (i > 0) n.style.setProperty(d.slice(0, i).trim(), d.slice(i + 1).trim(), "important");
    });
    if (text !== undefined) n.textContent = text;
    return n;
  }
  var CARD = "background:#0d1a26;color:#e8f0f6;border:1px solid #24394d;border-radius:18px;padding:16px;width:min(96vw,640px);max-height:94vh;overflow:auto;font-family:system-ui,sans-serif";
  var BTN = "padding:10px 14px;border:0;border-radius:10px;background:#56dcc0;color:#06231d;font-weight:700;font-size:14px;margin:4px 4px 4px 0";
  var BTN2 = "padding:9px 12px;border:1px solid #24394d;border-radius:10px;background:#13222f;color:#cfe0ec;font-size:13px;margin:4px 4px 4px 0;text-align:left";
  var TILE = "flex:1;min-width:120px;background:#06101a;border:1px solid #1d3042;border-radius:12px;padding:8px";

  // ECG: P-QRS-T template; st=true adds ST elevation. Phase advances continuously with heart rate.
  function g(x, mu, sig) { return Math.exp(-0.5 * Math.pow((x - mu) / sig, 2)); }
  function ecgValue(p, st) {
    var f = p - Math.floor(p);
    return 0.12 * g(f, 0.10, 0.03) - 0.12 * g(f, 0.19, 0.012) + 1.0 * g(f, 0.22, 0.010)
      - 0.25 * g(f, 0.25, 0.012) + (st ? 0.22 : 0) * g(f, 0.31, 0.05) + 0.30 * g(f, 0.47, 0.06);
  }

  function open() {
    var overlay = el("div", "position:fixed;inset:0;background:rgba(0,0,0,.75);display:flex;align-items:center;justify-content:center;z-index:99999");
    var card = el("div", CARD);
    overlay.appendChild(card);
    document.body.appendChild(overlay);
    var sim = null, timer = null, raf = null, penalty = 0, lastPenaltyAt = 0, running = false;
    var alertBox = el("div", "display:none;background:#b00020;color:#fff;font-weight:700;padding:10px;border-radius:10px;margin-bottom:8px");
    card.appendChild(alertBox);

    function closeAll() {
      running = false;
      if (timer) clearInterval(timer);
      if (raf) cancelAnimationFrame(raf);
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("blur", onBlur);
      overlay.remove();
    }
    overlay.addEventListener("click", function (e) { if (e.target === overlay && !running) closeAll(); });

    function flash(text) {
      alertBox.textContent = text; alertBox.style.display = "block";
      setTimeout(function () { alertBox.style.display = "none"; }, 2500);
    }
    function penalize() {
      var now = Date.now();
      if (!running || now - lastPenaltyAt < 800) return;   // one switch can fire both events
      lastPenaltyAt = now; penalty += 1;
      flash("Imtihon oynasidan chiqdingiz! -" + 15 + " ball (jami: " + penalty + " marta)");
      updateHud();
    }
    function onVis() { if (document.hidden) penalize(); }
    function onBlur() { penalize(); }

    function showStart() {
      card.innerHTML = ""; card.appendChild(alertBox);
      card.appendChild(el("h3", "margin:0 0 6px;font-size:20px", "Virtual bemor"));
      card.appendChild(el("p", "color:#8fa3b5;font-size:13px;margin:0 0 10px", "Ta'lim uchun simulyatsiya. Bemorni 3 daqiqa ichida barqarorlashtiring. Imtihon davomida boshqa oynaga o'tsangiz, har bir marta -15 ball."));
      var list = el("div", "");
      card.appendChild(list);
      var close = el("button", BTN2 + ";width:100%;text-align:center", "Yopish"); close.onclick = closeAll; card.appendChild(close);
      call("/clinical/vitals/cases").then(function (data) {
        data.cases.forEach(function (c) {
          var box = el("div", "border:1px solid #24394d;border-radius:12px;padding:10px;margin:8px 0");
          box.appendChild(el("div", "font-weight:700", c.title + " · " + c.level));
          box.appendChild(el("div", "color:#8fa3b5;font-size:13px;margin:4px 0 8px", c.story));
          var go = el("button", BTN, "Boshlash"); go.onclick = function () { start(c); };
          box.appendChild(go); list.appendChild(box);
        });
      }).catch(function (e) { list.appendChild(el("p", "color:#ff8a8a", e.message)); });
    }

    var hud, tiles = {}, canvas, actionsBox, logBox, endBox;
    function start(c) {
      card.innerHTML = ""; card.appendChild(alertBox);
      card.appendChild(el("h3", "margin:0 0 4px;font-size:18px", c.title));
      card.appendChild(el("p", "color:#8fa3b5;font-size:13px;margin:0 0 8px", c.story));
      hud = el("div", "display:flex;gap:8px;align-items:center;justify-content:space-between;margin-bottom:6px;font-size:13px");
      var timeLbl = el("span", "color:#f6c85f", "");
      var penLbl = el("span", "color:#ff8a8a", "");
      hud.appendChild(timeLbl); hud.appendChild(penLbl); card.appendChild(hud);
      hud.time = timeLbl; hud.pen = penLbl;

      canvas = document.createElement("canvas");
      canvas.width = 800; canvas.height = 150;
      canvas.style.cssText = "width:100%;height:auto;background:#020a12;border:1px solid #1d3042;border-radius:12px";
      card.appendChild(canvas);

      var row = el("div", "display:flex;gap:8px;flex-wrap:wrap;margin:8px 0");
      ["hr", "bp", "spo2", "rr"].forEach(function (k) {
        var t = el("div", TILE); var lbl = el("div", "font-size:11px;color:#8fa3b5", {hr:"Puls (bpm)",bp:"Qon bosimi (mmHg)",spo2:"SpO₂ (%)",rr:"Nafas (/daq)"}[k]);
        var val = el("div", "font-size:26px;font-weight:700", "–");
        t.appendChild(lbl); t.appendChild(val); row.appendChild(t); tiles[k] = val;
      });
      card.appendChild(row);

      actionsBox = el("div", "margin:6px 0");
      card.appendChild(el("div", "font-size:13px;color:#8fa3b5;margin-top:6px", "Harakatlar (har biri bir marta):"));
      card.appendChild(actionsBox);
      logBox = el("div", "font-size:12px;color:#8fa3b5;max-height:90px;overflow:auto;border-top:1px solid #1d3042;margin-top:6px;padding-top:6px");
      card.appendChild(logBox);
      endBox = el("div", "margin-top:8px");
      card.appendChild(endBox);

      sim = Core.create(c);
      c.actions.forEach(function (a) {
        var b = el("button", BTN2, a.label);
        b.dataset.id = a.id;
        b.onclick = function () {
          var r = sim.act(a.id);
          if (!r.ok) return;
          b.disabled = true; b.style.opacity = ".45";
          logBox.appendChild(el("div", "", "[" + sim.s + " s] " + a.label));
          render();
        };
        actionsBox.appendChild(b);
      });

      penalty = 0; running = true; lastPenaltyAt = 0;
      document.addEventListener("visibilitychange", onVis);
      window.addEventListener("blur", onBlur);
      timer = setInterval(function () {
        if (!running) return;
        sim.tick();
        if (sim.ended) return finish();
        render();
      }, 1000);
      var last = performance.now(), phase = 0, nextSample = 0, buf = [];
      var W = canvas.width, H = canvas.height, ctx = canvas.getContext("2d");
      function frame(now) {
        if (!running) return;
        var dt = (now - last) / 1000; last = now;
        var hr = sim.state.hr;
        var step = 1 / 100;
        nextSample += dt;
        while (nextSample >= step) {
          nextSample -= step;
          phase += (hr / 60) * step;
          buf.push(ecgValue(phase, c.ecg === "st_elev"));
          if (buf.length > W) buf.shift();
        }
        ctx.fillStyle = "#020a12"; ctx.fillRect(0, 0, W, H);
        ctx.strokeStyle = "#56dcc0"; ctx.lineWidth = 2; ctx.beginPath();
        for (var i = 0; i < buf.length; i++) {
          var x = (i / W) * W, y = H / 2 - buf[i] * (H * 0.36);
          if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.stroke();
        raf = requestAnimationFrame(frame);
      }
      raf = requestAnimationFrame(frame);
      render();
    }

    function render() {
      if (!sim) return;
      var s = sim.state;
      var bad = function (ok) { return ok ? "#e8f0f6" : "#ff8a8a"; };
      tiles.hr.textContent = Math.round(s.hr); tiles.hr.style.color = bad(s.hr >= 60 && s.hr <= 100);
      tiles.bp.textContent = Math.round(s.sbp) + "/" + Math.round(s.dbp); tiles.bp.style.color = bad(s.sbp >= 100 && s.dbp >= 60);
      tiles.spo2.textContent = Math.round(s.spo2); tiles.spo2.style.color = bad(s.spo2 >= 94);
      tiles.rr.textContent = Math.round(s.rr); tiles.rr.style.color = bad(s.rr >= 12 && s.rr <= 20);
      updateHud();
    }
    function updateHud() {
      if (!hud || !sim) return;
      var left = Math.max(0, Core.MAX - sim.s);
      hud.time.textContent = "Qolgan vaqt: " + String(Math.floor(left / 60)).padStart(2, "0") + ":" + String(left % 60).padStart(2, "0");
      hud.pen.textContent = penalty ? "Jarima: -" + (15 * penalty) + " ball" : "Jarima: yo'q";
    }

    function finish() {
      running = false;
      clearInterval(timer); cancelAnimationFrame(raf);
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("blur", onBlur);
      actionsBox.querySelectorAll("button").forEach(function (b) { b.disabled = true; });
      endBox.innerHTML = "";
      endBox.appendChild(el("div", "font-weight:700;margin-bottom:6px", sim.stabilized ? "Bemor " + sim.stabAt + " soniyada barqarorlashdi." : "Vaqt tugadi. Bemor barqarorlashmadi."));
      endBox.appendChild(el("div", "font-size:13px;color:#8fa3b5;margin-bottom:6px", "Tashxisni tanlang:"));
      var group = "dx" + Date.now();
      sim.def.diagnosis_options.forEach(function (opt, i) {
        var lab = el("label", "display:block;font-size:14px;margin:4px 0");
        var rb = document.createElement("input"); rb.type = "radio"; rb.name = group; rb.value = i;
        lab.appendChild(rb); lab.appendChild(document.createTextNode(" " + opt));
        endBox.appendChild(lab);
      });
      var submit = el("button", BTN, "Hisobotni olish");
      submit.onclick = async function () {
        var picked = endBox.querySelector("input:checked");
        submit.disabled = true;
        try {
          var rep = await call("/clinical/vitals/report", "POST", {
            case_id: sim.def.id, diagnosis: picked ? parseInt(picked.value, 10) : -1,
            actions: sim.log, tab_switches: penalty
          });
          showReport(rep);
        } catch (e) { submit.disabled = false; alertBox.style.background = "#b00020"; flash(e.message); }
      };
      endBox.appendChild(submit);
    }

    function showReport(r) {
      card.innerHTML = "";
      card.appendChild(el("h3", "margin:0 0 6px;font-size:20px", "Klinik hisobot: " + r.title));
      card.appendChild(el("div", "font-size:34px;font-weight:800;color:#56dcc0", r.score + " / 100"));
      var b = r.breakdown;
      card.appendChild(el("p", "color:#8fa3b5;font-size:13px;margin:6px 0",
        "Majburiy harakatlar: " + b.required_done + "/" + b.required_total + " · Tashxis: " + (b.diagnosis_correct ? "to'g'ri" : "noto'g'ri") +
        " · Barqarorlashuv: " + (r.stabilized ? r.stabilized_at_s + " s" : "yo'q") + " · Tab jarimasi: -" + b.tab_penalty));
      r.audit.forEach(function (a) {
        var color = a.type === "harm" || a.type === "missed" ? "#ffb3b3" : a.type === "tab" || a.type === "duplicate" ? "#f6c85f" : "#cfe0ec";
        var item = el("div", "border-left:3px solid " + color + ";padding:6px 10px;margin:8px 0;font-size:13px");
        var head = (a.t !== null && a.t !== undefined ? "[" + a.t + " s] " : "") + a.action;
        item.appendChild(el("div", "font-weight:700;color:" + color, head));
        item.appendChild(el("div", "color:#dbe7f0", a.text));
        card.appendChild(item);
      });
      card.appendChild(el("p", "color:#8fa3b5;font-size:12px;margin-top:10px", r.disclaimer));
      card.appendChild(el("p", "color:#8fa3b5;font-size:12px", "Ball faollik reytingiga qo'shiladi (keys kuniga bir marta)."));
      var again = el("button", BTN2, "Yana urinish"); again.onclick = showStart; card.appendChild(again);
      var close = el("button", BTN2, "Yopish"); close.onclick = closeAll; card.appendChild(close);
    }

    showStart();
  }

  function init() {
    var logout = document.getElementById("logoutBtn");
    if (!logout || document.getElementById("vitalsBtn")) return;
    var b = document.createElement("button");
    b.id = "vitalsBtn"; b.type = "button"; b.className = logout.className; b.textContent = "Virtual bemor";
    b.addEventListener("click", open);
    logout.parentNode.insertBefore(b, logout);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
})();
