/* MEDGEN AI — Interactive 3D Anatomy Viewer
 * Three.js r128 + GLTFLoader + DRACOLoader.
 * Injects itself into the existing Medical Academy workspace.
 */
(function () {
  'use strict';
  const MODEL_URL = 'https://dbkxgbeisgyjilflkneq.supabase.co/storage/v1/object/public/models/full_skeleton.glb';
  const DECODER_PATH = 'https://www.gstatic.com/draco/versioned/decoders/1.5.6/';
  let activeViewer = null;

  class AnatomyViewer {
    constructor(host) {
      this.host = host;
      this.scene = null; this.camera = null; this.renderer = null;
      this.controls = null; this.model = null; this.selected = null;
      this.frame = 0; this.resizeObserver = null; this.pointerStart = null;
      this.status = host.querySelector('#skeleton-status-label');
      this.canvas = host.querySelector('#skeleton-canvas-box');
      this.name = host.querySelector('#skeleton-name-label');
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

  let anatomyModal = null;
  let buttonObserver = null;

  function closeSkeletonModal() {
    if (!anatomyModal) return;
    document.removeEventListener('keydown', onSkeletonKeydown);
    if (activeViewer) {
      activeViewer.dispose();
      activeViewer = null;
    }
    anatomyModal.remove();
    anatomyModal = null;
  }

  function onSkeletonKeydown(event) {
    if (event.key === 'Escape') closeSkeletonModal();
  }

  function openSkeletonModal() {
    if (anatomyModal) {
      anatomyModal.style.display = 'flex';
      if (activeViewer) activeViewer.resize();
      return;
    }

    anatomyModal = document.createElement('div');
    anatomyModal.id = 'skeleton-modal-wrap';
    anatomyModal.style.cssText = 'display:flex;position:fixed;inset:0;background:rgba(2,6,23,.92);z-index:2147483000;justify-content:center;align-items:center;backdrop-filter:blur(4px);padding:12px;box-sizing:border-box;';
    anatomyModal.innerHTML = '<div role="dialog" aria-modal="true" aria-label="3D Inson skeleti" style="position:relative;width:95%;max-width:950px;height:85vh;min-height:420px;background:#080d14;border:1px solid #1e293b;border-radius:14px;overflow:hidden;display:flex;flex-direction:column;box-shadow:0 20px 50px rgba(0,0,0,.8)"><div style="display:flex;justify-content:space-between;align-items:center;padding:12px 18px;background:#0f172a;border-bottom:1px solid #1e293b;gap:12px;flex-shrink:0"><span id="skeleton-status-label" role="status" aria-live="polite" style="color:#38bdf8;font-weight:600;font-size:14px;font-family:sans-serif">Skelet yuklanmoqda…</span><button type="button" id="btn-close-skeleton" style="background:#ef4444;color:#fff;border:0;padding:6px 14px;border-radius:6px;cursor:pointer;font-weight:bold">✕ Yopish</button></div><div id="skeleton-canvas-box" style="flex:1;min-height:0;width:100%;height:100%;position:relative;overflow:hidden;touch-action:none"></div><div style="padding:8px 14px;background:#0f172a;color:#cbd5e1;font-size:13px"><b id="skeleton-name-label">Model tayyorlanmoqda…</b><div>Modelni barmoq bilan aylantiring va yaqinlashtiring. Suyakni tanlash uchun ustiga bosing.</div></div></div>';

    document.body.appendChild(anatomyModal);
    anatomyModal.querySelector('#btn-close-skeleton').addEventListener('click', closeSkeletonModal);
    anatomyModal.addEventListener('click', (event) => {
      if (event.target === anatomyModal) closeSkeletonModal();
    });
    document.addEventListener('keydown', onSkeletonKeydown);

    if (!window.THREE || !THREE.GLTFLoader || !THREE.DRACOLoader || !THREE.OrbitControls) {
      anatomyModal.querySelector('#skeleton-status-label').textContent = '3D kutubxonalar yuklanmadi. Sahifani yangilang.';
      return;
    }
    try {
      activeViewer = new AnatomyViewer(anatomyModal);
      activeViewer.init();
    } catch (error) {
      console.error('MedGen skeleton viewer initialization failed:', error);
      anatomyModal.querySelector('#skeleton-status-label').textContent = 'Viewer ishga tushmadi: ' + (error.message || 'noma’lum xato');
    }
  }

  window.medgenAnatomyModal = {
    open: openSkeletonModal,
    close: closeSkeletonModal
  };

  function bindSkeletonButton() {
    const button = document.getElementById('btn-open-skeleton');
    if (button && button.dataset.skeletonBound !== '1') {
      button.dataset.skeletonBound = '1';
      button.addEventListener('click', (event) => {
        event.preventDefault();
        openSkeletonModal();
      });
    }
  }

  function watchSkeletonButton() {
    bindSkeletonButton();
    if (!buttonObserver) {
      buttonObserver = new MutationObserver(bindSkeletonButton);
      buttonObserver.observe(document.documentElement, { childList: true, subtree: true });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', watchSkeletonButton, { once: true });
  } else {
    watchSkeletonButton();
  }
  window.MedGenAnatomyViewer = AnatomyViewer;
})();
