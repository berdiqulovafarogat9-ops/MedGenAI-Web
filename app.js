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

async function api(path, options = {}) {
  if (!path.startsWith('/')) {
    throw new Error('Invalid API path');
  }

  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {})
  };

  if (state.token) {
    headers.Authorization = `Bearer ${state.token}`;
  }

  const r = await fetch(CONFIG.apiBase + path, {
    ...options,
    headers
  });

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

function showLogin() {
  $('dashboardView').classList.add('hidden');
  $('loginView').classList.remove('hidden');
}

function showDashboard() {
  $('loginView').classList.add('hidden');
  $('dashboardView').classList.remove('hidden');

  updateRole();
  checkHealth();
}

function updateRole() {
  const role = state.user?.role || 'USER';

  if ($('roleBadge')) {
    $('roleBadge').textContent = role;
  }
}

function setStatus(id, msg, ok = false) {
  const e = $(id);

  if (e) {
    e.textContent = msg;
    e.style.color = ok ? '#8eeed2' : '';
  }
}

async function checkHealth() {
  try {
    const r = await fetch(
      CONFIG.apiBase.replace(/\/api\/v1$/, '') +
      '/api/v1/health/live'
    );

    if (!r.ok) {
      throw new Error();
    }

    if ($('healthBadge')) {
      $('healthBadge').textContent = 'API: online';
    }

    if ($('apiText')) {
      $('apiText').textContent = 'online';
    }
  } catch {
    if ($('healthBadge')) {
      $('healthBadge').textContent = 'API: offline';
    }

    if ($('apiText')) {
      $('apiText').textContent = 'not connected';
    }
  }
}


/* =========================
   LOGIN
========================= */

$('loginForm').addEventListener('submit', async (e) => {
  e.preventDefault();

  setStatus('loginStatus', 'Signing in…');

  try {
    const body = {
      username: $('loginUser').value.trim(),
      password: $('loginPassword').value
    };

    const data = await api('/auth/login', {
      method: 'POST',
      body: JSON.stringify(body)
    });

    state.token = data.access_token;

    sessionStorage.setItem(
      CONFIG.tokenKey,
      state.token
    );

    state.user = await api('/auth/me');

    showDashboard();

    setStatus('loginStatus', '');
  } catch (err) {
    console.error('Login error:', err);

    setStatus(
      'loginStatus',
      err.message || 'Login failed.'
    );
  }
});


/* =========================
   LOGOUT
========================= */

$('logoutBtn').addEventListener('click', () => {
  state.token = '';
  state.user = null;

  sessionStorage.removeItem(CONFIG.tokenKey);

  showLogin();
});


/* =========================
   MOLECULAR ANALYSIS
========================= */

async function molecularAnalyze() {
  const smiles = $('smilesInput').value.trim();

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
    const data = await api(
      '/molecules/analyze',
      {
        method: 'POST',
        body: JSON.stringify({ smiles })
      }
    );

    $('molecularResult').textContent =
      JSON.stringify(data, null, 2);

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
   JOBS
========================= */

async function loadJobs() {
  setStatus(
    'jobsStatus',
    'Loading…'
  );

  try {
    const data = await api('/jobs');

    $('jobsResult').textContent =
      JSON.stringify(data, null, 2);

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
  }
}


/* =========================
   REPORTS
========================= */

async function loadReports() {
  setStatus(
    'reportsStatus',
    'Loading…'
  );

  try {
    const data = await api('/reports');

    $('reportsResult').textContent =
      JSON.stringify(data, null, 2);

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


/* =========================
   BIOINFORMATICS
========================= */

async function bioinformaticsRun() {
  const seq = $('bioSequence').value.trim();

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
    const data = await api(
      '/workflows',
      {
        method: 'POST',
        body: JSON.stringify({
          workflow_type: 'BIOINFORMATICS',
          input: {
            sequence: seq
          }
        })
      }
    );

    $('bioResult').textContent =
      JSON.stringify(data, null, 2);

    setStatus(
      'bioStatus',
      'Workflow submitted.',
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
   RESEARCH SEARCH
========================= */

async function researchSearch() {
  const q = $('researchQuery').value.trim();

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
    const data = await api(
      '/research/search',
      {
        method: 'POST',
        body: JSON.stringify({
          query: q,
          limit: 10
        })
      }
    );

    $('researchResult').textContent =
      JSON.stringify(data, null, 2);

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
   SCIENTIFIC JOB
========================= */

async function createJob() {
  const type = $('jobType').value;

  setStatus(
    'jobCreateStatus',
    'Submitting…'
  );

  try {
    const data = await api(
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

    $('jobCreateResult').textContent =
      JSON.stringify(data, null, 2);

    setStatus(
      'jobCreateStatus',
      'Job submitted.',
      true
    );
  } catch (err) {
    setStatus(
      'jobCreateStatus',
      err.message
    );
  }
}


/* =========================
   PDB
========================= */

async function pdbLookup() {
  const id = $('pdbInput')
    .value
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
    const data = await api(
      '/pdb/structures/' +
      encodeURIComponent(id)
    );

    $('pdbResult').textContent =
      JSON.stringify(data, null, 2);

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
   DRUG DISCOVERY
========================= */

async function discoveryCreate() {
  const target =
    $('discoveryTarget').value.trim();

  if (!target) {
    setStatus(
      'discoveryStatus',
      'Enter a target.'
    );
    return;
  }

  setStatus(
    'discoveryStatus',
    'Creating session…'
  );

  try {
    const data = await api(
      '/discovery/sessions',
      {
        method: 'POST',
        body: JSON.stringify({
          target
        })
      }
    );

    $('discoveryResult').textContent =
      JSON.stringify(data, null, 2);

    setStatus(
      'discoveryStatus',
      'Session created.',
      true
    );
  } catch (err) {
    setStatus(
      'discoveryStatus',
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
    const data = await api('/workflows');

    $('workflowResult').textContent =
      JSON.stringify(data, null, 2);

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
  $('workspace').classList.remove('hidden');

  $('workspaceTitle').textContent = name;

  document
    .querySelectorAll('.tool')
    .forEach(e => e.classList.add('hidden'));

  const map = {
    'Molecular Analysis': 'molecularTool',
    'Bioinformatics': 'bioTool',
    'PDB & Structure': 'pdbTool',
    'Drug Discovery': 'discoveryTool',
    'Scientific Jobs': 'jobsTool',
    'Research Assistant': 'researchTool',
    'Virtual Laboratory': 'workflowTool',
    'Reports & History': 'reportsTool'
  };

  const id = map[name];

  if (id) {
    $(id).classList.remove('hidden');
  } else {
    $('comingSoon').classList.remove('hidden');
  }

  if (name === 'Scientific Jobs') {
    loadJobs();
  }

  if (name === 'Reports & History') {
    loadReports();
  }

  $('workspace').scrollIntoView({
    behavior: 'smooth',
    block: 'start'
  });
}


/* =========================
   EVENT LISTENERS
========================= */

document
  .querySelectorAll('.module')
  .forEach(b =>
    b.addEventListener(
      'click',
      () => openModule(b.dataset.module)
    )
  );

$('molecularRun')
  .addEventListener(
    'click',
    molecularAnalyze
  );

$('jobsRefresh')
  .addEventListener(
    'click',
    loadJobs
  );

$('reportsRefresh')
  .addEventListener(
    'click',
    loadReports
  );

$('workspaceClose')
  .addEventListener(
    'click',
    () =>
      $('workspace').classList.add('hidden')
  );

$('pdbRun')
  .addEventListener(
    'click',
    pdbLookup
  );

$('discoveryRun')
  .addEventListener(
    'click',
    discoveryCreate
  );

$('workflowRefresh')
  .addEventListener(
    'click',
    workflowList
  );

$('bioRun')
  .addEventListener(
    'click',
    bioinformaticsRun
  );

$('researchRun')
  .addEventListener(
    'click',
    researchSearch
  );

$('jobCreate')
  .addEventListener(
    'click',
    createJob
  );


/* =========================
   EXISTING SESSION
========================= */

if (state.token) {
  api('/auth/me')
    .then(user => {
      state.user = user;
      showDashboard();
    })
    .catch(() => {
      state.token = '';
      state.user = null;

      sessionStorage.removeItem(
        CONFIG.tokenKey
      );

      showLogin();
    });
} else {
  showLogin();
}
