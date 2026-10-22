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
    (css || "").split(";").forEach(function (d) {
      var i = d.indexOf(":");
      if (i > 0) n.style.setProperty(d.slice(0, i).trim(), d.slice(i + 1).trim(), "important");
    });
    if (text) n.textContent = text;
    return n;
  }

  var CARD = "background:#13222f;color:#e8f0f6;border:1px solid #24394d;border-radius:20px;padding:22px;width:min(92vw,400px);max-height:90vh;overflow:auto;font-family:system-ui,sans-serif";
  var BTN = "width:100%;padding:13px;border:0;border-radius:12px;background:#56dcc0;color:#06231d;font-weight:700;font-size:15px;margin-top:8px";
  var BTN2 = "width:100%;padding:12px;border:1px solid #24394d;border-radius:12px;background:transparent;color:#8fa3b5;font-size:14px;margin-top:8px";

  async function open() {
    var overlay = el("div", "position:fixed;inset:0;background:rgba(0,0,0,.7);display:flex;align-items:center;justify-content:center;z-index:99999");
    var card = el("div", CARD);
    overlay.appendChild(card);
    overlay.addEventListener("click", function (e) { if (e.target === overlay) overlay.remove(); });
    document.body.appendChild(overlay);
    card.appendChild(el("h3", "margin:0 0 10px;font-size:20px;color:#e8f0f6", "Tarif va obuna"));
    var msg = el("div", "min-height:20px;margin-top:10px;font-size:14px;color:#ff8a8a");
    try {
      var st = await call("/billing/status");
      var label = st.plan === "free" ? "Bepul" : st.plan;
      card.appendChild(el("p", "color:#8fa3b5;margin:0 0 8px", "Joriy tarif: " + label + (st.status === "active" ? " (faol)" : st.status === "on_hold" ? " (to'xtatilgan)" : "")));
      if (!st.configured || !st.plans.length) {
        card.appendChild(el("p", "color:#8fa3b5;font-size:14px", "To'lov tizimi hali sozlanmagan."));
      } else {
        if (st.environment !== "live") card.appendChild(el("p", "color:#f6c85f;font-size:13px", "Sinov rejimi: haqiqiy pul yechilmaydi."));
        st.plans.forEach(function (p) {
          var b = el("button", BTN, p.label + " ga o'tish");
          b.onclick = async function () {
            b.disabled = true;
            try { var r = await call("/billing/checkout", "POST", { plan: p.id }); window.location.href = r.checkout_url; }
            catch (e) { msg.textContent = e.message; b.disabled = false; }
          };
          card.appendChild(b);
        });
      }
    } catch (e) { msg.textContent = e.message; }
    card.appendChild(msg);
    var close = el("button", BTN2, "Yopish");
    close.onclick = function () { overlay.remove(); };
    card.appendChild(close);
  }

  function init() {
    var logout = document.getElementById("logoutBtn");
    if (!logout || document.getElementById("billingBtn")) return;
    var b = document.createElement("button");
    b.id = "billingBtn"; b.type = "button"; b.className = logout.className; b.textContent = "Tarif";
    b.addEventListener("click", open);
    logout.parentNode.insertBefore(b, logout);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
})();
