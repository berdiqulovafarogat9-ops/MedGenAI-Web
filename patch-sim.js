/* MedGen AI — clinical simulator integration patch.
   Uses the existing scene/renderer and existing simulation controls.
   It never creates a second Three.js scene or changes clinical scoring. */
(function () {
  'use strict';
  function resizeExisting3D() {
    try {
      if (window.medgen3DClinic && typeof window.medgen3DClinic.resize === 'function') {
        window.medgen3DClinic.resize();
      }
      // The Jasur scene owns its renderer inside vitals-sim.js. Its existing
      // resize handler is intentionally triggered; no renderer is recreated.
      window.dispatchEvent(new Event('resize'));
    } catch (error) {
      console.warn('[MedGen simulator] viewport resize deferred:', error);
    }
  }
  let resizeFrame = 0;
  function scheduleResize() {
    if (resizeFrame) cancelAnimationFrame(resizeFrame);
    resizeFrame = requestAnimationFrame(function () {
      resizeFrame = 0;
      resizeExisting3D();
      requestAnimationFrame(resizeExisting3D);
    });
  }
  window.addEventListener('resize', scheduleResize, { passive: true });
  window.addEventListener('orientationchange', scheduleResize, { passive: true });
  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', scheduleResize, { passive: true });
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', scheduleResize, { once: true });
  } else {
    scheduleResize();
  }
  // A scene can be moved from its staging node into the Full Code viewport.
  // Observe only layout changes and resize the existing renderer afterwards.
  if (window.ResizeObserver && document.documentElement) {
    const observer = new ResizeObserver(function (entries) {
      if (entries.some(function (entry) {
        return entry.target.matches &&
          entry.target.matches('.fc-center-stage, .fc-three-viewport, [id^="medgen-3d-patient-"], #viewport-3d');
      })) scheduleResize();
    });
    function observeViewports() {
      document.querySelectorAll('.fc-center-stage, .fc-three-viewport, [id^="medgen-3d-patient-"], #viewport-3d')
        .forEach(function (node) { observer.observe(node); });
    }
    observeViewports();
    new MutationObserver(observeViewports).observe(document.documentElement, { childList: true, subtree: true });
  }
  window.MedGenSimulatorPatch = { resize: scheduleResize };
})();