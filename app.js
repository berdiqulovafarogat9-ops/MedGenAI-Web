/* =========================================================
   MEDGEN AI — APP.JS
   Global Biomedical AI Platform
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
   DOM HELPERS
========================================================= */

const $ = (id) => document.getElementById(id);

function getLanguage() {
  return localStorage.getItem('medgen_language') || 'uz';
}


/* =========================================================
   TRANSLATIONS
========================================================= */

const dynamicTranslations = {

  en: {

    loading: 'Loading...',
    analyzing: 'Analyzing...',
    searching: 'Searching...',
    signingIn: 'Signing in...',
    loginSuccessful: 'Login successful.',
    loginFailed: 'Login failed: ',
    enterCredentials: 'Enter username and password.',

    sequenceRequired: 'Enter a sequence.',
    pdbRequired: 'PDB ID required.',
    targetRequired: 'Enter a target.',
    moleculeRequired: 'At least one molecule is required.',
    smilesRequired: 'SMILES required.',

    analysisCompleted: 'Analysis completed.',
    sequenceCompleted: 'Sequence analysis completed.',
    loaded: 'Loaded.',
    done: 'Done.',
    searchCompleted: 'Search completed.',

    discoveryLoading: 'Running virtual screening...',
    discoveryCompleted: 'Virtual screening completed.',

    jobCreated: 'Job created.',
    jobLoading: 'Loading scientific jobs...',
    reportLoading: 'Loading reports...',
    workflowLoading: 'Loading workflows...',

    noJobs: 'No scientific jobs available yet.',
    noReports: 'No reports available yet.',
    noWorkflows: 'No workflows available yet.',
    noResearch: 'No research results available yet.',

    online: 'online',
    offline: 'offline',
    apiOnline: 'API: online',
    apiOffline: 'API: offline',

    molecularAnalysis: 'Molecular Analysis',
    bioinformatics: 'Bioinformatics',
    pdbStructure: 'PDB & Structure',
    drugDiscovery: 'Drug Discovery',
    scientificJobs: 'Scientific Jobs',
    researchAssistant: 'Research Assistant',
    virtualLaboratory: 'Virtual Laboratory',
    reportsHistory: 'Reports & History',

    workflowCount: 'Workflows',
    jobCount: 'Jobs',
    reportCount: 'Reports',

    completed: 'completed',

    basicMolecular:
      'Basic molecular analysis completed.',

    sequenceAnalysis:
      'Sequence analysis completed.',

    virtualScreening:
      'virtual screening',

    developmentWarning:
      'Development-stage heuristic screening only. No validated docking, binding affinity, ADMET, or clinical prediction is performed.'
  },


  uz: {

    loading: 'Yuklanmoqda...',
    analyzing: 'Tahlil qilinmoqda...',
    searching: 'Qidirilmoqda...',
    signingIn: 'Tizimga kirilmoqda...',
    loginSuccessful: 'Tizimga muvaffaqiyatli kirildi.',
    loginFailed: 'Kirishda xatolik: ',
    enterCredentials:
      'Foydalanuvchi nomi va parolni kiriting.',

    sequenceRequired:
      'Ketma-ketlikni kiriting.',

    pdbRequired:
      'PDB ID kiriting.',

    targetRequired:
      'Nishonni kiriting.',

    moleculeRequired:
      'Kamida bitta molekula talab qilinadi.',

    smilesRequired:
      'SMILES kiriting.',

    analysisCompleted:
      'Tahlil tugallandi.',

    sequenceCompleted:
      'Ketma-ketlik tahlili tugallandi.',

    loaded:
      'Yuklandi.',

    done:
      'Tayyor.',

    searchCompleted:
      'Qidiruv tugallandi.',

    discoveryLoading:
      'Virtual screening bajarilmoqda...',

    discoveryCompleted:
      'Virtual screening tugallandi.',

    jobCreated:
      'Vazifa yaratildi.',

    jobLoading:
      'Ilmiy vazifalar yuklanmoqda...',

    reportLoading:
      'Hisobotlar yuklanmoqda...',

    workflowLoading:
      'Workflowlar yuklanmoqda...',

    noJobs:
      'Hozircha ilmiy vazifalar mavjud emas.',

    noReports:
      'Hozircha hisobotlar mavjud emas.',

    noWorkflows:
      'Hozircha workflowlar mavjud emas.',

    noResearch:
      'Hozircha tadqiqot natijalari mavjud emas.',

    online:
      'online',

    offline:
      'offline',

    apiOnline:
      'API: online',

    apiOffline:
      'API: offline',

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

    workflowCount:
      'Workflowlar soni',

    jobCount:
      'Vazifalar soni',

    reportCount:
      'Hisobotlar soni',

    completed:
      'tugallandi',

    basicMolecular:
      'Asosiy molekulyar tahlil tugallandi.',

    sequenceAnalysis:
      'Ketma-ketlik tahlili tugallandi.',

    virtualScreening:
      'virtual screening',

    developmentWarning:
      'Faqat ishlab chiqish bosqichidagi evristik screening. Tasdiqlangan docking, bog‘lanish affiniteti, ADMET yoki klinik prognoz amalga oshirilmaydi.'
  },


  ru: {

    loading: 'Загрузка...',
    analyzing: 'Выполняется анализ...',
    searching: 'Поиск...',
    signingIn: 'Выполняется вход...',
    loginSuccessful: 'Вход выполнен.',
    loginFailed: 'Ошибка входа: ',
    enterCredentials:
      'Введите имя пользователя и пароль.',

    sequenceRequired:
      'Введите последовательность.',

    pdbRequired:
      'Введите PDB ID.',

    targetRequired:
      'Введите мишень.',

    moleculeRequired:
      'Требуется хотя бы одна молекула.',

    smilesRequired:
      'Введите SMILES.',

    analysisCompleted:
      'Анализ завершён.',

    sequenceCompleted:
      'Анализ последовательности завершён.',

    loaded:
      'Загружено.',

    done:
      'Готово.',

    searchCompleted:
      'Поиск завершён.',

    discoveryLoading:
      'Выполняется виртуальный скрининг...',

    discoveryCompleted:
      'Виртуальный скрининг завершён.',

    jobCreated:
      'Задача создана.',

    jobLoading:
      'Загрузка научных задач...',

    reportLoading:
      'Загрузка отчётов...',

    workflowLoading:
      'Загрузка workflow...',

    noJobs:
      'На данный момент научных задач нет.',

    noReports:
      'Отчётов пока нет.',

    noWorkflows:
      'Пока нет доступных workflow.',

    noResearch:
      'Результатов исследований пока нет.',

    online:
      'онлайн',

    offline:
      'офлайн',

    apiOnline:
      'API: онлайн',

    apiOffline:
      'API: офлайн',

    molecularAnalysis:
      'Молекулярный анализ',

    bioinformatics:
      'Биоинформатика',

    pdbStructure:
      'PDB и структура',

    drugDiscovery:
      'Поиск лекарственных средств',

    scientificJobs:
      'Научные задачи',

    researchAssistant:
      'Исследовательский помощник',

    virtualLaboratory:
      'Виртуальная лаборатория',

    reportsHistory:
      'Отчёты и история',

    workflowCount:
      'Количество workflow',

    jobCount:
      'Количество задач',

    reportCount:
      'Количество отчётов',

    completed:
      'завершено',

    basicMolecular:
      'Базовый молекулярный анализ завершён.',

    sequenceAnalysis:
      'Анализ последовательности завершён.',

    virtualScreening:
      'виртуальный скрининг',

    developmentWarning:
      'Только эвристический скрининг на стадии разработки. Валидированный docking, аффинность связывания, ADMET или клиническое прогнозирование не выполняются.'
  }

};


function t(key) {

  const lang = getLanguage();

  return (
    dynamicTranslations[lang]?.[key] ||
    dynamicTranslations.en[key] ||
    key
  );
}


/* =========================================================
   RESULT KEY TRANSLATION
========================================================= */

const resultKeys = {

  status: {
    uz: 'holat',
    ru: 'статус',
    en: 'status'
  },

  module: {
    uz: 'modul',
    ru: 'модуль',
    en: 'module'
  },

  workflow: {
    uz: 'workflow',
    ru: 'workflow',
    en: 'workflow'
  },

  target: {
    uz: 'nishon',
    ru: 'мишень',
    en: 'target'
  },

  molecule_count: {
    uz: 'molekulalar_soni',
    ru: 'количество_молекул',
    en: 'molecule_count'
  },

  results: {
    uz: 'natijalar',
    ru: 'результаты',
    en: 'results'
  },

  smiles: {
    uz: 'SMILES',
    ru: 'SMILES',
    en: 'SMILES'
  },

  score: {
    uz: 'ball',
    ru: 'оценка',
    en: 'score'
  },

  atom_estimate: {
    uz: 'atomlar_taxmini',
    ru: 'оценка_атомов',
    en: 'atom_estimate'
  },

  ring_estimate: {
    uz: 'halqalar_taxmini',
    ru: 'оценка_колец',
    en: 'ring_estimate'
  },

  charge_markers: {
    uz: 'zaryad_belgilari',
    ru: 'маркеры_заряда',
    en: 'charge_markers'
  },

  size_score: {
    uz: 'hajm_balli',
    ru: 'оценка_размера',
    en: 'size_score'
  },

  ring_score: {
    uz: 'halqa_balli',
    ru: 'оценка_колец',
    en: 'ring_score'
  },

  charge_score: {
    uz: 'zaryad_balli',
    ru: 'оценка_заряда',
    en: 'charge_score'
  },

  complexity_score: {
    uz: 'murakkablik_balli',
    ru: 'оценка_сложности',
    en: 'complexity_score'
  },

  rank: {
    uz: 'reyting',
    ru: 'рейтинг',
    en: 'rank'
  },

  user: {
    uz: 'foydalanuvchi',
    ru: 'пользователь',
    en: 'user'
  },

  warning: {
    uz: 'ogohlantirish',
    ru: 'предупреждение',
    en: 'warning'
  },

  title: {
    uz: 'sarlavha',
    ru: 'название',
    en: 'title'
  },

  source: {
    uz: 'manba',
    ru: 'источник',
    en: 'source'
  },

  analysis: {
    uz: 'tahlil',
    ru: 'анализ',
    en: 'analysis'
  },

  sequence_type: {
    uz: 'ketma_ketlik_turi',
    ru: 'тип_последовательности',
    en: 'sequence_type'
  },

  length: {
    uz: 'uzunlik',
    ru: 'длина',
    en: 'length'
  },

  composition: {
    uz: 'tarkib',
    ru: 'состав',
    en: 'composition'
  },

  gc_content_percent: {
    uz: 'GC_miqdori_foiz',
    ru: 'GC_содержание_процентов',
    en: 'gc_content_percent'
  },

  at_content_percent: {
    uz: 'AT_miqdori_foiz',
    ru: 'AT_содержание_процентов',
    en: 'at_content_percent'
  },

  smiles_length: {
    uz: 'SMILES_uzunligi',
    ru: 'длина_SMILES',
    en: 'smiles_length'
  },

  heavy_atom_estimate: {
    uz: 'ogir_atomlar_taxmini',
    ru: 'оценка_тяжёлых_атомов',
    en: 'heavy_atom_estimate'
  },

  ring_digit_count: {
    uz: 'halqa_raqamlari_soni',
    ru: 'количество_цифр_колец',
    en: 'ring_digit_count'
  },

  estimated_rings: {
    uz: 'taxminiy_halqa_soni',
    ru: 'оценка_колец',
    en: 'estimated_rings'
  },

  formal_charge_markers: {
    uz: 'formal_zaryad_belgilari',
    ru: 'маркеры_формального_заряда',
    en: 'formal_charge_markers'
  },

  count: {
    uz: 'soni',
    ru: 'количество',
    en: 'count'
  },

  worker: {
    uz: 'worker',
    ru: 'worker',
    en: 'worker'
  },

  queue: {
    uz: 'navbat',
    ru: 'очередь',
    en: 'queue'
  },

  active: {
    uz: 'faol',
    ru: 'активных',
    en: 'active'
  }
};


function translateResultKey(key) {

  const lang = getLanguage();

  return (
    resultKeys[key]?.[lang] ||
    resultKeys[key]?.en ||
    key
  );
}


/* =========================================================
   RESULT VALUE TRANSLATION
========================================================= */

function translateResultValue(value) {

  const lang = getLanguage();

  if (typeof value !== 'string') {
    return value;
  }

  const translations = {

    'completed': {
      uz: 'tugallandi',
      ru: 'завершено',
      en: 'completed'
    },

    'tugallandi': {
      uz: 'tugallandi',
      ru: 'завершено',
      en: 'completed'
    },

    'Molecular Analysis': {
      uz: 'Molekulyar tahlil',
      ru: 'Молекулярный анализ',
      en: 'Molecular Analysis'
    },

    'Bioinformatics': {
      uz: 'Bioinformatika',
      ru: 'Биоинформатика',
      en: 'Bioinformatics'
    },

    'PDB & Structure': {
      uz: 'PDB va struktura',
      ru: 'PDB и структура',
      en: 'PDB & Structure'
    },

    'Drug Discovery': {
      uz: 'Dori vositalarini kashf qilish',
      ru: 'Поиск лекарственных средств',
      en: 'Drug Discovery'
    },

    'Scientific Jobs': {
      uz: 'Ilmiy vazifalar',
      ru: 'Научные задачи',
      en: 'Scientific Jobs'
    },

    'Research Assistant': {
      uz: 'Tadqiqot yordamchisi',
      ru: 'Исследовательский помощник',
      en: 'Research Assistant'
    },

    'Virtual Laboratory': {
      uz: 'Virtual laboratoriya',
      ru: 'Виртуальная лаборатория',
      en: 'Virtual Laboratory'
    },

    'Reports & History': {
      uz: 'Hisobotlar va tarix',
      ru: 'Отчёты и история',
      en: 'Reports & History'
    },

    'virtual_screening': {
      uz: 'virtual screening',
      ru: 'виртуальный скрининг',
      en: 'virtual screening'
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

    'Virtual screening completed.': {
      uz: 'Virtual screening tugallandi.',
      ru: 'Виртуальный скрининг завершён.',
      en: 'Virtual screening completed.'
    },

    'Search completed.': {
      uz: 'Qidiruv tugallandi.',
      ru: 'Поиск завершён.',
      en: 'Search completed.'
    },

    'Development-stage heuristic screening only. No validated docking, binding affinity, ADMET, or clinical prediction is performed.': {
      uz: 'Faqat ishlab chiqish bosqichidagi evristik screening. Tasdiqlangan docking, bog‘lanish affiniteti, ADMET yoki klinik prognoz amalga oshirilmaydi.',
      ru: 'Только эвристический скрининг на стадии разработки. Валидированный docking, аффинность связывания, ADMET или клиническое прогнозирование не выполняются.',
      en: 'Development-stage heuristic screening only. No validated docking, binding affinity, ADMET, or clinical prediction is performed.'
    }
  };

  return (
    translations[value]?.[lang] ||
    translations[value]?.en ||
    value
  );
}


/* =========================================================
   RECURSIVE RESULT TRANSLATION
========================================================= */

function translateResult(value) {

  if (Array.isArray(value)) {

    return value.map(
      item => translateResult(item)
    );
  }

  if (
    value !== null &&
    typeof value === 'object'
  ) {

    const translated = {};

    for (const key in value) {

      const newKey =
        translateResultKey(key);

      translated[newKey] =
        translateResult(value[key]);
    }

    return translated;
  }

  return translateResultValue(value);
}


/* =========================================================
   RESULT RENDER
========================================================= */

function renderResult(element, data) {

  if (!element) return;

  const translated =
    translateResult(data);

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

  return map[moduleName]
    ? t(map[moduleName])
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

      tool.classList.add(
        'hidden'
      );
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

      tool.classList.add(
        'hidden'
      );
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
        t('smilesRequired');
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

  if (status) {
    status.textContent =
      t('loading');
  }

  try {

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
   DRUG DISCOVERY
========================================================= */

async function createDiscoverySession() {

  const input =
    $('discoveryTarget')?.value?.trim() || '';

  const status =
    $('discoveryStatus');

  const result =
    $('discoveryResult');

  if (!input) {

    if (status) {
      status.textContent =
        t('targetRequired');
    }

    return;
  }

  /*
   * Format:
   *
   * EGFR | CCO
   *
   * EGFR = target
   * CCO  = molecule / SMILES
   */

  let target =
    input;

  let molecule =
    'CCO';

  if (input.includes('|')) {

    const parts =
      input
        .split('|')
        .map(
          item => item.trim()
        );

    target =
      parts[0] || '';

    molecule =
      parts[1] || 'CCO';
  }

  if (!molecule) {

    if (status) {
      status.textContent =
        t('moleculeRequired');
    }

    return;
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
            target,
            molecules: [
              molecule
            ]
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
        `${worker} | ${queue} | ${t('jobCount')}: ${active}`;
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

    } else {

      renderResult(
        result,
        data
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
            job_type: jobType,
            input: {}
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

  if (status) {
    status.textContent =
      t('reportLoading');
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

  if (status) {
    status.textContent =
      t('workflowLoading');
  }

  try {

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

      status.textContent =
        `${t('workflowCount')}: ${workflows.length}`;
    }

  } catch (error) {

    if (status) {
      status.textContent =
        error.message;
    }
  }
}


/* =========================================================
   RESEARCH ASSISTANT
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

  if (status) {
    status.textContent =
      t('searching');
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
   LANGUAGE SWITCH
========================================================= */

function bindLanguageSelectors() {

  const selectors = [
    $('loginLanguageSelector'),
    $('languageSelector')
  ];

  selectors.forEach(
    selector => {

      if (!selector) {
        return;
      }

      selector.value =
        getLanguage();

      selector.addEventListener(
        'change',
        function() {

          const lang =
            this.value || 'uz';

          localStorage.setItem(
            'medgen_language',
            lang
          );

          selectors.forEach(
            other => {

              if (other) {
                other.value =
                  lang;
              }
            }
          );

          /*
           * index.html handles all
           * static data-i18n elements.
           *
           * We refresh dynamic statuses here.
           */

          refreshDynamicUI();
        }
      );
    }
  );
}


/* =========================================================
   DYNAMIC UI REFRESH
========================================================= */

function refreshDynamicUI() {

  checkHealth();

  const workspace =
    $('workspace');

  if (
    workspace &&
    !workspace.classList.contains(
      'hidden'
    )
  ) {

    const title =
      $('workspaceTitle');

    if (title) {

      const modules = {

        'Molecular Analysis':
          'molecularAnalysis',

        'Molekulyar tahlil':
          'molecularAnalysis',

        'Молекулярный анализ':
          'molecularAnalysis',

        'Bioinformatics':
          'bioinformatics',

        'Bioinformatika':
          'bioinformatics',

        'Биоинформатика':
          'bioinformatics',

        'PDB & Structure':
          'pdbStructure',

        'PDB va struktura':
          'pdbStructure',

        'PDB и структура':
          'pdbStructure',

        'Drug Discovery':
          'drugDiscovery',

        'Dori vositalarini kashf qilish':
          'drugDiscovery',

        'Поиск лекарственных средств':
          'drugDiscovery',

        'Scientific Jobs':
          'scientificJobs',

        'Ilmiy vazifalar':
          'scientificJobs',

        'Научные задачи':
          'scientificJobs',

        'Research Assistant':
          'researchAssistant',

        'Tadqiqot yordamchisi':
          'researchAssistant',

        'Исследовательский помощник':
          'researchAssistant',

        'Virtual Laboratory':
          'virtualLaboratory',

        'Virtual laboratoriya':
          'virtualLaboratory',

        'Виртуальная лаборатория':
          'virtualLaboratory',

        'Reports & History':
          'reportsHistory',

        'Hisobotlar va tarix':
          'reportsHistory',

        'Отчёты и история':
          'reportsHistory'
      };

      const key =
        modules[title.textContent];

      if (key) {
        title.textContent =
          t(key);
      }
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
    .forEach(
      button => {

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

window.createDiscoverySession =
  createDiscoverySession;


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
