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

  function open(targetRoot, caseKey) {
    var embedded = !!(targetRoot && targetRoot.nodeType === 1);
    if (embedded && activeEmbeddedClose) activeEmbeddedClose();
    var overlay = embedded ? null : el("div", "position:fixed;inset:0;background:rgba(0,0,0,.75);display:flex;align-items:center;justify-content:center;z-index:99999");
    var embeddedCardStyle = CARD.replace("width:min(96vw,640px);max-height:94vh;", "width:100%;max-height:none;") + ";box-sizing:border-box";
    var card = el("div", embedded ? embeddedCardStyle : CARD);
    if (embedded) {
      targetRoot.innerHTML = "";
      targetRoot.appendChild(card);
    } else {
      overlay.appendChild(card);
      document.body.appendChild(overlay);
    }
    var sim = null, timer = null, raf = null, penalty = 0, lastPenaltyAt = 0, running = false, clinicSync = null;
    var genericClinicMounted = false;
    var alertBox = el("div", "display:none;background:#b00020;color:#fff;font-weight:700;padding:10px;border-radius:10px;margin-bottom:8px");
    card.appendChild(alertBox);

    function closeAll() {
      running = false;
      if (genericClinicMounted && window.medgen3DClinic) window.medgen3DClinic.dispose();
      genericClinicMounted = false;
      if (timer) clearInterval(timer);
      if (raf) cancelAnimationFrame(raf);
      if (clinicResizeObserver) clinicResizeObserver.disconnect();
      if (clinicRenderer) { clinicRenderer.dispose(); clinicRenderer.domElement.remove(); clinicRenderer = null; }
      clinicSync = null;
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("blur", onBlur);
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

    var hud, tiles = {}, canvas, actionsBox, logBox, endBox;
    function start(c) {
      card.innerHTML = ""; card.appendChild(alertBox);
      var caseMenu = el("div", "display:flex;gap:8px;flex-wrap:wrap;margin:0 0 12px");
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
      card.appendChild(caseMenu);
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

      // Generic 3D patient room for the standard clinical cases. Jasur has a dedicated interactive scene below.
      if (c.id !== "anaphylaxis_jasur" && window.medgen3DClinic && window.THREE) {
        var genericClinic = el("div", "margin:10px 0;padding:10px;border:1px solid #28465c;border-radius:14px;background:#071521");
        genericClinic.appendChild(el("div", "font-weight:800;color:#67e8f9;margin-bottom:6px", "3D VIRTUAL CLINIC"));
        genericClinic.appendChild(el("div", "font-size:12px;color:#9fb5c7;margin-bottom:8px", "Bemor modeli va nafas harakati vitallar simulyatsiyasiga bog‘langan. Jihozlar vizual o‘quv maketidir."));
        var genericWrap=el("div","width:100%;height:280px;border-radius:10px;overflow:hidden;background:#071521");
        genericWrap.id="medgen-3d-patient-"+Date.now();
        genericClinic.appendChild(genericWrap);
        card.appendChild(genericClinic);
        genericClinicMounted=!!window.medgen3DClinic.mount3DScene(genericWrap.id);
      }

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

      if (c.id === "anaphylaxis_jasur" && window.THREE && THREE.WebGLRenderer) {
        var clinic = el("div", "margin:10px 0;padding:10px;border:1px solid #28465c;border-radius:14px;background:#071521");
        clinic.appendChild(el("div", "font-weight:800;color:#67e8f9;margin-bottom:6px", "3D VIRTUAL CLINIC — Jasur"));
        clinic.appendChild(el("div", "font-size:12px;color:#9fb5c7;margin-bottom:8px", "Asbobni tanlang, so‘ng mos anatomik nishonni bosing. Soddalashtirilgan o‘quv modeli."));
        var tools3 = el("div", "display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px");
        var view3 = el("div", "height:260px;width:100%;background:#06101b;border-radius:10px;overflow:hidden");
        clinic.appendChild(tools3); clinic.appendChild(view3); actionsBox.parentNode.insertBefore(clinic, actionsBox);
        var chosen = "epi";
        actionsBox.style.display="none";
        var examPanel=el("div","margin-top:9px;padding:12px;border:1px solid #29465a;border-radius:12px;background:#0a1b28");
        examPanel.appendChild(el("div","font-weight:800;color:#9fe7f4;margin-bottom:8px","Klinik ko‘rik va diagnostika — Body Interact"));
        var examOut=el("div","font-size:12px;line-height:1.5;color:#c5d5e1;min-height:34px;margin:6px 0","Kategoriya tanlang va bemor tanasidagi yoritilgan nuqtani bosing.");
        var categoryGrid=el("div","display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px");
        examPanel.appendChild(categoryGrid);examPanel.appendChild(examOut);clinic.appendChild(examPanel);
        var actionModal=el("div","display:none;margin-top:10px;padding:12px;border:1px solid #3b647d;border-radius:12px;background:#102536");examPanel.appendChild(actionModal);
        function showResult(t){examOut.textContent=t;actionModal.style.display="none";}
        function modalChoice(label,fn){var b=el("button",BTN2,label);b.type="button";b.onclick=fn;actionModal.appendChild(b);}
        function category(icon,label,fn){var b=el("button","min-height:76px;padding:10px;border:1px solid #31536a;border-radius:12px;background:#102b3d;color:#e5f3fb;font-weight:750",icon+"  "+label);b.type="button";b.onclick=function(){actionModal.innerHTML="";actionModal.style.display="block";fn();};categoryGrid.appendChild(b);}
        category("🩺","Ko‘rik",function(){modalChoice("ABCDE ko‘rigi",function(){showResult("ABCDE: nafas yo‘li shishi, xirillash, gipoksiya va gipotenziyani baholang.");});modalChoice("Bosh / bo‘yin",function(){chosen="head";showResult("Bosh/bo‘yin hotspotini bosing: sianoz, shish va nafas yo‘li holati.");});modalChoice("Ko‘krak auskultatsiyasi",function(){chosen="stethoscope";showResult("Ko‘krak hotspotini bosing — xirillash tavsifi chiqadi.");});});
        category("💉","Shoshilinch dori / Muolaja",function(){modalChoice("💉 Adrenalin 1:1000 · 0.5 mg IM",function(){chosen="epi";showResult("💉 Adrenalin shpritsi tanlandi. Yuborish joyi: sonning old-yon qismi (Vastus lateralis). Son hotspotini bosing.");});modalChoice("🫁 Kislorod",function(){chosen="oxygen";showResult("Kislorod niqobi tanlandi. Bosh/yuz hotspotini bosing.");});modalChoice("💧 IV kateter + kristalloid",function(){chosen="iv";showResult("IV kateter tanlandi. Bilak hotspotini bosing.");});});
        category("🧪","Tahlil va EKG",function(){modalChoice("12-kanalli EKG",function(){showResult("Simulyatsion EKG: sinus taxikardiyasiga mos ritm; anafilaksiyani tasdiqlamaydi.");});modalChoice("Qon gazlari / triptaza",function(){showResult("Simulyatsion natija: gipoksemiya ehtimoli. Triptaza keyinroq olinishi mumkin; adrenalin kechiktirilmaydi.");});});
        category("🗣️","Bemor bilan muloqot",function(){modalChoice("Allergiya va trigger tarixi",function(){showResult("Nima chaqdi? Qachon boshlandi? Oldin allergiya bo‘lganmi? Qanday dorilar qabul qilasiz?");});modalChoice("Bemorni tinchlantirish",function(){showResult("Men siz bilanman. Nafas va qon bosimingizni kuzatyapmiz. Iltimos, o‘rningizdan turmang.");});modalChoice("SBAR topshirish",function(){showResult("S: ari chaqishidan keyingi anafilaktik shok. B: yuz-lab shishi, xirillash. A: vitallar monitor orqali kuzatilmoqda. R: reanimatsiya jamoasi.");});});
                try {
          var sc=new THREE.Scene(); sc.background=new THREE.Color(0x071521);
          var cam=new THREE.PerspectiveCamera(38,1,0.1,100); cam.position.set(0,1.8,2.2); cam.lookAt(0,1.0,0);
          clinicRenderer=new THREE.WebGLRenderer({antialias:true}); clinicRenderer.setPixelRatio(Math.min(window.devicePixelRatio||1,1.5)); view3.appendChild(clinicRenderer.domElement);
          clinicRenderer.domElement.style.cssText="width:100%;height:100%;display:block";
          sc.add(new THREE.HemisphereLight(0xffffff,0x334455,2));
          var light=new THREE.DirectionalLight(0xffffff,2); light.position.set(3,5,4); sc.add(light);
          var floor=new THREE.Mesh(new THREE.PlaneGeometry(10,10),new THREE.MeshStandardMaterial({color:0x142b3b})); floor.rotation.x=-Math.PI/2; sc.add(floor);
          // Emergency-room props: bed, monitor, IV stand and oxygen cylinder.
          var metal=new THREE.MeshStandardMaterial({color:0x9aaab5,metalness:.55,roughness:.35});
          var dark=new THREE.MeshStandardMaterial({color:0x17232d,roughness:.6});
          var mattress=new THREE.MeshStandardMaterial({color:0xd7e1e8,roughness:.9});
          function roomBox(w,h,d,x,y,z,mat){var q=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat);q.position.set(x,y,z);sc.add(q);return q;}
          roomBox(2.25,.16,1.05,0,.18,-.45,metal); roomBox(2.1,.18,.98,0,.34,-.45,mattress);
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
          // IV pole with fluid bag
          var pole=new THREE.Mesh(new THREE.CylinderGeometry(.018,.025,2.05,10),metal);pole.position.set(-1.45,1.03,-.35);sc.add(pole);
          roomBox(.22,.3,.12,-1.45,1.78,-.35,new THREE.MeshStandardMaterial({color:0x9bd5ed,transparent:true,opacity:.72}));
          // oxygen cylinder and regulator
          var tank=new THREE.Mesh(new THREE.CylinderGeometry(.13,.13,.85,16),new THREE.MeshStandardMaterial({color:0x2f9b78,metalness:.25}));tank.position.set(1.75,.48,.25);sc.add(tank);
          var tankTop=new THREE.Mesh(new THREE.CylinderGeometry(.055,.09,.14,12),metal);tankTop.position.set(1.75,.96,.25);sc.add(tankTop);
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
          // Wall-mounted oxygen outlet and room light panels
          roomBox(.22,.18,.08,1.8,1.85,-2.12,new THREE.MeshStandardMaterial({color:0x3ba6a0,metalness:.2}));
          roomBox(1.2,.045,.35,0,2.8,-.8,new THREE.MeshStandardMaterial({color:0xe6f1f5,emissive:0x52616b,emissiveIntensity:.45}));
          var roomLight=new THREE.PointLight(0xd8efff,1.2,7);roomLight.position.set(0,2.6,1.2);sc.add(roomLight);
          var skin=new THREE.MeshStandardMaterial({color:0xc58d73}), gown=new THREE.MeshStandardMaterial({color:0x16758a});
          var patient=new THREE.Group(); patient.rotation.z=-Math.PI/2; patient.scale.setScalar(0.58); patient.position.set(-0.05,0.59,-0.45); sc.add(patient);
          function part(g,m,x,y,z,sx,sy,sz){var o=new THREE.Mesh(g,m);o.position.set(x,y,z);o.scale.set(sx,sy,sz);patient.add(o);return o;}
          part(new THREE.SphereGeometry(.23,20,16),skin,0,1.65,0,1,1.1,.9);
          part(new THREE.CylinderGeometry(.35,.42,.9,20),gown,0,.95,0,1,1,.7);
          part(new THREE.CylinderGeometry(.07,.09,.8,12),skin,-.48,.95,0,1,1,1);
          part(new THREE.CylinderGeometry(.07,.09,.8,12),skin,.48,.95,0,1,1,1);
          part(new THREE.CylinderGeometry(.12,.09,.85,16),skin,-.2,.25,0,1,1,1);
          part(new THREE.CylinderGeometry(.12,.09,.85,16),skin,.2,.25,0,1,1,1);
          var torsoMesh=patient.children[1];
          var targets=[];
          function mark(zone,x,y,z,sx,sy,sz,color){var o=new THREE.Mesh(new THREE.SphereGeometry(.2,16,12),new THREE.MeshBasicMaterial({color:color,transparent:true,opacity:.38}));o.position.set(x,y,z);o.scale.set(sx,sy,sz);o.userData.zone=zone;patient.add(o);targets.push(o);}
          mark("face",0,1.66,.16,1.2,1.2,.8,0x38bdf8); mark("chest",0,1.02,.25,1.5,1.1,.6,0xfbbf24);
          mark("arm",-.48,.95,.06,1.2,2,1,0x34d399); mark("thigh",.2,.25,.08,1.4,2,1,0xfb7185);
          // Live bedside monitor: same simulated vitals and ECG rhythm as the HUD.
          clinicSync=function(v){
            if(!clinicRenderer)return;
            var pulse=1+Math.sin(Date.now()/1000*Math.max(.5,v.rr/60)*Math.PI*2)*.018;
            if(torsoMesh)torsoMesh.scale.y=.7*pulse;
            monitorCtx.fillStyle="#03100f";monitorCtx.fillRect(0,0,512,320);
            monitorCtx.fillStyle="#65f5d0";monitorCtx.font="bold 34px monospace";
            monitorCtx.fillText("HR "+Math.round(v.hr),18,48);
            monitorCtx.fillStyle="#f4d36b";monitorCtx.font="bold 28px monospace";
            monitorCtx.fillText("BP "+Math.round(v.sbp)+"/"+Math.round(v.dbp),18,88);
            monitorCtx.fillStyle="#71d8ff";monitorCtx.fillText("SpO2 "+Math.round(v.spo2)+"%",18,126);
            monitorCtx.fillStyle="#b6f28b";monitorCtx.fillText("RR "+Math.round(v.rr)+"/min",18,164);
            monitorCtx.strokeStyle="#47e7c1";monitorCtx.lineWidth=4;monitorCtx.beginPath();
            for(var j=0;j<470;j++){var phase=(j/470*2.4)+(Date.now()/1000)*(v.hr/60)*2*Math.PI;var y=236-ecgValue(phase,c.ecg==="st_elev")*62;if(j===0)monitorCtx.moveTo(18+j,y);else monitorCtx.lineTo(18+j,y);}
            monitorCtx.stroke();monitorTexture.needsUpdate=true;clinicRenderer.render(sc,cam);
          };
          clinicSync(sim.state);
          var ray=new THREE.Raycaster(),pt=new THREE.Vector2();
          function resize3(){var w=Math.max(view3.clientWidth,1),h=Math.max(view3.clientHeight,1);cam.aspect=w/h;cam.updateProjectionMatrix();clinicRenderer.setSize(w,h,false);clinicRenderer.render(sc,cam);}
          if(window.ResizeObserver){clinicResizeObserver=new ResizeObserver(resize3);clinicResizeObserver.observe(view3);} else window.addEventListener("resize",resize3);
          resize3();
          clinicRenderer.domElement.addEventListener("click",function(ev){
            var r=clinicRenderer.domElement.getBoundingClientRect();pt.x=(ev.clientX-r.left)/r.width*2-1;pt.y=-(ev.clientY-r.top)/r.height*2+1;ray.setFromCamera(pt,cam);
            var hit=ray.intersectObjects(targets,false)[0];if(!hit){flash("Anatomik nishonni tanlang.");return;}
            var z=hit.object.userData.zone,id=null;
            if(chosen==="epi"&&z==="thigh")id="epi_thigh";
            if(chosen==="oxygen"&&z==="face")id="oxygen_high";
            if(chosen==="iv"&&z==="arm")id="crystalloid_bolus";
            if(chosen==="monitor"&&z==="chest")id="monitor";
            if(chosen==="stethoscope"&&z==="chest"){flash("Auskultatsiya natijasi klinik ko‘rik panelida.");return;}
            if(!id){flash("Asbob va anatomik nishon mos emas.");return;}
            var result=sim.act(id);if(!result.ok){flash("Bu harakat bajarilgan yoki keys tugagan.");return;}
            actionsBox.querySelectorAll("button[data-id]").forEach(function(b){if(b.dataset.id===id){b.disabled=true;b.style.opacity=".45";}});
            logBox.appendChild(el("div","","["+sim.s+" s] "+result.label+" · 3D nishon: "+z));render();
          });
        } catch(err){console.error("3D Virtual Clinic",err);clinic.appendChild(el("p","color:#fca5a5;font-size:12px","3D sahna ochilmadi. Harakatlar ro‘yxati orqali davom eting."));}
      }
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

    function finish() {
      running = false;
      if (genericClinicMounted && window.medgen3DClinic) window.medgen3DClinic.dispose();
      genericClinicMounted = false;
      clearInterval(timer); cancelAnimationFrame(raf);
      if (clinicResizeObserver) clinicResizeObserver.disconnect();
      if (clinicRenderer) { clinicRenderer.dispose(); clinicRenderer.domElement.remove(); clinicRenderer = null; }
      clinicSync = null;
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
          if (typeof window.submitStudentScore === "function") {
            await window.submitStudentScore(rep.score, "Patient_" + sim.def.id);
          }
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
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
})();
