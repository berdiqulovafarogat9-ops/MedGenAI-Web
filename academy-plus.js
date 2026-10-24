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

  var CARD = "background:#13222f;color:#e8f0f6;border:1px solid #24394d;border-radius:20px;padding:18px;width:min(94vw,560px);max-height:92vh;overflow:auto;font-family:system-ui,sans-serif";
  var BTN = "padding:11px 14px;border:0;border-radius:10px;background:#56dcc0;color:#06231d;font-weight:700;font-size:14px;margin:6px 0";
  var BTN2 = "padding:10px 14px;border:1px solid #24394d;border-radius:10px;background:transparent;color:#cfe0ec;font-size:14px;margin:4px 6px 4px 0;text-align:left";
  var FIELD = "width:100%;padding:10px;border-radius:10px;border:1px solid #24394d;background:#182b3d;color:#e8f0f6;font-size:15px;margin:4px 0 8px";
  var MUTED = "color:#8fa3b5;font-size:13px;margin:4px 0 8px";

  function isAdmin() {
    var b = document.getElementById("roleBadge");
    return !!b && (b.textContent || "").trim().toUpperCase() === "SUPER_ADMIN";
  }

  function open() {
    var overlay = el("div", "position:fixed;inset:0;background:rgba(0,0,0,.7);display:flex;align-items:center;justify-content:center;z-index:99999");
    var card = el("div", CARD);
    overlay.appendChild(card);
    overlay.addEventListener("click", function (e) { if (e.target === overlay) overlay.remove(); });
    document.body.appendChild(overlay);

    var tabs = el("div", "display:flex;gap:6px;margin-bottom:10px");
    var body = el("div");
    var msg = el("div", "min-height:18px;font-size:13px;color:#ff8a8a;margin-top:8px");
    var closeBtn = el("button", BTN2 + ";width:100%;text-align:center;margin-top:10px", "Yopish");
    closeBtn.onclick = function () { overlay.remove(); };
    card.appendChild(tabs); card.appendChild(body); card.appendChild(msg); card.appendChild(closeBtn);

    function setTab(name) {
      msg.textContent = "";
      [["catalog", "Katalog"], ["board", "Reyting"], ["certs", "Sertifikatlar"]].forEach(function (t) { /* rebuilt below */ });
      tabs.innerHTML = "";
      [["catalog", "Katalog"], ["board", "Reyting"], ["certs", "Sertifikatlar"]].forEach(function (t) {
        var b = el("button", BTN2 + ";flex:1;text-align:center;margin:0;" + (t[0] === name ? "border-color:#56dcc0;color:#56dcc0" : ""), t[1]);
        b.onclick = function () { setTab(t[0]); };
        tabs.appendChild(b);
      });
      body.innerHTML = "";
      var run = { catalog: showCatalog, board: showBoard, certs: showCerts }[name];
      run().catch(function (e) { msg.textContent = e.message; });
    }

    // ---------- Catalog ----------
    async function showCatalog() {
      var data = await call("/curriculum/years");
      body.innerHTML = "";
      data.years.forEach(function (y) {
        body.appendChild(el("div", "font-weight:700;margin:12px 0 4px;color:#56dcc0", y.title));
        y.subjects.forEach(function (s) {
          var b = el("button", BTN2, s.name + (s.topic_count ? "  (" + s.topic_count + ")" : ""));
          b.onclick = function () { showSubject(s.code).catch(function (e) { msg.textContent = e.message; }); };
          body.appendChild(b);
        });
      });
    }

    async function showSubject(code) {
      var data = await call("/curriculum/subjects/" + encodeURIComponent(code) + "/topics");
      body.innerHTML = "";
      var back = el("button", BTN2, "← Orqaga"); back.onclick = function () { setTab("catalog"); }; body.appendChild(back);
      body.appendChild(el("h3", "margin:6px 0 8px;font-size:18px;color:#e8f0f6", data.subject.name));
      if (!data.topics.length) body.appendChild(el("p", MUTED, "Bu fan uchun mavzular hali qo'shilmagan."));
      data.topics.forEach(function (t) {
        var b = el("button", BTN2 + ";display:block;width:100%", t.order_number + ". " + t.title);
        b.onclick = function () { showTopic(t.id, code).catch(function (e) { msg.textContent = e.message; }); };
        body.appendChild(b);
      });
      if (isAdmin()) {
        body.appendChild(el("h4", "margin:16px 0 4px;font-size:15px", "Mavzu qo'shish (admin)"));
        var tt = el("input", FIELD); tt.placeholder = "Mavzu nomi"; body.appendChild(tt);
        var ts = el("textarea", FIELD + ";min-height:110px"); ts.placeholder = "Qisqa nazariya (oddiy matn)"; body.appendChild(ts);
        var add = el("button", BTN, "Saqlash");
        add.onclick = async function () {
          try { await call("/curriculum/topics", "POST", { subject_code: code, title: tt.value, summary_md: ts.value }); showSubject(code); }
          catch (e) { msg.textContent = e.message; }
        };
        body.appendChild(add);
      }
    }

    async function showTopic(id, code) {
      var data = await call("/curriculum/topics/" + encodeURIComponent(id));
      body.innerHTML = "";
      var back = el("button", BTN2, "← Orqaga"); back.onclick = function () { showSubject(code).catch(function (e) { msg.textContent = e.message; }); }; body.appendChild(back);
      body.appendChild(el("h3", "margin:6px 0 8px;font-size:18px;color:#e8f0f6", data.topic.title));
      body.appendChild(el("div", "white-space:pre-wrap;font-size:14px;line-height:1.55;color:#dbe7f0", data.topic.summary_md || ""));
      data.resources.forEach(function (r) {
        if (!/^https:\/\//i.test(r.resource_url)) return;
        var a = el("a", "display:block;margin-top:8px;color:#56dcc0;font-size:14px", "[" + r.resource_type + "] " + r.title);
        a.href = r.resource_url; a.target = "_blank"; a.rel = "noopener noreferrer";
        body.appendChild(a);
      });
    }

    // ---------- Leaderboard ----------
    async function showBoard() {
      var data = await call("/leaderboard");
      body.innerHTML = "";
      body.appendChild(el("p", MUTED, data.metric));
      var table = el("table", "width:100%;border-collapse:collapse;font-size:13px");
      var head = el("tr");
      ["#", "Ism", "Universitet", "Kurs", "Ochko"].forEach(function (h) { head.appendChild(el("th", "text-align:left;padding:6px;border-bottom:1px solid #24394d;color:#8fa3b5", h)); });
      table.appendChild(head);
      data.top.forEach(function (r, i) {
        var tr = el("tr");
        [i + 1, r.display_name, r.university || "-", r.course_number || "-", r.total_score].forEach(function (v) {
          tr.appendChild(el("td", "padding:6px;border-bottom:1px solid #1d3042", String(v)));
        });
        table.appendChild(tr);
      });
      body.appendChild(table);
      if (!data.top.length) body.appendChild(el("p", MUTED, "Reyting hali bo'sh."));

      if (data.joined) {
        body.appendChild(el("p", "font-size:14px;margin-top:12px", "Siz reytingdasiz: " + data.me.total_score + " ochko, " + data.me.solved_cases_count + " ta keys."));
        var leave = el("button", BTN2, "Reytingdan chiqish va ma'lumotlarimni o'chirish");
        leave.onclick = async function () { try { await call("/leaderboard/me", "DELETE"); setTab("board"); } catch (e) { msg.textContent = e.message; } };
        body.appendChild(leave);
      } else {
        body.appendChild(el("h4", "margin:14px 0 4px;font-size:15px", "Reytingga qo'shilish"));
        var nm = el("input", FIELD); nm.placeholder = "Reytingda ko'rinadigan ism (laqab bo'lishi mumkin)"; body.appendChild(nm);
        var un = el("input", FIELD); un.placeholder = "Universitet (ixtiyoriy)"; body.appendChild(un);
        var cs = el("select", FIELD);
        [1, 2, 3, 4, 5, 6].forEach(function (n) { var o = document.createElement("option"); o.value = n; o.textContent = n + "-kurs"; cs.appendChild(o); });
        body.appendChild(cs);
        var row = el("label", "display:flex;gap:8px;align-items:flex-start;font-size:13px;color:#cfe0ec;margin:6px 0");
        var cb = document.createElement("input"); cb.type = "checkbox";
        row.appendChild(cb);
        row.appendChild(el("span", "", "Ismim va universitetim barcha foydalanuvchilarga ko'rinishiga roziman. Istalgan vaqtda chiqib ketib, ma'lumotlarimni o'chira olaman."));
        body.appendChild(row);
        var join = el("button", BTN, "Qo'shilish");
        join.onclick = async function () {
          try {
            await call("/leaderboard/join", "POST", { display_name: nm.value, university: un.value, course_number: parseInt(cs.value, 10), consent: cb.checked });
            setTab("board");
          } catch (e) { msg.textContent = e.message; }
        };
        body.appendChild(join);
      }
    }

    // ---------- Certificates ----------
    async function showCerts() {
      var data = await call("/certificates/mine");
      body.innerHTML = "";
      if (!data.certificates.length) body.appendChild(el("p", MUTED, "Sizda hali sertifikat yo'q. Sertifikatlar tashkilot yoki administrator tomonidan beriladi."));
      data.certificates.forEach(function (c) {
        var box = el("div", "border:1px solid #24394d;border-radius:12px;padding:10px;margin:8px 0");
        box.appendChild(el("div", "font-weight:700", c.title));
        box.appendChild(el("div", MUTED, c.issue_date + " · " + c.certificate_code + (c.revoked ? " · BEKOR QILINGAN" : "")));
        if (!c.revoked) {
          var a = el("a", "color:#56dcc0;font-size:14px", "Ko'rish / PDF sifatida saqlash");
          a.href = API + "/certificates/" + encodeURIComponent(c.certificate_code) + "/view";
          a.target = "_blank"; a.rel = "noopener";
          box.appendChild(a);
        }
        body.appendChild(box);
      });
      if (isAdmin()) {
        body.appendChild(el("h4", "margin:16px 0 4px;font-size:15px", "Sertifikat berish (admin)"));
        var un = el("input", FIELD); un.placeholder = "Foydalanuvchi nomi (username)"; body.appendChild(un);
        var tt = el("input", FIELD); tt.placeholder = "Sertifikat sarlavhasi (masalan: Normal anatomiya, 1-kurs)"; body.appendChild(tt);
        var issue = el("button", BTN, "Berish");
        issue.onclick = async function () {
          try {
            var r = await call("/certificates/issue", "POST", { username: un.value, title: tt.value });
            msg.style.setProperty("color", "#56dcc0", "important");
            msg.textContent = "Berildi: " + r.certificate_code;
            un.value = ""; tt.value = "";
          } catch (e) { msg.style.setProperty("color", "#ff8a8a", "important"); msg.textContent = e.message; }
        };
        body.appendChild(issue);
      }
    }

    setTab("catalog");
  }

  function init() {
    var logout = document.getElementById("logoutBtn");
    if (!logout || document.getElementById("academyPlusBtn")) return;
    var b = document.createElement("button");
    b.id = "academyPlusBtn"; b.type = "button"; b.className = logout.className; b.textContent = "Akademiya+";
    b.addEventListener("click", open);
    logout.parentNode.insertBefore(b, logout);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
})();
