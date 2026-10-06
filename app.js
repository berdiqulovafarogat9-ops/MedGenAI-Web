/* =========================================================
   MEDGEN AI — APP.JS
   Compatible with current index.html
========================================================= */

const API_BASE =
  window.MEDGEN_API_BASE ||
  'https://medgenai-web-1.onrender.com/api/v1';

const TOKEN_KEY = 'medgen_access_token';

const state = {
  token: sessionStorage.getItem(TOKEN_KEY) || '',
  user: null
};


/* =========================================================
   HELPERS
========================================================= */

const $ = (id) =>
  document.getElementById(id);


function getLanguage() {
  return localStorage.getItem('medgen_language') || 'uz';
}


function setText(id, text) {
  const el = $(id);

  if (el) {
    el.textContent = text;
  }
}


/* =========================================================
   API
========================================================= */

async function api(path, options = {}) {

  const headers = {
    ...(options.headers || {})
  };

  if (
    options.body &&
    !headers['Content-Type']
  ) {
    headers['Content-Type'] =
      'application/json';
  }

  if (state.token) {
    headers.Authorization =
      `Bearer ${state.token}`;
  }

  const response = await fetch(
    `${API_BASE}${path}`,
    {
      ...options,
      headers
    }
  );

  let data = null;

  const contentType =
    response.headers.get(
      'content-type'
    ) || '';

  if (
    contentType.includes(
      'application/json'
    )
  ) {
    data = await response.json();
  } else {
    const text =
      await response.text();

    data = text
      ? { message: text }
      : null;
  }

  if (!response.ok) {

    const message =
      data?.detail ||
      data?.message ||
      `HTTP ${response.status}`;

    throw new Error(message);
  }

  return data;
}


/* =========================================================
   LOGIN
========================================================= */

async function login() {

  const username =
    $('loginUser')?.value?.trim() || '';

  const password =
    $('loginPassword')?.value || '';

  const status =
    $('loginStatus');

  if (!username || !password) {

    if (status) {
      status.textContent =
        getLanguage() === 'ru'
          ? 'Введите имя пользователя и пароль.'
          : getLanguage() === 'uz'
            ? 'Foydalanuvchi nomi va parolni kiriting.'
            : 'Enter username and password.';
    }

    return;
  }

  if (status) {
    status.textContent =
      getLanguage() === 'ru'
        ? 'Выполняется вход...'
        : getLanguage() === 'uz'
          ? 'Tizimga kirilmoqda...'
          : 'Signing in...';
  }

  try {

    const data =
      await api(
        '/auth/login',
        {
          method: 'POST',
          body: JSON.stringify({
            username,
            password
          })
        }
      );

    const token =
      data?.access_token ||
      data?.token;

    if (!token) {
      throw new Error(
        'Access token was not returned by the server.'
      );
    }

    state.token = token;

    sessionStorage.setItem(
      TOKEN_KEY,
      token
    );

    if (status) {

      status.textContent =
        getLanguage() === 'ru'
          ? 'Вход выполнен.'
          : getLanguage() === 'uz'
            ? 'Tizimga muvaffaqiyatli kirildi.'
            : 'Login successful.';
    }

    await loadCurrentUser();

    showDashboard();

  } catch (error) {

    console.error(
      'LOGIN ERROR:',
      error
    );

    if (status) {

      let prefix;

      if (getLanguage() === 'ru') {
        prefix = 'Ошибка входа: ';
      } else if (getLanguage() === 'uz') {
        prefix = 'Kirishda xatolik: ';
      } else {
        prefix = 'Login failed: ';
      }

      status.textContent =
        prefix + error.message;
    }
  }
}


/* =========================================================
   LOGIN FORM EVENT
========================================================= */

function bindLoginForm() {

  const form =
    $('loginForm');

  if (!form) {
    console.error(
      'loginForm not found'
    );
    return;
  }

  form.addEventListener(
    'submit',
    function (event) {

      event.preventDefault();

      login();
    }
  );
}


/* =========================================================
   CURRENT USER
========================================================= */

async function loadCurrentUser() {

  try {

    const data =
      await api('/auth/me');

    state.user = data;

    updateUserUI();

    return data;

  } catch (error) {

    console.error(
      'AUTH ME ERROR:',
      error
    );

    return null;
  }
}


/* =========================================================
   USER UI
========================================================= */

function updateUserUI() {

  if (!state.user) {
    return;
  }

  const role =
    state.user.role ||
    state.user.user_role ||
    state.user.type ||
    'GUEST';

  const badge =
    $('roleBadge');

  if (badge) {
    badge.textContent =
      String(role).toUpperCase();
  }
}


/* =========================================================
   DASHBOARD
========================================================= */

function showDashboard() {

  const loginView =
    $('loginView');

  const dashboardView =
    $('dashboardView');

  if (loginView) {
    loginView.classList.add(
      'hidden'
    );
  }

  if (dashboardView) {
    dashboardView.classList.remove(
      'hidden'
    );
  }

  checkHealth();
}


/* =========================================================
   LOGOUT
========================================================= */

function logout() {

  state.token = '';
  state.user = null;

  sessionStorage.removeItem(
    TOKEN_KEY
  );

  const dashboardView =
    $('dashboardView');

  const loginView =
    $('loginView');

  if (dashboardView) {
    dashboardView.classList.add(
      'hidden'
    );
  }

  if (loginView) {
    loginView.classList.remove(
      'hidden'
    );
  }

  const password =
    $('loginPassword');

  if (password) {
    password.value = '';
  }

  const status =
    $('loginStatus');

  if (status) {
    status.textContent = '';
  }
}


/* =========================================================
   HEALTH
========================================================= */

async function checkHealth() {

  const text =
    $('apiText');

  const badge =
    $('healthBadge');

  try {

    await api('/health/live');

    if (text) {
      text.textContent =
        getLanguage() === 'ru'
          ? 'онлайн'
          : getLanguage() === 'uz'
            ? 'online'
            : 'online';
    }

    if (badge) {
      badge.textContent =
        getLanguage() === 'ru'
          ? 'API: онлайн'
          : getLanguage() === 'uz'
            ? 'API: online'
            : 'API: online';
    }

  } catch (error) {

    if (text) {
      text.textContent =
        getLanguage() === 'ru'
          ? 'офлайн'
          : getLanguage() === 'uz'
            ? 'offline'
            : 'offline';
    }

    if (badge) {
      badge.textContent =
        getLanguage() === 'ru'
          ? 'API: офлайн'
          : getLanguage() === 'uz'
            ? 'API: offline'
            : 'API: offline';
    }
  }
}


/* =========================================================
   WORKSPACE
========================================================= */

function openWorkspace(title) {

  const workspace =
    $('workspace');

  const workspaceTitle =
    $('workspaceTitle');

  if (workspace) {
    workspace.classList.remove(
      'hidden'
    );
  }

  if (workspaceTitle) {
    workspaceTitle.textContent =
      title;
  }
}


function closeWorkspace() {

  const workspace =
    $('workspace');

  if (workspace) {
    workspace.classList.add(
      'hidden'
    );
  }

  document
    .querySelectorAll('.tool')
    .forEach(
      (tool) => {
        tool.classList.add(
          'hidden'
        );
      }
    );
}


/* =========================================================
   MODULES
========================================================= */

function openModule(moduleName) {

  openWorkspace(
    moduleName
  );

  document
    .querySelectorAll('.tool')
    .forEach(
      (tool) => {
        tool.classList.add(
          'hidden'
        );
      }
    );

  const map = {

    'Molecular Analysis':
      'molecularTool',

    'Bioinformatics':
      'bioTool',

    'PDB & Structure':
      'pdbTool',

    'Drug Discovery':
      'discoveryTool',

    'Scientific Jobs':
      'jobsTool',

    'Research Assistant':
      'researchTool',

    'Virtual Laboratory':
      'workflowTool',

    'Reports & History':
      'reportsTool'
  };

  const toolId =
    map[moduleName];

  if (toolId) {

    const tool =
      $(toolId);

    if (tool) {
      tool.classList.remove(
        'hidden'
      );
    }
  }

  if (
    moduleName ===
    'Scientific Jobs'
  ) {
    loadJobs();
  }

  if (
    moduleName ===
    'Reports & History'
  ) {
    loadReports();
  }

  if (
    moduleName ===
    'Virtual Laboratory'
  ) {
    loadWorkflows();
  }
}


/* =========================================================
   MOLECULAR ANALYSIS
========================================================= */

async function analyzeMolecule() {

  const smiles =
    $('smilesInput')?.value?.trim() || '';

  const status =
    $('molecularStatus');

  const result =
    $('molecularResult');

  if (!smiles) {

    if (status) {
      status.textContent =
        'SMILES required.';
    }

    return;
  }

  if (status) {
    status.textContent =
      getLanguage() === 'uz'
        ? 'Tahlil qilinmoqda...'
        : getLanguage() === 'ru'
          ? 'Анализ выполняется...'
          : 'Analyzing...';
  }

  try {

    const data =
      await api(
        '/molecules/analyze',
        {
          method: 'POST',
          body: JSON.stringify({
            smiles
          })
        }
      );

    if (result) {
      result.textContent =
        JSON.stringify(
          data,
          null,
          2
        );
    }

    if (status) {
      status.textContent =
        getLanguage() === 'uz'
          ? 'Tahlil tugadi.'
          : getLanguage() === 'ru'
            ? 'Анализ завершён.'
            : 'Analysis completed.';
    }

  } catch (error) {

    if (status) {
      status.textContent =
        error.message;
    }
  }
}


/* =========================================================
   BIOINFORMATICS
========================================================= */

async function runBioinformatics() {

  const sequence =
    $('bioSequence')?.value?.trim() || '';

  const status =
    $('bioStatus');

  const result =
    $('bioResult');

  if (!sequence) {

    if (status) {
      status.textContent =
        getLanguage() === 'uz'
          ? 'Ketma-ketlikni kiriting.'
          : getLanguage() === 'ru'
            ? 'Введите последовательность.'
            : 'Enter a sequence.';
    }

    return;
  }

  if (status) {
    status.textContent =
      getLanguage() === 'uz'
        ? 'Tahlil qilinmoqda...'
        : getLanguage() === 'ru'
          ? 'Анализ выполняется...'
          : 'Analyzing...';
  }

  try {

    const data =
      await api(
        '/bioinformatics/analyze',
        {
          method: 'POST',
          body: JSON.stringify({
            sequence
          })
        }
      );

    if (result) {
      result.textContent =
        JSON.stringify(
          data,
          null,
          2
        );
    }

    if (status) {
      status.textContent =
        getLanguage() === 'uz'
          ? 'Tayyor.'
          : getLanguage() === 'ru'
            ? 'Готово.'
            : 'Done.';
    }

  } catch (error) {

    if (status) {
      status.textContent =
        error.message;
    }
  }
}


/* =========================================================
   PDB
========================================================= */

async function loadPDB() {

  const pdbId =
    $('pdbInput')?.value?.trim() || '';

  const status =
    $('pdbStatus');

  const result =
    $('pdbResult');

  if (!pdbId) {

    if (status) {
      status.textContent =
        'PDB ID required.';
    }

    return;
  }

  try {

    if (status) {
      status.textContent =
        getLanguage() === 'uz'
          ? 'Yuklanmoqda...'
          : getLanguage() === 'ru'
            ? 'Загрузка...'
            : 'Loading...';
    }

    const data =
      await api(
        `/pdb/structures/${encodeURIComponent(pdbId)}`
      );

    if (result) {
      result.textContent =
        JSON.stringify(
          data,
          null,
          2
        );
    }

    if (status) {
      status.textContent =
        getLanguage() === 'uz'
          ? 'Yuklandi.'
          : getLanguage() === 'ru'
            ? 'Загружено.'
            : 'Loaded.';
    }

  } catch (error) {

    if (status) {
      status.textContent =
        error.message;
    }
  }
}


/* =========================================================
   DRUG DISCOVERY
========================================================= */

async function createDiscoverySession() {

  const target =
    $('discoveryTarget')?.value?.trim() || '';

  const status =
    $('discoveryStatus');

  const result =
    $('discoveryResult');

  if (!target) {

    if (status) {
      status.textContent =
        getLanguage() === 'uz'
          ? 'Nishonni kiriting.'
          : getLanguage() === 'ru'
            ? 'Введите мишень.'
            : 'Enter a target.';
    }

    return;
  }

  try {

    const data =
      await api(
        '/discovery/screen',
        {
          method: 'POST',
          body: JSON.stringify({
            target
          })
        }
      );

    if (result) {
      result.textContent =
        JSON.stringify(
          data,
          null,
          2
        );
    }

  } catch (error) {

    if (status) {
      status.textContent =
        error.message;
    }
  }
}


/* =========================================================
   JOB STATUS
========================================================= */

async function loadJobStatus() {

  const status =
    $('jobsStatus');

  try {

    const data =
      await api(
        '/jobs/status'
      );

    if (status) {

      const worker =
        data?.worker ||
        'development';

      const queue =
        data?.queue ||
        'ready';

      const active =
        data?.active ??
        0;

      status.textContent =
        `Worker: ${worker} | Queue: ${queue} | Active: ${active}`;
    }

  } catch (error) {

    if (status) {
      status.textContent =
        error.message;
    }
  }
}


/* =========================================================
   JOBS
========================================================= */

async function loadJobs() {

  const result =
    $('jobsResult');

  if (result) {
    result.textContent =
      getLanguage() === 'uz'
        ? 'Yuklanmoqda...'
        : getLanguage() === 'ru'
          ? 'Загрузка...'
          : 'Loading...';
  }

  try {

    const data =
      await api('/jobs');

    const jobs =
      data?.jobs || [];

    if (!jobs.length) {

      if (result) {

        result.textContent =
          getLanguage() === 'uz'
            ? 'Hozircha ilmiy vazifalar mavjud emas.'
            : getLanguage() === 'ru'
              ? 'На данный момент научных задач нет.'
              : 'No scientific jobs available yet.';
      }

      return;
    }

    if (result) {
      result.textContent =
        JSON.stringify(
          data,
          null,
          2
        );
    }

  } catch (error) {

    if (result) {
      result.textContent =
        error.message;
    }
  }

  loadJobStatus();
}


/* =========================================================
   CREATE JOB
========================================================= */

async function createJob() {

  const jobType =
    $('jobType')?.value ||
    'MOLECULAR';

  const status =
    $('jobCreateStatus');

  const result =
    $('jobCreateResult');

  try {

    const data =
      await api(
        '/jobs',
        {
          method: 'POST',
          body: JSON.stringify({
            type: jobType
          })
        }
      );

    if (status) {
      status.textContent =
        getLanguage() === 'uz'
          ? 'Vazifa yaratildi.'
          : getLanguage() === 'ru'
            ? 'Задача создана.'
            : 'Job created.';
    }

    if (result) {
      result.textContent =
        JSON.stringify(
          data,
          null,
          2
        );
    }

    loadJobs();

  } catch (error) {

    if (status) {
      status.textContent =
        error.message;
    }
  }
}


/* =========================================================
   REPORTS
========================================================= */

async function loadReports() {

  const status =
    $('reportsStatus');

  const result =
    $('reportsResult');

  try {

    if (status) {
      status.textContent =
        getLanguage() === 'uz'
          ? 'Yuklanmoqda...'
          : getLanguage() === 'ru'
            ? 'Загрузка...'
            : 'Loading...';
    }

    const data =
      await api('/reports');

    const reports =
      data?.reports || [];

    if (!reports.length) {

      if (result) {

        result.textContent =
          getLanguage() === 'uz'
            ? 'Hozircha hisobotlar mavjud emas.'
            : getLanguage() === 'ru'
              ? 'Отчётов пока нет.'
              : 'No reports available yet.';
      }

    } else {

      if (result) {
        result.textContent =
          JSON.stringify(
            data,
            null,
            2
          );
      }
    }

    if (status) {
      status.textContent =
        getLanguage() === 'uz'
          ? 'Yuklandi.'
          : getLanguage() === 'ru'
            ? 'Загружено.'
            : 'Loaded.';
    }

  } catch (error) {

    if (status) {
      status.textContent =
        error.message;
    }
  }
}


/* =========================================================
   WORKFLOWS
========================================================= */

async function loadWorkflows() {

  const result =
    $('workflowResult');

  const status =
    $('workflowStatus');

  try {

    const data =
      await api('/workflows');

    if (result) {
      result.textContent =
        JSON.stringify(
          data,
          null,
          2
        );
    }

    if (status) {
      status.textContent =
        getLanguage() === 'uz'
          ? 'Yuklandi.'
          : getLanguage() === 'ru'
            ? 'Загружено.'
            : 'Loaded.';
    }

  } catch (error) {

    if (status) {
      status.textContent =
        error.message;
    }
  }
}


/* =========================================================
   RESEARCH
========================================================= */

async function searchResearch() {

  const query =
    $('researchQuery')?.value?.trim() || '';

  const status =
    $('researchStatus');

  const result =
    $('researchResult');

  if (!query) {
    return;
  }

  try {

    if (status) {
      status.textContent =
        getLanguage() === 'uz'
          ? 'Qidirilmoqda...'
          : getLanguage() === 'ru'
            ? 'Поиск...'
            : 'Searching...';
    }

    const data =
      await api(
        '/research/search',
        {
          method: 'POST',
          body: JSON.stringify({
            query
          })
        }
      );

    if (result) {
      result.textContent =
        JSON.stringify(
          data,
          null,
          2
        );
    }

  } catch (error) {

    if (status) {
      status.textContent =
        error.message;
    }
  }
}


/* =========================================================
   EVENT BINDING
========================================================= */

function bindEvents() {

  const loginForm =
    $('loginForm');

  if (loginForm) {
    loginForm.addEventListener(
      'submit',
      function (event) {
        event.preventDefault();
        login();
      }
    );
  }


  const logoutBtn =
    $('logoutBtn');

  if (logoutBtn) {
    logoutBtn.addEventListener(
      'click',
      logout
    );
  }


  const workspaceClose =
    $('workspaceClose');

  if (workspaceClose) {
    workspaceClose.addEventListener(
      'click',
      closeWorkspace
    );
  }


  document
    .querySelectorAll('.module')
    .forEach(
      (button) => {

        button.addEventListener(
          'click',
          () => {

            openModule(
              button.dataset.module
            );
          }
        );
      }
    );


  const molecularRun =
    $('molecularRun');

  if (molecularRun) {
    molecularRun.addEventListener(
      'click',
      analyzeMolecule
    );
  }


  const bioRun =
    $('bioRun');

  if (bioRun) {
    bioRun.addEventListener(
      'click',
      runBioinformatics
    );
  }


  const pdbRun =
    $('pdbRun');

  if (pdbRun) {
    pdbRun.addEventListener(
      'click',
      loadPDB
    );
  }


  const discoveryRun =
    $('discoveryRun');

  if (discoveryRun) {
    discoveryRun.addEventListener(
      'click',
      createDiscoverySession
    );
  }


  const jobCreate =
    $('jobCreate');

  if (jobCreate) {
    jobCreate.addEventListener(
      'click',
      createJob
    );
  }


  const jobsRefresh =
    $('jobsRefresh');

  if (jobsRefresh) {
    jobsRefresh.addEventListener(
      'click',
      loadJobs
    );
  }


  const reportsRefresh =
    $('reportsRefresh');

  if (reportsRefresh) {
    reportsRefresh.addEventListener(
      'click',
      loadReports
    );
  }


  const workflowRefresh =
    $('workflowRefresh');

  if (workflowRefresh) {
    workflowRefresh.addEventListener(
      'click',
      loadWorkflows
    );
  }


  const researchRun =
    $('researchRun');

  if (researchRun) {
    researchRun.addEventListener(
      'click',
      searchResearch
    );
  }
}


/* =========================================================
   INITIALIZATION
========================================================= */

async function init() {

  bindEvents();

  /*
   * IMPORTANT:
   * Login language selector is handled by index.html.
   * We only synchronize UI after initialization.
   */

  if (state.token) {

    const user =
      await loadCurrentUser();

    if (user) {

      showDashboard();

    } else {

      state.token = '';

      sessionStorage.removeItem(
        TOKEN_KEY
      );
    }
  }
}


/* =========================================================
   GLOBAL ACCESS
========================================================= */

window.login =
  login;

window.logout =
  logout;

window.openModule =
  openModule;

window.checkHealth =
  checkHealth;

window.loadJobs =
  loadJobs;

window.createJob =
  createJob;

window.loadReports =
  loadReports;

window.loadWorkflows =
  loadWorkflows;

window.analyzeMolecule =
  analyzeMolecule;

window.runBioinformatics =
  runBioinformatics;

window.loadPDB =
  loadPDB;

window.searchResearch =
  searchResearch;


/* =========================================================
   START
========================================================= */

if (
  document.readyState === 'loading'
) {

  document.addEventListener(
    'DOMContentLoaded',
    init
  );

} else {

  init();
}
