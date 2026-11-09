/* MedGen AI — Drug Discovery research workspace.
   Uses authenticated API results only; never fabricates docking scores. */
(function () {
  "use strict";
  const API = (window.MEDGEN_API_BASE || "https://medgenai-web-1.onrender.com/api/v1").replace(/\/$/, "");
  const token = () => sessionStorage.getItem("medgen_access_token") || "";
  const headers = () => ({ "Content-Type": "application/json", "Authorization": "Bearer " + token() });
  let targets = [];
  let viewer = null;
  let dockedLigandModel = null;
  let hivViewer = null;
  let hivPoseModel = null;
  let mounted = false;

  async function api(path, options) {
    const response = await fetch(API + path, { ...(options || {}), headers: { ...headers(), ...((options || {}).headers || {}) } });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.detail || ("HTTP " + response.status));
    return data;
  }
  const esc = value => String(value == null ? "" : value).replace(/[&<>"']/g, c => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[c]));
  const byId = id => document.getElementById(id);

  function setStatus(message, isError) {
    const el = byId("mgdd-status");
    if (el) { el.textContent = message; el.style.color = isError ? "#fca5a5" : "#bae6fd"; }
  }

  function renderShell(root) {
    root.innerHTML = `
      <section class="mgdd-shell">
        <header class="mgdd-header">
          <div><div class="mgdd-kicker">MEDGEN AI • RESEARCH CORE</div><h2>🧬 OIV va onkologiya — Drug Discovery</h2>
          <p>Biologik nishon → ligand tayyorlash → receptor PDBQT → AutoDock Vina</p></div>
          <span class="mgdd-tag">Hisoblash laboratoriyasi</span>
        </header>
        <div class="mgdd-grid">
          <section class="mgdd-card">
            <label for="mgdd-target">Biologik nishon</label>
            <select id="mgdd-target"></select>
            <div id="mgdd-target-info" class="mgdd-note">Nishon ma’lumotlari yuklanmoqda…</div>
            <div class="mgdd-viewer-wrap"><div id="mgdd-viewer"></div><span>RCSB PDB • 3D strukturaviy ko‘rinish</span></div>
            <a id="mgdd-rcsb-link" href="https://www.rcsb.org" target="_blank" rel="noopener noreferrer">RCSB PDB yozuvini ochish ↗</a>
          </section>
          <section class="mgdd-card">
            <label for="mgdd-smiles">Ligand SMILES</label>
            <textarea id="mgdd-smiles" rows="3" spellcheck="false">CC(=O)OC1=CC=CC=C1C(=O)O</textarea>
            <button id="mgdd-prepare" type="button" class="mgdd-primary">RDKit + Meeko: ligandni PDBQT tayyorlash</button>
            <div id="mgdd-ligand-status" class="mgdd-note">SMILES kiriting va ligand tayyorlang.</div>
            <label for="mgdd-ligand-pdbqt">Ligand PDBQT (server tayyorlagan)</label>
            <textarea id="mgdd-ligand-pdbqt" rows="7" spellcheck="false" placeholder="PDBQT tayyorlangandan so‘ng shu yerda chiqadi"></textarea>
          </section>
        </div>
        <section class="mgdd-card mgdd-receptor">
          <h3>Avtomatik receptor va docking parametrlari</h3>
          <p class="mgdd-note">Receptor PDB strukturasi RCSB’dan serverga olinadi va Meeko orqali backend/targets/{PDB_ID}.pdbqt sifatida avtomatik tayyorlanadi. Qo‘lda fayl yuklash talab qilinmaydi.</p>
          <div class="mgdd-params">
            <label>Markaz X (Å)<input id="mgdd-cx" type="number" step="any"></label>
            <label>Markaz Y (Å)<input id="mgdd-cy" type="number" step="any"></label>
            <label>Markaz Z (Å)<input id="mgdd-cz" type="number" step="any"></label>
            <label>Quti X (Å)<input id="mgdd-sx" type="number" min="1" max="100" value="20"></label>
            <label>Quti Y (Å)<input id="mgdd-sy" type="number" min="1" max="100" value="20"></label>
            <label>Quti Z (Å)<input id="mgdd-sz" type="number" min="1" max="100" value="20"></label>
            <label>Exhaustiveness<input id="mgdd-exhaust" type="number" min="1" max="64" value="8"></label>
            <label>Pozalar<input id="mgdd-poses" type="number" min="1" max="20" value="3"></label>
          </div>
          <button id="mgdd-run" type="button" class="mgdd-primary" hidden>⚡ AutoDock Vina orqali bog‘lanish energiyasini hisoblash</button>
          <div id="mgdd-status" role="status" aria-live="polite" class="mgdd-status">Avval target va ligandni tanlang.</div>
        </section>
        <section class="mgdd-card">
          <h3>Docking natijalari</h3>
          <div id="mgdd-results" class="mgdd-results">Hali hisoblash bajarilmadi.</div>
          <p class="mgdd-disclaimer">Ilmiy ogohlantirish: Vina score — hisoblash natijasi, tajribada tasdiqlangan bog‘lanish energiyasi, dori samaradorligi, xavfsizligi yoki klinik tavsiya emas. RMSD va vodorod bog‘lari ushbu endpoint tomonidan hisoblanmasa, ular ko‘rsatilmaydi.</p>
        </section>
        <section class="mgdd-card" id="mgdd-hiv-lab">
          <h3>🧬 HIV Lab — haqiqiy proteaza docking</h3>
          <p class="mgdd-note">RDKit descriptor → Meeko PDBQT → RCSB 1HSG → AutoDock Vina. 1RTD hozircha receptor konteksti sababli research-only.</p>
          <div class="mgdd-params">
            <label>HIV nishoni<select id="mgdd-hiv-target"><option value="1HSG">1HSG — HIV-1 Protease homodimer</option><option value="1RTD" disabled>1RTD — Reverse Transcriptase (research-only)</option></select></label>
            <label>Ligand nomi<input id="mgdd-hiv-name" maxlength="80" value="MedGen candidate"></label>
            <label>Exhaustiveness<input id="mgdd-hiv-exhaust" type="number" min="1" max="64" value="8"></label>
            <label>Pozalar soni<input id="mgdd-hiv-poses" type="number" min="1" max="10" value="3"></label>
          </div>
          <label for="mgdd-hiv-smiles">Ligand SMILES</label>
          <textarea id="mgdd-hiv-smiles" rows="3" spellcheck="false">CC(=O)OC1=CC=CC=C1C(=O)O</textarea>
          <button id="mgdd-hiv-run" type="button" class="mgdd-primary">⚡ HIV-1 proteazaga docking hisoblash</button>
          <div id="mgdd-hiv-status" role="status" aria-live="polite" class="mgdd-status">1HSG strukturasi tayyorlanmoqda…</div>
          <div class="mgdd-viewer-wrap"><div id="mgdd-hiv-viewer" style="height:390px"></div><span>1HSG receptor + Vina ligand pose</span></div>
          <div id="mgdd-hiv-results" class="mgdd-results">Hali hisoblash bajarilmadi.</div>
          <p class="mgdd-disclaimer">Vina score tajribaviy binding affinity emas; natija eksperimental validatsiyani talab qiladi.</p>
        </section>
      </section>`;
    root.querySelectorAll("label").forEach(label => label.classList.add("mgdd-label"));
    byId("mgdd-target").addEventListener("change", () => selectTarget(byId("mgdd-target").value));
    byId("mgdd-prepare").addEventListener("click", prepareLigand);
    byId("mgdd-run").addEventListener("click", runDocking);
    byId("mgdd-hiv-run").addEventListener("click", runHivDocking);
  }

  async function loadTargets() {
    try {
      const data = await api("/drug-discovery/targets");
      targets = data.targets || [];
      const select = byId("mgdd-target");
      select.innerHTML = targets.map(t => `<option value="${esc(t.target_id)}">${esc(t.pdb_id)} — ${esc(t.target_name)}</option>`).join("");
      if (targets.length) await selectTarget(targets[0].target_id);
      setStatus("Targetlar katalogi yuklandi. Receptor serverda avtomatik tayyorlanadi.");
    } catch (error) {
      setStatus("Target katalogini yuklab bo‘lmadi: " + error.message, true);
    }
  }

  async function selectTarget(id) {
    const target = targets.find(t => t.target_id === id);
    if (!target) return;
    byId("mgdd-target-info").textContent = target.description + " | " + target.mutation_status + " | Co-crystal ligand: " + (target.co_crystal_ligand || "—");
    byId("mgdd-rcsb-link").href = target.rcsb_url;
    const box = target.grid_box;
    if (box) {
      ["cx","cy","cz","sx","sy","sz"].forEach((key, i) => {
        const field = byId("mgdd-" + key);
        const val = [box.center_x,box.center_y,box.center_z,box.size_x,box.size_y,box.size_z][i];
        if (val != null) field.value = val;
      });
      byId("mgdd-target-info").textContent += box.validated ? " | Grid tasdiqlangan." : " | DIQQAT: grid koordinatalari tasdiqlanmagan — dockingdan oldin tekshiring.";
    } else {
      ["cx","cy","cz"].forEach(key => byId("mgdd-" + key).value = "");
      byId("mgdd-target-info").textContent += " | Grid box yo‘q: co-crystal ligand cho‘ntagiga qarab koordinatalarni kiriting.";
    }
    await renderStructure(target);
  }

  async function renderStructure(target) {
    const host = byId("mgdd-viewer");
    host.innerHTML = "";
    if (!window.$3Dmol) {
      host.textContent = "3Dmol.js yuklanmagan. RCSB havolasi orqali strukturani ko‘ring.";
      return;
    }
    try {
      const response = await fetch(target.pdb_download_url);
      if (!response.ok) throw new Error("RCSB HTTP " + response.status);
      const pdb = await response.text();
      viewer = window.$3Dmol.createViewer(host, { backgroundColor: "#07111f" });
      viewer.addModel(pdb, "pdb");
      viewer.setStyle({ hetflag: false }, { cartoon: { color: "spectrum" } });
      viewer.addStyle({ hetflag: true }, { stick: { colorscheme: "Jmol" } });
      viewer.zoomTo();
      viewer.render();
    } catch (error) {
      host.textContent = "3D strukturani yuklab bo‘lmadi: " + error.message;
    }
  }

  async function prepareLigand() {
    const button = byId("mgdd-prepare");
    const smiles = byId("mgdd-smiles").value.trim();
    if (!smiles) return setStatus("SMILES kiriting.", true);
    button.disabled = true;
    byId("mgdd-ligand-status").textContent = "RDKit 3D konformatsiya va Meeko PDBQT tayyorlash…";
    try {
      const data = await api("/drug-discovery/prepare-ligand", { method: "POST", body: JSON.stringify({ smiles, ligand_name: "medgen_candidate" }) });
      byId("mgdd-ligand-pdbqt").value = data.pdbqt || "";
      byId("mgdd-ligand-status").textContent = "PDBQT tayyor. " + data.engine_compatibility + " uchun ligand.";
      byId("mgdd-run").hidden = false;
      setStatus("Ligand PDBQT tayyor. Endi AutoDock Vina hisoblashini boshlashingiz mumkin.");
    } catch (error) {
      byId("mgdd-ligand-status").textContent = error.message;
      setStatus("Ligand tayyorlashda xatolik.", true);
    } finally { button.disabled = false; }
  }

  async function runDocking() {
    const targetId = byId("mgdd-target").value;
    const target = targets.find(t => t.target_id === targetId);
    const ligand = byId("mgdd-ligand-pdbqt").value.trim();
    if (!target || !ligand) return setStatus("Target va ligand PDBQT tayyor bo‘lishi kerak.", true);
    const num = id => Number(byId("mgdd-" + id).value);
    const params = { center_x:num("cx"), center_y:num("cy"), center_z:num("cz"), size_x:num("sx"), size_y:num("sy"), size_z:num("sz"), exhaustiveness:num("exhaust"), n_poses:num("poses") };
    if (Object.values(params).some(v => !Number.isFinite(v)) || ["cx","cy","cz"].some(k => byId("mgdd-"+k).value.trim() === "")) return setStatus("Docking markazi X/Y/Z va barcha parametrlarni to‘ldiring.", true);
    const button = byId("mgdd-run");
    button.disabled = true;
    setStatus("AutoDock Vina hisoblayapti…");
    byId("mgdd-results").textContent = "Hisoblash bajarilmoqda…";
    try {
      const data = await api("/docking/run", { method: "POST", body: JSON.stringify({ target: target.target_id + " / " + target.pdb_id, target_id: target.target_id, ligand_smiles: byId("mgdd-smiles").value.trim(), ligand_pdbqt: ligand, ...params }) });
      const poses = data.result && data.result.poses || data.poses || [];
      const posesPdbqt = data.result && data.result.poses_pdbqt;
      const hbondEstimate = data.result && data.result.hbond_contacts_estimate;
      if (!poses.length) {
        byId("mgdd-results").textContent = JSON.stringify(data, null, 2);
      } else {
        byId("mgdd-results").innerHTML = `<p><b>Taxminiy polar / H-bond kontaktlari:</b> ${hbondEstimate == null ? "hisoblanmadi" : esc(hbondEstimate) + " (masofa mezoni; burchak tekshiruvisiz)"}</p>` + poses.map((pose, i) => `<article class="mgdd-pose"><b>Pose ${i+1}</b><strong>${esc(pose.affinity_kcal_mol)} kcal/mol</strong><small>Intermolecular: ${esc(pose.intermolecular_energy_kcal_mol)} · Intramolecular: ${esc(pose.intramolecular_energy_kcal_mol)}</small></article>`).join("");
      }
      if (viewer && posesPdbqt) {
        if (dockedLigandModel) { try { viewer.removeModel(dockedLigandModel); } catch (_) {} }
        dockedLigandModel = viewer.addModel(posesPdbqt, "pdb");
        if (dockedLigandModel && typeof dockedLigandModel.setStyle === "function") dockedLigandModel.setStyle({}, { stick: { colorscheme: "Jmol" } });
        viewer.zoomTo();
        viewer.render();
      }
      setStatus(posesPdbqt ? "Vina hisoblash tugadi; ligand pozalari 3D strukturaga qo‘shildi. Natija tajriba bilan tasdiqlanishi shart." : "Vina hisoblash tugadi. 3D pose ma’lumoti qaytmadi; natija tajriba bilan tasdiqlanishi shart.");
    } catch (error) {
      byId("mgdd-results").textContent = error.message;
      setStatus("Docking bajarilmadi: " + error.message, true);
    } finally { button.disabled = false; }
  }

  async function renderHivStructure() {
    const host = byId("mgdd-hiv-viewer");
    if (!host) return;
    host.innerHTML = "";
    if (!window.$3Dmol) { host.textContent = "3Dmol.js yuklanmagan."; return; }
    try {
      const response = await fetch("https://files.rcsb.org/download/1HSG.pdb");
      if (!response.ok) throw new Error("RCSB HTTP " + response.status);
      const pdb = await response.text();
      hivViewer = window.$3Dmol.createViewer(host, { backgroundColor: "#07111f" });
      hivViewer.addModel(pdb, "pdb");
      hivViewer.setStyle({ hetflag: false }, { cartoon: { color: "spectrum" } });
      hivViewer.addStyle({ resn: "MK1" }, { stick: { colorscheme: "Jmol" } });
      hivViewer.zoomTo({ hetflag: false }); hivViewer.render();
      byId("mgdd-hiv-status").textContent = "1HSG receptor va kristall ligand MK1 yuklandi. SMILES kiriting va dockingni boshlang.";
    } catch (error) { byId("mgdd-hiv-status").textContent = "1HSG strukturasi yuklanmadi: " + error.message; }
  }

  function renderHivMetrics(data, sourceLabel) {
    const lip = data.lipinski || {};
    const score = Number(data.affinity_kcal_mol);
    const rows = [
      ["Molekulyar og‘irlik (MW ≤ 500)", lip.mw, "Da", Number(lip.mw) <= 500],
      ["Lipofillik (LogP ≤ 5)", lip.logp, "", Number(lip.logp) <= 5],
      ["Vodorod donori (HBD ≤ 5)", lip.hbd, "", Number(lip.hbd) <= 5],
      ["Vodorod akseptori (HBA ≤ 10)", lip.hba, "", Number(lip.hba) <= 10]
    ];
    const contacts = Array.isArray(data.catalytic_contacts) ? data.catalytic_contacts : [];
    const contactText = contacts.length
      ? contacts.map(x => esc(typeof x === "string" ? x : (x.residue || x.name || JSON.stringify(x)))).join(", ")
      : "Asp25 / Asp25′ bilan vodorod bog‘i atom-darajasida alohida tasdiqlanmadi.";
    let html = '<div class="mgdd-metric-grid" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:12px;margin:12px 0">';
    html += '<article class="mgdd-pose" style="padding:16px;border:1px solid #1d7656;border-radius:14px;background:#06251d"><small style="color:#9bd8bd">Vina afiniteti · ΔG bashorati</small><div style="font-size:34px;font-weight:900;color:#4ade80">' + (Number.isFinite(score) ? score.toFixed(2) + ' kkal/mol' : '—') + '</div><small style="color:#b8d7c8">' + esc(sourceLabel || data.engine || "AutoDock Vina") + '</small></article>';
    html += '<article class="mgdd-pose" style="padding:16px;border:1px solid #29465d;border-radius:14px"><b>Lipinski — Rule of Five</b>';
    rows.forEach(row => {
      const valid = row[3];
      html += '<div style="display:flex;justify-content:space-between;gap:8px;padding:7px 0;border-bottom:1px solid #24394d"><span>' + row[0] + '</span><b style="color:' + (valid ? '#4ade80' : '#fbbf24') + '">' + esc(row[1] == null ? "—" : row[1]) + ' ' + row[2] + ' ' + (valid ? '✓' : '⚠') + '</b></div>';
    });
    html += '<small style="display:block;margin-top:8px;color:#9fb3c4">' + (lip.is_drug_like ? "Mezonlarga mos" : "Bir yoki bir nechta mezon cheklovdan tashqarida") + '</small></article>';
    html += '<article class="mgdd-pose" style="padding:16px;border:1px solid #29465d;border-radius:14px"><b>Katalitik bog‘lanish joyi</b><p style="margin:8px 0;color:#cfe0ec">' + contactText + '</p><small style="color:#9fb3c4">Asp25 / Asp25′ — OIV-1 proteaza faol markazidagi katalitik qoldiqlar. Vodorod bog‘i xulosasi faqat atom-kontakt tahlili mavjud bo‘lsa tasdiqlanadi.</small></article></div>';
    html += '<details style="margin-top:10px;border:1px solid #294052;border-radius:10px;padding:10px"><summary style="cursor:pointer;color:#9fb3c4">Xom JSON / texnik tafsilotlar</summary><pre style="white-space:pre-wrap;overflow-wrap:anywhere;max-height:320px;overflow:auto;font-size:11px;color:#b8c7d6">' + esc(JSON.stringify(data, null, 2)) + '</pre></details>';
    return html;
  }

  async function runHivDocking() {
    const button = byId("mgdd-hiv-run");
    const payload = { name: byId("mgdd-hiv-name").value.trim() || "MedGen candidate", smiles: byId("mgdd-hiv-smiles").value.trim(), target_pdb: byId("mgdd-hiv-target").value, exhaustiveness: Number(byId("mgdd-hiv-exhaust").value), n_poses: Number(byId("mgdd-hiv-poses").value) };
    if (!payload.smiles) { byId("mgdd-hiv-status").textContent = "Ligand SMILES kiriting."; return; }
    if (!Number.isInteger(payload.exhaustiveness) || payload.exhaustiveness < 1 || payload.exhaustiveness > 64 || !Number.isInteger(payload.n_poses) || payload.n_poses < 1 || payload.n_poses > 10) { byId("mgdd-hiv-status").textContent = "Exhaustiveness 1–64, pozalar soni 1–10 oralig‘ida bo‘lishi kerak."; return; }
    button.disabled = true; byId("mgdd-hiv-status").textContent = "RDKit → Meeko → receptor tayyorlash → AutoDock Vina hisoblayapti…"; byId("mgdd-hiv-results").textContent = "Hisoblash bajarilmoqda…";
    try {
      const data = await api("/hiv-lab/docking", { method: "POST", body: JSON.stringify(payload) });
      const poses = data.poses || [];
      let html = '<h3 style="margin:4px 0;color:#e8f0f6">Hisoblash kimyosi natijalari</h3>';
      html += renderHivMetrics(data, data.target_name + " · " + data.target_pdb + " · " + data.engine);
      html += '<p class="mgdd-note">' + esc(data.scientific_summary || "") + '</p>';
      html += '<p class="mgdd-note">' + esc(data.warning || "Vina natijasi eksperimental validatsiyani talab qiladi.") + '</p>';
      html += poses.map((pose, i) => '<article class="mgdd-pose"><b>Pose ' + (i+1) + '</b><strong>' + esc(pose.affinity_kcal_mol) + ' kkal/mol</strong><small>Intermolecular: ' + esc(pose.intermolecular_energy_kcal_mol) + ' · Intramolecular: ' + esc(pose.intramolecular_energy_kcal_mol) + '</small></article>').join("");
      byId("mgdd-hiv-results").innerHTML = html;
      if (hivViewer && data.poses_pdbqt) { if (hivPoseModel) { try { hivViewer.removeModel(hivPoseModel); } catch (_) {} } hivPoseModel = hivViewer.addModel(data.poses_pdbqt, "pdb"); if (hivPoseModel && typeof hivPoseModel.setStyle === "function") hivPoseModel.setStyle({}, { stick: { colorscheme: "greenCarbon" } }); hivViewer.zoomTo({ hetflag: false }); hivViewer.render(); }
      byId("mgdd-hiv-status").textContent = "Docking hisoblandi. Eng yaxshi pose 3D receptor ko‘rinishiga qo‘shildi.";
    } catch (error) { byId("mgdd-hiv-results").textContent = error.message; byId("mgdd-hiv-status").textContent = "HIV docking bajarilmadi: " + error.message; }
    finally { button.disabled = false; }
  }

  function mount() {
    if (mounted) return;
    const discovery = byId("discoveryTool");
    if (!discovery) return;
    let root = byId("drugDiscoveryWorkbench");
    if (!root) {
      root = document.createElement("div");
      root.id = "drugDiscoveryWorkbench";
      discovery.appendChild(root);
    }
    renderShell(root);
    mounted = true;
    loadTargets();
    renderHivStructure();
  }

  function observe() {
    const discovery = byId("discoveryTool");
    if (!discovery) return;
    const observer = new MutationObserver(() => {
      if (!discovery.classList.contains("hidden")) mount();
    });
    observer.observe(discovery, { attributes: true, attributeFilter: ["class"] });
    if (!discovery.classList.contains("hidden")) mount();
  }

  window.medgenDrugDiscovery = { mount, refresh: loadTargets };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", observe, { once: true });
  else observe();
})();
