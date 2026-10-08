/* MedGen AI Phase 1 — authoritative application shell
   Keeps authentication boundary and navigation state deterministic.
*/
(function () {
  'use strict';

  const TOKEN_KEY = 'medgen_access_token';

  const $ = (id) => document.getElementById(id);
  const hasToken = () => Boolean(sessionStorage.getItem(TOKEN_KEY));

  function hideLegacyDashboardContent() {
    const dashboard = $('dashboardView');
    if (!dashboard) return;
    dashboard.querySelectorAll(
      '#roleDashboard,#moduleDirectory,#workspace,#educationPreferencePanel,#securityCenter,#userDirectoryDashboard,#adminDashboard,#supportCenter,#aiCenter,#communityCenter,#scientificWorkflowPanel,#moleculeVisualPanel'
    ).forEach((el) => {
      if (el.id !== 'workspace' && el.id !== 'roleDashboard') el.classList.add('hidden');
    });
  }

  function showLoginBoundary() {
    const login = $('loginView');
    const dashboard = $('dashboardView');
    if (login) {
      login.classList.remove('hidden');
      login.hidden = false;
      login.style.removeProperty('display');
      login.style.visibility = 'visible';
      login.style.opacity = '1';
    }
    if (dashboard) {
      dashboard.classList.add('hidden');
      dashboard.hidden = true;
      dashboard.style.setProperty('display', 'none', 'important');
    }
    document.body.classList.remove('medgen-authenticated');
  }

  function showAuthenticatedBoundary(user) {
    const login = $('loginView');
    const dashboard = $('dashboardView');
    if (login) {
      login.classList.add('hidden');
      login.hidden = true;
      login.style.setProperty('display', 'none', 'important');
    }
    if (dashboard) {
      dashboard.classList.remove('hidden');
      dashboard.hidden = false;
      dashboard.style.setProperty('display', 'block', 'important');
      dashboard.style.visibility = 'visible';
    }
    document.body.classList.add('medgen-authenticated');

    if (user) {
      window.__MEDGEN_USER = user;
      try {
        if (window.state) window.state.user = user;
      } catch (_) {}
    }

    // The final role-aware home is the only home rendered after authentication.
    if (window.medgenFinalBoot && user) {
      try { window.medgenFinalBoot(user); } catch (e) { console.error('Final shell boot:', e); }
    }
  }

  function bind() {
    // Initial state: never leak authenticated UI into the login screen.
    if (hasToken()) {
      const user = window.__MEDGEN_USER || window.state?.user;
      if (user) showAuthenticatedBoundary(user);
      else {
        const token = sessionStorage.getItem(TOKEN_KEY);
        fetch('/api/v1/auth/me', {
          headers: { Authorization: 'Bearer ' + token }
        })
          .then((r) => r.ok ? r.json() : Promise.reject(new Error('Session expired')))
          .then(showAuthenticatedBoundary)
          .catch(() => {
            sessionStorage.removeItem(TOKEN_KEY);
            showLoginBoundary();
          });
      }
    } else {
      showLoginBoundary();
    }

    const menu = $('medgenMenuBtn');
    if (menu && !menu.dataset.phase1Bound) {
      menu.dataset.phase1Bound = '1';
      menu.addEventListener('click', () => {
        if (!hasToken()) return;
        const drawer = $('finalMenuDrawer');
        if (drawer) {
          if (window.medgenFinalBoot) {
            try { window.medgenFinalBoot(window.__MEDGEN_USER || window.state?.user || {role:'student'}); } catch (_) {}
          }
          drawer.classList.add('open');
        }
      });
    }

    const profile = $('profileBtn');
    if (profile && !profile.dataset.phase1Bound) {
      profile.dataset.phase1Bound = '1';
      profile.addEventListener('click', () => {
        if (hasToken() && typeof window.openProfile === 'function') window.openProfile();
      });
    }

    // Reconcile only the authentication boundary; never rewrite module navigation.
    const observer = new MutationObserver(() => {
      if (!hasToken()) {
        const d = $('dashboardView');
        if (d && !d.classList.contains('hidden')) showLoginBoundary();
      } else {
        const l = $('loginView');
        if (l && !l.classList.contains('hidden')) {
          const user = window.__MEDGEN_USER || window.state?.user;
          if (user) showAuthenticatedBoundary(user);
        }
      }
    });
    observer.observe(document.body, {subtree: true, attributes: true, attributeFilter: ['class','style','hidden']});

    window.addEventListener('storage', () => {
      if (!hasToken()) showLoginBoundary();
    });
  }

  window.medgenPhase1Shell = {
    login: showLoginBoundary,
    authenticated: showAuthenticatedBoundary,
    sync: () => hasToken() ? showAuthenticatedBoundary(window.__MEDGEN_USER || window.state?.user) : showLoginBoundary()
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bind, {once: true});
  } else {
    bind();
  }
})();
