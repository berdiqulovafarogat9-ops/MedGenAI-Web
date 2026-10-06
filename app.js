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
   MEDGEN AI — LANGUAGE SYSTEM
========================================================= */

const LANG = {

  en: {
    signingIn: 'Signing in…',
    loginFailed: 'Login failed.',
    apiOnline: 'API: online',
    apiOffline: 'API: offline',
    notConnected: 'not connected',

    enterSmiles: 'Enter a SMILES string.',
    analyzing: 'Analyzing…',
    analysisCompleted: 'Analysis completed.',
    enterSequence: 'Enter a DNA/RNA/protein sequence.',
    enterPdb: 'Enter a PDB ID.',
    loading: 'Loading…',
    loaded: 'Loaded.',

    moleculesSmiles: 'Molecules / SMILES',
    smilesPlaceholder:
      'Enter one SMILES per line\n\nExample:\nCCO\nC1=CC=CC=C1\nCC(=O)O',

    oneMolecule:
      'One molecule per line. Screening will rank the molecules.',

    runScreening: 'Run Screening',
    enterTarget: 'Enter a target.',
    enterMolecule: 'Enter at least one molecule.',
    virtualScreening: 'Running virtual screening…',

    screeningCompleted:
      'Screening completed: {count} molecules ranked.',

    screeningFailed: 'Screening failed.',

    scientificWorker: 'Scientific Worker',
    checkingWorker: 'Checking worker…',
    refreshWorker: 'Refresh Worker',
    worker: 'Worker',
    queue: 'Queue',
    active: 'Active',

    workerError:
      'Worker error: {error}',

    submitting: 'Submitting…',
    jobSubmitted: 'Job submitted.',

    generateScientificReport:
      'Generate Scientific Report',

    reportType: 'Report type',

    reportPlaceholder:
      'Describe the research, target, experiment or analysis...',

    generateReport: 'Generate Report',
    generatingReport: 'Generating report…',
    reportGenerated: 'Report generated.',

    aiResearchAssistant:
      'AI Research Assistant',

    researchQuestion:
      'Ask a biomedical research question...',

    runResearchAssistant:
      'Run Research Assistant',

    enterResearchQuestion:
      'Enter a research question.',

    researchPipeline:
      'Running research pipeline…',

    researchCompleted:
      'Research Assistant completed.',

    searchResearch: 'Search research',
    enterResearchQuery: 'Enter a research query.',
    searching: 'Searching…',
    searchCompleted: 'Search completed.',

    virtualLaboratory: 'Virtual Laboratory',

    molecularAnalysis: 'Molecular Analysis',
    bioinformaticsExperiment: 'Bioinformatics Experiment',
    drugDiscoveryExperiment: 'Drug Discovery Experiment',
    structuralBiology: 'Structural Biology',
    customExperiment: 'Custom Experiment',

    experimentInput: 'Experiment input...',
    createExperiment: 'Create Experiment',
    creatingExperiment: 'Creating experiment…',
    experimentCreated: 'Experiment created.',

    workflowLoaded: 'Loaded.',

    molecular: 'Molecular',
    docking: 'Docking',
    structurePrediction: 'Structure prediction',

    molecularBackend:
      'Run the existing MedGen molecular backend directly from the Web interface.',

    bioBackend:
      'Submit a protected bioinformatics workflow to the backend.',

    pdbBackend:
      'Load a structure from the MedGen PDB backend.',

    discoverySession:
      'Create a computational drug-discovery session.',

    workflowView:
      'View persisted scientific workflows.',

    researchBackend:
      'Search the research backend for citation-oriented results.'
  },


  uz: {
    signingIn: 'Tizimga kirilmoqda…',
    loginFailed: 'Tizimga kirishda xatolik yuz berdi.',
    apiOnline: 'API: online',
    apiOffline: 'API: offline',
    notConnected: 'ulanmagan',

    enterSmiles: 'SMILES qatorini kiriting.',
    analyzing: 'Tahlil qilinmoqda…',
    analysisCompleted: 'Tahlil yakunlandi.',
    enterSequence: 'DNK/RNK/oqsil ketma-ketligini kiriting.',
    enterPdb: 'PDB ID ni kiriting.',
    loading: 'Yuklanmoqda…',
    loaded: 'Yuklandi.',

    moleculesSmiles: 'Molekulalar / SMILES',

    smilesPlaceholder:
      'Har bir SMILESni alohida qatorda kiriting\n\nMisol:\nCCO\nC1=CC=CC=C1\nCC(=O)O',

    oneMolecule:
      'Har bir molekula alohida qatorda. Skrining molekulalarni reyting bo‘yicha tartiblaydi.',

    runScreening: 'Skriningni ishga tushirish',
    enterTarget: 'Nishonni kiriting.',
    enterMolecule: 'Kamida bitta molekulani kiriting.',

    virtualScreening:
      'Virtual skrining bajarilmoqda…',

    screeningCompleted:
      'Skrining yakunlandi: {count} ta molekula reytinglandi.',

    screeningFailed:
      'Skriningda xatolik yuz berdi.',

    scientificWorker: 'Ilmiy ishchi',
    checkingWorker: 'Ishchi tekshirilmoqda…',
    refreshWorker: 'Ishchini yangilash',
    worker: 'Ishchi',
    queue: 'Navbat',
    active: 'Faol',

    workerError:
      'Ishchi xatosi: {error}',

    submitting: 'Yuborilmoqda…',
    jobSubmitted: 'Vazifa yuborildi.',

    generateScientificReport:
      'Ilmiy hisobot yaratish',

    reportType: 'Hisobot turi',

    reportPlaceholder:
      'Tadqiqot, nishon, tajriba yoki tahlilni tavsiflang...',

    generateReport: 'Hisobot yaratish',
    generatingReport: 'Hisobot yaratilmoqda…',
    reportGenerated: 'Hisobot yaratildi.',

    aiResearchAssistant:
      'AI ilmiy tadqiqot yordamchisi',

    researchQuestion:
      'Biomedikal tadqiqot savolingizni kiriting...',

    runResearchAssistant:
      'Ilmiy yordamchini ishga tushirish',

    enterResearchQuestion:
      'Tadqiqot savolini kiriting.',

    researchPipeline:
      'Ilmiy tadqiqot jarayoni bajarilmoqda…',

    researchCompleted:
      'Ilmiy yordamchi ishini yakunladi.',

    searchResearch: 'Ilmiy qidiruv',

    enterResearchQuery:
      'Ilmiy qidiruv so‘rovini kiriting.',

    searching: 'Qidirilmoqda…',
    searchCompleted: 'Qidiruv yakunlandi.',

    virtualLaboratory: 'Virtual laboratoriya',

    molecularAnalysis: 'Molekulyar tahlil',
    bioinformaticsExperiment: 'Bioinformatika tajribasi',
    drugDiscoveryExperiment: 'Dori yaratish tajribasi',
    structuralBiology: 'Strukturaviy biologiya',
    customExperiment: 'Maxsus tajriba',

    experimentInput: 'Tajriba ma’lumotlari...',
    createExperiment: 'Tajriba yaratish',
    creatingExperiment: 'Tajriba yaratilmoqda…',
    experimentCreated: 'Tajriba yaratildi.',

    workflowLoaded: 'Yuklandi.',

    molecular: 'Molekulyar',
    docking: 'Dokking',
    structurePrediction: 'Tuzilmani bashorat qilish',

    molecularBackend:
      'Mavjud MedGen molekulyar backendini Web interfeysi orqali to‘g‘ridan-to‘g‘ri ishga tushiring.',

    bioBackend:
      'Himoyalangan bioinformatika ish jarayonini backendga yuboring.',

    pdbBackend:
      'MedGen PDB backendidan tuzilmani yuklang.',

    discoverySession:
      'Hisoblash asosidagi dori yaratish sessiyasini yarating.',

    workflowView:
      'Saqlangan ilmiy ish jarayonlarini ko‘ring.',

    researchBackend:
      'Iqtiboslarga yo‘naltirilgan natijalar uchun ilmiy backenddan qidiring.'
  },


  ru: {
    signingIn: 'Выполняется вход…',
    loginFailed: 'Ошибка входа.',
    apiOnline: 'API: онлайн',
    apiOffline: 'API: офлайн',
    notConnected: 'не подключено',

    enterSmiles: 'Введите строку SMILES.',
    analyzing: 'Выполняется анализ…',
    analysisCompleted: 'Анализ завершён.',
    enterSequence: 'Введите последовательность ДНК/РНК/белка.',
    enterPdb: 'Введите PDB ID.',
    loading: 'Загрузка…',
    loaded: 'Загружено.',

    moleculesSmiles: 'Молекулы / SMILES',

    smilesPlaceholder:
      'Введите по одному SMILES в каждой строке\n\nПример:\nCCO\nC1=CC=CC=C1\nCC(=O)O',

    oneMolecule:
      'Одна молекула на строку. Скрининг ранжирует молекулы.',

    runScreening: 'Запустить скрининг',
    enterTarget: 'Введите мишень.',
    enterMolecule: 'Введите хотя бы одну молекулу.',

    virtualScreening:
      'Выполняется виртуальный скрининг…',

    screeningCompleted:
      'Скрининг завершён: ранжировано молекул — {count}.',

    screeningFailed: 'Ошибка скрининга.',

    scientificWorker: 'Научный рабочий процесс',
    checkingWorker: 'Проверка рабочего процесса…',
    refreshWorker: 'Обновить рабочий процесс',
    worker: 'Рабочий процесс',
    queue: 'Очередь',
    active: 'Активные',

    workerError:
      'Ошибка рабочего процесса: {error}',

    submitting: 'Отправка…',
    jobSubmitted: 'Задача отправлена.',

    generateScientificReport:
      'Создать научный отчёт',

    reportType: 'Тип отчёта',

    reportPlaceholder:
      'Опишите исследование, мишень, эксперимент или анализ...',

    generateReport: 'Создать отчёт',
    generatingReport: 'Создание отчёта…',
    reportGenerated: 'Отчёт создан.',

    aiResearchAssistant:
      'AI-помощник по научным исследованиям',

    researchQuestion:
      'Введите вопрос по биомедицинскому исследованию...',

    runResearchAssistant:
      'Запустить научного помощника',

    enterResearchQuestion:
      'Введите исследовательский вопрос.',

    researchPipeline:
      'Выполняется исследовательский процесс…',

    researchCompleted:
      'Научный помощник завершил работу.',

    searchResearch: 'Поиск исследований',
    enterResearchQuery: 'Введите поисковый запрос.',
    searching: 'Поиск…',
    searchCompleted: 'Поиск завершён.',

    virtualLaboratory: 'Виртуальная лаборатория',

    molecularAnalysis: 'Молекулярный анализ',
    bioinformaticsExperiment: 'Биоинформационный эксперимент',
    drugDiscoveryExperiment: 'Эксперимент по разработке лекарств',
    structuralBiology: 'Структурная биология',
    customExperiment: 'Пользовательский эксперимент',

    experimentInput: 'Данные эксперимента...',
    createExperiment: 'Создать эксперимент',
    creatingExperiment: 'Создание эксперимента…',
    experimentCreated: 'Эксперимент создан.',

    workflowLoaded: 'Загружено.',

    molecular: 'Молекулярный',
    docking: 'Докинг',
    structurePrediction: 'Предсказание структуры',

    molecularBackend:
      'Запустите существующий молекулярный backend MedGen непосредственно через Web-интерфейс.',

    bioBackend:
      'Отправьте защищённый биоинформационный процесс в backend.',

    pdbBackend:
      'Загрузите структуру из PDB backend MedGen.',

    discoverySession:
      'Создайте вычислительную сессию по разработке лекарств.',

    workflowView:
      'Просмотрите сохранённые научные рабочие процессы.',

    researchBackend:
      'Выполните поиск в научном backend для результатов с цитированием.'
  }
};


/* =========================================================
   LANGUAGE HELPERS
========================================================= */

function currentLanguage() {
  const lang = localStorage.getItem('medgen_language');

  if (lang === 'en' || lang === 'uz' || lang === 'ru') {
    return lang;
  }

  return 'uz';
}


function t(key, values = {}) {

  const lang = currentLanguage();

  let value =
    LANG[lang]?.[key] ??
    LANG.en?.[key] ??
    key;

  Object.keys(values).forEach((name) => {
    value = value.replace(
      new RegExp(`\\{${name}\\}`, 'g'),
      String(values[name])
    );
  });

  return value;
}


/* =========================================================
   DYNAMIC TRANSLATION
========================================================= */

function translateDynamicUI() {

  /* Drug Discovery */

  const discoveryMolecules = $('discoveryMolecules');

  if (discoveryMolecules) {
    discoveryMolecules.placeholder =
      t('smilesPlaceholder');
  }

  const discoveryLabel =
    document.querySelector(
      'label[for="discoveryMolecules"]'
    );

  if (discoveryLabel) {
    discoveryLabel.textContent =
      t('moleculesSmiles');
  }

  const discoveryHint =
    $('discoveryMoleculesHint');

  if (discoveryHint) {
    discoveryHint.textContent =
      t('oneMolecule');
  }

  if ($('discoveryRun')) {
    $('discoveryRun').textContent =
      t('runScreening');
  }


  /* Scientific Jobs */

  if ($('jobsStatusPanel')) {

    if ($('jobsStatusTitle')) {
      $('jobsStatusTitle').textContent =
        t('scientificWorker');
    }

    if ($('jobsStatusRefresh')) {
      $('jobsStatusRefresh').textContent =
        t('refreshWorker');
    }
  }


  /* Reports */

  if ($('reportGeneratorPanel')) {

    if ($('reportGeneratorTitle')) {
      $('reportGeneratorTitle').textContent =
        t('generateScientificReport');
    }

    if ($('reportType')) {
      $('reportType').placeholder =
        t('reportType');
    }

    if ($('reportInput')) {
      $('reportInput').placeholder =
        t('reportPlaceholder');
    }

    if ($('reportGenerate')) {
      $('reportGenerate').textContent =
        t('generateReport');
    }
  }


  /* Research Assistant */

  if ($('researchAssistantPanel')) {

    if ($('researchAssistantTitle')) {
      $('researchAssistantTitle').textContent =
        t('aiResearchAssistant');
    }

    if ($('assistantQuery')) {
      $('assistantQuery').placeholder =
        t('researchQuestion');
    }

    if ($('assistantRun')) {
      $('assistantRun').textContent =
        t('runResearchAssistant');
    }
  }


  /* Virtual Laboratory */

  if ($('virtualLabPanel')) {

    if ($('virtualLabTitle')) {
      $('virtualLabTitle').textContent =
        t('virtualLaboratory');
    }

    if ($('labExperimentInput')) {
      $('labExperimentInput').placeholder =
        t('experimentInput');
    }

    if ($('labExperimentCreate')) {
      $('labExperimentCreate').textContent =
        t('createExperiment');
    }

    const select =
      $('labExperimentType');

    if (select && select.options.length >= 5) {

      select.options[0].textContent =
        t('molecularAnalysis');

      select.options[1].textContent =
        t('bioinformaticsExperiment');

      select.options[2].textContent =
        t('drugDiscoveryExperiment');

      select.options[3].textContent =
        t('structuralBiology');

      select.options[4].textContent =
        t('customExperiment');
    }
  }


  /* Static job type options */

  const jobType = $('jobType');

  if (jobType) {

    Array.from(jobType.options).forEach((option) => {

      const value = option.value;

      if (
        value === 'scientific_analysis' ||
        value === 'molecular'
      ) {
        option.textContent =
          t('molecular');
      }

      if (value === 'docking') {
        option.textContent =
          t('docking');
      }

      if (value === 'structure_prediction') {
        option.textContent =
          t('structurePrediction');
      }
    });
  }
}


/* =========================================================
   API
========================================================= */

async function api(path, options = {}) {

  if (!path.startsWith('/')) {
    throw new Error('Invalid API path');
  }

  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {})
  };

  if (state.token) {
    headers.Authorization =
      `Bearer ${state.token}`;
  }

  const response =
    await fetch(
      CONFIG.apiBase + path,
      {
        ...options,
        headers
      }
    );

  let data = null;

  try {
    data = await response.json();
  } catch {}

  if (!response.ok) {

    throw new Error(
      data?.detail ||
      data?.message ||
      `HTTP ${response.status}`
    );
  }

  return data;
}


/* =========================================================
   HELPERS
========================================================= */

function setStatus(id, message, success = false) {

  const element = $(id);

  if (!element) return;

  element.textContent = message;

  element.style.color =
    success ? '#8eeed2' : '';
}


function showLogin() {

  if ($('dashboardView')) {
    $('dashboardView')
      .classList.add('hidden');
  }

  if ($('loginView')) {
    $('loginView')
      .classList.remove('hidden');
  }
}


function showDashboard() {

  if ($('loginView')) {
    $('loginView')
      .classList.add('hidden');
  }

  if ($('dashboardView')) {
    $('dashboardView')
      .classList.remove('hidden');
  }

  updateRole();
  checkHealth();
  translateDynamicUI();
}


function updateRole() {

  const role =
    state.user?.role || 'USER';

  if ($('roleBadge')) {
    $('roleBadge').textContent =
      role;
  }
}


/* =========================================================
   HEALTH
========================================================= */

async function checkHealth() {

  try {

    const base =
      CONFIG.apiBase.replace(
        /\/api\/v1$/,
        ''
      );

    const response =
      await fetch(
        base + '/api/v1/health/live'
      );

    if (!response.ok) {
      throw new Error();
    }

    if ($('healthBadge')) {
      $('healthBadge').textContent =
        t('apiOnline');
    }

    if ($('apiText')) {
      $('apiText').textContent =
        currentLanguage() === 'en'
          ? 'online'
          : currentLanguage() === 'ru'
            ? 'онлайн'
            : 'online';
    }

  } catch {

    if ($('healthBadge')) {
      $('healthBadge').textContent =
        t('apiOffline');
    }

    if ($('apiText')) {
      $('apiText').textContent =
        t('notConnected');
    }
  }
}


/* =========================================================
   LOGIN
========================================================= */

if ($('loginForm')) {

  $('loginForm').addEventListener(
    'submit',
    async (event) => {

      event.preventDefault();

      setStatus(
        'loginStatus',
        t('signingIn')
      );

      try {

        const body = {
          username:
            $('loginUser')?.value.trim(),

          password:
            $('loginPassword')?.value || ''
        };

        const data =
          await api(
            '/auth/login',
            {
              method: 'POST',
              body: JSON.stringify(body)
            }
          );

        state.token =
          data.access_token;

        sessionStorage.setItem(
          CONFIG.tokenKey,
          state.token
        );

        state.user =
          await api('/auth/me');

        showDashboard();

        setStatus(
          'loginStatus',
          ''
        );

      } catch (error) {

        console.error(
          'Login error:',
          error
        );

        setStatus(
          'loginStatus',
          error.message ||
          t('loginFailed')
        );
      }
    }
  );
}


/* =========================================================
   LOGOUT
========================================================= */

if ($('logoutBtn')) {

  $('logoutBtn').addEventListener(
    'click',
    () => {

      state.token = '';
      state.user = null;

      sessionStorage.removeItem(
        CONFIG.tokenKey
      );

      showLogin();
    }
  );
}


/* =========================================================
   MOLECULAR ANALYSIS
========================================================= */

async function molecularAnalyze() {

  const smiles =
    $('smilesInput')?.value.trim();

  if (!smiles) {

    setStatus(
      'molecularStatus',
      t('enterSmiles')
    );

    return;
  }

  setStatus(
    'molecularStatus',
    t('analyzing')
  );

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

    if ($('molecularResult')) {

      $('molecularResult')
        .textContent =
        JSON.stringify(
          data,
          null,
          2
        );
    }

    setStatus(
      'molecularStatus',
      t('analysisCompleted'),
      true
    );

  } catch (error) {

    setStatus(
      'molecularStatus',
      error.message
    );
  }
}


/* =========================================================
   BIOINFORMATICS
========================================================= */

async function bioinformaticsRun() {

  const sequence =
    $('bioSequence')?.value.trim();

  if (!sequence) {

    setStatus(
      'bioStatus',
      t('enterSequence')
    );

    return;
  }

  setStatus(
    'bioStatus',
    t('analyzing')
  );

  try {

    const data =
      await api(
        '/bioinformatics/analyze',
        {
          method: 'POST',
          body: JSON.stringify({
            sequence,
            sequence_type: 'AUTO'
          })
        }
      );

    if ($('bioResult')) {

      $('bioResult')
        .textContent =
        JSON.stringify(
          data,
          null,
          2
        );
    }

    setStatus(
      'bioStatus',
      t('analysisCompleted'),
      true
    );

  } catch (error) {

    setStatus(
      'bioStatus',
      error.message
    );
  }
}


/* =========================================================
   PDB
========================================================= */

async function pdbLookup() {

  const id =
    $('pdbInput')
      ?.value
      .trim()
      .toUpperCase();

  if (!id) {

    setStatus(
      'pdbStatus',
      t('enterPdb')
    );

    return;
  }

  setStatus(
    'pdbStatus',
    t('loading')
  );

  try {

    const data =
      await api(
        '/pdb/structures/' +
        encodeURIComponent(id)
      );

    if ($('pdbResult')) {

      $('pdbResult')
        .textContent =
        JSON.stringify(
          data,
          null,
          2
        );
    }

    setStatus(
      'pdbStatus',
      t('loaded'),
      true
    );

  } catch (error) {

    setStatus(
      'pdbStatus',
      error.message
    );
  }
}


/* =========================================================
   DRUG DISCOVERY UI
========================================================= */

function prepareDiscoveryUI() {

  const tool =
    $('discoveryTool');

  if (!tool) return;

  if ($('discoveryMolecules')) {
    translateDynamicUI();
    return;
  }

  const wrapper =
    document.createElement('div');

  wrapper.style.marginTop =
    '16px';

  wrapper.innerHTML = `
    <label
      id="discoveryMoleculesLabel"
      for="discoveryMolecules"
      style="
        display:block;
        margin-bottom:8px;
        font-weight:600;
      "
    ></label>

    <textarea
      id="discoveryMolecules"
      rows="6"
      style="
        width:100%;
        min-height:130px;
        resize:vertical;
        box-sizing:border-box;
      "
    ></textarea>

    <div
      id="discoveryMoleculesHint"
      style="
        margin-top:8px;
        font-size:13px;
        opacity:.75;
      "
    ></div>
  `;

  const button =
    $('discoveryRun');

  if (button) {

    button.parentNode.insertBefore(
      wrapper,
      button
    );

  } else {

    tool.appendChild(wrapper);
  }

  translateDynamicUI();
}


/* =========================================================
   DRUG DISCOVERY
========================================================= */

async function discoveryCreate() {

  prepareDiscoveryUI();

  const target =
    $('discoveryTarget')
      ?.value
      .trim();

  const moleculesText =
    $('discoveryMolecules')
      ?.value
      .trim() || '';

  if (!target) {

    setStatus(
      'discoveryStatus',
      t('enterTarget')
    );

    return;
  }

  if (!moleculesText) {

    setStatus(
      'discoveryStatus',
      t('enterMolecule')
    );

    return;
  }

  const molecules =
    moleculesText
      .split('\n')
      .map(item => item.trim())
      .filter(Boolean);

  setStatus(
    'discoveryStatus',
    t('virtualScreening')
  );

  try {

    const data =
      await api(
        '/discovery/screen',
        {
          method: 'POST',
          body: JSON.stringify({
            target,
            molecules
          })
        }
      );

    if ($('discoveryResult')) {

      $('discoveryResult')
        .textContent =
        JSON.stringify(
          data,
          null,
          2
        );
    }

    setStatus(
      'discoveryStatus',
      t(
        'screeningCompleted',
        {
          count:
            data.molecule_count ??
            molecules.length
        }
      ),
      true
    );

  } catch (error) {

    console.error(
      'Drug Discovery error:',
      error
    );

    setStatus(
      'discoveryStatus',
      error.message ||
      t('screeningFailed')
    );
  }
}


/* =========================================================
   JOBS UI
========================================================= */

function prepareJobsUI() {

  const tool =
    $('jobsTool');

  if (!tool) return;

  if ($('jobsStatusPanel')) {
    translateDynamicUI();
    return;
  }

  const wrapper =
    document.createElement('div');

  wrapper.id =
    'jobsStatusPanel';

  wrapper.style.marginTop =
    '16px';

  wrapper.innerHTML = `
    <div
      id="jobsStatusTitle"
      style="
        margin-bottom:10px;
        font-weight:600;
      "
    ></div>

    <div
      id="jobsStatusLive"
      style="
        padding:10px;
        border-radius:8px;
        background:rgba(255,255,255,.05);
        margin-bottom:12px;
      "
    ></div>

    <button
      id="jobsStatusRefresh"
      type="button"
    ></button>
  `;

  tool.prepend(wrapper);

  $('jobsStatusRefresh')
    .addEventListener(
      'click',
      loadJobStatus
    );

  translateDynamicUI();

  $('jobsStatusLive').textContent =
    t('checkingWorker');
}


async function loadJobStatus() {

  prepareJobsUI();

  if ($('jobsStatusLive')) {

    $('jobsStatusLive')
      .textContent =
      t('checkingWorker');
  }

  try {

    const data =
      await api('/jobs/status');

    if ($('jobsStatusLive')) {

      $('jobsStatusLive')
        .textContent =
        `${t('worker')}: ${data.worker || 'unknown'} | ${t('queue')}: ${data.queue || 'unknown'} | ${t('active')}: ${data.active_jobs ?? 0}`;
    }

    return data;

  } catch (error) {

    if ($('jobsStatusLive')) {

      $('jobsStatusLive')
        .textContent =
        t(
          'workerError',
          {
            error: error.message
          }
        );
    }
  }
}


/* =========================================================
   JOBS
========================================================= */

async function loadJobs() {

  prepareJobsUI();

  setStatus(
    'jobsStatus',
    t('loading')
  );

  try {

    const data =
      await api('/jobs');

    if ($('jobsResult')) {

      $('jobsResult')
        .textContent =
        JSON.stringify(
          data,
          null,
          2
        );
    }

    await loadJobStatus();

    setStatus(
      'jobsStatus',
      t('loaded'),
      true
    );

  } catch (error) {

    setStatus(
      'jobsStatus',
      error.message
    );

    await loadJobStatus();
  }
}


async function createJob() {

  const type =
    $('jobType')?.value ||
    'scientific_analysis';

  setStatus(
    'jobCreateStatus',
    t('submitting')
  );

  try {

    const data =
      await api(
        '/jobs',
        {
          method: 'POST',
          body: JSON.stringify({
            job_type: type,
            input: {
              source: 'web'
            }
          })
        }
      );

    if ($('jobCreateResult')) {

      $('jobCreateResult')
        .textContent =
        JSON.stringify(
          data,
          null,
          2
        );
    }

    setStatus(
      'jobCreateStatus',
      t('jobSubmitted'),
      true
    );

    await loadJobStatus();

  } catch (error) {

    setStatus(
      'jobCreateStatus',
      error.message
    );
  }
}


/* =========================================================
   REPORTS UI
========================================================= */

function prepareReportsUI() {

  const tool =
    $('reportsTool');

  if (!tool) return;

  if ($('reportGeneratorPanel')) {
    translateDynamicUI();
    return;
  }

  const wrapper =
    document.createElement('div');

  wrapper.id =
    'reportGeneratorPanel';

  wrapper.style.marginTop =
    '16px';

  wrapper.innerHTML = `
    <div
      id="reportGeneratorTitle"
      style="
        margin-bottom:8px;
        font-weight:600;
      "
    ></div>

    <input
      id="reportType"
      type="text"
      value="Biomedical Research Report"
      style="
        width:100%;
        box-sizing:border-box;
        margin-bottom:8px;
      "
    />

    <textarea
      id="reportInput"
      rows="5"
      style="
        width:100%;
        box-sizing:border-box;
        resize:vertical;
      "
    ></textarea>

    <button
      id="reportGenerate"
      type="button"
      style="margin-top:8px;"
    ></button>

    <div
      id="reportGenerateStatus"
      style="margin-top:8px;"
    ></div>

    <pre
      id="reportGenerateResult"
      style="
        white-space:pre-wrap;
        margin-top:12px;
      "
    ></pre>
  `;

  tool.prepend(wrapper);

  $('reportGenerate')
    .addEventListener(
      'click',
      generateReport
    );

  translateDynamicUI();
}


/* =========================================================
   REPORTS
========================================================= */

async function loadReports() {

  prepareReportsUI();

  setStatus(
    'reportsStatus',
    t('loading')
  );

  try {

    const data =
      await api('/reports');

    if ($('reportsResult')) {

      $('reportsResult')
        .textContent =
        JSON.stringify(
          data,
          null,
          2
        );
    }

    setStatus(
      'reportsStatus',
      t('loaded'),
      true
    );

  } catch (error) {

    setStatus(
      'reportsStatus',
      error.message
    );
  }
}


async function generateReport() {

  const type =
    $('reportType')
      ?.value
      .trim() ||
    'Biomedical Research Report';

  const input =
    $('reportInput')
      ?.value
      .trim() || '';

  setStatus(
    'reportGenerateStatus',
    t('generatingReport')
  );

  try {

    const data =
      await api(
        '/reports/generate',
        {
          method: 'POST',
          body: JSON.stringify({
            workflow_type: type,
            input
          })
        }
      );

    if ($('reportGenerateResult')) {

      $('reportGenerateResult')
        .textContent =
        JSON.stringify(
          data,
          null,
          2
        );
    }

    setStatus(
      'reportGenerateStatus',
      t('reportGenerated'),
      true
    );

  } catch (error) {

    setStatus(
      'reportGenerateStatus',
      error.message
    );
  }
}


/* =========================================================
   RESEARCH UI
========================================================= */

function prepareResearchUI() {

  const tool =
    $('researchTool');

  if (!tool) return;

  if ($('researchAssistantPanel')) {
    translateDynamicUI();
    return;
  }

  const wrapper =
    document.createElement('div');

  wrapper.id =
    'researchAssistantPanel';

  wrapper.style.marginTop =
    '16px';

  wrapper.innerHTML = `
    <div
      id="researchAssistantTitle"
      style="
        margin-bottom:8px;
        font-weight:600;
      "
    ></div>

    <textarea
      id="assistantQuery"
      rows="5"
      style="
        width:100%;
        box-sizing:border-box;
        resize:vertical;
      "
    ></textarea>

    <button
      id="assistantRun"
      type="button"
      style="margin-top:8px;"
    ></button>

    <div
      id="assistantStatus"
      style="margin-top:8px;"
    ></div>

    <pre
      id="assistantResult"
      style="
        white-space:pre-wrap;
        margin-top:12px;
      "
    ></pre>
  `;

  tool.prepend(wrapper);

  $('assistantRun')
    .addEventListener(
      'click',
      researchAssistant
    );

  translateDynamicUI();
}


/* =========================================================
   RESEARCH ASSISTANT
========================================================= */

async function researchAssistant() {

  const query =
    $('assistantQuery')
      ?.value
      .trim();

  if (!query) {

    setStatus(
      'assistantStatus',
      t('enterResearchQuestion')
    );

    return;
  }

  setStatus(
    'assistantStatus',
    t('researchPipeline')
  );

  try {

    const data =
      await api(
        '/research/assistant',
        {
          method: 'POST',
          body: JSON.stringify({
            query
          })
        }
      );

    if ($('assistantResult')) {

      $('assistantResult')
        .textContent =
        JSON.stringify(
          data,
          null,
          2
        );
    }

    setStatus(
      'assistantStatus',
      t('researchCompleted'),
      true
    );

  } catch (error) {

    setStatus(
      'assistantStatus',
      error.message
    );
  }
}


/* =========================================================
   RESEARCH SEARCH
========================================================= */

async function researchSearch() {

  const query =
    $('researchQuery')
      ?.value
      .trim();

  if (!query) {

    setStatus(
      'researchStatus',
      t('enterResearchQuery')
    );

    return;
  }

  setStatus(
    'researchStatus',
    t('searching')
  );

  try {

    const data =
      await api(
        '/research/search',
        {
          method: 'POST',
          body: JSON.stringify({
            query,
            limit: 10
          })
        }
      );

    if ($('researchResult')) {

      $('researchResult')
        .textContent =
        JSON.stringify(
          data,
          null,
          2
        );
    }

    setStatus(
      'researchStatus',
      t('searchCompleted'),
      true
    );

  } catch (error) {

    setStatus(
      'researchStatus',
      error.message
    );
  }
}


/* =========================================================
   VIRTUAL LAB UI
========================================================= */

function prepareVirtualLabUI() {

  const tool =
    $('workflowTool');

  if (!tool) return;

  if ($('virtualLabPanel')) {
    translateDynamicUI();
    return;
  }

  const wrapper =
    document.createElement('div');

  wrapper.id =
    'virtualLabPanel';

  wrapper.style.marginTop =
    '16px';

  wrapper.innerHTML = `
    <div
      id="virtualLabTitle"
      style="
        margin-bottom:8px;
        font-weight:600;
      "
    ></div>

    <select
      id="labExperimentType"
      style="
        width:100%;
        margin-bottom:8px;
      "
    >
      <option value="molecular_analysis"></option>
      <option value="bioinformatics"></option>
      <option value="drug_discovery"></option>
      <option value="structural_biology"></option>
      <option value="custom"></option>
    </select>

    <textarea
      id="labExperimentInput"
      rows="6"
      style="
        width:100%;
        box-sizing:border-box;
        resize:vertical;
      "
    ></textarea>

    <button
      id="labExperimentCreate"
      type="button"
      style="margin-top:8px;"
    ></button>

    <div
      id="labExperimentStatus"
      style="margin-top:8px;"
    ></div>

    <pre
      id="labExperimentResult"
      style="
        white-space:pre-wrap;
        margin-top:12px;
      "
    ></pre>
  `;

  tool.prepend(wrapper);

  $('labExperimentCreate')
    .addEventListener(
      'click',
      createExperiment
    );

  translateDynamicUI();
}


/* =========================================================
   VIRTUAL LAB
========================================================= */

async function createExperiment() {

  const workflowType =
    $('labExperimentType')
      ?.value ||
    'custom';

  const input =
    $('labExperimentInput')
      ?.value
      .trim() || '';

  setStatus(
    'labExperimentStatus',
    t('creatingExperiment')
  );

  try {

    const data =
      await api(
        '/lab/experiments',
        {
          method: 'POST',
          body: JSON.stringify({
            workflow_type:
              workflowType,
            input
          })
        }
      );

    if ($('labExperimentResult')) {

      $('labExperimentResult')
        .textContent =
        JSON.stringify(
          data,
          null,
          2
        );
    }

    setStatus(
      'labExperimentStatus',
      t('experimentCreated'),
      true
    );

  } catch (error) {

    setStatus(
      'labExperimentStatus',
      error.message
    );
  }
}


/* =========================================================
   WORKFLOWS
========================================================= */

async function workflowList() {

  setStatus(
    'workflowStatus',
    t('loading')
  );

  try {

    const data =
      await api('/workflows');

    if ($('workflowResult')) {

      $('workflowResult')
        .textContent =
        JSON.stringify(
          data,
          null,
          2
        );
    }

    setStatus(
      'workflowStatus',
      t('workflowLoaded'),
      true
    );

  } catch (error) {

    setStatus(
      'workflowStatus',
      error.message
    );
  }
}


/* =========================================================
   MODULES
========================================================= */

const MODULE_KEYS = {

  'Molecular Analysis':
    'molecularAnalysis',

  'Bioinformatics':
    'bioinformaticsExperiment',

  'PDB & Structure':
    'structurePrediction',

  'Drug Discovery':
    'drugDiscoveryExperiment',

  'Scientific Jobs':
    'scientificWorker',

  'Research Assistant':
    'aiResearchAssistant',

  'Virtual Laboratory':
    'virtualLaboratory',

  'Reports & History':
    'generateScientificReport'
};


function openModule(name) {

  if ($('workspace')) {
    $('workspace')
      .classList
      .remove('hidden');
  }

  if ($('workspaceTitle')) {

    $('workspaceTitle')
      .textContent =
      t(
        MODULE_KEYS[name] ||
        name
      );
  }

  document
    .querySelectorAll('.tool')
    .forEach(
      element =>
        element.classList.add('hidden')
    );

  if ($('comingSoon')) {
    $('comingSoon')
      .classList.add('hidden');
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

    'Reports & History':
      'reportsTool'
  };

  const toolId =
    map[name];

  if (toolId && $(toolId)) {

    $(toolId)
      .classList
      .remove('hidden');

  } else if ($('comingSoon')) {

    $('comingSoon')
      .classList
      .remove('hidden');
  }


  if (name === 'Drug Discovery') {
    prepareDiscoveryUI();
  }


  if (name === 'Scientific Jobs') {
    prepareJobsUI();
    loadJobs();
  }


  if (name === 'Research Assistant') {
    prepareResearchUI();
  }


  if (name === 'Virtual Laboratory') {
    prepareVirtualLabUI();
  }


  if (name === 'Reports & History') {
    prepareReportsUI();
    loadReports();
  }


  if ($('workspace')) {

    $('workspace')
      .scrollIntoView({
        behavior: 'smooth',
        block: 'start'
      });
  }
}


/* =========================================================
   EVENT LISTENER HELPER
========================================================= */

function bind(id, event, fn) {

  const element = $(id);

  if (element) {
    element.addEventListener(
      event,
      fn
    );
  }
}


/* =========================================================
   MODULE EVENTS
========================================================= */

document
  .querySelectorAll('.module')
  .forEach(
    button => {

      button.addEventListener(
        'click',
        () =>
          openModule(
            button.dataset.module
          )
      );
    }
  );


bind(
  'molecularRun',
  'click',
  molecularAnalyze
);

bind(
  'jobsRefresh',
  'click',
  loadJobs
);

bind(
  'reportsRefresh',
  'click',
  loadReports
);

bind(
  'workspaceClose',
  'click',
  () => {

    if ($('workspace')) {
      $('workspace')
        .classList
        .add('hidden');
    }
  }
);

bind(
  'pdbRun',
  'click',
  pdbLookup
);

bind(
  'discoveryRun',
  'click',
  discoveryCreate
);

bind(
  'workflowRefresh',
  'click',
  workflowList
);

bind(
  'bioRun',
  'click',
  bioinformaticsRun
);

bind(
  'researchRun',
  'click',
  researchSearch
);

bind(
  'jobCreate',
  'click',
  createJob
);


/* =========================================================
   LANGUAGE CHANGE
========================================================= */

function setupLanguageRefresh() {

  const selectors = [
    $('languageSelector'),
    $('loginLanguageSelector')
  ].filter(Boolean);

  selectors.forEach(
    selector => {

      if (
        selector.dataset
          .medgenLanguageBound === '1'
      ) {
        return;
      }

      selector.dataset
        .medgenLanguageBound = '1';

      selector.addEventListener(
        'change',
        () => {

          localStorage.setItem(
            'medgen_language',
            selector.value
          );

          translateDynamicUI();

          checkHealth();

          /*
           * Agar Scientific Jobs ochiq bo‘lsa,
           * statusni yangi tilda qayta chiqaramiz.
           */
          if ($('jobsStatusLive')) {
            loadJobStatus();
          }

          /*
           * Workspace sarlavhasini yangilash.
           */
          const activeModule =
            document.querySelector(
              '.module.active'
            );

          if (activeModule) {
            openModule(
              activeModule.dataset.module
            );
          }
        }
      );
    }
  );
}


/* =========================================================
   INITIAL LANGUAGE
========================================================= */

function initializeLanguage() {

  let lang =
    localStorage.getItem(
      'medgen_language'
    );

  if (
    lang !== 'en' &&
    lang !== 'uz' &&
    lang !== 'ru'
  ) {

    lang = 'uz';

    localStorage.setItem(
      'medgen_language',
      lang
    );
  }

  const selectors = [
    $('languageSelector'),
    $('loginLanguageSelector')
  ].filter(Boolean);

  selectors.forEach(
    selector => {
      selector.value = lang;
    }
  );

  translateDynamicUI();
}


initializeLanguage();
setupLanguageRefresh();


/* =========================================================
   EXISTING SESSION
========================================================= */

if (state.token) {

  api('/auth/me')
    .then(
      user => {

        state.user =
          user;

        showDashboard();
      }
    )
    .catch(
      () => {

        state.token = '';
        state.user = null;

        sessionStorage.removeItem(
          CONFIG.tokenKey
        );

        showLogin();
      }
    );

} else {

  showLogin();
}
