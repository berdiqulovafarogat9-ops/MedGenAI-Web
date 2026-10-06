/* =========================================================
   MEDGEN AI — APP.JS
   Multilingual Dynamic UI
   EN / UZ / RU
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
   DYNAMIC TRANSLATIONS
   ========================================================= */

const dynamicTranslations = {

  en: {

    enterCredentials:
      'Enter username and password.',

    signingIn:
      'Signing in...',

    loginSuccessful:
      'Login successful.',

    loginFailed:
      'Login failed: ',

    apiOnline:
      'API: online',

    apiOffline:
      'API: offline',

    online:
      'online',

    offline:
      'offline',

    analyzing:
      'Analyzing...',

    analysisCompleted:
      'Analysis completed.',

    sequenceRequired:
      'Enter a sequence.',

    done:
      'Done.',

    pdbRequired:
      'PDB ID required.',

    loading:
      'Loading...',

    loaded:
      'Loaded.',

    targetRequired:
      'Enter a target.',

    searching:
      'Searching...',

    jobCreated:
      'Job created.',

    jobsLoading:
      'Loading scientific jobs...',

    noJobs:
      'No scientific jobs available yet.',

    reportsLoading:
      'Loading reports...',

    noReports:
      'No reports available yet.',

    workflowsLoading:
      'Loading workflows...',

    noWorkflows:
      'No workflows available yet.',

    workflowsCount:
      'Workflows: ',

    researchEmpty:
      'No research results found.',

    molecularAnalysis:
      'Molecular Analysis',

    bioinformatics:
      'Bioinformatics',

    pdbStructure:
      'PDB & Structure',

    drugDiscovery:
      'Drug Discovery',

    scientificJobs:
      'Scientific Jobs',

    researchAssistant:
      'Research Assistant',

    virtualLaboratory:
      'Virtual Laboratory',

    reportsHistory:
      'Reports & History',

    worker:
      'Worker',

    queue:
      'Queue',

    active:
      'Active'
  },


  uz: {

    enterCredentials:
      'Foydalanuvchi nomi va parolni kiriting.',

    signingIn:
      'Tizimga kirilmoqda...',

    loginSuccessful:
      'Tizimga muvaffaqiyatli kirildi.',

    loginFailed:
      'Kirishda xatolik: ',

    apiOnline:
      'API: online',

    apiOffline:
      'API: offline',

    online:
      'online',

    offline:
      'offline',

    analyzing:
      'Tahlil qilinmoqda...',

    analysisCompleted:
      'Tahlil tugadi.',

    sequenceRequired:
      'Ketma-ketlikni kiriting.',

    done:
      'Tayyor.',

    pdbRequired:
      'PDB ID kiriting.',

    loading:
      'Yuklanmoqda...',

    loaded:
      'Yuklandi.',

    targetRequired:
      'Nishonni kiriting.',

    searching:
      'Qidirilmoqda...',

    jobCreated:
      'Vazifa yaratildi.',

    jobsLoading:
      'Ilmiy vazifalar yuklanmoqda...',

    noJobs:
      'Hozircha ilmiy vazifalar mavjud emas.',

    reportsLoading:
      'Hisobotlar yuklanmoqda...',

    noReports:
      'Hozircha hisobotlar mavjud emas.',

    workflowsLoading:
      'Workflowlar yuklanmoqda...',

    noWorkflows:
      'Hozircha workflowlar mavjud emas.',

    workflowsCount:
      'Workflowlar soni: ',

    researchEmpty:
      'Tadqiqot natijalari topilmadi.',

    molecularAnalysis:
      'Molekulyar tahlil',

    bioinformatics:
      'Bioinformatika',

    pdbStructure:
      'PDB va struktura',

    drugDiscovery:
      'Dori vositalarini kashf qilish',

    scientificJobs:
      'Ilmiy vazifalar',

    researchAssistant:
      'Tadqiqot yordamchisi',

    virtualLaboratory:
      'Virtual laboratoriya',

    reportsHistory:
      'Hisobotlar va tarix',

    worker:
      'Worker',

    queue:
      'Navbat',

    active:
      'Faol'
  },


  ru: {

    enterCredentials:
      'Введите имя пользователя и пароль.',

    signingIn:
      'Выполняется вход...',

    loginSuccessful:
      'Вход выполнен.',

    loginFailed:
      'Ошибка входа: ',

    apiOnline:
      'API: онлайн',

    apiOffline:
      'API: офлайн',

    online:
      'онлайн',

    offline:
      'офлайн',

    analyzing:
      'Анализ выполняется...',

    analysisCompleted:
      'Анализ завершён.',

    sequenceRequired:
      'Введите последовательность.',

    done:
      'Готово.',

    pdbRequired:
      'Введите PDB ID.',

    loading:
      'Загрузка...',

    loaded:
      'Загружено.',

    targetRequired:
      'Введите мишень.',

    searching:
      'Поиск...',

    jobCreated:
      'Задача создана.',

    jobsLoading:
      'Загрузка научных задач...',

    noJobs:
      'На данный момент научных задач нет.',

    reportsLoading:
      'Загрузка отчётов...',

    noReports:
      'Отчётов пока нет.',

    workflowsLoading:
      'Загрузка workflow...',

    noWorkflows:
      'Пока нет доступных workflow.',

    workflowsCount:
      'Количество workflow: ',

    researchEmpty:
      'Результаты исследований не найдены.',

    molecularAnalysis:
      'Молекулярный анализ',

    bioinformatics:
      'Биоинформатика',

    pdbStructure:
      'PDB и структура',

    drugDiscovery:
      'Разработка лекарств',

    scientificJobs:
      'Научные задачи',

    researchAssistant:
      'Исследовательский помощник',

    virtualLaboratory:
      'Виртуальная лаборатория',

    reportsHistory:
      'Отчёты и история',

    worker:
      'Worker',

    queue:
      'Очередь',

    active:
      'Активных'
  }

};


function t(key) {

  const language =
    getLanguage();

  return (
    dynamicTranslations[language]?.[key] ||
    dynamicTranslations.en[key] ||
    key
  );
}


/* =========================================================
   MODULE TITLES
   ========================================================= */

function translateModuleTitle(moduleName) {

  const map = {

    'Molecular Analysis':
      'molecularAnalysis',

    'Bioinformatics':
      'bioinformatics',

    'PDB & Structure':
      'pdbStructure',

    'Drug Discovery':
      'drugDiscovery',

    'Scientific Jobs':
      'scientificJobs',

    'Research Assistant':
      'researchAssistant',

    'Virtual Laboratory':
      'virtualLaboratory',

    'Reports & History':
      'reportsHistory'
  };

  const key =
    map[moduleName];

  return key
    ? t(key)
    : moduleName;
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

  const response =
    await fetch(
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

    data =
      await response.json();

  } else {

    const text =
      await response.text();

    data =
      text
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
        t('enterCredentials');
    }

    return;
  }

  if (status) {
    status.textContent =
      t('signingIn');
  }

  try {

    const data =
      await api(
        '/auth/login',
        {
          method: 'POST',

          body:
            JSON.stringify({
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

    state.token =
      token;

    sessionStorage.setItem(
      TOKEN_KEY,
      token
    );

    if (status) {
      status.textContent =
        t('loginSuccessful');
    }

    await loadCurrentUser();

    showDashboard();

  } catch (error) {

    console.error(
      'LOGIN ERROR:',
      error
    );

    if (status) {

      status.textContent =
        t('loginFailed') +
        error.message;
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

    state.user =
      data;

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

    await api(
      '/health/live'
    );

    if (text) {
      text.textContent =
        t('online');
    }

    if (badge) {
      badge.textContent =
        t('apiOnline');
    }

  } catch (error) {

    if (text) {
      text.textContent =
        t('offline');
    }

    if (badge) {
      badge.textContent =
        t('apiOffline');
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
      translateModuleTitle(title);
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
        getLanguage() === 'ru'
          ? 'Введите SMILES.'
          : getLanguage() === 'uz'
            ? 'SMILES kiriting.'
            : 'Enter SMILES.';
    }

    return;
  }

  if (status) {

    status.textContent =
      t('analyzing');
  }

  try {

    const data =
      await api(
        '/molecules/analyze',
        {
          method: 'POST',

          body:
            JSON.stringify({
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
        t('analysisCompleted');
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
        t('sequenceRequired');
    }

    return;
  }

  if (status) {

    status.textContent =
      t('analyzing');
  }

  try {

    const data =
      await api(
        '/bioinformatics/analyze',
        {
          method: 'POST',

          body:
            JSON.stringify({
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
        t('done');
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
        t('pdbRequired');
    }

    return;
  }

  try {

    if (status) {

      status.textContent =
        t('loading');
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
        t('loaded');
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
        t('targetRequired');
    }

    return;
  }

  if (status) {

    status.textContent =
      t('loading');
  }

  try {

    const data =
      await api(
        '/discovery/screen',
        {
          method: 'POST',

          body:
            JSON.stringify({
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

    if (status) {

      status.textContent =
        t('done');
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

      if (getLanguage() === 'ru') {

        status.textContent =
          `Worker: ${worker} | Очередь: ${queue} | Активных: ${active}`;

      } else if (
        getLanguage() === 'uz'
      ) {

        status.textContent =
          `Worker: ${worker} | Navbat: ${queue} | Faol: ${active}`;

      } else {

        status.textContent =
          `Worker: ${worker} | Queue: ${queue} | Active: ${active}`;
      }
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
      t('jobsLoading');
  }

  try {

    const data =
      await api(
        '/jobs'
      );

    const jobs =
      data?.jobs || [];

    if (!jobs.length) {

      if (result) {

        result.textContent =
          t('noJobs');
      }

      await loadJobStatus();

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

  if (status) {

    status.textContent =
      t('loading');
  }

  try {

    const data =
      await api(
        '/jobs',
        {
          method: 'POST',

          body:
            JSON.stringify({
              type: jobType
            })
        }
      );

    if (status) {

      status.textContent =
        t('jobCreated');
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
        t('reportsLoading');
    }

    const data =
      await api(
        '/reports'
      );

    const reports =
      data?.reports || [];

    if (!reports.length) {

      if (result) {

        result.textContent =
          t('noReports');
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
        t('loaded');
    }

  } catch (error) {

    if (status) {

      status.textContent =
        error.message;
    }
  }
}


/* =========================================================
   WORKFLOWS / VIRTUAL LABORATORY
========================================================= */

async function loadWorkflows() {

  const result =
    $('workflowResult');

  const status =
    $('workflowStatus');

  try {

    if (status) {

      status.textContent =
        t('workflowsLoading');
    }

    const data =
      await api(
        '/workflows'
      );

    const workflows =
      data?.workflows || [];

    /*
     * IMPORTANT:
     * Empty workflow list is NOT an API error.
     */

    if (!workflows.length) {

      if (result) {

        result.textContent =
          t('noWorkflows');
      }

      if (status) {

        const count =
          data?.count ?? 0;

        status.textContent =
          t('workflowsCount') +
          count;
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

    if (status) {

      status.textContent =
        t('loaded');
    }

  } catch (error) {

    if (status) {

      status.textContent =
        error.message;
    }

    if (result) {

      result.textContent =
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

    if (result) {

      result.textContent =
        t('researchEmpty');
    }

    return;
  }

  try {

    if (status) {

      status.textContent =
        t('searching');
    }

    const data =
      await api(
        '/research/search',
        {
          method: 'POST',

          body:
            JSON.stringify({
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

    if (status) {

      status.textContent =
        t('done');
    }

  } catch (error) {

    if (status) {

      status.textContent =
        error.message;
    }

    if (result) {

      result.textContent =
        error.message;
    }
  }
}


/* =========================================================
   REFRESH DYNAMIC TEXT
========================================================= */

function refreshDynamicUI() {

  /*
   * API status
   */
  const apiText =
    $('apiText');

  const healthBadge =
    $('healthBadge');

  if (apiText) {

    const current =
      apiText.textContent
        .toLowerCase();

    if (
      current.includes('online') ||
      current.includes('онлайн')
    ) {

      apiText.textContent =
        t('online');

    } else if (
      current.includes('offline') ||
      current.includes('офлайн')
    ) {

      apiText.textContent =
        t('offline');
    }
  }

  if (healthBadge) {

    const current =
      healthBadge.textContent
        .toLowerCase();

    if (
      current.includes('online') ||
      current.includes('онлайн')
    ) {

      healthBadge.textContent =
        t('apiOnline');

    } else if (
      current.includes('offline') ||
      current.includes('офлайн')
    ) {

      healthBadge.textContent =
        t('apiOffline');
    }
  }


  /*
   * Workspace title
   */
  const workspaceTitle =
    $('workspaceTitle');

  if (
    workspaceTitle &&
    !workspaceTitle.closest('.hidden')
  ) {

    const moduleButtons =
      document.querySelectorAll(
        '.module'
      );

    moduleButtons.forEach(
      (button) => {

        const original =
          button.dataset.module;

        if (
          original &&
          workspaceTitle.textContent ===
            translateModuleTitle(original)
        ) {

          workspaceTitle.textContent =
            translateModuleTitle(
              original
            );
        }
      }
    );
  }


  /*
   * Existing empty states
   */

  const jobsResult =
    $('jobsResult');

  if (jobsResult) {

    const text =
      jobsResult.textContent;

    if (
      text ===
        'No scientific jobs available yet.' ||
      text ===
        'Hozircha ilmiy vazifalar mavjud emas.' ||
      text ===
        'На данный момент научных задач нет.'
    ) {

      jobsResult.textContent =
        t('noJobs');
    }
  }


  const reportsResult =
    $('reportsResult');

  if (reportsResult) {

    const text =
      reportsResult.textContent;

    if (
      text ===
        'No reports available yet.' ||
      text ===
        'Hozircha hisobotlar mavjud emas.' ||
      text ===
        'Отчётов пока нет.'
    ) {

      reportsResult.textContent =
        t('noReports');
    }
  }


  const workflowResult =
    $('workflowResult');

  if (workflowResult) {

    const text =
      workflowResult.textContent;

    if (
      text ===
        'No workflows available yet.' ||
      text ===
        'Hozircha workflowlar mavjud emas.' ||
      text ===
        'Пока нет доступных workflow.'
    ) {

      workflowResult.textContent =
        t('noWorkflows');
    }
  }
}


/* =========================================================
   LANGUAGE SELECTOR
========================================================= */

function bindLanguageSelectors() {

  const selectors =
    [
      $('loginLanguageSelector'),
      $('languageSelector')
    ].filter(Boolean);

  selectors.forEach(
    (selector) => {

      selector.addEventListener(
        'change',
        function () {

          const language =
            selector.value;

          localStorage.setItem(
            'medgen_language',
            language
          );

          /*
           * index.html owns the main
           * static translation engine.
           *
           * We only refresh dynamic content.
           */

          setTimeout(
            refreshDynamicUI,
            0
          );
        }
      );
    }
  );
}


/* =========================================================
   EVENT BINDING
========================================================= */

function bindEvents() {

  bindLoginForm();

  bindLanguageSelectors();


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
   * index.html handles static
   * translation.
   */

  refreshDynamicUI();


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

window.refreshDynamicUI =
  refreshDynamicUI;


/* =========================================================
   START
========================================================= */

if (
  document.readyState ===
  'loading'
) {

  document.addEventListener(
    'DOMContentLoaded',
    init
  );

} else {

  init();
}
