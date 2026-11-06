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
          <h3>Receptor tayyorlash va docking parametrlari</h3>
          <p class="mgdd-warning">PDB strukturani ko‘rish receptor PDBQT tayyorlash bilan bir xil emas. Bu versiyada receptor PDBQT faylini Meeko/AutoDock vositasi bilan alohida tayyorlab, yuklang. Oddiy PDB fayli PDBQT o‘rnini bosa olmaydi.</p>
          <label for="mgdd-receptor-file">Receptor PDBQT fayli</label>
          <input id="mgdd-receptor-file" type="file" accept=".pdbqt,.txt">
          <label for="mgdd-receptor">Receptor PDBQT matni</label>
          <textarea id="mgdd-receptor" rows="7" spellcheck="false" placeholder="Tayyorlangan receptor .pdbqt faylini tanlang yoki matnini joylang"></textarea>
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
          <button id="mgdd-run" type="button" class="mgdd-primary">⚡ Haqiqiy AutoDock Vina docking</button>
          <div id="mgdd-status" role="status" aria-live="polite" class="mgdd-status">Avval target va ligandni tanlang.</div>
        </section>
        <section class="mgdd-card">
          <h3>Docking natijalari</h3>
          <div id="mgdd-results" class="mgdd-results">Hali hisoblash bajarilmadi.</div>
          <p class="mgdd-disclaimer">Ilmiy ogohlantirish: Vina score — hisoblash natijasi, tajribada tasdiqlangan bog‘lanish energiyasi, dori samaradorligi, xavfsizligi yoki klinik tavsiya emas. RMSD va vodorod bog‘lari ushbu endpoint tomonidan hisoblanmasa, ular ko‘rsatilmaydi.</p>
        </section>
      </section>`;
    root.querySelectorAll("label").forEach(label => label.classList.add("mgdd-label"));
    byId("mgdd-target").addEventListener("change", () => selectTarget(byId("mgdd-target").value));
    byId("mgdd-prepare").addEventListener("click", prepareLigand);
    byId("mgdd-run").addEventListener("click", runDocking);
    byId("mgdd-receptor-file").addEventListener("change", loadReceptorFile);
  }

  async function loadTargets() {
    try {
      const data = await api("/drug-discovery/targets");
      targets = data.targets || [];
      const select = byId("mgdd-target");
      select.innerHTML = targets.map(t => `<option value="${esc(t.target_id)}">${esc(t.pdb_id)} — ${esc(t.target_name)}</option>`).join("");
      if (targets.length) await selectTarget(targets[0].target_id);
      setStatus("Targetlar katalogi yuklandi. Receptor PDBQT ni tayyorlab, dockingni boshlashingiz mumkin.");
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

  async function loadReceptorFile(event) {
    const file = event.target.files && event.target.files[0];
    if (!file) return;
    if (!/\.pdbqt$|\.txt$/i.test(file.name)) {
      setStatus("Faqat receptor .pdbqt faylini tanlang. Oddiy .pdb fayli bu bosqichga mos emas.", true);
      event.target.value = "";
      return;
    }
    byId("mgdd-receptor").value = await file.text();
    setStatus("Receptor PDBQT fayli yuklandi: " + file.name);
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
      setStatus("Ligand serverda RDKit + Meeko orqali tayyorlandi.");
    } catch (error) {
      byId("mgdd-ligand-status").textContent = error.message;
      setStatus("Ligand tayyorlashda xatolik.", true);
    } finally { button.disabled = false; }
  }

  async function runDocking() {
    const targetId = byId("mgdd-target").value;
    const target = targets.find(t => t.target_id === targetId);
    const ligand = byId("mgdd-ligand-pdbqt").value.trim();
    const receptor = byId("mgdd-receptor").value.trim();
    if (!target || !ligand || !receptor) return setStatus("Target, ligand PDBQT va receptor PDBQT uchalasi kerak.", true);
    const num = id => Number(byId("mgdd-" + id).value);
    const params = { center_x:num("cx"), center_y:num("cy"), center_z:num("cz"), size_x:num("sx"), size_y:num("sy"), size_z:num("sz"), exhaustiveness:num("exhaust"), n_poses:num("poses") };
    if (Object.values(params).some(v => !Number.isFinite(v)) || ["cx","cy","cz"].some(k => byId("mgdd-"+k).value.trim() === "")) return setStatus("Docking markazi X/Y/Z va barcha parametrlarni to‘ldiring.", true);
    const button = byId("mgdd-run");
    button.disabled = true;
    setStatus("AutoDock Vina hisoblayapti…");
    byId("mgdd-results").textContent = "Hisoblash bajarilmoqda…";
    try {
      const data = await api("/docking/run", { method: "POST", body: JSON.stringify({ target: target.target_id + " / " + target.pdb_id, ligand_smiles: byId("mgdd-smiles").value.trim(), receptor_pdbqt: receptor, ligand_pdbqt: ligand, ...params }) });
      const poses = data.result && data.result.poses || data.poses || [];
      const posesPdbqt = data.result && data.result.poses_pdbqt;
      if (!poses.length) {
        byId("mgdd-results").textContent = JSON.stringify(data, null, 2);
      } else {
        byId("mgdd-results").innerHTML = poses.map((pose, i) => `<article class="mgdd-pose"><b>Pose ${i+1}</b><strong>${esc(pose.affinity_kcal_mol)} kcal/mol</strong><small>Intermolecular: ${esc(pose.intermolecular_energy_kcal_mol)} · Intramolecular: ${esc(pose.intramolecular_energy_kcal_mol)}</small></article>`).join("");
      }
      if (viewer && posesPdbqt) {
        if (dockedLigandModel) { try { viewer.removeModel(dockedLigandModel); } catch (_) {} }
        dockedLigandModel = viewer.addModel(posesPdbqt, "pdbqt");
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
