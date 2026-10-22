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
  // Summaries use only returned measurements; never substitute demo values.
  document.getElementById(element.id + 'Summary')?.remove();
  let measurements = [];
  if (element.id === 'molecularResult' && data.analysis) {
    const a = data.analysis;
    measurements = [['Formula', a.molecular_formula], ['Molekulyar massa (g/mol)', a.molecular_weight], ['LogP', a.logP], ['TPSA (Å²)', a.TPSA]];
  } else if (element.id === 'bioResult') {
    measurements = [['Ketma-ketlik turi', data.sequence_type], ['Uzunlik', data.length], ['Noaniq belgilar', data.ambiguous_bases]];
    if (['DNA', 'RNA'].includes(data.sequence_type)) measurements.push(['GC (%)', data.gc_content_percent]);
  }
  measurements = measurements.filter(([,value]) => value !== undefined && value !== null);
  if (measurements.length) {
    const summary = document.createElement('section');
    summary.id = element.id + 'Summary'; summary.className = 'measurement-summary';
    summary.setAttribute('aria-label', 'Hisoblangan natijalar');
    const title = document.createElement('h3'); title.textContent = 'Hisoblangan natijalar'; summary.appendChild(title);
    const grid = document.createElement('dl');
    measurements.forEach(([label,value]) => {
      const cell = document.createElement('div'), term = document.createElement('dt'), result = document.createElement('dd');
      term.textContent = label; result.textContent = String(value); cell.append(term,result); grid.appendChild(cell);
    });
    summary.appendChild(grid); element.before(summary);
  }

  const translated =
    translateResult(data);

  element.textContent =
    JSON.stringify(
      translated,
      null,
      2
    );

  if (element.id === 'bioResult' && window.MedGenVisuals) {
    try { window.MedGenVisuals.bioChart(element, data); } catch (_) {}
  }
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
  const requestToken=state.token;

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

  if(state.token!==requestToken){
    const error=new Error(window.medgenText?.('Session changed. Reopen this section.')||'Session changed. Reopen this section.');
    error.name='AbortError';throw error;
  }

  if (!response.ok) {

    const code = String(data?.detail || '');
    if (response.status === 403 && state.user) {
      if (code === 'LEGAL_CONSENT_REQUIRED') {
        state.user.consent_complete = false;
        const modal = $('legalModal');
        if (modal) {
          modal.classList.remove('hidden');
          modal.style.zIndex = '100200';
          const status = $('legalStatus');
          if (status) status.textContent = 'Ilmiy modullardan foydalanish uchun amaldagi roziliklarni o‘zingiz tasdiqlang.';
          if (typeof ensureLegalConsent === 'function') void ensureLegalConsent();
        }
      } else if (code === 'PROFILE_INCOMPLETE') {
        state.user.profile_complete = false;
        const status = $('profileStatus');
        if (status) status.textContent = 'Ilmiy modullardan foydalanishdan oldin profilingizdagi majburiy maydonlarni to‘ldiring.';
        if (typeof openProfileEditor === 'function') openProfileEditor();
      } else if (code === 'ACADEMIC_APPROVAL_REQUIRED') {
        state.user.academic_status = data?.academic_status || 'pending';
        const status = $('profileStatus');
        if (status) status.textContent = data?.message || 'Akademik ma’lumotlaringiz administrator tasdig‘ini kutmoqda. Tasdiqlanmaguncha fanlar ochilmaydi.';
      }
    }

    const rawMessage =
      data?.message ??
      data?.detail ??
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

  const submitButton = $('loginSubmitBtn');
  if (submitButton) submitButton.disabled = true;

  if (status) {
    status.textContent = 'Kirish so‘rovi yuborilmoqda…';
  }

  try {

    let data =
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

    if (data?.mfa_required) {
      const mfaCode = window.prompt('Google Authenticator kodi (6 xonali) yoki tiklash kodi:') || '';
      if (!mfaCode.trim()) {
        throw new Error('2FA kodi kiritilmadi.');
      }
      data = await api('/auth/2fa/login', {
        method: 'POST',
        body: JSON.stringify({ mfa_token: data.mfa_token, code: mfaCode.trim() })
      });
    }

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
    window.__MEDGEN_USER = state.user;
    if (window.medgenFinalBoot) window.medgenFinalBoot(state.user);
    // Legal consent and complete profile are mandatory after first login.
    await ensureLegalConsent();
    // Never cover the mandatory consent dialog with the profile editor.
    if (state.user?.consent_complete && !isProfileComplete(state.user.profile || {})) {
      openProfileEditor();
    }

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
  } finally {
    if (submitButton) submitButton.disabled = false;
  }
}

// Publish the login handler immediately, before optional startup initializers run.
// This keeps the inline sign-in fallback usable even if a later initializer fails.
window.login = login;

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
  initProfileLocationSelectors();
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
  document.querySelectorAll('#profileModal input, #profileModal textarea, #profileModal select').forEach(el => el.disabled = !state.profileEditMode);
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
    $('profileRegion').value = p.region || '';
    $('profileDistrict').value = p.district || '';
    $('profileRegion').dataset.selected = p.region || '';
    $('profileDistrict').dataset.selected = p.district || '';
    $('profileCity').value = p.city || '';
    $('profileLocationLabel').value = p.location_label || '';
    initProfileLocationSelectors();
    const locationButton = $('detectLocationBtn');
    if (locationButton) {
      locationButton.dataset.lat = p.location_lat ?? '';
      locationButton.dataset.lon = p.location_lon ?? '';
      locationButton.dataset.source = p.location_source || '';
    }
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
    $('profileStudyLanguage') && ($('profileStudyLanguage').value = academicProfile.study_language || 'uz');
    $('profileAcademicDegree') && ($('profileAcademicDegree').value = academicProfile.academic_degree || 'MD/MBBS');

    try {
      if(window.medgenLoadAcademyCatalogForProfile) await window.medgenLoadAcademyCatalogForProfile(academicProfile.country_code||'',academicProfile.university||'');
      if($('profileAcademicCountry'))$('profileAcademicCountry').value=academicProfile.country_code||$('profileAcademicCountry').value;
      if($('profileCountry') && !$('profileCountry').value) $('profileCountry').value=academicProfile.country_code || $('profileAcademicCountry')?.value || 'UZ';
      if($('profileRegion'))$('profileRegion').value=academicProfile.region||p.region||'';
      $('profileRegion')?.dispatchEvent(new Event('change'));
      if($('profileDistrict'))$('profileDistrict').value=academicProfile.district||p.district||'';
    }catch(_){}

    const regionManual = $('profileRegionManual');
    const districtManual = $('profileDistrictManual');
    const regionSelect = $('profileRegion');
    const districtSelect = $('profileDistrict');

    // Assign handlers instead of stacking listeners every time the profile opens.
    // An empty select value can happen while region options are still loading; do
    // not erase the user's manually entered/saved value in that state.
    if (regionSelect) regionSelect.onchange = () => {
      if (regionSelect.value === 'OTHER') {
        regionManual?.focus();
      } else if (regionSelect.value && regionManual) {
        regionManual.value = '';
      }
    };
    if (districtSelect) districtSelect.onchange = () => {
      if (districtSelect.value === 'OTHER') {
        districtManual?.focus();
      } else if (districtSelect.value && districtManual) {
        districtManual.value = '';
      }
    };
    if (regionManual) regionManual.oninput = () => {
      if (regionManual.value && regionSelect) regionSelect.value = 'OTHER';
    };
    if (districtManual) districtManual.oninput = () => {
      if (districtManual.value && districtSelect) districtSelect.value = 'OTHER';
    };

    const profileSaveButton = $('profileSave');
    $('openSecurityFromProfile')?.addEventListener('click', () => {
      closeProfile();
      openSecurityCenter();
    }, {once:true});
    if (profileSaveButton) {
      profileSaveButton.style.display = state.profileEditMode ? '' : 'none';
      profileSaveButton.disabled = false;
      profileSaveButton.textContent = 'Saqlash';
    }
    document.querySelectorAll('#profileModal input, #profileModal textarea, #profileModal select').forEach(el => {
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
  if (!p) return false;
  let role = String(p.role || state.user?.role || state.user?.user_role || '').trim().toLowerCase().replace(/[\s-]+/g, '_');
  if (!(String(p.full_name || '').trim() && String(p.email || '').trim() && String(p.country || '').trim() && String(p.region || '').trim() && String(p.city || '').trim() && String(p.district || '').trim() && Number.isInteger(Number(p.birth_year)) && Number(p.birth_year) >= 1900 && Number(p.birth_year) <= 2100 && Number.isInteger(Number(p.birth_month)) && Number(p.birth_month) >= 1 && Number(p.birth_month) <= 12 && Number.isInteger(Number(p.birth_day)) && Number(p.birth_day) >= 1 && Number(p.birth_day) <= 31)) return false;
  if (['student', 'researcher', 'professor'].includes(role)) {
    const ap = p.academic_profile || {};
    return ['university', 'faculty', 'major', 'group'].every(key => String(ap[key] || '').trim());
  }
  return true;
}

function enforceProfileCompletion() {
  // Never let a module silently fail with API 403: guide the user through
  // explicit legal consent and required profile fields before opening it.
  if (state.user && state.user.consent_complete !== true) {
    void ensureLegalConsent();
    return false;
  }

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
    status.textContent = '⚠️ Modulni ochish uchun profilingizni to‘liq to‘ldiring.';
  }
  openProfileEditor();
  return false;
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
      region: $('profileRegionManual')?.value?.trim() || (($('profileRegion')?.value === 'OTHER') ? '' : ($('profileRegion')?.value?.trim() || '')),
      district: $('profileDistrictManual')?.value?.trim() || (($('profileDistrict')?.value === 'OTHER') ? '' : ($('profileDistrict')?.value?.trim() || '')),
      city: $('profileCity')?.value?.trim() || '',
      location_label: $('profileLocationLabel')?.value?.trim() || '',
      location_lat: coordinateValue($('detectLocationBtn')?.dataset?.lat),
      location_lon: coordinateValue($('detectLocationBtn')?.dataset?.lon),
      location_source: $('detectLocationBtn')?.dataset?.source || '',
      birth_year: birthYearRaw ? Number(birthYearRaw) : null,
      birth_month: birthMonthRaw ? Number(birthMonthRaw) : null,
      birth_day: birthDayRaw ? Number(birthDayRaw) : null,
      research_interests: $('profileInterests')?.value?.trim() || '',
      bio: $('profileBio')?.value?.trim() || '',
      avatar: savedAvatar
    };

    const role = typeof roleKey === 'function' ? roleKey() : String(state.user?.role || '').toLowerCase();
    if (!payload.full_name || !payload.email || !payload.country || !payload.region ||
        !payload.district || !payload.city || payload.birth_year === null ||
        payload.birth_month === null || payload.birth_day === null) {
      throw new Error('Profilni to‘liq to‘ldiring: ism, email, mamlakat, viloyat, tuman, shahar va tug‘ilgan sana majburiy.');
    }

    if (['student','researcher','professor'].includes(role)) {
      if (!$('profileUniversity')?.value?.trim() || !$('profileFaculty')?.value?.trim() ||
          !$('profileMajor')?.value?.trim() || !$('profileGroup')?.value?.trim() ||
          !$('profileStudentId')?.value?.trim()) {
        throw new Error('Ta’lim profili ham to‘liq bo‘lishi kerak: universitet, fakultet, yo‘nalish, guruh va talaba ID.');
      }
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

    // The core profile is saved above. Keep optional account/academy updates
    // independent so one secondary endpoint cannot make a successful profile
    // save appear to fail or prevent the saved profile from being cached.
    const saveWarnings = [];
    let savedAcademicProfile = null;

    try {
      await api('/account', {
        method: 'PATCH',
        body: JSON.stringify({
          username: $('profileUsername')?.value?.trim() || undefined,
          phone: payload.phone,
          email: payload.email
        })
      });
    } catch (e) {
      saveWarnings.push('Telefon/akkaunt ma’lumotlari serverga to‘liq yozilmadi: ' + e.message);
    }

    try {
      savedAcademicProfile = await api('/academy/profile', {
        method: 'PUT',
        body: JSON.stringify({
          education_mode: $('profileEducationMode')?.value || 'GLOBAL',
          country_code: ($('profileAcademicCountry')?.value || '').trim().toUpperCase(),
          region: payload.region,
          district: payload.district,
          city: payload.city,
          location_label: payload.location_label,
          location_lat: payload.location_lat,
          location_lon: payload.location_lon,
          location_source: payload.location_source,
          university: $('profileUniversity')?.value?.trim() || '',
          faculty: $('profileFaculty')?.value?.trim() || '',
          major: $('profileMajor')?.value?.trim() || '',
          year: Number($('profileAcademicYear')?.value || 1),
          group: $('profileGroup')?.value?.trim() || '',
          student_id: $('profileStudentId')?.value?.trim() || '',
          study_language: $('profileStudyLanguage')?.value || 'uz',
          academic_degree: $('profileAcademicDegree')?.value?.trim() || 'MD/MBBS'
        })
      });
    } catch (e) {
      saveWarnings.push('Ta’lim profili alohida saqlanmadi: ' + e.message);
    }

    if (state.user) {
      state.user.profile = { ...(data.profile || {}), ...(savedAcademicProfile?.profile ? { academic_profile: savedAcademicProfile.profile } : {}) };
      state.user.profile_complete = isProfileComplete(state.user.profile);
      try {
        localStorage.setItem(
          'medgen_profile_' + state.user.username,
          JSON.stringify(state.user.profile)
        );
      } catch (_) {}
    }

    document.querySelectorAll('.profile-locked').forEach(el => el.classList.remove('profile-locked'));

    state.profileEditMode = false;
    document.querySelectorAll('#profileModal input, #profileModal textarea, #profileModal select').forEach(el => el.disabled = true);
    if (status) status.textContent = saveWarnings.length
      ? '⚠️ Asosiy profil saqlandi. ' + saveWarnings.join(' ')
      : '✅ Profil muvaffaqiyatli saqlandi.';
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
  if (!state.user || state.user.consent_complete) return;
  const modal = $('legalModal');
  if (!modal) return;
  modal.style.zIndex = '100200';
  const requiredChecks = ['consentTerms','consentPrivacy','consentData','consentResearch'].map(id => $(id)).filter(Boolean);
  const acceptButton = $('legalAccept');
  const updateConsentButton = () => {
    if (acceptButton) acceptButton.disabled = !requiredChecks.length || !requiredChecks.every(el => el.checked);
  };
  requiredChecks.forEach(el => el.addEventListener('change', updateConsentButton));
  updateConsentButton();
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
  const required = ['consentTerms','consentPrivacy','consentData','consentResearch'];
  if (!required.every(id => $(id)?.checked)) {
    if (status) status.textContent = 'Davom etish uchun barcha hujjatlarni o‘qib, har bir rozilik katagini o‘zingiz belgilang.';
    return;
  }
  const button = $('legalAccept');
  if (button) button.disabled = true;
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
    if (!state.user?.profile_complete) openProfileEditor();
  } catch (e) {
    if (status) status.textContent = e.message;
    if (button) button.disabled = false;
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
    state.user?.profile?.role ||
    ''
  ).trim().toLowerCase().replace(/[\s-]+/g, '_');
  return ['super_admin', 'superadmin', 'admin', 'founder', 'ceo', 'owner'].includes(role);
}

async function loadAdminDashboard() {
  if (!isSuperAdmin()) return;
  const box = $('adminDashboard');
  if (!box) return;

  try {
    const d = await api('/admin/overview');
    let academicApprovals = { pending: [], reviewed: [] };
    try { academicApprovals = await api('/admin/academic-approvals'); } catch (_) {}

    const cards = [
      ['Academic approvals', (academicApprovals.pending || []).length, 'academic-approvals'],
      ['Rasmiy fan dasturlari', 0, 'syllabi'],
      ['Professor–talaba ruxsatlari', '→', 'teaching-assignments'],
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
        '<div>' + escapeHtml(c[2] === 'teaching-assignments' ? c[0] : t(c[2] === 'tokens' ? 'activeTokens' : c[2])) + '</div>' +
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

  if (kind === 'teaching-assignments') {
    out.textContent = 'Yuklanmoqda…';
    try {
      const data = await api('/admin/academy/teaching-assignments');
      if (!data.professors.length) { out.textContent = 'Faol professorlar mavjud emas.'; return; }
      out.innerHTML = '<h3>Professor–talaba ruxsatlari</h3><p>Professor faqat biriktirilgan talabalar natijalarini ko‘radi. Barcha belgilarni olib tashlab saqlash ruxsatlarni bekor qiladi.</p>' +
        '<label>Professor <select id="teachingProfessor">' + data.professors.map(p =>
          '<option value="' + escapeHtml(p.username) + '">' + escapeHtml(p.full_name + ' (' + p.username + ')') + '</option>').join('') +
        '</select></label><div id="teachingStudents"></div><button type="button" id="saveTeaching">Saqlash</button><p id="teachingStatus" role="status"></p>';
      const select = $('teachingProfessor'), list = $('teachingStudents'), save = $('saveTeaching'), status = $('teachingStatus');
      const render = () => {
        const assigned = new Set(data.professors.find(p => p.username === select.value)?.students || []);
        list.innerHTML = data.students.length ? data.students.map(p => '<label style="display:block"><input type="checkbox" value="' + escapeHtml(p.username) + '"' + (assigned.has(p.username) ? ' checked' : '') + '> ' + escapeHtml(p.full_name + ' (' + p.username + ')') + '</label>').join('') : '<p>Faol talabalar mavjud emas.</p>';
        status.textContent = '';
      };
      select.onchange = render;
      render();
      save.onclick = async () => {
        const professor = select.value;
        const students = Array.from(list.querySelectorAll('input:checked'), input => input.value);
        save.disabled = select.disabled = true;
        status.textContent = 'Saqlanmoqda…';
        try {
          const result = await api('/admin/academy/teaching-assignments/' + encodeURIComponent(professor), {method:'PUT', body:JSON.stringify({students})});
          data.professors.find(p => p.username === professor).students = result.students;
          status.textContent = 'Ruxsatlar saqlandi.';
        } catch (e) { status.textContent = 'Saqlanmadi: ' + e.message; }
        finally { save.disabled = select.disabled = false; }
      };
    } catch (e) { out.textContent = 'Yuklash xatosi: ' + e.message; }
    return;
  }

  if (kind === 'syllabi') {
    out.innerHTML = '<h3>Rasmiy fan dasturini kiritish</h3>' +
      '<p>Universitet tasdiqlagan hujjatdagi ma’lumotlarni kiriting. Yuborilgan dastur administrator tekshiruvidan o‘tmaguncha talabalarga ko‘rsatilmaydi.</p>' +
      '<div class="grid" style="gap:10px">' +
      '<label>Universitet<input id="syllabusUniversity" required></label>' +
      '<label>Fakultet<input id="syllabusFaculty"></label>' +
      '<label>Yo‘nalish<input id="syllabusMajor" required></label>' +
      '<label>Kurs (1–6)<input id="syllabusYear" type="number" min="1" max="6" value="1"></label>' +
      '<label>Semestr<input id="syllabusSemester" type="number" min="1" max="12" value="1"></label>' +
      '<label>O‘quv yili<input id="syllabusAcademicYear" placeholder="2026–2027"></label>' +
      '<label>Manba fayl nomi<input id="syllabusSource" placeholder="fan_dasturi.pdf"></label>' +
      '<label>Fanlar va mavzular — JSON<textarea id="syllabusSubjects" rows="10" placeholder=\'[{"subject":"Anatomiya","topics":["Suyaklar","Mushaklar"],"practicals":["Suyaklarni aniqlash"],"teacher":"F.I.Sh."}]\'></textarea></label>' +
      '</div><button type="button" id="syllabusImportBtn">Tekshiruvga yuborish</button> <span id="syllabusImportStatus" class="status"></span>' +
      '<hr><h3>Kiritilgan fan dasturlari</h3><div id="syllabusQueue" class="status">Yuklanmoqda...</div>';
    const reload = async () => {
      const queue = $('syllabusQueue');
      try {
        const data = await api('/admin/academy/syllabi');
        const list = Array.isArray(data.syllabi) ? data.syllabi : [];
        queue.innerHTML = list.length ? list.map(item =>
          '<article style="border:1px solid rgba(255,255,255,.16);border-radius:12px;padding:12px;margin:10px 0">' +
          '<strong>' + escapeHtml(item.university) + ' — ' + escapeHtml(item.major) + '</strong>' +
          '<div>Fakultet: ' + escapeHtml(item.faculty || '—') + ' | Kurs: ' + item.year + ' | Semestr: ' + item.semester + '</div>' +
          '<div>Fanlar: ' + (item.subjects || []).length + ' | Holat: ' + escapeHtml(item.status) + '</div>' +
          '<details><summary>Mavzularni ko‘rish</summary><pre style="white-space:pre-wrap">' + escapeHtml(JSON.stringify(item.subjects || [], null, 2)) + '</pre></details>' +
          (item.status === 'pending_review' ? '<button data-syllabus-action="publish" data-syllabus-id="' + escapeHtml(item.id) + '">Nashr qilish</button> <button data-syllabus-action="reject" data-syllabus-id="' + escapeHtml(item.id) + '">Rad etish</button>' : '') +
          '</article>'
        ).join('') : 'Hozircha fan dasturlari kiritilmagan.';
        queue.querySelectorAll('[data-syllabus-action]').forEach(btn => btn.addEventListener('click', async () => {
          const publish = btn.dataset.syllabusAction === 'publish';
          const note = publish ? '' : (prompt('Rad etish sababi:') || '');
          if (!publish && !note.trim()) return;
          btn.disabled = true;
          try {
            await api('/admin/academy/syllabi/' + encodeURIComponent(btn.dataset.syllabusId) + '?publish=' + publish + '&note=' + encodeURIComponent(note), {method:'PATCH'});
            await reload();
          } catch (e) { alert('Xatolik: ' + e.message); btn.disabled = false; }
        }));
      } catch (e) { queue.textContent = 'Yuklash xatosi: ' + e.message; }
    };
    $('syllabusImportBtn')?.addEventListener('click', async () => {
      const status = $('syllabusImportStatus');
      let subjects;
      try { subjects = JSON.parse($('syllabusSubjects').value || '[]'); }
      catch (_) { status.textContent = 'JSON formati noto‘g‘ri.'; return; }
      const payload = {
        university: $('syllabusUniversity').value.trim(),
        faculty: $('syllabusFaculty').value.trim(),
        major: $('syllabusMajor').value.trim(),
        year: Number($('syllabusYear').value),
        semester: Number($('syllabusSemester').value),
        academic_year: $('syllabusAcademicYear').value.trim(),
        source_filename: $('syllabusSource').value.trim(),
        subjects
      };
      if (!payload.university || !payload.major || !Array.isArray(subjects) || !subjects.length) {
        status.textContent = 'Universitet, yo‘nalish va kamida bitta fan kerak.'; return;
      }
      status.textContent = 'Yuborilmoqda...';
      try {
        await api('/admin/academy/syllabi', {method:'POST', body:JSON.stringify(payload)});
        status.textContent = 'Tekshiruvga yuborildi. Nashr qilingandan keyin mos talabalar ko‘radi.';
        await reload();
      } catch (e) { status.textContent = 'Xatolik: ' + e.message; }
    });
    reload();
    return;
  }

  if (kind === 'academic-approvals') {
    out.innerHTML = '<div class="status">Akademik tasdiqlar yuklanmoqda...</div>';
    try {
      const data = await api('/admin/academic-approvals');
      const pending = Array.isArray(data.pending) ? data.pending : [];
      const reviewed = Array.isArray(data.reviewed) ? data.reviewed : [];
      const renderStudent = (student, isPending) => {
        const ap = student.academic_profile || {};
        const fields = [
          ['Universitet', ap.university], ['Fakultet', ap.faculty],
          ['Yo‘nalish', ap.major], ['Kurs', ap.year],
          ['Guruh', ap.group], ['Talaba ID', ap.student_id]
        ].map(([label, value]) => '<div><strong>' + escapeHtml(label) + ':</strong> ' + escapeHtml(value == null ? '' : String(value)) + '</div>').join('');
        return '<article style="border:1px solid rgba(255,255,255,.16);border-radius:12px;padding:14px;margin:10px 0">' +
          '<h4 style="margin:0 0 8px">' + escapeHtml(student.full_name || student.username) + ' (' + escapeHtml(student.username) + ')</h4>' +
          '<div>' + escapeHtml(student.email || '') + '</div><div style="display:grid;gap:5px;margin:10px 0">' + fields + '</div>' +
          (isPending
            ? '<button type="button" data-academic-review="approve" data-username="' + escapeHtml(student.username) + '">Tasdiqlash</button> ' +
              '<button type="button" data-academic-review="reject" data-username="' + escapeHtml(student.username) + '">Rad etish</button>'
            : '<div class="status">Holat: ' + escapeHtml(student.academic_status || '') + ' — ' + escapeHtml((student.academic_review || {}).note || '') + '</div>') +
          '</article>';
      };
      out.innerHTML = '<h3>Akademik ma’lumotlarni tasdiqlash</h3>' +
        '<p>Talaba kurslari va fanlariga kirish faqat tasdiqlangandan keyin ochiladi.</p>' +
        '<h4>Kutilmoqda (' + pending.length + ')</h4>' +
        (pending.length ? pending.map(x => renderStudent(x, true)).join('') : '<p class="muted">Tasdiqlash kutilayotgan talabalar yo‘q.</p>') +
        '<h4>Ko‘rib chiqilgan (' + reviewed.length + ')</h4>' +
        reviewed.map(x => renderStudent(x, false)).join('');
      out.querySelectorAll('[data-academic-review]').forEach(button => {
        button.addEventListener('click', async () => {
          const username = button.dataset.username;
          const approve = button.dataset.academicReview === 'approve';
          const note = approve ? '' : (window.prompt('Rad etish sababini kiriting:') || '');
          if (!approve && !note.trim()) return;
          button.disabled = true;
          try {
            await api('/admin/academic-approvals/' + encodeURIComponent(username) +
              '?approve=' + String(approve) + '&note=' + encodeURIComponent(note), { method: 'PATCH' });
            await loadAdminDetails('academic-approvals');
            await loadAdminDashboard();
          } catch (error) {
            alert('Tasdiqlashda xatolik: ' + error.message);
            button.disabled = false;
          }
        });
      });
    } catch (error) {
      out.innerHTML = '<div class="status">❌ ' + escapeHtml(error.message) + '</div>';
    }
    return;
  }

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
  const container = $('dashboardView')?.querySelector('.container');
  if (!container) return;
  const box = document.createElement('section');
  box.id = 'adminDashboard';
  box.className = 'admin-dashboard-section hidden';
  container.appendChild(box);
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
  const previousToken = state.token;
  // Leave immediately even when a sleeping/offline server cannot revoke yet.
  state.token = '';
  state.user = null;
  window.__MEDGEN_USER = null;
  window.__MEDGEN_COMMUNITY_ROLE = null;
  window.__MEDGEN_OPENED_MODULE = null;
  state.lastResearchData = null;
  state.profileEditMode = false;
  document.querySelectorAll('#dashboardView .result,#labSummary,#adminDetails,#reportsList,#reportsPagination,#reportsSelectedTitle,#researchEvidence').forEach(el=>el.replaceChildren());
  document.querySelectorAll('#dashboardView input,#dashboardView textarea,#profileModal input,#profileModal textarea').forEach(el=>{
    if(el.type==='checkbox'||el.type==='radio')el.checked=false;else el.value='';
  });
  ['learningHubWorkspace','doctorClinicalWorkspace'].forEach(id=>document.getElementById(id)?.remove());
  if($('reportsDetail'))$('reportsDetail').hidden=true;
  if($('reportsDownload'))$('reportsDownload').onclick=null;
  document.getElementById('legalModal')?.classList.add('hidden');
  document.getElementById('functionalService')?.remove();
  document.getElementById('opportunitiesPanel')?.remove();
  document.getElementById('finalHome')?.remove();
  ['moleculeVisualPanel','scientificWorkflowPanel'].forEach(id=>document.getElementById(id)?.classList.add('hidden'));
  document.getElementById('finalMenuDrawer')?.classList.remove('open');
  document.querySelectorAll('.nav-drawer,.nav-backdrop,#profileModal,#consentModal').forEach(el=>el.classList.add('hidden'));

  sessionStorage.removeItem(
    TOKEN_KEY
  );
  showLogin();
  window.medgenPhase1Shell?.sync?.();

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
  if (previousToken) {
    const controller = new AbortController();
    const timer = setTimeout(()=>controller.abort(),5000);
    fetch(API_BASE+'/auth/logout', {method:'POST',headers:{Authorization:'Bearer '+previousToken},signal:controller.signal})
      .catch(()=>{}).finally(()=>clearTimeout(timer));
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

  $('moleculeVisualPanel')?.classList.add('hidden');

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

  $('adminDashboard')?.classList.add('hidden');
  $('securityCenter')?.classList.add('hidden');
  $('userDirectoryDashboard')?.classList.add('hidden');
  $('educationPreferencePanel')?.classList.add('hidden');
  const finalHome = $('finalHome');
  if (finalHome) {
    finalHome.style.removeProperty('display');
    finalHome.classList.remove('hidden');
    $('roleDashboard')?.classList.add('hidden');
  } else {
    $('roleDashboard')?.classList.remove('hidden');
  }
}


/* =========================================================
   MODULES
========================================================= */

function openModule(moduleName) {

  // Let dashboard wrappers know whether the module was actually allowed to open.
  window.__MEDGEN_OPENED_MODULE = null;
  if (!enforceProfileCompletion() && !(moduleName === 'Medical Academy' && state.user?.consent_complete === true)) return;

  window.__MEDGEN_OPENED_MODULE = moduleName;
  $('roleDashboard')?.classList.add('hidden');
  $('userDirectoryDashboard')?.classList.add('hidden');
  $('securityCenter')?.classList.add('hidden');
  $('educationPreferencePanel')?.classList.add('hidden');
  $('adminDashboard')?.classList.add('hidden');

  openWorkspace(moduleName);
  // A consistent orientation strip for every scientific/education workspace.
  const guideConfig = {
    'Medical Academy': ['Ta’lim markazi', 'Fan va kursni tanlang', 'Darsni o‘rganing', 'Mashq natijasini tekshiring'],
    'Learning Hub': ['Ta’lim markazi', 'Mashqni tanlang', 'Javoblarni yuboring', 'Saqlangan natijani ko‘ring'],
    'Bioinformatics': ['Bioinformatika', 'Ketma-ketlikni kiriting', 'Tahlilni ishga tushiring', 'Natijani tekshiring'],
    'Molecular Analysis': ['Molekula va 3D', 'SMILES kiriting', 'Xossalarni hisoblang', 'Natijani solishtiring'],
    'PDB & Structure': ['Molekula va 3D', 'PDB identifikatorini kiriting', 'Tuzilmani yuklang', 'Modelni tekshiring'],
    'Drug Discovery': ['Molekula va 3D', 'Kirish ma’lumotini tayyorlang', 'Hisoblash usulini tanlang', 'Cheklovlar bilan baholang'],
    'Research Assistant': ['Ilmiy tadqiqot', 'Ilmiy savolni yozing', 'Manbalarni qidiring', 'Dalillarni tekshiring'],
    'Virtual Laboratory': ['Virtual laboratoriya', 'Ish jarayonini tanlang', 'Bosqichlarni bajaring', 'Hisobotni ko‘ring'],
    'Scientific Jobs': ['Virtual laboratoriya', 'Vazifani tanlang', 'Holatini kuzating', 'Natijani tekshiring'],
    'Global Platform': ['Boshqaruv paneli', 'Tashkilotni tanlang', 'Loyiha va a’zolar', 'Ruxsatlarni tekshiring'],
    'Reports & History': ['Natijalar tarixi', 'Hisobotni tanlang', 'Tafsilotlarni ko‘ring', 'Natijani tekshiring']
  };
  let guide = $('workspaceGuide');
  if (!guide) {
    guide = document.createElement('section'); guide.id = 'workspaceGuide';
    guide.setAttribute('aria-label', 'Bo‘limdan foydalanish tartibi');
    $('workspace')?.querySelector('.workspace-head')?.after(guide);
  }
  const steps = guideConfig[moduleName];
  guide.classList.toggle('hidden', !steps);
  if (steps) {
    guide.innerHTML = '<p class="workspace-breadcrumb">Kabinet / '+escapeHtml(steps[0])+'</p><ol>'+steps.slice(1).map((text,i)=>'<li><span>'+ (i+1) +'</span>'+escapeHtml(text)+'</li>').join('')+'</ol>';
  }

  document
    .querySelectorAll('.tool')
    .forEach(tool => {
      tool.classList.add('hidden');
    });

  if (moduleName === 'Learning Hub') {
    let hub = $('learningHubWorkspace');
    if (!hub) { hub = document.createElement('section'); hub.id = 'learningHubWorkspace'; hub.className = 'tool hidden'; $('workspace')?.appendChild(hub); }
    hub.innerHTML = '<div class="academy-v2"><p class="eyebrow">MEDGEN AI ACADEMY</p><h3>🌍 O‘rganish markazi</h3><p class="muted">Tillar, sertifikat imtihonlari va tibbiy bilimlarni bir joyda mashq qiling. Bu mashqlar tayyorgarlik uchun; rasmiy sertifikat yoki imtihon o‘rnini bosmaydi.</p><div class="grid"><article class="panel"><h4>🗣️ Til kurslari</h4><label>Til<select id="hubLanguage"><option value="en">Ingliz tili</option><option value="ru">Rus tili</option><option value="de">Nemis tili</option><option value="fr">Fransuz tili</option></select></label><label>Yo‘nalish<select id="hubLanguageTrack"><option value="medical">Tibbiyot uchun</option><option value="general">Umumiy muloqot</option><option value="exam">Sertifikat imtihoni</option></select></label><button class="primary" id="hubStartLanguage" type="button">Darsni boshlash</button><div id="hubLanguageLesson" class="status" role="status">Til va yo‘nalishni tanlang.</div></article><article class="panel"><h4>🎮 Tezkor bilim o‘yini</h4><p>Biologiya va tibbiyot terminlari bo‘yicha savolga javob bering, ball to‘plang.</p><button class="primary" id="hubStartGame" type="button">O‘yinni boshlash</button><div id="hubGame" class="status" role="status"></div></article><article class="panel"><h4>🎯 Imtihonga tayyorgarlik</h4><label>Imtihon<select id="hubExam"><option>IELTS</option><option>USMLE</option><option>Milliy sertifikat</option><option>Xalqaro fan olimpiadasi</option></select></label><label>Mavzu<input id="hubExamTopic" maxlength="160" placeholder="Masalan: hujayra tuzilishi"></label><button class="primary" id="hubExamPlan" type="button">Mashq rejasini tuzish</button><div id="hubExamResult" class="status" role="status"></div></article><article class="panel" style="grid-column:1/-1"><h4>🕹️ Organlarni joyiga qo‘y — haqiqiy mini-o‘yin</h4><p>Organni tanlang, so‘ng tanadagi mos joyini bosing. 60 soniyada imkon qadar ko‘pini to‘g‘ri joylashtiring.</p><div id="organGame" style="padding:14px;border-radius:16px;background:linear-gradient(135deg,#101b2b,#173c52);color:#fff"><div style="display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap"><b id="organGameScore">Ball: 0</b><b id="organGameTime">Vaqt: 60 s</b><b id="organGameProgress">0/5</b></div><div id="organGameFeedback" role="status" style="min-height:28px;margin:10px 0">Boshlash tugmasini bosing!</div><div id="organGameChoices" style="display:flex;gap:8px;flex-wrap:wrap;margin:12px 0"></div><div id="organGameBoard" style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px"></div><button type="button" class="primary" id="organGameStart" style="margin-top:12px">🎮 O‘yinni boshlash</button></div></article><article class="panel"><h4>🧬 3D biologiya animatsiyasi</h4><p>Hujayra modelini aylantirib, tuzilishini ko‘ring. Bu o‘quv uchun sxematik model.</p><div id="hubCell3D" role="img" aria-label="Aylanuvchi hujayraning 3D o‘quv modeli" style="height:240px;width:100%;border-radius:12px;overflow:hidden;background:#101b2b"></div><div id="hubCell3DStatus" class="status" role="status">3D model yuklanmoqda…</div></article><article class="panel" style="grid-column:1/-1"><h4>📚 Haqiqiy nazariya darslari</h4><p>Mavzuni tanlang: qisqa nazariya, asosiy tushunchalar va o‘zingizni tekshirish savoli chiqadi.</p><label>Mavzu<select id="hubTheoryTopic"><option value="cell">Hujayra biologiyasi</option><option value="blood">Qon va qon hujayralari</option><option value="heart">Yurak va qon aylanishi</option><option value="dna">DNK va genetika</option><option value="micro">Mikrobiologiya</option></select></label><button type="button" class="primary" id="hubTheoryOpen">📖 Darsni ochish</button><div id="hubTheoryContent" class="status" role="status">Darsni ochish tugmasini bosing.</div></article><article class="panel"><h4>🧪 Nazariy imtihon</h4><p>5 ta savol, javobni tanlagandan keyin izoh va yakuniy ball.</p><button type="button" class="primary" id="hubTheoryExamStart">Nazariy imtihonni boshlash</button><div id="hubTheoryExam" class="status" role="status"></div></article><article class="panel"><h4>🩺 Amaliy klinik imtihon</h4><p>Vaziyatli savollar orqali klinik fikrlashni mashq qiling. Bu tashxis yoki shifokor maslahati emas.</p><button type="button" class="primary" id="hubClinicalStart">Amaliy imtihonni boshlash</button><div id="hubClinicalExam" class="status" role="status"></div></article><article class="panel"><h4>🧩 Molekula moslashtirish o‘yini</h4><p>Molekula yoki biomolekula nomini uning vazifasi bilan moslang. Har to‘g‘ri javob +10 ball.</p><button type="button" class="primary" id="hubMoleculeStart">O‘yinni boshlash</button><div id="hubMoleculeGame" class="status" role="status"></div></article><article class="panel"><h4>🏆 Musobaqalar va yutuqlar</h4><p>Bu bosqichda o‘quv mashqlari mavjud. Rasmiy musobaqa jadvali va tasdiqlanadigan sertifikatlar alohida integratsiya qilinadi.</p><div id="hubAchievement" class="status">Mashqni yakunlab o‘z natijangizni kuzating.</div></article></div></div>';
    const hubToken = state.token;
    const progressBox = document.createElement('div');
    progressBox.id = 'hubProgress'; progressBox.tabIndex = -1;
    progressBox.className = 'panel'; progressBox.setAttribute('aria-live', 'polite');
    hub.querySelector('.academy-v2').appendChild(progressBox);
    const historyNav = document.createElement('nav'); historyNav.className = 'hub-history-nav';
    historyNav.setAttribute('aria-label', 'O‘quv natijalari');
    const historyButton = document.createElement('button'); historyButton.type = 'button';
    historyButton.className = 'ghost'; historyButton.textContent = 'Natijalar tarixini ko‘rish ↓';
    historyButton.onclick = () => { progressBox.scrollIntoView({block:'start'}); progressBox.focus({preventScroll:true}); };
    historyNav.appendChild(historyButton); hub.querySelector('.academy-v2 > .grid').before(historyNav);
    const refreshHubProgress = async () => {
      progressBox.textContent = 'Saqlangan natijalar yuklanmoqda…';
      try {
        const data = await api('/learning-hub/progress');
        if (!progressBox.isConnected || state.token !== hubToken) return;
        const labels = {quick:'Tezkor bilim', theory:'Nazariy mashq', clinical:'Klinik mashq', molecule:'Molekulalar',organ:'Organlarni joylashtirish',lesson_cell:'Hujayra darsi',lesson_blood:'Qon darsi',lesson_heart:'Yurak darsi',lesson_dna:'DNK darsi',lesson_micro:'Mikrobiologiya darsi'};
        progressBox.innerHTML = '<h4>Saqlangan mashq natijalari</h4><p>Oxirgi 100 urinish saqlanadi. Bu rasmiy baho yoki sertifikat emas.</p>' +
          (data.attempts.length ? '<ul>'+data.attempts.slice(0,10).map(a=>'<li><span>'+escapeHtml(labels[a.activity]||a.activity)+'</span>: '+a.score+'/'+a.total+' ('+a.percent+'%) · '+escapeHtml(new Date(a.created_at).toLocaleString())+'</li>').join('')+'</ul>' : '<p>Hali saqlangan natija yo‘q.</p>') + '<p><span>O‘qilgan til mini-darslari (o‘zingiz belgilagan):</span> '+Object.keys(data.readings||{}).length+'/12.</p>';
      } catch (error) {
        if (progressBox.isConnected && state.token === hubToken) {
          progressBox.innerHTML='<span>Natijalar tarixi ochilmadi.</span> <span>Muammoni bartaraf etgach, o‘quv markazini qayta oching.</span>';
          const detail=document.createElement('p');detail.textContent=error?.message||'';progressBox.appendChild(detail);
        }
      }
    };
    const saveHubAttempt = (activity, answers, questionIds, box) => {
      const payload = {attempt_id:crypto.randomUUID(), activity, answers:[...answers], question_ids:[...questionIds], version:1};
      const status = document.createElement('div'); status.setAttribute('role','status'); box.appendChild(status);
      const send = async () => {
        if (state.token !== hubToken || !status.isConnected) return;
        status.textContent = 'Natija serverga saqlanmoqda…';
        try {
          const data = await api('/learning-hub/attempts',{method:'POST',body:JSON.stringify(payload)});
          if (state.token !== hubToken || !status.isConnected) return;
          status.innerHTML = '<span>'+(data.storage==='postgresql'?'Bazaga saqlandi:':'Vaqtinchalik server xotirasida:')+'</span> '+Number(data.attempt.score)+'/'+Number(data.attempt.total)+'.'+(data.storage==='postgresql'?'':' <span>Server qayta ishga tushsa yo‘qolishi mumkin.</span>');
          refreshHubProgress();
        } catch (_) {
          if (state.token !== hubToken || !status.isConnected) return;
          status.textContent = 'Saqlash tasdiqlanmadi. ';
          const retry = document.createElement('button'); retry.type='button'; retry.textContent='Qayta saqlash'; retry.onclick=send; status.appendChild(retry);
        }
      };
      send();
    };
    refreshHubProgress();
    const lessons = {
      en:{medical:[['symptom','alomat'],['treatment','davolash'],['blood pressure','qon bosimi']],general:[['Good morning','Xayrli tong'],['How are you?','Qalaysiz?'],['Thank you','Rahmat']],exam:[['reading','o‘qib tushunish'],['listening','tinglab tushunish'],['speaking','gapirish']]},
      ru:{medical:[['симптом','alomat'],['лечение','davolash'],['артериальное давление','qon bosimi']],general:[['Здравствуйте','Salom'],['Как дела?','Ishlaringiz qalay?'],['Спасибо','Rahmat']],exam:[['чтение','o‘qish'],['аудирование','tinglab tushunish'],['говорение','gapirish']]},
      de:{medical:[['das Symptom','alomat'],['die Behandlung','davolash'],['der Blutdruck','qon bosimi']],general:[['Guten Morgen','Xayrli tong'],['Wie geht es Ihnen?','Qalaysiz?'],['Danke','Rahmat']],exam:[['Lesen','o‘qish'],['Hören','tinglash'],['Sprechen','gapirish']]},
      fr:{medical:[['le symptôme','alomat'],['le traitement','davolash'],['la tension artérielle','qon bosimi']],general:[['Bonjour','Salom'],['Comment allez-vous?','Qalaysiz?'],['Merci','Rahmat']],exam:[['lecture','o‘qish'],['écoute','tinglash'],['expression orale','gapirish']]}
    };
    $('hubStartLanguage')?.addEventListener('click',()=>{const lang=$('hubLanguage')?.value||'en',track=$('hubLanguageTrack')?.value||'medical',items=lessons[lang]?.[track]||[];const box=$('hubLanguageLesson');if(box)box.innerHTML='<b>Bugungi mini-dars</b><ol>'+items.map(x=>'<li><b>'+escapeHtml(x[0])+'</b> — '+escapeHtml(x[1])+'</li>').join('')+'</ol><p>Har bir iborani ovoz chiqarib o‘qing va o‘zingiz gap tuzing.</p>';
      const complete=document.createElement('button');complete.type='button';complete.textContent='O‘qib chiqdim';box.appendChild(complete);
      complete.onclick=async()=>{
        if(state.token!==hubToken)return;complete.disabled=true;
        try{const result=await api('/learning-hub/readings',{method:'POST',body:JSON.stringify({language:lang,track})});
          if(state.token!==hubToken||!complete.isConnected)return;
          complete.textContent=result.storage==='postgresql'?'O‘qilgan deb saqlandi':'Vaqtinchalik xotirada belgilandi';refreshHubProgress();
        }catch(_){if(complete.isConnected){complete.disabled=false;complete.textContent='Saqlanmadi — qayta urinish';}}
      };
    });
    const gameQuestions=[
      {q:'“Blood pressure” nimani anglatadi?',opts:['Qon bosimi','Qon guruhi','Yurak urishi'],correct:0},
      {q:'Qaysi organ qonni haydaydi?',opts:['O‘pka','Yurak','Buyrak'],correct:1},
      {q:'“Symptom” so‘zining ma’nosi?',opts:['Davolash','Alomat','Tahlil'],correct:1},
      {q:'Inglizcha “kidney” qaysi a’zo?',opts:['Jigar','Buyrak','Oshqozon'],correct:1},
      {q:'“Здоровье” so‘zi o‘zbekchada nima?',opts:['Kasallik','Sog‘liq','Dori'],correct:1},
      {q:'Fotosintez asosan qayerda sodir bo‘ladi?',opts:['Barglarda','Ildiz uchida','Gul changida'],correct:0},
      {q:'Qonning kislorod tashishida qaysi hujayra muhim?',opts:['Eritrotsit','Trombotsit','Neyron'],correct:0},
      {q:'Inglizcha “to learn” nimani bildiradi?',opts:['O‘qitmoq','O‘rganmoq','Yozmoq'],correct:1},
      {q:'“Лёгкие” qaysi a’zolar?',opts:['O‘pka','Buyraklar','Ichaklar'],correct:0},
      {q:'DNKning asosiy vazifasi nima?',opts:['Genetik axborotni saqlash','Ovqatni hazm qilish','Qonni haydash'],correct:0},
      {q:'Inglizcha “careful” so‘zi nimani anglatadi?',opts:['Ehtiyotkor','Charchagan','Tezkor'],correct:0},
      {q:'Miya va orqa miya qaysi tizimga kiradi?',opts:['Nafas olish','Asab tizimi','Ovqat hazm qilish'],correct:1}
    ];
    let gameIndex=0,gameScore=0,gameAnswers=[];
    const showGame=()=>{
      const box=$('hubGame');if(!box)return;
      if(gameIndex>=gameQuestions.length){
        box.innerHTML='<b><span>Natija</span>: '+gameScore+'/'+gameQuestions.length+'</b><p><span>Ball</span>: '+(gameScore*10)+' XP. <span>Yana mashq qilib natijani yaxshilashingiz mumkin.</span></p>';
        $('hubAchievement').innerHTML='<span>Oxirgi mini-o‘yin natijasi</span>: '+gameScore+'/'+gameQuestions.length;
        saveHubAttempt('quick',gameAnswers,gameQuestions.map((_,i)=>i),box);return;
      }
      const q=gameQuestions[gameIndex];
      box.innerHTML='<p><b><span>Savol</span> '+(gameIndex+1)+'/'+gameQuestions.length+': <span>'+escapeHtml(q.q)+'</span></b></p>'+q.opts.map((o,n)=>'<button type="button" class="secondary hub-game-answer" data-answer="'+n+'">'+escapeHtml(o)+'</button> ').join('');
      box.querySelectorAll('[data-answer]').forEach(b=>b.onclick=()=>{gameAnswers.push(Number(b.dataset.answer));if(Number(b.dataset.answer)===q.correct)gameScore++;gameIndex++;showGame();});
    };
    $('hubStartGame')?.addEventListener('click',()=>{gameIndex=0;gameScore=0;gameAnswers=[];showGame();});
    $('hubExamPlan')?.addEventListener('click',()=>{const exam=$('hubExam')?.value||'IELTS',topic=$('hubExamTopic')?.value.trim()||'asosiy mavzular',box=$('hubExamResult');if(box)box.innerHTML='<b>'+escapeHtml(exam)+' uchun mashq rejasi</b><ol><li>'+escapeHtml(topic)+' bo‘yicha boshlang‘ich bilimni tekshirish.</li><li>15 daqiqa nazariya va asosiy terminlarni takrorlash.</li><li>10 ta amaliy savol yechish va xatolarni qayd etish.</li><li>Ertasi kuni xato qilingan savollarni qayta ishlash.</li></ol><small>Bu umumiy o‘quv rejasi; rasmiy imtihon materiali yoki natijasi emas.</small>';});

    const theoryLibrary = {
      cell:{title:'Hujayra biologiyasi',body:'Hujayra — tirik organizmlarning tuzilish va faoliyat birligi. Hujayra membranasi moddalar kirishi-chiqishini boshqaradi; sitoplazmada ko‘plab reaksiyalar kechadi; yadro DNKni saqlaydi. Mitoxondriya hujayra nafas olishi va ATP hosil bo‘lishida muhim. Ribosomalar oqsil sintez qiladi.',key:'Mitoxondriyaning asosiy vazifasi qaysi?',opts:['ATP ishlab chiqarishga yordam berish','Qonni filtrlash','Nerv impulsini uzatish'],correct:0,why:'Mitoxondriya hujayra energiya almashinuvida muhim rol o‘ynaydi.'},
      blood:{title:'Qon va qon hujayralari',body:'Qon plazma va shaklli elementlardan iborat. Eritrotsitlar gemoglobin yordamida asosan kislorod tashiydi. Leykotsitlar immun himoyada qatnashadi. Trombotsitlar qon ivishida muhim. Bu vazifalar bir-birini to‘ldiradi.',key:'Qon ivishida qaysi element muhim?',opts:['Trombotsit','Eritrotsit','Neyron'],correct:0,why:'Trombotsitlar gemostaz jarayonida ishtirok etadi.'},
      heart:{title:'Yurak va qon aylanishi',body:'Yurak to‘rt kamerali mushakli a’zo. O‘ng tomoni qonni o‘pkaga yuboradi, chap tomoni esa kislorodga boy qonni tana bo‘ylab haydaydi. Klapanlar qonning asosan bir yo‘nalishda oqishiga yordam beradi. Qon aylanish tizimi to‘qimalarga kislorod va oziqa yetkazadi.',key:'Chap qorinchaning asosiy vazifasi nima?',opts:['Qonni katta qon aylanish doirasiga haydash','Havoni filtrlash','Safro ishlab chiqarish'],correct:0,why:'Chap qorincha kislorodga boy qonni aortaga haydaydi.'},
      dna:{title:'DNK va genetika',body:'DNK irsiy axborotni saqlovchi molekuladir. Uning nukleotidlari A, T, C va G asoslarini tutadi. Gen — funksional mahsulotni kodlash yoki boshqarishda qatnashadigan DNK qismi. DNK replikatsiyasi hujayra bo‘linishidan oldin genetik axborotni nusxalashga yordam beradi.',key:'DNKda adenin qaysi asos bilan juftlashadi?',opts:['Timin','Guanin','Sitozin'],correct:0,why:'Ikki zanjirli DNKda A odatda T bilan, G esa C bilan juftlashadi.'},
      micro:{title:'Mikrobiologiya asoslari',body:'Mikroorganizmlarga bakteriyalar, arxeyalar, mikroskopik zamburug‘lar va ayrim boshqa mikroskopik biologik birliklar kiradi. Viruslar hujayraviy tuzilishga ega emas va ko‘payish uchun xo‘jayin hujayraga muhtoj. Antibiotiklar bakteriyalarga qarshi ishlatiladi, virusli infeksiyalarga bevosita ta’sir qilmaydi.',key:'Antibiotiklar asosan nimaga qarshi ishlatiladi?',opts:['Bakteriyalarga','Barcha viruslarga','Allergenga'],correct:0,why:'Antibiotiklar bakteriyalarga ta’sir qiladi; ularni faqat tibbiy ko‘rsatma bilan qo‘llash kerak.'}
    };
    $('hubTheoryOpen')?.addEventListener('click',()=>{
      const topic=$('hubTheoryTopic')?.value||'cell',t=theoryLibrary[topic],box=$('hubTheoryContent'); if(!box)return;
      box.innerHTML='<h5>'+escapeHtml(t.title)+'</h5><p>'+escapeHtml(t.body)+'</p><b>O‘zingizni tekshiring:</b><p>'+escapeHtml(t.key)+'</p>'+t.opts.map((o,i)=>'<button type="button" class="secondary" data-theory-answer="'+i+'">'+escapeHtml(o)+'</button> ').join('')+'<div id="hubTheoryFeedback" role="status"></div>';
      box.querySelectorAll('[data-theory-answer]').forEach(b=>b.onclick=()=>{if(b.disabled)return;const answer=Number(b.dataset.theoryAnswer),ok=answer===t.correct;box.querySelectorAll('[data-theory-answer]').forEach(x=>x.disabled=true);$('hubTheoryFeedback').innerHTML=(ok?'✅ <span>To‘g‘ri.</span> ':'❌ <span>Hali to‘g‘ri emas.</span> ')+'<p>'+escapeHtml(t.why)+'</p>';saveHubAttempt('lesson_'+topic,[answer],[0],box);});
    });
    const examSets={
      theory:[
        {q:'Hujayrada oqsil sintezi qayerda kechadi?',o:['Ribosomada','Lizosomada','Sentriolada'],a:0,e:'Ribosomalar oqsil sintez qiladi.'},
        {q:'Qaysi qon elementi kislorod tashishda asosiy rol o‘ynaydi?',o:['Eritrotsit','Trombotsit','Leykotsit'],a:0,e:'Gemoglobin eritrotsitlarda joylashgan.'},
        {q:'DNKdagi A odatda qaysi asos bilan juftlashadi?',o:['Timin','Sitozin','Guanin'],a:0,e:'DNKda A–T va G–C juftlari hosil bo‘ladi.'},
        {q:'Qonni katta qon aylanishiga qaysi kamera haydaydi?',o:['Chap qorincha','O‘ng bo‘lmacha','O‘ng qorincha'],a:0,e:'Chap qorincha qonni aortaga haydaydi.'},
        {q:'Antibiotiklar asosan qaysi mikroorganizmlarga qarshi ishlatiladi?',o:['Bakteriyalar','Barcha viruslar','Prionlar'],a:0,e:'Antibiotiklar bakteriyalarga qarshi qo‘llanadi.'}
      ],
      clinical:[
        {q:'Bemorning holati keskin yomonlashdi va nafas olishi qiyinlashdi. O‘quv vaziyatida birinchi tamoyil qaysi?',o:['Zudlik bilan shoshilinch tibbiy yordam chaqirish va xavfsizlikni ta’minlash','Faqat internetdan dori izlash','Bemorni yolg‘iz qoldirish'],a:0,e:'Hayot uchun xavfli belgilar shoshilinch professional baholashni talab qiladi.'},
        {q:'Laboratoriya natijasini talqin qilishdan oldin nima muhim?',o:['Klinik holat, birliklar va referens oralig‘ini tekshirish','Faqat bitta raqamga qarash','Barcha bemorlar uchun bir xil xulosa qilish'],a:0,e:'Natijalar klinik kontekst va laboratoriya me’yorlari bilan birga talqin qilinadi.'},
        {q:'Dori buyurishdan oldin qaysi xavfsizlik tekshiruvi muhim?',o:['Allergiya, boshqa dorilar va qarshi ko‘rsatmalarni tekshirish','Faqat rangini tekshirish','Dozani taxmin qilish'],a:0,e:'Dori xavfsizligi uchun allergiya, o‘zaro ta’sir va qarshi ko‘rsatmalar baholanadi.'},
        {q:'Bemor ma’lumotlari bilan ishlashning muhim qoidasi?',o:['Maxfiylikni saqlash va ruxsatli foydalanish','Ma’lumotni hammaga yuborish','Shaxsiy ma’lumotni ochiq joylash'],a:0,e:'Tibbiy ma’lumotlar maxfiy va faqat vakolatli maqsadda ishlatilishi kerak.'},
        {q:'Ilmiy dalillar qarama-qarshi bo‘lsa, eng to‘g‘ri yondashuv?',o:['Dalil sifatini baholash va noaniqlikni ochiq qayd etish','Birinchi topilgan maqolaga ko‘r-ko‘rona ishonish','Noaniqlikni yashirish'],a:0,e:'Dalillarga asoslangan yondashuvda tadqiqot sifati va cheklovlar hisobga olinadi.'}
      ]
    };
    const runExam=(boxId,setKey)=>{
      const box=$(boxId);if(!box)return;const qs=examSets[setKey];let i=0,score=0,done=false;const answers=[];
      const render=()=>{
        if(i>=qs.length){done=true;box.innerHTML='<h5>Imtihon yakunlandi</h5><p><span>Natija</span>: <b>'+score+'/'+qs.length+'</b> ('+Math.round(score/qs.length*100)+'%).</p><button type="button" class="primary" id="'+boxId+'Retry">Qayta topshirish</button>';$(boxId+'Retry')?.addEventListener('click',()=>runExam(boxId,setKey));saveHubAttempt(setKey,answers,qs.map((_,n)=>n),box);return;}
        const q=qs[i];box.innerHTML='<p><b><span>Savol</span> '+(i+1)+'/'+qs.length+': <span>'+escapeHtml(q.q)+'</span></b></p>'+q.o.map((o,n)=>'<button type="button" class="secondary" data-exam-answer="'+n+'">'+escapeHtml(o)+'</button> ').join('')+'<div id="'+boxId+'Feedback" role="status" style="margin-top:8px"></div>';
        box.querySelectorAll('[data-exam-answer]').forEach(b=>b.onclick=()=>{if(done||b.disabled)return;answers.push(Number(b.dataset.examAnswer));const ok=Number(b.dataset.examAnswer)===q.a;if(ok)score++;box.querySelectorAll('[data-exam-answer]').forEach(x=>x.disabled=true);$(boxId+'Feedback').innerHTML=(ok?'✅ <span>To‘g‘ri.</span> ':'❌ <span>Noto‘g‘ri.</span> ')+'<p>'+escapeHtml(q.e)+'</p><button type="button" class="primary" id="'+boxId+'Next">'+(i===qs.length-1?'Natijani ko‘rish':'Keyingi savol')+'</button>';$ (boxId+'Next')?.addEventListener('click',()=>{i++;render();});});
      };render();
    };
    $('hubTheoryExamStart')?.addEventListener('click',()=>runExam('hubTheoryExam','theory'));
    $('hubClinicalStart')?.addEventListener('click',()=>runExam('hubClinicalExam','clinical'));
    const moleculePairs=[
      {name:'DNK',desc:'Irsiy axborotni saqlaydi'},
      {name:'Gemoglobin',desc:'Kislorod tashishda qatnashadi'},
      {name:'Insulin',desc:'Qondagi glyukozani boshqarishga yordam beradi'},
      {name:'ATP',desc:'Hujayraning asosiy energiya tashuvchilaridan biri'},
      {name:'Antitana',desc:'Muayyan antigenni tanib bog‘lanadi'}
    ];
    $('hubMoleculeStart')?.addEventListener('click',()=>{
      const box=$('hubMoleculeGame');if(!box)return;let idx=0,score=0;const answers=[],questionIds=[];const shuffled=[...moleculePairs].sort(()=>Math.random()-.5);
      const render=()=>{if(idx>=shuffled.length){box.innerHTML='<h5>O‘yin tugadi!</h5><p><span>Natija</span>: '+score+'/'+shuffled.length+' <span>moslik</span>, '+(score*10)+' <span>ball</span>.</p><button type="button" class="primary" id="hubMoleculeAgain">Yana o‘ynash</button>'; $('hubMoleculeAgain')?.addEventListener('click',()=> $('hubMoleculeStart')?.click());saveHubAttempt('molecule',answers,questionIds,box);return;}const p=shuffled[idx];box.innerHTML='<p><b>'+ (idx+1)+'/'+shuffled.length+' — <span>'+escapeHtml(p.name)+'</span></b></p>'+[...moleculePairs].sort(()=>Math.random()-.5).map((x,n)=>'<button type="button" class="secondary" data-mol="'+moleculePairs.indexOf(x)+'" data-correct="'+(x.name===p.name?'1':'0')+'">'+escapeHtml(x.desc)+'</button> ').join('')+'<div id="hubMoleculeFeedback" role="status"></div>';box.querySelectorAll('[data-mol]').forEach(b=>b.onclick=()=>{if(b.disabled)return;answers.push(Number(b.dataset.mol));questionIds.push(moleculePairs.indexOf(p));const ok=b.dataset.correct==='1';if(ok)score++;box.querySelectorAll('[data-mol]').forEach(x=>x.disabled=true);$('hubMoleculeFeedback').innerHTML=(ok?'✅ <span>To‘g‘ri!</span> ':'❌ <span>To‘g‘ri moslik:</span> ')+'<span>'+escapeHtml(p.desc)+'</span>';const n=document.createElement('button');n.className='primary';n.type='button';n.textContent=idx===shuffled.length-1?'Natija':'Keyingi';n.onclick=()=>{idx++;render();};box.appendChild(n);});};render();
    });

    const initOrganGame = () => {
      const choices = $('organGameChoices'), board = $('organGameBoard');
      const start = $('organGameStart'), feedback = $('organGameFeedback');
      if (!choices || !board || !start || start.dataset.bound === '1') return;
      start.dataset.bound = '1';
      const organs = [
        {id:'heart',name:'❤️ Yurak',target:'Ko‘krak qafasi',hint:'Qonni butun tanaga haydaydi.'},
        {id:'lungs',name:'🫁 O‘pka',target:'Ko‘krak qafasi',hint:'Kislorod almashinuvini bajaradi.'},
        {id:'brain',name:'🧠 Miya',target:'Bosh',hint:'Asab tizimini boshqaradi.'},
        {id:'stomach',name:'🟠 Oshqozon',target:'Qorin yuqori qismi',hint:'Ovqatni aralashtirib hazm qilishga yordam beradi.'},
        {id:'kidneys',name:'🫘 Buyraklar',target:'Bel sohasi',hint:'Qonni filtrlaydi va siydik hosil qiladi.'}
      ];
      const zones = [
        {id:'head',label:'🧑 BOSH',accept:['brain']},
        {id:'chest',label:'🫀 KO‘KRAK',accept:['heart','lungs']},
        {id:'upperbelly',label:'🍽️ QORIN YUQORI QISMI',accept:['stomach']},
        {id:'back',label:'🫘 BEL SOHASI',accept:['kidneys']}
      ];
      let selected=null, placed=new Set(), score=0, seconds=60, timer=null, active=false, placements={};
      const shuffle = a => a.map(v=>[Math.random(),v]).sort((x,y)=>x[0]-y[0]).map(x=>x[1]);
      const render = () => {
        $('organGameScore').innerHTML='<span>Ball</span>: '+score;
        $('organGameTime').innerHTML='<span>Vaqt</span>: '+seconds+' s';
        $('organGameProgress').textContent=placed.size+'/'+organs.length;
        choices.innerHTML=shuffle(organs.filter(o=>!placed.has(o.id))).map(o=>'<button type="button" data-organ="'+o.id+'" style="border:2px solid '+(selected===o.id?'#f8d66d':'#6b94ad')+';border-radius:12px;padding:10px;background:'+(selected===o.id?'#f8d66d':'#203b50')+';color:'+(selected===o.id?'#14202b':'#fff')+';font-weight:700">'+o.name+'</button>').join('');
        board.innerHTML=zones.map(z=>'<button type="button" data-zone="'+z.id+'" style="min-height:94px;border:2px dashed #84b5c9;border-radius:14px;padding:10px;background:#173448;color:#fff;text-align:center"><b>'+z.label+'</b><div style="margin-top:8px">'+organs.filter(o=>placed.has(o.id)&&z.accept.includes(o.id)).map(o=>'<span>'+o.name+'</span>').join(' · ')+'</div></button>').join('');
        choices.querySelectorAll('[data-organ]').forEach(b=>b.onclick=()=>{if(!active)return;selected=b.dataset.organ;const o=organs.find(x=>x.id===selected);feedback.innerHTML='<span>Tanlangan:</span> <span>'+o.name+'</span>. <span>Endi mos tana qismini bosing.</span>';render();});
        board.querySelectorAll('[data-zone]').forEach(b=>b.onclick=()=>{if(!active||!selected){feedback.textContent='Avval pastdagi organni tanlang.';return;}const z=zones.find(x=>x.id===b.dataset.zone),o=organs.find(x=>x.id===selected);if(z.accept.includes(o.id)){placed.add(o.id);placements[o.id]=zones.indexOf(z);score+=10;feedback.innerHTML='✅ <span>To‘g‘ri!</span> <span>'+o.hint+'</span>';selected=null;render();if(placed.size===organs.length)finish(true);}else{score=Math.max(0,score-2);feedback.innerHTML='❌ <span>Bu joy mos emas. Maslahat:</span> <span>'+o.hint+'</span>';render();}});
      };
      const finish=won=>{if(!active)return;active=false;clearInterval(timer);timer=null;start.textContent='🔁 Qayta o‘ynash';feedback.innerHTML=(won?'🏆 <span>Ajoyib! Barcha organlar joyida.</span> ':'⏱️ <span>Vaqt tugadi.</span> ')+'<span>Yakuniy ball:</span> '+score+'. <span>Qayta o‘ynash uchun tugmani bosing.</span>';saveHubAttempt('organ',organs.map(o=>placements[o.id]??-1),organs.map((_,i)=>i),feedback);};
      start.onclick=()=>{clearInterval(timer);selected=null;placed=new Set();placements={};score=0;seconds=60;active=true;start.textContent='🔄 Qaytadan boshlash';feedback.textContent='Organni tanlang va mos tana qismini bosing!';render();timer=setInterval(()=>{if(!start.isConnected){clearInterval(timer);active=false;return;}if(document.hidden||start.closest('.hidden'))return;seconds--; $('organGameTime').innerHTML='<span>Vaqt</span>: '+seconds+' s';if(seconds<=0)finish(false);},1000);};
      render();
    };
    const initHubCell3D = () => {
      const viewer = $('hubCell3D'), status = $('hubCell3DStatus');
      if (!viewer || viewer.dataset.ready === '1') return;
      viewer.dataset.ready = '1';
      const loadThree = () => new Promise((resolve, reject) => {
        if (window.THREE) return resolve(window.THREE);
        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.min.js';
        script.onload = () => window.THREE ? resolve(window.THREE) : reject(new Error('3D kutubxonasi topilmadi'));
        script.onerror = () => reject(new Error('3D kutubxonasi yuklanmadi'));
        document.head.appendChild(script);
      });
      loadThree().then(THREE => {
        if (!viewer.isConnected) return;
        const width = Math.max(viewer.clientWidth, 280), height = 240;
        const scene = new THREE.Scene(); scene.background = new THREE.Color(0x101b2b);
        const camera = new THREE.PerspectiveCamera(42, width / height, 0.1, 100); camera.position.set(0, 0, 7);
        const renderer = new THREE.WebGLRenderer({antialias:true}); renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2)); renderer.setSize(width, height); viewer.appendChild(renderer.domElement);
        scene.add(new THREE.HemisphereLight(0xffffff, 0x536078, 2));
        const light = new THREE.DirectionalLight(0xffffff, 2); light.position.set(4, 5, 7); scene.add(light);
        const cell = new THREE.Group(); scene.add(cell);
        const sphere = (color, x, y, z, scale) => { const m = new THREE.Mesh(new THREE.SphereGeometry(1, 28, 20), new THREE.MeshStandardMaterial({color, roughness:.45, transparent:true, opacity:.9})); m.position.set(x,y,z); m.scale.setScalar(scale); cell.add(m); return m; };
        sphere(0x65b8d4, 0, 0, 0, 1.65);
        sphere(0x4c86bb, -.25, .05, .1, .82);
        sphere(0xd98ab4, -.25, .05, .85, .35);
        [[.8,.55,.2],[.7,-.6,.25],[-.8,.55,.2],[-.8,-.55,.1],[.2,.9,-.2],[.3,-.9,-.2]].forEach((p,i)=>sphere(i%2?0xf2c879:0x83c99d,p[0],p[1],p[2],.18));
        const membrane = new THREE.Mesh(new THREE.SphereGeometry(1.68, 32, 24), new THREE.MeshBasicMaterial({color:0x83d8ed, wireframe:true, transparent:true, opacity:.18})); cell.add(membrane);
        let dragging=false,lastX=0,lastY=0;
        let paused=window.matchMedia?.('(prefers-reduced-motion: reduce)').matches||false;
        const canvas=renderer.domElement;
        canvas.tabIndex=0;canvas.style.touchAction='none';
        canvas.setAttribute('aria-label','3D hujayra: yo‘nalish tugmalari bilan aylantiring');
        const controls=document.createElement('div');controls.className='cell-view-controls';
        const button=(label,fn)=>{const el=document.createElement('button');el.type='button';el.className='ghost';el.textContent=label;el.onclick=fn;controls.appendChild(el);return el;};
        const zoom=delta=>{camera.position.z=Math.max(4,Math.min(10,camera.position.z+delta));};
        button('Yaqinlashtirish',()=>zoom(-.6));
        button('Uzoqlashtirish',()=>zoom(.6));
        const pause=button(paused?'Aylanishni boshlash':'Aylanishni to‘xtatish',()=>{paused=!paused;pause.textContent=paused?'Aylanishni boshlash':'Aylanishni to‘xtatish';pause.setAttribute('aria-pressed',String(paused));});
        pause.setAttribute('aria-pressed',String(paused));
        button('Ko‘rinishni tiklash',()=>{camera.position.z=7;cell.rotation.set(0,0,0);});
        viewer.after(controls);
        canvas.addEventListener('pointerdown',e=>{dragging=true;lastX=e.clientX;lastY=e.clientY;canvas.setPointerCapture(e.pointerId);});
        canvas.addEventListener('pointermove',e=>{if(!dragging)return;cell.rotation.y+=(e.clientX-lastX)*.01;cell.rotation.x+=(e.clientY-lastY)*.01;lastX=e.clientX;lastY=e.clientY;});
        for(const event of ['pointerup','pointercancel','lostpointercapture'])canvas.addEventListener(event,()=>dragging=false);
        canvas.addEventListener('wheel',e=>{e.preventDefault();zoom(e.deltaY*.008);},{passive:false});
        canvas.addEventListener('keydown',e=>{
          if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','+','-','Home'].includes(e.key))return;
          e.preventDefault();
          if(e.key==='ArrowLeft')cell.rotation.y-=.15;
          if(e.key==='ArrowRight')cell.rotation.y+=.15;
          if(e.key==='ArrowUp')cell.rotation.x-=.15;
          if(e.key==='ArrowDown')cell.rotation.x+=.15;
          if(e.key==='+')zoom(-.6);if(e.key==='-')zoom(.6);
          if(e.key==='Home'){camera.position.z=7;cell.rotation.set(0,0,0);}
        });
        const resize=()=>{const w=viewer.clientWidth;if(!w)return;renderer.setSize(w,240);camera.aspect=w/240;camera.updateProjectionMatrix();};
        const observer=window.ResizeObserver?new ResizeObserver(resize):null;observer?.observe(viewer);
        let stopped=false;
        const dispose=()=>{if(stopped)return;stopped=true;observer?.disconnect();cell.traverse(object=>{object.geometry?.dispose();if(object.material)for(const m of [].concat(object.material))m.dispose();});renderer.dispose();renderer.forceContextLoss?.();};
        const animate=()=>{
          if(!viewer.isConnected){dispose();return;}
          // Hidden workspaces retain state but must not keep drawing to WebGL.
          if(!document.hidden&&viewer.getClientRects().length){
            if(!dragging&&!paused)cell.rotation.y+=.004;
            renderer.render(scene,camera);
          }
          requestAnimationFrame(animate);
        };resize();animate();
        if(status)status.textContent='Sxematik o‘quv modeli. Sudrab yoki yo‘nalish tugmalari bilan aylantiring; kattalashtirish tugmalaridan foydalaning.';

      }).catch(()=>{if(status)status.textContent='3D kutubxonasi yuklanmadi. Internet ulanishini tekshiring.';});
    };
    initOrganGame();
    initHubCell3D();
    hub.classList.remove('hidden');
    return;
  }

  if (moduleName === 'Clinical Reference' || moduleName === 'Clinical Simulation') {
    let clinical = $('doctorClinicalWorkspace');
    if (!clinical) {
      clinical = document.createElement('section');
      clinical.id = 'doctorClinicalWorkspace';
      clinical.className = 'tool hidden';
      $('workspace')?.appendChild(clinical);
    }
    if (moduleName === 'Clinical Reference') {
      clinical.innerHTML = '<div class="academy-v2"><p class="eyebrow">SHIFOKOR UCHUN • KLINIK MA’LUMOTNOMA</p><h3>🩺 Klinik anatomiya va medical knowledge</h3><p class="muted">Ma’lumotnoma o‘quv va klinik takrorlash uchun. Mustaqil tashxis yoki davolash qarorini almashtirmaydi.</p><div class="grid"><article class="panel"><h4>🫀 Yurak-qon tomir tizimi</h4><p>Yurak kamerasi va klapanlar, koronar qon ta’minoti, asosiy arteriya va venalar.</p></article><article class="panel"><h4>🫁 Nafas olish tizimi</h4><p>Nafas yo‘llari, o‘pka bo‘laklari, plevra va diafragma.</p></article><article class="panel"><h4>🧠 Nerv tizimi</h4><p>Markaziy va periferik nerv tizimi, asosiy nerv yo‘llari va funksional bog‘lanishlar.</p></article><article class="panel"><h4>🦴 Tayanch-harakat tizimi</h4><p>Suyaklar, bo‘g‘imlar, mushak guruhlari va muhim anatomik belgilar.</p></article><article class="panel"><h4>🩻 Qorin bo‘shlig‘i</h4><p>A’zolar topografiyasi, qorin parda va asosiy qon ta’minoti.</p></article><article class="panel"><h4>🩺 Klinik topografiya</h4><p>Anatomik bilimlarni ko‘rik va tasvirlash natijalarini tushunish bilan bog‘lash.</p></article></div></div>';
    } else {
      clinical.innerHTML = '<div class="academy-v2"><p class="eyebrow">CLINICAL WORKSPACE • TRAINING ONLY</p><h3>🩺 Klinik case simulyatsiyasi</h3><p class="muted">Faqat ta’lim uchun. Haqiqiy bemor bo‘yicha qarorlarni klinik protokollar va mas’ul mutaxassis bilan tekshiring.</p><label>O‘quv case<select id="doctorCaseSelect"><option value="chest">Ko‘krak og‘rig‘i</option><option value="breath">Nafas qisishi</option><option value="headache">Bosh og‘rig‘i</option></select></label><label>Keyingi xavfsiz qadam<select id="doctorCaseStep"><option value="">Tanlang…</option><option value="triage">Shoshilinchlik va hayotiy ko‘rsatkichlarni baholash</option><option value="history">Anamnez va xavf omillarini aniqlashtirish</option><option value="tests">Klinik holatga mos tekshiruvlarni ko‘rib chiqish</option></select></label><button class="primary" id="doctorCaseCheck" type="button">Javobni ko‘rib chiqish</button><div id="doctorCaseFeedback" class="status" aria-live="polite"></div><p class="muted">Bu soddalashtirilgan mashq bo‘lib, real klinik protokol yoki diagnostika vositasi emas.</p></div>';
      clinical.querySelector('#doctorCaseCheck')?.addEventListener('click', () => {
        const caseType = clinical.querySelector('#doctorCaseSelect')?.value;
        const step = clinical.querySelector('#doctorCaseStep')?.value;
        const feedback = clinical.querySelector('#doctorCaseFeedback');
        if (!step) { feedback.textContent = 'Avval keyingi qadamni tanlang.'; return; }
        feedback.textContent = step === 'triage'
          ? 'To‘g‘ri boshlang‘ich yondashuv: avvalo shoshilinchlik va hayotiy ko‘rsatkichlarni baholang. Keyingi qadamlar case tafsilotlari va amaldagi protokollarga bog‘liq.'
          : 'Bu qadam ham klinik baholashning bir qismi bo‘lishi mumkin. Avval shoshilinch holatni istisno qilish, so‘ng anamnez va tekshiruvlarni holatga mos tanlash muhim.';
      });
    }
    clinical.classList.remove('hidden');
    return;
  }

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

  $('moleculeVisualPanel')?.classList.toggle('hidden', !['PDB & Structure','Molecular Analysis'].includes(moduleName));

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

  if (result) result.textContent = '';
  $('molecularResultSummary')?.remove();

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

  if (result) result.textContent = '';
  $('bioResultSummary')?.remove();

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

    // Save the screening result as an experiment and tell the user if saving fails.
    let experimentSaved = false;
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
            results: data?.results || [],
            warning: data?.warning || 'Heuristic property-based screening only; not validated docking, affinity, ADMET, or clinical prediction.'
          },
          status: data?.status || 'completed'
        })
      });
      experimentSaved = true;
    } catch (experimentError) {
      console.warn('EXPERIMENT RECORDING ERROR:', experimentError);
    }

    if (status) {
      status.textContent = experimentSaved
        ? t('discoveryCompleted') + ' Tajriba tarixiga saqlandi.'
        : t('discoveryCompleted') + ' Diqqat: natija hisoblandi, lekin tajriba tarixiga saqlanmadi.';
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
  if (!input) { if(status) status.textContent='Target | ligand SMILES kiriting.'; return; }
  const parts=input.split('|').map(x=>x.trim());
  const target=parts[0]||'';
  const ligand_smiles=parts[1]||'';
  if(!target||!ligand_smiles){if(status)status.textContent='Format: Target | ligand SMILES';return;}
  const receptor_pdbqt=$('dockingReceptor')?.value?.trim();
  const ligand_pdbqt=$('dockingLigand')?.value?.trim();
  if(!receptor_pdbqt||!ligand_pdbqt){if(status)status.textContent='Docking uchun prepared receptor va ligand PDBQT kerak.';return;}
  const parameters = {};
  for (const [key,id,min,max,integer] of [
    ['center_x','dockingCenterX',-Infinity,Infinity,false], ['center_y','dockingCenterY',-Infinity,Infinity,false], ['center_z','dockingCenterZ',-Infinity,Infinity,false],
    ['size_x','dockingSizeX',0.1,100,false], ['size_y','dockingSizeY',0.1,100,false], ['size_z','dockingSizeZ',0.1,100,false],
    ['exhaustiveness','dockingExhaustiveness',1,64,true], ['n_poses','dockingPoses',1,20,true]
  ]) {
    const field = $(id), raw = field?.value?.trim(), value = Number(raw);
    if (!raw || !Number.isFinite(value) || value < min || value > max || (integer && !Number.isInteger(value))) {
      if(status)status.textContent='Docking parametrini to‘g‘ri kiriting: '+key;
      field?.focus(); return;
    }
    parameters[key] = value;
  }
  if(result)result.textContent='';
  const button=$('dockingRun'); if(button)button.disabled=true;
  if(status)status.textContent='AutoDock Vina ishga tushmoqda...';
  try{
    const data=await api('/docking/run',{method:'POST',body:JSON.stringify({
      target,ligand_smiles,receptor_pdbqt,ligand_pdbqt,
      ...parameters
    })});
    renderResult(result,data);
    if(status)status.textContent='Docking completed.';
  }catch(error){if(status)status.textContent=error.message;}
  finally{if(button)button.disabled=false;}
}


/* =========================================================
   JOB STATUS
========================================================= */

function renderLabSummary(experiment){
  const box=$('labSummary');if(!box)return;box.replaceChildren();box.hidden=false;
  const labels={sequence_analysis:'Ketma-ketlik tahlili',molecular_analysis:'Molekulyar tahlil',structure_lookup:'Oqsil tuzilmasi',report:'Hisobot ma’lumotlari',virtual_screening:'Xossalarga asoslangan taqqoslash',docking:'Dokking'};
  const statuses={completed:'Bajarildi',failed:'Xato',skipped:'O‘tkazib yuborildi',ready:'Kutilmoqda',requires_prepared_inputs:'Qo‘shimcha ma’lumot kerak'};
  const row=(label,value)=>{const p=document.createElement('p'),span=document.createElement('span');span.textContent=label;p.append(span,document.createTextNode(': '+String(value)));box.appendChild(p);};
  for(const item of experiment.results?.steps||[]){
    const heading=document.createElement('h4');const title=document.createElement('span'),status=document.createElement('span');title.textContent=labels[item.step]||item.step;status.textContent=statuses[item.status]||item.status;heading.append(title,' — ',status);box.appendChild(heading);
    const r=item.result||{};
    if(item.step==='sequence_analysis'&&item.status==='completed'){row('Ketma-ketlik turi',r.sequence_type);row('Uzunlik',r.length);if(r.sequence_type==='DNA'||r.sequence_type==='RNA')row('GC ulushi',r.gc_content_percent+'%');}
    if(item.step==='molecular_analysis'&&item.status==='completed'){row('Molekulyar formula',r.molecular_formula);row('Molyar massa',r.molecular_weight+' g/mol');row('Kanonik SMILES',r.canonical_smiles);}
    if(r.error||r.reason)row('Izoh',typeof(r.error||r.reason)==='string'?(r.error||r.reason):JSON.stringify(r.error||r.reason));
  }
  const note=document.createElement('p');note.textContent='Bu hisoblash natijasi; dori samaradorligi yoki xavfsizligi tasdig‘i emas.';box.appendChild(note);
}

async function createLabWorkflow() {
  const button=$('labRun');if(button?.disabled)return;
  const requestToken=state.token;
  const name = $('labName')?.value?.trim() || 'MedGen Virtual Experiment';
  const workflow_type = $('labType')?.value || 'custom';
  const raw = $('labInput')?.value?.trim() || '{}';
  const status = $('workflowStatus');
  const result = $('workflowResult');
  let input;
  if($('labMode')?.value==='guided'){
    const sequence=$('labSequence')?.value.trim()||'';
    const ligand_smiles=$('labSmiles')?.value.trim()||'';
    const pdb_id=$('labPdb')?.value.trim().toUpperCase()||'';
    if(!sequence&&!ligand_smiles&&!pdb_id){if(status)status.textContent='Kamida bitta tahlil maydonini to‘ldiring.';return;}
    input={target:name,sequence,ligand_smiles,pdb_id,steps:[...(sequence?['sequence_analysis']:[]),...(pdb_id?['structure_lookup']:[]),...(ligand_smiles?['molecular_analysis']:[]),'report']};
  }else{
    try{input=JSON.parse(raw);if(!input||typeof input!=='object'||Array.isArray(input))throw new Error();}
    catch{if(status)status.textContent='JSON obyekt kiriting: { ... }';return;}
  }
  if(button)button.disabled=true;
  if(result)result.textContent='';
  if($('labSummary'))$('labSummary').hidden=true;
  if (status) status.textContent = 'Workflow ma’lumotlari tekshirilmoqda...';
  try {
    if (String(input.target || '').trim()) {
      const sequence = String(input.sequence || '').trim();
      const pdb_id = String(input.pdb_id || '').trim().toUpperCase();
      const ligand_smiles = String(input.ligand_smiles || '').trim();
      if (!sequence && !pdb_id && !ligand_smiles) {
        throw new Error('Target bilan birga sequence, pdb_id yoki ligand_smiles dan kamida bittasini kiriting.');
      }
      const steps = Array.isArray(input.steps) && input.steps.length
        ? input.steps
        : [
            ...(sequence ? ['sequence_analysis'] : []),
            ...(pdb_id ? ['structure_lookup'] : []),
            ...(ligand_smiles ? ['molecular_analysis', 'virtual_screening'] : []),
            'report'
          ];
      if (status) status.textContent = 'Ilmiy pipeline bajarilmoqda...';
      const created = await api('/lab/pipeline', {
        method: 'POST',
        body: JSON.stringify({
          name,
          target: String(input.target).trim(),
          sequence,
          pdb_id,
          ligand_smiles,
          steps,
          parameters: input.parameters && typeof input.parameters === 'object' ? input.parameters : {}
        })
      });
      if(state.token!==requestToken)return;
      const experimentId = created?.experiment?.id;
      if (!experimentId) throw new Error('Pipeline yaratildi, lekin experiment ID qaytmadi.');
      const executed = await api('/lab/experiments/' + encodeURIComponent(experimentId) + '/execute', {
        method: 'POST'
      });
      if(state.token!==requestToken)return;
      let report = null;
      try {
        const reportResponse = await api('/scientific/reports', {
          method: 'POST',
          body: JSON.stringify({
            experiment_id: experimentId,
            title: name,
            include_inputs: true,
            include_results: true
          })
        });
        report = reportResponse?.report || null;
      } catch (reportError) {
        console.warn('Scientific report creation failed:', reportError);
      }
      if(state.token!==requestToken)return;
      renderLabSummary(executed?.experiment || created.experiment);
      renderResult(result, { experiment: executed?.experiment || created.experiment, report });
      const executionStatus = executed?.experiment?.status || executed?.status || 'completed';
      const summary = executed?.experiment?.results?.execution_summary;
      if (status) {
        const details = summary
          ? ` Bajarildi: ${summary.completed_steps ?? 0}; o‘tkazildi: ${summary.skipped_steps ?? 0}; xato: ${summary.failed_steps ?? 0}; qo‘shimcha kirish talab qilinadi: ${summary.steps_requiring_inputs ?? 0}.`
          : '';
        if (executionStatus === 'completed_with_warnings') {
          status.textContent = 'Pipeline qisman bajarildi — natijalarni tekshiring.' + details + (report ? ' Hisobot saqlandi.' : ' Hisobot yaratilmadi.');
        } else if (executionStatus === 'completed') {
          status.textContent = report
            ? 'Ilmiy tajriba bajarildi; natija va hisobot saqlandi.'
            : 'Ilmiy tajriba bajarildi; hisobot yaratilmadi.';
        } else {
          status.textContent = 'Pipeline holati: ' + executionStatus + '. Natijalarni va hisobotni tekshiring.' + details + (report ? ' Hisobot saqlandi.' : ' Hisobot yaratilmadi.');
        }
      }
      return;
    }

    if (status) status.textContent = 'Workflow yaratilmoqda...';
    const data = await api('/workflows', {
      method: 'POST',
      body: JSON.stringify({ workflow_type, input: { name, ...input } })
    });
    if(state.token!==requestToken)return;
    renderResult(result, data);
    if (status) status.textContent = 'Umumiy workflow yaratildi.';
    await loadWorkflows();
  } catch (error) {
    if (status&&state.token===requestToken) status.textContent = error.message;
  } finally {if(button)button.disabled=false;}
}


async function loadJobStatus() {
  const requestToken = state.token;

  const status =
    $('jobsStatus');

  try {

    const data =
      await api(
        '/jobs/status'
      );

    if (state.token !== requestToken) return;
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
    if (state.token !== requestToken) return;

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
  const requestToken = state.token;

  const result =
    $('jobsResult');

  if (result) {
    result.textContent =
      t('jobLoading');
  }

  try {

    const data =
      await api('/jobs');

    if (state.token !== requestToken) return;
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
    if (state.token !== requestToken) return;

    if (result) {
      result.textContent =
        error.message;
    }
  }

  if (state.token === requestToken) await loadJobStatus();
}


/* =========================================================
   CREATE JOB
========================================================= */

async function createJob() {
  const requestToken = state.token;
  const button = $('jobCreate');
  if (button?.disabled) return;
  const jobType = $('jobType')?.value || 'MOLECULAR';
  const status = $('jobCreateStatus');
  const result = $('jobCreateResult');
  let input = {};
  const raw = $('jobInput')?.value?.trim() || '{}';
  try {
    input = JSON.parse(raw);
    if (!input || typeof input !== 'object' || Array.isArray(input)) {
      throw new Error('Input JSON obyekt bo‘lishi kerak.');
    }
  } catch (error) {
    if (state.token !== requestToken) return;
    if (status) status.textContent = 'Input JSON noto‘g‘ri: ' + error.message;
    return;
  }
  if (button) button.disabled = true;
  if (result) result.textContent = '';
  if (status) status.textContent = 'Ilmiy vazifa bajarilmoqda...';
  try {
    const data = await api('/jobs', {
      method: 'POST',
      body: JSON.stringify({ job_type: jobType, input })
    });
    if (state.token !== requestToken) return;
    renderResult(result, data);
    if (status) status.textContent = data?.status === 'completed'
      ? 'Vazifa bajarildi va natija saqlandi.'
      : 'Vazifa holati: ' + (data?.status || 'noma’lum');
    await loadJobs();
  } catch (error) {
    if (state.token !== requestToken) return;
    if (status) status.textContent = error.message;
  } finally {
    if (button) button.disabled = false;
  }
}


/* =========================================================
   REPORTS
========================================================= */

function renderReportsBrowser(reports,experiments,requestToken){
  const list=$('reportsList'),pager=$('reportsPagination'),detail=$('reportsDetail');
  if(!list||!pager||!detail)return;
  const records=[...reports.map(data=>({kind:'report',data})),...experiments.map(data=>({kind:'experiment',data}))];
  records.sort((a,b)=>(Date.parse(b.data.created_at)||0)-(Date.parse(a.data.created_at)||0));
  let page=0;
  detail.hidden=true;
  const button=(label,action)=>{const b=document.createElement('button');b.type='button';b.className='ghost';b.textContent=label;b.onclick=action;return b;};
  const select=record=>{
    if(state.token!==requestToken)return;
    $('reportsSelectedTitle').textContent=record.data.title||record.data.name||record.data.id||'';
    renderResult($('reportsResult'),record.data);detail.hidden=false;
    $('reportsDownload').onclick=()=>{
      if(state.token!==requestToken)return;
      const blob=new Blob([JSON.stringify({kind:record.kind,exported_at:new Date().toISOString(),record:record.data},null,2)],{type:'application/json;charset=utf-8'});
      const url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;
      link.download='medgen-'+record.kind+'-'+String(record.data.id||'record').replace(/[^a-zA-Z0-9_-]/g,'_').slice(0,80)+'.json';
      document.body.appendChild(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
    };
  };
  const render=()=>{
    if(state.token!==requestToken)return;
    const query=$('reportsSearch').value.trim().toLocaleLowerCase(),kind=$('reportsKind').value;
    const filtered=records.filter(r=>(kind==='all'||r.kind===kind)&&[r.data.title,r.data.name,r.data.id,r.data.target].some(x=>String(x||'').toLocaleLowerCase().includes(query)));
    const pages=Math.max(1,Math.ceil(filtered.length/20));page=Math.min(page,pages-1);
    list.replaceChildren();pager.replaceChildren();
    if(!filtered.length){const empty=document.createElement('p');empty.textContent='Mos yozuv topilmadi.';list.appendChild(empty);}
    for(const record of filtered.slice(page*20,page*20+20)){
      const card=document.createElement('article');card.className='report-card';
      const title=document.createElement('h4');title.className='user-authored';title.textContent=record.data.title||record.data.name||record.data.id||'—';
      const type=document.createElement('span');type.textContent=record.kind==='report'?'Hisobot':'Tajriba';
      const metadata=document.createElement('p');metadata.className='user-authored';const date=new Date(record.data.created_at);metadata.textContent=(Number.isNaN(date.valueOf())?'':date.toLocaleString())+' · '+String(record.data.status||record.data.workflow_type||'');
      card.append(title,type,metadata,button('Ochish',()=>select(record)));list.appendChild(card);
    }
    const back=button('Oldingi',()=>{page--;render();}),next=button('Keyingi',()=>{page++;render();});back.disabled=page===0;next.disabled=page>=pages-1;
    const count=document.createElement('span');count.textContent=(page+1)+' / '+pages+' · '+filtered.length;pager.append(back,count,next);
  };
  $('reportsSearch').oninput=()=>{page=0;render();};$('reportsKind').onchange=()=>{page=0;render();};render();
}

async function loadReports() {
  const requestToken=state.token,status=$('reportsStatus');
  $('reportsList')?.replaceChildren();$('reportsPagination')?.replaceChildren();
  if($('reportsDetail'))$('reportsDetail').hidden=true;
  if(status)status.textContent=t('reportLoading');
  try{
    const [reportData,experimentData]=await Promise.all([api('/reports'),api('/experiments')]);
    if(state.token!==requestToken)return;
    renderReportsBrowser(reportData?.reports||[],experimentData?.experiments||[],requestToken);
    if(status)status.textContent='Tarix yuklandi.';
  }catch(error){if(status&&state.token===requestToken)status.textContent=error.message;}
}


/* =========================================================
   WORKFLOWS
========================================================= */

async function loadWorkflows() {
  const result=$('workflowResult'),status=$('workflowStatus'),token=state.token;
  if(status)status.textContent=t('workflowLoading');
  try{
    const [data,history]=await Promise.all([api('/workflows'),api('/experiments')]);
    if(state.token!==token)return;
    const workflows=data?.workflows||[],experiments=(history?.experiments||[]).filter(e=>e.workflow_type==='virtual_lab');
    if(workflows.length||experiments.length)renderResult(result,{workflows,experiments});
    else if(result)result.textContent=t('noWorkflows');
    if(status)status.textContent=t('workflowCount')+': '+(workflows.length+experiments.length);
  }catch(error){if(status&&state.token===token)status.textContent=error.message;}
}


/* =========================================================
   RESEARCH ASSISTANT
========================================================= */

function renderResearchEvidence(data){
  const box=$('researchEvidence');if(!box)return;box.replaceChildren();box.hidden=false;
  const text=(tag,value,authored=false)=>{const el=document.createElement(tag);el.textContent=value;if(authored)el.className='user-authored';return el;};
  box.append(text('h4','Qidiruv manbalari'),text('p',data.query||'',true),text('p','Qidiruv faqat PubMed manbalarini qamraydi. Bu umumiy AI xulosasi yoki davolash tavsiyasi emas.'));
  const query=text('p','');query.append(text('span','Amalda qidirilgan so‘rov'),': ',text('span',data.normalized_query||data.query||'',true));box.append(query);
  const evidence=Array.isArray(data.evidence)?data.evidence:[];
  if(!evidence.length)box.append(text('p','Manba topilmadi. So‘rovni aniqlashtirib qayta urinib ko‘ring.'));
  for(const item of evidence){
    const card=document.createElement('article');card.className='report-card';
    card.append(text('h4',item.title||'—',true),text('p',[item.journal,item.publication_date].filter(Boolean).join(' · '),true));
    for(const excerpt of Array.isArray(item.evidence)?item.evidence.slice(0,3):[])card.append(text('blockquote',excerpt,true));
    if(/^\d+$/.test(String(item.pmid||''))){const link=document.createElement('a');link.href='https://pubmed.ncbi.nlm.nih.gov/'+item.pmid+'/';link.target='_blank';link.rel='noopener noreferrer';link.textContent='PubMed: '+item.pmid;card.append(link);}
    box.append(card);
  }
  box.append(text('p','Sarlavha va parchalar asl tilda berilgan. Moslik reytingi va tadqiqot turi avtomatik belgilanadi; manbani o‘zingiz tekshiring.'));
}

async function runResearchAgent() {
  const buttons=[$('researchAgentRun'),$('researchRun')].filter(Boolean);
  if(buttons.some(b=>b.disabled))return;
  const query=$('researchQuery')?.value.trim()||'',focus=$('researchFocus')?.value.trim()||'';
  const status=$('researchStatus'),result=$('researchResult'),requestToken=state.token;
  if(!query){if(status)status.textContent='Ilmiy savol yoki qidiruv so‘zini kiriting.';return;}
  buttons.forEach(b=>b.disabled=true);
  if($('researchEvidence')){$('researchEvidence').replaceChildren();$('researchEvidence').hidden=true;}
  if(result)result.textContent='';state.lastResearchData=null;
  if(status)status.textContent='PubMed manbalari qidirilmoqda…';
  try{
    const data=await api('/research/agent',{method:'POST',body:JSON.stringify({query,focus,limit:8})});
    if(state.token!==requestToken)return;
    state.lastResearchData=data;renderResearchEvidence(data);renderResult(result,data);
    if(status)status.textContent='Qidiruv tugadi. Natija hisobotlar tarixiga yozildi.';
  }catch(error){if(status&&state.token===requestToken)status.textContent=error.message;}
  finally{buttons.forEach(b=>b.disabled=false);}
}

async function searchResearch(){return runResearchAgent();}


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

          /* Refresh dynamic statuses, module titles, and the unified final shell. */
          refreshDynamicUI();
          if (typeof window.medgenFinalRefreshLanguage === 'function') {
            window.medgenFinalRefreshLanguage();
          }
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
  student:{title:'Talaba',icon:'🎓',desc:'Medical Academy: tibbiy fanlar, tillar, imtihonlarga tayyorgarlik, o‘yinli ta’lim, olimpiadalar va klinik simulyatsiyalar.',modules:['Medical Academy','Learning Hub','Virtual Laboratory']},
  doctor:{title:'Shifokor',icon:'👨‍⚕️',desc:'Clinical Workspace: klinik case, diagnostika, differensial tashxis, medical knowledge va simulation.',modules:['Clinical Reference','Clinical Simulation','Research Assistant','Reports & History']},
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
  const raw=String(
    state.user?.role ||
    state.user?.user_role ||
    state.user?.type ||
    ''
  ).trim().toLowerCase().replace(/[\s-]+/g, '_');
  const badgeRole=String($('roleBadge')?.textContent||'').trim().toLowerCase().replace(/[\s-]+/g, '_');
  // Admins may preview another role's dashboard from the role menu; this only
  // changes the displayed workspace, never the server-side permissions.
  if ((raw==='super_admin' || raw==='admin' || ['super_admin','superadmin','founder','ceo','owner','admin'].includes(badgeRole)) &&
      window.medgenPreviewRole && MEDGEN_ROLES[window.medgenPreviewRole] && window.medgenPreviewRole!=='admin') {
    return window.medgenPreviewRole;
  }
  const profileRaw=String(
    state.user?.profile?.role ||
    state.user?.metadata?.role ||
    ''
  ).trim().toLowerCase().replace(/[\s-]+/g, '_');
  const aliases={super_admin:'admin',superadmin:'admin',founder:'admin',ceo:'admin',owner:'admin'};
  if(['super_admin','superadmin','founder','ceo','owner','admin'].includes(badgeRole)) return 'admin';
  // Privileged dashboards must always be determined by the server-authenticated role.
  if(aliases[raw] || raw==='admin') return 'admin';
  if(MEDGEN_ROLES[raw] && raw!=='student') return raw;

  // Older accounts sometimes have a generic "student" auth role while their
  // selected professional role is stored in the profile or registration record.
  // Use those non-privileged role hints to restore the correct dashboard.
  if(MEDGEN_ROLES[profileRaw] && profileRaw!=='student') return profileRaw;
  const local=getLocalRole()?.key;
  if(MEDGEN_ROLES[local] && local!=='admin') return local;
  if(MEDGEN_ROLES[raw]) return raw;
  return 'student';
}
function applyRoleDashboard(){
  const key=roleKey(), role=MEDGEN_ROLES[key]||MEDGEN_ROLES.student;
  const title=$('roleDashboardTitle'), desc=$('roleDashboardDesc'), badge=$('roleDashboardBadge');
  if(title) title.textContent=role.icon+' '+role.title;
  if(desc) desc.textContent=role.desc;
  if(badge) badge.textContent='PRIMARY ROLE';
  const quick=$('roleQuickGrid');
  if (quick) {
    quick.innerHTML=role.modules.map(m=>'<button class="role-quick" data-role-module="'+m+'"><b>'+m+'</b><span>Ochish →</span></button>').join('');
  }
  quick?.querySelectorAll('[data-role-module]').forEach(b=>b.addEventListener('click',()=>openModule(b.dataset.roleModule)));
  document.querySelectorAll('.module').forEach(btn=>{
    const allowed=role.modules.includes(btn.dataset.module) || key==='admin';
    btn.classList.toggle('role-hidden',!allowed);
  });
  const directory=$('moduleDirectory');
  if(directory) directory.classList.toggle('role-hidden', key!=='admin');
  const rd=$('roleDashboard'); if(rd) rd.classList.remove('hidden');
  updateUserUI();
  window.medgenRefreshRoleNavigation?.();
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
  $('detectLocationBtn')?.addEventListener('click',()=>detectProfileLocation(false));

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
  $('labMode')?.addEventListener('change',()=>{const guided=$('labMode').value==='guided';$('labGuided').hidden=!guided;$('labAdvanced').hidden=guided;});
  for(const [buttonId,inputId,value] of [['labExampleSequence','labSequence','>example\nATGC'],['labExampleMolecule','labSmiles','CCO'],['labExampleStructure','labPdb','1CRN']]){
    $(buttonId)?.addEventListener('click',()=>{$(inputId).value=value;$(inputId).focus();});
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
      // Restore the same role-specific home on refresh as after a fresh login.
      window.__MEDGEN_USER = state.user;
      if (window.medgenFinalBoot) window.medgenFinalBoot(state.user);

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
    $("educationLevel").value = ["COLLEGE","UNIVERSITY","POSTGRADUATE","RESEARCH"].includes(p.education_level)
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
    panel.className = 'student-academy-panel';
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
            <label>O‘qish tili<select id="p1Language"><option value="uz">O‘zbekcha</option><option value="en">English</option><option value="ru">Русский</option></select></label>
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

      <div class="card-grid">
        <div class="card"><h3>📈 O‘rtacha natija</h3><p id="p1AverageScore" class="status">Hali natija yo‘q</p></div>
        <div class="card"><h3>🎯 E’tibor talab qiladigan fanlar</h3><div id="p1WeakTopics" class="status">Yuklanmoqda...</div></div>
        <div class="card"><h3>💡 Tavsiya etilgan keyingi qadamlar</h3><div id="p1Recommendations" class="status">Yuklanmoqda...</div></div>
      </div>
      <div class="card">
        <h3>📚 Fanlar va fan bo‘yicha progress</h3>
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
    // Replace the legacy local-only student UI to prevent duplicate dashboards and the old three-question promotion flow.
    studentTool.innerHTML = '';
    studentTool.appendChild(panel);

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
        document.getElementById('p1Language').value=ap.study_language||'uz';
        document.getElementById('p1Degree').value=ap.academic_degree||'MD/MBBS';
        current=d.course;
        set('p1Overall', d.overall_progress+'%');
        set('p1CourseTitle', esc(d.course_title));
        const scores=d.subjects.flatMap(s=>Object.values(s.record||{}).map(r=>Number(r.score)).filter(Number.isFinite));
        set('p1AverageScore',scores.length?Math.round(scores.reduce((sum,n)=>sum+n,0)/scores.length)+'%':'Hali natija yo‘q');
        const weak=d.subjects.filter(s=>!s.complete).sort((x,y)=>x.completed_assessments.length-y.completed_assessments.length).slice(0,5);
        set('p1WeakTopics',weak.length?weak.map(s=>'<div>'+esc(s.name)+' — '+s.completed_assessments.length+'/7 bosqich</div>').join(''):'Barcha fanlar yakunlangan ✅');
        set('p1Recommendations',weak.length?weak.map(s=>{const rec=s.record||{};const failed=Object.entries(rec).find(([type,r])=>Number(r.score)<70);const next=['theory','practice','quiz','case','skills','osce','exam'].find(type=>!rec[type]?.passed);return '<div><b>'+esc(s.name)+':</b> '+(failed?'Natijasi past bo‘lgan '+esc(failed[0])+' bosqichini takrorlang.':next?'Keyingi bosqich: '+esc(next)+'.':'Natijalarni ko‘rib chiqing.')+'</div>';}).join(''):'Yangi mavzu tanlang yoki bilimni takrorlang.');
        renderSubjects(d.subjects);
      } catch(e) {
        set('p1ProfileStatus','❌ '+esc(e.message));
      }
    }

    function renderSubjects(subjects) {
      set('p1Subjects', subjects.map(s => {
        const done=s.complete?'✅':(s.completed_assessments.length+'/7');
        return `
          <div class="p1-subject">
            <div><b>${esc(s.name)}</b><small>${esc(s.objective)} • ${done}</small></div>
            <div class="p1-actions">
              ${['theory','puzzle','practice','quiz','test','case','skills','osce','theory_exam','practical_exam'].map(t => `<button class="ghost small p1-assess" data-sub="${esc(s.id)}" data-type="${t}">${t==='theory'?'📖 Nazariya':t==='puzzle'?'🧩 Puzzle':t==='practice'?'🧪 Mashq':t==='quiz'?'⚡ Quiz':t==='test'?'📝 Test':t==='case'?'🩺 Case':t==='skills'?'🖐 Ko‘nikma':t==='osce'?'📋 OSCE':t==='theory_exam'?'🎓 Nazariy imtihon':'🧠 Amaliy imtihon'}</button>`).join('')}
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
        set('p1AssessmentMeta', ['theory_exam','exam'].includes(type)?'60 daqiqa • Nazariy imtihon':type==='practical_exam'?'45 daqiqa • Amaliy simulyatsiya':type==='theory'?'Nazariy dars':type==='puzzle'?'Joylashtirish o‘yini':type==='quiz'?'5 savolli tezkor quiz':type==='test'?'Test sinovi':type==='skills'?'Amaliy ko‘nikmalar checklisti':type==='osce'?'OSCE stansiya checklisti':'Baholash');
        const body=document.getElementById('p1AssessmentBody');
        body.innerHTML=d.items.map((q,i)=>{
          if(type==='theory'||type==='practice') return `<div class="p1-question"><b>${i+1}. ${esc(q.title||q.prompt)}</b><p>${esc(q.prompt||'')}</p>${q.content?`<p>${esc(q.content)}</p>`:''}<p>${esc(q.instruction||'')}</p><label><input type="checkbox" data-q="${esc(q.id)}" class="p1-complete"> Bajarildi</label></div>`;
          if(type==='puzzle') return `<div class="p1-question brain-puzzle"><b>🧩 ${esc(q.title||'Puzzle')}</b><p>${esc(q.instruction||'')}</p><div id="brain3dViewer" role="img" aria-label="Bosh miyaning 3D sxematik modeli" style="height:280px;width:100%;max-width:720px;margin:12px auto;border-radius:14px;overflow:hidden;background:#101b2b;position:relative"><span style="position:absolute;left:10px;bottom:8px;color:#fff;font-size:12px;z-index:2">Sxematik 3D • aylantirish: sudrang • yaqinlashtirish: g‘ildirak</span></div><div class="brain-pieces" style="display:flex;flex-wrap:wrap;gap:8px;margin:12px 0">${(q.parts||[]).map(part=>`<button type="button" draggable="true" class="brain-piece ghost small" data-brain-piece="${esc(part.id)}" style="cursor:grab">${esc(part.label)}</button>`).join('')}</div><div class="brain-board" style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px">${(q.slots||[]).map(slot=>`<div class="brain-slot" data-slot-value="${slot.value}" style="min-height:72px;border:2px dashed #8aa4bd;border-radius:12px;padding:10px;background:#f6faff"><b>${esc(slot.label)}</b><div class="brain-dropzone" style="margin-top:8px;min-height:22px">Bu yerga olib keling yoki bosing</div></div>`).join('')}</div>${(q.parts||[]).map(part=>`<input type="hidden" data-puzzle-part="${esc(part.id)}" value="">`).join('')||'<p>Bu fan uchun puzzle xaritasi hali tayyor emas.</p>'}</div>`;
          if(type==='skills'||type==='osce'||type==='practical_exam') return '<div class="p1-question"><b>'+(i+1)+'. '+esc(q.question||q.prompt)+'</b><p>'+esc(q.prompt||'')+'</p><div>'+(q.checklist||[]).map((item,j)=>'<label class="p1-option"><input type="checkbox" data-q="'+esc(q.id+':'+j)+'" value="1"> '+esc(item)+'</label>').join('')+'</div></div>';
          return `<div class="p1-question"><b>${i+1}. ${esc(q.question||q.prompt)}</b>${q.scenario?`<p><i>${esc(q.scenario)}</i></p>`:''}<div>${(q.options||[]).map((o,j)=>`<label class="p1-option"><input type="radio" name="q_${esc(q.id)}" value="${j}" data-q="${esc(q.id)}"> ${esc(o)}</label>`).join('')}</div></div>`;
        }).join('');
        if(type==='puzzle'){
          const viewerEl=document.getElementById('brain3dViewer');
          const loadThree=()=>new Promise((resolve,reject)=>{
            if(window.THREE){resolve(window.THREE);return;}
            const script=document.createElement('script');
            script.src='https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.min.js';
            script.onload=()=>window.THREE?resolve(window.THREE):reject(new Error('3D kutubxonasi topilmadi'));
            script.onerror=()=>reject(new Error('3D kutubxonasi yuklanmadi'));
            document.head.appendChild(script);
          });
          loadThree().then(THREE=>{
            if(!viewerEl||!viewerEl.isConnected)return;
            const scene=new THREE.Scene();scene.background=new THREE.Color(0x101b2b);
            const camera=new THREE.PerspectiveCamera(38,viewerEl.clientWidth/280,0.1,100);camera.position.set(0,0,8);
            const renderer=new THREE.WebGLRenderer({antialias:true,alpha:false});renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,2));renderer.setSize(viewerEl.clientWidth,280);viewerEl.appendChild(renderer.domElement);
            scene.add(new THREE.HemisphereLight(0xffffff,0x536078,2));
            const light=new THREE.DirectionalLight(0xffffff,2.2);light.position.set(4,5,7);scene.add(light);
            const brain=new THREE.Group();scene.add(brain);
            const addLobe=(color,x,y,z,sx,sy,sz,rx=0,ry=0,rz=0)=>{
              const mesh=new THREE.Mesh(new THREE.SphereGeometry(1,32,24),new THREE.MeshStandardMaterial({color,roughness:.72,metalness:0}));
              mesh.position.set(x,y,z);mesh.scale.set(sx,sy,sz);mesh.rotation.set(rx,ry,rz);brain.add(mesh);
            };
            // Educational schematic, not a clinical/anatomical surface model.
            addLobe(0xe58d91,-.48,.55,0,1.0,1.05,.75,0,0,-.2);
            addLobe(0xe9b36d,.48,.55,0,1.0,1.05,.75,0,0,.2);
            addLobe(0x8dc6a7,-.5,-.25,.05,.88,.75,.72,0,0,.18);
            addLobe(0x83b9e8,.5,-.25,.05,.88,.75,.72,0,0,-.18);
            addLobe(0x8f9ee8,0,-1.0,-.05,.62,.52,.58);
            addLobe(0xe9d08a,0,-1.45,.08,.25,.72,.28,-.25,0,0);
            const grid=new THREE.GridHelper(7,14,0x40516a,0x26364a);grid.position.y=-2;scene.add(grid);
            let dragging=false,px=0,py=0;
            renderer.domElement.addEventListener('pointerdown',e=>{dragging=true;px=e.clientX;py=e.clientY;renderer.domElement.setPointerCapture(e.pointerId);});
            renderer.domElement.addEventListener('pointermove',e=>{if(!dragging)return;brain.rotation.y+=(e.clientX-px)*.009;brain.rotation.x+=(e.clientY-py)*.009;px=e.clientX;py=e.clientY;});
            renderer.domElement.addEventListener('pointerup',()=>dragging=false);renderer.domElement.addEventListener('pointercancel',()=>dragging=false);
            renderer.domElement.addEventListener('wheel',e=>{e.preventDefault();camera.position.z=Math.max(5,Math.min(12,camera.position.z+e.deltaY*.008));},{passive:false});
            const resize=()=>{if(!viewerEl.isConnected)return;const w=viewerEl.clientWidth||320;camera.aspect=w/280;camera.updateProjectionMatrix();renderer.setSize(w,280);};
            const ro=new ResizeObserver(resize);ro.observe(viewerEl);
            const animate=()=>{if(!viewerEl.isConnected){ro.disconnect();renderer.dispose();return;}renderer.render(scene,camera);requestAnimationFrame(animate);};animate();
          }).catch(err=>{if(viewerEl&&viewerEl.isConnected)viewerEl.innerHTML='<div style="color:white;padding:24px">3D ko‘rinishni yuklab bo‘lmadi. Puzzle qismlarini pastda ishlatishda davom eting.</div>';});
          let selectedPiece='';
          const pieces=[...body.querySelectorAll('[data-brain-piece]')];
          const slots=[...body.querySelectorAll('[data-slot-value]')];
          const assign=(piece,slot)=>{
            if(!piece||!slot)return;
            const pid=piece.dataset.brainPiece;
            body.querySelectorAll('[data-puzzle-part="'+pid+'"]').forEach(input=>input.value=slot.dataset.slotValue);
            const zone=slot.querySelector('.brain-dropzone');
            zone.textContent=''; zone.appendChild(piece);
            piece.style.width='100%'; piece.style.whiteSpace='normal';
            selectedPiece=''; pieces.forEach(p=>p.style.outline='');
          };
          pieces.forEach(piece=>{
            piece.addEventListener('dragstart',e=>{selectedPiece=piece.dataset.brainPiece;e.dataTransfer.setData('text/plain',selectedPiece);});
            piece.addEventListener('click',()=>{selectedPiece=piece.dataset.brainPiece;pieces.forEach(p=>p.style.outline=p===piece?'3px solid #3978b8':'');});
          });
          slots.forEach(slot=>{
            slot.addEventListener('dragover',e=>e.preventDefault());
            slot.addEventListener('drop',e=>{e.preventDefault();const pid=e.dataTransfer.getData('text/plain')||selectedPiece;assign(pieces.find(p=>p.dataset.brainPiece===pid),slot);});
            slot.addEventListener('click',()=>{if(selectedPiece)assign(pieces.find(p=>p.dataset.brainPiece===selectedPiece),slot);});
          });
        }
        document.getElementById('p1Assessment').classList.remove('hidden');
        document.getElementById('p1Assessment').scrollIntoView({behavior:'smooth',block:'start'});
        set('p1AssessmentStatus','');
      } catch(e){set('p1AssessmentStatus','❌ '+esc(e.message));}
    }

    async function submitAssessment() {
      if(!currentAssessment) return;
      const answers={};
      if(currentAssessment.assessment_type==='theory'||currentAssessment.assessment_type==='practice'){
        const theoryChecks=[...document.querySelectorAll('.p1-complete')];
        answers.completion=theoryChecks.length&&theoryChecks.every(x=>x.checked)?1:0;
      } else if(currentAssessment.assessment_type==='puzzle'){
        document.querySelectorAll('#p1AssessmentBody input[data-puzzle-part]').forEach(x=>{if(x.value!=='') answers[x.dataset.puzzlePart]=Number(x.value);});
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
      const payload={country_code:val('p1Country').toUpperCase(),education_mode:mode,university:val('p1University'),faculty:val('p1Faculty'),major:val('p1Major'),year:Number(val('p1Year')),group:val('p1Group'),student_id:val('p1StudentId'),study_language:val('p1Language')||'uz',academic_degree:val('p1Degree')};
      try{await apiCall('/academy/profile',{method:'PUT',body:JSON.stringify(payload)});set('p1ProfileStatus','✅ Akademik profil saqlandi.');await load();}catch(e){set('p1ProfileStatus','❌ '+esc(e.message));}
    });
    document.getElementById('p1EligibilityBtn').addEventListener('click',async()=>{
      try{const d=await apiCall('/academy/eligibility/'+current);set('p1Eligibility',(d.course_complete?'✅ Kurs to‘liq yakunlangan. ':'⏳ Talablar bajarilmagan. ')+(d.eligible_for_next_course?'Keyingi kurs ochildi.':'Keyingi kurs hali ochilmadi.'));}catch(e){set('p1Eligibility','❌ '+esc(e.message));}
    });
    document.getElementById('p1SubmitAssessment').addEventListener('click',submitAssessment);
    document.getElementById('p1CloseAssessment').addEventListener('click',()=>document.getElementById('p1Assessment').classList.add('hidden'));

    if (sessionStorage.getItem('medgen_access_token')) {
      load();
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

    const menuBtn = document.getElementById('medgenMenuBtn') || document.createElement('button');
    if (!menuBtn.id) {
      menuBtn.id = 'medgenMenuBtn';
      menuBtn.className = 'ghost menu-button';
      menuBtn.type = 'button';
      menuBtn.textContent = '☰ Menyu';
      top.insertBefore(menuBtn, top.firstChild);
    }

    const drawer = document.createElement('aside');
    drawer.id = 'medgenNavDrawer';
    drawer.className = 'nav-drawer hidden';
    drawer.innerHTML = `
      <div class="nav-drawer-head"><div><b>MEDGEN AI</b><small>Platform Menu</small></div><button id="navDrawerClose" class="ghost">×</button></div>
      <div class="nav-section-title">PLATFORM</div>
      <div id="navModules" class="nav-modules"></div>
      <div class="nav-section-title">ACCOUNT</div>
      <button class="nav-item" data-nav="profile">👤 Profilim</button>
      <button class="nav-item" data-nav="security">🔐 Maxfiylik / Xavfsizlik</button>
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
    drawer.querySelector('[data-nav="security"]').addEventListener('click',()=>{close();openSecurityCenter();});
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
          <label>Mamlakat<select id="profileAcademicCountry"></select></label>
          <label>Universitet<input id="profileUniversity" list="profileUniversityList" placeholder="Universitetni tanlang yoki yozing"><datalist id="profileUniversityList"></datalist></label>
          <label>Fakultet<input id="profileFaculty" placeholder="Fakultet"></label>
          <label>Yo‘nalish<input id="profileMajor" placeholder="Davolash ishi / Medicine"></label>
          <label>Kurs<select id="profileAcademicYear"><option value="1">1-kurs</option><option value="2">2-kurs</option><option value="3">3-kurs</option><option value="4">4-kurs</option><option value="5">5-kurs</option><option value="6">6-kurs</option></select></label>
          <label>Guruh<input id="profileGroup" placeholder="Guruh"></label>
          <label>Student ID <span class="muted">(ixtiyoriy)</span><input id="profileStudentId"></label>
          <label>O‘qish tili<select id="profileStudyLanguage"><option value="uz">O‘zbekcha</option><option value="en">English</option><option value="ru">Русский</option></select></label>
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
   SECURITY CENTER + LOCATION PERMISSIONS
========================================================= */
function initProfileLocationSelectors(){
  const country=$('profileCountry'),region=$('profileRegion'),district=$('profileDistrict');
  if(!country||!region||!district)return;
  const list=$('profileCountryOptions');
  if(list&&!list.dataset.ready){
    const display=new Intl.DisplayNames(['en'],{type:'region'}),names=[];
    for(let a=65;a<=90;a++)for(let b=65;b<=90;b++){const code=String.fromCharCode(a,b);try{const name=display.of(code);if(name&&name!==code&&!/unknown region/i.test(name))names.push(name)}catch(_){}}
    [...new Set(names)].sort((a,b)=>a.localeCompare(b)).forEach(name=>{const o=document.createElement('option');o.value=name;list.appendChild(o)});
    list.dataset.ready='1';
  }
  const normalize=()=>{let v=(country.value||'').trim();if(/^[A-Z]{2}$/.test(v)){try{v=new Intl.DisplayNames(['en'],{type:'region'}).of(v)||v}catch(_){}}return v};
  const fill=(el,items,placeholder,selected='')=>{
    const vals=[...new Set((items||[]).filter(Boolean))];
    if(selected&&!vals.includes(selected))vals.unshift(selected);
    el.innerHTML='<option value="">'+placeholder+'</option>'+vals.map(v=>'<option value="'+escapeHtml(v)+'">'+escapeHtml(v)+'</option>').join('')+'<option value="OTHER">Boshqa / qo‘lda kiritish</option>';
    if(selected)el.value=selected;
  };
  const load=async()=>{
    const c=normalize(),savedRegion=region.dataset.selected||region.value,savedDistrict=district.dataset.selected||district.value;
    if(!c){fill(region,[],'Avval mamlakatni tanlang');fill(district,[],'Avval viloyatni tanlang');return}
    fill(region,savedRegion?[savedRegion]:[],'Hududlar yuklanmoqda...',savedRegion);
    fill(district,savedDistrict?[savedDistrict]:[],'Avval viloyatni tanlang',savedDistrict);
    try{
      const response=await fetch('https://countriesnow.space/api/v0.1/countries/states',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({country:c})});
      if(!response.ok)throw new Error('region lookup failed');
      const payload=await response.json(),items=(payload.data?.states||[]).map(x=>typeof x==='string'?x:x.name).filter(Boolean);
      fill(region,items,'Viloyat / hududni tanlang',savedRegion);
      await loadCities();
    }catch(_){fill(region,savedRegion?[savedRegion]:[],'Hududni tanlang yoki yozib kiriting',savedRegion);fill(district,savedDistrict?[savedDistrict]:[],'Tumanni tanlang yoki yozib kiriting',savedDistrict)}
  };
  const loadCities=async()=>{
    const c=normalize(),s=region.value;
    if(!c||!s||s==='OTHER'){fill(district,[],'Tuman / shaharni qo‘lda kiriting');return}
    const saved=district.dataset.selected||district.value;
    try{
      const response=await fetch('https://countriesnow.space/api/v0.1/countries/state/cities',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({country:c,state:s})});
      if(!response.ok)throw new Error('city lookup failed');
      const payload=await response.json();fill(district,payload.data||[],'Tuman / shaharni tanlang',saved);
    }catch(_){fill(district,saved?[saved]:[],'Tuman / shaharni tanlang yoki qo‘lda kiriting',saved)}
  };
  if(!country.dataset.locationBound){country.addEventListener('change',()=>{region.dataset.selected='';district.dataset.selected='';region.value='';district.value='';load()});country.dataset.locationBound='1'}
  if(!region.dataset.locationBound){region.addEventListener('change',()=>{district.dataset.selected='';loadCities()});region.dataset.locationBound='1'}
  if(!country.value&&country.dataset.value)country.value=country.dataset.value;
  if(country.value)load();else{fill(region,[],'Avval mamlakatni tanlang');fill(district,[],'Avval viloyatni tanlang')}
}
async function loadSecurityCenter() {
  const grid=$('securityGrid'); if(!grid)return;
  const renderCards=(d={})=>{
    const consent=d.consent_complete?'✅ Tasdiqlangan':'⚠️ Tasdiqlash kerak';
    const identity=d.identity?.status==='PENDING_PROVIDER'?'🟡 Provayder kutilyapti':'⚪ Tasdiqlanmagan';
    const loc=d.location?.label||[d.location?.country,d.location?.region,d.location?.district,d.location?.city].filter(Boolean).join(' · ')||'Kiritilmagan';
    grid.innerHTML='<div class="security-card"><span>📜</span><strong>Roziliklar</strong><div>'+escapeHtml(consent)+'</div><small>Terms, Privacy, Data Processing va Research Disclaimer.</small><p><a href="/legal.html#terms" target="_blank" rel="noopener">Foydalanish shartlari</a></p><p><a href="/legal.html#privacy" target="_blank" rel="noopener">Maxfiylik siyosati</a></p><p><a href="/legal.html#data" target="_blank" rel="noopener">Ma’lumotlarni qayta ishlash</a></p><p><a href="/legal.html#medical" target="_blank" rel="noopener">Ilmiy/tibbiy ogohlantirish</a></p></div>'+
      '<div class="security-card"><span>🪪</span><strong>Identifikatsiya</strong><div>'+escapeHtml(identity)+'</div><label>Usul<select id="identityMethod"><option value="DOCUMENT_PROVIDER">Hujjat provayderi</option><option value="PASSPORT_PROVIDER">Pasport provayderi</option><option value="NATIONAL_ID_PROVIDER">Milliy ID provayderi</option></select></label><small>So‘rov yuborish shaxsni avtomatik tasdiqlamaydi; haqiqiy tasdiqlash provayderga bog‘liq.</small><button id="identityStart" class="ghost small" type="button">Tasdiqlash so‘rovini yuborish</button></div>'+
      '<div class="security-card"><span>🔐</span><strong>Hisob xavfsizligi</strong><div>'+Number(d.active_sessions||0)+' faol sessiya</div><small>Profil bo‘limida parolni boshqaring.</small></div>'+
      '<div class="security-card"><span>📍</span><strong>Joylashuv</strong><div>'+escapeHtml(loc)+'</div><small>Joylashuv faqat foydalanuvchi ruxsati bilan aniqlanadi.</small><button id="securityLocation" class="ghost small" type="button">Joylashuv ruxsatini tekshirish</button></div>'+
      '<div class="security-card"><span>🛡️</span><strong>Maxfiylik</strong><div>Maxfiylik va ma’lumotlar</div><p><a href="/legal.html#privacy" target="_blank" rel="noopener">Maxfiylik siyosatini ochish</a></p></div>'+
      '<div class="security-card"><span>🔑</span><strong>Parol va sessiyalar</strong><div>Hisobni himoyalash</div><small>Kuchli parol ishlating va begona qurilmalarda tizimdan chiqing.</small></div>';
    $('identityStart')?.addEventListener('click',async()=>{try{const x=await api('/security/identity/request',{method:'POST',body:JSON.stringify({method:$('identityMethod')?.value||'DOCUMENT_PROVIDER'})});$('securityStatus').textContent='🟡 '+(x.identity?.note||'Identifikatsiya so‘rovi yuborildi.');}catch(e){$('securityStatus').textContent='❌ '+e.message;}});
    $('securityLocation')?.addEventListener('click',()=>detectProfileLocation(true));
  };
  grid.innerHTML='<div class="status">Xavfsizlik sozlamalari yuklanmoqda...</div>';
  renderCards();
  try {
    const d=await api('/security/summary');
    renderCards(d);
  } catch(e) { const status=$('securityStatus'); if(status)status.textContent='Serverdagi holat hozircha yuklanmadi; hujjatlar va xavfsizlik havolalari mavjud.'; }
}
function openSecurityCenter(){
  $('roleDashboard')?.classList.add('hidden');$('userDirectoryDashboard')?.classList.add('hidden');$('moduleDirectory')?.classList.add('hidden');$('educationPreferencePanel')?.classList.add('hidden');$('workspace')?.classList.add('hidden');$('adminDashboard')?.classList.add('hidden');$('securityCenter')?.classList.remove('hidden');loadSecurityCenter();
}
function coordinateValue(value){
  if(value == null || String(value).trim()==='')return null;
  const number=Number(value);return Number.isFinite(number)?number:null;
}
async function detectProfileLocation(fromSecurity=false){
  const msg=(key)=>window.medgenText?.(key)||key;
  const show=text=>{const node=$(fromSecurity?'securityStatus':'locationStatus');if(node)node.textContent=text;};
  if(!navigator.geolocation){show(msg('locationUnavailable'));return;}
  show(msg('locationWaiting'));
  const requestedToken=state.token;
  navigator.geolocation.getCurrentPosition(async pos=>{
    if(!requestedToken || state.token!==requestedToken)return;
    const lat=coordinateValue(pos.coords.latitude),lon=coordinateValue(pos.coords.longitude);
    try{
      await api('/security/location',{method:'POST',body:JSON.stringify({location_lat:lat,location_lon:lon})});
      if(state.token!==requestedToken)return;
      const btn=$('detectLocationBtn');
      if(btn){btn.dataset.lat=String(lat);btn.dataset.lon=String(lon);btn.dataset.source='browser_permission';}
      if(state.user){state.user.profile={...(state.user.profile||{}),location_lat:lat,location_lon:lon,location_source:'browser_permission'};}
      show(msg('locationSaved'));
    }catch(error){show(msg('locationSaveFailed')+' '+error.message);}
  },()=>show(msg('locationDenied')),{enableHighAccuracy:false,timeout:12000,maximumAge:300000});
}
/* =========================================================
   PHASE 1 FINAL SHELL — ROLE-FIRST DASHBOARD
   The home screen is a role workspace, not a module catalogue.
========================================================= */
(function phase1RoleFirstShell(){
  const CATEGORY_ORDER = [
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
    // Keep the full role switcher available to the authenticated owner even
    // while previewing another role. Preview affects presentation, not authority.
    const isAdmin=isSuperAdmin();
    const allowed=isAdmin ? CATEGORY_ORDER : CATEGORY_ORDER.filter(x=>x[0]===key);
    list.innerHTML=allowed.map(([id,icon,label])=>
      '<button class="nav-item" data-role-nav="'+id+'"><span>'+icon+'</span><b>'+label+'</b></button>'
    ).join('');

    list.querySelectorAll('[data-role-nav]').forEach(btn=>btn.addEventListener('click',()=>{
      drawer.classList.add('hidden');
      document.getElementById('navDrawerBackdrop')?.classList.add('hidden');
      if(btn.dataset.roleNav==='admin' && isAdmin) {
        window.medgenPreviewRole = null;
        applyRoleDashboard();
        if (typeof loadPersonalDashboard === 'function') loadPersonalDashboard();
        document.getElementById('adminDashboard')?.scrollIntoView({behavior:'smooth',block:'start'});
        loadAdminDashboard();
      } else {
        const role=MEDGEN_ROLES[btn.dataset.roleNav];
        if(role) {
          if(isAdmin) window.medgenPreviewRole = btn.dataset.roleNav;
          applyRoleDashboard();
          if (typeof loadPersonalDashboard === 'function') loadPersonalDashboard();
          const rd=document.getElementById('roleDashboard');
          if(rd) rd.scrollIntoView({behavior:'smooth',block:'start'});
        }
      }
    }));

    const title=document.querySelector('.nav-drawer-head b');
    if(title) title.textContent=isAdmin ? (window.medgenPreviewRole ? 'MEDGEN AI • PREVIEW: '+(MEDGEN_ROLES[key]?.title||key) : 'MEDGEN AI • OWNER') : 'MEDGEN AI • '+(MEDGEN_ROLES[key]?.title||'Workspace');
  }

  function enforceHome(){
    if(!state.user) return;
    const key=roleKey();
    document.querySelectorAll('#dashboardView > .container > .grid').forEach(g=>{
      if(g.querySelector('.module')) g.classList.add('role-module-catalog-hidden');
    });
    document.getElementById('educationPreferencePanel')?.classList.add('role-education-hidden');
    document.getElementById('systemPanel')?.classList.add('role-system-hidden');
    document.getElementById('adminDashboard')?.classList.add('hidden');
    document.getElementById('securityCenter')?.classList.add('hidden');
    document.getElementById('userDirectoryDashboard')?.classList.add('hidden');
    document.getElementById('workspace')?.classList.add('hidden');
    document.getElementById('roleDashboard')?.classList.remove('hidden');
    renderRoleMenu();
  }

  function start(){
    // Apply the role home once at startup. Repeating this every 500ms hid
    // module workspaces after users opened them.
    enforceHome();
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',start,{once:true}); else start();
})();

/* =========================================================
   PHASE 1 FINAL UX — ROLE WORKSPACES / PERSONAL DASHBOARD
========================================================= */
(function initPhase1RoleWorkspaces() {
  const ROLE_CARDS = {
    student:{icon:'🎓',title:'Talabalar',desc:'Universitet talabalari, kurslar, fanlar, progress va akademik natijalar.'},
    doctor:{icon:'🩺',title:'Shifokorlar',desc:'Professional learning, research va klinik ta’lim workspace.'},
    researcher:{icon:'🔬',title:'Tadqiqotchilar',desc:'Research, scientific workflows, experiments va reports.'},
    professor:{icon:'👨‍🏫',title:'Professorlar',desc:'Ta’lim, kurslar, topshiriqlar, assessment va ilmiy rahbarlik.'},
    lab:{icon:'🧪',title:'Laboratoriyalar',desc:'Laboratory workflows, results va research operations.'},
    biotech:{icon:'🧬',title:'Biotech',desc:'Biotechnology research va product workflows.'},
    pharma:{icon:'💊',title:'Pharma',desc:'Drug discovery, research va enterprise workflows.'},
    bioinformatician:{icon:'💻',title:'Bioinformaticianlar',desc:'Sequence, genomics, omics va computational analysis.'},
    hospital:{icon:'🏥',title:'Klinikalar / Hospital',desc:'Clinical education, simulation va staff workflows.'},
    company:{icon:'🏢',title:'Kompaniyalar',desc:'Enterprise projects, teams, research va operations.'},
    SUPER_ADMIN:{icon:'👑',title:'Super Admin / Owner',desc:'Global users, activity, organizations, projects, audit va platform nazorati.'}
  };

  function currentRole() {
    return String(state.user?.role || 'student').trim().toLowerCase();
  }
  function admin() { return isSuperAdmin(); }

  async function loadPersonalDashboard() {
    const box=$('roleQuickGrid');
    const desc=$('roleDashboardDesc');
    if(!box) return;
    const roleKeyNow = (typeof roleKey === 'function' ? roleKey() : currentRole());
    const role = MEDGEN_ROLES[roleKeyNow] || MEDGEN_ROLES.student;
    const moduleDescriptions = {
      'Medical Academy':['🎓','Ta’lim akademiyasi','Anatomiya, fanlar, klinik fikrlash va OSCE'],
      'Virtual Laboratory':['🧪','Virtual laboratoriya','Tajriba protokollari va xavfsiz simulyatsiya'],
      'Research Assistant':['🔬','Ilmiy tadqiqot yordamchisi','Adabiyotlar, savollar va tadqiqot ish jarayoni'],
      'Reports & History':['📊','Hisobotlar va tarix','Saqlangan natijalar, hisobotlar va faoliyat tarixi'],
      'Bioinformatics':['🧬','Bioinformatika','Ketma-ketliklar va genomik ma’lumotlar tahlili'],
      'Molecular Analysis':['⚗️','Molekulyar tahlil','Molekulalar va biologik xususiyatlarni o‘rganish'],
      'PDB & Structure':['🧫','PDB va strukturalar','Oqsil strukturalari va strukturaviy ma’lumotlar'],
      'Drug Discovery':['💊','Drug Discovery','Nishonlar va virtual skrining ish jarayoni'],
      'Scientific Jobs':['🧠','Ilmiy vazifalar','Hisoblash va ilmiy ishlarni kuzatish'],
      'Global Platform':['🌐','Global platforma','Tashkilotlar, loyihalar va platforma boshqaruvi']
    };
    if(roleKeyNow === 'admin' || (admin() && !window.medgenPreviewRole)) {
      try {
        const d=await api('/dashboard/summary');
        const g=d.global||{};
        const cards=[
          ['👥',String(g.total_users??'—'),'Jami foydalanuvchilar'],
          ['🎓',String(g.role_counts?.student||0),'Talabalar'],
          ['🔬',String(g.role_counts?.researcher||0),'Tadqiqotchilar'],
          ['🩺',String(g.role_counts?.doctor||0),'Shifokorlar'],
          ['👨‍🏫',String(g.role_counts?.professor||0),'Professorlar'],
          ['🧬',String(g.role_counts?.biotech||0),'Biotexnologlar']
        ];
        box.innerHTML=cards.map(x=>'<div class="personal-stat-card"><span class="stat-icon">'+x[0]+'</span><strong>'+escapeHtml(x[1])+'</strong><small>'+escapeHtml(x[2])+'</small></div>').join('');
        if(desc) desc.textContent='Founder / Super Admin: platforma statistikasi va barcha modullar ustidan nazorat.';
      } catch(e) {
        box.innerHTML=role.modules.map(m=>{const x=moduleDescriptions[m]||['🔹',m,'Ish maydonini ochish'];return '<button class="role-quick" data-role-module="'+escapeHtml(m)+'"><b>'+x[0]+' '+escapeHtml(x[1])+'</b><span>'+escapeHtml(x[2])+' · Ochish →</span></button>';}).join('');
        box.querySelectorAll('[data-role-module]').forEach(b=>b.addEventListener('click',()=>openModule(b.dataset.roleModule)));
      }
      return;
    }
    if(desc) desc.textContent=role.desc;
    const cards=role.modules.map(m=>{
      const x=moduleDescriptions[m]||['🔹',m,'Ish maydonini ochish'];
      return '<button class="role-quick" data-role-module="'+escapeHtml(m)+'"><b>'+x[0]+' '+escapeHtml(x[1])+'</b><span>'+escapeHtml(x[2])+' · Ochish →</span></button>';
    });
    if(roleKeyNow==='student') {
      cards.unshift('<button class="role-quick" data-student-home="1"><b>📚 Mening o‘qishim</b><span>Kurs, fanlar, progress va akademik natijalar · Ochish →</span></button>');
    } else if(roleKeyNow==='professor') {
      cards.unshift('<button class="role-quick" data-professor-home="1"><b>👨‍🏫 O‘qituvchi ish maydoni</b><span>Kurslar, talabalar natijalari va baholash · Ochish →</span></button>');
    } else if(roleKeyNow==='doctor') {
      cards.unshift('<button class="role-quick" data-clinical-home="1"><b>🩺 Klinik ish maydoni</b><span>Klinik case va differensial tashxis bo‘yicha o‘quv/tadqiqot vositalari · Ochish →</span></button>');
    }
    box.innerHTML=cards.join('');
    box.querySelectorAll('[data-role-module]').forEach(b=>b.addEventListener('click',()=>openModule(b.dataset.roleModule)));
    box.querySelector('[data-student-home]')?.addEventListener('click',()=>openModule('Medical Academy'));
    box.querySelector('[data-professor-home]')?.addEventListener('click',()=>openModule('Medical Academy'));
    box.querySelector('[data-clinical-home]')?.addEventListener('click',()=>openModule('Research Assistant'));
  }

  function buildRoleDirectory() {
    const list=document.getElementById('navModules');
    if(!list) return;
    const role=currentRole();
    const myModules=(MEDGEN_ROLES[role]?.modules||[]);
    const home='<button class="nav-item" data-home-nav="1"><span>🏠</span><b>Mening dashboardim</b></button>';
    const header='<div class="nav-section-title">MENING ISH MAYDONIM</div>';
    const mine=myModules.map(m=>'<button class="nav-item" data-my-module="'+escapeHtml(m)+'"><span>•</span><b>'+escapeHtml(m)+'</b></button>').join('');
    let users='';
    if(admin()){
      users='<div class="nav-section-title">ADMIN / OWNER</div><button class="nav-item" data-admin-dashboard="1"><span>👑</span><b>Super Admin Dashboard</b></button><div class="nav-section-title">FOYDALANUVCHILAR</div>'+
        Object.entries(ROLE_CARDS).map(([key,v])=>'<button class="nav-item" data-user-role="'+key+'"><span>'+v.icon+'</span><b>'+v.title+'</b></button>').join('');
    }
    list.innerHTML=home+header+mine+users;
    list.querySelector('[data-home-nav]')?.addEventListener('click',()=>{
      document.getElementById('navDrawerClose')?.click();
      // Returning home means the authenticated user's own dashboard, not a role preview.
      if (isSuperAdmin()) window.medgenPreviewRole = null;
      $('securityCenter')?.classList.add('hidden');$('userDirectoryDashboard')?.classList.add('hidden');$('adminDashboard')?.classList.add('hidden');$('workspace')?.classList.add('hidden');$('educationPreferencePanel')?.classList.add('hidden');$('roleDashboard')?.classList.remove('hidden');
      applyRoleDashboard();
      if (typeof window.medgenRenderRoleHome === 'function') window.medgenRenderRoleHome();
      loadPersonalDashboard();
    });
    list.querySelector('[data-admin-dashboard]')?.addEventListener('click',()=>{
      document.getElementById('navDrawerClose')?.click();
      $('roleDashboard')?.classList.add('hidden');$('securityCenter')?.classList.add('hidden');$('userDirectoryDashboard')?.classList.add('hidden');$('workspace')?.classList.add('hidden');$('educationPreferencePanel')?.classList.add('hidden');$('adminDashboard')?.classList.remove('hidden');loadAdminDashboard();
    });
    list.querySelectorAll('[data-my-module]').forEach(b=>b.addEventListener('click',()=>{
      document.getElementById('navDrawerClose')?.click();
      openModule(b.dataset.myModule);
    }));
    list.querySelectorAll('[data-user-role]').forEach(b=>b.addEventListener('click',()=>{
      document.getElementById('navDrawerClose')?.click();
      openUserRoleDashboard(b.dataset.userRole);
    }));
  }

  async function openUserRoleDashboard(roleKey) {
    // Role menu entries are dashboard previews, not user-directory pages.
    // Keep the authenticated admin permissions intact; only change the workspace being previewed.
    if (!admin()) return;
    const normalized = String(roleKey || 'student').trim().toLowerCase();
    const preview = normalized === 'super_admin' || normalized === 'admin'
      ? 'admin'
      : (MEDGEN_ROLES[normalized] ? normalized : 'student');
    window.medgenPreviewRole = preview === 'admin' ? null : preview;
    $('userDirectoryDashboard')?.classList.add('hidden');
    $('userDirectoryDetail')?.classList.add('hidden');
    $('adminDashboard')?.classList.add('hidden');
    $('securityCenter')?.classList.add('hidden');
    $('workspace')?.classList.add('hidden');
    $('moduleDirectory')?.classList.add('hidden');
    $('educationPreferencePanel')?.classList.add('hidden');
    $('roleDashboard')?.classList.remove('hidden');
    try {
      if (typeof applyRoleDashboard === 'function') applyRoleDashboard();
      if (typeof window.medgenRenderRoleHome === 'function') window.medgenRenderRoleHome();
    } catch (error) {
      console.error('ROLE PREVIEW ERROR:', error);
    }
    // Re-apply after older asynchronous dashboard hooks have completed.
    setTimeout(() => {
      $('userDirectoryDashboard')?.classList.add('hidden');
      $('roleDashboard')?.classList.remove('hidden');
      try {
        if (typeof applyRoleDashboard === 'function') applyRoleDashboard();
        if (typeof window.medgenRenderRoleHome === 'function') window.medgenRenderRoleHome();
      } catch (_) {}
    }, 250);
  }

  function showAdminUserDetail(user) {
    const d=$('userDirectoryDetail'); if(!d||!user) return;
    const p=user.profile||{}, ap=p.academic_profile||{};
    d.classList.remove('hidden');
    d.innerHTML='<h3>👤 '+escapeHtml(p.full_name||user.username)+'</h3>'+
      '<div class="user-detail-grid">'+
      '<span>Username<strong>'+escapeHtml(user.username)+'</strong></span>'+
      '<span>Role<strong>'+escapeHtml(user.role||'')+'</strong></span>'+
      '<span>Mamlakat<strong>'+escapeHtml(ap.country_code||p.country||'')+'</strong></span>'+
      '<span>Universitet<strong>'+escapeHtml(ap.university||'')+'</strong></span>'+
      '<span>Fakultet<strong>'+escapeHtml(ap.faculty||'')+'</strong></span>'+
      '<span>Yo‘nalish<strong>'+escapeHtml(ap.major||'')+'</strong></span>'+
      '<span>Kurs<strong>'+escapeHtml(String(ap.year||''))+'</strong></span>'+
      '<span>Guruh<strong>'+escapeHtml(ap.group||'')+'</strong></span>'+
      '</div>';
  }

  async function loadAcademyCatalogForProfile(preferredCountry='', preferredUniversity='') {
    const countrySelect=$('profileAcademicCountry'), list=$('profileUniversityList');
    if(!countrySelect) return;
    try {
      const data=await api('/academy/catalog');
      const countries=data.countries||[];
      countrySelect.innerHTML=countries.map(x=>'<option value="'+escapeHtml(x.code)+'">'+escapeHtml(x.name)+' ('+escapeHtml(x.code)+')</option>').join('');
      const guessed=(function(){
        const tz=Intl.DateTimeFormat().resolvedOptions().timeZone||'';
        const lang=(navigator.language||'').toLowerCase();
        if(tz.includes('Tashkent')||lang.endsWith('-uz')) return 'UZ';
        if(lang.endsWith('-tr')) return 'TR';
        if(lang.endsWith('-de')) return 'DE';
        if(lang.endsWith('-fr')) return 'FR';
        if(lang.endsWith('-ru')) return 'RU';
        if(lang.endsWith('-en-us')) return 'US';
        if(lang.endsWith('-en-gb')) return 'GB';
        return 'UZ';
      })();
      const existing=preferredCountry||countrySelect.dataset.value||countrySelect.value;
      countrySelect.value=(countries.some(x=>x.code===existing)?existing:guessed);
      const renderUniversities=()=>{
        const vals=data.universities?.[countrySelect.value]||['Other / enter manually'];
        if(list) list.innerHTML=vals.map(x=>'<option value="'+escapeHtml(x)+'"></option>').join('');
      };
      countrySelect.addEventListener('change',()=>{renderUniversities();renderUzRegions();});
      renderUniversities();
      renderUzRegions();
      const profileCountryInput=$('profileCountry');
      if(profileCountryInput&&!profileCountryInput.dataset.globalRegionBound){profileCountryInput.addEventListener('change',()=>{const r=$('profileRegion'),d=$('profileDistrict');if(r)r.dataset.selected='';if(d)d.dataset.selected='';renderUzRegions()});profileCountryInput.dataset.globalRegionBound='1';}
      async function renderUzRegions(){
        const countryInput=$('profileCountry'), region=$('profileRegion'), district=$('profileDistrict');
        if(!region||!district)return;
        const countriesList=$('profileCountryOptions');
        if(countriesList&&!countriesList.dataset.ready){
          const display=new Intl.DisplayNames(['en'],{type:'region'});
          const names=[];
          for(let n=0;n<26;n++)for(let m=0;m<26;m++){const code=String.fromCharCode(65+n,65+m);try{const name=display.of(code);if(name&&name!==code&&!/unknown region/i.test(name))names.push(name)}catch(_){}}
          [...new Set(names)].sort((a,b)=>a.localeCompare(b)).forEach(name=>{const o=document.createElement('option');o.value=name;countriesList.appendChild(o)});
          countriesList.dataset.ready='1';
        }
        const countryName=()=>{
          const raw=(countryInput?.value||'').trim();if(!raw)return '';
          if(/^[A-Z]{2}$/.test(raw)){try{return new Intl.DisplayNames(['en'],{type:'region'}).of(raw)||raw}catch(_){return raw}}
          return raw;
        };
        const fillSelect=(el,values,placeholder,selected)=>{
          const clean=[...new Set((values||[]).filter(Boolean))];
          if(selected&&!clean.includes(selected))clean.unshift(selected);
          el.innerHTML='<option value="">'+placeholder+'</option>'+clean.map(v=>'<option value="'+escapeHtml(v)+'">'+escapeHtml(v)+'</option>').join('')+'<option value="OTHER">Boshqa / qo‘lda kiritish</option>';
          if(selected)el.value=selected;
        };
        const country=countryName();
        fillSelect(region,[],country?'Hudud yuklanmoqda...':'Avval mamlakatni tanlang',region.value);
        fillSelect(district,[], 'Avval viloyatni tanlang', district.value);
        if(!country){region.innerHTML='<option value="">Avval mamlakatni tanlang</option><option value="OTHER">Boshqa / qo‘lda kiritish</option>';return}
        try{
          const res=await fetch('https://countriesnow.space/api/v0.1/countries/states',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({country})});
          const data=await res.json();
          const states=(data?.data?.states||[]).map(x=>typeof x==='string'?x:x.name).filter(Boolean);
          fillSelect(region,states,'Viloyat / hududni tanlang',region.dataset.selected||region.value);
        }catch(_){
          region.innerHTML='<option value="">Hududni tanlang yoki qo‘lda kiriting</option><option value="OTHER">Boshqa / qo‘lda kiritish</option>';
        }
        const loadDistricts=async()=>{
          const selectedRegion=region.value;
          fillSelect(district,[],selectedRegion?'Tuman/shaharlar yuklanmoqda...':'Avval viloyatni tanlang',district.dataset.selected||district.value);
          if(!selectedRegion||selectedRegion==='OTHER')return;
          try{
            const res=await fetch('https://countriesnow.space/api/v0.1/countries/state/cities',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({country,state:selectedRegion})});
            const data=await res.json();
            fillSelect(district,data?.data||[],'Tuman / shaharni tanlang',district.dataset.selected||district.value);
          }catch(_){district.innerHTML='<option value="">Tuman/shaharni qo‘lda kiriting</option><option value="OTHER">Boshqa / qo‘lda kiritish</option>'}
        };
        if(!region.dataset.globalBound){region.addEventListener('change',()=>{district.dataset.selected='';loadDistricts()});region.dataset.globalBound='1'}
        await loadDistricts();
      }
    } catch(_) {}
  }
  window.medgenLoadAcademyCatalogForProfile=loadAcademyCatalogForProfile;

  function boot() {
    const panel=$('userDirectoryDashboard');
    if(!panel) return;
    document.getElementById('moduleDirectory')?.classList.add('phase1-module-directory');
    buildRoleDirectory();
    loadPersonalDashboard();
    loadAcademyCatalogForProfile();
    initProfileLocationSelectors();

    document.getElementById('userDirectoryBack')?.addEventListener('click',()=>{
      panel.classList.add('hidden');
      $('roleDashboard')?.classList.remove('hidden');
      $('moduleDirectory')?.classList.add('hidden');
      loadPersonalDashboard();
    });

    $('securityBack')?.addEventListener('click',()=>{$('securityCenter')?.classList.add('hidden');$('roleDashboard')?.classList.remove('hidden');loadPersonalDashboard();});
    // Education settings are a menu item, not a permanent giant dashboard card.
    const oldEdu=document.querySelector('[data-nav="education"]');
    if(oldEdu) oldEdu.addEventListener('click',()=>{
      $('roleDashboard')?.classList.add('hidden');
      $('moduleDirectory')?.classList.add('hidden');
      $('workspace')?.classList.add('hidden');
      $('educationPreferencePanel')?.classList.remove('hidden');
    });

    // Rebuild role navigation after every login because role becomes known then.
    window.medgenRefreshRoleNavigation=buildRoleDirectory;
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',boot,{once:true}); else boot();
})();

// Keep the module area and education settings out of the permanent dashboard.
(function enforceSingleHomeView(){
  function apply(){
    $('moduleDirectory')?.classList.add('hidden');
    $('educationPreferencePanel')?.classList.add('hidden');
    $('userDirectoryDashboard')?.classList.add('hidden');
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',apply,{once:true}); else apply();
})();

// Patch module navigation so every module is a separate workspace.
(function patchModuleNavigation(){
  const original=openModule;
  window.openModule=function(moduleName){
    $('roleDashboard')?.classList.add('hidden');
    $('userDirectoryDashboard')?.classList.add('hidden');
    $('educationPreferencePanel')?.classList.add('hidden');
    $('moduleDirectory')?.classList.add('hidden');
    original(moduleName);
  };
  const originalClose=closeWorkspace;
  window.closeWorkspace=function(){
    originalClose();
    $('workspace')?.classList.add('hidden');
    $('roleDashboard')?.classList.remove('hidden');
    if(window.medgenRefreshRoleNavigation) window.medgenRefreshRoleNavigation();
    loadPersonalDashboardSafe();
  };
  async function loadPersonalDashboardSafe(){
    try{
      const d=await api('/dashboard/summary');
      const q=$('roleQuickGrid'); if(!q) return;
      // Global platform statistics belong only to the authenticated admin.
      // For all other roles, preserve the role-specific workspace cards.
      const roleNow = typeof roleKey === 'function' ? roleKey() : String(state.user?.role||'student').toLowerCase();
      if(d.global && (roleNow==='admin' || (typeof isSuperAdmin==='function' && isSuperAdmin()))){
        const g=d.global;
        q.innerHTML=[
          ['👥','Jami foydalanuvchilar',g.total_users],
          ['🎓','Talabalar',g.role_counts?.student||0],
          ['🔬','Tadqiqotchilar',g.role_counts?.researcher||0],
          ['🩺','Shifokorlar',g.role_counts?.doctor||0],
          ['👨‍🏫','Professorlar',g.role_counts?.professor||0],
          ['🧪','Laboratoriyalar',g.role_counts?.lab||0],
          ['🏢','Kompaniyalar',g.role_counts?.company||0]
        ].map(x=>'<div class="personal-stat-card"><span class="stat-icon">'+x[0]+'</span><strong>'+x[2]+'</strong><small>'+x[1]+'</small></div>').join('');
      }
    }catch(_){}
  }
})();

/* Final navigation event patch: module opens as a clean standalone workspace. */
(function finalizeWorkspaceNavigation(){
  function boot(){
    document.querySelectorAll('.module').forEach(btn=>{
      btn.addEventListener('click',()=>{
        $('roleDashboard')?.classList.add('hidden');
        $('userDirectoryDashboard')?.classList.add('hidden');
        $('educationPreferencePanel')?.classList.add('hidden');
        $('moduleDirectory')?.classList.add('hidden');
      });
    });
    $('workspaceClose')?.addEventListener('click',()=>closeWorkspace());
    const drawer=document.getElementById('medgenNavDrawer');
    const list=document.getElementById('navModules');
    if(drawer && list && !drawer.querySelector('[data-nav="home"], [data-home-nav]')){
      const home=document.createElement('button');
      home.className='nav-item';
      home.dataset.nav='home';
      home.innerHTML='<span>🏠</span><b>Mening dashboardim</b>';
      drawer.insertBefore(home,list);
      home.addEventListener('click',()=>{
        document.getElementById('navDrawerClose')?.click();
        $('userDirectoryDashboard')?.classList.add('hidden');
        $('educationPreferencePanel')?.classList.add('hidden');
        $('workspace')?.classList.add('hidden');
        $('moduleDirectory')?.classList.add('hidden');
        $('roleDashboard')?.classList.remove('hidden');
      });
    }
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',boot,{once:true}); else setTimeout(boot,0);
})();


// =========================================================
// PHASE 2 SCIENTIFIC UI — ADVANCED BIOINFORMATICS / MOLECULES
// =========================================================

async function runBioTranslation() {
  const sequence=$('bioSequence')?.value?.trim()||'';
  const frame=Number($('bioFrame')?.value||1);
  const status=$('bioTranslateStatus'), result=$('bioTranslateResult');
  if(!sequence){ if(status) status.textContent=t('sequenceRequired'); return; }
  if(status) status.textContent=t('analyzing');
  try {
    const data=await api('/bioinformatics/translate',{method:'POST',body:JSON.stringify({sequence,frame})});
    renderResult(result,data); if(status) status.textContent=t('done');
  } catch(e){ if(status) status.textContent=e.message; }
}

async function runBioAlignment() {
  const a=$('bioSequence')?.value?.trim()||'', b=$('bioSequenceB')?.value?.trim()||'';
  const status=$('bioAlignStatus'), result=$('bioAlignResult');
  if(!a||!b){if(status) status.textContent='Ikkala ketma-ketlikni kiriting.';return;}
  if(status) status.textContent=t('analyzing');
  try {
    const data=await api('/bioinformatics/align',{method:'POST',body:JSON.stringify({sequence_a:a,sequence_b:b})});
    renderResult(result,data); if(status) status.textContent=t('done');
  } catch(e){if(status) status.textContent=e.message;}
}

async function runMoleculeBatch() {
  const smiles=($('moleculeBatchInput')?.value||'').split(/\r?\n/).map(x=>x.trim()).filter(Boolean);
  const status=$('moleculeBatchStatus'), result=$('moleculeBatchResult');
  if(!smiles.length){if(status)status.textContent=t('moleculeRequired');return;}
  if(status)status.textContent=t('analyzing');
  try{const data=await api('/molecules/batch-analyze',{method:'POST',body:JSON.stringify({smiles})});renderResult(result,data);if(status)status.textContent=t('done');}
  catch(e){if(status)status.textContent=e.message;}
}

async function runMoleculeSimilarity() {
  const lines=($('moleculeSimilarityInput')?.value||'').split(/\r?\n/).map(x=>x.trim()).filter(Boolean);
  const status=$('moleculeSimilarityStatus'), result=$('moleculeSimilarityResult');
  if(lines.length<2){if(status)status.textContent='Reference SMILES va kamida bitta query SMILES kiriting.';return;}
  try{
    const data=await api('/molecules/similarity',{method:'POST',body:JSON.stringify({reference_smiles:lines[0],query_smiles:lines.slice(1)})});
    renderResult(result,data);if(status)status.textContent=t('done');
  }catch(e){if(status)status.textContent=e.message;}
}

async function runMolecule3D() {
  const smiles=$('smilesInput')?.value?.trim()||'';
  const status=$('molecule3dStatus'), result=$('molecule3dResult');
  if(!smiles){if(status)status.textContent=t('smilesRequired');return;}
  if(status)status.textContent=t('analyzing');
  try{const data=await api('/molecules/3d',{method:'POST',body:JSON.stringify({smiles,optimize:true})});renderResult(result,data);if(status)status.textContent=t('done');}
  catch(e){if(status)status.textContent=e.message;}
}

(function bindPhase2ScientificControls(){
  function bind(){
    $('bioTranslateRun')?.addEventListener('click',runBioTranslation);
    $('bioAlignRun')?.addEventListener('click',runBioAlignment);
    $('moleculeBatchRun')?.addEventListener('click',runMoleculeBatch);
    $('moleculeSimilarityRun')?.addEventListener('click',runMoleculeSimilarity);
    $('molecule3dRun')?.addEventListener('click',runMolecule3D);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bind,{once:true});else bind();
})();


async function runScientificWorkflow(){
  const panel=document.getElementById('scientificWorkflowPanel');
  const status=panel?.querySelector('#scientificWorkflowStatus'), out=panel?.querySelector('#scientificWorkflowResult');
  if(!status || !out) return;
  const button=document.getElementById('workflowRun');
  if(button?.disabled) return;
  out.textContent='';
  const body={
    name:document.getElementById('workflowName')?.value || 'MedGen Scientific Workflow',
    target:document.getElementById('workflowTarget')?.value || '',
    pdb_id:document.getElementById('workflowPdb')?.value || '',
    chain_id:document.getElementById('workflowChain')?.value || '',
    sequence:document.getElementById('workflowSequence')?.value || '',
    ligand_smiles:document.getElementById('workflowLigand')?.value || '',
    run_similarity:true,
    similarity_library:(document.getElementById('workflowLibrary')?.value || '').split(/\r?\n/).map(x=>x.trim()).filter(Boolean)
  };
  if(!body.target.trim()){ status.textContent='Target is required'; return; }
  if(![body.sequence,body.pdb_id,body.ligand_smiles].some(value=>value.trim())){
    status.textContent='Provide a sequence, PDB structure, or ligand SMILES to analyze.'; return;
  }
  status.textContent='Running scientific workflow...'; out.textContent='';
  if(button) button.disabled=true;
  try{
    const r=await fetch(API_BASE+'/scientific/workflow',{method:'POST',headers:{'Content-Type':'application/json',...(state.token?{Authorization:'Bearer '+state.token}:{})},body:JSON.stringify(body)});
    const j=await r.json();
    if(!r.ok){
      const detail=j.detail;
      throw new Error(typeof detail==='string'?detail:detail?.message || (detail?JSON.stringify(detail):'Workflow failed'));
    }
    status.textContent='Workflow completed'; out.textContent=JSON.stringify(j,null,2);
  }catch(e){status.textContent='Workflow error'; out.textContent=e.message;}
  finally{if(button) button.disabled=false;}
}
function bindScientificWorkflowPanelButton(){
  const button=document.getElementById('openScientificWorkflow');
  if(!button || button.dataset.bound==='1') return;
  button.dataset.bound='1';
  button.addEventListener('click',()=>{
    const panel=document.getElementById('scientificWorkflowPanel');
    if(!panel) return;
    panel.classList.remove('hidden');
    panel.setAttribute('aria-hidden','false');
    panel.scrollIntoView({behavior:'smooth',block:'start'});
  });
}
if(document.readyState==='loading'){
  document.addEventListener('DOMContentLoaded',bindScientificWorkflowPanelButton,{once:true});
}else{
  bindScientificWorkflowPanelButton();
}

function bindScientificWorkflowButton(){
  const button=document.getElementById('workflowRun');
  if(!button || button.dataset.workflowBound==='1') return;
  button.dataset.workflowBound='1';
  button.addEventListener('click',runScientificWorkflow);
}
if(document.readyState==='loading'){
  document.addEventListener('DOMContentLoaded',bindScientificWorkflowButton,{once:true});
}else{
  bindScientificWorkflowButton();
}

/* =========================================================
   PHASE 2 VISUAL LAB — 2D RDKit + 3Dmol.js
   ========================================================= */
async function renderMolecule2D(){
  const smiles=$('visualSmiles')?.value?.trim()||$('smilesInput')?.value?.trim()||'';
  const status=$('visual2dStatus'),canvas=$('visual2dCanvas');
  if(!smiles){if(status)status.textContent='SMILES kiriting.';return;}
  if(status)status.textContent='2D rendering...';
  try{
    const d=await api('/molecules/2d',{method:'POST',body:JSON.stringify({smiles,width:520,height:360})});
    if(canvas)canvas.innerHTML=d.svg;
    if(status)status.textContent='2D tayyor';
  }catch(e){if(status)status.textContent=e.message;}
}
async function renderMolecule3D(){
  const smiles=$('visualSmiles')?.value?.trim()||$('smilesInput')?.value?.trim()||'';
  const status=$('visual3dStatus'),el=$('visual3dCanvas');
  if(!smiles){if(status)status.textContent='SMILES kiriting.';return;}
  if(!window.$3Dmol){if(status)status.textContent='3D viewer yuklanmadi.';return;}
  if(status)status.textContent='3D rendering...';
  try{
    const d=await api('/molecules/3d',{method:'POST',body:JSON.stringify({smiles,optimize:true})});
    el.innerHTML='';
    const viewer=$3Dmol.createViewer(el,{backgroundColor:'#07111f'});
    viewer.addModel(d.mol_block,'mol');
    viewer.setStyle({},{stick:{radius:0.14},sphere:{scale:0.25}});
    viewer.zoomTo();viewer.render();
    if(status)status.textContent='3D molekula tayyor';
  }catch(e){if(status)status.textContent=e.message;}
}
async function renderPdb3D(){
  const pdb=($('visualPdb')?.value||'').trim().toUpperCase();
  const status=$('visual3dStatus'),el=$('visual3dCanvas');
  if(!/^[A-Z0-9]{4}$/.test(pdb)){if(status)status.textContent='4 belgili PDB ID kiriting.';return;}
  if(!window.$3Dmol){if(status)status.textContent='3D viewer yuklanmadi.';return;}
  if(status)status.textContent='PDB yuklanmoqda...';
  try{
    const d=await api('/pdb/structures/'+encodeURIComponent(pdb)+'/viewer');
    el.innerHTML='';
    const viewer=$3Dmol.createViewer(el,{backgroundColor:'#07111f'});
    viewer.addModel(d.pdb,'pdb');
    viewer.setStyle({cartoon:{}});
    viewer.addStyle({hetflag:true},{stick:{radius:0.18}});
    viewer.zoomTo();viewer.render();
    if(status)status.textContent='PDB 3D tayyor: '+pdb;
  }catch(e){if(status)status.textContent=e.message;}
}
async function renderAlphaFold3D(){
  const accession=($('visualUniprot')?.value||'').trim().toUpperCase();
  const status=$('visual3dStatus'),el=$('visual3dCanvas'),button=$('visualAlphaFoldRun');
  const tr=s=>window.medgenText?.(s)||s;
  if(!/^[A-Z0-9]{6,10}$/.test(accession)){status.textContent=tr('Enter a UniProt ID, for example P69905.');return;}
  if(!window.$3Dmol){status.textContent=tr('3D viewer could not load. Check your connection and reload.');return;}
  if(button.disabled)return;button.disabled=true;status.textContent=tr('Loading…');
  try{
    const data=await api('/structures/alphafold/'+accession);
    el.innerHTML='';
    const viewer=$3Dmol.createViewer(el,{backgroundColor:'#142333'});
    viewer.addModel(data.pdb,'pdb');viewer.setStyle({},{cartoon:{color:'spectrum'}});viewer.zoomTo();viewer.render();
    status.textContent='AlphaFold DB · '+accession+' · '+tr('Mean pLDDT')+': '+(data.mean_plddt??'—');
    const notice=$('alphaFoldNotice');notice.textContent=tr('Predicted structure, not proof of drug efficacy.');
    const link=document.createElement('a');link.href=data.source_url;link.target='_blank';link.rel='noopener noreferrer';link.textContent=' AlphaFold DB ↗';notice.append(link);
  }catch(error){status.textContent=error.message;}finally{button.disabled=false;}
}
(function bindVisualLab(){
  function bind(){
    $('visualAlphaFoldRun')?.addEventListener('click',renderAlphaFold3D);
    $('visual2dRun')?.addEventListener('click',renderMolecule2D);
    $('visual3dMoleculeRun')?.addEventListener('click',renderMolecule3D);
    $('visual3dPdbRun')?.addEventListener('click',renderPdb3D);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bind,{once:true});else bind();
})();



/* =========================================================
   ROLE DASHBOARD FIX — SINGLE SOURCE OF TRUTH
   Keep each authenticated role on its own workspace.
========================================================= */
(function medgenRoleDashboardFix(){
  const originalShowDashboard = showDashboard;
  function renderRoleHome(){
    // The primary cabinet owns navigation once mounted. Startup timers must
    // never close a workspace that the user has already opened.
    if(document.getElementById('finalHome')) return;
    if(!state.user) return;
    const key = typeof roleKey === 'function' ? roleKey() : 'student';
    const role = MEDGEN_ROLES[key] || MEDGEN_ROLES.student;
    const title = document.getElementById('roleDashboardTitle');
    const desc = document.getElementById('roleDashboardDesc');
    const badge = document.getElementById('roleDashboardBadge');
    const grid = document.getElementById('roleQuickGrid');
    if(title) title.textContent = (role.icon || '🧬') + ' ' + role.title;
    if(desc) desc.textContent = role.desc;
    if(badge) badge.textContent = key === 'admin' ? 'OWNER / ADMIN' : 'PRIMARY ROLE';
    if(grid){
      const labels = {
        'Medical Academy':['🎓','Tibbiyot akademiyasi','Kurslar, fanlar va ta’lim vositalari'],
        'Virtual Laboratory':['🧪','Virtual laboratoriya','Xavfsiz simulyatsiya va tajriba protokollari'],
        'Research Assistant':['🔬','Ilmiy tadqiqot','Adabiyotlar, gipotezalar va tadqiqot jarayoni'],
        'Reports & History':['📊','Hisobotlar va tarix','Saqlangan natijalar va faoliyat'],
        'Bioinformatics':['🧬','Bioinformatika','Genomika va biologik ketma-ketliklar tahlili'],
        'Molecular Analysis':['⚗️','Molekulyar tahlil','Molekula va biologik xususiyatlar'],
        'PDB & Structure':['🧫','PDB va strukturalar','Oqsil strukturalari va strukturaviy ma’lumotlar'],
        'Drug Discovery':['💊','Drug Discovery','Dori nishonlari va virtual skrining'],
        'Scientific Jobs':['🧠','Ilmiy vazifalar','Hisoblash ishlarini kuzatish'],
        'Global Platform':['🌐','Global platforma','Tashkilotlar, loyihalar va platforma boshqaruvi']
      };
      grid.innerHTML = (role.modules || []).map(name => {
        const item = labels[name] || ['🔹',name,'Ish maydonini ochish'];
        return '<button class="role-quick" data-role-module="'+escapeHtml(name)+'"><b>'+item[0]+' '+escapeHtml(item[1])+'</b><span>'+escapeHtml(item[2])+' · Ochish →</span></button>';
      }).join('');
      grid.querySelectorAll('[data-role-module]').forEach(btn=>{
        btn.addEventListener('click',()=>openModule(btn.dataset.roleModule));
      });
    }
    // Hide every other dashboard panel so role home is visually distinct.
    ['userDirectoryDashboard','adminDashboard','securityCenter','workspace','moduleDirectory','educationPreferencePanel'].forEach(id=>{
      document.getElementById(id)?.classList.add('hidden');
    });
    document.getElementById('roleDashboard')?.classList.remove('hidden');
    if(typeof window.medgenRefreshRoleNavigation === 'function') window.medgenRefreshRoleNavigation();
  }
  showDashboard = function(){
    originalShowDashboard.apply(this, arguments);
    renderRoleHome();
    // Older async dashboard loaders may finish after showDashboard; re-apply
    // the authenticated role cards after their first paint.
    setTimeout(renderRoleHome, 150);
    setTimeout(renderRoleHome, 700);
  };
  window.medgenRenderRoleHome = renderRoleHome;
  // A "home" navigation action must also restore the correct role workspace.
  document.addEventListener('click', event=>{
    const home = event.target.closest('[data-nav="home"]');
    if(home) setTimeout(renderRoleHome, 0);
  });
})(); 


/* =========================================================
   FINAL ROLE DASHBOARD ISOLATION
   Resolve legacy accounts' locally selected role and enforce
   one role-specific home screen after all older startup hooks.
========================================================= */
(function medgenFinalRoleDashboardIsolation(){
  const priorRoleKey = roleKey;
  function resolveWorkspaceRole(){
    const serverRole = String(state.user?.role || state.user?.user_role || state.user?.type || '')
      .trim().toLowerCase().replace(/[\s-]+/g, '_');
    const privileged = ['admin','super_admin','superadmin','founder','ceo','owner'];
    if (privileged.includes(serverRole)) return priorRoleKey.call(this);

    // Support older accounts where the API still reports generic "student"
    // but registration stored the selected professional role in localStorage.
    const username = String(state.user?.username || '').trim();
    let saved = getLocalRole()?.key;
    if (!saved && username) {
      try {
        for (let i=0; i<localStorage.length; i++) {
          const k = localStorage.key(i);
          if (k && k.toLowerCase() === ('medgen_role_' + username).toLowerCase()) {
            saved = JSON.parse(localStorage.getItem(k) || 'null')?.key;
            break;
          }
        }
      } catch (_) {}
    }
    if (serverRole === 'student' && saved && MEDGEN_ROLES[saved] && saved !== 'admin') return saved;
    return priorRoleKey.call(this);
  }
  roleKey = resolveWorkspaceRole;

  const originalShowDashboard = showDashboard;
  function enforceRoleHome(){
    if ($('finalHome')) return;
    if (!state.user) return;
    const key = roleKey();
    const role = MEDGEN_ROLES[key] || MEDGEN_ROLES.student;
    const root = $('dashboardView');
    const home = $('roleDashboard');
    if (!root || root.classList.contains('hidden') || !home) return;

    // Apply module permissions and render the selected role's own module set.
    document.querySelectorAll('#moduleDirectory .module').forEach(btn => {
      const allowed = key === 'admin' || role.modules.includes(btn.dataset.module);
      btn.classList.toggle('role-hidden', !allowed);
    });
    $('moduleDirectory')?.classList.toggle('hidden', key !== 'admin');
    ['userDirectoryDashboard','adminDashboard','securityCenter','workspace','educationPreferencePanel']
      .forEach(id => $(id)?.classList.add('hidden'));

    $('roleDashboardTitle').textContent = (role.icon || '🧬') + ' ' + role.title;
    $('roleDashboardDesc').textContent = role.desc;
    $('roleDashboardBadge').textContent = key === 'admin' ? 'OWNER / ADMIN' : 'PERSONAL WORKSPACE';

    const grid = $('roleQuickGrid');
    if (grid) {
      const labels = {
        'Learning Hub':['🌍','O‘rganish markazi','Ingliz/rus tili, mini-o‘yinlar va imtihon mashqlari'],
        'Clinical Reference':['🩺','Klinik ma’lumotnoma','Klinik anatomiya va tana tizimlari'],
        'Clinical Simulation':['🩺','Klinik simulyatsiya','O‘quv klinik case va differensial fikrlash'],
        'Medical Academy':['🎓','Tibbiyot akademiyasi','Kurslar, anatomiya, klinik fikrlash va OSCE'],
        'Virtual Laboratory':['🧪','Virtual laboratoriya','O‘quv simulyatsiyalari va tajriba protokollari'],
        'Research Assistant':['🔬','Ilmiy tadqiqot','Adabiyotlar, gipotezalar va tadqiqot ishlari'],
        'Reports & History':['📊','Hisobotlar va tarix','Saqlangan natijalar va faoliyat'],
        'Bioinformatics':['🧬','Bioinformatika','DNK, RNK, oqsil va omics tahlili'],
        'Molecular Analysis':['⚗️','Molekulyar tahlil','Molekulalar va kimyoviy xususiyatlar'],
        'PDB & Structure':['🧫','PDB va strukturalar','Oqsil strukturalari va 3D ko‘rish'],
        'Drug Discovery':['💊','Drug Discovery','Nishonlar va virtual skrining'],
        'Scientific Jobs':['⚙️','Ilmiy vazifalar','Hisoblash vazifalari holati'],
        'Global Platform':['🌐','Global platforma','Tashkilotlar, loyihalar va platforma boshqaruvi']
      };
      grid.innerHTML = (role.modules || []).map(name => {
        const item = labels[name] || ['🔹',name,'Ish maydonini ochish'];
        return '<button class="role-quick" type="button" data-role-module="'+escapeHtml(name)+'"><b>'+item[0]+' '+escapeHtml(item[1])+'</b><span>'+escapeHtml(item[2])+' · Ochish →</span></button>';
      }).join('');
      grid.querySelectorAll('[data-role-module]').forEach(btn => {
        btn.addEventListener('click', () => openModule(btn.dataset.roleModule));
      });
    }
    home.classList.remove('hidden');
    // The finalHome renderer is the primary home UI. Keep the legacy role
    // dashboard hidden when that role-aware home has been rendered.
    const finalHome = $('finalHome');
    if (finalHome && !finalHome.classList.contains('hidden') && getComputedStyle(finalHome).display !== 'none') {
      home.classList.add('hidden');
    }
    window.medgenRefreshRoleNavigation?.();
  }

  showDashboard = function(){
    originalShowDashboard.apply(this, arguments);
    enforceRoleHome();
    setTimeout(enforceRoleHome, 100);
    setTimeout(enforceRoleHome, 500);
    setTimeout(enforceRoleHome, 1200);
  };
  window.medgenRenderRoleHome = enforceRoleHome;
  document.addEventListener('click', event => {
    if (event.target.closest('[data-nav="home"]')) setTimeout(enforceRoleHome, 0);
  });
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => setTimeout(enforceRoleHome, 0), {once:true});
  } else {
    setTimeout(enforceRoleHome, 0);
  }
})();
