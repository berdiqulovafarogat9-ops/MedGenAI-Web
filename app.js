/* =========================================================
   MEDGEN AI — APP.JS
   EN / UZ / RU
   Dynamic result translation + Drug Discovery fix
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

const $ = (id) => document.getElementById(id);

function getLanguage() {
  return localStorage.getItem('medgen_language') || 'uz';
}

function setText(id, text) {
  const el = $(id);
  if (el) el.textContent = text;
}

function t(key) {
  const lang = getLanguage();

  const dictionary = {

    en: {
      loading: 'Loading...',
      analyzing: 'Analyzing...',
      analysisCompleted: 'Analysis completed.',
      sequenceCompleted: 'Sequence analysis completed.',
      loaded: 'Loaded.',
      done: 'Done.',
      searching: 'Searching...',
      loginSuccessful: 'Login successful.',
      signingIn: 'Signing in...',
      loginFailed: 'Login failed: ',
      enterCredentials: 'Enter username and password.',
      usernameRequired: 'Username required.',
      passwordRequired: 'Password required.',
      sequenceRequired: 'Enter a sequence.',
      pdbRequired: 'PDB ID required.',
      targetRequired: 'Enter a target.',
      moleculeRequired: 'Enter at least one molecule.',
      noJobs: 'No scientific jobs available yet.',
      noReports: 'No reports available yet.',
      noWorkflows: 'No workflows available yet.',
      noResearch: 'No research results available.',
      jobCreated: 'Job created.',
      jobLoading: 'Loading scientific jobs...',
      reportLoading: 'Loading reports...',
      workflowLoading: 'Loading workflows...',
      online: 'online',
      offline: 'offline',
      apiOnline: 'API: online',
      apiOffline: 'API: offline',
      workflowsCount: 'Workflows',
      jobsCount: 'Jobs',
      reportsCount: 'Reports',
      searchCompleted: 'Search completed.',
      discoveryCompleted: 'Virtual screening completed.',
      discoveryLoading: 'Running virtual screening...',
      moleculeAnalysis: 'Molecular Analysis',
      bioinformatics: 'Bioinformatics',
      pdbStructure: 'PDB & Structure',
      drugDiscovery: 'Drug Discovery',
      scientificJobs: 'Scientific Jobs',
      researchAssistant: 'Research Assistant',
      virtualLaboratory: 'Virtual Laboratory',
      reportsHistory: 'Reports & History'
    },

    uz: {
      loading: 'Yuklanmoqda...',
      analyzing: 'Tahlil qilinmoqda...',
      analysisCompleted: 'Tahlil tugadi.',
      sequenceCompleted: 'Ketma-ketlik tahlili tugadi.',
      loaded: 'Yuklandi.',
      done: 'Tayyor.',
      searching: 'Qidirilmoqda...',
      loginSuccessful: 'Tizimga muvaffaqiyatli kirildi.',
      signingIn: 'Tizimga kirilmoqda...',
      loginFailed: 'Kirishda xatolik: ',
      enterCredentials: 'Foydalanuvchi nomi va parolni kiriting.',
      usernameRequired: 'Foydalanuvchi nomini kiriting.',
      passwordRequired: 'Parolni kiriting.',
      sequenceRequired: 'Ketma-ketlikni kiriting.',
      pdbRequired: 'PDB ID kiriting.',
      targetRequired: 'Nishonni kiriting.',
      moleculeRequired: 'Kamida bitta molekula kiriting.',
      noJobs: 'Hozircha ilmiy vazifalar mavjud emas.',
      noReports: 'Hozircha hisobotlar mavjud emas.',
      noWorkflows: 'Hozircha workflowlar mavjud emas.',
      noResearch: 'Hozircha tadqiqot natijalari mavjud emas.',
      jobCreated: 'Vazifa yaratildi.',
      jobLoading: 'Ilmiy vazifalar yuklanmoqda...',
      reportLoading: 'Hisobotlar yuklanmoqda...',
      workflowLoading: 'Workflowlar yuklanmoqda...',
      online: 'online',
      offline: 'offline',
      apiOnline: 'API: online',
      apiOffline: 'API: offline',
      workflowsCount: 'Workflowlar soni',
      jobsCount: 'Vazifalar soni',
      reportsCount: 'Hisobotlar soni',
      searchCompleted: 'Qidiruv tugadi.',
      discoveryCompleted: 'Virtual screening tugadi.',
      discoveryLoading: 'Virtual screening bajarilmoqda...',
      moleculeAnalysis: 'Molekulyar tahlil',
      bioinformatics: 'Bioinformatika',
      pdbStructure: 'PDB va struktura',
      drugDiscovery: 'Dori vositalarini kashf qilish',
      scientificJobs: 'Ilmiy vazifalar',
      researchAssistant: 'Tadqiqot yordamchisi',
      virtualLaboratory: 'Virtual laboratoriya',
      reportsHistory: 'Hisobotlar va tarix'
    },

    ru: {
      loading: 'Загрузка...',
      analyzing: 'Выполняется анализ...',
      analysisCompleted: 'Анализ завершён.',
      sequenceCompleted: 'Анализ последовательности завершён.',
      loaded: 'Загружено.',
      done: 'Готово.',
      searching: 'Поиск...',
      loginSuccessful: 'Вход выполнен.',
      signingIn: 'Выполняется вход...',
      loginFailed: 'Ошибка входа: ',
      enterCredentials: 'Введите имя пользователя и пароль.',
      usernameRequired: 'Введите имя пользователя.',
      passwordRequired: 'Введите пароль.',
      sequenceRequired: 'Введите последовательность.',
      pdbRequired: 'Введите PDB ID.',
      targetRequired: 'Введите мишень.',
      moleculeRequired: 'Введите хотя бы одну молекулу.',
      noJobs: 'На данный момент научных задач нет.',
      noReports: 'Отчётов пока нет.',
      noWorkflows: 'Пока нет доступных workflow.',
      noResearch: 'Результатов исследований пока нет.',
      jobCreated: 'Задача создана.',
      jobLoading: 'Загрузка научных задач...',
      reportLoading: 'Загрузка отчётов...',
      workflowLoading: 'Загрузка workflow...',
      online: 'онлайн',
      offline: 'офлайн',
      apiOnline: 'API: онлайн',
      apiOffline: 'API: офлайн',
      workflowsCount: 'Количество workflow',
      jobsCount: 'Количество задач',
      reportsCount: 'Количество отчётов',
      searchCompleted: 'Поиск завершён.',
      discoveryCompleted: 'Виртуальный скрининг завершён.',
      discoveryLoading: 'Выполняется виртуальный скрининг...',
      moleculeAnalysis: 'Молекулярный анализ',
      bioinformatics: 'Биоинформатика',
      pdbStructure: 'PDB и структура',
      drugDiscovery: 'Поиск лекарственных средств',
      scientificJobs: 'Научные задачи',
      researchAssistant: 'Исследовательский помощник',
      virtualLaboratory: 'Виртуальная лаборатория',
      reportsHistory: 'Отчёты и история'
    }

  };

  return dictionary[lang]?.[key] ||
         dictionary.en[key] ||
         key;
}


/* =========================================================
   RESULT TRANSLATION
========================================================= */

function translateValue(value) {

  const lang = getLanguage();

  if (typeof value === 'string') {

    const translations = {

      'completed': {
        uz: 'tugallandi',
        ru: 'завершено',
        en: 'completed'
      },

      'online': {
        uz: 'online',
        ru: 'онлайн',
        en: 'online'
      },

      'offline': {
        uz: 'offline',
        ru: 'офлайн',
        en: 'offline'
      },

      'Basic molecular analysis completed.': {
        uz: 'Asosiy molekulyar tahlil tugallandi.',
        ru: 'Базовый молекулярный анализ завершён.',
        en: 'Basic molecular analysis completed.'
      },

      'Sequence analysis completed.': {
        uz: 'Ketma-ketlik tahlili tugallandi.',
        ru: 'Анализ последовательности завершён.',
        en: 'Sequence analysis completed.'
      },

      'No scientific jobs available yet.': {
        uz: 'Hozircha ilmiy vazifalar mavjud emas.',
        ru: 'На данный момент научных задач нет.',
        en: 'No scientific jobs available yet.'
      },

      'No reports available yet.': {
        uz: 'Hozircha hisobotlar mavjud emas.',
        ru: 'Отчётов пока нет.',
        en: 'No reports available yet.'
      },

      'No workflows available yet.': {
        uz: 'Hozircha workflowlar mavjud emas.',
        ru: 'Пока нет доступных workflow.',
        en: 'No workflows available yet.'
      },

      'Virtual screening completed.': {
        uz: 'Virtual screening tugallandi.',
        ru: 'Виртуальный скрининг завершён.',
        en: 'Virtual screening completed.'
      },

      'Search completed.': {
        uz: 'Qidiruv tugallandi.',
        ru: 'Поиск завершён.',
        en: 'Search completed.'
      }
    };

    if (translations[value]) {
      return translations[value][lang] ||
             translations[value].en;
    }

    return value;
  }

  if (Array.isArray(value)) {
    return value.map(item =>
      translateValue(item)
    );
  }

  if (
    value !== null &&
    typeof value === 'object'
  ) {

    const result = {};

    for (const key in value) {
      result[key] =
        translateValue(value[key]);
    }

    return result;
  }

  return value;
}


/* =========================================================
   RESULT RENDER
========================================================= */

function renderResult(element, data) {

  if (!element) return;

  const translated =
    translateValue(data);

  element.textContent =
    JSON.stringify(
      translated,
      null,
      2
    );
}


/* =========================================================
   MODULE TITLE
========================================================= */

function translateModuleTitle(name) {

  const map = {
    'Molecular Analysis': 'moleculeAnalysis',
    'Bioinformatics': 'bioinformatics',
    'PDB & Structure': 'pdbStructure',
    'Drug Discovery': 'drugDiscovery',
    'Scientific Jobs': 'scientificJobs',
    'Research Assistant': 'researchAssistant',
    'Virtual Laboratory': 'virtualLaboratory',
    'Reports & History': 'reportsHistory'
  };

  return map[name]
    ? t(map[name])
    : name;
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

  if (!state.user) return;

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
    loginView.classList.add('hidden');
  }

  if (dashboardView) {
    dashboardView.classList.remove('hidden');
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
    dashboardView.classList.add('hidden');
  }

  if (loginView) {
    loginView.classList.remove('hidden');
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
    workspace.classList.remove('hidden');
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
    workspace.classList.add('hidden');
  }

  document
    .querySelectorAll('.tool')
    .forEach(tool => {
      tool.classList.add('hidden');
    });
}


/* =========================================================
   MODULES
========================================================= */

function openModule(moduleName) {

  openWorkspace(moduleName);

  document
    .querySelectorAll('.tool')
    .forEach(tool => {
      tool.classList.add('hidden');
    });

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
      tool.classList.remove('hidden');
    }
  }

  if (moduleName === 'Scientific Jobs') {
    loadJobs();
  }

  if (moduleName === 'Reports & History') {
    loadReports();
  }

  if (moduleName === 'Virtual Laboratory') {
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
      t('analyzing');
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

    renderResult(
      result,
      data
    );

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
          body: JSON.stringify({
            sequence
          })
        }
      );

    renderResult(
      result,
      data
    );

    if (status) {
      status.textContent =
        t('sequenceCompleted');
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

    renderResult(
      result,
      data
    );

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
   DRUG DISCOVERY / VIRTUAL SCREENING
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

  /*
   * The backend requires at least one molecule.
   *
   * We use a SMILES molecule here.
   * The user can enter a molecule in the same
   * discovery field using:
   *
   * Target | Molecule
   *
   * Example:
   * EGFR | CCO
   */

  let targetValue = target;
  let molecule = '';

  if (target.includes('|')) {

    const parts =
      target
        .split('|')
        .map(x => x.trim());

    targetValue =
      parts[0] || '';

    molecule =
      parts[1] || '';
  }

  if (!molecule) {

    /*
     * Default valid test molecule.
     * CCO = ethanol.
     */
    molecule = 'CCO';
  }

  if (status) {
    status.textContent =
      t('discoveryLoading');
  }

  try {

    const data =
      await api(
        '/discovery/screen',
        {
          method: 'POST',
          body: JSON.stringify({
            target: targetValue,
            molecules: [molecule]
          })
        }
      );

    renderResult(
      result,
      data
    );

    if (status) {
      status.textContent =
        t('discoveryCompleted');
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
      await api('/jobs/status');

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
        `${worker} | ${queue} | ${t('jobsCount')}: ${active}`;
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
      t('jobLoading');
  }

  try {

    const data =
      await api('/jobs');

    const jobs =
      data?.jobs || [];

    if (!jobs.length) {

      if (result) {
        result.textContent =
          t('noJobs');
      }

      return;
    }

    renderResult(
      result,
      data
    );

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
        t('jobCreated');
    }

    renderResult(
      result,
      data
    );

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
        t('reportLoading');
    }

    const data =
      await api('/reports');

    const reports =
      data?.reports || [];

    if (!reports.length) {

      if (result) {
        result.textContent =
          t('noReports');
      }

    } else {

      renderResult(
        result,
        data
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
   WORKFLOWS
========================================================= */

async function loadWorkflows() {

  const result =
    $('workflowResult');

  const status =
    $('workflowStatus');

  try {

    if (status) {
      status.textContent =
        t('workflowLoading');
    }

    const data =
      await api('/workflows');

    const workflows =
      data?.workflows || [];

    if (!workflows.length) {

      if (result) {
        result.textContent =
          t('noWorkflows');
      }

    } else {

      renderResult(
        result,
        data
      );
    }

    if (status) {

      const count =
        workflows.length;

      const label =
        t('workflowsCount');

      status.textContent =
        `${label}: ${count}`;
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
        t('searching');
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

    renderResult(
      result,
      data
    );

    if (status) {
      status.textContent =
        t('searchCompleted');
    }

  } catch (error) {

    if (status) {
      status.textContent =
        error.message;
    }
  }
}


/* =========================================================
   REFRESH DYNAMIC UI
========================================================= */

function refreshDynamicUI() {

  /*
   * Re-render current visible results using
   * the currently selected language.
   *
   * Existing raw API objects are not stored,
   * therefore statuses are refreshed here.
   */

  checkHealth();

  const workspace =
    $('workspace');

  if (
    workspace &&
    !workspace.classList.contains('hidden')
  ) {

    const activeTool =
      document.querySelector(
        '.tool:not(.hidden)'
      );

    if (activeTool) {

      const toolToModule = {

        molecularTool:
          'Molecular Analysis',

        bioTool:
          'Bioinformatics',

        pdbTool:
          'PDB & Structure',

        discoveryTool:
          'Drug Discovery',

        jobsTool:
          'Scientific Jobs',

        researchTool:
          'Research Assistant',

        workflowTool:
          'Virtual Laboratory',

        reportsTool:
          'Reports & History'
      };

      const moduleName =
        toolToModule[
          activeTool.id
        ];

      if (moduleName) {
        openWorkspace(moduleName);
      }
    }
  }
}


/* =========================================================
   LANGUAGE SELECTORS
========================================================= */

function bindLanguageSelectors() {

  const selectors = [
    $('loginLanguageSelector'),
    $('languageSelector')
  ];

  selectors.forEach(selector => {

    if (!selector) return;

    selector.value =
      getLanguage();

    selector.addEventListener(
      'change',
      function () {

        const lang =
          this.value || 'uz';

        localStorage.setItem(
          'medgen_language',
          lang
        );

        selectors.forEach(other => {

          if (other) {
            other.value = lang;
          }
        });

        refreshDynamicUI();
      }
    );
  });
}


/* =========================================================
   EVENTS
========================================================= */

function bindEvents() {

  const loginForm =
    $('loginForm');

  if (loginForm) {

    loginForm.addEventListener(
      'submit',
      function(event) {

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
    .forEach(button => {

      button.addEventListener(
        'click',
        () => {

          openModule(
            button.dataset.module
          );
        }
      );
    });


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


  bindLanguageSelectors();
}


/* =========================================================
   INITIALIZATION
========================================================= */

async function init() {

  bindEvents();

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
