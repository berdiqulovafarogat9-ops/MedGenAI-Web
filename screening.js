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
    card.appendChild(el("p", "color:#8fa3b5;font-size:13px;margin:0 0 8px", "HIV-1 proteaza (1HSG) uchun retseptor serverdan avtomatik olinadi; planshetdan fayl yuklash shart emas. Natijalar hisoblash dalili, eksperimental tasdiq emas."));

    var target = el("input", FIELD); target.placeholder = "Nishon nomi (masalan, HIV-1 Protease / 1HSG)"; target.value = "HIV-1 Protease (1HSG)"; card.appendChild(target);

    card.appendChild(el("label", LBL, "Retseptor (.pdbqt, ixtiyoriy — server avtomatik tanlaydi)"));
    var rec = el("input", FIELD); rec.type = "file"; rec.accept = ".pdbqt,.txt"; card.appendChild(rec);

    card.appendChild(el("label", LBL, "Docking qutisi: markaz (x, y, z) va o'lcham (Å)"));
    var grid = el("div", "display:grid;grid-template-columns:repeat(3,1fr);gap:6px");
    var ids = ["cx", "cy", "cz", "sx", "sy", "sz"], inputs = {};
    ids.forEach(function (k, i) {
      var inp = el("input", FIELD); inp.type = "number"; inp.step = "any";
      inp.placeholder = (i < 3 ? "centr " : "o'lcham ") + ["x", "y", "z"][i % 3];
      if (i >= 3) inp.value = "20"; else inp.value = ["16.0", "25.0", "4.0"][i];
      inputs[k] = inp; grid.appendChild(inp);
    });
    card.appendChild(grid);
    var gridNote = el("div", "font-size:12px;color:#56dcc0;margin-top:2px", "1HSG standart grid: markaz (16, 25, 4) Å · o‘lcham 20 × 20 × 20 Å"); card.appendChild(gridNote);
    function applyHivDefaults() { var t = target.value.toLowerCase(); if (t.indexOf("hiv") !== -1 || t.indexOf("oiv") !== -1 || t.indexOf("1hsg") !== -1 || t.indexOf("protease") !== -1) { ["16.0","25.0","4.0","20","20","20"].forEach(function(v,i){ inputs[ids[i]].value = v; }); gridNote.textContent = "HIV-1 proteaza (1HSG): standart grid avtomatik qo‘llanmoqda."; } }
    target.addEventListener("change", applyHivDefaults); target.addEventListener("input", applyHivDefaults);

    card.appendChild(el("label", LBL, "Ligandlar: SMILES (har qatorda bittadan: nom,SMILES yoki faqat SMILES)"));
    var smi = el("textarea", FIELD + ";min-height:80px;font-family:monospace"); smi.placeholder = "aspirin,CC(=O)OC1=CC=CC=C1C(=O)O\nibuprofen,CC(C)CC1=CC=C(C=C1)C(C)C(=O)O"; card.appendChild(smi);
    card.appendChild(el("label", LBL, "yoki tayyor ligand fayllari (.pdbqt, ixtiyoriy)"));
    var ligs = el("input", FIELD); ligs.type = "file"; ligs.multiple = true; ligs.accept = ".pdbqt,.txt"; card.appendChild(ligs);

    var showcase = el("button", BTN2, "⚡ Tayyor OIV-1 tahlilini yuklash (Showcase)");
    showcase.style.setProperty("color", "#b7f7d5", "important");
    showcase.onclick = function () {
      out.innerHTML = "";
      msg.style.setProperty("color", "#56dcc0", "important");
      msg.textContent = "Taqdimot rejimi: oldindan tayyorlangan namunaviy ma’lumotlar. Yangi docking hisoblanmadi.";
      var wrap = el("div", "display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:10px;margin-top:12px");
      var ind = el("article", "background:#06251d;border:1px solid #1d7656;border-radius:14px;padding:14px");
      ind.appendChild(el("div", "font-size:12px;color:#9bd8bd", "OIV-1 proteaza · 1HSG"));
      ind.appendChild(el("h4", "margin:6px 0;color:#e8f0f6", "Indinavir — namunaviy ligand"));
      ind.appendChild(el("div", "font-size:30px;font-weight:900;color:#4ade80", "−5.77 kkal/mol"));
      ind.appendChild(el("p", "font-size:12px;color:#b8d7c8", "Demo uchun berilgan Vina ko‘rsatkichi; real qayta hisoblash emas."));
      var asp = el("article", "background:#13222f;border:1px solid #29465d;border-radius:14px;padding:14px");
      asp.appendChild(el("div", "font-size:12px;color:#9fb3c4", "Nazorat birikmasi"));
      asp.appendChild(el("h4", "margin:6px 0;color:#e8f0f6", "Aspirin — reference control"));
      asp.appendChild(el("div", "font-size:20px;font-weight:800;color:#cbd5e1", "Affinity: hisoblanmagan"));
      asp.appendChild(el("p", "font-size:12px;color:#9fb3c4", "Taqqoslash uchun nazorat ligand. Bu oynada sun’iy docking balli ko‘rsatilmaydi."));
      var lip = el("article", "background:#13222f;border:1px solid #29465d;border-radius:14px;padding:14px");
      lip.appendChild(el("h4", "margin:0 0 8px;color:#e8f0f6", "Lipinski ko‘rsatkichlari"));
      [["Indinavir","MW 613.79 Da · LogP ~3.1 · HBD 4 · HBA 7"],["Aspirin","MW 180.16 Da · LogP ~1.2 · HBD 1 · HBA 4"]].forEach(function(x){lip.appendChild(el("b","display:block;color:#cfe0ec;margin-top:6px",x[0]));lip.appendChild(el("div","font-size:12px;color:#9fb3c4",x[1]));});
      wrap.appendChild(ind); wrap.appendChild(asp); wrap.appendChild(lip); out.appendChild(wrap);
      var details = el("details", "margin-top:10px;border:1px solid #294052;border-radius:10px;padding:10px");
      details.appendChild(el("summary", "cursor:pointer;color:#9fb3c4", "Xom demo JSON / metodik izoh"));
      var pre = el("pre", "white-space:pre-wrap;overflow-wrap:anywhere;max-height:260px;overflow:auto;font-size:11px;color:#b8c7d6");
      pre.textContent = JSON.stringify({mode:"SHOWCASE_PRECOMPUTED",target:"HIV-1 protease 1HSG",ligands:[{name:"Indinavir",affinity_kcal_mol:-5.77,source:"user-provided demo preset"},{name:"Aspirin",role:"reference control",affinity_kcal_mol:null}],note:"Not a live docking run; validate all scientific claims independently."},null,2);
      details.appendChild(pre); out.appendChild(details);
    };
    card.appendChild(showcase);

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
      var summary = el("div", "display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:8px;margin:10px 0");
      var best = ok.length ? ok.reduce(function(a,b){return a.affinity_kcal_mol < b.affinity_kcal_mol ? a : b;}) : null;
      var energy = el("article", "background:#06251d;border:1px solid #1d7656;border-radius:12px;padding:12px");
      energy.appendChild(el("small", "color:#9bd8bd", "Eng yaxshi bog‘lanish energiyasi · ΔG"));
      energy.appendChild(el("div", "font-size:25px;font-weight:900;color:#4ade80", best ? best.affinity_kcal_mol.toFixed(2) + " kkal/mol" : "—"));
      energy.appendChild(el("small", "color:#b8d7c8", best ? best.name : "Muvaffaqiyatli ligand yo‘q"));
      var count = el("article", "background:#13222f;border:1px solid #29465d;border-radius:12px;padding:12px");
      count.appendChild(el("small", "color:#9fb3c4", "Hisoblash yakuni"));
      count.appendChild(el("div", "font-size:25px;font-weight:900;color:#e8f0f6", ok.length + " / " + job.total));
      count.appendChild(el("small", "color:#9fb3c4", "muvaffaqiyatli ligand"));
      summary.appendChild(energy); summary.appendChild(count); out.appendChild(summary);
      out.appendChild(table);
      var raw = el("details", "margin-top:10px;border:1px solid #294052;border-radius:10px;padding:10px");
      raw.appendChild(el("summary", "cursor:pointer;color:#9fb3c4", "Xom JSON / texnik tafsilotlar"));
      var pre = el("pre", "white-space:pre-wrap;overflow-wrap:anywhere;max-height:280px;overflow:auto;font-size:11px;color:#b8c7d6"); pre.textContent = JSON.stringify(job, null, 2); raw.appendChild(pre); out.appendChild(raw);
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
        // Receptor is selected automatically on the server; file upload is optional.
        var smilesLines = smi.value.split("\n").map(function (x) { return x.trim(); }).filter(Boolean);
        if (!ligs.files.length && !smilesLines.length) throw new Error("SMILES kiriting yoki ligand faylini tanlang.");
        var vals = {};
        ids.forEach(function (k) { vals[k] = parseFloat(inputs[k].value); });
        if (ids.some(function (k) { return !isFinite(vals[k]); })) throw new Error("Qutining barcha 6 qiymatini kiriting.");
        run.disabled = true; msg.textContent = "Fayllar o'qilmoqda...";
        var receptor = rec.files.length ? await readText(rec.files[0]) : "";
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
