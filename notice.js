(function () {
  var KEY = "medgen_notice_dismissed";
  try { if (sessionStorage.getItem(KEY) === "1") return; } catch (e) {}

  function style(n, css) {
    css.split(";").forEach(function (d) {
      var i = d.indexOf(":");
      if (i > 0) n.style.setProperty(d.slice(0, i).trim(), d.slice(i + 1).trim(), "important");
    });
  }

  function init() {
    if (document.getElementById("medgenNotice")) return;
    var bar = document.createElement("div");
    bar.id = "medgenNotice";
    bar.setAttribute("role", "note");
    style(bar, "position:fixed;left:0;right:0;bottom:0;z-index:99990;display:flex;align-items:center;gap:10px;padding:8px 12px;background:#2b2410;color:#f6e7b0;border-top:1px solid #7a6420;font:13px/1.35 system-ui,sans-serif");
    var text = document.createElement("div");
    style(text, "flex:1");
    text.textContent = "Faqat tadqiqot va ta’lim uchun. Haqiqiy bemor ma’lumotlarini (ism, pasport, tibbiy varaq) kiritmang. Natijalar tashxis yoki davolash tavsiyasi emas. / Research and education only: do not enter real patient data.";
    var close = document.createElement("button");
    close.type = "button";
    close.textContent = "Tushundim";
    style(close, "flex:none;padding:6px 12px;border-radius:8px;border:1px solid #7a6420;background:transparent;color:#f6e7b0;font-size:13px");
    close.addEventListener("click", function () {
      try { sessionStorage.setItem(KEY, "1"); } catch (e) {}
      bar.remove();
    });
    bar.appendChild(text);
    bar.appendChild(close);
    document.body.appendChild(bar);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
})();
