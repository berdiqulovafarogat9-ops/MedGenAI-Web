(function () {
  var API = window.MEDGEN_API_BASE || "https://medgenai-web-1.onrender.com/api/v1";
  var ALLOWED = ["PHARMA", "RESEARCHER", "BIOINFORMATICIAN", "BIOTECH", "SUPER_ADMIN", "ADMIN"];

  function token() { return sessionStorage.getItem("medgen_access_token") || ""; }

  async function call(path, method, body) {
    var res = await fetch(API + path, {
      method: method || "GET",
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + token() },
      body: body ? JSON.stringify(body) : undefined
    });
    var data = {};
    try { data = await res.json(); } catch (e) {}
    if (!res.ok) {
      var d = data.detail;
      throw new Error(typeof d === "string" ? d : "Xatolik (" + res.status + ")");
    }
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

  function readText(file) {
    return new Promise(function (resolve, reject) {
      var r = new FileReader();
      r.onload = function () { resolve(String(r.result || "")); };
      r.onerror = function () { reject(new Error("Faylni o'qib bo'lmadi: " + file.name)); };
      r.readAsText(file);
    });
  }

  var CARD = "background:#13222f;color:#e8f0f6;border:1px solid #24394d;border-radius:20px;padding:20px;width:min(94vw,560px);max-height:92vh;overflow:auto;font-family:system-ui,sans-serif";
  var FIELD = "width:100%;padding:10px;border-radius:10px;border:1px solid #24394d;background:#182b3d;color:#e8f0f6;font-size:15px;margin:4px 0 8px";
  var BTN = "width:100%;padding:13px;border:0;border-radius:12px;background:#56dcc0;color:#06231d;font-weight:700;font-size:15px;margin-top:8px";
  var BTN2 = "width:100%;padding:12px;border:1px solid #24394d;border-radius:12px;background:transparent;color:#8fa3b5;font-size:14px;margin-top:8px";
  var LBL = "display:block;font-size:13px;color:#8fa3b5;margin-top:6px";

  function open() {
    var overlay = el("div", "position:fixed;inset:0;background:rgba(0,0,0,.7);display:flex;align-items:center;justify-content:center;z-index:99999");
    var card = el("div", CARD);
    overlay.appendChild(card);
    overlay.addEventListener("click", function (e) { if (e.target === overlay) overlay.remove(); });
    document.body.appendChild(overlay);

    card.appendChild(el("h3", "margin:0 0 6px;font-size:20px;color:#e8f0f6", "Virtual skrining (AutoDock Vina)"));
    card.appendChild(el("p", "color:#8fa3b5;font-size:13px;margin:0 0 8px", "Retseptor va ligandlar tayyorlangan PDBQT formatida bo'lishi kerak. Natijalar hisoblash dalili, eksperimental tasdiq emas."));

    var target = el("input", FIELD); target.placeholder = "Nishon nomi (masalan, EGFR)"; card.appendChild(target);

    card.appendChild(el("label", LBL, "Retseptor (.pdbqt)"));
    var rec = el("input", FIELD); rec.type = "file"; rec.accept = ".pdbqt,.txt"; card.appendChild(rec);

    card.appendChild(el("label", LBL, "Docking qutisi: markaz (x, y, z) va o'lcham (Å)"));
    var grid = el("div", "display:grid;grid-template-columns:repeat(3,1fr);gap:6px");
    var ids = ["cx", "cy", "cz", "sx", "sy", "sz"], inputs = {};
    ids.forEach(function (k, i) {
      var inp = el("input", FIELD); inp.type = "number"; inp.step = "any";
      inp.placeholder = (i < 3 ? "centr " : "o'lcham ") + ["x", "y", "z"][i % 3];
      if (i >= 3) inp.value = "20";
      inputs[k] = inp; grid.appendChild(inp);
    });
    card.appendChild(grid);

    card.appendChild(el("label", LBL, "Ligandlar: SMILES (har qatorda bittadan: nom,SMILES yoki faqat SMILES)"));
    var smi = el("textarea", FIELD + ";min-height:80px;font-family:monospace"); smi.placeholder = "aspirin,CC(=O)OC1=CC=CC=C1C(=O)O\nibuprofen,CC(C)CC1=CC=C(C=C1)C(C)C(=O)O"; card.appendChild(smi);
    card.appendChild(el("label", LBL, "yoki tayyor ligand fayllari (.pdbqt, ixtiyoriy)"));
    var ligs = el("input", FIELD); ligs.type = "file"; ligs.multiple = true; ligs.accept = ".pdbqt,.txt"; card.appendChild(ligs);

    var run = el("button", BTN, "Skriningni boshlash"); card.appendChild(run);
    var msg = el("div", "min-height:20px;margin-top:10px;font-size:14px;color:#ff8a8a"); card.appendChild(msg);
    var out = el("div", "margin-top:8px"); card.appendChild(out);
    var close = el("button", BTN2, "Yopish"); close.onclick = function () { stop = true; overlay.remove(); }; card.appendChild(close);

    var stop = false;

    function showResults(job) {
      out.innerHTML = "";
      var ok = job.results.filter(function (r) { return r.affinity_kcal_mol !== undefined; });
      var bad = job.results.filter(function (r) { return r.affinity_kcal_mol === undefined; });
      var table = el("table", "width:100%;border-collapse:collapse;font-size:13px");
      var head = el("tr"); ["#", "Ligand", "Affinity (kkal/mol)"].forEach(function (h) { head.appendChild(el("th", "text-align:left;border-bottom:1px solid #24394d;padding:6px", h)); });
      table.appendChild(head);
      ok.forEach(function (r) {
        var tr = el("tr");
        [r.rank, r.name, r.affinity_kcal_mol.toFixed(2)].forEach(function (v) { tr.appendChild(el("td", "padding:6px;border-bottom:1px solid #1d3042", String(v))); });
        table.appendChild(tr);
      });
      out.appendChild(table);
      if (bad.length) out.appendChild(el("p", "color:#ff8a8a;font-size:12px", "Bajarilmadi: " + bad.map(function (b) { return b.name + " (" + b.error + ")"; }).join(", ")));
      if (ok.length) {
        var csv = el("button", BTN2, "CSV yuklab olish");
        csv.onclick = function () {
          var lines = ["rank,name,smiles,affinity_kcal_mol"].concat(ok.map(function (r) {
            return [r.rank, JSON.stringify(r.name), JSON.stringify(r.smiles || ""), r.affinity_kcal_mol].join(",");
          }));
          var a = document.createElement("a");
          a.href = URL.createObjectURL(new Blob([lines.join("\n")], { type: "text/csv" }));
          a.download = "screening-" + job.id + ".csv";
          document.body.appendChild(a); a.click(); a.remove();
        };
        out.appendChild(csv);
      }
    }

    async function poll(jobId) {
      while (!stop) {
        var job = await call("/screening/" + jobId);
        msg.style.setProperty("color", "#56dcc0", "important");
        msg.textContent = "Bajarildi: " + job.done + " / " + job.total + (job.status === "running" ? " ..." : "");
        showResults(job);
        if (job.status !== "running") { run.disabled = false; return; }
        await new Promise(function (r) { setTimeout(r, 4000); });
      }
    }

    run.onclick = async function () {
      msg.style.setProperty("color", "#ff8a8a", "important");
      msg.textContent = "";
      try {
        if (!target.value.trim()) throw new Error("Nishon nomini kiriting.");
        if (!rec.files.length) throw new Error("Retseptor faylini tanlang.");
        var smilesLines = smi.value.split("\n").map(function (x) { return x.trim(); }).filter(Boolean);
        if (!ligs.files.length && !smilesLines.length) throw new Error("SMILES kiriting yoki ligand faylini tanlang.");
        var vals = {};
        ids.forEach(function (k) { vals[k] = parseFloat(inputs[k].value); });
        if (ids.some(function (k) { return !isFinite(vals[k]); })) throw new Error("Qutining barcha 6 qiymatini kiriting.");
        run.disabled = true; msg.textContent = "Fayllar o'qilmoqda...";
        var receptor = await readText(rec.files[0]);
        var list = smilesLines.map(function (line, idx) {
          var parts = line.split(",");
          var name = parts.length > 1 ? parts.shift().trim() : "ligand" + (idx + 1);
          return { name: name.slice(0, 80), smiles: parts.join(",").trim() };
        });
        for (var i = 0; i < ligs.files.length; i++) {
          var f = ligs.files[i];
          list.push({ name: f.name.replace(/\.[^.]+$/, "").slice(0, 80), ligand_pdbqt: await readText(f) });
        }
        var r = await call("/screening/run", "POST", {
          target: target.value.trim(), receptor_pdbqt: receptor,
          center_x: vals.cx, center_y: vals.cy, center_z: vals.cz,
          size_x: vals.sx, size_y: vals.sy, size_z: vals.sz, ligands: list
        });
        await poll(r.job_id);
      } catch (e) { msg.textContent = e.message; run.disabled = false; }
    };
  }

  function sync() {
    var badge = document.getElementById("roleBadge");
    var logout = document.getElementById("logoutBtn");
    var btn = document.getElementById("screeningBtn");
    if (!badge || !logout) return;
    var allowed = ALLOWED.indexOf((badge.textContent || "").trim().toUpperCase()) !== -1;
    if (allowed && !btn) {
      btn = document.createElement("button");
      btn.id = "screeningBtn"; btn.type = "button"; btn.className = logout.className; btn.textContent = "Skrining";
      btn.addEventListener("click", open);
      logout.parentNode.insertBefore(btn, logout);
    } else if (!allowed && btn) {
      btn.remove();
    }
  }

  function init() {
    sync();
    var badge = document.getElementById("roleBadge");
    if (badge) new MutationObserver(sync).observe(badge, { childList: true, characterData: true, subtree: true });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
})();
