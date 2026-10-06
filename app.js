const $ = (id) => document.getElementById(id);

const state = {
  token: sessionStorage.getItem('medgen_access_token') || '',
  user: null
};

const CONFIG = {
  apiBase:
    window.MEDGEN_API_BASE ||
    'https://medgenai-web-1.onrender.com/api/v1',
  tokenKey: 'medgen_access_token'
};


/* =========================================================
   TRANSLATIONS
========================================================= */

const LANG = {

  en: {
    noJobs: 'No scientific jobs available yet.',
    noReports: 'No reports available yet.',
    development: 'Development',
    ready: 'Ready',
    pending: 'Pending',
    running: 'Running',
    idle: 'Idle',
    unknown: 'Unknown',

    molecular: 'Molecular',
    docking: 'Docking',
    structurePrediction: 'Structure Prediction',

    apiOnline: 'API: online',
    apiOffline: 'API: offline',

    workspace: 'Workspace',
    scientificWorker: 'Scientific Worker',
    workerStatus: 'Worker: {worker} | Queue: {queue} | Active: {active}',
    refreshWorker: 'Refresh Worker',

    taskCreated: 'Task created successfully.',
    taskError: 'Failed to create task.',
    loaded: 'Loaded.',
    loading: 'Loading...',

    reports: 'Reports & History',
    research: 'Research Assistant',
    laboratory: 'Virtual Laboratory',

    systemInfo: 'System Information',
    authenticatedOnly:
      'Dashboard is available only to authenticated users.',

    registrationDisabled: 'Registration: disabled',
    privateEnvironment: 'Environment: private',

    loginSuccess: 'Login successful.',
    loginFailed: 'Login failed.',
    logout: 'Logout',

    user: 'User',
    admin: 'Administrator',

    noData: 'No data available.'
  },

  uz: {
    noJobs: 'Hozircha ilmiy vazifalar mavjud emas.',
    noReports: 'Hozircha hisobotlar mavjud emas.',
    development: 'Ishlab chiqish',
    ready: 'Tayyor',
    pending: 'Kutilmoqda',
    running: 'Bajarilmoqda',
    idle: 'Faol emas',
    unknown: 'Noma’lum',

    molecular: 'Molekulyar',
    docking: 'Dokking',
    structurePrediction: 'Tuzilmani bashorat qilish',

    apiOnline: 'API: online',
    apiOffline: 'API: offline',

    workspace: 'Ish maydoni',
    scientificWorker: 'Ilmiy ishchi',
    workerStatus:
      'Ishchi: {worker} | Navbat: {queue} | Faol: {active}',
    refreshWorker: 'Ishchini yangilash',

    taskCreated: 'Vazifa muvaffaqiyatli yaratildi.',
    taskError: 'Vazifani yaratib bo‘lmadi.',
    loaded: 'Yuklandi.',
    loading: 'Yuklanmoqda...',

    reports: 'Hisobotlar va tarix',
    research: 'Ilmiy tadqiqot yordamchisi',
    laboratory: 'Virtual laboratoriya',

    systemInfo: 'Tizim',
    authenticatedOnly:
      'Dashboardga faqat autentifikatsiyadan o‘tgan foydalanuvchilar kira oladi.',

    registrationDisabled: 'Ro‘yxatdan o‘tish: o‘chirilgan',
    privateEnvironment: 'Muhit: shaxsiy',

    loginSuccess: 'Tizimga muvaffaqiyatli kirildi.',
    loginFailed: 'Tizimga kirishda xatolik yuz berdi.',
    logout: 'Chiqish',

    user: 'Foydalanuvchi',
    admin: 'Administrator',

    noData: 'Ma’lumot mavjud emas.'
  },

  ru: {
    noJobs: 'На данный момент научных задач нет.',
    noReports: 'Отчётов пока нет.',
    development: 'Разработка',
    ready: 'Готов',
    pending: 'Ожидание',
    running: 'Выполняется',
    idle: 'Неактивен',
    unknown: 'Неизвестно',

    molecular: 'Молекулярный',
    docking: 'Докинг',
    structurePrediction: 'Предсказание структуры',

    apiOnline: 'API: онлайн',
    apiOffline: 'API: офлайн',

    workspace: 'Рабочая область',
    scientificWorker: 'Научный обработчик',
    workerStatus:
      'Обработчик: {worker} | Очередь: {queue} | Активных: {active}',
    refreshWorker: 'Обновить обработчик',

    taskCreated: 'Задача успешно создана.',
    taskError: 'Не удалось создать задачу.',
    loaded: 'Загружено.',
    loading: 'Загрузка...',

    reports: 'Отчёты и история',
    research: 'Помощник научного исследования',
    laboratory: 'Виртуальная лаборатория',

    systemInfo: 'Система',
    authenticatedOnly:
      'Доступ к Dashboard разрешён только авторизованным пользователям.',

    registrationDisabled: 'Регистрация: отключена',
    privateEnvironment: 'Среда: частная',

    loginSuccess: 'Вход выполнен успешно.',
    loginFailed: 'Ошибка входа.',
    logout: 'Выйти',

    user: 'Пользователь',
    admin: 'Администратор',

    noData: 'Данные отсутствуют.'
  }

};


/* =========================================================
   LANGUAGE
========================================================= */

function getLanguage() {
  return localStorage.getItem('medgen_language') || 'en';
}

function setLanguage(lang) {
  if (!LANG[lang]) {
    lang = 'en';
  }

  localStorage.setItem('medgen_language', lang);
}

function t(key, replacements = {}) {
  const lang = getLanguage();

  let text =
    LANG[lang]?.[key] ??
    LANG.en?.[key] ??
    key;

  Object.keys(replacements).forEach((keyName) => {
    text = text.replace(
      `{${keyName}}`,
      String(replacements[keyName])
    );
  });

  return text;
}


/* =========================================================
   BACKEND VALUE TRANSLATION
========================================================= */

function translateBackendValue(value) {
  if (value === null || value === undefined) {
    return '';
  }

  const raw = String(value);
  const normalized = raw.toLowerCase().trim();

  const map = {
    development: 'development',
    dev: 'development',

    ready: 'ready',
    pending: 'pending',
    queued: 'pending',

    running: 'running',
    processing: 'running',

    idle: 'idle',

    unknown: 'unknown'
  };

  const key = map[normalized];

  if (key) {
    return t(key);
  }

  return raw;
}


/* =========================================================
   API REQUEST
========================================================= */

async function api(path, options = {}) {
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {})
  };

  if (state.token) {
    headers.Authorization = `Bearer ${state.token}`;
  }

  const response = await fetch(
    `${CONFIG.apiBase}${path}`,
    {
      ...options,
      headers
    }
  );

  let data = null;

  try {
    data = await response.json();
  } catch {
    data = null;
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
    $('username')?.value?.trim() || '';

  const password =
    $('password')?.value || '';

  const loginResult =
    $('loginResult');

  if (!username || !password) {
    if (loginResult) {
      loginResult.textContent =
        t('loginFailed');
    }

    return;
  }

  try {
    if (loginResult) {
      loginResult.textContent =
        t('loading');
    }

    const data = await api(
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
      throw new Error('No access token returned.');
    }

    state.token = token;

    sessionStorage.setItem(
      CONFIG.tokenKey,
      token
    );

    if (loginResult) {
      loginResult.textContent =
        t('loginSuccess');
    }

    await loadCurrentUser();

    showDashboard();

  } catch (error) {

    console.error('Login error:', error);

    if (loginResult) {
      loginResult.textContent =
        `${t('loginFailed')} ${error.message}`;
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
      'Unable to load current user:',
      error
    );

    return null;
  }
}


function updateUserUI() {

  const user =
    state.user;

  if (!user) {
    return;
  }

  const username =
    user.username ||
    user.email ||
    user.name ||
    t('user');

  const role =
    user.role ||
    user.user_role ||
    '';

  const usernameElements =
    document.querySelectorAll(
      '[data-user-name]'
    );

  usernameElements.forEach(
    (element) => {
      element.textContent = username;
    }
  );

  const roleElements =
    document.querySelectorAll(
      '[data-user-role]'
    );

  roleElements.forEach(
    (element) => {
      element.textContent = role;
    }
  );

  const roleElement =
    $('userRole');

  if (roleElement) {
    roleElement.textContent =
      role || t('user');
  }
}


/* =========================================================
   LOGOUT
========================================================= */

function logout() {

  state.token = '';
  state.user = null;

  sessionStorage.removeItem(
    CONFIG.tokenKey
  );

  const dashboard =
    $('dashboard');

  const loginScreen =
    $('loginScreen');

  if (dashboard) {
    dashboard.style.display = 'none';
  }

  if (loginScreen) {
    loginScreen.style.display = '';
  }
}


/* =========================================================
   SHOW DASHBOARD
========================================================= */

function showDashboard() {

  const loginScreen =
    $('loginScreen');

  const dashboard =
    $('dashboard');

  if (loginScreen) {
    loginScreen.style.display = 'none';
  }

  if (dashboard) {
    dashboard.style.display = '';
  }

  updateUserUI();

  translateDynamicUI();

  loadJobStatus();
  loadReports();
}


/* =========================================================
   MODULE OPEN
========================================================= */

function openModule(moduleId) {

  document
    .querySelectorAll('.module-panel')
    .forEach((panel) => {

      panel.style.display =
        'none';
    });

  const target =
    $(moduleId);

  if (target) {
    target.style.display = '';
  }

  translateDynamicUI();
}


/* =========================================================
   HEALTH
========================================================= */

async function checkHealth() {

  const healthElement =
    $('apiStatus');

  if (!healthElement) {
    return;
  }

  try {

    await api('/health/live');

    healthElement.textContent =
      t('apiOnline');

  } catch (error) {

    console.error(
      'Health check failed:',
      error
    );

    healthElement.textContent =
      t('apiOffline');
  }
}


/* =========================================================
   MOLECULAR ANALYSIS
========================================================= */

async function analyzeMolecule() {

  const smiles =
    $('smilesInput')?.value?.trim() || '';

  const result =
    $('molecularResult');

  if (!smiles) {

    if (result) {
      result.textContent =
        t('noData');
    }

    return;
  }

  if (result) {
    result.textContent =
      t('loading');
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

  } catch (error) {

    console.error(
      'Molecule analysis error:',
      error
    );

    if (result) {
      result.textContent =
        error.message;
    }
  }
}


/* =========================================================
   BIOINFORMATICS
========================================================= */

async function analyzeBioinformatics() {

  const sequence =
    $('sequenceInput')?.value?.trim() || '';

  const sequenceType =
    $('sequenceType')?.value ||
    'DNA';

  const result =
    $('bioinformaticsResult');

  if (!sequence) {

    if (result) {
      result.textContent =
        t('noData');
    }

    return;
  }

  if (result) {
    result.textContent =
      t('loading');
  }

  try {

    const data =
      await api(
        '/bioinformatics/analyze',
        {
          method: 'POST',
          body: JSON.stringify({
            sequence,
            sequence_type: sequenceType
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

    console.error(
      'Bioinformatics error:',
      error
    );

    if (result) {
      result.textContent =
        error.message;
    }
  }
}


/* =========================================================
   PDB
========================================================= */

async function loadPDBStructure() {

  const pdbId =
    $('pdbInput')?.value?.trim() || '';

  const result =
    $('pdbResult');

  if (!pdbId) {

    if (result) {
      result.textContent =
        t('noData');
    }

    return;
  }

  if (result) {
    result.textContent =
      t('loading');
  }

  try {

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

  } catch (error) {

    console.error(
      'PDB error:',
      error
    );

    if (result) {
      result.textContent =
        error.message;
    }
  }
}


/* =========================================================
   DRUG DISCOVERY
========================================================= */

async function runScreening() {

  const smiles =
    $('screenSmiles')?.value?.trim() || '';

  const result =
    $('screeningResult');

  if (!smiles) {

    if (result) {
      result.textContent =
        t('noData');
    }

    return;
  }

  if (result) {
    result.textContent =
      t('loading');
  }

  try {

    const data =
      await api(
        '/discovery/screen',
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

  } catch (error) {

    console.error(
      'Screening error:',
      error
    );

    if (result) {
      result.textContent =
        error.message;
    }
  }
}


/* =========================================================
   SCIENTIFIC JOB STATUS
========================================================= */

async function loadJobStatus() {

  const result =
    $('jobStatusResult');

  if (result) {
    result.textContent =
      t('loading');
  }

  try {

    const data =
      await api('/jobs/status');

    const worker =
      translateBackendValue(
        data?.worker ||
        data?.worker_status ||
        'development'
      );

    const queue =
      translateBackendValue(
        data?.queue ||
        data?.queue_status ||
        'ready'
      );

    const active =
      data?.active ??
      data?.active_jobs ??
      0;

    if (result) {

      result.textContent =
        t(
          'workerStatus',
          {
            worker,
            queue,
            active
          }
        );
    }

  } catch (error) {

    console.error(
      'Job status error:',
      error
    );

    if (result) {
      result.textContent =
        error.message;
    }
  }
}


/* =========================================================
   JOBS LIST
========================================================= */

async function loadJobs() {

  const result =
    $('jobsResult');

  if (result) {
    result.textContent =
      t('loading');
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

    if (result) {
      result.textContent =
        JSON.stringify(
          data,
          null,
          2
        );
    }

  } catch (error) {

    console.error(
      'Jobs error:',
      error
    );

    if (result) {
      result.textContent =
        error.message;
    }
  }
}


/* =========================================================
   CREATE SCIENTIFIC JOB
========================================================= */

async function createJob() {

  const result =
    $('jobsResult');

  try {

    const jobType =
      $('jobType')?.value ||
      'molecular';

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

    if (result) {

      result.textContent =
        t('taskCreated') +
        '\n\n' +
        JSON.stringify(
          data,
          null,
          2
        );
    }

    await loadJobStatus();

  } catch (error) {

    console.error(
      'Create job error:',
      error
    );

    if (result) {
      result.textContent =
        `${t('taskError')} ${error.message}`;
    }
  }
}


/* =========================================================
   REPORTS
========================================================= */

async function loadReports() {

  const result =
    $('reportsResult');

  if (result) {
    result.textContent =
      t('loading');
  }

  try {

    const data =
      await api('/reports');

    const reports =
      data?.reports || [];

    if (!reports.length) {

      if (result) {
        result.textContent =
          t('noReports');
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

    console.error(
      'Reports error:',
      error
    );

    if (result) {
      result.textContent =
        error.message;
    }
  }
}


/* =========================================================
   GENERATE REPORT
========================================================= */

async function generateReport() {

  const result =
    $('reportsResult');

  if (result) {
    result.textContent =
      t('loading');
  }

  try {

    const data =
      await api(
        '/reports/generate',
        {
          method: 'POST',
          body: JSON.stringify({})
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

    console.error(
      'Report generation error:',
      error
    );

    if (result) {
      result.textContent =
        error.message;
    }
  }
}


/* =========================================================
   RESEARCH ASSISTANT
========================================================= */

async function runResearchAssistant() {

  const question =
    $('researchInput')?.value?.trim() || '';

  const result =
    $('researchResult');

  if (!question) {

    if (result) {
      result.textContent =
        t('noData');
    }

    return;
  }

  if (result) {
    result.textContent =
      t('loading');
  }

  try {

    const data =
      await api(
        '/research/assistant',
        {
          method: 'POST',
          body: JSON.stringify({
            question
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

    console.error(
      'Research assistant error:',
      error
    );

    if (result) {
      result.textContent =
        error.message;
    }
  }
}


/* =========================================================
   RESEARCH SEARCH
========================================================= */

async function searchResearch() {

  const query =
    $('researchSearchInput')?.value?.trim() || '';

  const result =
    $('researchSearchResult');

  if (!query) {

    if (result) {
      result.textContent =
        t('noData');
    }

    return;
  }

  if (result) {
    result.textContent =
      t('loading');
  }

  try {

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

    console.error(
      'Research search error:',
      error
    );

    if (result) {
      result.textContent =
        error.message;
    }
  }
}


/* =========================================================
   VIRTUAL LABORATORY
========================================================= */

async function loadExperiments() {

  const result =
    $('labResult');

  if (result) {
    result.textContent =
      t('loading');
  }

  try {

    const data =
      await api('/lab/experiments');

    if (result) {

      if (
        !data ||
        !data.experiments ||
        !data.experiments.length
      ) {

        result.textContent =
          t('noData');

      } else {

        result.textContent =
          JSON.stringify(
            data,
            null,
            2
          );
      }
    }

  } catch (error) {

    console.error(
      'Laboratory error:',
      error
    );

    if (result) {
      result.textContent =
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

  if (result) {
    result.textContent =
      t('loading');
  }

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

  } catch (error) {

    console.error(
      'Workflow error:',
      error
    );

    if (result) {
      result.textContent =
        error.message;
    }
  }
}


/* =========================================================
   DYNAMIC UI TRANSLATION
========================================================= */

function translateDynamicUI() {

  const workerTitle =
    $('workerTitle');

  if (workerTitle) {
    workerTitle.textContent =
      t('scientificWorker');
  }

  const workerRefresh =
    $('refreshWorker');

  if (workerRefresh) {
    workerRefresh.textContent =
      t('refreshWorker');
  }

  const reportsTitle =
    $('reportsTitle');

  if (reportsTitle) {
    reportsTitle.textContent =
      t('reports');
  }

  const researchTitle =
    $('researchTitle');

  if (researchTitle) {
    researchTitle.textContent =
      t('research');
  }

  const labTitle =
    $('labTitle');

  if (labTitle) {
    labTitle.textContent =
      t('laboratory');
  }

  const systemTitle =
    $('systemTitle');

  if (systemTitle) {
    systemTitle.textContent =
      t('systemInfo');
  }

  checkHealth();
}


/* =========================================================
   LANGUAGE SELECTOR
========================================================= */

function bindLanguageSelectors() {

  const selectors =
    document.querySelectorAll(
      '#languageSelector, #languageSelect, [data-language-selector]'
    );

  selectors.forEach(
    (selector) => {

      selector.value =
        getLanguage();

      selector.addEventListener(
        'change',
        () => {

          setLanguage(
            selector.value
          );

          selectors.forEach(
            (other) => {
              other.value =
                getLanguage();
            }
          );

          translateStaticUI();

          translateDynamicUI();

          loadJobStatus();
          loadJobs();
          loadReports();
        }
      );
    }
  );
}


/* =========================================================
   STATIC UI TRANSLATION
   Works with index.html data-i18n attributes
========================================================= */

function translateStaticUI() {

  const elements =
    document.querySelectorAll(
      '[data-i18n]'
    );

  elements.forEach(
    (element) => {

      const key =
        element.getAttribute(
          'data-i18n'
        );

      if (!key) {
        return;
      }

      const value =
        t(key);

      if (
        element.tagName === 'INPUT' ||
        element.tagName === 'TEXTAREA'
      ) {

        element.placeholder =
          value;

      } else {

        element.textContent =
          value;
      }
    }
  );


  const placeholderElements =
    document.querySelectorAll(
      '[data-i18n-placeholder]'
    );

  placeholderElements.forEach(
    (element) => {

      const key =
        element.getAttribute(
          'data-i18n-placeholder'
        );

      if (!key) {
        return;
      }

      element.placeholder =
        t(key);
    }
  );


  document
    .querySelectorAll(
      '[data-i18n-title]'
    )
    .forEach(
      (element) => {

        const key =
          element.getAttribute(
            'data-i18n-title'
          );

        if (key) {
          element.title =
            t(key);
        }
      }
    );
}


/* =========================================================
   INITIALIZATION
========================================================= */

async function init() {

  setLanguage(
    getLanguage()
  );

  bindLanguageSelectors();

  translateStaticUI();

  translateDynamicUI();

  if (state.token) {

    const user =
      await loadCurrentUser();

    if (user) {

      showDashboard();

    } else {

      state.token = '';

      sessionStorage.removeItem(
        CONFIG.tokenKey
      );
    }
  }
}


/* =========================================================
   GLOBAL FUNCTIONS
========================================================= */

window.login = login;
window.logout = logout;

window.openModule =
  openModule;

window.checkHealth =
  checkHealth;

window.analyzeMolecule =
  analyzeMolecule;

window.analyzeBioinformatics =
  analyzeBioinformatics;

window.loadPDBStructure =
  loadPDBStructure;

window.runScreening =
  runScreening;

window.loadJobStatus =
  loadJobStatus;

window.loadJobs =
  loadJobs;

window.createJob =
  createJob;

window.loadReports =
  loadReports;

window.generateReport =
  generateReport;

window.runResearchAssistant =
  runResearchAssistant;

window.searchResearch =
  searchResearch;

window.loadExperiments =
  loadExperiments;

window.loadWorkflows =
  loadWorkflows;

window.setLanguage =
  setLanguage;

window.translateStaticUI =
  translateStaticUI;


/* =========================================================
   START
========================================================= */

document.addEventListener(
  'DOMContentLoaded',
  init
);
