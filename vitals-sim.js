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
  var activeEmbeddedClose = null;
  var CARD = "background:#0d1a26;color:#e8f0f6;border:1px solid #24394d;border-radius:18px;padding:16px;width:min(98vw,1480px);max-height:96vh;overflow:auto;font-family:system-ui,sans-serif;box-sizing:border-box";
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

  function open(targetRoot, caseKey) {
    var embedded = !!(targetRoot && targetRoot.nodeType === 1);
    if (embedded && activeEmbeddedClose) activeEmbeddedClose();
    var overlay = embedded ? null : el("div", "position:fixed;inset:0;background:rgba(0,0,0,.75);display:flex;align-items:center;justify-content:center;z-index:99999");
    var embeddedCardStyle = CARD.replace("width:min(98vw,1480px);max-height:96vh;", "width:100%;max-height:none;") + ";box-sizing:border-box";
    var card = el("div", embedded ? embeddedCardStyle : CARD);
    if (embedded) {
      targetRoot.innerHTML = "";
      targetRoot.appendChild(card);
    } else {
      overlay.appendChild(card);
      document.body.appendChild(overlay);
    }
    var sim = null, timer = null, raf = null, clinicRaf = null, penalty = 0, lastPenaltyAt = 0, running = false, clinicSync = null;
    var epicrisisOverlay = null, epicrisisScoreLabel = null;
    var genericClinicMounted = false;
    var alertBox = el("div", "display:none;background:#b00020;color:#fff;font-weight:700;padding:10px;border-radius:10px;margin-bottom:8px");
    card.appendChild(alertBox);

    function closeAll() {
      running = false;
      if (epicrisisOverlay) { epicrisisOverlay.remove(); epicrisisOverlay = null; epicrisisScoreLabel = null; }
      if (genericClinicMounted && window.medgen3DClinic) window.medgen3DClinic.dispose();
      if (window.MedGenAnatomyLab && window.MedGenAnatomyLab.disposeAll) window.MedGenAnatomyLab.disposeAll();
      genericClinicMounted = false;
      if (timer) clearInterval(timer);
      if (raf) cancelAnimationFrame(raf);
      if (clinicRaf) cancelAnimationFrame(clinicRaf); clinicRaf = null;
      if (clinicResizeObserver) clinicResizeObserver.disconnect();
      if (typeof clinicControls!=="undefined" && clinicControls) { clinicControls.dispose(); clinicControls=null; }
      if (clinicRenderer) { clinicRenderer.dispose(); clinicRenderer.domElement.remove(); clinicRenderer = null; }
      clinicSync = null;
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("blur", onBlur);
      window.removeEventListener("orientationchange", onViewportChange);
      if (window.visualViewport) window.visualViewport.removeEventListener("resize", onViewportChange);
      if (embedded) {
        if (activeEmbeddedClose === closeAll) activeEmbeddedClose = null;
        targetRoot.innerHTML = '<div style="max-width:900px;margin:0 auto;text-align:center;padding:36px 18px;color:#e2e8f0"><h3>Virtual bemor simulyatori</h3><p style="color:#a8bacb">Simulyatsiya yopildi.</p><button type="button" onclick="window.medgenPatient.start(\'anaphylaxis\')" style="padding:12px 18px;background:#0e7490;color:#fff;border:0;border-radius:9px;font-weight:700">Qayta boshlash</button></div>';
      } else if (overlay) {
        overlay.remove();
      }
    }
    if (embedded) activeEmbeddedClose = closeAll;
    if (overlay) overlay.addEventListener("click", function (e) { if (e.target === overlay && !running) closeAll(); });

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
    // Orientation changes must re-trigger the existing renderer/ResizeObserver;
    // do not create another Three.js scene or renderer.
    function onViewportChange() {
      requestAnimationFrame(function () {
        window.dispatchEvent(new Event("resize"));
        requestAnimationFrame(function () {
          window.dispatchEvent(new Event("resize"));
        });
      });
    }
    function exitToDashboard() {
      closeAll();
      var anatomyOverlayClose = document.getElementById("close-medgen-skeleton");
      if (anatomyOverlayClose) anatomyOverlayClose.click();
      // Use the application's real dashboard renderer when available.
      if (typeof window.showDashboard === "function") window.showDashboard();
    }

    function showStart() {
      card.innerHTML = ""; card.appendChild(alertBox);
      card.appendChild(el("h3", "margin:0 0 6px;font-size:20px", "Virtual bemor"));
      card.appendChild(el("p", "color:#8fa3b5;font-size:13px;margin:0 0 10px", "Ta'lim uchun simulyatsiya. Bemorni 3 daqiqa ichida barqarorlashtiring. Imtihon davomida boshqa oynaga o'tsangiz, har bir marta -15 ball."));
      var list = el("div", "");
      card.appendChild(list);
      var close = el("button", BTN2 + ";width:100%;text-align:center", "Yopish"); close.onclick = closeAll; card.appendChild(close);
      call("/clinical/vitals/cases").then(function (data) {
        if (caseKey) {
          var selectedCase = data.cases.find(function (item) { return item.id === caseKey; });
          if (!selectedCase) {
            list.appendChild(el("p", "color:#ff8a8a", "So‘ralgan klinik keys topilmadi: " + caseKey));
            return;
          }
          start(selectedCase);
          return;
        }
        data.cases.forEach(function (c) {
          var box = el("div", "border:1px solid #24394d;border-radius:12px;padding:10px;margin:8px 0");
          box.appendChild(el("div", "font-weight:700", c.title + " · " + c.level));
          box.appendChild(el("div", "color:#8fa3b5;font-size:13px;margin:4px 0 8px", c.story));
          var go = el("button", BTN, "Boshlash"); go.onclick = function () { start(c); };
          box.appendChild(go); list.appendChild(box);
        });
      }).catch(function (e) { list.appendChild(el("p", "color:#ff8a8a", e.message)); });
    }

    var hud, tiles = {}, canvas, actionsBox, logBox, endBox, handoffFinishBtn = null, fullCodeSetTab = null;
    function start(c) {
      card.innerHTML = ""; card.appendChild(alertBox);
      var uiStyle = document.createElement("style");
      uiStyle.textContent = ".medgen-clinical-shell{width:100%;box-sizing:border-box;color:#e8f0f6}.medgen-clinical-top{display:flex;flex-direction:column;gap:8px;padding:14px;margin-bottom:12px;border:1px solid #29445a;border-radius:14px;background:linear-gradient(135deg,#10283a,#0a1724)}.medgen-clinical-grid{display:grid;grid-template-columns:minmax(210px,.82fr) minmax(340px,1.65fr) minmax(250px,1fr);gap:12px;align-items:start}.medgen-clinical-dock{min-width:0;min-height:180px;padding:12px;border:1px solid #263d50;border-radius:14px;background:#0a1723;box-sizing:border-box}.medgen-clinical-dock h4{margin:0 0 10px;color:#9fe7f4;font-size:13px;letter-spacing:.04em;text-transform:uppercase}.medgen-clinical-center{display:flex;flex-direction:column;gap:9px}.medgen-clinical-tabs{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:5px;margin-bottom:10px}.medgen-clinical-tab{padding:9px 5px;border:1px solid #31536a;border-radius:8px;background:#102536;color:#c8d9e6;font-weight:700;font-size:12px;cursor:pointer}.medgen-clinical-tab[aria-selected=true]{background:#0e7490;border-color:#22d3ee;color:#fff}.medgen-clinical-pane{min-width:0}.medgen-clinical-vitals{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:7px}.medgen-clinical-vitals>div{min-width:0}.medgen-clinical-story{font-size:13px;line-height:1.6;color:#c4d4e0;white-space:normal}.medgen-clinical-meta{font-size:12px;color:#8fa3b5;line-height:1.7}.medgen-clinical-disclaimer{margin-top:12px;padding:9px;border-radius:9px;background:#101f2c;color:#8fa3b5;font-size:11px;line-height:1.5}.medgen-clinical-log{max-height:320px;overflow:auto}.medgen-clinical-grid canvas{max-width:100%}@media(max-width:1080px){.medgen-clinical-grid{grid-template-columns:minmax(0,1fr) minmax(0,1.55fr)}.medgen-clinical-left{grid-column:1/-1}.medgen-clinical-left-inner{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}}@media(max-width:720px){.medgen-clinical-grid{grid-template-columns:minmax(0,1fr)}.medgen-clinical-left{grid-column:auto}.medgen-clinical-left-inner{grid-template-columns:minmax(0,1fr)}.medgen-clinical-vitals{grid-template-columns:repeat(2,minmax(0,1fr))}.medgen-clinical-tabs{position:sticky;top:0;z-index:2;background:#0a1723;padding:4px 0}.medgen-clinical-dock{padding:10px}}";
      card.appendChild(uiStyle);
      var shell = el("div", "width:100%;box-sizing:border-box");
      shell.className = "medgen-clinical-shell";
      var topbar = el("div", "");
      topbar.className = "medgen-clinical-top";
      var grid = el("div", "");
      grid.className = "medgen-clinical-grid";
      var leftDock = el("section", "");
      leftDock.className = "medgen-clinical-dock medgen-clinical-left";
      var leftInner = el("div", "");
      leftInner.className = "medgen-clinical-left-inner";
      var centerDock = el("section", "");
      centerDock.className = "medgen-clinical-dock medgen-clinical-center";
      var rightDock = el("section", "");
      rightDock.className = "medgen-clinical-dock";
      var rightTabs = el("div", "");
      rightTabs.className = "medgen-clinical-tabs";
      var rightActionsPane = el("div", "");
      rightActionsPane.className = "medgen-clinical-pane";
      var rightLogPane = el("div", "display:none");
      rightLogPane.className = "medgen-clinical-pane medgen-clinical-log";
      var rightHandoffPane = el("div", "display:none");
      rightHandoffPane.className = "medgen-clinical-pane";
      var tabButtons = {};
      function setRightTab(name) {
        rightActionsPane.style.display = name === "actions" ? "block" : "none";
        rightLogPane.style.display = name === "log" ? "block" : "none";
        rightHandoffPane.style.display = name === "handoff" ? "block" : "none";
        Object.keys(tabButtons).forEach(function(key) {
          tabButtons[key].setAttribute("aria-selected", key === name ? "true" : "false");
        });
        // Full Code panes live inside mountFullCodeView's own closure.
        // Route through its explicit bridge instead of referencing inaccessible locals.
        if (typeof fullCodeSetTab === "function") fullCodeSetTab(name);
      }
      [["actions","Tekshiruv / Muolaja"],["log","Jarayon jurnali"],["handoff","Topshirish"]].forEach(function(item) {
        var b = el("button", "", item[1]); b.type = "button"; b.className = "medgen-clinical-tab";
        b.setAttribute("aria-selected", item[0] === "actions" ? "true" : "false");
        b.onclick = function(){ setRightTab(item[0]); };
        tabButtons[item[0]] = b; rightTabs.appendChild(b);
      });
      shell.appendChild(topbar); shell.appendChild(grid);
      grid.appendChild(leftDock); grid.appendChild(centerDock); grid.appendChild(rightDock);
      leftDock.appendChild(leftInner);
      rightDock.appendChild(rightTabs); rightDock.appendChild(rightActionsPane);
      rightDock.appendChild(rightLogPane); rightDock.appendChild(rightHandoffPane);
      var patientCard = el("div", "margin-bottom:12px");
      patientCard.appendChild(el("h4", "", "Bemor kartasi"));
      patientCard.appendChild(el("div", "font-weight:800;font-size:15px;color:#e8f0f6;margin-bottom:6px", c.title || "Klinik keys"));
      var patientMeta = el("div", "", "Keys: " + (c.id || "—") + " · Daraja: " + (c.level || "—")); patientMeta.className = "medgen-clinical-meta"; patientCard.appendChild(patientMeta);
      var storyCard = el("div", "");
      storyCard.appendChild(el("h4", "", "Klinik vaziyat"));
      var storyText = el("div", "", c.story || "Klinik vaziyat tavsifi mavjud emas."); storyText.className = "medgen-clinical-story"; storyCard.appendChild(storyText);
      var disclaimer = el("div", "", "Ta’limiy simulyatsiya. Bu panel haqiqiy bemor monitoringi yoki tibbiy qaror o‘rnini bosmaydi."); disclaimer.className = "medgen-clinical-disclaimer"; storyCard.appendChild(disclaimer);
      leftInner.appendChild(patientCard); leftInner.appendChild(storyCard);
      if (c.patient || (c.anamnesis && c.anamnesis.length) || (c.allergies && c.allergies.length) || (c.dialogue && c.dialogue.length)) {
        var historyCard = el("div", "margin-top:12px");
        historyCard.appendChild(el("h4", "", "Anamnez va allergiya tarixi"));
        if (c.patient) {
          var pmeta = [];
          if (c.patient.age_years) pmeta.push(c.patient.age_years + " yosh");
          if (c.patient.weight_kg) pmeta.push(c.patient.weight_kg + " kg");
          if (c.patient.setting) pmeta.push(c.patient.setting);
          historyCard.appendChild(el("div", "font-size:12px;color:#a9bdcc;margin-bottom:8px", pmeta.join(" · ")));
        }
        (c.anamnesis || []).forEach(function(item) {
          var line = el("div", "font-size:12px;line-height:1.55;margin:5px 0;color:#c4d4e0");
          line.appendChild(el("strong", "color:#8fd9ed", item.label + ": "));
          line.appendChild(document.createTextNode(item.value || ""));
          historyCard.appendChild(line);
        });
        if (c.allergies && c.allergies.length) {
          historyCard.appendChild(el("div", "font-size:12px;font-weight:800;color:#fda4af;margin:10px 0 5px", "Allergiyalar / nojo‘ya reaksiyalar"));
          c.allergies.forEach(function(item) {
            var line = el("div", "font-size:12px;line-height:1.5;margin:5px 0;padding:7px;border:1px solid #563342;border-radius:8px;background:#211923");
            line.appendChild(el("strong", "color:#fecdd3", item.name + " — "));
            line.appendChild(document.createTextNode((item.reaction || "") + (item.certainty ? " · " + item.certainty : "")));
            historyCard.appendChild(line);
          });
        }
        leftInner.appendChild(historyCard);
      }
      if (c.dialogue && c.dialogue.length) {
        var dialogueCard = el("div", "margin-top:12px");
        dialogueCard.appendChild(el("h4", "", "Bemor bilan suhbat"));
        var dialogueAnswer = el("div", "min-height:68px;padding:9px;border:1px solid #29445a;border-radius:9px;background:#102232;color:#d5e5ef;font-size:12px;line-height:1.55;margin-bottom:8px", "Savolni tanlang — bemorning javobi shu yerda ko‘rsatiladi.");
        dialogueCard.appendChild(dialogueAnswer);
        var dialogueButtons = el("div", "display:flex;flex-direction:column;gap:6px");
        c.dialogue.forEach(function(item, index) {
          var q = el("button", "text-align:left;padding:8px 9px;background:#132b3d;color:#cde8f4;border:1px solid #31536a;border-radius:8px;font-size:12px;cursor:pointer", (index + 1) + ". " + item.question);
          q.type = "button";
          q.onclick = function() {
            dialogueAnswer.textContent = item.answer;
            dialogueButtons.querySelectorAll("button").forEach(function(btn){btn.style.borderColor="#31536a";});
            q.style.borderColor="#22d3ee";
          };
          dialogueButtons.appendChild(q);
        });
        dialogueCard.appendChild(dialogueButtons);
        leftInner.appendChild(dialogueCard);
      }
      var centerHeading = el("h4", "", "Bemor monitori va 3D klinika");
      centerDock.appendChild(centerHeading);
      card.appendChild(shell);
      var caseMenu = el("div", "display:flex;gap:8px;flex-wrap:wrap;margin:0 0 4px");
      [
        ["anaphylaxis", "1-keys: Anafilaksiya"],
        ["mi", "2-keys: STEMI"],
        ["pneumonia", "3-keys: Pnevmoniya"],
        ["anaphylaxis_jasur", "4-keys: Jasur — anafilaksiya"]
      ].forEach(function (entry, index) {
        var b = el("button", "padding:7px 11px;background:#1e293b;color:" + (index === 3 ? "#fb7185" : "#38bdf8") + ";border:1px solid #334155;border-radius:7px;font-weight:700;cursor:pointer;font-size:12px", entry[1]);
        b.type = "button";
        b.onclick = function () {
          if (window.medgenPatient) window.medgenPatient.start(entry[0]);
          else open(targetRoot, entry[0]);
        };
        caseMenu.appendChild(b);
      });
      topbar.appendChild(caseMenu);
      topbar.appendChild(el("h3", "margin:0;font-size:19px", c.title));
      topbar.appendChild(el("p", "color:#a9bdcc;font-size:13px;margin:0", c.story));
      hud = el("div", "display:flex;gap:8px;align-items:center;justify-content:space-between;margin-bottom:6px;font-size:13px");
      var timeLbl = el("span", "color:#f6c85f", "");
      var penLbl = el("span", "color:#ff8a8a", "");
      hud.appendChild(timeLbl); hud.appendChild(penLbl); topbar.appendChild(hud);
      hud.time = timeLbl; hud.pen = penLbl;

      canvas = document.createElement("canvas");
      canvas.width = 800; canvas.height = 150;
      canvas.style.cssText = "width:100%;height:auto;background:#020a12;border:1px solid #1d3042;border-radius:12px";
      centerDock.appendChild(canvas);

      var row = el("div", "display:flex;gap:8px;flex-wrap:wrap;margin:8px 0");
      ["hr", "bp", "spo2", "rr"].forEach(function (k) {
        var t = el("div", TILE); var lbl = el("div", "font-size:11px;color:#8fa3b5", {hr:"Puls (bpm)",bp:"Qon bosimi (mmHg)",spo2:"SpO₂ (%)",rr:"Nafas (/daq)"}[k]);
        var val = el("div", "font-size:26px;font-weight:700", "–");
        t.appendChild(lbl); t.appendChild(val); row.appendChild(t); tiles[k] = val;
      });
      row.className = "medgen-clinical-vitals"; centerDock.appendChild(row);

      // Generic 3D patient room for the standard clinical cases. Jasur has a dedicated interactive scene below.
      if (c.id !== "anaphylaxis_jasur" && window.medgen3DClinic && window.THREE) {
        var genericClinic = el("div", "margin:10px 0;padding:10px;border:1px solid #28465c;border-radius:14px;background:#071521");
        genericClinic.appendChild(el("div", "font-weight:800;color:#67e8f9;margin-bottom:6px", "3D VIRTUAL CLINIC"));
        genericClinic.appendChild(el("div", "font-size:12px;color:#9fb5c7;margin-bottom:8px", "Bemor modeli va nafas harakati vitallar simulyatsiyasiga bog‘langan. Jihozlar vizual o‘quv maketidir."));
        var genericWrap=el("div","width:100%;height:280px;border-radius:10px;overflow:hidden;background:#071521");
        genericWrap.id="medgen-3d-patient-"+Date.now();
        genericClinic.appendChild(genericWrap);
        centerDock.appendChild(genericClinic);
        genericClinicMounted=!!window.medgen3DClinic.mount3DScene(genericWrap.id);
      }

      actionsBox = el("div", "margin:6px 0");
      rightActionsPane.appendChild(el("h4", "", "Klinik harakatlar"));
      rightActionsPane.appendChild(el("div", "font-size:12px;color:#8fa3b5;margin:0 0 8px", "Har bir klinik harakat mavjud simulyatsiya dvigateli orqali qayd etiladi."));
      rightActionsPane.appendChild(actionsBox);
      logBox = el("div", "font-size:12px;color:#8fa3b5;max-height:90px;overflow:auto;border-top:1px solid #1d3042;margin-top:6px;padding-top:6px");
      rightLogPane.appendChild(el("h4", "", "Harakatlar tarixi"));
      rightLogPane.appendChild(logBox);
      endBox = el("div", "margin-top:8px");
      rightHandoffPane.appendChild(el("h4", "", "Klinik topshirish"));
      rightHandoffPane.appendChild(el("p", "font-size:12px;color:#8fa3b5;line-height:1.5", "Yakunlash tugmasi simulyatsiyani to‘xtatadi, tashxis tanlash va serverdagi haqiqiy baholash bosqichini ochadi."));
      handoffFinishBtn = el("button", "width:100%;padding:12px;margin:4px 0 12px;border:0;border-radius:9px;background:#059669;color:#fff;font-weight:800;font-size:13px;cursor:pointer;box-shadow:0 4px 12px rgba(5,150,105,.25)", "📋 Epikrizni chiqarish va Yakunlash");
      handoffFinishBtn.type = "button";
      handoffFinishBtn.onclick = function () { if (running && sim && !sim.ended) finish(); else if (sim && sim.ended) setRightTab("handoff"); };
      rightHandoffPane.appendChild(handoffFinishBtn);
      rightHandoffPane.appendChild(endBox);

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

      if (c.id === "anaphylaxis_jasur" && window.THREE && THREE.WebGLRenderer) {
        var clinic = el("div", "margin:10px 0;padding:10px;border:1px solid #28465c;border-radius:14px;background:#071521");
        clinic.appendChild(el("div", "font-weight:800;color:#67e8f9;margin-bottom:6px", "3D VIRTUAL CLINIC — Jasur"));
        clinic.appendChild(el("div", "font-size:12px;color:#9fb5c7;margin-bottom:8px", "Asbobni tanlang, so‘ng mos anatomik nishonni bosing. Interaktiv anatomik bemor modeli: ko‘rik nuqtalarini tanlang va muolajalarni bajaring."));
        var tools3 = el("div", "display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px");
        var view3 = el("div", "height:260px;width:100%;background:#06101b;border-radius:10px;overflow:hidden");
        view3.className="medgen-jasur-3d-stage";
        clinic.appendChild(tools3); clinic.appendChild(view3); centerDock.appendChild(clinic);
        var chosen = "epi";
        actionsBox.style.display="none";
        var examPanel=el("div","margin-top:9px;padding:12px;border:1px solid #29465a;border-radius:12px;background:#0a1b28");
        examPanel.appendChild(el("div","font-weight:800;color:#9fe7f4;margin-bottom:8px","Klinik ko‘rik va diagnostika — Body Interact"));
        var examOut=el("div","font-size:12px;line-height:1.5;color:#9fb5c7;min-height:34px;margin:8px 0 2px","Tekshiruv turini tanlang.");
        var examList=el("div","display:flex;flex-direction:column;gap:6px");
        examPanel.appendChild(examList);examPanel.appendChild(examOut);rightActionsPane.appendChild(examPanel);
        function showResult(t){examOut.textContent=t;}
        function examItem(icon,label,description,fn){
          var b=el("button","display:flex;align-items:center;gap:10px;width:100%;min-height:42px;padding:9px 11px;margin:0;border:1px solid #263b50;border-radius:8px;background:#101d2b;color:#dce8f2;text-align:left;font-size:12px;font-weight:650;cursor:pointer;box-sizing:border-box");
          b.type="button";b.appendChild(el("span","font-size:17px;flex:0 0 24px",icon));
          var copy=el("span","display:flex;flex-direction:column;gap:2px;min-width:0");
          copy.appendChild(el("strong","font-size:12px;color:#e5eef6",label));
          copy.appendChild(el("span","font-size:10px;font-weight:400;color:#8fa3b5",description));
          b.appendChild(copy);b.onclick=fn;examList.appendChild(b);
        }
        examItem("🩺","Auskultatsiya","Ko‘krak qafasi auskultatsiyasi",function(){chosen="stethoscope";showResult("Stetoskop tanlandi. 3D bemor modelidagi ko‘krak hotspotini bosing.");});
        examItem("🧪","ABG","Arterial qon gazlari",function(){showResult("ABG — ushbu keysda laboratoriya natijasi alohida serverdan olinmaydi. Simulyatsiya ko‘rsatkichlarini klinik kontekstda baholang.");});
        examItem("📈","EKG","12-kanalli elektrokardiografiya",function(){showResult("Mavjud monitor EKGsi simulyatsion ritmni ko‘rsatadi. 12-kanalli diagnostik EKG yozuvi bu keysda alohida yaratilmagan.");});
        examItem("🩻","Rentgen","Ko‘krak qafasi rentgeni",function(){showResult("Rentgen tasviri ushbu keys uchun ulanmagan; tasvir yoki radiologik xulosa mavjud emas.");});
                try {
          var sc=new THREE.Scene(); sc.background=new THREE.Color(0x071521);
          var cam=new THREE.PerspectiveCamera(42,1,0.1,100); cam.position.set(0.35,2.25,4.45); cam.lookAt(0,1.0,-.35);
          var clinicControls=null;
          clinicRenderer=new THREE.WebGLRenderer({antialias:true,alpha:false}); clinicRenderer.setPixelRatio(Math.min(window.devicePixelRatio||1,1.75)); clinicRenderer.shadowMap.enabled=true; clinicRenderer.shadowMap.type=THREE.PCFSoftShadowMap; clinicRenderer.outputEncoding=THREE.sRGBEncoding; clinicRenderer.toneMapping=THREE.ACESFilmicToneMapping; clinicRenderer.toneMappingExposure=1.12; view3.appendChild(clinicRenderer.domElement);
          clinicRenderer.domElement.id="three-canvas";clinicRenderer.domElement.style.cssText="width:100%;height:100%;display:block;background-color:#080d14;touch-action:none";
          if(THREE.OrbitControls){clinicControls=new THREE.OrbitControls(cam,clinicRenderer.domElement);clinicControls.target.set(0,1.0,-.35);clinicControls.enableDamping=true;clinicControls.dampingFactor=.06;clinicControls.minDistance=2.35;clinicControls.maxDistance=6.5;clinicControls.maxPolarAngle=Math.PI*.49;}
          sc.add(new THREE.HemisphereLight(0xffffff,0x334455,2));
          var light=new THREE.DirectionalLight(0xfff2e6,2.2); light.position.set(-2,5,3); light.castShadow=true; light.shadow.mapSize.set(1024,1024); sc.add(light); var fillLight=new THREE.DirectionalLight(0x9bc9e8,.75); fillLight.position.set(3,2,-2); sc.add(fillLight);
          var floor=new THREE.Mesh(new THREE.PlaneGeometry(10,10),new THREE.MeshStandardMaterial({color:0x263b49,roughness:.94})); floor.rotation.x=-Math.PI/2; floor.receiveShadow=true; sc.add(floor);
          // Emergency-room props: bed, monitor, IV stand and oxygen cylinder.
          var metal=new THREE.MeshStandardMaterial({color:0x9aaab5,metalness:.55,roughness:.35});
          var dark=new THREE.MeshStandardMaterial({color:0x17232d,roughness:.6});
          var mattress=new THREE.MeshStandardMaterial({color:0xd7e1e8,roughness:.9});
          function roomBox(w,h,d,x,y,z,mat){var q=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat);q.position.set(x,y,z);sc.add(q);return q;}
          roomBox(2.25,.16,1.05,0,.18,-.45,metal); roomBox(2.1,.18,.98,0,.34,-.45,mattress);
          roomBox(1.9,.035,.86,0,.455,-.45,new THREE.MeshStandardMaterial({color:0xf1f5f9,roughness:1})); roomBox(.48,.12,.55,-.78,.51,-.45,new THREE.MeshStandardMaterial({color:0xe7edf2,roughness:1}));
          // Clinical bed details: adjustable frame, padded rails, casters and brake pedals.
          roomBox(1.82,.09,.72,0,.12,-.45,dark);
          [-.78,.78].forEach(function(x){[-.78,.02].forEach(function(z){var leg=new THREE.Mesh(new THREE.CylinderGeometry(.035,.045,.32,12),metal);leg.position.set(x,.02,z-.45);sc.add(leg);var wheel=new THREE.Mesh(new THREE.TorusGeometry(.065,.018,8,18),dark);wheel.rotation.y=Math.PI/2;wheel.position.set(x,.035,z-.45);sc.add(wheel);});});
          [-.99,.99].forEach(function(x){var rail=new THREE.Mesh(new THREE.CylinderGeometry(.035,.035,.82,12),metal);rail.rotation.x=Math.PI/2;rail.position.set(x,.72,-.45);sc.add(rail);[-.78,-.12,.2].forEach(function(z){var post=new THREE.Mesh(new THREE.CylinderGeometry(.018,.018,.2,8),metal);post.position.set(x,.61,z-.45);sc.add(post);});[-.86,-.04].forEach(function(z){var cap=new THREE.Mesh(new THREE.SphereGeometry(.035,10,8),metal);cap.position.set(x,.72,z-.45);sc.add(cap);});});
          roomBox(.1,.42,.96,-1.08,.54,-.45,metal); roomBox(.1,.42,.96,1.08,.54,-.45,metal);
          roomBox(.18,.1,.26,-1.18,.2,-.45,dark); roomBox(.18,.1,.26,1.18,.2,-.45,dark);
          // Mattress seam and folded white hospital sheet.
          var sheetMat=new THREE.MeshStandardMaterial({color:0xf8fafc,roughness:1});
          roomBox(1.8,.018,.78,0,.465,-.45,sheetMat);

          [-.95,.95].forEach(function(x){roomBox(.08,.72,.08,x,.45,-.45,metal);});
          roomBox(.08,.28,1.02,-1.04,.62,-.45,metal); roomBox(.08,.28,1.02,1.04,.62,-.45,metal);
          // bedside monitor and ECG display
          roomBox(.48,.42,.12,1.35,1.45,-.2,dark);
          var monitorCanvas=document.createElement("canvas");monitorCanvas.width=512;monitorCanvas.height=320;
          var monitorCtx=monitorCanvas.getContext("2d");
          var monitorTexture=new THREE.CanvasTexture(monitorCanvas);
          var screenMat=new THREE.MeshBasicMaterial({map:monitorTexture});
          roomBox(.42,.34,.025,1.35,1.46,-.125,screenMat);
          var monitorStand=new THREE.Mesh(new THREE.CylinderGeometry(.035,.035,.72,10),metal);monitorStand.position.set(1.35,.95,-.2);sc.add(monitorStand);
          roomBox(.42,.06,.3,1.35,.57,-.2,metal);
          // Monitor controls, mounting arm, alarm speaker and patient lead cables.
          [-.13,-.04,.05,.14].forEach(function(x){var key=new THREE.Mesh(new THREE.CylinderGeometry(.014,.014,.012,10),new THREE.MeshStandardMaterial({color:0x38bdf8,metalness:.2}));key.position.set(1.35+x,1.22,-.105);sc.add(key);});
          var monitorArm=new THREE.Mesh(new THREE.CylinderGeometry(.025,.025,.32,10),metal);monitorArm.position.set(1.35,1.68,-.42);monitorArm.rotation.x=.35;sc.add(monitorArm);
          var alarmLed=new THREE.Mesh(new THREE.SphereGeometry(.018,10,8),new THREE.MeshBasicMaterial({color:0x22c55e}));alarmLed.position.set(1.53,1.61,-.105);sc.add(alarmLed);
          var leadMat=new THREE.MeshStandardMaterial({color:0x263746,roughness:.65});
          [[1.2,1.25,-.1],[1.3,1.24,-.1],[1.4,1.24,-.1]].forEach(function(p){var cable=new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([new THREE.Vector3(p[0],p[1],p[2]),new THREE.Vector3(1.18,.92,-.05),new THREE.Vector3(.7,.78,-.05),new THREE.Vector3(.25,.8,-.1)]),16,.006,5,false),leadMat);sc.add(cable);});

          // IV pole with fluid bag
          var pole=new THREE.Mesh(new THREE.CylinderGeometry(.018,.025,2.05,10),metal);pole.position.set(-1.45,1.03,-.35);sc.add(pole);
          var ivBase=new THREE.Mesh(new THREE.CylinderGeometry(.24,.24,.035,20),metal);ivBase.position.set(-1.45,.06,-.35);sc.add(ivBase);
          for(var wi=0;wi<4;wi++){var ang=wi*Math.PI/2,cast=new THREE.Mesh(new THREE.CylinderGeometry(.018,.018,.28,8),metal);cast.rotation.z=Math.PI/2;cast.position.set(-1.45+Math.cos(ang)*.17,.06,-.35+Math.sin(ang)*.17);sc.add(cast);var caster=new THREE.Mesh(new THREE.TorusGeometry(.035,.012,6,12),dark);caster.rotation.y=Math.PI/2;caster.position.set(-1.45+Math.cos(ang)*.23,.04,-.35+Math.sin(ang)*.23);sc.add(caster);}
          [-.12,.12].forEach(function(x){var hook=new THREE.Mesh(new THREE.TorusGeometry(.055,.009,6,12,Math.PI),metal);hook.position.set(-1.45+x,2.04,-.35);sc.add(hook);});

          // oxygen cylinder and regulator
          var tank=new THREE.Mesh(new THREE.CylinderGeometry(.13,.13,.85,16),new THREE.MeshStandardMaterial({color:0x2f9b78,metalness:.25}));tank.position.set(1.75,.48,.25);sc.add(tank);
          var tankTop=new THREE.Mesh(new THREE.CylinderGeometry(.055,.09,.14,12),metal);tankTop.position.set(1.75,.96,.25);sc.add(tankTop);
          var gauge=new THREE.Mesh(new THREE.CylinderGeometry(.075,.075,.025,20),new THREE.MeshStandardMaterial({color:0xe5e7eb,metalness:.35}));gauge.rotation.x=Math.PI/2;gauge.position.set(1.75,1.08,.25);sc.add(gauge);
          var gaugeFace=new THREE.Mesh(new THREE.CircleGeometry(.06,20),new THREE.MeshBasicMaterial({color:0xf8fafc}));gaugeFace.position.set(1.75,1.08,.265);sc.add(gaugeFace);
          var gaugeNeedle=new THREE.Mesh(new THREE.BoxGeometry(.006,.045,.006),new THREE.MeshBasicMaterial({color:0xdc2626}));gaugeNeedle.position.set(1.75,1.09,.274);gaugeNeedle.rotation.z=-.5;sc.add(gaugeNeedle);
          var flowTube=new THREE.Mesh(new THREE.CylinderGeometry(.025,.025,.22,10),new THREE.MeshStandardMaterial({color:0xdbeafe,transparent:true,opacity:.4}));flowTube.position.set(1.87,.94,.25);sc.add(flowTube);
          var flowKnob=new THREE.Mesh(new THREE.SphereGeometry(.035,10,8),new THREE.MeshStandardMaterial({color:0xfbbf24,metalness:.2}));flowKnob.position.set(1.87,.83,.25);sc.add(flowKnob);

          roomBox(3,.06,.05,0,2.35,-1.15,metal);
          // Room architecture and clinical storage
          roomBox(7,3.2,.12,0,1.55,-2.25,new THREE.MeshStandardMaterial({color:0x263c4b,roughness:.95}));
          roomBox(1.5,.75,.42,-2.15,.62,-1.45,new THREE.MeshStandardMaterial({color:0xc5d0d7,roughness:.7}));
          roomBox(1.5,.08,.44,-2.15,1.04,-1.45,metal);
          roomBox(.08,.65,.08,-2.82,.68,-1.2,metal);
          roomBox(.08,.65,.08,-1.48,.68,-1.2,metal);
          // Emergency trolley and defibrillator
          roomBox(.68,.18,.42,-1.65,.32,.85,metal);
          [ [-1.9,.12,.68],[-1.4,.12,.68],[-1.9,.12,1.02],[-1.4,.12,1.02] ].forEach(function(p){var wh=new THREE.Mesh(new THREE.CylinderGeometry(.065,.065,.05,12),dark);wh.rotation.x=Math.PI/2;wh.position.set(p[0],p[1],p[2]);sc.add(wh);});
          roomBox(.34,.28,.25,-1.65,.58,.85,dark);
          roomBox(.28,.2,.025,-1.65,.6,.72,new THREE.MeshBasicMaterial({color:0x153c3a}));
          roomBox(.58,.12,.38,-1.65,.47,.85,new THREE.MeshStandardMaterial({color:0xe2e8f0,metalness:.15}));
          [ .34,.48,.62 ].forEach(function(y){roomBox(.5,.012,.02,-1.65,y,.63,new THREE.MeshStandardMaterial({color:0x64748b}));});
          [-1.9,-1.4].forEach(function(x){var wheel=new THREE.Mesh(new THREE.TorusGeometry(.055,.014,6,14),dark);wheel.position.set(x,.13,.85);sc.add(wheel);});
          var defibScreen=new THREE.Mesh(new THREE.PlaneGeometry(.18,.1),new THREE.MeshBasicMaterial({color:0x14532d}));defibScreen.position.set(-1.65,.63,.715);sc.add(defibScreen);
          var paddles=[-1.82,-1.48];paddles.forEach(function(x){var pad=new THREE.Mesh(new THREE.CylinderGeometry(.045,.045,.025,16),new THREE.MeshStandardMaterial({color:0x64748b,metalness:.5}));pad.position.set(x,.72,.82);sc.add(pad);});

          // Wall-mounted oxygen outlet and room light panels
          roomBox(.22,.18,.08,1.8,1.85,-2.12,new THREE.MeshStandardMaterial({color:0x3ba6a0,metalness:.2}));
          roomBox(1.2,.045,.35,0,2.8,-.8,new THREE.MeshStandardMaterial({color:0xe6f1f5,emissive:0x52616b,emissiveIntensity:.45}));
          var roomLight=new THREE.PointLight(0xd8efff,1.2,7);roomLight.position.set(0,2.6,1.2);sc.add(roomLight);
          // Enclosed emergency department architecture and privacy curtain.
          var wallMat=new THREE.MeshStandardMaterial({color:0xdce7e9,roughness:.94}),lowerWallMat=new THREE.MeshStandardMaterial({color:0x78999c,roughness:.9}),glassRoomMat=new THREE.MeshStandardMaterial({color:0x8bc9df,transparent:true,opacity:.20,roughness:.12,side:THREE.DoubleSide});
          roomBox(7,3,.12,0,1.52,-2.32,wallMat);roomBox(7,.82,.14,0,.43,-2.22,lowerWallMat);roomBox(.12,3,4.7,-3.45,1.52,-.05,wallMat);roomBox(.12,3,4.7,3.45,1.52,-.05,wallMat);
          roomBox(.04,1.25,1.75,-3.36,2.0,-.45,metal);roomBox(.025,1.12,1.62,-3.32,2.0,-.45,glassRoomMat);
          [-1.2,1.2].forEach(function(x){roomBox(1.25,.045,.5,x,2.82,-.35,new THREE.MeshStandardMaterial({color:0xf8fbff,emissive:0xb8d9e8,emissiveIntensity:.45,roughness:.3}));});
          roomBox(1.9,.035,.035,2.25,2.55,-.15,metal);
          var curtain=new THREE.Mesh(new THREE.PlaneGeometry(1.65,2.05,12,12),new THREE.MeshStandardMaterial({color:0x9bcbd3,transparent:true,opacity:.26,side:THREE.DoubleSide,roughness:.95}));curtain.position.set(2.45,1.48,-.05);curtain.rotation.y=-.12;sc.add(curtain);
          // 3D training avatars (stylized geometry, not photoreal scans).
          function staffAvatar(x,z,coat,accent,role){
            var g=new THREE.Group();g.position.set(x,0,z);sc.add(g);
            var coatMat=new THREE.MeshStandardMaterial({color:coat,roughness:.82}),accentMat=new THREE.MeshStandardMaterial({color:accent,roughness:.75}),skinMat=new THREE.MeshStandardMaterial({color:0xc99172,roughness:.78}),darkMat=new THREE.MeshStandardMaterial({color:0x263746,roughness:.85});
            function part(parent,geo,mat,px,py,pz,sx,sy,sz){var m=new THREE.Mesh(geo,mat);m.position.set(px,py,pz);m.scale.set(sx||1,sy||1,sz||1);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;}
            var torso=part(g,new THREE.CylinderGeometry(.19,.24,.66,18),coatMat,0,1.12,0,1,1,.72);
            var headPivot=new THREE.Group();headPivot.position.set(0,1.48,0);g.add(headPivot);
            part(headPivot,new THREE.SphereGeometry(.145,20,16),skinMat,0,.14,0,1,1.08,.95);
            part(headPivot,new THREE.CylinderGeometry(.055,.06,.16,12),skinMat,0,0,0);
            var arms=[];
            [-.21,.21].forEach(function(ax,index){
              var shoulder=new THREE.Group();shoulder.position.set(ax,1.36,0);g.add(shoulder);arms.push(shoulder);
              part(shoulder,new THREE.CylinderGeometry(.055,.075,.58,12),coatMat,0,-.29,0);
              part(shoulder,new THREE.SphereGeometry(.065,12,10),skinMat,0,-.61,.015);
              part(g,new THREE.CylinderGeometry(.07,.08,.72,12),darkMat,ax,.28,0);
              part(g,new THREE.BoxGeometry(.18,.08,.32),darkMat,ax,.035,.035);
            });
            part(g,new THREE.BoxGeometry(.035,.28,.018),accentMat,-.055,1.15,.173);
            part(g,new THREE.BoxGeometry(.035,.28,.018),accentMat,.055,1.15,.173);
            part(g,new THREE.BoxGeometry(.16,.1,.025),accentMat,0,1.38,.14);
            if(role==="DOCTOR")part(g,new THREE.SphereGeometry(.15,16,10),accentMat,0,1.75,0,1,.28,1);
            else part(g,new THREE.CylinderGeometry(.16,.16,.08,18),accentMat,0,1.72,0);
            g.userData.staffMotion={head:headPivot,arms:arms,torso:torso,role:role,phase:x<0?0:Math.PI};
            return g;
          }
          var doctorAvatar=staffAvatar(-2.25,.15,0xf1f5f9,0x2563eb,"DOCTOR");
          var nurseAvatar=staffAvatar(2.25,.1,0x0f766e,0x99f6e4,"NURSE");
          function triggerStaffTask(role,task){
            var avatar=role==="DOCTOR"?doctorAvatar:nurseAvatar;
            if(!avatar||!avatar.userData.staffMotion)return;
            avatar.userData.staffMotion.task=task;
            avatar.userData.staffMotion.taskUntil=Date.now()+2600;
          }
          roomBox(2.4,.26,.08,0,1.86,-2.20,dark);[0x38bdf8,0x22c55e,0xf59e0b,0xe2e8f0].forEach(function(col,i){var outlet=new THREE.Mesh(new THREE.CylinderGeometry(.055,.055,.025,18),new THREE.MeshStandardMaterial({color:col,metalness:.25,roughness:.35}));outlet.rotation.x=Math.PI/2;outlet.position.set(-.78+i*.52,1.86,-2.14);sc.add(outlet);});
          // Patient GLB: supplied CDN model, with a procedural fallback if the CDN is unreachable.
          var patient=new THREE.Group(); patient.rotation.z=Math.PI/2; patient.scale.setScalar(.9); patient.position.set(-0.05,.62,-.45); sc.add(patient);
          var skinMats=[],patientModel=null,patientChest=null,faceMesh=null,faceTint=null,chestBaseRotation=null,chestBaseScale=null,chestBreathMeshes=[],recoveryStarted=0,recoveryFrom=new THREE.Color(0x94a3b8),recoveryTo=new THREE.Color(0xfbcfe8),oxygenFlowDots=[],ivFlowDots=[],oxygenCurve=null,ivCurve=null,ivDrop=null,ivChamberGlow=null,oxygenFlowGlow=null;
          var loader=new THREE.GLTFLoader();
          // GRADD xona GLB vaqtincha o‘chirildi: asset geometriyasi mobil kamerada oq/katta ko‘rinmoqda. Mavjud procedural xona saqlanadi.
          // Quaternius bemor modeli mavjud supine patient wrapper ichiga yuklanadi.
          // Parent transform karavot koordinatalari va amaldagi raycaster bilan mos qoladi.
          view3.dataset.patientModelStatus="loading";
          loader.load("/models/medgen-patient.glb",function(gltf){
            if(!clinicRenderer)return;
            patientModel=gltf.scene;
            if(fallbackPatient)fallbackPatient.visible=false;
            // Fallback hotspotlarni olib tashlab, haqiqiy model bo‘yicha qayta joylaymiz.
            targets.slice().forEach(function(t){if(t.userData&&t.userData.zone){patient.remove(t);}});
            targets.length=0;
            var initialBounds=new THREE.Box3().setFromObject(patientModel),initialSize=initialBounds.getSize(new THREE.Vector3());
            if(initialSize.x>initialSize.y*1.2)patientModel.rotation.z=Math.PI/2;
            var preFitBounds=new THREE.Box3().setFromObject(patientModel),preFitSize=preFitBounds.getSize(new THREE.Vector3());
            var fitScale=preFitSize.y>0?1.55/preFitSize.y:1;
            patientModel.scale.setScalar(fitScale);
            var modelBounds=new THREE.Box3().setFromObject(patientModel),modelSize=modelBounds.getSize(new THREE.Vector3()),modelCenter=modelBounds.getCenter(new THREE.Vector3());
            patientModel.position.sub(modelCenter);
            patient.add(patientModel); sc.updateMatrixWorld(true);
            var faceY=modelSize.y*.5-.12, chestY=modelSize.y*.16, thighY=-modelSize.y*.27, frontZ=modelSize.z*.5+.035;
            patientModel.traverse(function(node){if(!node.isMesh)return;node.castShadow=true;node.receiveShadow=true;node.frustumCulled=false;
              var n=(node.name||"").toLowerCase();
              if(n.indexOf("head")>=0||n.indexOf("face")>=0){faceMesh=node;var headMats=Array.isArray(node.material)?node.material:[node.material];headMats.forEach(function(m){if(m&&m.color){m.color.setHex(0x94a3b8);skinMats.push(m);}});}
              if(n.indexOf("chest")>=0||n.indexOf("torso")>=0)patientChest=node;
              if(node.geometry&&node.geometry.attributes&&node.geometry.attributes.position){
                var geom=node.geometry.clone(),attr=geom.attributes.position,base=new Float32Array(attr.array),weights=new Float32Array(attr.count);
                var origin=patient.localToWorld(new THREE.Vector3(0,0,0)),axisEnd=patient.localToWorld(new THREE.Vector3(0,0,1)),localOrigin=node.worldToLocal(origin.clone()),localAxis=node.worldToLocal(axisEnd.clone()).sub(localOrigin);
                for(var vi=0;vi<attr.count;vi++){var vp=new THREE.Vector3(base[vi*3],base[vi*3+1],base[vi*3+2]);node.localToWorld(vp);patient.worldToLocal(vp);var dy=(vp.y-chestY)/(modelSize.y*.14),dx=vp.x/(modelSize.x*.25);weights[vi]=Math.exp(-.5*(dy*dy+dx*dx));}
                node.geometry=geom;chestBreathMeshes.push({geometry:geom,base:base,weights:weights,axis:localAxis});
              }
            });
            if(!patientChest){patientChest=patientModel.getObjectByName("Chest")||patientModel.getObjectByName("Torso")||null;}
            if(patientChest){chestBaseRotation=patientChest.rotation.x;chestBaseScale=patientChest.scale.z;}
            if(faceMesh){var fb=new THREE.Box3().setFromObject(faceMesh),fc=fb.getCenter(new THREE.Vector3());patient.worldToLocal(fc);faceY=fc.y;frontZ=Math.max(frontZ,fc.z+.04);}
            faceTint=new THREE.Mesh(new THREE.SphereGeometry(.105,18,14),new THREE.MeshStandardMaterial({color:0x94a3b8,transparent:true,opacity:.28,roughness:.55,depthWrite:false}));
            faceTint.position.set(0,faceY,frontZ);faceTint.scale.set(.9,1.1,.42);patient.add(faceTint);
            mark("face",0,faceY,frontZ+.015,0x38bdf8);mark("chest",0,chestY,frontZ,0xfbbf24);
            mark("arm",-.34,chestY-.08,frontZ,0x34d399);mark("thigh",.2,thighY,frontZ,0xfb7185);
            mask.position.set(0,faceY,frontZ+.08);
            var faceWorld=patient.localToWorld(new THREE.Vector3(0,faceY,frontZ+.08));
            oxygenCurve=new THREE.CatmullRomCurve3([new THREE.Vector3(1.75,.9,.25),new THREE.Vector3(1.25,1.25,.35),new THREE.Vector3(.65,1.2,.15),faceWorld.clone()]);
            var oxygenTube=new THREE.Mesh(new THREE.TubeGeometry(oxygenCurve,32,.012,7,false),new THREE.MeshStandardMaterial({color:0xbdeaff,transparent:true,opacity:.55,roughness:.2}));sc.add(oxygenTube);
            var armWorld=patient.localToWorld(new THREE.Vector3(-.34,chestY-.08,frontZ));
            ivCurve=new THREE.CatmullRomCurve3([new THREE.Vector3(-1.45,1.62,-.35),new THREE.Vector3(-1.25,1.35,-.25),new THREE.Vector3(-.85,1.05,-.2),armWorld.clone()]);
            var ivTube=new THREE.Mesh(new THREE.TubeGeometry(ivCurve,28,.009,6,false),new THREE.MeshStandardMaterial({color:0x9bd5ed,transparent:true,opacity:.55,roughness:.2}));sc.add(ivTube);
            // Animated educational flow cues: remain dormant until the matching
            // clinical action is accepted by sim.act(); no flow-rate is implied.
            var flowDotMatO2=new THREE.MeshBasicMaterial({color:0x7dd3fc,transparent:true,opacity:.95});
            var flowDotMatIV=new THREE.MeshBasicMaterial({color:0x38bdf8,transparent:true,opacity:.95});
            for(var oi=0;oi<4;oi++){var od=new THREE.Mesh(new THREE.SphereGeometry(.024,8,8),flowDotMatO2);od.visible=false;sc.add(od);oxygenFlowDots.push(od);}
            for(var ii=0;ii<4;ii++){var idot=new THREE.Mesh(new THREE.SphereGeometry(.018,8,8),flowDotMatIV);idot.visible=false;sc.add(idot);ivFlowDots.push(idot);}
            ivDrop=new THREE.Mesh(new THREE.SphereGeometry(.022,9,8),flowDotMatIV);ivDrop.visible=false;sc.add(ivDrop);
            ivChamberGlow=new THREE.Mesh(new THREE.SphereGeometry(.052,10,8),new THREE.MeshBasicMaterial({color:0x38bdf8,transparent:true,opacity:.0}));ivChamberGlow.position.set(-1.45,1.55,-.29);sc.add(ivChamberGlow);
            oxygenFlowGlow=new THREE.Mesh(new THREE.SphereGeometry(.07,10,8),new THREE.MeshBasicMaterial({color:0x7dd3fc,transparent:true,opacity:.0}));oxygenFlowGlow.position.copy(faceWorld);sc.add(oxygenFlowGlow);

            clinicRenderer.render(sc,cam);
            view3.dataset.patientModelStatus="loaded";
          },undefined,function(err){
            view3.dataset.patientModelStatus="fallback";
            console.warn("Patient GLB yuklanmadi; oldindan chizilgan fallback maneken saqlanadi.",err);
            var note=el("div","position:absolute;right:9px;bottom:8px;padding:5px 8px;border-radius:6px;background:rgba(3,15,28,.88);color:#fcd34d;font-size:11px","Zaxira geometrik maneken · GLB yuklanmadi");
            view3.appendChild(note);clinicRenderer.render(sc,cam);
          });
          // IV fluid bag, drip chamber and clear oxygen mask.
          var clearMat=new THREE.MeshStandardMaterial({color:0xbdeaff,transparent:true,opacity:.24,roughness:.12,metalness:0,depthWrite:false});
          var ivBag=new THREE.Mesh(new THREE.BoxGeometry(.2,.3,.09),clearMat);ivBag.position.set(-1.45,1.78,-.35);sc.add(ivBag);
          var fluidFill=new THREE.Mesh(new THREE.BoxGeometry(.17,.18,.012),new THREE.MeshBasicMaterial({color:0x67c9ee,transparent:true,opacity:.34}));fluidFill.position.set(-1.45,1.72,-.295);sc.add(fluidFill);
          var bagPort=new THREE.Mesh(new THREE.CylinderGeometry(.025,.025,.07,10),clearMat);bagPort.position.set(-1.45,1.58,-.35);sc.add(bagPort);
          var clamp=new THREE.Mesh(new THREE.BoxGeometry(.05,.035,.025),new THREE.MeshStandardMaterial({color:0xfbbf24}));clamp.position.set(-1.45,1.48,-.35);sc.add(clamp);

          var drip=new THREE.Mesh(new THREE.CylinderGeometry(.025,.025,.18,8),new THREE.MeshStandardMaterial({color:0x9bd5ed,transparent:true,opacity:.55}));drip.position.set(-1.45,1.55,-.35);sc.add(drip);
          var mask=new THREE.Mesh(new THREE.SphereGeometry(.13,16,10,0,Math.PI*2,0,Math.PI/2),new THREE.MeshStandardMaterial({color:0xc7f0ff,transparent:true,opacity:.3,side:THREE.DoubleSide,depthWrite:false,roughness:.1}));mask.position.set(0,1.53,.25);mask.rotation.x=Math.PI/2;patient.add(mask); var maskTube=new THREE.Mesh(new THREE.TorusGeometry(.16,.008,6,32),new THREE.MeshStandardMaterial({color:0xc7f0ff,transparent:true,opacity:.45}));maskTube.position.set(0,1.53,.12);patient.add(maskTube);
          var targets=[];var equipmentTargets=[];
          function equipmentHotspot(zone,x,y,z,color){var ring=new THREE.Mesh(new THREE.TorusGeometry(.13,.026,7,22),new THREE.MeshBasicMaterial({color:color,transparent:true,opacity:.92}));ring.position.set(x,y,z);ring.userData.zone=zone;ring.userData.equipment=true;sc.add(ring);equipmentTargets.push(ring);return ring;}
          equipmentHotspot("monitor",1.35,1.72,-.08,0x38bdf8);equipmentHotspot("oxygen",1.45,1.12,.28,0x22c55e);equipmentHotspot("defibrillator",-1.45,.78,.72,0xfbbf24);equipmentHotspot("iv",-1.25,1.88,-.3,0xa78bfa);
          function mark(zone,x,y,z,color){var o=new THREE.Mesh(new THREE.TorusGeometry(.105,.028,6,18),new THREE.MeshBasicMaterial({color:color,transparent:true,opacity:.9}));o.position.set(x,y,z);o.userData.zone=zone;if(zone==="thigh")o.userData.actionKey="epi_thigh";patient.add(o);targets.push(o);}
          // GLB kechiksa yoki brauzerda yuklanmasa ham bemor ko‘rinishi va hotspotlar darhol mavjud.
          var fallbackPatient=window.ClinicalUIAdapter?window.ClinicalUIAdapter.renderFallbackMannequin(sc,patient):null;
          mark("face",0,.68,.19,0x38bdf8);mark("chest",0,.12,.18,0xfbbf24);mark("arm",-.38,.08,.12,0x34d399);mark("thigh",.13,-.68,.12,0xfb7185);
          mask.position.set(0,.68,.27);
          // Hotspots are positioned from the loaded supine model bounds after GLB load.
          function clinicAnimate(){if(!clinicRenderer)return;clinicRaf=requestAnimationFrame(clinicAnimate);
            var staffTime=Date.now()/1000;
             // The simulation core is the sole source of accepted-action state.
             var oxygenFlowActive=sim.hasAction("oxygen_high");
             var ivFlowActive=sim.hasAction("crystalloid_bolus");
             // Traveling particles make the connected oxygen line and IV line legible in 3D.
             oxygenFlowDots.forEach(function(dot,index){
               var active=oxygenFlowActive&&!!oxygenCurve;
               dot.visible=active;
               if(active){var u=(staffTime*.42+index/oxygenFlowDots.length)%1;dot.position.copy(oxygenCurve.getPointAt(u));}
             });
             if(oxygenFlowGlow&&oxygenFlowGlow.material)oxygenFlowGlow.material.opacity=oxygenFlowActive?(.12+Math.sin(staffTime*5)*.08):0;
             ivFlowDots.forEach(function(dot,index){
               var active=ivFlowActive&&!!ivCurve;
               dot.visible=active;
               if(active){var u=(staffTime*.3+index/ivFlowDots.length)%1;dot.position.copy(ivCurve.getPointAt(u));}
             });
             if(ivDrop){ivDrop.visible=ivFlowActive&&!!ivCurve;
               if(ivDrop.visible){var dropPhase=(staffTime*1.25)%1;ivDrop.position.set(-1.45,1.61-dropPhase*.12,-.29);}
               else ivDrop.position.set(-1.45,1.61,-.29);
             }
             if(ivChamberGlow&&ivChamberGlow.material)ivChamberGlow.material.opacity=ivFlowActive?(.12+Math.sin(staffTime*6)*.08):0;

            [doctorAvatar,nurseAvatar].forEach(function(avatar){
              var motion=avatar.userData.staffMotion,phase=staffTime*1.15+motion.phase;
              var remaining=motion.taskUntil-Date.now(),elapsed=2600-remaining,working=remaining>0;
              var reach=working?Math.min(1,elapsed/320,remaining/420)*.72:0;
              avatar.position.y=Math.sin(phase)*.012;
              avatar.rotation.y=Math.sin(phase*.55)*.035;
              motion.head.rotation.x=Math.sin(phase*.8)*.045+(working?-.12:0);
              motion.arms[0].rotation.z=.08+Math.sin(phase)*.12-(working?reach*.62:0);
              motion.arms[1].rotation.z=-.08+Math.sin(phase+1.2)*.1+(working?reach*.62:0);
              motion.arms[0].rotation.x=Math.sin(phase*.7)*.035+(working?-.48:0);
              motion.arms[1].rotation.x=Math.sin(phase*.7+1)*.035+(working?-.48:0);
              if(!working)motion.task=null;
            });
            var breath=1+Math.sin(Date.now()/1000*Math.max(.2,sim.state.rr/60)*Math.PI*2)*.012;
            targets.forEach(function(target){if(target.userData&&target.userData.zone==="thigh"){var p=1+Math.sin(Date.now()/260)*.13;target.scale.set(p,p,p);target.material.opacity=.62+Math.sin(Date.now()/260)*.28;}});
            var chestMotion=Math.sin(Date.now()/1000*Math.max(.2,sim.state.rr/60)*Math.PI*2)*.008;chestBreathMeshes.forEach(function(item){var a=item.geometry.attributes.position;for(var vi=0;vi<item.weights.length;vi++){var k=vi*3,w=item.weights[vi]*chestMotion;a.array[k]=item.base[k]+item.axis.x*w;a.array[k+1]=item.base[k+1]+item.axis.y*w;a.array[k+2]=item.base[k+2]+item.axis.z*w;}a.needsUpdate=true;}); if(patientChest){if(chestBaseRotation!==null)patientChest.rotation.x=chestBaseRotation+chestMotion*.7;else if(chestBaseScale!==null)patientChest.scale.z=chestBaseScale*(1+chestMotion);}
            if(recoveryStarted){var t=Math.min(1,(Date.now()-recoveryStarted)/3000),col=recoveryFrom.clone().lerp(recoveryTo,t);skinMats.forEach(function(m){if(m&&m.color)m.color.copy(col);});if(faceTint){faceTint.material.color.copy(col);faceTint.material.opacity=.28*(1-t)+.06*t;}}
            if(clinicControls)clinicControls.update();
            // Refresh the bedside monitor on the same animation frame as the 3D scene.
            // clinicSync reads sim.state, so ECG rate and displayed vitals share one source.
            if(clinicSync)clinicSync(sim.state);else clinicRenderer.render(sc,cam);
          }
          clinicAnimate();          // Live bedside monitor: same simulated vitals and ECG rhythm as the HUD.
          clinicSync=function(v){
            if(!clinicRenderer)return;
            var now=Date.now()/1000;
            var oxygenOn=sim.hasAction("oxygen_high");
            var ivOn=sim.hasAction("crystalloid_bolus");
            monitorCtx.fillStyle="#03100f";monitorCtx.fillRect(0,0,512,320);
            monitorCtx.fillStyle="#65f5d0";monitorCtx.font="bold 32px monospace";
            monitorCtx.fillText("HR "+Math.round(v.hr),18,42);
            monitorCtx.fillStyle="#f4d36b";monitorCtx.font="bold 27px monospace";
            monitorCtx.fillText("BP "+Math.round(v.sbp)+"/"+Math.round(v.dbp),18,78);
            monitorCtx.fillStyle="#71d8ff";monitorCtx.fillText("SpO2 "+Math.round(v.spo2)+"%",18,114);
            monitorCtx.fillStyle="#b6f28b";monitorCtx.fillText("RR "+Math.round(v.rr)+"/min",18,150);
            monitorCtx.font="bold 17px monospace";
            monitorCtx.fillStyle=oxygenOn?"#65f5d0":"#94a3b8";
            monitorCtx.fillText(oxygenOn?"O2 CONNECTED":"O2 STANDBY",18,178);
            monitorCtx.fillStyle=ivOn?"#c4b5fd":"#94a3b8";
            monitorCtx.fillText(ivOn?"IV INFUSION ACTIVE":"IV STANDBY",270,178);
            // Three synchronized bedside traces: ECG follows HR, pleth follows pulse,
            // and respiration follows RR. These are educational waveforms, not diagnostic signals.
            monitorCtx.font="12px monospace";monitorCtx.fillStyle="#65f5d0";monitorCtx.fillText("ECG",18,198);
            monitorCtx.strokeStyle="#47e7c1";monitorCtx.lineWidth=3;monitorCtx.beginPath();
            for(var j=0;j<470;j++){var phase=(j/470*2.4)+now*(v.hr/60)*2*Math.PI;var y=214-ecgValue(phase,c.ecg==="st_elev")*13;if(j===0)monitorCtx.moveTo(18+j,y);else monitorCtx.lineTo(18+j,y);}
            monitorCtx.stroke();
            monitorCtx.fillStyle="#71d8ff";monitorCtx.fillText("PLETH",18,239);
            monitorCtx.strokeStyle="#71d8ff";monitorCtx.lineWidth=2.5;monitorCtx.beginPath();
            for(var k=0;k<470;k++){var p=((k/470*2.4)+now*(v.hr/60)*2.4)%1;var peak=Math.exp(-Math.pow((p-.22)/.075,2));var notch=Math.exp(-Math.pow((p-.43)/.055,2));var py=258-(peak*.9+notch*.12)*13;if(k===0)monitorCtx.moveTo(18+k,py);else monitorCtx.lineTo(18+k,py);}
            monitorCtx.stroke();
            monitorCtx.fillStyle="#b6f28b";monitorCtx.fillText("RESP",18,282);
            monitorCtx.strokeStyle="#a3e635";monitorCtx.lineWidth=2.5;monitorCtx.beginPath();
            for(var m=0;m<470;m++){var rp=(m/470*2.4)+now*(v.rr/60)*2*Math.PI;var ry=302-Math.sin(rp)*10;if(m===0)monitorCtx.moveTo(18+m,ry);else monitorCtx.lineTo(18+m,ry);}
            monitorCtx.stroke();
            if(alarmLed&&alarmLed.material){alarmLed.material.color.setHex(v.spo2<90?0xef4444:(v.spo2<94?0xf59e0b:0x22c55e));}
            monitorTexture.needsUpdate=true;clinicRenderer.render(sc,cam);
          };
          clinicSync(sim.state);
          // Additive Full Code room/camera calibration. Existing patient GLB,
          // targets, raycaster, renderer and sim.act() remain the source of truth.
          if(window.MedGenVitals3D&&typeof window.MedGenVitals3D.apply==="function"){
            window.MedGenVitals3D.apply(sc,cam,clinicRenderer,view3);
          }
          var ray=new THREE.Raycaster(),pt=new THREE.Vector2(),lastRaycastZone=null,lastActionResult=null,lastHandlerDebug=null;
          function resize3(){var w=Math.max(view3.clientWidth,1),h=Math.max(view3.clientHeight,1);cam.aspect=w/h;cam.updateProjectionMatrix();clinicRenderer.setSize(w,h,false);clinicRenderer.render(sc,cam);}
          if(window.ResizeObserver){clinicResizeObserver=new ResizeObserver(resize3);clinicResizeObserver.observe(view3);} else window.addEventListener("resize",resize3);
          resize3();
          function handleClinicalCanvasClick(ev){
            var r=clinicRenderer.domElement.getBoundingClientRect();pt.x=(ev.clientX-r.left)/r.width*2-1;pt.y=-(ev.clientY-r.top)/r.height*2+1;ray.setFromCamera(pt,cam);
            var handlerHits=ray.intersectObjects(targets.concat(equipmentTargets),false);lastHandlerDebug={clientX:ev.clientX,clientY:ev.clientY,rect:{left:r.left,top:r.top,width:r.width,height:r.height},ndc:{x:pt.x,y:pt.y},hits:handlerHits.slice(0,4).map(function(h){return h.object&&h.object.userData?h.object.userData.zone:null;})};
            var hit=handlerHits[0];if(!hit){flash("Bemor yoki jihozdagi yoritilgan nishonni tanlang.");return;}
            var z=hit.object.userData.zone,id=null;
            if(window.__MEDGEN_TEST_MODE===true&&window.__medgenClinicalTest)window.__medgenClinicalTest.lastHitZone=z;lastRaycastZone=z;lastActionResult=null;
            if(hit.object.userData.equipment){
              if(z==="monitor"){var v=sim.state;showResult("BEDSIDE MONITOR · HR "+Math.round(v.hr)+" /min · BP "+Math.round(v.sbp)+"/"+Math.round(v.dbp)+" mmHg · SpO₂ "+Math.round(v.spo2)+"% · RR "+Math.round(v.rr)+"/min. EKG va ko‘rsatkichlar simulyatsiya bilan jonli sinxron.");return;}
              if(z==="defibrillator"){showResult("DEFIBRILLYATOR: qurilma tanlandi. Avval ritmni baholang. Ushbu anafilaksiya keysida zarba ko‘rsatilmagan; VF/pVT aniqlanmagan holatda razryad bermang.");return;}
              var actionId=z==="oxygen"?"oxygen_high":z==="iv"?"crystalloid_bolus":null;
              if(!actionId){showResult("Jihoz tanlandi.");return;}
              var actionResult=sim.act(actionId);
              if(!actionResult.ok){flash("Bu klinik harakat bajarilgan yoki keys yakunlangan.");return;}
              actionsBox.querySelectorAll("button[data-id]").forEach(function(b){if(b.dataset.id===actionId){b.disabled=true;b.style.opacity=".45";}});
              logBox.appendChild(el("div","","["+sim.s+" s] "+actionResult.label+" · 3D jihoz orqali"));
              triggerStaffTask("NURSE",actionId==="oxygen_high"?"oxygen":"iv");
              if(actionId==="oxygen_high")recoveryStarted=Date.now();
              showResult(actionId==="oxygen_high"?"Hamshira kislorod tizimini uladi. Monitor SpO₂ qiymatini klinik simulyatsiya holatiga muvofiq yangilaydi.":"Hamshira periferik venoz infuziyani boshladi. Kristalloid yuborish klinik keysga qayd etildi.");
              render();
              return;
            }
            if(chosen==="head"&&z==="face"){if(faceTint){faceTint.material.color.setHex(0x6b9cae);faceTint.material.opacity=.34;}if(faceMesh&&faceMesh.material){var hm=Array.isArray(faceMesh.material)?faceMesh.material:[faceMesh.material];hm.forEach(function(m){if(m&&m.color)m.color.setHex(0x6b9cae);});}showResult("BOSH / BO‘YIN: yuz ko‘karishi, lab-til shishi va yuqori nafas yo‘li torayishi ko‘rinadi. Stridor/bo‘g‘ilish — xavf belgisi. O‘quv simulyatsiyasi.");return;}
            if(chosen==="stethoscope"&&z==="chest"){showResult("STETOSKOP — o‘pka: diffuz ekspirator hushtaksimon xirillashlar va havo kirishi pasayishi mumkin. Matnli simulyatsiya.");return;}
            if(chosen==="epi"&&z==="thigh")id="epi_thigh";
            if(chosen==="oxygen"&&z==="face")id="oxygen_high";
            if(chosen==="iv"&&z==="arm")id="crystalloid_bolus";
            if(!id){flash("Tanlangan asbob uchun mos hotspotni bosing.");return;}
            var result=sim.act(id);lastActionResult={id:id,ok:result.ok,reason:result.reason||null,seconds:sim.s};if(!result.ok){flash("Bu harakat bajarilgan yoki keys tugagan.");return;}
            actionsBox.querySelectorAll("button[data-id]").forEach(function(b){if(b.dataset.id===id){b.disabled=true;b.style.opacity=".45";}});
            logBox.appendChild(el("div","","["+sim.s+" s] "+result.label+" · 3D nishon: "+z));
            if(id==="epi_thigh"){triggerStaffTask("DOCTOR","adrenaline");recoveryStarted=Date.now();showResult("Shifokor adrenalin IM ni sonning old-yon qismiga yubordi. Yuz terisi rangi 3 soniya davomida asta-sekin o‘zgaradi; bu klinik natija emas, vizual simulyatsiya.");}
            else if(id==="crystalloid_bolus")showResult("IV periferik kirish va kristalloid bolus bajarildi (simulyatsiya).");
            else {if(id==="oxygen_high"){triggerStaffTask("NURSE","oxygen");recoveryStarted=Date.now();}showResult("Kislorod berish bosqichi bajarildi (simulyatsiya).");}
            render();
          }
          clinicRenderer.domElement.addEventListener("click",handleClinicalCanvasClick);

          // Test-only raycast bridge: exercise the same canvas click handler without
          // exposing scene internals in normal learner sessions.
          if(window.__MEDGEN_TEST_MODE===true){
            window.__medgenClinicalTest={
              lastHitZone:null,
              clickZone:function(zone){
                var allTargets=targets.concat(equipmentTargets);
                var target=allTargets.find(function(item){return item.userData&&item.userData.zone===zone;});
                if(!target||!clinicRenderer||!clinicRenderer.domElement)return false;
                sc.updateMatrixWorld(true);cam.updateMatrixWorld(true);
                var params=target.geometry&&target.geometry.parameters?target.geometry.parameters:{};
                var radius=(params.radius||.1)+(params.tube||.018)*.55;
                var raycaster=new THREE.Raycaster(),chosenPoint=null;
                var diagnostic={zone:zone,candidates:0,onScreen:0,nearestZones:[],camera:{x:cam.position.x,y:cam.position.y,z:cam.position.z,fov:cam.fov,aspect:cam.aspect}};
                // Sample around the visible torus rim so overlapping hotspots do not
                // make a valid target appear unclickable after orbit/zoom.
                for(var angle=0;angle<Math.PI*2;angle+=Math.PI/12){
                  var localPoint=new THREE.Vector3(Math.cos(angle)*radius,Math.sin(angle)*radius,0);
                  var worldPoint=target.localToWorld(localPoint);worldPoint.project(cam);diagnostic.candidates++;
                  if(worldPoint.z< -1||worldPoint.z>1||Math.abs(worldPoint.x)>1||Math.abs(worldPoint.y)>1)continue;
                  diagnostic.onScreen++;
                  raycaster.setFromCamera(new THREE.Vector2(worldPoint.x,worldPoint.y),cam);
                  var nearest=raycaster.intersectObjects(allTargets,false)[0];
                  diagnostic.nearestZones.push(nearest&&nearest.object&&nearest.object.userData?nearest.object.userData.zone:null);
                  if(nearest&&nearest.object===target){chosenPoint=worldPoint;break;}
                }
                this.lastClickDiagnostic=diagnostic;
                if(!chosenPoint)return false;
                var rect=clinicRenderer.domElement.getBoundingClientRect();
                var clientX=rect.left+(chosenPoint.x+1)*.5*rect.width;
                var clientY=rect.top+(1-chosenPoint.y)*.5*rect.height;
                this.lastHitZone=null;lastRaycastZone=null;lastActionResult=null;
                handleClinicalCanvasClick({clientX:clientX,clientY:clientY});
                diagnostic.selectedPoint={x:chosenPoint.x,y:chosenPoint.y,z:chosenPoint.z};diagnostic.handler=lastHandlerDebug;
                this.lastClickDiagnostic=diagnostic;
                return true;
              },
              lastInteraction:function(){return {zone:lastRaycastZone,action:lastActionResult,selected:chosen,seconds:sim?sim.s:null};},
              hasAction:function(id){return !!(sim&&sim.hasAction(id));},
              resultText:function(){return examOut.textContent;},
              cameraState:function(){return {x:cam.position.x,y:cam.position.y,z:cam.position.z,distance:clinicControls?cam.position.distanceTo(clinicControls.target):0};},
              resetCamera:function(){if(clinicControls){clinicControls.target.set(0,.78,-.30);cam.position.set(0,2.35,4.55);clinicControls.update();}else{cam.position.set(0,2.35,4.55);cam.lookAt(0,.78,-.30);cam.updateMatrixWorld(true);}}
            };
          }
        } catch(err){console.error("3D Virtual Clinic",err);clinic.appendChild(el("p","color:#fca5a5;font-size:12px","3D sahna ochilmadi. Harakatlar ro‘yxati orqali davom eting."));}
      }

      // FULL CODE VIEW: replace the previous multi-row UI while retaining the same
      // VitalsCore instance, sim.act(), ECG animation, 3D renderer, audit and handoff.
      (function mountFullCodeView(){
        // Promote the active simulator card to a true viewport layer.
        // Embedded Academy containers can be short/clipped; a 100vh child alone
        // does not escape their layout, which produced the large empty black area.
        card.style.setProperty("position","fixed","important");
        card.style.setProperty("inset","0","important");
        card.style.setProperty("z-index","99999","important");
        card.style.setProperty("width","100vw","important");
        card.style.setProperty("height","100dvh","important");
        card.style.setProperty("min-height","100vh","important");
        card.style.setProperty("max-height","100dvh","important");
        card.style.setProperty("overflow","hidden","important");
        card.style.setProperty("margin","0","important");
        card.style.setProperty("border-radius","0","important");
        card.style.setProperty("padding","0","important");
        var style=document.createElement("style");
        style.textContent=`
          .fc-workspace{height:100dvh;min-height:100vh;width:100%;max-height:100dvh;display:flex;flex-direction:column;overflow:hidden;background:#080d14;color:#e2e8f0;box-sizing:border-box;font-family:system-ui,sans-serif}
          .fc-topbar{height:52px;min-height:52px;display:flex;align-items:center;justify-content:space-between;gap:12px;padding:0 14px;background:#0f172a;border-bottom:1px solid #1e293b;box-sizing:border-box}
          .fc-topbar-left,.fc-topbar-right{display:flex;align-items:center;gap:10px;min-width:0}
          .fc-badge-crit{background:#b91c1c;color:#fff;font-size:10px;font-weight:800;padding:4px 8px;border-radius:4px;white-space:nowrap}
          .fc-case-name{font-size:13px;font-weight:700;color:#f8fafc;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
          .fc-clock-box{background:#1e1b4b;border:1px solid #4338ca;padding:4px 9px;border-radius:6px;white-space:nowrap}
          .fc-clock-val{font:700 16px monospace;color:#fb7185}
          .fc-main-grid{display:grid;grid-template-columns:minmax(230px,275px) minmax(0,1fr) minmax(285px,330px);gap:0;flex:1;min-height:0;overflow:hidden}
          .fc-dock{min-width:0;min-height:0;background:#0c121e;box-sizing:border-box;overflow:hidden}
          .fc-dock-left{display:flex;flex-direction:column;gap:8px;padding:10px;border-right:1px solid #1e293b}
          .fc-left-scroll{overflow:auto;min-height:0;display:flex;flex-direction:column;gap:10px}
          .fc-left-scroll .medgen-clinical-story{display:none!important}
          .fc-left-scroll h4{margin:0 0 6px;color:#38bdf8;font-size:11px;text-transform:uppercase}
          .fc-left-scroll .medgen-clinical-meta{font-size:11px}
          .fc-center-stage{position:relative;min-width:0;min-height:0;overflow:hidden;background:#02070d}
          .fc-three-viewport{position:absolute;inset:0;width:100%;height:100%;min-height:0;z-index:1}
          .fc-three-viewport, .fc-three-viewport canvas, canvas#three-canvas{width:100%!important;height:100%!important;background-color:#080d14!important}
          .fc-three-viewport canvas{display:block}
          .fc-floating-monitor{position:absolute;z-index:5;top:10px;left:10px;width:min(350px,calc(100% - 20px));padding:8px;background:rgba(5,10,15,.91);border:1px solid #059669;border-radius:8px;box-sizing:border-box;pointer-events:none;box-shadow:0 4px 18px #0009}
          .fc-monitor-header{display:flex;justify-content:space-between;gap:8px;color:#10b981;font:10px monospace;margin-bottom:4px}
          .fc-floating-monitor canvas{width:100%!important;height:48px!important;background:#020a12;border-radius:4px}
          .fc-vitals-strip{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:5px;margin-top:5px}
          .fc-v-item{min-width:0;text-align:center;background:#090e17;border:1px solid #1e293b;border-radius:4px;padding:4px 1px}
          .fc-v-item small{display:block;font-size:8px;color:#94a3b8}
          .fc-v-item strong{display:block;font:800 17px monospace;color:#e2e8f0}
          .fc-v-item span{font-size:8px;color:#64748b}
          .fc-dock-right{display:flex;border-left:1px solid #1e293b}
          .fc-vert-tabs{width:58px;flex:0 0 58px;background:#070b12;border-right:1px solid #1e293b;display:flex;flex-direction:column}
          .fc-v-tab{padding:12px 2px;border:0;border-bottom:1px solid #1e293b;background:transparent;color:#94a3b8;font-size:10px;cursor:pointer}
          .fc-v-tab.active{color:#38bdf8;background:#0c121e;border-left:3px solid #38bdf8}
          .fc-tab-panes{flex:1;min-width:0;min-height:0;padding:9px;overflow:hidden;box-sizing:border-box}
          .fc-pane{display:none;height:100%;overflow:auto;flex-direction:column;gap:8px}
          .fc-pane.active{display:flex}
          .fc-pane h4{margin:0;color:#9fe7f4;font-size:12px}
          .fc-action-btn,.fc-pane button{max-width:100%;white-space:normal;overflow-wrap:anywhere}
          .fc-pane [data-id]{display:block;width:100%;text-align:left;margin:3px 0;padding:9px;background:#162032;color:#cbd5e1;border:1px solid #29384e;border-radius:5px;font-size:11px}
          .fc-pane [data-id]:disabled{opacity:.45}
          .fc-pane .medgen-clinical-dock{min-height:0}
          .fc-audit-timeline,.fc-clinical-log{overflow:auto}
          .fc-pane .medgen-clinical-log{max-height:none}
          .fc-workspace .medgen-clinical-disclaimer{font-size:10px}
          @media(max-width:1050px){.fc-main-grid{grid-template-columns:minmax(190px,230px) minmax(0,1fr) minmax(255px,285px)}}
          @media(max-width:1050px){.fc-main-grid{grid-template-columns:minmax(165px,22vw) minmax(0,1fr) minmax(220px,27vw)}}@media(max-width:760px){.fc-workspace{height:100dvh;max-height:100dvh}.fc-topbar{height:48px;min-height:48px;padding:0 8px}.fc-case-name{font-size:11px}.fc-main-grid{grid-template-columns:minmax(0,1fr);grid-template-rows:minmax(110px,22%) minmax(250px,1fr) minmax(180px,34%)}.fc-dock-left{border-right:0;border-bottom:1px solid #1e293b}.fc-left-scroll{display:grid;grid-template-columns:repeat(2,minmax(0,1fr))}.fc-center-stage{grid-row:2}.fc-dock-right{grid-row:3;border-left:0;border-top:1px solid #1e293b}.fc-vert-tabs{width:46px;flex-basis:46px}.fc-floating-monitor{width:min(300px,calc(100% - 16px));top:6px;left:8px}.fc-v-item strong{font-size:14px}}
        `;
        card.appendChild(style);
        var workspace=el("div","");workspace.className="fc-workspace";
        var top=el("header","");top.className="fc-topbar";
        var topLeft=el("div","");topLeft.className="fc-topbar-left";
        topLeft.appendChild(el("span","","EMERGENCY"));
        topLeft.lastChild.className="fc-badge-crit";
        topLeft.appendChild(el("span","",c.title||"Klinik simulyatsiya"));topLeft.lastChild.className="fc-case-name";
        var topRight=el("div","");topRight.className="fc-topbar-right";
        var clock=el("div","");clock.className="fc-clock-box";
        clock.appendChild(el("span","","Qolgan vaqt: "));clock.appendChild(hud.time);hud.time.className="fc-clock-val";
        topRight.appendChild(clock);topRight.appendChild(hud.pen);
        var hand=el("button","padding:7px 10px;background:#0284c7;color:#fff;border:0;border-radius:5px;font-weight:700;cursor:pointer","Topshirish");
        hand.type="button";hand.onclick=function(){if(typeof fullCodeSetTab==="function")fullCodeSetTab("handoff");};
        topRight.appendChild(hand);
        var exitBtn=el("button","padding:7px 10px;background:#334155;color:#e2e8f0;border:1px solid #475569;border-radius:5px;font-weight:700;cursor:pointer","Kabinetga qaytish");
        exitBtn.type="button";exitBtn.onclick=function(){if(running){if(!window.confirm("Simulyatsiyadan chiqilsinmi? Joriy urinish yakunlanmagan bo‘ladi."))return;}exitToDashboard();};
        topRight.appendChild(exitBtn);top.appendChild(topLeft);top.appendChild(topRight);
        var main=el("main","");main.className="fc-main-grid";
        var left=el("aside","");left.className="fc-dock fc-dock-left";
        left.appendChild(el("h4","","Bemor kartasi / Anamnez"));
        var leftScroll=el("div","");leftScroll.className="fc-left-scroll";
        if(patientCard)leftScroll.appendChild(patientCard);
        if(historyCard)leftScroll.appendChild(historyCard);
        if(dialogueCard)leftScroll.appendChild(dialogueCard);
        left.appendChild(leftScroll);
        var center=el("section","");center.className="fc-center-stage";
        var monitor=el("div","");monitor.className="fc-floating-monitor";
        var mh=el("div","");mh.className="fc-monitor-header";
        mh.appendChild(el("span","","● II-TARMOQ EKG"));
        mh.appendChild(el("span","",c.ecg==="st_elev"?"ST O‘ZGARISHI":"SIMULYATSIYA EKG"));mh.lastChild.id="fc-rhythm-badge";
        monitor.appendChild(mh);canvas.style.width="100%";canvas.style.height="48px";canvas.style.borderRadius="4px";monitor.appendChild(canvas);
        var vitals=el("div","");vitals.className="fc-vitals-strip";
        [["hr","HR","bpm"],["bp","NIBP","mmHg"],["spo2","SpO2","%"],["rr","RESP","/min"]].forEach(function(k){
          var item=el("div","");item.className="fc-v-item";item.appendChild(el("small","",k[1]));
          tiles[k[0]].style.fontSize="17px";tiles[k[0]].style.color="#e2e8f0";var strong=el("strong","");strong.appendChild(tiles[k[0]]);item.appendChild(strong);item.appendChild(el("span","",k[2]));vitals.appendChild(item);
        });
        monitor.appendChild(vitals);center.appendChild(monitor);
        var sceneMount=el("div","");sceneMount.className="fc-three-viewport";
        sceneMount.style.cssText="position:absolute;inset:0;width:100%;height:100%;min-height:0;overflow:hidden;z-index:1";
        center.style.position="relative";center.style.height="100%";center.style.minHeight="0";
        if(typeof clinic!=="undefined"&&clinic){clinic.style.cssText="position:absolute;inset:0;width:100%;height:100%;min-height:0;margin:0!important;padding:0!important;border:0!important;border-radius:0!important;background:transparent!important;overflow:hidden";if(typeof view3!=="undefined"&&view3){view3.style.cssText="position:absolute;inset:0;width:100%;height:100%;min-height:0;border-radius:0;overflow:hidden;background:#080d14";}if(typeof tools3!=="undefined"&&tools3){tools3.style.cssText="position:absolute;z-index:4;top:8px;left:8px;display:flex;gap:6px;flex-wrap:wrap;margin:0;max-width:calc(100% - 16px)";}var clinicHead=clinic.children[0],clinicHelp=clinic.children[1];if(clinicHead)clinicHead.style.display="none";if(clinicHelp)clinicHelp.style.display="none";sceneMount.appendChild(clinic);}
        if(typeof genericClinic!=="undefined"&&genericClinic){genericClinic.style.cssText="position:absolute;inset:0;margin:0!important;padding:0!important;border:0!important";var gw=genericClinic.querySelector("div[id^='medgen-3d-patient-']");if(gw){gw.style.height="100%";}sceneMount.appendChild(genericClinic);}
        center.appendChild(sceneMount);
        // Re-measure the existing renderer after its final responsive layout is mounted.
        if(clinicResizeObserver){clinicResizeObserver.observe(center);if(typeof view3!=="undefined"&&view3)clinicResizeObserver.observe(view3);}
        requestAnimationFrame(function(){if(typeof resize3==="function")resize3();requestAnimationFrame(function(){if(typeof resize3==="function")resize3();});});
        var right=el("aside","");right.className="fc-dock fc-dock-right";
        var nav=el("nav","");nav.className="fc-vert-tabs";
        var panes=el("div","");panes.className="fc-tab-panes";
        var paneIntervene=el("div","");paneIntervene.className="fc-pane active";paneIntervene.id="fc-pane-intervene";
        var paneInvestigate=el("div","");paneInvestigate.className="fc-pane";paneInvestigate.id="fc-pane-investigate";
        var paneAudit=el("div","");paneAudit.className="fc-pane";paneAudit.id="fc-pane-audit";
        var paneHandoff=el("div","");paneHandoff.className="fc-pane";paneHandoff.id="fc-pane-handoff";
        var paneAnatomy=el("div","");paneAnatomy.className="fc-pane";paneAnatomy.id="fc-pane-anatomy";
        var paneSurgery=el("div","");paneSurgery.className="fc-pane";paneSurgery.id="fc-pane-surgery";
        fullCodeSetTab = function(name) {
          var panesByName = {
            actions: paneIntervene,
            investigate: paneInvestigate,
            log: paneAudit,
            handoff: paneHandoff,
            anatomy: paneAnatomy,
            surgery: paneSurgery
          };
          [paneIntervene, paneInvestigate, paneAudit, paneHandoff, paneAnatomy, paneSurgery].forEach(function(p) {
            var active = panesByName[name] === p;
            p.classList.toggle("active", active);
            p.style.display = active ? "flex" : "none";
          });
          nav.querySelectorAll(".fc-v-tab").forEach(function(b) {
            b.classList.toggle("active", b.getAttribute("data-tab") ===
              (name === "actions" ? "intervene" : name === "log" ? "audit" : name));
          });
        };
        function tab(key,label,icon){var b=el("button","",icon+"  "+label);b.type="button";b.className="fc-v-tab"+(key==="intervene"?" active":"");b.setAttribute("data-tab",key);b.onclick=function(){var target=key==="intervene"?"actions":key==="investigate"?"investigate":key==="audit"?"log":key==="anatomy"?"anatomy":key==="surgery"?"surgery":"handoff";if(typeof fullCodeSetTab==="function")fullCodeSetTab(target);};nav.appendChild(b);}
        tab("intervene","Muolaja","💉");tab("investigate","Tekshiruv","🔍");tab("anatomy","Anatomiya","🫀");tab("surgery","Jarrohlik","🩺");tab("audit","Jurnal","📑");tab("handoff","Topshirish","📋");
        paneIntervene.appendChild(el("h4","","Shoshilinch muolajalar"));
        if(actionsBox){actionsBox.style.display="flex";actionsBox.style.flexDirection="column";paneIntervene.appendChild(actionsBox);}
        paneAnatomy.appendChild(el("h4","","3D inson anatomiyasi — organlar laboratoriyasi"));
        paneAnatomy.appendChild(el("p","font-size:11px;line-height:1.5;color:#94a3b8;margin:0","Organlarni 3D ko‘ring, tanlang va modelni aylantiring. Bu vizualizatsiya ta’lim uchun mo‘ljallangan."));
        var anatomyStage=el("div","height:420px;min-height:320px;width:100%;border:1px solid #29465a;border-radius:10px;overflow:hidden;background:#071521");
        paneAnatomy.appendChild(anatomyStage);
        var anatomyLab=null;
        if(window.MedGenAnatomyLab&&window.THREE){try{anatomyLab=window.MedGenAnatomyLab.mount(anatomyStage,"anatomy");}catch(anatomyError){console.error("3D anatomy lab:",anatomyError);}}
        else anatomyStage.textContent="3D kutubxonasi yuklanmadi. Sahifani yangilang.";
        paneAnatomy.appendChild(el("p","font-size:10px;color:#fbbf24;line-height:1.4","Model anatomik o‘quv tasviridir; klinik tashxis yoki davolash qarori uchun ishlatilmaydi."));
        paneSurgery.appendChild(el("h4","","3D jarrohlik laboratoriyasi — appendektomiya"));
        paneSurgery.appendChild(el("p","font-size:11px;line-height:1.5;color:#94a3b8;margin:0","Qorin devori, ko‘richak, terminal ileum, mezappendiks va appendiksning soddalashtirilgan 3D modeli. Bu haqiqiy operatsiya ko‘rsatmasi emas."));
        var surgeryStage=el("div","height:360px;min-height:300px;width:100%;border:1px solid #29465a;border-radius:10px;overflow:hidden;background:#071521");
        paneSurgery.appendChild(surgeryStage);
        var surgeryLab=null;
        if(window.MedGenAnatomyLab&&window.THREE){try{surgeryLab=window.MedGenAnatomyLab.mount(surgeryStage,"surgery");}catch(surgeryError){console.error("3D surgery lab:",surgeryError);}}
        var surgerySteps=[
          ["1","Operatsiyadan oldingi xavfsizlik","Bemor identifikatsiyasi, rozilik, allergiya, timeout va jamoa tekshiruvi."],
          ["2","Anesteziya va monitoring","Anesteziya jamoasi, nafas yo‘li, monitoring va aseptika tayyorligini tasdiqlash."],
          ["3","Kirish va anatomik orientir","Qorin devori qatlamlari va xavfsiz anatomik orientirlarni o‘quv modelida aniqlash."],
          ["4","Appendiksni ajratish","Ko‘richak, terminal ileum, appendiks va mezappendiksni 3D ko‘rinishda aniqlash."],
          ["5","Gemostaz va yakuniy tekshiruv","O‘quv modelida tomirlar hududi va operatsion maydonni tekshirish."],
          ["6","Yopish va operatsiyadan keyingi reja","Yakuniy anatomik nazorat, yara yopilishi va kuzatuv rejasini ko‘rib chiqish."]
        ];
        var surgeryState=0,surgeryProgress=el("div","font-size:11px;color:#67e8f9;font-weight:800","Bajarilgan: 0 / "+surgerySteps.length);
        paneSurgery.appendChild(surgeryProgress);
        var surgeryTrack=el("div","height:6px;background:#1e293b;border-radius:99px;overflow:hidden");
        var surgeryBar=el("div","height:6px;width:0%;background:#06b6d4;transition:width .2s");surgeryTrack.appendChild(surgeryBar);paneSurgery.appendChild(surgeryTrack);
        var surgeryList=el("div","display:flex;flex-direction:column;gap:7px");paneSurgery.appendChild(surgeryList);
        var surgeryDetail=el("div","padding:10px;border:1px solid #29465a;border-radius:9px;background:#0b1b29;color:#b8cad8;font-size:11px;line-height:1.5","Birinchi bosqichni tanlang.");paneSurgery.appendChild(surgeryDetail);
        function renderSurgery(){
          surgeryList.innerHTML="";
          surgerySteps.forEach(function(step,index){
            var b=el("button","display:flex;gap:8px;align-items:center;text-align:left;padding:10px;border:1px solid "+(index<surgeryState?"#047857":index===surgeryState?"#0e7490":"#29465a")+";border-radius:8px;background:"+(index<surgeryState?"#0b2a27":index===surgeryState?"#102d40":"#101d2b")+";color:#e5eef6;cursor:pointer");
            b.type="button";b.textContent=(index<surgeryState?"✓ ":step[0]+". ")+step[1];b.disabled=index>surgeryState;b.onclick=function(){
              surgeryDetail.textContent=step[2];
              if(index===surgeryState){surgeryState++;surgeryProgress.textContent="Bajarilgan: "+surgeryState+" / "+surgerySteps.length;surgeryBar.style.width=(surgeryState/surgerySteps.length*100)+"%";if(surgeryLab)surgeryLab.setStep(Math.min(5,surgeryState-1));renderSurgery();if(surgeryState===surgerySteps.length)surgeryDetail.textContent="O‘quv ketma-ketligi yakunlandi. Bu klinik malaka yoki real operatsiya ruxsati o‘rnini bosmaydi.";}
            };surgeryList.appendChild(b);
          });
        }
        renderSurgery();
        paneInvestigate.appendChild(el("h4","","Tekshiruv / klinik baholash"));
        if(typeof examPanel!=="undefined"&&examPanel){paneInvestigate.appendChild(examPanel);}
        else paneInvestigate.appendChild(el("p","color:#94a3b8;font-size:12px","Ushbu keys uchun mavjud klinik tekshiruv amallari alohida ro‘yxatda ko‘rsatilmagan."));
        paneAudit.appendChild(el("h4","","Klinik harakatlar jurnali"));
        if(logBox){logBox.className="fc-clinical-log";paneAudit.appendChild(logBox);}
        paneHandoff.appendChild(el("h4","","Topshirish / yakunlash"));
        paneHandoff.appendChild(el("p","font-size:12px;line-height:1.5;color:#94a3b8;margin:0 0 8px","Simulyatsiyani yakunlang, tashxisni belgilang va server baholash hisobotini oling."));
        var fullCodeFinishBtn=el("button","width:100%;padding:12px;margin:0 0 10px;border:1px solid #047857;border-radius:9px;background:#059669;color:#fff;font-weight:800;font-size:13px;cursor:pointer","📋 Epikrizni chiqarish va Yakunlash");
        fullCodeFinishBtn.type="button";
        handoffFinishBtn = fullCodeFinishBtn;
        fullCodeFinishBtn.onclick=function(){
          if(running && sim && !sim.ended){finish();}
          else if(endBox){
            if(typeof fullCodeSetTab==="function")fullCodeSetTab("handoff");
            endBox.scrollIntoView({behavior:"smooth",block:"nearest"});
          } else {
            flash("Yakunlash uchun faol klinik simulyatsiya topilmadi.");
          }
        };
        paneHandoff.appendChild(fullCodeFinishBtn);
        if(endBox)paneHandoff.appendChild(endBox);
        panes.appendChild(paneIntervene);panes.appendChild(paneInvestigate);panes.appendChild(paneAnatomy);panes.appendChild(paneSurgery);panes.appendChild(paneAudit);panes.appendChild(paneHandoff);
        right.appendChild(nav);right.appendChild(panes);
        main.appendChild(left);main.appendChild(center);main.appendChild(right);
        workspace.style.position="relative";
        workspace.style.paddingBottom="68px";
        workspace.appendChild(top);workspace.appendChild(main);
        var bodyDock=el("nav","");
        bodyDock.className="fc-body-interact-dock";
        bodyDock.setAttribute("aria-label","Body Interact navigatsiya paneli");
        bodyDock.style.cssText="position:absolute;z-index:20;left:50%;bottom:9px;transform:translateX(-50%);display:flex;gap:7px;max-width:calc(100% - 16px);overflow-x:auto;padding:7px 9px;border:1px solid #29465a;border-radius:16px;background:rgba(8,20,32,.96);box-shadow:0 8px 26px rgba(0,0,0,.35);backdrop-filter:blur(10px)";
        [
          ["Bemor","patient"],
          ["Tekshiruv","investigate"],
          ["Anatomiya","anatomy"],
          ["Jarrohlik","surgery"],
          ["Muolaja","actions"],
          ["Jurnal","log"],
          ["Topshirish","handoff"]
        ].forEach(function(item){
          var b=el("button","","");
          b.type="button";b.textContent=item[0];b.dataset.target=item[1];
          b.style.cssText="flex:0 0 auto;min-height:38px;padding:8px 12px;border:1px solid #31536a;border-radius:10px;background:#132b3b;color:#e5edf5;font-size:12px;font-weight:700;white-space:nowrap";
          b.onclick=function(){
            if(item[1]==="patient"){
              var leftPane=workspace.querySelector(".fc-left-scroll");
              if(leftPane)leftPane.scrollTo({top:0,behavior:"smooth"});
            } else {
              if(typeof fullCodeSetTab==="function")fullCodeSetTab(item[1]);
            }
          };
          bodyDock.appendChild(b);
        });
        workspace.appendChild(bodyDock);
        shell.remove();
        card.appendChild(workspace);
        // Move the existing renderer canvases only; renderer, camera, scene and RAF remain untouched.
        if(clinicRenderer&&clinicRenderer.domElement){clinicRenderer.domElement.style.width="100%";clinicRenderer.domElement.style.height="100%";}
        if(clinicResizeObserver&&typeof clinicResizeObserver.disconnect==="function"){clinicResizeObserver.disconnect();if(typeof view3!=="undefined"&&view3)clinicResizeObserver.observe(view3);}
        setTimeout(function(){if(clinicRenderer&&typeof resize3==="function")resize3();},60);
        setTimeout(function(){if(clinicRenderer&&typeof resize3==="function")resize3();},300);
      })();

      penalty = 0; running = true; lastPenaltyAt = 0;
      document.addEventListener("visibilitychange", onVis);
      window.addEventListener("blur", onBlur);
      window.addEventListener("orientationchange", onViewportChange, { passive: true });
      if (window.visualViewport) window.visualViewport.addEventListener("resize", onViewportChange, { passive: true });
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
      if (clinicSync) clinicSync(s);
      if (genericClinicMounted && window.medgen3DClinic) window.medgen3DClinic.updateVitals(s);
      updateHud();
    }
    function updateHud() {
      if (!hud || !sim) return;
      var left = Math.max(0, Core.MAX - sim.s);
      hud.time.textContent = "Qolgan vaqt: " + String(Math.floor(left / 60)).padStart(2, "0") + ":" + String(left % 60).padStart(2, "0");
      hud.pen.textContent = penalty ? "Jarima: -" + (15 * penalty) + " ball" : "Jarima: yo'q";
    }

    function showJasurEpicrisis(report) {
      if (epicrisisOverlay) epicrisisOverlay.remove();
      var st = sim && sim.state ? sim.state : {};
      var def = sim && sim.def ? sim.def : {};
      var performed = [];
      if (sim && sim.log && sim.def && sim.def.actions) {
        sim.log.forEach(function (entry) {
          var action = sim.def.actions.find(function (item) { return item.id === entry.id; });
          if (action) performed.push(action.label + " — " + entry.t + " soniya");
        });
      }
      var audit = report && Array.isArray(report.audit) ? report.audit : [];
      var harmful = audit.filter(function (item) { return item.type === "harm"; });
      var missed = audit.filter(function (item) { return item.type === "missed"; });
      var finalVitals = report && report.final_vitals ? report.final_vitals : st;
      var vitalsText = "HR " + Math.round(finalVitals.hr || 0) + " bpm · AQB " +
        Math.round(finalVitals.sbp || 0) + "/" + Math.round(finalVitals.dbp || 0) +
        " mmHg · SpO₂ " + Math.round(finalVitals.spo2 || 0) + "% · Nafas " +
        Math.round(finalVitals.rr || 0) + "/min";
      var elapsed = report && Number.isFinite(Number(report.seconds_used)) ?
        Number(report.seconds_used) : (sim ? sim.s : 0);
      var tabPenalty = report && report.breakdown &&
        Number.isFinite(Number(report.breakdown.tab_penalty)) ?
        Number(report.breakdown.tab_penalty) : penalty * 15;
      var diagnosisText = report && report.breakdown ?
        (report.breakdown.diagnosis_correct ? "To‘g‘ri" : "Noto‘g‘ri yoki tanlanmagan") :
        "Server baholashida tekshirildi";
      var stableText = report && report.stabilized ?
        "Barqarorlashuv qayd etildi (" + (report.stabilized_at_s || 0) + " soniya)." :
        "Simulyatsiya yakunida barqarorlashuv mezoniga erishilmadi.";

      epicrisisOverlay = el("div", "position:fixed;inset:0;background:rgba(2,8,16,.84);display:flex;align-items:center;justify-content:center;padding:14px;box-sizing:border-box;overflow-y:auto;z-index:100000");
      epicrisisOverlay.className = "mg-sbar-overlay";
      var paper = el("section", "width:min(96vw,820px);max-width:100%;max-height:94vh;box-sizing:border-box;overflow:auto;background:#f8fafc;color:#14202b;border-radius:16px;padding:22px;box-shadow:0 20px 70px rgba(0,0,0,.5)");
      paper.className = "mg-sbar-paper";
      paper.appendChild(el("div", "font-size:11px;letter-spacing:1.5px;color:#526579;font-weight:800", "MEDGEN AI · KLINIK SIMULYATSIYA"));
      paper.appendChild(el("h2", "margin:6px 0 4px;font-size:24px;color:#102a43", "SBAR — Reanimatsiyaga topshirish epikrizi"));
      paper.appendChild(el("p", "margin:0 0 14px;color:#64748b;font-size:12px", "O‘quv simulyatsiyasi hujjati · " + new Date().toLocaleString()));

      var sections = [
        ["S", "SITUATION · VAZIYAT",
          "22 yoshli Jasurda yong‘oq iste’molidan taxminan 10 daqiqa o‘tib rivojlangan o‘tkir anafilaktik shok. Dastlabki ko‘rsatkichlar: HR 142 bpm, AQB 68/38 mmHg, SpO₂ 86%, nafas 32/min. " + stableText],
        ["B", "BACKGROUND · ANAMNEZ",
          "Yong‘oq allergiyasi mavjud. Ushbu epizod yong‘oq iste’molidan keyin boshlangan. Oldingi penitsillin reaksiyasi bemor xabariga ko‘ra qayd etilgan; allergologik tasdiq mavjudligi alohida tekshirilishi kerak. Simulyatsiya keysida nafas qisilishi, yuz-lab shishi va holsizlik kuzatilgan."],
        ["A", "ASSESSMENT · BAHOLASH",
          "Yakuniy ko‘rsatkichlar: " + vitalsText + ". Sarflangan simulyatsiya vaqti: " + elapsed + " soniya. Tashxis: " + diagnosisText +
          ". Bajarilgan muolajalar: " + (performed.length ? performed.join("; ") : "Jurnalga muolaja kiritilmagan.") +
          ". Zararli harakatlar: " + harmful.length + "; bajarilmagan majburiy harakatlar: " + missed.length +
          "; tab-switch jarimasi: −" + tabPenalty + " ball."],
        ["R", "RECOMMENDATION · TAVSIYA",
          "Reanimatsiya / intensiv kuzatuv bo‘limiga topshirish. Nafas yo‘li, nafas va qon aylanishini qayta baholash; uzluksiz EKG, SpO₂, arterial bosim va nafas monitoringini davom ettirish. Kuzatuv davomiyligini reaksiya og‘irligi, davoga javob va mahalliy klinik protokol bo‘yicha shifokor belgilaydi; 24 soatlik kuzatuv avtomatik majburiy qoida emas. Kortikosteroidlar anafilaksiyada rutin birinchi qator davo emas; faqat refrakter holat yoki davom etayotgan astma/shokda dastlabki reanimatsiyadan keyin mutaxassis qarori bilan ko‘rib chiqiladi."]
      ];
      sections.forEach(function (section) {
        var block = el("section", "padding:13px 0;border-bottom:1px solid #d8e1e8");
        block.className = "mg-sbar-section";
        var heading = el("div", "font-size:12px;letter-spacing:.7px;color:#087e8b;font-weight:900;margin-bottom:6px", section[0] + " · " + section[1]);
        block.appendChild(heading);
        block.appendChild(el("div", "font-size:13px;line-height:1.65;color:#102a43", section[2]));
        paper.appendChild(block);
      });

      var auditBlock = el("section", "padding:13px 0");
      auditBlock.appendChild(el("h3", "font-size:14px;color:#102a43;margin:0 0 8px", "Audit tafsilotlari"));
      var auditItems = [];
      audit.forEach(function (item) {
        auditItems.push((item.action || "Audit hodisasi") + (item.t !== null && item.t !== undefined ? " (" + item.t + " s)" : "") + ": " + (item.text || ""));
      });
      auditBlock.appendChild(el("div", "font-size:12px;line-height:1.6;color:#334155", auditItems.length ? auditItems.join(" · ") : "Qo‘shimcha audit hodisasi yo‘q."));
      paper.appendChild(auditBlock);

      epicrisisScoreLabel = el("div", "margin:12px 0;font-size:20px;font-weight:900;color:#087443",
        "Yakuniy SBAR / klinik baho: " + (report && Number.isFinite(Number(report.score)) ? report.score + " / 100 ball" : "server javobi kutilmoqda"));
      paper.appendChild(epicrisisScoreLabel);
      paper.appendChild(el("p", "font-size:11px;line-height:1.5;color:#64748b",
        "Bu hujjat ta’limiy simulyatsiya natijasidir. Haqiqiy tibbiy epikriz, EHR yozuvi yoki mustaqil davolash ko‘rsatmasi emas. Klinik qarorlar malakali mutaxassis va amaldagi mahalliy protokolga tegishli."));

      var close = el("button", "padding:11px 16px;border:0;border-radius:9px;background:#0e7490;color:white;font-weight:800;cursor:pointer", "Epikrizni yopish");
      close.onclick = function () {
        if (epicrisisOverlay) epicrisisOverlay.remove();
        epicrisisOverlay = null;
        epicrisisScoreLabel = null;
      };
      paper.appendChild(close);
      epicrisisOverlay.appendChild(paper);
      document.body.appendChild(epicrisisOverlay);
    }
    function finish() {
      if (!running) return;
      running = false;
      if (handoffFinishBtn) { handoffFinishBtn.disabled = true; handoffFinishBtn.style.opacity = ".55"; handoffFinishBtn.textContent = "Yakunlash bosqichi ochildi"; }
      if (genericClinicMounted && window.medgen3DClinic) window.medgen3DClinic.dispose();
      genericClinicMounted = false;
      clearInterval(timer); cancelAnimationFrame(raf);
      if (clinicResizeObserver) clinicResizeObserver.disconnect();
      if (clinicRenderer) { clinicRenderer.dispose(); clinicRenderer.domElement.remove(); clinicRenderer = null; }
      clinicSync = null;
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("blur", onBlur);
      window.removeEventListener("resize", onViewportChange);
      window.removeEventListener("orientationchange", onViewportChange);
      if (window.visualViewport) window.visualViewport.removeEventListener("resize", onViewportChange);
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
            // Send the exact client stop second so the server replays the same timeline.
            actions: sim.log, elapsed_seconds: sim.s, tab_switches: penalty
          });
          // The clinical report is already authoritative and persisted at this point.
          // Academy score synchronization is secondary and must never hide the report
          // or cause the user to submit the clinical report (and consume quota) twice.
          var academySyncError = null;
          if (typeof window.submitStudentScore === "function") {
            try {
              var academySyncResult = await window.submitStudentScore(rep.score, sim.def.id === "anaphylaxis_jasur" ? "Clinical SBAR — Jasur anafilaktik shok" : "Patient_" + sim.def.id);
              // The shared helper currently resolves to null on HTTP/network errors.
              // Treat that as a failed sync so the already-saved clinical report
              // clearly tells the learner that Academy points were not confirmed.
              if (!academySyncResult || academySyncResult.status !== "saved") {
                academySyncError = new Error("Academy balli server tomonidan tasdiqlanmadi.");
              }
            } catch (scoreError) {
              academySyncError = scoreError;
            }
          } else {
            academySyncError = new Error("Academy ballini saqlash xizmati mavjud emas.");
          }
          // Show the authoritative backend audit report only.
          // Do not place the legacy white learning-summary overlay above it.
          if (epicrisisOverlay) {
            epicrisisOverlay.remove();
            epicrisisOverlay = null;
            epicrisisScoreLabel = null;
          }
          document.querySelectorAll("#medgen-epikriz-modal, .learning-summary-modal").forEach(function(node) {
            node.remove();
          });
          submit.disabled = true;
          submit.textContent = "Hisobot saqlandi";
          showReport(rep);
          if (sim.def.id === "anaphylaxis_jasur") showJasurEpicrisis(rep);
          if (academySyncError) {
            var syncNotice = el("div", "width:min(980px,calc(100% - 32px));margin:0 auto 24px;padding:12px;border:1px solid #92400e;border-radius:10px;background:#451a03;color:#fde68a;font-size:13px;line-height:1.5",
              "Klinik hisobot serverda saqlandi. Academy ballini sinxronlashda xatolik yuz berdi; klinik hisobot qayta yuborilmadi. " + (academySyncError.message || "Noma’lum xatolik"));
            card.appendChild(syncNotice);
          }
        } catch (e) { submit.disabled = false; alertBox.style.background = "#b00020"; flash(e.message); }
      };
      endBox.appendChild(submit);
      if(typeof fullCodeSetTab==="function")fullCodeSetTab("handoff");
      // Epikriz modal opens after the server returns the real scored report.
    }

    function showReport(r) {
      if (epicrisisScoreLabel) epicrisisScoreLabel.textContent = "Baho: " + r.score + " / 100 ball";
      card.innerHTML = "";
      card.style.setProperty("height","100vh","important");
      card.style.setProperty("max-height","100vh","important");
      card.style.setProperty("overflow-y","auto","important");
      card.style.setProperty("background","#07111d","important");
      card.style.setProperty("color","#e5edf5","important");
      var style = el("style","");
      style.textContent = `
        .mg-report{width:min(980px,calc(100% - 32px));margin:26px auto 40px;box-sizing:border-box;font-family:system-ui,sans-serif}
        .mg-report-head{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;padding:22px;border:1px solid #25465a;border-radius:18px;background:linear-gradient(135deg,#102b3b,#0b1725)}
        .mg-report-kicker{font-size:11px;font-weight:800;letter-spacing:.12em;color:#67e8f9;text-transform:uppercase}
        .mg-report-score{font-size:clamp(38px,7vw,62px);font-weight:900;line-height:1;color:#56dcc0;white-space:nowrap}
        .mg-report-sub{color:#9fb3c5;font-size:13px;line-height:1.6;margin-top:10px}
        .mg-report-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin:14px 0}
        .mg-report-stat{padding:14px;border:1px solid #20384b;border-radius:12px;background:#0d1c2a;min-width:0}
        .mg-report-stat small{display:block;color:#8fa8bb;font-size:11px;margin-bottom:6px}
        .mg-report-stat strong{font-size:18px;color:#e5edf5;overflow-wrap:anywhere}
        .mg-report-section{margin-top:18px;padding:18px;border:1px solid #20384b;border-radius:14px;background:#0b1825}
        .mg-report-section h4{margin:0 0 12px;font-size:14px;color:#b8eaf4}
        .mg-report-audit{display:grid;grid-template-columns:1fr;gap:8px}
        .mg-report-event{padding:11px 13px;border-left:3px solid #94a3b8;border-radius:7px;background:#101f2d;font-size:13px;line-height:1.5}
        .mg-report-actions{display:flex;flex-wrap:wrap;gap:9px;margin-top:18px}
        .mg-report-actions button{padding:11px 17px;border:1px solid #31536a;border-radius:9px;background:#123044;color:#e5f3fa;font-weight:700;cursor:pointer}
        @media(max-width:620px){.mg-report{width:calc(100% - 20px);margin:12px auto 28px}.mg-report-head{padding:16px;flex-direction:column}.mg-report-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.mg-report-section{padding:13px}}
      `;
      card.appendChild(style);
      var wrap=el("div","");wrap.className="mg-report";
      var head=el("section","");head.className="mg-report-head";
      var intro=el("div","");
      intro.appendChild(el("div","", "KLINIK SIMULYATSIYA · YAKUNIY NATIJA"));
      intro.lastChild.className="mg-report-kicker";
      intro.appendChild(el("h2","font-size:clamp(20px,3vw,28px);margin:8px 0 0;color:#f1f7fb","Klinik hisobot: "+r.title));
      intro.appendChild(el("div","",r.disclaimer||"Ta’limiy simulyatsiya natijasi."));
      intro.lastChild.className="mg-report-sub";
      head.appendChild(intro);
      var score=el("div","","");
      score.className="mg-report-score";
      score.appendChild(document.createTextNode(String(r.score)));
      score.appendChild(el("span","font-size:18px;color:#9fb3c5"," / 100"));
      head.appendChild(score);
      wrap.appendChild(head);
      var b=r.breakdown||{};
      var stats=el("div","");stats.className="mg-report-grid";
      [[ "Majburiy harakatlar",String(b.required_done??0)+"/"+String(b.required_total??0)],
       ["Tashxis",b.diagnosis_correct?"To‘g‘ri":"Noto‘g‘ri"],
       ["Barqarorlashuv",r.stabilized?(String(r.stabilized_at_s)+" soniya"):"Yo‘q"],
       ["Tab jarimasi","-"+String(b.tab_penalty??0)]].forEach(function(item){
        var box=el("div","");box.className="mg-report-stat";
        box.appendChild(el("small","",item[0]));box.appendChild(el("strong","",item[1]));stats.appendChild(box);
      });
      wrap.appendChild(stats);
      var section=el("section","");section.className="mg-report-section";
      section.appendChild(el("h4","","Klinik harakatlar jurnali"));
      var audit=el("div","");audit.className="mg-report-audit";
      (Array.isArray(r.audit)?r.audit:[]).forEach(function(a){
        var color=a.type==="harm"||a.type==="missed"?"#fb7185":a.type==="tab"||a.type==="duplicate"?"#fbbf24":"#56dcc0";
        var item=el("div","");item.className="mg-report-event";item.style.borderLeftColor=color;
        item.appendChild(el("strong","color:"+color,(a.t!==null&&a.t!==undefined?"["+a.t+" s] ":"")+(a.action||"Harakat")));
        item.appendChild(el("div","color:#d5e2ec;margin-top:3px",a.text||""));
        audit.appendChild(item);
      });
      if(!audit.childElementCount)audit.appendChild(el("div","color:#9fb3c5;font-size:13px","Audit hodisalari mavjud emas."));
      section.appendChild(audit);wrap.appendChild(section);
      wrap.appendChild(el("p","color:#91a6b8;font-size:12px;line-height:1.6;margin:14px 2px","Ball faollik reytingiga qo‘shiladi (keys kuniga bir marta)."));
      var actions=el("div","");actions.className="mg-report-actions";
      var again=el("button","","Yana urinish");again.onclick=showStart;actions.appendChild(again);
      var close=el("button","","Kabinetga qaytish");close.onclick=exitToDashboard;actions.appendChild(close);
      wrap.appendChild(actions);card.appendChild(wrap);
      card.scrollTop=0;
    }

    showStart();
  }

  // The role workspace launch button is supplied by virtual-patient.js.
  // Avoid adding a second, duplicate navbar entry.
  window.medgenOpenVitalsSimulation = open;
  // Bridge used by the existing 3D anatomy / Virtual patient workspace.
  // Keep the simulation embedded in its panel when that panel is visible.
  window.medgenPatient = window.medgenPatient || {};
  window.medgenPatient.start = function (caseId) {
    var root = document.getElementById("patient-sim-root");
    var visible = !!(root && (root.offsetWidth || root.offsetHeight || root.getClientRects().length));
    open(visible ? root : null, caseId || "anaphylaxis");
  };
  window.medgenOpenVitalsSimulationEmbedded = function (root, caseId) {
    if (!root || root.nodeType !== 1) throw new Error("Virtual bemor paneli topilmadi.");
    open(root, caseId || "anaphylaxis");
  };
})();
