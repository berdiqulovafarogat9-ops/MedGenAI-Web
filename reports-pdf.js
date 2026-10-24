(function () {
  var API = window.MEDGEN_API_BASE || "https://medgenai-web-1.onrender.com/api/v1";

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function render(v, depth) {
    if (v === null || v === undefined || v === "") return '<span class="mut">&mdash;</span>';
    if (typeof v !== "object") return esc(String(v).slice(0, 5000));
    if (depth > 6) return esc(JSON.stringify(v).slice(0, 300));
    if (Array.isArray(v)) {
      if (!v.length) return '<span class="mut">&mdash;</span>';
      return "<ul>" + v.slice(0, 200).map(function (x) { return "<li>" + render(x, depth + 1) + "</li>"; }).join("") + "</ul>";
    }
    var rows = Object.keys(v).map(function (k) {
      return "<tr><th>" + esc(k.replace(/_/g, " ")) + "</th><td>" + render(v[k], depth + 1) + "</td></tr>";
    }).join("");
    return "<table>" + rows + "</table>";
  }

  function buildHtml(record, patient) {
    var d = record.data || {};
    var title = d.title || d.name || d.id || "Hisobot";
    var when = d.created_at ? new Date(d.created_at).toLocaleString() : "";
    var body = d.report !== undefined ? d.report : d;
    var css =
      "@page{size:A4;margin:16mm}*{box-sizing:border-box}body{font-family:system-ui,Arial,sans-serif;color:#111;margin:0;padding:18px;line-height:1.45;font-size:13px}" +
      "h1{font-size:22px;margin:0}h2{font-size:17px;margin:14px 0 6px}.brand{color:#0b8a74;font-weight:700;letter-spacing:.08em}" +
      ".meta{color:#444;margin:4px 0 12px}.meta b{color:#111}table{border-collapse:collapse;width:100%;margin:4px 0}" +
      "th,td{border:1px solid #ccc;padding:5px 8px;vertical-align:top;text-align:left}th{background:#f2f5f7;width:30%;text-transform:capitalize}" +
      "ul{margin:2px 0;padding-left:18px}.mut{color:#888}.note{margin-top:18px;padding:10px;border:1px solid #e0b000;background:#fff8e1;font-size:12px}" +
      ".sign{display:flex;gap:30px;margin-top:34px}.sign div{flex:1;border-top:1px solid #333;padding-top:4px;font-size:12px;color:#444}" +
      "#printBtn{position:fixed;right:14px;top:14px;padding:10px 16px;border:0;border-radius:10px;background:#0b8a74;color:#fff;font-size:14px}" +
      "@media print{#printBtn{display:none}}";
    return "<!doctype html><html><head><meta charset=\"utf-8\"><title>" + esc(title) + "</title><style>" + css + "</style></head><body>" +
      "<button id=\"printBtn\" type=\"button\">PDF sifatida saqlash / chop etish</button>" +
      "<div class=\"brand\">MEDGEN AI</div><h1>" + esc(title) + "</h1>" +
      "<div class=\"meta\"><b>ID:</b> " + esc(d.id || "-") + " &nbsp; <b>Sana:</b> " + esc(when) +
      " &nbsp; <b>Yaratdi:</b> " + esc(d.user || "-") + (patient ? " &nbsp; <b>Bemor ID:</b> " + esc(patient) : "") + "</div>" +
      "<h2>Natijalar</h2>" + render(body, 0) +
      "<div class=\"note\">Ushbu hisobot hisoblash va ma'lumotlar tahlili natijasi bo'lib, klinik tashxis yoki davolash tavsiyasi o'rnini bosmaydi. " +
      "Qaror qabul qilishdan oldin malakali shifokor bilan maslahatlashing.</div>" +
      "<div class=\"sign\"><div>Shifokor imzosi</div><div>Sana</div></div></body></html>";
  }

  function openPdf(record) {
    var patient = window.prompt("Bemor identifikatori (ixtiyoriy). Ism o'rniga ID yoki bosh harflarni yozing:", "") || "";
    var w = window.open("", "_blank");
    if (!w) { alert("Brauzer yangi oynani blokladi. Ruxsat berib, qayta urinib ko'ring."); return; }
    w.document.open();
    w.document.write(buildHtml(record, patient.trim()));
    w.document.close();
    var btn = w.document.getElementById("printBtn");
    if (btn) btn.addEventListener("click", function () { w.print(); });
    setTimeout(function () { try { w.print(); } catch (e) {} }, 700);
  }

  async function emailReport(record, msg) {
    msg.textContent = "Yuborilmoqda...";
    try {
      var res = await fetch(API + "/reports/" + encodeURIComponent(record.data.id) + "/email", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer " + (sessionStorage.getItem("medgen_access_token") || "") }
      });
      var data = {};
      try { data = await res.json(); } catch (e) {}
      msg.textContent = res.ok ? "Hisobot " + (data.to || "emailingizga") + " manziliga yuborildi." : (data.detail || "Xatolik (" + res.status + ")");
    } catch (e) { msg.textContent = "Tarmoq xatosi."; }
  }

  function attach(record) {
    var anchor = document.getElementById("reportsDownload");
    if (!anchor) return;
    ["reportsPdf", "reportsEmail", "reportsExportMsg"].forEach(function (id) {
      var old = document.getElementById(id);
      if (old) old.remove();
    });
    var pdf = document.createElement("button");
    pdf.id = "reportsPdf"; pdf.type = "button"; pdf.className = anchor.className; pdf.textContent = "PDF";
    pdf.addEventListener("click", function () { openPdf(record); });
    anchor.after(pdf);
    var last = pdf;
    var msg = document.createElement("span");
    msg.id = "reportsExportMsg"; msg.style.cssText = "margin-left:8px;font-size:13px";
    if (record.kind === "report") {
      var em = document.createElement("button");
      em.id = "reportsEmail"; em.type = "button"; em.className = anchor.className; em.textContent = "Emailga yuborish";
      em.addEventListener("click", function () { emailReport(record, msg); });
      pdf.after(em);
      last = em;
    }
    last.after(msg);
  }

  window.MedGenReports = { attach: attach };
})();
