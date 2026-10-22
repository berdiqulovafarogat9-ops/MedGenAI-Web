(function () {
  var API = window.MEDGEN_API_BASE || "https://medgenai-web-1.onrender.com/api/v1";

  function token() { return sessionStorage.getItem("medgen_access_token") || ""; }

  async function call(path, method, body) {
    var res = await fetch(API + path, {
      method: method || "GET",
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + token() },
      body: body ? JSON.stringify(body) : undefined
    });
    var data = {};
    try { data = await res.json(); } catch (e) {}
    if (!res.ok) throw new Error(data.detail || "Xatolik (" + res.status + ")");
    return data;
  }

  function el(tag, css, text) {
    var n = document.createElement(tag);
    if (css) {
      css.split(";").forEach(function (d) {
        var i = d.indexOf(":");
        if (i > 0) n.style.setProperty(d.slice(0, i).trim(), d.slice(i + 1).trim(), "important");
      });
    }
    if (text) n.textContent = text;
    return n;
  }

  var CARD = "background:#13222f;color:#e8f0f6;border:1px solid #24394d;border-radius:20px;padding:22px;width:min(92vw,400px);max-height:90vh;overflow:auto;font-family:system-ui,sans-serif";
  var INPUT = "width:100%;padding:12px;border-radius:12px;border:1px solid #24394d;background:#182b3d;color:#e8f0f6;font-size:18px;letter-spacing:.2em;text-align:center;margin:10px 0";
  var BTN = "width:100%;padding:13px;border:0;border-radius:12px;background:#56dcc0;color:#06231d;font-weight:700;font-size:15px;margin-top:6px";
  var BTN2 = "width:100%;padding:12px;border:1px solid #24394d;border-radius:12px;background:transparent;color:#8fa3b5;font-size:14px;margin-top:8px";

  function loadQr(cb) {
    if (window.QRCode) return cb();
    var s = document.createElement("script");
    s.src = "https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js";
    s.onload = cb;
    s.onerror = function () { cb(); };
    document.head.appendChild(s);
  }

  async function open() {
    var overlay = el("div", "position:fixed;inset:0;background:rgba(0,0,0,.7);display:flex;align-items:center;justify-content:center;z-index:99999");
    var card = el("div", CARD);
    overlay.appendChild(card);
    overlay.addEventListener("click", function (e) { if (e.target === overlay) overlay.remove(); });
    document.body.appendChild(overlay);

    function head(t) { card.appendChild(el("h3", "margin:0 0 8px;font-size:20px;color:#e8f0f6", t)); }
    function msg() { var m = el("div", "min-height:20px;margin-top:10px;font-size:14px;color:#ff8a8a"); card.appendChild(m); return m; }
    function close() { var b = el("button", BTN2, "Yopish"); b.onclick = function () { overlay.remove(); }; card.appendChild(b); }

    function showCodes(codes) {
      card.innerHTML = "";
      head("Tiklash kodlari");
      card.appendChild(el("p", "color:#8fa3b5;font-size:14px;margin:0 0 8px", "Telefoningiz yo'qolsa, shu kodlardan biri bilan kira olasiz. Har biri bir marta ishlaydi. Hozir saqlab qo'ying, ular qayta ko'rsatilmaydi."));
      var box = el("pre", "background:#182b3d;padding:12px;border-radius:12px;font-size:16px;line-height:1.8;text-align:center;margin:0 0 8px;white-space:pre-wrap", (codes || []).join("\n"));
      card.appendChild(box);
      var cp = el("button", BTN2, "Nusxalash");
      cp.onclick = function () {
        try { navigator.clipboard.writeText((codes || []).join("\n")); cp.textContent = "Nusxalandi ✓"; } catch (e) { cp.textContent = "Qo'lda nusxalang"; }
      };
      card.appendChild(cp);
      var ok = el("button", BTN, "Saqladim");
      ok.onclick = function () { render(); };
      card.appendChild(ok);
    }

    async function render() {
      card.innerHTML = "";
      var st;
      try { st = await call("/auth/2fa/status"); }
      catch (e) { head("Ikki bosqichli himoya"); card.appendChild(el("p", "color:#ff8a8a", e.message)); close(); return; }

      head("Ikki bosqichli himoya (2FA)");
      if (st.enabled) {
        card.appendChild(el("p", "color:#56dcc0;margin:0 0 6px", "Yoqilgan ✓"));
        card.appendChild(el("p", "color:#8fa3b5;font-size:13px;margin:0 0 6px", "Tiklash kodlari: " + (st.recovery_remaining || 0) + " ta qoldi"));
        card.appendChild(el("p", "color:#8fa3b5;font-size:14px", "Quyidagi amallar uchun Google Authenticator'dagi joriy kodni kiriting."));
        var inD = el("input", INPUT); inD.setAttribute("inputmode", "numeric"); inD.maxLength = 6; card.appendChild(inD);
        var bR = el("button", BTN, "Yangi tiklash kodlarini yaratish"); card.appendChild(bR);
        var bD = el("button", BTN2, "2FA ni o'chirish"); card.appendChild(bD);
        var mD = msg();
        bR.onclick = async function () {
          try { var r = await call("/auth/2fa/recovery/regenerate", "POST", { code: inD.value.trim() }); showCodes(r.recovery_codes); }
          catch (e) { mD.textContent = e.message; }
        };
        bD.onclick = async function () {
          try { await call("/auth/2fa/disable", "POST", { code: inD.value.trim() }); render(); }
          catch (e) { mD.textContent = e.message; }
        };
      } else {
        card.appendChild(el("p", "color:#8fa3b5;font-size:14px;margin:0 0 6px", "Hisobingizni Google Authenticator bilan himoyalang."));
        var bS = el("button", BTN, "2FA ni yoqish"); card.appendChild(bS);
        var mS = msg();
        bS.onclick = async function () {
          try {
            var s = await call("/auth/2fa/setup", "POST", {});
            card.innerHTML = "";
            head("QR kodni skanerlang");
            var qr = el("div", "background:#fff;padding:10px;border-radius:12px;width:fit-content;margin:10px auto");
            card.appendChild(qr);
            loadQr(function () {
              if (window.QRCode) { new QRCode(qr, { text: s.otpauth_uri, width: 180, height: 180 }); }
              else { qr.style.display = "none"; }
            });
            var openApp = el("a", "display:block;text-align:center;padding:12px;border-radius:12px;background:#56dcc0;color:#06231d;font-weight:700;text-decoration:none;margin:8px 0", "Authenticator ilovasida ochish");
            openApp.href = s.otpauth_uri;
            card.appendChild(openApp);
            card.appendChild(el("p", "color:#8fa3b5;font-size:13px;margin:6px 0", "Ochilmasa: Google Authenticator → + → \"Kalitni kiritish\" → hisob: MedGen, kalit: pastdagi matn, turi: vaqtga asoslangan."));
            card.appendChild(el("code", "display:block;word-break:break-all;background:#182b3d;padding:10px;border-radius:10px;font-size:14px", s.secret));
            var inE = el("input", INPUT); inE.setAttribute("inputmode", "numeric"); inE.maxLength = 6; inE.placeholder = "6 xonali kod"; card.appendChild(inE);
            var bE = el("button", BTN, "Tasdiqlash va yoqish"); card.appendChild(bE);
            var mE = msg();
            bE.onclick = async function () {
              try { var r = await call("/auth/2fa/enable", "POST", { code: inE.value.trim() }); showCodes(r.recovery_codes || []); }
              catch (e) { mE.textContent = e.message; }
            };
            close();
          } catch (e) { mS.textContent = e.message; }
        };
      }
      close();
    }
    render();
  }

  function init() {
    var logout = document.getElementById("logoutBtn");
    if (!logout || document.getElementById("twofaBtn")) return;
    var b = document.createElement("button");
    b.id = "twofaBtn"; b.type = "button"; b.className = logout.className; b.textContent = "2FA";
    b.addEventListener("click", open);
    logout.parentNode.insertBefore(b, logout);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
})();
