/* =========================================================
   MEDGEN AI — APP.JS
   Global Biomedical AI Platform
   EN / UZ / RU
========================================================= */

const API_BASE =
  window.MEDGEN_API_BASE ||
  '/api/v1';

const TOKEN_KEY = 'medgen_access_token';

const state = {
  token: sessionStorage.getItem(TOKEN_KEY) || '',
  user: null,
  profileEditMode: false,
  lastResearchData: null
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
      'Development-stage heuristic screening only. No validated docking, binding affinity, ADMET, or clinical prediction is performed.',

    superAdminDashboard: 'Super Admin Dashboard',
    users: 'Users',
    activeTokens: 'Active tokens',
    jobs: 'Jobs',
    docking: 'Docking',
    experiments: 'Experiments',
    reports: 'Reports',
    workflows: 'Workflows',
    details: 'Details',
    viewDetails: 'View',
    close: 'Close',
    loadingDetails: 'Loading...',
    total: 'Total',
    search: 'Search...',
    noMatchingData: 'No matching data found.'
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
      'Faqat ishlab chiqish bosqichidagi evristik screening. Tasdiqlangan docking, bog‘lanish affiniteti, ADMET yoki klinik prognoz amalga oshirilmaydi.',

    superAdminDashboard: 'Super Admin Dashboard',
    users: 'Foydalanuvchilar',
    activeTokens: 'Faol tokenlar',
    jobs: 'Vazifalar',
    docking: 'Docking',
    experiments: 'Tajribalar',
    reports: 'Hisobotlar',
    workflows: 'Workflowlar',
    details: 'Batafsil',
    viewDetails: 'Ko‘rish',
    close: 'Yopish',
    loadingDetails: 'Yuklanmoqda...',
    total: 'Jami',
    search: 'Qidirish...',
    noMatchingData: 'Mos ma’lumot topilmadi.'
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

  publication_date: { uz: 'nashr_sanasi', ru: 'дата_публикации', en: 'publication_date' },
  journal: { uz: 'jurnal', ru: 'журнал', en: 'journal' },
  pmid: { uz: 'PMID', ru: 'PMID', en: 'PMID' },

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
    'PubMed': { uz: 'PubMed', ru: 'PubMed', en: 'PubMed' },
    'NCBI PubMed E-utilities': { uz: 'NCBI PubMed E-utilities', ru: 'NCBI PubMed E-utilities', en: 'NCBI PubMed E-utilities' },
    'Scientific Research': { uz: 'Ilmiy tadqiqot', ru: 'Научное исследование', en: 'Scientific Research' },

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

    'Medical Academy': 'Medical Academy',

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

    const rawMessage =
      data?.detail ??
      data?.message ??
      `HTTP ${response.status}`;

    const message =
      typeof rawMessage === 'string'
        ? rawMessage
        : JSON.stringify(rawMessage, null, 2);

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

    // Login token is already valid at this point.
    // Do not block the dashboard if the optional /auth/me profile
    // request fails or is unavailable.
    try {
      const me = await loadCurrentUser();
      if (!me) {
        state.user = data?.user || {
          username,
          role: 'student'
        };
      }
    } catch (_) {
      state.user = data?.user || {
        username,
        role: 'student'
      };
    }

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

    const username = data?.username || 'current';
    let localProfile = {};
    try {
      localProfile = JSON.parse(localStorage.getItem('medgen_profile_' + username) || '{}');
    } catch (_) {}

    if (Object.keys(localProfile).length) {
      data.profile = { ...localProfile, ...(data.profile || {}) };
      data.profile_complete = isProfileComplete(data.profile);
    }

    state.user = data;

    updateUserUI();
    applyRoleDashboard();

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
   PROFILE & LEGAL
========================================================= */

async function openProfile() {
  const modal = $('profileModal');
  if (!modal) return;
  modal.classList.remove('hidden');
  const card = modal.querySelector('.modal-card');
  if (card && !card.querySelector('.profile-edit-icon')) {
    const edit = document.createElement('button');
    edit.type = 'button';
    edit.className = 'profile-edit-icon';
    edit.title = 'Profilni tahrirlash';
    edit.textContent = '✏️';
    card.querySelector('.modal-close')?.insertAdjacentElement('afterend', edit);
    edit.addEventListener('click', openProfileEditor);
  }
  document.querySelectorAll('#profileModal input, #profileModal textarea').forEach(el => el.disabled = !state.profileEditMode);
  const changePasswordBtn = $('changePasswordBtn');
  if (changePasswordBtn) changePasswordBtn.addEventListener('click', changeAccountPassword);

  const profileSave = $('profileSave');
  if (profileSave) profileSave.style.display = state.profileEditMode ? '' : 'none';
  const status = $('profileStatus');
  if (status) status.textContent = 'Yuklanmoqda...';

  try {
    const data = await api('/profile');
    let account = {};
    try { account = await api('/account'); } catch (_) {}
    const serverProfile = data?.profile || {};
    let academicProfile = {};
    try { academicProfile = (await api('/academy/profile'))?.profile || {}; } catch (_) {}
    const username = state.user?.username || data?.username || account?.username || 'current';
    let localProfile = {};
    try {
      localProfile = JSON.parse(localStorage.getItem('medgen_profile_' + username) || '{}');
    } catch (_) {}

    const p = { ...localProfile };
    Object.entries(serverProfile).forEach(([key, value]) => {
      if (value !== '' && value !== null && value !== undefined) {
        p[key] = value;
      }
    });

    $('profileFullName').value = p.full_name || '';
    $('profileUsername').value = account?.username || username || '';
    $('profilePhone').value = account?.phone || p.phone || '';
    $('profileEmail').value = p.email || '';
    $('profileOrganization').value = p.organization || '';
    $('profileCountry').value = p.country || '';
    $('profileBirthDate').value =
      p.birth_day && p.birth_month && p.birth_year
        ? String(p.birth_day).padStart(2, '0') + '.' +
          String(p.birth_month).padStart(2, '0') + '.' +
          String(p.birth_year)
        : '';
    $('profileInterests').value = p.research_interests || '';
    $('profileBio').value = p.bio || '';
    $('profileEducationMode') && ($('profileEducationMode').value = academicProfile.education_mode || 'GLOBAL');
    $('profileAcademicCountry') && ($('profileAcademicCountry').value = academicProfile.country_code || '');
    $('profileUniversity') && ($('profileUniversity').value = academicProfile.university || p.organization || '');
    $('profileFaculty') && ($('profileFaculty').value = academicProfile.faculty || '');
    $('profileMajor') && ($('profileMajor').value = academicProfile.major || '');
    $('profileAcademicYear') && ($('profileAcademicYear').value = String(academicProfile.year || 1));
    $('profileGroup') && ($('profileGroup').value = academicProfile.group || '');
    $('profileStudentId') && ($('profileStudentId').value = academicProfile.student_id || '');
    $('profileStudyLanguage') && ($('profileStudyLanguage').value = academicProfile.study_language || 'en');
    $('profileAcademicDegree') && ($('profileAcademicDegree').value = academicProfile.academic_degree || 'MD/MBBS');

    const profileSaveButton = $('profileSave');
    if (profileSaveButton) {
      profileSaveButton.style.display = state.profileEditMode ? '' : 'none';
      profileSaveButton.disabled = false;
      profileSaveButton.textContent = 'Saqlash';
    }
    document.querySelectorAll('#profileModal input, #profileModal textarea').forEach(el => {
      el.disabled = !state.profileEditMode;
    });

    const avatar = $('profileAvatarPreview');
    const uploadBtn = $('profileAvatarUpload');
    const removeBtn = $('profileAvatarRemove');
    if (avatar) {
      avatar.src = p.avatar || '';
      avatar.style.display = p.avatar ? 'block' : 'none';
    }
    if (uploadBtn) uploadBtn.style.display = state.profileEditMode && !p.avatar ? '' : 'none';
    if (removeBtn) removeBtn.style.display = state.profileEditMode && p.avatar ? '' : 'none';

    if (state.user) {
      state.user.profile = p;
      state.user.profile_complete = isProfileComplete(p);
    }

    if (status) status.textContent = '';
  } catch (e) {
    if (status) status.textContent = e.message;
  }
}

function isProfileComplete(p) {
  return Boolean(
    p &&
    String(p.full_name || '').trim() &&
    String(p.email || '').trim() &&
    String(p.country || '').trim() &&
    Number.isInteger(Number(p.birth_year)) &&
    Number(p.birth_year) >= 1900 &&
    Number(p.birth_year) <= 2100 &&
    Number.isInteger(Number(p.birth_month)) &&
    Number(p.birth_month) >= 1 &&
    Number(p.birth_month) <= 12 &&
    Number.isInteger(Number(p.birth_day)) &&
    Number(p.birth_day) >= 1 &&
    Number(p.birth_day) <= 31
  );
}

function enforceProfileCompletion() {
  // The main dashboard must ALWAYS become visible after successful login.
  // Incomplete profile data must not hide the dashboard or force a modal
  // over it. Restricted modules can remain locked until the profile is completed.
  if (isSuperAdmin()) return true;
  if (!state.user || isProfileComplete(state.user.profile || {})) {
    document.querySelectorAll('.module, #workspace, #adminDashboard').forEach(el => {
      if (el) el.classList.remove('profile-locked');
    });
    return true;
  }

  document.querySelectorAll('.module, #workspace, #adminDashboard').forEach(el => {
    if (el) el.classList.add('profile-locked');
  });

  const status = $('profileStatus');
  if (status) {
    status.textContent = '⚠️ Profil hali to‘liq emas. Dashboard ochildi; ayrim funksiyalar profil tasdiqlangach ochiladi.';
  }
  const roleStatus = $('roleDashboardDesc');
  if (roleStatus && !roleStatus.dataset.profileNoticeShown) {
    roleStatus.textContent += '  |  ⚠️ Profilni to‘ldirish talab qilinadi.';
    roleStatus.dataset.profileNoticeShown = '1';
  }
  return true;
}

function closeProfile() {
  state.profileEditMode = false;
  $('profileModal')?.classList.add('hidden');
}

function readAvatar(file) {
  return new Promise((resolve, reject) => {
    if (!file) return resolve('');
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
      return reject(new Error('Faqat PNG, JPEG yoki WebP rasm tanlang.'));
    }
    if (file.size > 2 * 1024 * 1024) {
      return reject(new Error('Profil rasmi 2 MB dan katta bo‘lmasin.'));
    }
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('Rasmni o‘qib bo‘lmadi.'));
    reader.readAsDataURL(file);
  });
}

let profileAvatarRemoved = false;

async function saveProfile() {
  const button = $('profileSave');
  const status = $('profileStatus');

  try {
    if (button) {
      button.disabled = true;
      button.textContent = 'Saqlanmoqda...';
    }
    if (status) status.textContent = '';

    const avatar = await readAvatar($('profileAvatar')?.files?.[0]);
    const savedAvatar = profileAvatarRemoved ? '' : (avatar || state.user?.profile?.avatar || '');

    const birthDateRaw = $('profileBirthDate')?.value?.trim() || '';
    const birthMatch = birthDateRaw.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
    const birthDayRaw = birthMatch ? birthMatch[1] : '';
    const birthMonthRaw = birthMatch ? birthMatch[2] : '';
    const birthYearRaw = birthMatch ? birthMatch[3] : '';

    const payload = {
      full_name: $('profileFullName')?.value?.trim() || '',
      email: $('profileEmail')?.value?.trim() || '',
      phone: $('profilePhone')?.value?.trim() || '',
      organization: $('profileOrganization')?.value?.trim() || '',
      country: $('profileCountry')?.value?.trim() || '',
      birth_year: birthYearRaw ? Number(birthYearRaw) : null,
      birth_month: birthMonthRaw ? Number(birthMonthRaw) : null,
      birth_day: birthDayRaw ? Number(birthDayRaw) : null,
      research_interests: $('profileInterests')?.value?.trim() || '',
      bio: $('profileBio')?.value?.trim() || '',
      avatar: savedAvatar
    };

    if (!payload.full_name || !payload.email || !payload.country ||
        payload.birth_year === null || payload.birth_month === null || payload.birth_day === null) {
      throw new Error('Profilni to‘liq to‘ldiring: ism, email, mamlakat va tug‘ilgan sana majburiy.');
    }

    if (!/^\S+@\S+\.\S+$/.test(payload.email)) {
      throw new Error('Email manzilini to‘g‘ri kiriting.');
    }

    if (payload.birth_year !== null &&
        (!Number.isInteger(payload.birth_year) || payload.birth_year < 1900 || payload.birth_year > 2100)) {
      throw new Error('Tug‘ilgan yil 1900–2100 oralig‘ida bo‘lishi kerak.');
    }

    if (payload.birth_month !== null &&
        (!Number.isInteger(payload.birth_month) || payload.birth_month < 1 || payload.birth_month > 12)) {
      throw new Error('Tug‘ilgan oy 1–12 oralig‘ida bo‘lishi kerak.');
    }

    if (payload.birth_day !== null &&
        (!Number.isInteger(payload.birth_day) || payload.birth_day < 1 || payload.birth_day > 31)) {
      throw new Error('Tug‘ilgan kun 1–31 oralig‘ida bo‘lishi kerak.');
    }

    const data = await api('/profile', {
      method: 'PUT',
      body: JSON.stringify(payload)
    });

    const accountData = await api('/account', {
      method: 'PATCH',
      body: JSON.stringify({
        username: $('profileUsername')?.value?.trim() || undefined,
        phone: payload.phone,
        email: payload.email
      })
    });

    await api('/academy/profile', {
      method: 'PUT',
      body: JSON.stringify({
        education_mode: $('profileEducationMode')?.value || 'GLOBAL',
        country_code: ($('profileAcademicCountry')?.value || '').trim().toUpperCase(),
        university: $('profileUniversity')?.value?.trim() || '',
        faculty: $('profileFaculty')?.value?.trim() || '',
        major: $('profileMajor')?.value?.trim() || '',
        year: Number($('profileAcademicYear')?.value || 1),
        group: $('profileGroup')?.value?.trim() || '',
        student_id: $('profileStudentId')?.value?.trim() || '',
        study_language: $('profileStudyLanguage')?.value || 'en',
        academic_degree: $('profileAcademicDegree')?.value?.trim() || 'MD/MBBS'
      })
    });

    if (state.user) {
      state.user.profile = data.profile;
      state.user.profile_complete = isProfileComplete(data.profile);
      try {
        localStorage.setItem(
          'medgen_profile_' + state.user.username,
          JSON.stringify(data.profile)
        );
      } catch (_) {}
    }

    document.querySelectorAll('.profile-locked').forEach(el => el.classList.remove('profile-locked'));

    state.profileEditMode = false;
    document.querySelectorAll('#profileModal input, #profileModal textarea').forEach(el => el.disabled = true);
    if (status) status.textContent = '✅ Profil muvaffaqiyatli saqlandi.';
    if (button) {
      button.style.display = 'none';
      button.disabled = false;
    }
    setTimeout(() => {
      closeProfile();
      if (status) status.textContent = '';
    }, 500);
  } catch (e) {
    if (status) status.textContent = '❌ ' + e.message;
  } finally {
    if (button && !state.user?.profile_complete) {
      button.disabled = false;
      button.textContent = 'Saqlash';
      button.style.display = '';
    }
  }
}

async function ensureLegalConsent() {
  // Administrative access is not blocked by end-user consent onboarding.
  if (isSuperAdmin()) return;
  if (!state.user || state.user.consent_complete) return;
  const modal = $('legalModal');
  if (!modal) return;
  modal.classList.remove('hidden');
  try {
    const docs = await api('/legal/documents');
    const box = $('legalDocuments');
    if (box) {
      box.innerHTML = [docs.terms, docs.privacy, docs.data_processing, docs.research_disclaimer]
        .map(x => '<details><summary><strong>'+x.title+'</strong></summary><p>'+x.text+'</p></details>').join('');
    }
  } catch (e) {
    $('legalStatus').textContent = e.message;
  }
}

async function acceptLegalConsent() {
  const status = $('legalStatus');
  try {
    const data = await api('/legal/consent', {
      method: 'POST',
      body: JSON.stringify({
        terms_accepted: $('consentTerms')?.checked || false,
        privacy_accepted: $('consentPrivacy')?.checked || false,
        data_processing_accepted: $('consentData')?.checked || false,
        research_disclaimer_accepted: $('consentResearch')?.checked || false
      })
    });
    if (state.user) {
      state.user.consent = data.consent;
      state.user.consent_complete = true;
    }
    $('legalModal')?.classList.add('hidden');
    if (!state.user?.profile_complete) openProfile();
  } catch (e) {
    if (status) status.textContent = e.message;
  }
}


/* =========================================================
   DASHBOARD
========================================================= */


function openProfileEditor() {
  if (!$('profileModal')) return;
  state.profileEditMode = true;
  openProfile();
}

function isSuperAdmin() {
  const role = String(
    state.user?.role ||
    state.user?.user_role ||
    state.user?.type ||
    ''
  ).trim().toUpperCase();
  return role === 'SUPER_ADMIN' || role === 'ADMIN';
}

async function loadAdminDashboard() {
  if (!isSuperAdmin()) return;
  const box = $('adminDashboard');
  if (!box) return;

  try {
    const d = await api('/admin/overview');

    const cards = [
      ['Users', d.users, 'users'],
      ['Active tokens', d.active_tokens, 'tokens'],
      ['Jobs', d.jobs, 'jobs'],
      ['Docking', d.docking_jobs, 'docking'],
      ['Experiments', d.experiments, 'experiments'],
      ['Reports', d.reports, 'reports'],
      ['Workflows', d.workflows, 'workflows']
    ];

    box.innerHTML =
      '<h2>' + escapeHtml(t('superAdminDashboard')) + '</h2>' +
      '<div class="grid">' +
      cards.map(c =>
        '<button type="button" class="card admin-card" data-admin="' + c[2] + '">' +
        '<strong>' + c[1] + '</strong>' +
        '<div>' + escapeHtml(t(c[2] === 'tokens' ? 'activeTokens' : c[2])) + '</div>' +
        '<small>' + escapeHtml(t('details')) + ' →</small>' +
        '</button>'
      ).join('') +
      '</div>' +
      '<div id="adminDetails"></div>';

    box.onclick = async (event) => {
      const button = event.target.closest('[data-admin]');
      if (!button || !box.contains(button)) return;
      await loadAdminDetails(button.dataset.admin);
    };

    
  } catch (e) {
    box.innerHTML = '<div class="status">❌ ' + e.message + '</div>';
  }
}

async function loadAdminDetails(kind) {
  const out = $('adminDetails');
  if (!out) return;

  const titles = {
    users: t('users'),
    tokens: t('activeTokens'),
    jobs: t('jobs'),
    docking: t('docking'),
    experiments: t('experiments'),
    reports: t('reports'),
    workflows: t('workflows')
  };

  out.innerHTML = '<div class="status">Yuklanmoqda...</div>';

  try {
    const endpointMap = {
      users: '/admin/users',
      tokens: '/admin/tokens',
      jobs: '/admin/jobs',
      docking: '/admin/docking',
      experiments: '/admin/experiments',
      reports: '/admin/reports',
      workflows: '/admin/workflows'
    };

    const data = await api(endpointMap[kind] || '/admin/activity');
    const raw =
      data?.users ||
      data?.tokens ||
      data?.jobs ||
      data?.docking ||
      data?.experiments ||
      data?.reports ||
      data?.workflows ||
      data?.activity ||
      [];

    const items = Array.isArray(raw) ? raw : [raw];
    const stateKey = 'adminDetail_' + kind;

    window[stateKey] = items;

    const searchId = 'adminSearch_' + kind;
    let html =
      '<div style="display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap">' +
      '<div><h3 style="margin:0">' + escapeHtml(titles[kind] || 'Details') + '</h3>' +
      '<div class="status">Jami: ' + items.length + '</div></div>' +
      '<input id="' + searchId + '" type="search" placeholder="' + t('search') + '" style="min-width:220px;padding:10px;border-radius:8px">' +
      '</div>' +
      '<div id="adminTable_' + kind + '" style="margin-top:12px"></div>' +
      '<div id="adminRecord_' + kind + '" style="margin-top:14px"></div>';

    out.innerHTML = html;

    function renderTable(filter = '') {
      const tableOut = $('adminTable_' + kind);
      if (!tableOut) return;

      const q = filter.trim().toLowerCase();
      const filtered = items.filter(item =>
        !q || JSON.stringify(item).toLowerCase().includes(q)
      );

      if (!filtered.length) {
        tableOut.innerHTML = '<p class="muted">' + escapeHtml(t('noMatchingData')) + '</p>';
        return;
      }

      const keys = [...new Set(filtered.flatMap(x =>
        x && typeof x === 'object' ? Object.keys(x) : []
      ))];

      const visibleKeys = keys.slice(0, 12);

      tableOut.innerHTML =
        '<div style="overflow:auto;max-height:520px;border:1px solid rgba(255,255,255,.12);border-radius:10px">' +
        '<table class="admin-table" style="min-width:900px"><thead><tr>' +
        '<th>#</th>' +
        visibleKeys.map(k => '<th>' + escapeHtml(k) + '</th>').join('') +
        '<th>' + escapeHtml(t('viewDetails')) + '</th>' +
        '</tr></thead><tbody>' +
        filtered.map((item, index) =>
          '<tr>' +
          '<td>' + (index + 1) + '</td>' +
          visibleKeys.map(k => {
            const value = item?.[k];
            let display = value;
            if (value && typeof value === 'object') display = JSON.stringify(value);
            if (display === null || display === undefined) display = '';
            return '<td style="max-width:280px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis" title="' +
              escapeHtml(String(display)) + '">' + escapeHtml(String(display)) + '</td>';
          }).join('') +
          '<td><button type="button" class="admin-view-btn" data-kind="' +
          escapeHtml(kind) + '" data-index="' + items.indexOf(item) + '">Batafsil</button></td>' +
          '</tr>'
        ).join('') +
        '</tbody></table></div>';

      tableOut.querySelectorAll('.admin-view-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          const item = items[Number(btn.dataset.index)];
          const record = $('adminRecord_' + kind);
          if (!record) return;

          record.innerHTML =
            '<div style="border:1px solid rgba(255,255,255,.16);border-radius:10px;padding:16px">' +
            '<div style="display:flex;justify-content:space-between;align-items:center;gap:10px">' +
            '<h4 style="margin:0">' + escapeHtml(t('details')) + '</h4>' +
            '<button type="button" class="admin-close-record">' + escapeHtml(t('close')) + '</button>' +
            '</div>' +
            '<pre style="white-space:pre-wrap;overflow:auto;max-height:500px;margin-top:12px">' +
            escapeHtml(JSON.stringify(item, null, 2)) +
            '</pre></div>';

          record.querySelector('.admin-close-record')?.addEventListener('click', () => {
            record.innerHTML = '';
          });

          record.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        });
      });
    }

    $(searchId)?.addEventListener('input', e => renderTable(e.target.value));
    renderTable();
  } catch (e) {
    out.innerHTML =
      '<div class="status">❌ ' + escapeHtml(e.message || 'Xatolik') + '</div>';
  }
}
function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function ensureAdminDashboard() {
  if (!isSuperAdmin() || $('adminDashboard')) return;

  const dash = $('dashboardView');
  if (!dash) return;

  const box = document.createElement('section');
  box.id = 'adminDashboard';
  box.className = '';
  box.style.marginTop = '20px';
  dash.appendChild(box);

  loadAdminDashboard();
}


function showLogin() {
  const loginView = $('loginView');
  const dashboardView = $('dashboardView');

  if (dashboardView) {
    dashboardView.classList.add('hidden');
    dashboardView.hidden = true;
    dashboardView.style.setProperty('display', 'none', 'important');
    dashboardView.style.setProperty('visibility', 'hidden', 'important');
  }

  if (loginView) {
    loginView.classList.remove('hidden');
    loginView.hidden = false;
    loginView.style.setProperty('display', 'grid', 'important');
    loginView.style.setProperty('visibility', 'visible', 'important');
    loginView.style.setProperty('opacity', '1', 'important');
  }
}

function showDashboard() {
  const loginView = $('loginView');
  const dashboardView = $('dashboardView');

  // Use both the HTML hidden property and !important inline styles.
  // This removes every possible conflict with the .hidden CSS class.
  if (loginView) {
    loginView.classList.add('hidden');
    loginView.hidden = true;
    loginView.style.setProperty('display', 'none', 'important');
    loginView.style.setProperty('visibility', 'hidden', 'important');
  }

  if (dashboardView) {
    dashboardView.classList.remove('hidden');
    dashboardView.hidden = false;
    dashboardView.style.setProperty('display', 'block', 'important');
    dashboardView.style.setProperty('visibility', 'visible', 'important');
    dashboardView.style.setProperty('opacity', '1', 'important');
    dashboardView.style.setProperty('min-height', '100vh', 'important');
  }

  try { checkHealth(); } catch (_) {}
  try { ensureAdminDashboard(); } catch (_) {}
  try { ensureLegalConsent(); } catch (_) {}
  try { applyRoleDashboard(); } catch (error) {
    console.error('ROLE DASHBOARD ERROR:', error);
  }
  try { enforceProfileCompletion(); } catch (error) {
    console.error('PROFILE CHECK ERROR:', error);
  }
}


/* =========================================================
   LOGOUT
========================================================= */

async function logout() {
  try { if (state.token) await api('/auth/logout', { method: 'POST' }); } catch (_) {}
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

  if (!enforceProfileCompletion()) return;

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

    'Medical Academy': 'studentTool',

    'Reports & History':
      'reportsTool',

    'Global Platform':
      'platformTool'
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

  if (moduleName === 'Global Platform') {
    loadPlatformOverview();
  }
  if (moduleName === 'Medical Academy') loadStudentAcademy();
}


/* =========================================================
   GLOBAL PLATFORM — PHASE 8
========================================================= */

async function loadPlatformOverview() {
  const status = $('platformStatus');
  const result = $('platformResult');
  if (status) status.textContent = 'Global Platform yuklanmoqda...';
  try {
    const [overview, orgs, usage] = await Promise.all([
      api('/platform/overview'),
      api('/platform/organizations'),
      api('/platform/usage')
    ]);
    state.platformOrganizations = orgs?.organizations || [];
    const payload = {
      overview,
      organizations: state.platformOrganizations,
      usage
    };
    renderResult(result, payload);
    if (status) status.textContent = 'Global Platform tayyor.';
  } catch (error) {
    if (status) status.textContent = error.message;
  }
}

async function loadPlatformPlans() {
  try { renderResult($('platformResult'), await api('/platform/plans')); }
  catch(e) { if($('platformStatus')) $('platformStatus').textContent=e.message; }
}
async function loadPlatformWebhooks() {
  const org=(state.platformOrganizations||[])[0]; if(!org)return;
  try { renderResult($('platformResult'), await api('/platform/webhooks?organization_id='+encodeURIComponent(org.id))); }
  catch(e) { if($('platformStatus')) $('platformStatus').textContent=e.message; }
}
async function loadPlatformMembers() {
  const org = (state.platformOrganizations || [])[0];
  if (!org) return;
  try {
    const data = await api('/platform/members/' + encodeURIComponent(org.id));
    renderResult($('platformResult'), data);
  } catch (error) { if ($('platformStatus')) $('platformStatus').textContent = error.message; }
}

async function loadPlatformAudit() {
  const org = (state.platformOrganizations || [])[0];
  if (!org) return;
  try {
    const data = await api('/platform/audit?organization_id=' + encodeURIComponent(org.id));
    renderResult($('platformResult'), data);
  } catch (error) { if ($('platformStatus')) $('platformStatus').textContent = error.message; }
}

async function loadPlatformKeys() {
  const org = (state.platformOrganizations || [])[0];
  if (!org) return;
  try {
    const data = await api('/platform/api-keys?organization_id=' + encodeURIComponent(org.id));
    renderResult($('platformResult'), data);
  } catch (error) { if ($('platformStatus')) $('platformStatus').textContent = error.message; }
}

async function createPlatformApiKey() {
  const org = (state.platformOrganizations || [])[0];
  if (!org) {
    if ($('platformStatus')) $('platformStatus').textContent = 'Avval organization yarating.';
    return;
  }
  const name = window.prompt('API Key nomi:', 'MedGen Production API Key');
  if (name === null) return;
  const trimmed = name.trim();
  if (!trimmed) {
    if ($('platformStatus')) $('platformStatus').textContent = 'API Key nomi kerak.';
    return;
  }
  try {
    if ($('platformStatus')) $('platformStatus').textContent = 'API Key yaratilmoqda...';
    const data = await api('/platform/api-keys', {
      method: 'POST',
      body: JSON.stringify({
        organization_id: org.id,
        name: trimmed
      })
    });
    renderResult($('platformResult'), data);
    if ($('platformStatus')) $('platformStatus').textContent = 'API Key yaratildi. Kalitni hozir saqlab oling — keyin qayta ko‘rsatilmaydi.';
    await loadPlatformOverview();
  } catch (error) {
    if ($('platformStatus')) $('platformStatus').textContent = error.message;
  }
}

async function createPlatformOrganization() {
  const name = $('platformOrgName')?.value?.trim() || '';
  if (!name) return;
  const status = $('platformStatus');
  try {
    await api('/platform/organizations', {
      method: 'POST',
      body: JSON.stringify({ name })
    });
    $('platformOrgName').value = '';
    await loadPlatformOverview();
  } catch (error) {
    if (status) status.textContent = error.message;
  }
}

async function createPlatformWorkspace() {
  const org = (state.platformOrganizations || [])[0];
  const name = $('platformWorkspaceName')?.value?.trim() || '';
  if (!org || !name) {
    if ($('platformStatus')) $('platformStatus').textContent = 'Avval organization va workspace nomini kiriting.';
    return;
  }
  try {
    const data = await api('/platform/workspaces', {
      method: 'POST',
      body: JSON.stringify({ organization_id: org.id, name })
    });
    $('platformWorkspaceName').value = '';
    renderResult($('platformResult'), data);
    await loadPlatformOverview();
  } catch (error) {
    if ($('platformStatus')) $('platformStatus').textContent = error.message;
  }
}

async function createPlatformProject() {
  const org = (state.platformOrganizations || [])[0];
  const name = $('platformProjectName')?.value?.trim() || '';
  if (!org || !name) {
    if ($('platformStatus')) $('platformStatus').textContent = 'Avval organization va project nomini kiriting.';
    return;
  }
  try {
    const workspaces = await api('/platform/workspaces?organization_id=' + encodeURIComponent(org.id));
    const workspace = (workspaces.workspaces || [])[0];
    if (!workspace) throw new Error('Avval workspace yarating.');
    const data = await api('/platform/projects', {
      method: 'POST',
      body: JSON.stringify({ workspace_id: workspace.id, name })
    });
    $('platformProjectName').value = '';
    renderResult($('platformResult'), data);
    await loadPlatformOverview();
  } catch (error) {
    if ($('platformStatus')) $('platformStatus').textContent = error.message;
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

    state.lastResearchData = data;

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
            sequence,
            sequence_type: $('bioSequenceType')?.value || 'AUTO'
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

    // Automatically record the completed screening as a reproducible experiment.
    try {
      await api('/experiments', {
        method: 'POST',
        body: JSON.stringify({
          name: 'Virtual Screening — ' + target,
          workflow_type: 'drug_discovery',
          target,
          input: {
            molecules: [molecule],
            source: 'Drug Discovery / Virtual Screening'
          },
          parameters: {
            screening_basis: data?.results?.[0]?.screening_basis || 'RDKit property-based development screening',
            molecule_count: data?.molecule_count || 1
          },
          results: {
            status: data?.status || 'completed',
            results: data?.results || []
          },
          status: data?.status || 'completed'
        })
      });
    } catch (experimentError) {
      console.warn('EXPERIMENT RECORDING ERROR:', experimentError);
    }

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
   MOLECULAR DOCKING
========================================================= */

async function runDocking() {
  const input = $('dockingInput')?.value?.trim() || '';
  const status = $('dockingStatus');
  const result = $('dockingResult');

  if (!input) {
    if (status) status.textContent = 'Enter: EGFR | CCO';
    return;
  }

  const parts = input.split('|').map(item => item.trim());
  const target = parts[0] || 'EGFR';
  const ligand_smiles = parts[1] || 'CCO';

  if (status) status.textContent = 'Queuing AutoDock Vina...';

  try {
    const queued = await api('/docking/run', {
      method: 'POST',
      body: JSON.stringify({
        target,
        ligand_smiles,
        pdb_id: '1M17',
        center_x: 22.0,
        center_y: 0.2,
        center_z: 52.8,
        size_x: 20.0,
        size_y: 20.0,
        size_z: 20.0,
        exhaustiveness: 8,
        n_poses: 3
      })
    });

    const jobId = queued?.job_id;
    if (!jobId) throw new Error('Docking job ID was not returned.');

    if (status) status.textContent = 'Running AutoDock Vina...';

    for (let attempt = 0; attempt < 120; attempt++) {
      await new Promise(resolve => setTimeout(resolve, 2000));
      const job = await api('/docking/status/' + encodeURIComponent(jobId));

      if (job?.status === 'completed') {
        renderResult(result, job.result);
        if (status) status.textContent = 'Docking completed.';
        return;
      }

      if (job?.status === 'failed') {
        throw new Error(job.error || 'Docking job failed.');
      }

      if (status) status.textContent = 'Running AutoDock Vina...';
    }

    throw new Error('Docking is still running. Check the job status or Render logs.');
  } catch (error) {
    console.error('DOCKING ERROR:', error);
    if (status) status.textContent = error.message;
  }
}


/* =========================================================
   JOB STATUS
========================================================= */

async function createLabWorkflow() {
  const name = $('labName')?.value?.trim() || 'MedGen Virtual Experiment';
  const workflow_type = $('labType')?.value || 'custom';
  const raw = $('labInput')?.value?.trim() || '{}';
  const status = $('workflowStatus');
  const result = $('workflowResult');
  let input;
  try {
    input = JSON.parse(raw);
  } catch {
    if (status) status.textContent = 'Input JSON noto‘g‘ri.';
    return;
  }
  if (status) status.textContent = 'Workflow yaratilmoqda...';
  try {
    const data = await api('/workflows', {
      method: 'POST',
      body: JSON.stringify({ workflow_type, input: { name, ...input } })
    });
    renderResult(result, data);
    if (status) status.textContent = 'Virtual Laboratory workflow yaratildi.';
    await loadWorkflows();
  } catch (error) {
    if (status) status.textContent = error.message;
  }
}


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

async function runResearchAgent() {
  const query = $('researchQuery')?.value?.trim() || '';
  const focus = $('researchFocus')?.value?.trim() || '';
  const status = $('researchStatus');
  const result = $('researchResult');
  if (!query) { if (status) status.textContent = 'Research query is required.'; return; }

  if (status) status.textContent = '1/4 Question → 2/4 Evidence...';
  try {
    const data = await api('/research/agent', {
      method: 'POST',
      body: JSON.stringify({ query, focus, limit: 8 })
    });
    state.lastResearchData = data;
    renderResult(result, data);

    const pipeline = data?.pipeline || {};
    const kg = data?.knowledge_graph || {};
    if (status) {
      status.textContent =
        'Research Agent completed: ' +
        'Evidence ' + (pipeline.evidence_retrieved ?? data?.evidence_count ?? 0) +
        ' → Knowledge Graph +' + (kg.entities_added ?? 0) + ' entities, +' +
        (kg.relations_added ?? 0) + ' relations → Reproducible Report ready.';
    }
    try { await searchKnowledge(); } catch (_) {}
    try { await loadReports(); } catch (_) {}
  } catch (error) {
    if (status) status.textContent = 'Research Agent error: ' + error.message;
  }
}

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
           * Apply the selected language immediately to all
           * static data-i18n / data-i18n-placeholder elements.
           */
          if (typeof window.translatePage === 'function') {
            window.translatePage(lang);
          }

          /* Refresh dynamic statuses and module titles too. */
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

  if ($('adminDashboard')) {
    loadAdminDashboard();
  }

  const researchResult = $('researchResult');
  if (researchResult && state.lastResearchData) {
    renderResult(researchResult, state.lastResearchData);
  }

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
   MEDICAL ACADEMY — PHASE 9
========================================================= */
const MEDICAL_CURRICULUM = {
  1: {
    title:'1-kurs — Fundamental fanlar',
    subjects:['Anatomiya','Gistologiya','Fiziologiya','Biokimyo asoslari'],
    intro:'1-kursda avval normal tuzilma va normal funksiyani mustahkamlaymiz. Klinik bemor savollari majburiy emas.',
    questions:[
      {q:'Yurakning asosiy nasos vazifasini qaysi bo‘lim bajaradi?',o:['Qorincha','Bo‘lmacha','Perikard','Aorta'],a:0,e:'Normal anatomiya va fiziologiya asosini tushunish.'},
      {q:'Odamda gaz almashinuvi asosan qayerda sodir bo‘ladi?',o:['Alveolalarda','Qizilo‘ngachda','Buyrak jomida','Oshqozonda'],a:0,e:'Alveola-kapillyar membrana orqali O₂ va CO₂ almashinuvi.'},
      {q:'Epiteliy to‘qimasining asosiy vazifalaridan biri qaysi?',o:['Qoplash va himoya','Faqat impuls o‘tkazish','Faqat qisqarish','Faqat qon ivitish'],a:0,e:'Epiteliy qoplovchi va himoyalovchi to‘qimadir.'}
    ]
  },
  2: {
    title:'2-kurs — Kasallik mexanizmlari va dori asoslari',
    subjects:['Patologiya','Patofiziologiya','Mikrobiologiya','Farmakologiya asoslari','Immunologiya'],
    intro:'2-kurs savollari kasallik mexanizmi, mikroblar, immun javob va dori mexanizmlariga moslashtiriladi.',
    questions:[
      {q:'Yallig‘lanishning klassik belgilaridan biri qaysi?',o:['Rubor — qizarish','Anosmiya — hid bilmaslik','Mioz — qorachiq torayishi','Afasia — nutq buzilishi'],a:0,e:'Yallig‘lanishning klassik belgilariga rubor, calor, tumor, dolor va functio laesa kiradi.'},
      {q:'Antibiotiklar odatda nimaga qarshi ishlatiladi?',o:['Bakteriyalarga','Viruslarning barchasiga','Suyak sinishiga','Allergiyaning barchasiga'],a:0,e:'Antibiotiklar bakterial infeksiyalarga qarshi qo‘llanadi; viruslarga avtomatik davo emas.'},
      {q:'Farmakologiyada “retseptor” nima?',o:['Dori yoki signal molekulasi ta’sir qiladigan biologik nishon','Faqat qon hujayrasi','Faqat ferment parchasi','Faqat anatomik bo‘shliq'],a:0,e:'Retseptor signalni tanib, hujayra javobini yuzaga chiqarishi mumkin.'}
    ]
  },
  3: {
    title:'3-kurs — Propedevtika va klinik fikrlash',
    subjects:['Propedevtika','Ichki kasalliklar asoslari','Diagnostika','Klinik farmakologiya'],
    intro:'3-kursdan boshlab klinik holatlar bosqichma-bosqich qo‘shiladi: anamnez → ko‘rik → differensial tashxis → tekshiruv.',
    questions:[
      {q:'Bemor bilan klinik suhbatni boshlashda eng to‘g‘ri qadam qaysi?',o:['Asosiy shikoyatni aniqlash','Darhol dori yozish','Darhol operatsiya qilish','Faqat bitta laborator testni tanlash'],a:0,e:'Avval bemorning asosiy shikoyati va muammo tarixini aniqlash kerak.'},
      {q:'Taxikardiya nimani anglatadi?',o:['Yurak urish tezligining oshishi','Qon bosimining doimiy pasayishi','Nafasning to‘xtashi','Tana haroratining pasayishi'],a:0,e:'Taxikardiya — yurak urish tezligining me’yoridan oshishi.'},
      {q:'Differensial tashxisning maqsadi nima?',o:['O‘xshash belgilar beradigan ehtimoliy kasalliklarni tizimli ajratish','Bitta tashxisni dalilsiz tanlash','Faqat dori nomlarini yodlash','Faqat anatomiya chizish'],a:0,e:'Differensial tashxis klinik dalillar asosida ehtimoliy sabablarni taqqoslaydi.'}
    ],
    cases:[
      {id:'pneumonia',title:'Community-acquired pneumonia',patient:'22 yosh, talaba',complaint:'Isitma, yo‘tal va ko‘krak og‘rig‘i.',vitals:'T 38.7°C · HR 104 · RR 24 · SpO₂ 94%',findings:['Isitma','Yo‘tal','Taxikardiya','Nafas tezlashishi'],q:'Eng to‘g‘ri klinik yo‘nalish?',o:['Nafas yo‘llari infeksiyasi','Buyrak kasalligi','Izolyatsiyalangan dermatit'],a:0}
    ]
  },
  4: {
    title:'4-kurs — Klinik fanlar',
    subjects:['Ichki kasalliklar','Umumiy xirurgiya','Pediatriya asoslari','Akusherlik-ginekologiya asoslari','Diagnostika'],
    intro:'4-kursda klinik reasoning chuqurlashadi: simptomlar, tekshiruv natijalari, differensial tashxis va davolash prinsiplarini bog‘lash.',
    questions:[
      {q:'Anamnez va fizik ko‘rikdan keyin keyingi qadam nimaga asoslanadi?',o:['Klinik ehtimol va xavfga','Tasodifiy test tanlashga','Faqat bemorning yoshiga','Faqat bitta simptomga'],a:0,e:'Tekshiruv klinik savol va oldindan shakllangan ehtimolga mos tanlanadi.'}
    ],
    cases:[
      {id:'diabetes',title:'Type 2 diabetes reasoning',patient:'46 yosh',complaint:'Chanqash, tez-tez siyish, holsizlik.',vitals:'BP 138/86 · HR 88 · T 36.8°C',findings:['Polidipsiya','Poliuriya','Charchoq'],q:'Qaysi yo‘nalish birinchi?',o:['Metabolik/endokrin tizim','Faqat teri','Faqat quloq'],a:0}
    ]
  },
  5: {
    title:'5-kurs — Ixtisoslashgan klinik tayyorgarlik',
    subjects:['Kardiologiya','Nevrologiya','Infeksion kasalliklar','Shoshilinch tibbiyot','Klinik farmakoterapiya'],
    intro:'5-kursda murakkab klinik qarorlar, xavfli holatlar va bir nechta differensial tashxis bilan ishlash kuchayadi.',
    questions:[
      {q:'Anafilaksiyada eng muhim tamoyil qaysi?',o:['Hayot uchun xavfli holatni darhol tanish va shoshilinch yordam algoritmini boshlash','Faqat laborator natijani kutish','Faqat dermatologik krem berish','Bemorni kuzatuvsiz qoldirish'],a:0,e:'Anafilaksiya shoshilinch baholash va mahalliy klinik protokol asosida tezkor yordamni talab qiladi.'}
    ],
    cases:[
      {id:'anaphylaxis',title:'Anafilaksiya — emergency',patient:'19 yosh',complaint:'To‘satdan nafas qisilishi, toshma, bosh aylanishi.',vitals:'BP 82/50 · HR 126 · RR 30 · SpO₂ 89%',findings:['Urtikariya','Gipotoniya','Nafas qisilishi'],q:'Ustuvor muammo?',o:['Hayot uchun xavfli sistemik allergik reaksiya','Oddiy shamollash','Dermatit'],a:0}
    ]
  },
  6: {
    title:'6-kurs — Integratsiyalashgan klinik amaliyot va OSCE',
    subjects:['Integratsiyalashgan klinik case','Shoshilinch yordam','OSCE','Klinik qaror va xavfsizlik','Internatura tayyorgarligi'],
    intro:'6-kursda fanlar integratsiyasi, OSCE va murakkab klinik vaziyatlar ustuvor. Real bemor amaliyoti esa faqat klinik ustoz nazorati va mahalliy protokollar bilan.',
    questions:[
      {q:'Murakkab klinik holatda xavfsiz fikrlashning birinchi tamoyili qaysi?',o:['Hayot uchun xavfli muammolarni avval aniqlash','Barcha testlarni tartibsiz buyurish','Faqat bitta simptomni davolash','Noaniqlikni yashirish'],a:0,e:'Prioritetlash va xavfli holatlarni erta tanish klinik xavfsizlikning asosidir.'}
    ],
    cases:[
      {id:'integrated',title:'Integrated clinical reasoning',patient:'58 yosh, bemor',complaint:'Ko‘krakda bosuvchi og‘riq va hansirash.',vitals:'BP 148/92 · HR 108 · RR 22 · SpO₂ 95%',findings:['Ko‘krak og‘rig‘i','Hansirash','Taxikardiya'],q:'Birinchi klinik vazifa?',o:['Hayot uchun xavfli sabablarni tezkor baholash','Faqat vitamin buyurish','Faqat dermatologik ko‘rik','Kuzatuvsiz uyga yuborish'],a:0}
    ]
  }
};

const studentLayers=[
  ['1','Anatomy','Normal organ va anatomik tuzilmalar'],
  ['2','Physiology','Normal funksiya va homeostaz'],
  ['3','Pathophysiology','Kasallik mexanizmi'],
  ['4','Histology','Mikroskopik o‘zgarishlar'],
  ['5','Molecular','Gen/protein/pathway mexanizmlari'],
  ['6','Symptoms','Belgilar va simptom sababi'],
  ['7','Diagnostics','Laboratoriya, imaging va differensial tashxis'],
  ['8','Pharmacology','Dori sinflari va mexanizmlari'],
  ['9','Virtual Patient','Davolashning simulyatsion ta’siri'],
  ['10','Clinical Case','To‘liq klinik fikrlash va OSCE']
];
const studentSkills=[
  ['Vital signs','Kursga mos virtual bemorda vital belgilarni baholash'],
  ['History taking','Kurs darajasiga mos shikoyat, anamnez va red flaglarni yig‘ish'],
  ['Physical examination','Ko‘rik natijalarini tanlash va talqin qilish'],
  ['Injection simulation','Inʼeksiyani faqat xavfsiz virtual muhitda mashq qilish'],
  ['ECG interpretation','ECG patternlarini o‘quv rejimida tahlil qilish'],
  ['Lab interpretation','Laborator natijalarni klinik kontekstda talqin qilish']
];

let studentCourse=Number(localStorage.getItem('medgen_student_course')||1);
if(!MEDICAL_CURRICULUM[studentCourse]) studentCourse=1;
let activeStudentCase=null;
let studentXP=Number(localStorage.getItem('medgen_student_xp')||0);

function getStudentProgress(){
  try { return JSON.parse(localStorage.getItem('medgen_student_progress')||'{}'); }
  catch(_) { return {}; }
}
function saveStudentProgress(p){
  localStorage.setItem('medgen_student_progress',JSON.stringify(p));
}
function isCourseComplete(year){
  const qs=MEDICAL_CURRICULUM[year]?.questions||[];
  if(!qs.length) return false;
  const p=getStudentProgress();
  return qs.every((_,i)=>p[String(year)]?.[i]===true);
}
function getUnlockedCourse(){
  let max=1;
  for(let y=1;y<=6;y++){
    if(y===1 || isCourseComplete(y-1)) max=y;
    else break;
  }
  return max;
}
function markCourseQuestion(year,index,ok){
  if(!ok) return;
  const p=getStudentProgress();
  p[String(year)]=p[String(year)]||[];
  p[String(year)][index]=true;
  saveStudentProgress(p);
  if(isCourseComplete(year) && year<6){
    const next=getUnlockedCourse();
    localStorage.setItem('medgen_student_course',String(next));
  }
}
function renderCourseProgress(){
  const year=getStudentCourse(), qs=MEDICAL_CURRICULUM[year]?.questions||[], p=getStudentProgress();
  const done=qs.filter((_,i)=>p[String(year)]?.[i]===true).length;
  const el=$('studentCourseProgress');
  if(el) el.textContent=done+'/'+qs.length+' topshiriq bajarildi'+(isCourseComplete(year)?' • Kurs tugallandi ✅':'');
  const next=$('studentNextCourse');
  if(next){
    next.disabled=!isCourseComplete(year)||year>=6;
    next.textContent=year>=6?'🎓 Barcha kurslar ochilgan':(isCourseComplete(year)?'🚀 '+(year+1)+'-kursni erta ochish':'🔒 Avval barcha topshiriqlarni bajaring');
  }
}
function unlockNextStudentCourse(){
  const year=getStudentCourse();
  if(year>=6 || !isCourseComplete(year)) return;
  const next=Math.min(6,year+1);
  localStorage.setItem('medgen_student_course',String(next));
  studentCourse=next;
  activeStudentCase=MEDICAL_CURRICULUM[next].cases?.[0]||null;
  renderStudentAcademy();
}

function saveStudentXP(n){
  studentXP=Math.max(0,studentXP+n);
  localStorage.setItem('medgen_student_xp',studentXP);
  if($('studentScore')) $('studentScore').textContent=studentXP;
}

function getStudentCourse(){
  const profileYear=Number(state.user?.profile?.study_year||state.user?.profile?.course_year||0);
  if(profileYear>=1 && profileYear<=6) {
    studentCourse=profileYear;
    localStorage.setItem('medgen_student_course',String(profileYear));
  }
  return studentCourse;
}

function setStudentCourse(year){
  const n=Number(year);
  if(!MEDICAL_CURRICULUM[n] || n>getUnlockedCourse()) return;
  studentCourse=n;
  localStorage.setItem('medgen_student_course',String(n));
  activeStudentCase=MEDICAL_CURRICULUM[n].cases?.[0]||null;
  renderStudentAcademy();
}

function renderStudentAcademy(){
  const year=getStudentCourse(), c=MEDICAL_CURRICULUM[year];
  if($('studentCourseSelect')) $('studentCourseSelect').value=String(year);
  renderCourseProgress();
  if($('studentCourseTitle')) $('studentCourseTitle').textContent=c.title;
  if($('studentCourseIntro')) $('studentCourseIntro').textContent=c.intro;
  if($('studentSubjectList')) $('studentSubjectList').innerHTML=c.subjects.map(s=>'<span class="course-chip">'+escapeHtml(s)+'</span>').join('');
  renderStudentQuiz();
  renderStudentCases();
  renderStudentLayers();
  renderStudentSkills();
  renderStudentOsce();
}

function renderStudentQuiz(){
  const box=$('studentCourseQuiz');
  if(!box) return;
  const qs=MEDICAL_CURRICULUM[getStudentCourse()].questions||[];
  if(!qs.length){box.innerHTML='<p class="muted">Bu kurs uchun savollar tayyorlanmoqda.</p>';return;}
  box.innerHTML='<p class="eyebrow">KURS TOPSHIRIQLARI</p>'+qs.map((q,qi)=>{
    const done=getStudentProgress()[String(getStudentCourse())]?.[qi]===true;
    return '<div class="course-question"><h3>'+(qi+1)+'. '+escapeHtml(q.q)+'</h3><div class="option-list">'+q.o.map((v,i)=>'<button class="option-btn" data-course-index="'+qi+'" data-course-option="'+i+'" '+(done?'disabled':'')+'>'+escapeHtml(v)+'</button>').join('')+'</div><div id="studentCourseFeedback'+qi+'" class="status">'+(done?'✅ Bajarilgan':'')+'</div></div>';
  }).join('')+'<button id="studentNextCourse" class="primary small" type="button"></button><div id="studentCourseProgress" class="status"></div>';
  box.querySelectorAll('[data-course-option]').forEach(b=>b.onclick=()=>{
    const qi=Number(b.dataset.courseIndex), ok=Number(b.dataset.courseOption)===qs[qi].a;
    const group=box.querySelectorAll('[data-course-index="'+qi+'"]');
    group.forEach(z=>z.disabled=true);
    const f=$('studentCourseFeedback'+qi);
    if(ok){saveStudentXP(5);markCourseQuestion(getStudentCourse(),qi,true);f.innerHTML='✅ To‘g‘ri. '+escapeHtml(qs[qi].e);}
    else f.innerHTML='❌ Qayta urinib ko‘ring. '+escapeHtml(qs[qi].e);
    renderCourseProgress();
  });
  $('studentNextCourse')?.addEventListener('click',unlockNextStudentCourse);
  renderCourseProgress();
}

function loadStudentAcademy(){
  saveStudentXP(0);
  const c=MEDICAL_CURRICULUM[getStudentCourse()];
  activeStudentCase=c.cases?.[0]||null;
  renderStudentAcademy();
  document.querySelectorAll('.student-tab').forEach(b=>b.onclick=()=>switchStudentTab(b.dataset.studentTab));
  if($('studentCourseSelect')) {
    const max=getUnlockedCourse();
    [...$('studentCourseSelect').options].forEach(o=>{o.disabled=Number(o.value)>max;});
    $('studentCourseSelect').onchange=e=>setStudentCourse(e.target.value);
  }
  renderVirtualLabLearningMode();
}

function renderVirtualLabLearningMode(){
  const tool=$('workflowTool');
  if(!tool) return;
  const student=roleKey()==='student';
  let banner=$('studentLabLearningBanner');
  if(student && !banner){
    banner=document.createElement('div');
    banner.id='studentLabLearningBanner';
    banner.className='course-note';
    banner.innerHTML='<b>🧪 Virtual Laboratory — Learning Mode</b><br><span>Istalgan kurs talabasi laboratoriyani o‘rganish va simulyatsiya qilish uchun ishlatishi mumkin. Bu rejimda kurs imtihoni yo‘q; natijalar o‘quv/simulyatsion hisoblanadi.</span>';
    tool.prepend(banner);
  }
}

function switchStudentTab(x){
  const m={course:'studentCoursePanel',cases:'studentCasePanel',anatomy:'studentAnatomyPanel',skills:'studentSkillsPanel',osce:'studentOscePanel'};
  Object.values(m).forEach(id=>$(id)?.classList.add('hidden'));
  $(m[x])?.classList.remove('hidden');
  document.querySelectorAll('.student-tab').forEach(b=>b.classList.toggle('active',b.dataset.studentTab===x));
  if(x==='cases' && getStudentCourse()<3) {
    const p=$('studentCasePanel');
    if(p) p.innerHTML='<div class="course-lock"><b>🩺 Virtual Patients hali erta.</b><span>1–2-kursda avval fundamental fanlar va kasallik mexanizmlari o‘rganiladi. Klinik bemor simulyatsiyasi 3-kursdan bosqichma-bosqich ochiladi.</span></div>';
  } else if(x==='cases') renderStudentCases();
}

function renderStudentCases(){
  const box=$('studentCaseList'), main=$('studentCaseMain');
  const year=getStudentCourse(), cases=MEDICAL_CURRICULUM[year].cases||[];
  if(!box||!main) return;
  if(year<3 || !cases.length){
    box.innerHTML='<div class="course-lock"><b>📚 Klinik case hozircha ochilmagan</b><span>Bu bosqichda kursga mos fundamental savollar va mavzular ustuvor.</span></div>';
    main.innerHTML='<div class="course-lock"><b>Avval kurs dasturini o‘rganing</b><span>Virtual patient moduli 3-kursdan boshlab murakkablashadi.</span></div>';
    return;
  }
  if(!activeStudentCase || !cases.some(x=>x.id===activeStudentCase.id)) activeStudentCase=cases[0];
  box.innerHTML=cases.map(x=>'<button class="student-case" data-id="'+x.id+'"><b>'+escapeHtml(x.title)+'</b><small>'+escapeHtml(x.patient)+'</small></button>').join('');
  box.querySelectorAll('[data-id]').forEach(b=>b.onclick=()=>{activeStudentCase=cases.find(x=>x.id===b.dataset.id)||cases[0];renderStudentCase()});
  renderStudentCase();
}

function renderStudentCase(){
  const x=activeStudentCase,o=$('studentCaseMain');
  if(!x||!o)return;
  o.innerHTML='<div class="patient-card"><span class="patient-avatar">👤</span><div><b>'+escapeHtml(x.patient)+'</b><div class="muted">'+escapeHtml(x.complaint)+'</div></div></div><div class="vitals">'+escapeHtml(x.vitals)+'</div><h4>Findings</h4><div class="finding-list">'+x.findings.map(v=>'<span>'+escapeHtml(v)+'</span>').join('')+'</div><div class="question-card"><h3>'+escapeHtml(x.q)+'</h3><div class="option-list">'+x.o.map((v,i)=>'<button class="option-btn" data-i="'+i+'">'+escapeHtml(v)+'</button>').join('')+'</div><div id="studentFeedback" class="status"></div></div>';
  o.querySelectorAll('.option-btn').forEach(b=>b.onclick=()=>{
    const ok=Number(b.dataset.i)===x.a;
    o.querySelectorAll('.option-btn').forEach(z=>z.disabled=true);
    const f=$('studentFeedback');
    if(ok){saveStudentXP(10);f.innerHTML='✅ To‘g‘ri. Keyingi bosqich: anamnez → ko‘rik → differensial tashxis → mos tekshiruvni asoslash.'}
    else f.innerHTML='❌ Qayta o‘ylang: simptomlar, vital belgilar va klinik kontekstni birga baholang.'
  });
}

function renderStudentLayers(){
  const b=$('studentLayerGrid');if(!b)return;
  b.innerHTML=studentLayers.map(x=>'<div class="layer-card"><b>'+x[0]+'</b><strong>'+x[1]+'</strong><span>'+x[2]+'</span></div>').join('');
}
function renderStudentSkills(){
  const b=$('studentSkillList');if(!b)return;
  b.innerHTML=studentSkills.map((x,i)=>'<button class="layer-card" data-skill="'+i+'"><b>0'+(i+1)+'</b><strong>'+x[0]+'</strong><span>'+x[1]+'</span></button>').join('');
  b.querySelectorAll('[data-skill]').forEach(q=>q.onclick=()=>{const x=studentSkills[Number(q.dataset.skill)];alert(x[0]+'\n\n'+x[1]+'\n\nSIMULATION ONLY — real clinical practice requires supervised training.');saveStudentXP(5)});
}
function renderStudentOsce(){
  const b=$('studentOsce');if(!b)return;
  const year=getStudentCourse();
  const label=year<3?'OSCE tayyorgarligi — avval basic checklist':'OSCE Station — kurs darajasiga mos klinik vazifa';
  b.innerHTML='<div class="question-card"><p class="eyebrow">OSCE</p><h3>'+label+'</h3><p class="muted">'+(year<3?'Fundamental fanlar bo‘yicha termin, anatomiya va basic communication mashqlari.':'Safety → anamnez → vital signs → ko‘rik → differensial tashxis → tekshiruvni asoslash.')+'</p><button class="primary small" id="osceStart">Start station</button><div id="osceResult" class="status"></div></div>';
  $('osceStart')?.addEventListener('click',()=>{if($('osceResult'))$('osceResult').innerHTML='🟢 Checklist bajarildi. Kurs '+year+' uchun o‘quv simulyatsiyasi +15 XP.';saveStudentXP(15)});
}


/* =========================================================
   ROLE-BASED PLATFORM ARCHITECTURE
========================================================= */
const MEDGEN_ROLES = {
  school_student:{title:'O‘quvchi',icon:'📘',desc:'School Workspace: fanlar, topshiriqlar, testlar, imtihonlar va progress.',modules:['Medical Academy']},
  student:{title:'Talaba',icon:'🎓',desc:'Medical Academy: kursga mos anatomiya, patologiya, klinik fikrlash, virtual bemor, OSCE va ko‘nikmalar. Virtual Laboratory — faqat o‘quv/simulyatsiya rejimida ochiq.',modules:['Medical Academy','Virtual Laboratory']},
  doctor:{title:'Shifokor',icon:'👨‍⚕️',desc:'Clinical Workspace: klinik case, diagnostika, differensial tashxis, medical knowledge va simulation.',modules:['Research Assistant','Reports & History','Medical Academy']},
  researcher:{title:'Olim / Researcher',icon:'🔬',desc:'Research Workspace: ilmiy izlanish, literature, bioinformatics, knowledge graph va virtual laboratory.',modules:['Research Assistant','Bioinformatics','Virtual Laboratory','Reports & History']},
  professor:{title:'Professor',icon:'👨‍🏫',desc:'Teaching Workspace: kurslar, student progress, cases, OSCE va research.',modules:['Medical Academy','Research Assistant','Reports & History']},
  lab:{title:'Laborant',icon:'🧪',desc:'Laboratory Workspace: protokollar, virtual experiments, molecular analysis va natijalar.',modules:['Virtual Laboratory','Molecular Analysis','Reports & History']},
  biotech:{title:'Biotexnolog',icon:'🧬',desc:'Biotechnology Workspace: molecular biology, bioinformatics, structures va virtual lab.',modules:['Bioinformatics','Molecular Analysis','PDB & Structure','Virtual Laboratory']},
  pharma:{title:'Pharma / Drug Discovery',icon:'💊',desc:'Drug Discovery Workspace: target, structure, screening, docking va discovery reports.',modules:['Drug Discovery','PDB & Structure','Molecular Analysis','Reports & History']},
  bioinformatician:{title:'Bioinformatician',icon:'🧑‍💻',desc:'Bioinformatics Workspace: sequence, genomics, omics pipelines va analysis.',modules:['Bioinformatics','Research Assistant','Reports & History']},
  hospital:{title:'Klinika / Hospital',icon:'🏥',desc:'Clinical Training Workspace: simulation, staff education, cases va analytics.',modules:['Medical Academy','Reports & History']},
  company:{title:'Biotech / Pharma Company',icon:'🏢',desc:'Enterprise Workspace: projects, research, drug discovery, reports va organization tools.',modules:['Drug Discovery','Research Assistant','Virtual Laboratory','Global Platform','Reports & History']},
  admin:{title:'Founder / CEO / Super Admin',icon:'👑',desc:'Global Platform: barcha modullar, organizations, users, projects, analytics va audit.',modules:['Global Platform','Medical Academy','Bioinformatics','Molecular Analysis','PDB & Structure','Drug Discovery','Scientific Jobs','Research Assistant','Virtual Laboratory','Reports & History']}
};
function getLocalRole(){
  const u=state.user?.username||'';
  try{return JSON.parse(localStorage.getItem('medgen_role_'+u)||'null');}catch(_){return null;}
}
function roleKey(){
  const raw=String(state.user?.role||state.user?.user_role||state.user?.type||'').toLowerCase();
  const aliases={super_admin:'admin',superadmin:'admin',founder:'admin',ceo:'admin',owner:'admin'};
  if(aliases[raw]) return aliases[raw];
  if(MEDGEN_ROLES[raw]) return raw;
  const local=getLocalRole()?.key;
  return MEDGEN_ROLES[local] ? local : 'student';
}
function applyRoleDashboard(){
  const key=roleKey(), role=MEDGEN_ROLES[key]||MEDGEN_ROLES.student;
  const title=$('roleDashboardTitle'), desc=$('roleDashboardDesc'), badge=$('roleDashboardBadge');
  if(title) title.textContent=role.icon+' '+role.title;
  if(desc) desc.textContent=role.desc;
  if(badge) badge.textContent='PRIMARY ROLE';
  const quick=$('roleQuickGrid');
  if(quick) quick.innerHTML=role.modules.map(m=>'<button class="role-quick" data-role-module="'+m+'"><b>'+m+'</b><span>Ochish →</span></button>').join('');
  quick?.querySelectorAll('[data-role-module]').forEach(b=>b.addEventListener('click',()=>openModule(b.dataset.roleModule)));
  document.querySelectorAll('.module').forEach(btn=>{
    const allowed=role.modules.includes(btn.dataset.module) || key==='admin';
    btn.classList.toggle('role-hidden',!allowed);
  });
  const rd=$('roleDashboard'); if(rd) rd.classList.remove('hidden');
  updateUserUI();
}
function bindRoleRegistration(){
  const grid=$('registerRoleGrid'), hidden=$('registerRole'), status=$('registerRoleStatus');
  grid?.querySelectorAll('.role-choice').forEach(btn=>btn.addEventListener('click',()=>{
    grid.querySelectorAll('.role-choice').forEach(x=>x.classList.remove('selected'));
    btn.classList.add('selected'); if(hidden) hidden.value=btn.dataset.role;
    if(status) status.textContent='Tanlandi: '+(MEDGEN_ROLES[btn.dataset.role]?.title||btn.dataset.role);
  }));
}

/* =========================================================
   EVENT BINDING
========================================================= */

async function registerAccount() {
  const username = $('registerUsername')?.value?.trim() || '';
  const full_name = $('registerFullName')?.value?.trim() || '';
  const email = $('registerEmail')?.value?.trim() || '';
  const phone = $('registerPhone')?.value?.trim() || '';
  const password = $('registerPassword')?.value || '';
  const password2 = $('registerPassword2')?.value || '';
  const selectedRole = $('registerRole')?.value || '';
  const status = $('loginStatus');

  if (!selectedRole) { if (status) status.textContent = 'Avval asosiy professional rolingizni tanlang.'; return; }

  if (password !== password2) {
    if (status) status.textContent = 'Parollar bir xil emas.';
    return;
  }

  try {
    await api('/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        username, password, full_name, email, phone,
        role: selectedRole,
        education_mode: 'GLOBAL',
        academic_year: 1
      })
    });
    localStorage.setItem('medgen_role_'+username, JSON.stringify({key:selectedRole,status:'active',requestedAt:new Date().toISOString()}));
    if (status) status.textContent = 'Ro‘yxatdan o‘tish qabul qilindi. Asosiy rol CEO/Admin tasdig‘idan keyin faollashadi.';
    $('registerForm')?.classList.add('hidden');
    $('loginForm')?.classList.remove('hidden');
    if ($('loginUser')) $('loginUser').value = username;
  } catch (error) {
    if (status) status.textContent = error.message;
  }
}


async function changeAccountPassword() {
  const current_password = $('currentPassword')?.value || '';
  const new_password = $('newPassword')?.value || '';
  const status = $('profileStatus');
  try {
    await api('/account/password', {
      method: 'POST',
      body: JSON.stringify({ current_password, new_password })
    });
    if (status) status.textContent = 'Parol o‘zgartirildi. Qayta login qiling.';
    logout();
  } catch (error) {
    if (status) status.textContent = error.message;
  }
}


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


  const showRegister = $('showRegister');
  const hideRegister = $('hideRegister');
  if (showRegister) showRegister.addEventListener('click', () => {
    $('registerForm')?.classList.remove('hidden');
    $('loginForm')?.classList.add('hidden');
  });
  if (hideRegister) hideRegister.addEventListener('click', () => {
    $('registerForm')?.classList.add('hidden');
    $('loginForm')?.classList.remove('hidden');
  });
  const registerForm = $('registerForm');
  if (registerForm) registerForm.addEventListener('submit', e => {
    e.preventDefault();
    registerAccount();
  });

  const logoutBtn =
    $('logoutBtn');

  if (logoutBtn) {

    logoutBtn.addEventListener(
      'click',
      logout
    );
  }


  const profileBtn = $('profileBtn');
  if (profileBtn) profileBtn.addEventListener('click', openProfile);

  const profileClose = $('profileClose');
  if (profileClose) profileClose.addEventListener('click', closeProfile);

  const profileAvatar = $('profileAvatar');
  const profileAvatarUpload = $('profileAvatarUpload');
  const profileAvatarRemove = $('profileAvatarRemove');
  if (profileAvatarUpload) profileAvatarUpload.addEventListener('click', () => {
    if (!state.profileEditMode || !profileAvatar) return;
    profileAvatar.click();
  });
  if (profileAvatarRemove) profileAvatarRemove.addEventListener('click', () => {
    profileAvatarRemoved = true;
    if (profileAvatar) profileAvatar.value = '';
    const preview = $('profileAvatarPreview');
    if (preview) { preview.src = ''; preview.style.display = 'none'; }
    if (profileAvatarRemove) profileAvatarRemove.style.display = 'none';
    if (profileAvatarUpload) profileAvatarUpload.style.display = '';
  });
  if (profileAvatar) profileAvatar.addEventListener('change', async () => {
    try {
      profileAvatarRemoved = false;
      const data = await readAvatar(profileAvatar.files?.[0]);
      const preview = $('profileAvatarPreview');
      if (preview) { preview.src = data; preview.style.display = data ? 'block' : 'none'; }
      if (profileAvatarUpload) profileAvatarUpload.style.display = '';
      if (profileAvatarRemove) profileAvatarRemove.style.display = data ? '' : 'none';
    } catch (e) {
      const status = $('profileStatus'); if (status) status.textContent = e.message;
      profileAvatar.value = '';
      if (profileAvatarRemove) profileAvatarRemove.style.display = 'none';
      if (profileAvatarUpload) profileAvatarUpload.style.display = '';
    }
  });

  const profileSave = $('profileSave');
  if (profileSave) profileSave.addEventListener('click', saveProfile);

  const legalAccept = $('legalAccept');
  if (legalAccept) legalAccept.addEventListener('click', acceptLegalConsent);

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


  const dockingRun = $('dockingRun');

  if (dockingRun) {
    dockingRun.addEventListener(
      'click',
      runDocking
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


  const platformRefresh = $('platformRefresh');
  if (platformRefresh) platformRefresh.addEventListener('click', loadPlatformOverview);

  const platformPlan = $('platformPlan');
  if (platformPlan) platformPlan.addEventListener('click', loadPlatformPlans);
  const platformWebhooks = $('platformWebhooks');
  if (platformWebhooks) platformWebhooks.addEventListener('click', loadPlatformWebhooks);

  const platformMembers = $('platformMembers');
  if (platformMembers) platformMembers.addEventListener('click', loadPlatformMembers);

  const platformAudit = $('platformAudit');
  if (platformAudit) platformAudit.addEventListener('click', loadPlatformAudit);

  const platformKeys = $('platformKeys');
  if (platformKeys) platformKeys.addEventListener('click', loadPlatformKeys);

  const platformCreateKey = $('platformCreateKey');
  if (platformCreateKey) platformCreateKey.addEventListener('click', createPlatformApiKey);

  const platformCreateOrg = $('platformCreateOrg');
  if (platformCreateOrg) platformCreateOrg.addEventListener('click', createPlatformOrganization);

  const platformCreateWorkspace = $('platformCreateWorkspace');
  if (platformCreateWorkspace) platformCreateWorkspace.addEventListener('click', createPlatformWorkspace);

  const platformCreateProject = $('platformCreateProject');
  if (platformCreateProject) platformCreateProject.addEventListener('click', createPlatformProject);

  const reportsRefresh =
    $('reportsRefresh');

  if (reportsRefresh) {

    reportsRefresh.addEventListener(
      'click',
      loadReports
    );
  }


  const labRun = $('labRun');
  if (labRun) labRun.addEventListener('click', createLabWorkflow);

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

  const researchAgentRun = $('researchAgentRun');
  if (researchAgentRun) researchAgentRun.addEventListener('click', runResearchAgent);
  const ke=$('knowledgeAddEntity'); if(ke) ke.addEventListener('click',addKnowledgeEntity);
  const kr=$('knowledgeAddRelation'); if(kr) kr.addEventListener('click',addKnowledgeRelation);
  const ks=$('knowledgeSearch'); if(ks) ks.addEventListener('click',searchKnowledge);


  bindLanguageSelectors();
}



async function addKnowledgeEntity(){
  const name=$('knowledgeEntity')?.value?.trim(); if(!name) return;
  const r=await api('/knowledge/entities',{method:'POST',body:JSON.stringify({name,entity_type:$('knowledgeEntityType')?.value||'concept'})});
  if(r.ok) { $('knowledgeStatus').textContent='Entity added'; await searchKnowledge(); }
}
async function addKnowledgeRelation(){
  const subject=$('knowledgeSubject')?.value?.trim(), object=$('knowledgeObject')?.value?.trim();
  if(!subject||!object) return;
  const r=await api('/knowledge/relations',{method:'POST',body:JSON.stringify({subject,object,relation:$('knowledgeRelation')?.value||'associated_with',evidence:$('knowledgeEvidence')?.value||''})});
  if(r.ok) { $('knowledgeStatus').textContent='Relation added'; await searchKnowledge(); }
}
async function searchKnowledge(){
  const q = $('knowledgeQuery')?.value?.trim() || '';
  try {
    const data = await api('/knowledge/search', {
      method: 'POST',
      body: JSON.stringify({ query: q, limit: 25 })
    });
    const stats = await api('/knowledge/stats');
    const entityCount = stats?.entities ?? stats?.entity_count ?? 0;
    const relationCount = stats?.relations ?? stats?.relation_count ?? 0;
    const result = $('knowledgeResult');
    if (result) {
      result.textContent =
        JSON.stringify(data, null, 2) +
        '\nStats: ' + entityCount + ' entities · ' + relationCount + ' relations';
    }
    const status = $('knowledgeStatus');
    if (status) status.textContent = 'Knowledge graph ready';
  } catch (error) {
    const status = $('knowledgeStatus');
    if (status) status.textContent = 'Knowledge graph error: ' + error.message;
  }
}

/* =========================================================
   INITIALIZATION
========================================================= */

async function init() {

  // Deterministic startup: login is visible unless authentication succeeds.
  showLogin();

  try {
    bindEvents();
    bindRoleRegistration();
  } catch (error) {
    console.error('MEDGEN BOOT ERROR:', error);
    const status = $('loginStatus');
    if (status) status.textContent = 'Frontend ishga tushish xatosi: ' + (error?.message || error);
    return;
  }

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
   AUTH VIEW SAFETY WATCHDOG
   Never allow both primary views to remain invisible.
========================================================= */
setTimeout(function () {
  const loginView = $('loginView');
  const dashboardView = $('dashboardView');
  if (!loginView || !dashboardView) return;
  const loginHidden = getComputedStyle(loginView).display === 'none';
  const dashHidden = getComputedStyle(dashboardView).display === 'none';
  if (loginHidden && dashHidden) {
    console.error('AUTH VIEW WATCHDOG: both views hidden; restoring login.');
    showLogin();
    const status = $('loginStatus');
    if (status) status.textContent = 'Sessiya tasdiqlanmadi. Qayta login qiling.';
  }
}, 2500);

/* =========================================================
   GLOBAL ACCESS
========================================================= */

window.login =
  login;

window.logout =
  logout;

window.showLogin =
  showLogin;

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

window.runDocking = runDocking;

window.loadPDB =
  loadPDB;

window.searchResearch =
  searchResearch;

window.createDiscoverySession =
  createDiscoverySession;

window.loadPlatformOverview = loadPlatformOverview;


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


/* =========================================================
   PHASE 2 — EDUCATION SYSTEM PREFERENCE
   Users choose Global/International or their own country.
========================================================= */

const MEDGEN_COUNTRY_CODES = [
  "AF","AL","DZ","AD","AO","AG","AR","AM","AU","AT","AZ","BS","BH","BD","BB","BY","BE","BZ","BJ","BT","BO","BA","BW","BR","BN","BG","BF","BI","CV","KH","CM","CA","CF","TD","CL","CN","CO","KM","CG","CD","CR","CI","HR","CU","CY","CZ","DK","DJ","DM","DO","EC","EG","SV","GQ","ER","EE","SZ","ET","FJ","FI","FR","GA","GM","GE","DE","GH","GR","GD","GT","GN","GW","GY","HT","HN","HU","IS","IN","ID","IR","IQ","IE","IL","IT","JM","JP","JO","KZ","KE","KI","KP","KR","KW","KG","LA","LV","LB","LS","LR","LY","LI","LT","LU","MG","MW","MY","MV","ML","MT","MH","MR","MU","MX","FM","MD","MC","MN","ME","MA","MZ","MM","NA","NR","NP","NL","NZ","NI","NE","NG","MK","NO","OM","PK","PW","PS","PA","PG","PY","PE","PH","PL","PT","QA","RO","RU","RW","KN","LC","VC","WS","SM","ST","SA","SN","RS","SC","SL","SG","SK","SI","SB","SO","ZA","SS","ES","LK","SD","SR","SE","CH","SY","TJ","TZ","TH","TL","TG","TO","TT","TN","TR","TM","TV","UG","UA","AE","GB","US","UY","UZ","VU","VA","VE","VN","YE","ZM","ZW"
];

function populateEducationCountries() {
  const select = $("educationCountry");
  if (!select || select.dataset.ready === "1") return;

  let names;
  try {
    names = new Intl.DisplayNames([getLanguage(), "en"], { type: "region" });
  } catch (_) {
    names = null;
  }

  select.innerHTML = MEDGEN_COUNTRY_CODES.map(code => {
    const name = names?.of(code) || code;
    return '<option value="' + code + '">' + name + ' (' + code + ')</option>';
  }).join("");
  select.dataset.ready = "1";
}

function syncEducationModeUI() {
  const mode = $("educationMode")?.value || "GLOBAL";
  const country = $("educationCountry");
  if (!country) return;
  country.disabled = mode !== "COUNTRY";
  country.setAttribute("aria-disabled", mode !== "COUNTRY" ? "true" : "false");
}

async function loadEducationPreferences() {
  if (!state.user || !$("educationMode")) return;

  populateEducationCountries();

  try {
    const data = await api("/education/preferences");
    const p = data?.preferences || {};

    $("educationMode").value = p.mode === "COUNTRY" ? "COUNTRY" : "GLOBAL";
    $("educationCountry").value = MEDGEN_COUNTRY_CODES.includes(p.country_code) ? p.country_code : "UZ";
    $("educationLevel").value = ["SCHOOL","COLLEGE","UNIVERSITY","POSTGRADUATE","RESEARCH"].includes(p.education_level)
      ? p.education_level : "UNIVERSITY";
    $("educationLanguage").value = ["en","uz","ru","es","fr","de","pt","ar","zh","ja","ko","hi","tr"].includes(p.language)
      ? p.language : "en";

    syncEducationModeUI();
  } catch (_) {
    syncEducationModeUI();
  }
}

async function saveEducationPreferences() {
  const status = $("educationPreferenceStatus");
  const mode = $("educationMode")?.value || "GLOBAL";
  const country = $("educationCountry")?.value || "UZ";
  const level = $("educationLevel")?.value || "UNIVERSITY";
  const language = $("educationLanguage")?.value || "en";

  if (status) status.textContent = "Saving...";

  try {
    const data = await api("/education/preferences", {
      method: "PUT",
      body: JSON.stringify({
        mode,
        country_code: mode === "COUNTRY" ? country : "INTL",
        education_level: level,
        language
      })
    });

    localStorage.setItem("medgen_education_preference", JSON.stringify(data.preferences));
    if (status) status.textContent = "Saved.";
  } catch (error) {
    if (status) status.textContent = "Save failed: " + (error.message || "Unknown error");
  }
}

function initEducationPreferences() {
  populateEducationCountries();
  syncEducationModeUI();

  $("educationMode")?.addEventListener("change", syncEducationModeUI);
  $("saveEducationPreference")?.addEventListener("click", saveEducationPreferences);

  let attempts = 0;
  const timer = setInterval(() => {
    attempts += 1;
    if (state.user) {
      clearInterval(timer);
      loadEducationPreferences();
    } else if (attempts >= 60) {
      clearInterval(timer);
    }
  }, 1000);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initEducationPreferences);
} else {
  initEducationPreferences();
}


/* =========================================================
   PHASE 1 — MEDICAL ACADEMY UI
   Full academic profile + per-subject assessments
========================================================= */
(function initPhase1AcademyUI() {
  const boot = () => {
    if (document.getElementById('phase1AcademyPanel')) return;
    const studentTool = document.getElementById('studentTool');
    if (!studentTool) return;

    const panel = document.createElement('section');
    panel.id = 'phase1AcademyPanel';
    panel.className = 'tool';
    panel.innerHTML = `
      <div class="student-hero">
        <div>
          <p class="eyebrow">PHASE 1 • MEDICAL ACADEMY</p>
          <h2>To‘liq akademik profil va o‘quv tizimi</h2>
          <p class="muted">Har bir fan: <b>Nazariya → Mashq → Quiz → Case → Imtihon</b>. Kurs o‘tishi 3 ta savol bilan belgilanmaydi.</p>
        </div>
        <div class="student-progress"><b id="p1Overall">0%</b><span>PROGRESS</span></div>
      </div>

      <div class="card-grid">
        <div class="card">
          <h3>🎓 Shaxsiy akademik profil</h3>
          <div class="p1-grid">
            <label>Ta’lim tizimi<select id="p1Mode"><option value="GLOBAL">Global / International</option><option value="COUNTRY">Mening mamlakatim</option></select></label>
            <label>Mamlakat kodi<input id="p1Country" placeholder="UZ"></label>
            <label>Universitet<input id="p1University" placeholder="University"></label>
            <label>Fakultet<input id="p1Faculty" placeholder="Faculty"></label>
            <label>Yo‘nalish<input id="p1Major" placeholder="Davolash ishi / Medicine"></label>
            <label>Kurs<select id="p1Year"><option>1</option><option>2</option><option>3</option><option>4</option><option>5</option><option>6</option></select></label>
            <label>Guruh<input id="p1Group" placeholder="Group"></label>
            <label>Student ID <span class="muted">(ixtiyoriy)</span><input id="p1StudentId"></label>
            <label>O‘qish tili<input id="p1Language" value="en" placeholder="en"></label>
            <label>Akademik daraja<input id="p1Degree" value="MD/MBBS"></label>
          </div>
          <button id="p1SaveProfile" class="primary small" type="button">💾 Akademik profilni saqlash</button>
          <div id="p1ProfileStatus" class="status"></div>
        </div>

        <div class="card">
          <h3>📊 Kurs nazorati</h3>
          <p id="p1CourseTitle" class="muted">Yuklanmoqda...</p>
          <div id="p1Eligibility" class="status"></div>
          <button id="p1EligibilityBtn" class="ghost small" type="button">Kurs yakunini tekshirish</button>
        </div>
      </div>

      <div class="card">
        <h3>📚 Fanlar</h3>
        <div id="p1Subjects"></div>
      </div>
      <div id="p1Assessment" class="card hidden">
        <div style="display:flex;justify-content:space-between;gap:10px;align-items:center;flex-wrap:wrap">
          <div><h3 id="p1AssessmentTitle"></h3><p id="p1AssessmentMeta" class="muted"></p></div>
          <button id="p1CloseAssessment" class="ghost small" type="button">Yopish</button>
        </div>
        <div id="p1AssessmentBody"></div>
        <button id="p1SubmitAssessment" class="primary" type="button">Natijani topshirish</button>
        <div id="p1AssessmentStatus" class="status"></div>
      </div>
      <p class="muted" style="margin-top:12px">⚠️ Academy simulyatsiyalari ta’limiy maqsadda. Ular real bemor, klinik tashxis, davolash yoki universitetning rasmiy akademik qarorini almashtirmaydi.</p>
    `;
    studentTool.insertAdjacentElement('afterend', panel);

    const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
    const apiCall = async (path, opts={}) => {
      const token = sessionStorage.getItem(typeof TOKEN_KEY !== 'undefined' ? TOKEN_KEY : 'medgen_access_token') || '';
      const res = await fetch((typeof API_BASE !== 'undefined' ? API_BASE : '/api/v1') + path, {
        ...opts, headers:{'Content-Type':'application/json', ...(opts.headers||{}), ...(token?{Authorization:'Bearer '+token}:{})}
      });
      const data = await res.json().catch(()=>({}));
      if (!res.ok) throw new Error(data.detail || data.message || ('HTTP '+res.status));
      return data;
    };

    let current = null;
    let currentAssessment = null;

    function set(id, value) { const el=document.getElementById(id); if(el) el.innerHTML=value; }
    function val(id) { return document.getElementById(id)?.value || ''; }

    async function load() {
      try {
        const [p, d] = await Promise.all([apiCall('/academy/profile'), apiCall('/academy/dashboard')]);
        const ap = p.profile || {};
        ['Mode','Country','University','Faculty','Major','Year','Group','StudentId','Language','Degree'].forEach(k => {});
        document.getElementById('p1Mode').value=ap.education_mode||'GLOBAL';
        document.getElementById('p1Country').value=ap.country_code||'';
        document.getElementById('p1University').value=ap.university||'';
        document.getElementById('p1Faculty').value=ap.faculty||'';
        document.getElementById('p1Major').value=ap.major||'';
        document.getElementById('p1Year').value=String(ap.year||1);
        document.getElementById('p1Group').value=ap.group||'';
        document.getElementById('p1StudentId').value=ap.student_id||'';
        document.getElementById('p1Language').value=ap.study_language||'en';
        document.getElementById('p1Degree').value=ap.academic_degree||'MD/MBBS';
        current=d.course;
        set('p1Overall', d.overall_progress+'%');
        set('p1CourseTitle', esc(d.course_title));
        renderSubjects(d.subjects);
      } catch(e) {
        set('p1ProfileStatus','❌ '+esc(e.message));
      }
    }

    function renderSubjects(subjects) {
      set('p1Subjects', subjects.map(s => {
        const done=s.complete?'✅':(s.completed_assessments.length+'/5');
        return `
          <div class="p1-subject">
            <div><b>${esc(s.name)}</b><small>${esc(s.objective)} • ${done}</small></div>
            <div class="p1-actions">
              ${['theory','practice','quiz','case','exam'].map(t => `<button class="ghost small p1-assess" data-sub="${esc(s.id)}" data-type="${t}">${t==='theory'?'📖 Nazariya':t==='practice'?'🧪 Mashq':t==='quiz'?'📝 Quiz':t==='case'?'🩺 Case':'🎯 Imtihon'}</button>`).join('')}
            </div>
          </div>`;
      }).join(''));
      document.querySelectorAll('.p1-assess').forEach(btn=>btn.addEventListener('click',()=>startAssessment(btn.dataset.sub,btn.dataset.type)));
    }

    async function startAssessment(subject, type) {
      try {
        currentAssessment={course:current, subject_id:subject, assessment_type:type};
        const d=await apiCall('/academy/assessment/start',{method:'POST',body:JSON.stringify(currentAssessment)});
        set('p1AssessmentTitle', esc(subject)+' — '+esc(type));
        set('p1AssessmentMeta', type==='exam'?'45 daqiqa':type==='theory'?'Nazariy modul':'Baholash');
        const body=document.getElementById('p1AssessmentBody');
        body.innerHTML=d.items.map((q,i)=>{
          if(type==='theory'||type==='practice') return `<div class="p1-question"><b>${i+1}. ${esc(q.prompt)}</b><p>${esc(q.instruction)}</p><label><input type="checkbox" data-q="${esc(q.id)}" class="p1-complete"> Bajarildi</label></div>`;
          return `<div class="p1-question"><b>${i+1}. ${esc(q.question||q.prompt)}</b>${q.scenario?`<p><i>${esc(q.scenario)}</i></p>`:''}<div>${q.options.map((o,j)=>`<label class="p1-option"><input type="radio" name="q_${esc(q.id)}" value="${j}" data-q="${esc(q.id)}"> ${esc(o)}</label>`).join('')}</div></div>`;
        }).join('');
        document.getElementById('p1Assessment').classList.remove('hidden');
        document.getElementById('p1Assessment').scrollIntoView({behavior:'smooth',block:'start'});
        set('p1AssessmentStatus','');
      } catch(e){set('p1AssessmentStatus','❌ '+esc(e.message));}
    }

    async function submitAssessment() {
      if(!currentAssessment) return;
      const answers={};
      if(currentAssessment.assessment_type==='theory'||currentAssessment.assessment_type==='practice'){
        answers.completion=document.querySelector('.p1-complete')?.checked?1:0;
      } else {
        document.querySelectorAll('#p1AssessmentBody input[data-q]:checked').forEach(x=>answers[x.dataset.q]=Number(x.value));
      }
      try {
        const d=await apiCall('/academy/assessment/submit',{method:'POST',body:JSON.stringify({...currentAssessment,answers})});
        set('p1AssessmentStatus', d.passed?'✅ O‘tdi: '+d.score+'%':'❌ O‘tmadi: '+d.score+'%. Xatolarni ko‘rib, qayta mashq qiling.');
        await load();
      }catch(e){set('p1AssessmentStatus','❌ '+esc(e.message));}
    }

    document.getElementById('p1SaveProfile').addEventListener('click',async()=>{
      const mode=val('p1Mode');
      const payload={country_code:val('p1Country').toUpperCase(),education_mode:mode,university:val('p1University'),faculty:val('p1Faculty'),major:val('p1Major'),year:Number(val('p1Year')),group:val('p1Group'),student_id:val('p1StudentId'),study_language:val('p1Language'),academic_degree:val('p1Degree')};
      try{await apiCall('/academy/profile',{method:'PUT',body:JSON.stringify(payload)});set('p1ProfileStatus','✅ Akademik profil saqlandi.');await load();}catch(e){set('p1ProfileStatus','❌ '+esc(e.message));}
    });
    document.getElementById('p1EligibilityBtn').addEventListener('click',async()=>{
      try{const d=await apiCall('/academy/eligibility/'+current);set('p1Eligibility',(d.course_complete?'✅ Kurs to‘liq yakunlangan. ':'⏳ Talablar bajarilmagan. ')+(d.eligible_for_next_course?'Keyingi kurs ochildi.':'Keyingi kurs hali ochilmadi.'));}catch(e){set('p1Eligibility','❌ '+esc(e.message));}
    });
    document.getElementById('p1SubmitAssessment').addEventListener('click',submitAssessment);
    document.getElementById('p1CloseAssessment').addEventListener('click',()=>document.getElementById('p1Assessment').classList.add('hidden'));

    if (sessionStorage.getItem('medgen_access_token')) {
      load();
    } else {
      const waitForLogin = setInterval(() => {
        if (sessionStorage.getItem('medgen_access_token')) {
          clearInterval(waitForLogin);
          load();
        }
      }, 700);
      setTimeout(() => clearInterval(waitForLogin), 120000);
    }
  };
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',boot,{once:true}); else boot();
})();

/* =========================================================
   PHASE 1 UI ARCHITECTURE — SINGLE NAVIGATION / NO DUPLICATES
========================================================= */
(function initMedGenNavigationAndAcademicProfile() {
  function boot() {
    if (document.getElementById('medgenNavDrawer')) return;

    const top = document.querySelector('.top-actions');
    const header = document.querySelector('.topbar');
    const modalCard = document.querySelector('#profileModal .modal-card');
    if (!top || !header) return;

    const menuBtn = document.createElement('button');
    menuBtn.id = 'medgenMenuBtn';
    menuBtn.className = 'ghost menu-button';
    menuBtn.type = 'button';
    menuBtn.textContent = '☰ Menyu';
    top.insertBefore(menuBtn, top.firstChild);

    const drawer = document.createElement('aside');
    drawer.id = 'medgenNavDrawer';
    drawer.className = 'nav-drawer hidden';
    drawer.innerHTML = `
      <div class="nav-drawer-head"><div><b>MEDGEN AI</b><small>Platform Menu</small></div><button id="navDrawerClose" class="ghost">×</button></div>
      <div class="nav-section-title">PLATFORM</div>
      <div id="navModules" class="nav-modules"></div>
      <div class="nav-section-title">ACCOUNT</div>
      <button class="nav-item" data-nav="profile">👤 Profilim</button>
      <button class="nav-item" data-nav="education">🎓 Ta’lim sozlamalari</button>
      <button class="nav-item" data-nav="system">⚙️ System</button>
      <div id="navAdminWrap"></div>
    `;
    document.body.appendChild(drawer);

    const backdrop=document.createElement('div');
    backdrop.id='navDrawerBackdrop';
    backdrop.className='nav-backdrop hidden';
    document.body.appendChild(backdrop);

    const modules=[
      ['Medical Academy','🎓','Medical Academy'],
      ['Bioinformatics','🧬','Bioinformatics'],
      ['Molecular Analysis','⚗️','Molecular Analysis'],
      ['PDB & Structure','🧫','PDB & Structure'],
      ['Drug Discovery','💊','Drug Discovery'],
      ['Virtual Laboratory','🧪','Virtual Laboratory'],
      ['Research Assistant','📚','Research Assistant'],
      ['Scientific Jobs','⚙️','Scientific Jobs'],
      ['Reports & History','📊','Reports & History'],
      ['Global Platform','🌐','Global Platform']
    ];
    const list=document.getElementById('navModules');
    list.innerHTML=modules.map(([id,icon,label])=>`<button class="nav-item" data-module-nav="${id}"><span>${icon}</span><b>${label}</b></button>`).join('');

    const open=()=>{drawer.classList.remove('hidden');backdrop.classList.remove('hidden');};
    const close=()=>{drawer.classList.add('hidden');backdrop.classList.add('hidden');};
    menuBtn.addEventListener('click',open);
    backdrop.addEventListener('click',close);
    document.getElementById('navDrawerClose').addEventListener('click',close);

    list.querySelectorAll('[data-module-nav]').forEach(btn=>btn.addEventListener('click',()=>{
      close();
      if(typeof openModule==='function') openModule(btn.dataset.moduleNav);
      document.querySelector('.module[data-module="'+CSS.escape(btn.dataset.moduleNav)+'"]')?.scrollIntoView({behavior:'smooth',block:'center'});
    }));

    drawer.querySelector('[data-nav="profile"]').addEventListener('click',()=>{close(); if(typeof openProfile==='function') openProfile();});
    drawer.querySelector('[data-nav="education"]').addEventListener('click',()=>{close(); document.getElementById('educationPreferencePanel')?.classList.remove('compact-hidden'); document.getElementById('educationPreferencePanel')?.scrollIntoView({behavior:'smooth',block:'start'});});
    drawer.querySelector('[data-nav="system"]').addEventListener('click',()=>{close(); document.getElementById('systemPanel')?.scrollIntoView({behavior:'smooth',block:'start'});});

    if (modalCard && !modalCard.querySelector('#academicProfileSection')) {
      const sec=document.createElement('section');
      sec.id='academicProfileSection';
      sec.className='academic-profile-section';
      sec.innerHTML=`
        <hr><div class="eyebrow">ACADEMIC PROFILE</div>
        <h3>Universitet va ta’lim ma’lumotlari</h3>
        <div class="academic-grid">
          <label>Ta’lim tizimi<select id="profileEducationMode"><option value="GLOBAL">Global / International</option><option value="COUNTRY">Mening mamlakatim</option></select></label>
          <label>Mamlakat kodi<input id="profileAcademicCountry" maxlength="2" placeholder="UZ"></label>
          <label>Universitet<input id="profileUniversity" placeholder="Universitet"></label>
          <label>Fakultet<input id="profileFaculty" placeholder="Fakultet"></label>
          <label>Yo‘nalish<input id="profileMajor" placeholder="Davolash ishi / Medicine"></label>
          <label>Kurs<select id="profileAcademicYear"><option value="1">1-kurs</option><option value="2">2-kurs</option><option value="3">3-kurs</option><option value="4">4-kurs</option><option value="5">5-kurs</option><option value="6">6-kurs</option></select></label>
          <label>Guruh<input id="profileGroup" placeholder="Guruh"></label>
          <label>Student ID <span class="muted">(ixtiyoriy)</span><input id="profileStudentId"></label>
          <label>O‘qish tili<input id="profileStudyLanguage" value="en" placeholder="en"></label>
          <label>Akademik daraja<input id="profileAcademicDegree" value="MD/MBBS"></label>
        </div>
      `;
      const security=modalCard.querySelector('.account-security');
      modalCard.insertBefore(sec,security||null);
      sec.querySelectorAll('input,select').forEach(el=>el.addEventListener('change',()=>{
        if(el.id==='profileEducationMode') document.getElementById('profileAcademicCountry').disabled=el.value==='GLOBAL';
      }));
    }
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',boot,{once:true}); else boot();
})();

/* =========================================================
   PHASE 1 FINAL SHELL — ROLE-FIRST DASHBOARD
   The home screen is a role workspace, not a module catalogue.
========================================================= */
(function phase1RoleFirstShell(){
  const CATEGORY_ORDER = [
    ['school_student','📘','O‘quvchi'],
    ['student','🎓','Talaba'],
    ['doctor','👨‍⚕️','Shifokor'],
    ['researcher','🔬','Olim / Researcher'],
    ['professor','👨‍🏫','Professor'],
    ['lab','🧪','Laborant'],
    ['biotech','🧬','Biotexnolog'],
    ['pharma','💊','Pharma / Drug Discovery'],
    ['bioinformatician','🧑‍💻','Bioinformatician'],
    ['hospital','🏥','Klinika / Hospital'],
    ['company','🏢','Biotech / Pharma Company'],
    ['admin','👑','Super Admin / Owner']
  ];

  function renderRoleMenu(){
    const drawer=document.getElementById('medgenNavDrawer');
    const list=document.getElementById('navModules');
    if(!drawer || !list || !state.user) return;
    const key=roleKey();
    const isAdmin=key==='admin';
    const allowed=isAdmin ? CATEGORY_ORDER : CATEGORY_ORDER.filter(x=>x[0]===key);
    list.innerHTML=allowed.map(([id,icon,label])=>
      '<button class="nav-item" data-role-nav="'+id+'"><span>'+icon+'</span><b>'+label+'</b></button>'
    ).join('');

    list.querySelectorAll('[data-role-nav]').forEach(btn=>btn.addEventListener('click',()=>{
      drawer.classList.add('hidden');
      document.getElementById('navDrawerBackdrop')?.classList.add('hidden');
      if(btn.dataset.roleNav==='admin' && isAdmin) {
        document.getElementById('adminDashboard')?.scrollIntoView({behavior:'smooth',block:'start'});
        loadAdminDashboard();
      } else {
        const role=MEDGEN_ROLES[btn.dataset.roleNav];
        if(role) {
          const rd=document.getElementById('roleDashboard');
          if(rd){
            document.getElementById('roleDashboardTitle').textContent=role.icon+' '+role.title;
            document.getElementById('roleDashboardDesc').textContent=role.desc;
            rd.scrollIntoView({behavior:'smooth',block:'start'});
          }
        }
      }
    }));

    const title=document.querySelector('.nav-drawer-head b');
    if(title) title.textContent=isAdmin ? 'MEDGEN AI • OWNER' : 'MEDGEN AI • '+(MEDGEN_ROLES[key]?.title||'Workspace');
  }

  function enforceHome(){
    if(!state.user) return;
    const key=roleKey();
    document.querySelectorAll('#dashboardView > .container > .grid').forEach(g=>{
      if(g.querySelector('.module')) g.classList.add('role-module-catalog-hidden');
    });
    document.getElementById('educationPreferencePanel')?.classList.add('role-education-hidden');
    document.getElementById('systemPanel')?.classList.add('role-system-hidden');
    document.getElementById('roleDashboard')?.classList.remove('hidden');
    if(key==='admin') loadAdminDashboard();
    renderRoleMenu();
  }

  function start(){
    enforceHome();
    let n=0;
    const timer=setInterval(()=>{
      enforceHome();
      if(++n>30) clearInterval(timer);
    },500);
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',start,{once:true}); else start();
})();
