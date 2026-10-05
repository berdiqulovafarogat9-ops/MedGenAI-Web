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
