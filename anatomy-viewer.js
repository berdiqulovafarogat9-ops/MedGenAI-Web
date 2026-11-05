/* MEDGEN AI — Interactive 3D Anatomy Viewer
 * Three.js r128 + GLTFLoader + DRACOLoader.
 * Injects itself into the existing Medical Academy workspace.
 */
(function () {
  'use strict';
  const MODEL_URL = 'https://dbkxgbeisgyjilflkneq.supabase.co/storage/v1/object/public/models/full_skeleton.glb';
  const DECODER_PATH = 'https://www.gstatic.com/draco/v1/decoders/';
  let activeViewer = null;

  class AnatomyViewer {
    constructor(host) {
      this.host = host;
      this.scene = null; this.camera = null; this.renderer = null;
      this.controls = null; this.model = null; this.selected = null;
      this.frame = 0; this.resizeObserver = null; this.pointerStart = null;
      this.status = host.querySelector('#medgenAnatomyStatus');
      this.canvas = host.querySelector('#medgenAnatomyCanvas');
      this.name = host.querySelector('#medgenAnatomyName');
      this.raycaster = new THREE.Raycaster();
      this.pointer = new THREE.Vector2();
    }
    setStatus(message) { if (this.status) this.status.textContent = message; }
    init() {
      if (!this.canvas || !window.THREE || !THREE.GLTFLoader || !THREE.DRACOLoader || !THREE.OrbitControls) {
        this.setStatus('3D kutubxonalar yuklanmadi. Sahifani yangilang.');
        return;
      }
      const width = Math.max(1, this.canvas.clientWidth);
      const height = Math.max(1, this.canvas.clientHeight);
      this.scene = new THREE.Scene();
      this.scene.background = new THREE.Color(0x080d14);
      this.camera = new THREE.PerspectiveCamera(42, width / height, 0.01, 1000);
      this.camera.position.set(0, 1.1, 3.4);
      this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      this.renderer.setSize(width, height);
      this.renderer.outputEncoding = THREE.sRGBEncoding;
      this.canvas.replaceChildren(this.renderer.domElement);
      this.renderer.domElement.style.width = '100%';
      this.renderer.domElement.style.height = '100%';
      this.renderer.domElement.style.display = 'block';
      this.controls = new THREE.OrbitControls(this.camera, this.renderer.domElement);
      this.controls.enableDamping = true;
      this.controls.dampingFactor = 0.07;
      this.controls.minDistance = 0.35;
      this.controls.maxDistance = 15;
      this.controls.target.set(0, 0.9, 0);
      this.scene.add(new THREE.HemisphereLight(0xffffff, 0x344054, 1.5));
      const key = new THREE.DirectionalLight(0xffffff, 1.5);
      key.position.set(4, 6, 5); this.scene.add(key);
      const fill = new THREE.DirectionalLight(0x9bc8ff, 0.7);
      fill.position.set(-4, 1, -4); this.scene.add(fill);
      this.loadModel();
      this.bindPointer();
      this.resizeObserver = new ResizeObserver(() => this.resize());
      this.resizeObserver.observe(this.canvas);
      const animate = () => {
        if (!this.renderer) return;
        this.frame = requestAnimationFrame(animate);
        this.controls.update();
        this.renderer.render(this.scene, this.camera);
      };
      animate();
    }
    loadModel() {
      this.setStatus('Skelet modeli yuklanmoqda…');
      const draco = new THREE.DRACOLoader();
      draco.setDecoderPath(DECODER_PATH);
      draco.setDecoderConfig({ type: 'js' });
      const loader = new THREE.GLTFLoader();
      loader.setDRACOLoader(draco);
      loader.load(MODEL_URL, (gltf) => {
        this.model = gltf.scene;
        this.model.updateMatrixWorld(true);
        const bounds = new THREE.Box3().setFromObject(this.model);
        const center = bounds.getCenter(new THREE.Vector3());
        const size = bounds.getSize(new THREE.Vector3());
        this.model.position.sub(center);
        this.scene.add(this.model);
        this.model.updateMatrixWorld(true);
        const normalized = new THREE.Box3().setFromObject(this.model);
        const fittedSize = normalized.getSize(new THREE.Vector3());
        const maxDim = Math.max(fittedSize.x, fittedSize.y, fittedSize.z) || 1;
        const targetY = fittedSize.y * 0.5;
        this.controls.target.set(0, targetY, 0);
        this.camera.position.set(0, targetY + maxDim * 0.12, maxDim * 2.25);
        this.camera.near = Math.max(0.001, maxDim / 1000);
        this.camera.far = maxDim * 20;
        this.camera.updateProjectionMatrix();
        this.controls.minDistance = maxDim * 0.45;
        this.controls.maxDistance = maxDim * 8;
        this.controls.update();
        this.setStatus('Skelet yuklandi. Suyakni tanlash uchun ustiga bosing.');
        draco.dispose();
      }, (event) => {
        if (event.lengthComputable) this.setStatus('Yuklanmoqda: ' + Math.round(event.loaded / event.total * 100) + '%');
      }, (error) => {
        console.error('MedGen anatomy model load error:', error);
        this.setStatus('Model yuklanmadi. Internet, Supabase CORS yoki Draco dekoderini tekshiring.');
        draco.dispose();
      });
    }
    bindPointer() {
      const el = this.renderer.domElement;
      el.addEventListener('pointerdown', (event) => {
        this.pointerStart = { x: event.clientX, y: event.clientY };
      });
      el.addEventListener('pointerup', (event) => {
        if (!this.pointerStart) return;
        const moved = Math.hypot(event.clientX - this.pointerStart.x, event.clientY - this.pointerStart.y);
        this.pointerStart = null;
        if (moved > 7 || !this.model) return;
        const rect = el.getBoundingClientRect();
        this.pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        this.pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
        this.raycaster.setFromCamera(this.pointer, this.camera);
        const hits = this.raycaster.intersectObject(this.model, true);
        if (!hits.length) return;
        this.selectMesh(hits[0].object);
      });
    }
    selectMesh(mesh) {
      this.restoreSelection();
      this.selected = mesh;
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      this.originalMaterials = mats;
      const highlighted = mats.map((mat) => {
        const clone = mat.clone();
        if (clone.color) clone.color.setHex(0x10b981);
        clone.emissive = clone.emissive || new THREE.Color(0x000000);
        clone.emissive.setHex(0x064e3b);
        return clone;
      });
      mesh.material = Array.isArray(mesh.material) ? highlighted : highlighted[0];
      const label = (mesh.name || 'Nomsiz suyak').replace(/[_-]+/g, ' ').trim();
      if (this.name) this.name.textContent = 'Tanlandi: ' + label;
      this.setStatus('Tanlangan obyekt: ' + label);
    }
    restoreSelection() {
      if (!this.selected || !this.originalMaterials) return;
      const current = Array.isArray(this.selected.material) ? this.selected.material : [this.selected.material];
      current.forEach((m) => m && m.dispose && m.dispose());
      this.selected.material = Array.isArray(this.selected.material) ? this.originalMaterials : this.originalMaterials[0];
      this.selected = null; this.originalMaterials = null;
    }
    resize() {
      if (!this.renderer || !this.camera || !this.canvas) return;
      const w = Math.max(1, this.canvas.clientWidth), h = Math.max(1, this.canvas.clientHeight);
      this.camera.aspect = w / h; this.camera.updateProjectionMatrix();
      this.renderer.setSize(w, h);
    }
    dispose() {
      cancelAnimationFrame(this.frame);
      if (this.resizeObserver) this.resizeObserver.disconnect();
      this.restoreSelection();
      if (this.controls) this.controls.dispose();
      if (this.renderer) { this.renderer.dispose(); this.renderer.domElement.remove(); }
      this.renderer = null;
    }
  }

  function mount(root) {
    if (!root || root.querySelector('#medgenAnatomyTool')) return;
    const section = document.createElement('section');
    section.id = 'medgenAnatomyTool';
    section.className = 'academy-stat';
    section.style.cssText = 'display:grid;gap:12px;margin-top:16px;';
    section.innerHTML = '<div style="display:flex;gap:10px;align-items:center;justify-content:space-between;flex-wrap:wrap"><div><b>🦴 3D Anatomiya laboratoriyasi</b><p class="muted" style="margin:5px 0">Inson skeleti — aylantiring, yaqinlashtiring va suyaklarni tanlang.</p></div><button type="button" id="medgenAnatomyToggle" class="primary">3D modelni ochish</button></div><div id="medgenAnatomyPanel" hidden><div id="medgenAnatomyCanvas" style="height:min(68vh,620px);min-height:360px;width:100%;border-radius:12px;overflow:hidden;background:#080d14;touch-action:pan-y"></div><div id="medgenAnatomyStatus" role="status" aria-live="polite" style="padding:10px 2px">Model tayyor.</div><b id="medgenAnatomyName" aria-live="polite">Hozircha suyak tanlanmagan</b><p class="muted" style="font-size:12px">Eslatma: model ta’limiy vizualizatsiya uchun. Anatomik nomlar GLB faylidagi mesh nomlariga bog‘liq.</p></div>';
    root.appendChild(section);
    section.querySelector('#medgenAnatomyToggle').addEventListener('click', () => {
      const panel = section.querySelector('#medgenAnatomyPanel');
      const opening = panel.hidden;
      panel.hidden = !opening;
      section.querySelector('#medgenAnatomyToggle').textContent = opening ? '3D modelni yopish' : '3D modelni ochish';
      if (opening && !activeViewer) {
        activeViewer = new AnatomyViewer(section);
        activeViewer.init();
      } else if (opening && activeViewer) activeViewer.resize();
      else if (!opening && activeViewer) { activeViewer.dispose(); activeViewer = null; }
    });
  }
  function watch() {
    const attach = () => {
      const academyRoot = document.getElementById('academyV2Root');
      const studentRoot = document.getElementById('studentTool');
      // Mount in the rendered Academy root when available; otherwise use the
      // visible legacy Student workspace so the viewer is never hidden behind
      // an Academy root that has not yet been initialized.
      const root = academyRoot || (studentRoot && !studentRoot.classList.contains('hidden') ? studentRoot : null);
      if (root) mount(root);
    };
    attach();
    const observer = new MutationObserver(attach);
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', watch, { once: true });
  else watch();
  window.MedGenAnatomyViewer = AnatomyViewer;
})();
