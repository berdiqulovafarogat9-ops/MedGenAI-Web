(function () {
  var THREE_SRC = "https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js";
  var GLTF_SRC = "https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/loaders/GLTFLoader.js";
  var ORBIT_SRC = "https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/controls/OrbitControls.js";
  var Quiz = window.MedGenAnatomyQuiz;

  function loadScript(src) {
    return new Promise(function (resolve, reject) {
      var s = document.createElement("script");
      s.src = src; s.async = true;
      s.onload = resolve;
      s.onerror = function () { reject(new Error("3D kutubxona yuklanmadi. Internetni tekshiring.")); };
      document.head.appendChild(s);
    });
  }
  async function ensureThree() {
    if (!window.THREE) await loadScript(THREE_SRC);
    if (!THREE.GLTFLoader) await loadScript(GLTF_SRC);
    if (!THREE.OrbitControls) await loadScript(ORBIT_SRC);
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
  var CARD = "background:#0d1a26;color:#e8f0f6;border:1px solid #24394d;border-radius:18px;padding:14px;width:min(96vw,760px);max-height:94vh;overflow:auto;font-family:system-ui,sans-serif";
  var BTN = "padding:9px 13px;border:0;border-radius:10px;background:#56dcc0;color:#06231d;font-weight:700;font-size:13px;margin:4px 4px 4px 0";
  var BTN2 = "padding:8px 12px;border:1px solid #24394d;border-radius:10px;background:#13222f;color:#cfe0ec;font-size:13px;margin:4px 4px 4px 0";

  function open(url, title) {
    var overlay = el("div", "position:fixed;inset:0;background:rgba(0,0,0,.75);display:flex;align-items:center;justify-content:center;z-index:99999");
    var card = el("div", CARD);
    overlay.appendChild(card);
    document.body.appendChild(overlay);
    var renderer = null, raf = null, quiz = null, mode = "view", meshes = [], model = null;
    var stage = el("div", "width:100%;height:380px;background:#020a12;border:1px solid #1d3042;border-radius:12px;position:relative;overflow:hidden");
    var status = el("div", "font-size:13px;color:#8fa3b5;margin:8px 0", "Yuklanmoqda...");
    var partsBox = el("div", "max-height:150px;overflow:auto;border:1px solid #1d3042;border-radius:10px;padding:6px;font-size:12px;margin-top:6px");
    var quizLine = el("div", "font-size:15px;font-weight:700;margin:8px 0;color:#f6c85f");
    var score = el("div", "font-size:13px;color:#8fa3b5");
    card.appendChild(el("h3", "margin:0 0 6px;font-size:18px", title || "3D anatomiya"));
    card.appendChild(stage); card.appendChild(status);

    var row = el("div", "display:flex;flex-wrap:wrap;align-items:center;gap:6px;margin-top:6px");
    var opacity = document.createElement("input"); opacity.type = "range"; opacity.min = "0.1"; opacity.max = "1"; opacity.step = "0.05"; opacity.value = "1";
    opacity.style.cssText = "width:150px";
    opacity.oninput = function () { meshes.forEach(function (m) { m.material.opacity = Number(opacity.value); m.material.transparent = Number(opacity.value) < 1; m.material.needsUpdate = true; }); };
    row.appendChild(el("span", "font-size:13px", "Shaffoflik:")); row.appendChild(opacity);
    var quizBtn = el("button", BTN, "O'yin: toping va bosing"); row.appendChild(quizBtn);
    var resetBtn = el("button", BTN2, "Kamerani qayta o'rnatish"); row.appendChild(resetBtn);
    card.appendChild(row);
    card.appendChild(quizLine); card.appendChild(score);
    var search = document.createElement("input"); search.placeholder = "Qismni qidirish..."; search.style.cssText = "width:100%;padding:8px;border-radius:8px;border:1px solid #24394d;background:#13222f;color:#e8f0f6;margin-top:8px";
    card.appendChild(search); card.appendChild(partsBox);
    var close = el("button", BTN2 + ";width:100%;margin-top:10px", "Yopish");
    card.appendChild(close);

    var camera, controls, scene, raycaster = null, mouse = null;
    var dispose = function () {
      if (raf) cancelAnimationFrame(raf);
      if (renderer) { renderer.dispose(); }
      overlay.remove();
    };
    close.onclick = dispose;
    overlay.addEventListener("click", function (e) { if (e.target === overlay) dispose(); });

    if (!url) {
      status.textContent = "Bu bo'lim uchun 3D model hali qo'shilmagan. Administrator model havolasini qo'shgach, shu yerda ko'rinadi.";
      return;
    }

    ensureThree().then(function () {
      var w = stage.clientWidth || 600, h = stage.clientHeight || 380;
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.setSize(w, h);
      stage.appendChild(renderer.domElement);
      scene = new THREE.Scene();
      camera = new THREE.PerspectiveCamera(45, w / h, 0.01, 10000);
      controls = new THREE.OrbitControls(camera, renderer.domElement);
      controls.enableDamping = true;
      scene.add(new THREE.AmbientLight(0xffffff, 0.85));
      var dl = new THREE.DirectionalLight(0xffffff, 0.6); dl.position.set(1, 2, 3); scene.add(dl);
      raycaster = new THREE.Raycaster(); mouse = new THREE.Vector2();

      new THREE.GLTFLoader().load(url, function (gltf) {
        model = gltf.scene; scene.add(model);
        model.traverse(function (o) {
          if (o.isMesh) {
            o.material = Array.isArray(o.material) ? o.material[0].clone() : o.material.clone();
            o.userData.partName = (o.name && o.name.trim()) || (o.parent && o.parent.name) || "";
            meshes.push(o);
          }
        });
        var box = new THREE.Box3().setFromObject(model), size = box.getSize(new THREE.Vector3()), center = box.getCenter(new THREE.Vector3());
        controls.target.copy(center);
        camera.position.set(center.x, center.y + size.y * 0.1, center.z + Math.max(size.x, size.y, size.z) * 1.6);
        camera.near = Math.max(size.length() / 1000, 0.01); camera.far = size.length() * 10; camera.updateProjectionMatrix();
        buildParts();
        status.textContent = "Modelda " + meshes.length + " ta qism. Aylantirish: sichqoncha / barmoq. Qismni bosib nomini ko'ring.";
      }, undefined, function () { status.textContent = "Model yuklanmadi. Havola noto'g'ri yoki fayl juda katta."; });

      function animate() { raf = requestAnimationFrame(animate); controls.update(); renderer.render(scene, camera); }
      animate();
      renderer.domElement.addEventListener("pointerdown", onPick);
    }).catch(function (e) { status.textContent = e.message; });

    function buildParts() {
      partsBox.innerHTML = "";
      var names = Quiz.uniqueNames(meshes.map(function (m) { return m.userData.partName; }));
      names.forEach(function (name) {
        var lab = el("label", "display:flex;gap:6px;align-items:center;padding:2px 4px;cursor:pointer");
        lab.dataset.name = name.toLowerCase();
        var cb = document.createElement("input"); cb.type = "checkbox"; cb.checked = true;
        cb.onchange = function () { meshes.forEach(function (m) { if (m.userData.partName === name) m.visible = cb.checked; }); };
        lab.appendChild(cb); lab.appendChild(document.createTextNode(name));
        partsBox.appendChild(lab);
      });
      search.oninput = function () {
        var q = search.value.trim().toLowerCase();
        partsBox.querySelectorAll("label").forEach(function (l) { l.style.display = !q || l.dataset.name.indexOf(q) !== -1 ? "flex" : "none"; });
      };
    }

    function highlight(mesh, color) {
      if (!mesh || !mesh.material || !mesh.material.emissive) return;
      mesh.material.emissive.setHex(color);
      setTimeout(function () { if (mesh.material && mesh.material.emissive) mesh.material.emissive.setHex(0); }, 900);
    }

    function onPick(ev) {
      if (!model || !raycaster) return;
      var r = renderer.domElement.getBoundingClientRect();
      mouse.x = ((ev.clientX - r.left) / r.width) * 2 - 1;
      mouse.y = -((ev.clientY - r.top) / r.height) * 2 + 1;
      raycaster.setFromCamera(mouse, camera);
      var hit = raycaster.intersectObjects(meshes.filter(function (m) { return m.visible; }), false)[0];
      if (!hit) return;
      var name = hit.object.userData.partName;
      if (mode !== "quiz") {
        quizLine.style.color = "#8fa3b5";
        quizLine.textContent = name || "Nomsiz qism";
        return;
      }
      var res = Quiz.answer(quiz, name);
      if (!res.ok) return;
      var ok = res.ok && name === res.target;
      quizLine.style.color = ok ? "#56dcc0" : "#ff8a8a";
      quizLine.textContent = ok ? "To'g'ri: " + res.target : "Noto'g'ri. Siz bosdingiz: " + (name || "nomsiz") + ". To'g'risi: " + res.target;
      highlight(hit.object, ok ? 0x0f5a48 : 0x5a0f0f);
      score.textContent = "Natija: " + quiz.correct + " / " + quiz.asked + " (" + Quiz.accuracy(quiz) + "%)";
      setTimeout(nextQ, 1400);
    }

    function nextQ() {
      if (mode !== "quiz") return;
      if (!Quiz.nextTarget(quiz)) { quizLine.textContent = "Qismlar tugadi."; return; }
      quizLine.style.color = "#f6c85f";
      quizLine.textContent = "Toping: " + quiz.target;
    }

    quizBtn.onclick = function () {
      if (!model) return;
      mode = mode === "quiz" ? "view" : "quiz";
      if (mode === "quiz") {
        quiz = Quiz.newQuiz(meshes.map(function (m) { return m.userData.partName; }));
        quizBtn.textContent = "O'yinni to'xtatish";
        score.textContent = "Natija: 0 / 0";
        nextQ();
      } else {
        quizBtn.textContent = "O'yin: toping va bosing";
        quizLine.textContent = "";
        score.textContent = "";
      }
    };
    resetBtn.onclick = function () { if (controls) controls.reset(); };
  }

  window.MedGenAnatomy = { open: open };
})();
