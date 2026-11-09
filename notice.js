(function () {
  var KEY = "medgen_notice_dismissed";
  window.dismissNotice = function dismissNotice() {
    var banner = document.getElementById("research-notice-banner");
    if (banner) banner.style.display = "none";
    try { sessionStorage.setItem(KEY, "true"); } catch (e) {}
  };
  function init() {
    try { if (sessionStorage.getItem(KEY) === "true") return; } catch (e) {}
    if (document.getElementById("research-notice-banner")) return;
    var bar = document.createElement("div");
    bar.id = "research-notice-banner";
    bar.setAttribute("role", "note");
    bar.style.cssText = "position:static;width:100%;box-sizing:border-box;display:flex;align-items:center;gap:10px;padding:10px 12px;margin:12px 0 0;background:#2b2410;color:#f6e7b0;border:1px solid #7a6420;border-radius:10px;font:13px/1.45 system-ui,sans-serif";
    var text = document.createElement("div"); text.style.flex = "1 1 auto";
    text.textContent = "Faqat tadqiqot va ta’lim uchun. Haqiqiy bemor ma’lumotlarini (ism, pasport, tibbiy varaq) kiritmang. Natijalar tashxis yoki davolash tavsiyasi emas. / Research and education only: do not enter real patient data.";
    var close = document.createElement("button"); close.type = "button"; close.textContent = "Tushundim";
    close.setAttribute("aria-label", "Ogohlantirishni yopish");
    close.style.cssText = "flex:none;padding:7px 12px;border-radius:8px;border:1px solid #7a6420;background:transparent;color:#f6e7b0;font-size:13px;cursor:pointer";
    close.addEventListener("click", window.dismissNotice);
    bar.appendChild(text); bar.appendChild(close); document.body.appendChild(bar);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
})();
