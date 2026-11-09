/* MedGen AI — Cabinet / Profile safe integration patch.
   This patch deliberately does not fabricate sessions, revoke actions,
   subscription entitlements, scores, or certificates. */
(function () {
  'use strict';

  const css = document.createElement('style');
  css.id = 'medgen-cabinet-patch-style';
  css.textContent = `
    .medgen-auth-loading { position:relative; opacity:.88; cursor:progress !important; }
    .medgen-auth-loading::before {
      content:""; display:inline-block; width:13px; height:13px; margin-right:9px;
      vertical-align:-2px; border:2px solid currentColor; border-right-color:transparent;
      border-radius:50%; animation:medgen-auth-spin .7s linear infinite;
    }
    @keyframes medgen-auth-spin { to { transform:rotate(360deg); } }
  `;
  (document.head || document.documentElement).appendChild(css);

  function normalizeRole(value) {
    return String(value || '').trim().toLowerCase().replace(/[\\s-]+/g, '_');
  }

  function isStudent() {
    const user = window.__MEDGEN_USER || {};
    const role = normalizeRole(user.role || user.user_role || user.type);
    return ['student', 'talaba', 'learner'].includes(role);
  }

  function updateAcademicVisibility() {
    const section = document.querySelector('#academicProfileSection, .academic-profile-section, #academic-profile-fields');
    if (!section) return;
    // Avoid hiding academic fields before authentication has resolved.
    if (!window.__MEDGEN_USER) return;
    section.hidden = !isStudent();
    section.setAttribute('aria-hidden', String(!isStudent()));
  }

  function applyTextCleanup() {
    document.querySelectorAll('[data-i18n="privateDevelopment"]').forEach(el => {
      el.textContent = 'MEDGEN AI · BIOMEDICAL PLATFORM';
      el.style.letterSpacing = '.08em';
    });
    document.querySelectorAll('[data-i18n="privateResearch"]').forEach(el => {
      el.textContent = 'VIRTUAL MEDICAL EDUCATION & RESEARCH';
    });

    const phone = document.querySelector('#registerPhone');
    if (phone) {
      phone.required = false;
      const label = phone.closest('label');
      const caption = label && label.querySelector('span');
      if (caption) caption.textContent = 'Phone number (optional)';
    }
    updateAcademicVisibility();
  }

  function boot() {
    applyTextCleanup();
    const observer = new MutationObserver(() => {
      applyTextCleanup();
    });
    observer.observe(document.body, { childList: true, subtree: true });
    window.addEventListener('medgen:user-updated', updateAcademicVisibility);
    // Role state is published by the existing app after login.
    const rolePoll = window.setInterval(() => {
      if (window.__MEDGEN_USER) updateAcademicVisibility();
    }, 800);
    window.addEventListener('pagehide', () => window.clearInterval(rolePoll), { once: true });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
})();
