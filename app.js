const $ = (id) => document.getElementById(id);

const state = {
  token: sessionStorage.getItem('medgen_access_token') || '',
  user: null
};

const CONFIG = {
  apiBase: (
    window.MEDGEN_API_BASE ||
    'https://medgenai-web-1.onrender.com/api/v1'
  ),
  tokenKey: 'medgen_access_token'
};


/* =========================
   API
========================= */

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

  const r = await fetch(
    CONFIG.apiBase + path,
    {
      ...options,
      headers
    }
  );

  let data = null;

  try {
    data = await r.json();
  } catch {}

  if (!r.ok) {
    throw new Error(
      data?.detail ||
      data?.message ||
      `HTTP ${r.status}`
    );
  }

  return data;
}


/* =========================
   HELPERS
========================= */

function setStatus(id, msg, ok = false) {

  const e = $(id);

  if (e) {
    e.textContent = msg;
    e.style.color = ok ? '#8eeed2' : '';
  }
}


function showLogin() {

  if ($('dashboardView')) {
    $('dashboardView')
      .classList
      .add('hidden');
  }

  if ($('loginView')) {
    $('loginView')
      .classList
      .remove('hidden');
  }
}


function showDashboard() {

  if ($('loginView')) {
    $('loginView')
      .classList
      .add('hidden');
  }

  if ($('dashboardView')) {
    $('dashboardView')
      .classList
      .remove('hidden');
  }

  updateRole();
  checkHealth();
}


function updateRole() {

  const role =
    state.user?.role || 'USER';

  if ($('roleBadge')) {
    $('roleBadge').textContent =
      role;
  }
}


/* =========================
   HEALTH
========================= */

async function checkHealth() {

  try {

    const r = await fetch(
      CONFIG.apiBase.replace(
        /\/api\/v1$/,
        ''
      ) +
      '/api/v1/health/live'
    );

    if (!r.ok) {
      throw new Error();
    }

    if ($('healthBadge')) {
      $('healthBadge').textContent =
        'API: online';
    }

    if ($('apiText')) {
      $('apiText').textContent =
        'online';
    }

  } catch {

    if ($('healthBadge')) {
      $('healthBadge').textContent =
        'API: offline';
    }

    if ($('apiText')) {
      $('apiText').textContent =
        'not connected';
    }
  }
}


/* =========================
   LOGIN
========================= */

if ($('loginForm')) {

  $('loginForm').addEventListener(
    'submit',
    async (e) => {

      e.preventDefault();

      setStatus(
        'loginStatus',
        'Signing in…'
      );

      try {

        const body = {
          username:
            $('loginUser')
              .value
              .trim(),

          password:
            $('loginPassword')
              .value
        };

        const data =
          await api(
            '/auth/login',
            {
              method: 'POST',
              body:
                JSON.stringify(body)
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

      } catch (err) {

        console.error(
          'Login error:',
          err
        );

        setStatus(
          'loginStatus',
          err.message ||
          'Login failed.'
        );
      }
    }
  );
}


/* =========================
   LOGOUT
========================= */

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


/* =========================
   MOLECULAR ANALYSIS
========================= */

async function molecularAnalyze() {

  const smiles =
    $('smilesInput')
      ?.value
      .trim();

  if (!smiles) {

    setStatus(
      'molecularStatus',
      'Enter a SMILES string.'
    );

    return;
  }

  setStatus(
    'molecularStatus',
    'Analyzing…'
  );

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
      'Analysis completed.',
      true
    );

  } catch (err) {

    setStatus(
      'molecularStatus',
      err.message
    );
  }
}


/* =========================
   BIOINFORMATICS
========================= */

async function bioinformaticsRun() {

  const seq =
    $('bioSequence')
      ?.value
      .trim();

  if (!seq) {

    setStatus(
      'bioStatus',
      'Enter a DNA/RNA/protein sequence.'
    );

    return;
  }

  setStatus(
    'bioStatus',
    'Analyzing…'
  );

  try {

    const data =
      await api(
        '/bioinformatics/analyze',
        {
          method: 'POST',
          body:
            JSON.stringify({
              sequence: seq,
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
      'Analysis completed.',
      true
    );

  } catch (err) {

    setStatus(
      'bioStatus',
      err.message
    );
  }
}


/* =========================
   PDB
========================= */

async function pdbLookup() {

  const id =
    $('pdbInput')
      ?.value
      .trim()
      .toUpperCase();

  if (!id) {

    setStatus(
      'pdbStatus',
      'Enter a PDB ID.'
    );

    return;
  }

  setStatus(
    'pdbStatus',
    'Loading…'
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
      'Loaded.',
      true
    );

  } catch (err) {

    setStatus(
      'pdbStatus',
      err.message
    );
  }
}


/* =========================
   DRUG DISCOVERY UI
========================= */

function prepareDiscoveryUI() {

  const tool =
    $('discoveryTool');

  if (!tool) {
    return;
  }

  if ($('discoveryMolecules')) {
    return;
  }

  const wrapper =
    document.createElement('div');

  wrapper.style.marginTop =
    '16px';

  wrapper.innerHTML = `
    <label
      for="discoveryMolecules"
      style="
        display:block;
        margin-bottom:8px;
        font-weight:600;
      "
    >
      Molecules / SMILES
    </label>

    <textarea
      id="discoveryMolecules"
      rows="6"
      placeholder="Enter one SMILES per line

Example:
CCO
C1=CC=CC=C1
CC(=O)O"
      style="
        width:100%;
        min-height:130px;
        resize:vertical;
        box-sizing:border-box;
      "
    ></textarea>

    <div
      style="
        margin-top:8px;
        font-size:13px;
        opacity:.75;
      "
    >
      One molecule per line.
      Screening will rank the molecules.
    </div>
  `;

  const button =
    $('discoveryRun');

  if (button) {

    button.textContent =
      'Run Screening';

    button.parentNode.insertBefore(
      wrapper,
      button
    );

  } else {

    tool.appendChild(wrapper);
  }
}


/* =========================
   DRUG DISCOVERY
========================= */

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
      'Enter a target.'
    );

    return;
  }

  if (!moleculesText) {

    setStatus(
      'discoveryStatus',
      'Enter at least one molecule.'
    );

    return;
  }

  const molecules =
    moleculesText
      .split('\n')
      .map(
        item => item.trim()
      )
      .filter(Boolean);

  setStatus(
    'discoveryStatus',
    'Running virtual screening…'
  );

  try {

    const data =
      await api(
        '/discovery/screen',
        {
          method: 'POST',
          body:
            JSON.stringify({
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
      `Screening completed: ${data.molecule_count} molecules ranked.`,
      true
    );

  } catch (err) {

    console.error(
      'Drug Discovery error:',
      err
    );

    setStatus(
      'discoveryStatus',
      err.message ||
      'Screening failed.'
    );
  }
}


/* =========================
   JOBS UI
========================= */

function prepareJobsUI() {

  const tool =
    $('jobsTool');

  if (!tool) {
    return;
  }

  if ($('jobsStatusPanel')) {
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
      style="
        margin-bottom:10px;
        font-weight:600;
      "
    >
      Scientific Worker
    </div>

    <div
      id="jobsStatusLive"
      style="
        padding:10px;
        border-radius:8px;
        background:rgba(255,255,255,.05);
        margin-bottom:12px;
      "
    >
      Checking worker…
    </div>

    <button
      id="jobsStatusRefresh"
      type="button"
    >
      Refresh Worker
    </button>
  `;

  tool.prepend(wrapper);

  $('jobsStatusRefresh')
    .addEventListener(
      'click',
      loadJobStatus
    );
}


async function loadJobStatus() {

  prepareJobsUI();

  if ($('jobsStatusLive')) {
    $('jobsStatusLive')
      .textContent =
      'Checking worker…';
  }

  try {

    const data =
      await api(
        '/jobs/status'
      );

    if ($('jobsStatusLive')) {
      $('jobsStatusLive')
        .textContent =
        `Worker: ${data.worker || 'unknown'} | Queue: ${data.queue || 'unknown'} | Active: ${data.active_jobs ?? 0}`;
    }

    return data;

  } catch (err) {

    if ($('jobsStatusLive')) {
      $('jobsStatusLive')
        .textContent =
        `Worker error: ${err.message}`;
    }
  }
}


/* =========================
   JOBS
========================= */

async function loadJobs() {

  prepareJobsUI();

  setStatus(
    'jobsStatus',
    'Loading…'
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
      'Loaded.',
      true
    );

  } catch (err) {

    setStatus(
      'jobsStatus',
      err.message
    );

    await loadJobStatus();
  }
}


async function createJob() {

  const type =
    $('jobType')
      ?.value ||
    'scientific_analysis';

  setStatus(
    'jobCreateStatus',
    'Submitting…'
  );

  try {

    const data =
      await api(
        '/jobs',
        {
          method: 'POST',
          body:
            JSON.stringify({
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
      'Job submitted.',
      true
    );

    await loadJobStatus();

  } catch (err) {

    setStatus(
      'jobCreateStatus',
      err.message
    );
  }
}


/* =========================
   REPORTS UI
========================= */

function prepareReportsUI() {

  const tool =
    $('reportsTool');

  if (!tool) {
    return;
  }

  if ($('reportGeneratorPanel')) {
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
      style="
        margin-bottom:8px;
        font-weight:600;
      "
    >
      Generate Scientific Report
    </div>

    <input
      id="reportType"
      type="text"
      value="Biomedical Research Report"
      placeholder="Report type"
      style="
        width:100%;
        box-sizing:border-box;
        margin-bottom:8px;
      "
    />

    <textarea
      id="reportInput"
      rows="5"
      placeholder="Describe the research, target, experiment or analysis..."
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
    >
      Generate Report
    </button>

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
}


/* =========================
   REPORTS
========================= */

async function loadReports() {

  prepareReportsUI();

  setStatus(
    'reportsStatus',
    'Loading…'
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
      'Loaded.',
      true
    );

  } catch (err) {

    setStatus(
      'reportsStatus',
      err.message
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
    'Generating report…'
  );

  try {

    const data =
      await api(
        '/reports/generate',
        {
          method: 'POST',
          body:
            JSON.stringify({
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
      'Report generated.',
      true
    );

  } catch (err) {

    setStatus(
      'reportGenerateStatus',
      err.message
    );
  }
}


/* =========================
   RESEARCH UI
========================= */

function prepareResearchUI() {

  const tool =
    $('researchTool');

  if (!tool) {
    return;
  }

  if ($('researchAssistantPanel')) {
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
      style="
        margin-bottom:8px;
        font-weight:600;
      "
    >
      AI Research Assistant
    </div>

    <textarea
      id="assistantQuery"
      rows="5"
      placeholder="Ask a biomedical research question..."
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
    >
      Run Research Assistant
    </button>

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
}


/* =========================
   RESEARCH ASSISTANT
========================= */

async function researchAssistant() {

  const query =
    $('assistantQuery')
      ?.value
      .trim();

  if (!query) {

    setStatus(
      'assistantStatus',
      'Enter a research question.'
    );

    return;
  }

  setStatus(
    'assistantStatus',
    'Running research pipeline…'
  );

  try {

    const data =
      await api(
        '/research/assistant',
        {
          method: 'POST',
          body:
            JSON.stringify({
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
      'Research Assistant completed.',
      true
    );

  } catch (err) {

    setStatus(
      'assistantStatus',
      err.message
    );
  }
}


/* =========================
   RESEARCH SEARCH
========================= */

async function researchSearch() {

  const q =
    $('researchQuery')
      ?.value
      .trim();

  if (!q) {

    setStatus(
      'researchStatus',
      'Enter a research query.'
    );

    return;
  }

  setStatus(
    'researchStatus',
    'Searching…'
  );

  try {

    const data =
      await api(
        '/research/search',
        {
          method: 'POST',
          body:
            JSON.stringify({
              query: q,
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
      'Search completed.',
      true
    );

  } catch (err) {

    setStatus(
      'researchStatus',
      err.message
    );
  }
}


/* =========================
   VIRTUAL LAB UI
========================= */

function prepareVirtualLabUI() {

  const tool =
    $('workflowTool');

  if (!tool) {
    return;
  }

  if ($('virtualLabPanel')) {
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
      style="
        margin-bottom:8px;
        font-weight:600;
      "
    >
      Virtual Laboratory
    </div>

    <select
      id="labExperimentType"
      style="
        width:100%;
        margin-bottom:8px;
      "
    >
      <option value="molecular_analysis">
        Molecular Analysis
      </option>

      <option value="bioinformatics">
        Bioinformatics Experiment
      </option>

      <option value="drug_discovery">
        Drug Discovery Experiment
      </option>

      <option value="structural_biology">
        Structural Biology
      </option>

      <option value="custom">
        Custom Experiment
      </option>
    </select>

    <textarea
      id="labExperimentInput"
      rows="6"
      placeholder="Experiment input..."
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
    >
      Create Experiment
    </button>

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
}


/* =========================
   VIRTUAL LAB
========================= */

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
    'Creating experiment…'
  );

  try {

    const data =
      await api(
        '/lab/experiments',
        {
          method: 'POST',
          body:
            JSON.stringify({
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
      'Experiment created.',
      true
    );

  } catch (err) {

    setStatus(
      'labExperimentStatus',
      err.message
    );
  }
}


/* =========================
   WORKFLOWS
========================= */

async function workflowList() {

  setStatus(
    'workflowStatus',
    'Loading…'
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
      'Loaded.',
      true
    );

  } catch (err) {

    setStatus(
      'workflowStatus',
      err.message
    );
  }
}


/* =========================
   MODULES
========================= */

function openModule(name) {

  if ($('workspace')) {
    $('workspace')
      .classList
      .remove('hidden');
  }

  if ($('workspaceTitle')) {
    $('workspaceTitle')
      .textContent = name;
  }

  document
    .querySelectorAll('.tool')
    .forEach(
      e =>
        e.classList.add('hidden')
    );

  if ($('comingSoon')) {
    $('comingSoon')
      .classList
      .add('hidden');
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

  const id =
    map[name];

  if (id && $(id)) {

    $(id)
      .classList
      .remove('hidden');

  } else if ($('comingSoon')) {

    $('comingSoon')
      .classList
      .remove('hidden');
  }


  /* Drug Discovery */

  if (
    name ===
    'Drug Discovery'
  ) {
    prepareDiscoveryUI();
  }


  /* Scientific Jobs */

  if (
    name ===
    'Scientific Jobs'
  ) {
    prepareJobsUI();
    loadJobs();
    loadJobStatus();
  }


  /* Research Assistant */

  if (
    name ===
    'Research Assistant'
  ) {
    prepareResearchUI();
  }


  /* Virtual Laboratory */

  if (
    name ===
    'Virtual Laboratory'
  ) {
    prepareVirtualLabUI();
  }


  /* Reports */

  if (
    name ===
    'Reports & History'
  ) {
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


/* =========================
   EVENT LISTENERS
========================= */

function bind(id, event, fn) {

  const element = $(id);

  if (element) {
    element.addEventListener(
      event,
      fn
    );
  }
}


document
  .querySelectorAll('.module')
  .forEach(
    b =>
      b.addEventListener(
        'click',
        () =>
          openModule(
            b.dataset.module
          )
      )
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


/* =========================
   EXISTING SESSION
========================= */

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
/* =========================================================
   MEDGEN AI — INTERNATIONALIZATION
   English / Uzbek / Russian
   Instant switch + localStorage
   ========================================================= */

(function () {
  const translations = {
    en: {
      "MEDGEN AI": "MEDGEN AI",
      "SUPER_ADMIN": "SUPER_ADMIN",
      "Logout": "Logout",
      "PRIVATE WORKSPACE": "PRIVATE WORKSPACE",
      "Biomedical AI Platform": "Biomedical AI Platform",
      "API": "API",
      "online": "online",
      "Registration": "Registration",
      "disabled": "disabled",
      "Environment": "Environment",
      "private": "private",

      "Molecular Analysis": "Molecular Analysis",
      "Analyze Molecule": "Analyze Molecule",
      "SMILES": "SMILES",
      "Analyze": "Analyze",

      "Bioinformatics": "Bioinformatics",
      "Sequence": "Sequence",
      "Analyze Sequence": "Analyze Sequence",

      "PDB Structure": "PDB Structure",
      "PDB ID": "PDB ID",
      "Load Structure": "Load Structure",

      "Drug Discovery": "Drug Discovery",
      "Target": "Target",
      "Molecules / SMILES": "Molecules / SMILES",
      "Run Screening": "Run Screening",
      "Virtual Screening": "Virtual Screening",

      "Scientific Jobs": "Scientific Jobs",
      "Worker": "Worker",
      "Queue": "Queue",
      "Active": "Active",
      "Refresh Jobs": "Refresh Jobs",

      "Research Assistant": "Research Assistant",
      "Search": "Search",
      "Ask Research Assistant": "Ask Research Assistant",

      "Virtual Laboratory": "Virtual Laboratory",
      "Experiment": "Experiment",
      "Create Experiment": "Create Experiment",
      "Refresh Workflows": "Refresh Workflows",

      "Reports & History": "Reports & History",
      "Generate Report": "Generate Report",
      "Refresh Reports": "Refresh Reports",

      "Loaded.": "Loaded.",
      "Loading...": "Loading...",
      "Ready": "Ready",
      "Completed": "Completed",
      "Error": "Error",

      "API: online": "API: online",
      "Registration: disabled": "Registration: disabled",
      "Environment: private": "Environment: private",

      "Choose module": "Choose module",
      "Example": "Example",
      "Run": "Run",
      "Create": "Create",
      "Refresh": "Refresh",

      "Scientific research platform": "Scientific research platform",
      "Private biomedical research workspace":
        "Private biomedical research workspace"
    },

    uz: {
      "MEDGEN AI": "MEDGEN AI",
      "SUPER_ADMIN": "SUPER_ADMIN",
      "Logout": "Chiqish",
      "PRIVATE WORKSPACE": "XUSUSIY ISH MUHITI",
      "Biomedical AI Platform": "Biotibbiy AI platformasi",
      "API": "API",
      "online": "ishlamoqda",
      "Registration": "Ro‘yxatdan o‘tish",
      "disabled": "o‘chirilgan",
      "Environment": "Muhit",
      "private": "xususiy",

      "Molecular Analysis": "Molekulyar tahlil",
      "Analyze Molecule": "Molekulani tahlil qilish",
      "SMILES": "SMILES",
      "Analyze": "Tahlil qilish",

      "Bioinformatics": "Bioinformatika",
      "Sequence": "Ketma-ketlik",
      "Analyze Sequence": "Ketma-ketlikni tahlil qilish",

      "PDB Structure": "PDB strukturasi",
      "PDB ID": "PDB ID",
      "Load Structure": "Strukturani yuklash",

      "Drug Discovery": "Dori vositalarini kashf qilish",
      "Target": "Nishon",
      "Molecules / SMILES": "Molekulalar / SMILES",
      "Run Screening": "Skriningni boshlash",
      "Virtual Screening": "Virtual skrining",

      "Scientific Jobs": "Ilmiy vazifalar",
      "Worker": "Worker",
      "Queue": "Navbat",
      "Active": "Faol",
      "Refresh Jobs": "Vazifalarni yangilash",

      "Research Assistant": "Ilmiy tadqiqot yordamchisi",
      "Search": "Qidirish",
      "Ask Research Assistant": "Tadqiqot yordamchisidan so‘rash",

      "Virtual Laboratory": "Virtual laboratoriya",
      "Experiment": "Tajriba",
      "Create Experiment": "Tajriba yaratish",
      "Refresh Workflows": "Workflowlarni yangilash",

      "Reports & History": "Hisobotlar va tarix",
      "Generate Report": "Hisobot yaratish",
      "Refresh Reports": "Hisobotlarni yangilash",

      "Loaded.": "Yuklandi.",
      "Loading...": "Yuklanmoqda...",
      "Ready": "Tayyor",
      "Completed": "Yakunlandi",
      "Error": "Xatolik",

      "API: online": "API: ishlamoqda",
      "Registration: disabled": "Ro‘yxatdan o‘tish: o‘chirilgan",
      "Environment: private": "Muhit: xususiy",

      "Choose module": "Modulni tanlang",
      "Example": "Misol",
      "Run": "Ishga tushirish",
      "Create": "Yaratish",
      "Refresh": "Yangilash",

      "Scientific research platform": "Ilmiy tadqiqot platformasi",
      "Private biomedical research workspace":
        "Xususiy biotibbiy tadqiqot ish muhiti"
    },

    ru: {
      "MEDGEN AI": "MEDGEN AI",
      "SUPER_ADMIN": "SUPER_ADMIN",
      "Logout": "Выйти",
      "PRIVATE WORKSPACE": "ЧАСТНОЕ РАБОЧЕЕ ПРОСТРАНСТВО",
      "Biomedical AI Platform": "Биомедицинская AI-платформа",
      "API": "API",
      "online": "онлайн",
      "Registration": "Регистрация",
      "disabled": "отключена",
      "Environment": "Среда",
      "private": "частная",

      "Molecular Analysis": "Молекулярный анализ",
      "Analyze Molecule": "Анализировать молекулу",
      "SMILES": "SMILES",
      "Analyze": "Анализировать",

      "Bioinformatics": "Биоинформатика",
      "Sequence": "Последовательность",
      "Analyze Sequence": "Анализировать последовательность",

      "PDB Structure": "Структура PDB",
      "PDB ID": "PDB ID",
      "Load Structure": "Загрузить структуру",

      "Drug Discovery": "Открытие лекарств",
      "Target": "Мишень",
      "Molecules / SMILES": "Молекулы / SMILES",
      "Run Screening": "Запустить скрининг",
      "Virtual Screening": "Виртуальный скрининг",

      "Scientific Jobs": "Научные задачи",
      "Worker": "Worker",
      "Queue": "Очередь",
      "Active": "Активно",
      "Refresh Jobs": "Обновить задачи",

      "Research Assistant": "Научный помощник",
      "Search": "Поиск",
      "Ask Research Assistant": "Спросить научного помощника",

      "Virtual Laboratory": "Виртуальная лаборатория",
      "Experiment": "Эксперимент",
      "Create Experiment": "Создать эксперимент",
      "Refresh Workflows": "Обновить рабочие процессы",

      "Reports & History": "Отчёты и история",
      "Generate Report": "Создать отчёт",
      "Refresh Reports": "Обновить отчёты",

      "Loaded.": "Загружено.",
      "Loading...": "Загрузка...",
      "Ready": "Готово",
      "Completed": "Завершено",
      "Error": "Ошибка",

      "API: online": "API: онлайн",
      "Registration: disabled": "Регистрация: отключена",
      "Environment: private": "Среда: частная",

      "Choose module": "Выберите модуль",
      "Example": "Пример",
      "Run": "Запустить",
      "Create": "Создать",
      "Refresh": "Обновить",

      "Scientific research platform": "Платформа научных исследований",
      "Private biomedical research workspace":
        "Частное рабочее пространство биомедицинских исследований"
    }
  };

  let currentLanguage =
    localStorage.getItem("medgen_language") || "en";

  if (!translations[currentLanguage]) {
    currentLanguage = "en";
  }

  function t(text) {
    if (!text) return text;

    const dictionary = translations[currentLanguage];

    if (dictionary[text]) {
      return dictionary[text];
    }

    return text;
  }

  function translateTextNode(node) {
    if (!node || node.nodeType !== Node.TEXT_NODE) return;

    const original = node.nodeValue.trim();

    if (!original) return;

    if (translations.en[original]) {
      node.nodeValue =
        node.nodeValue.replace(original, t(original));
    }
  }

  function translateElement(element) {
    if (!element) return;

    // Placeholder
    if (element.placeholder) {
      const original = element.getAttribute(
        "data-original-placeholder"
      ) || element.placeholder;

      if (!element.hasAttribute("data-original-placeholder")) {
        element.setAttribute(
          "data-original-placeholder",
          original
        );
      }

      element.placeholder = t(original);
    }

    // Title
    if (element.title) {
      const original =
        element.getAttribute("data-original-title") ||
        element.title;

      if (!element.hasAttribute("data-original-title")) {
        element.setAttribute(
          "data-original-title",
          original
        );
      }

      element.title = t(original);
    }

    // Value for buttons
    if (
      element.tagName === "INPUT" &&
      ["button", "submit", "reset"].includes(
        element.type
      )
    ) {
      const original =
        element.getAttribute("data-original-value") ||
        element.value;

      if (!element.hasAttribute("data-original-value")) {
        element.setAttribute(
          "data-original-value",
          original
        );
      }

      element.value = t(original);
    }

    for (const child of element.childNodes) {
      if (child.nodeType === Node.TEXT_NODE) {
        translateTextNode(child);
      }
    }
  }

  function applyTranslations() {
    document.documentElement.lang = currentLanguage;

    document
      .querySelectorAll("*")
      .forEach(translateElement);

    // Known interface elements
    const role = document.getElementById("roleBadge");
    if (role) role.textContent = "SUPER_ADMIN";

    const logout = document.getElementById("logoutBtn");
    if (logout) logout.textContent = t("Logout");

    // Module cards
    document
      .querySelectorAll("[data-module]")
      .forEach(card => {
        const module = card.dataset.module;

        const title =
          card.querySelector(
            "h1,h2,h3,h4,.module-title"
          );

        if (title) {
          title.textContent = t(module);
        }
      });

    // Translate common status text
    document
      .querySelectorAll(".status,.badge,.muted,.helper")
      .forEach(el => {
        const text = el.textContent.trim();

        if (translations.en[text]) {
          el.textContent = t(text);
        }
      });
  }

  function createLanguageSelector() {
    if (document.getElementById("medgenLanguageSelector")) {
      return;
    }

    const selector = document.createElement("select");

    selector.id = "medgenLanguageSelector";

    selector.innerHTML = `
      <option value="en">🇬🇧 EN</option>
      <option value="uz">🇺🇿 UZ</option>
      <option value="ru">🇷🇺 RU</option>
    `;

    selector.value = currentLanguage;

    selector.style.cssText = `
      margin-left: 12px;
      padding: 7px 10px;
      border-radius: 8px;
      border: 1px solid rgba(255,255,255,.18);
      background: rgba(0,0,0,.25);
      color: inherit;
      font-weight: 600;
      cursor: pointer;
      outline: none;
    `;

    selector.addEventListener("change", function () {
      currentLanguage = this.value;

      localStorage.setItem(
        "medgen_language",
        currentLanguage
      );

      applyTranslations();
    });

    // Try top/header areas first
    const targets = [
      document.querySelector("header"),
      document.querySelector(".topbar"),
      document.querySelector(".navbar"),
      document.querySelector(".header"),
      document.body
    ];

    let target = targets.find(Boolean);

    if (target) {
      target.appendChild(selector);
    }
  }

  // Expose globally for future modules
  window.MedGenI18n = {
    t,
    setLanguage(language) {
      if (!translations[language]) return;

      currentLanguage = language;

      localStorage.setItem(
        "medgen_language",
        language
      );

      const selector =
        document.getElementById(
          "medgenLanguageSelector"
        );

      if (selector) {
        selector.value = language;
      }

      applyTranslations();
    },

    getLanguage() {
      return currentLanguage;
    }
  };

  function initI18n() {
    createLanguageSelector();
    applyTranslations();
  }

  if (document.readyState === "loading") {
    document.addEventListener(
      "DOMContentLoaded",
      initI18n
    );
  } else {
    initI18n();
  }

  // Automatically translate dynamically created UI
  const observer = new MutationObserver(() => {
    applyTranslations();
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true
  });

})();
