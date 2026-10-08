/* MedGen AI — Phase 1 deterministic UI controller
   One authentication boundary, one dashboard, one navigation controller.
*/
(function () {
  'use strict';

  const TOKEN_KEY = 'medgen_access_token';
  const API = window.MEDGEN_API_BASE || '/api/v1';
  const $ = (id) => document.getElementById(id);
  const token = () => sessionStorage.getItem(TOKEN_KEY) || '';

  const MODULES = {
    'Bioinformatics': ['bioTool'],
    'Molecular Analysis': ['molecularTool'],
    'PDB & Structure': ['pdbTool'],
    'Drug Discovery': ['discoveryTool'],
    'Scientific Jobs': ['jobsTool'],
    'Research Assistant': ['researchTool'],
    'Virtual Laboratory': ['virtualLabTool'],
    'Reports & History': ['reportsTool'],
    'Medical Academy': ['medicalAcademyTool'],
    'Global Platform': ['globalPlatformTool']
  };

  const ROLE_MODULES = {
    student: ['Medical Academy','Bioinformatics','Molecular Analysis','PDB & Structure','Virtual Laboratory','Research Assistant','Reports & History'],
    school_student: ['Bioinformatics','Molecular Analysis','PDB & Structure','Research Assistant','Reports & History'],
    doctor: ['Medical Academy','Research Assistant','PDB & Structure','Bioinformatics','Reports & History'],
    researcher: ['Bioinformatics','Molecular Analysis','PDB & Structure','Drug Discovery','Scientific Jobs','Research Assistant','Virtual Laboratory','Reports & History'],
    professor: ['Medical Academy','Bioinformatics','Research Assistant','Virtual Laboratory','Reports & History'],
    lab: ['Molecular Analysis','Bioinformatics','PDB & Structure','Virtual Laboratory','Scientific Jobs','Reports & History'],
    biotech: ['Bioinformatics','Molecular Analysis','PDB & Structure','Drug Discovery','Virtual Laboratory','Research Assistant','Reports & History'],
    pharma: ['Drug Discovery','Molecular Analysis','PDB & Structure','Research Assistant','Scientific Jobs','Reports & History'],
    bioinformatician: ['Bioinformatics','Molecular Analysis','PDB & Structure','Scientific Jobs','Research Assistant','Reports & History'],
    hospital: ['Medical Academy','Research Assistant','Bioinformatics','Reports & History'],
    company: ['Global Platform','Drug Discovery','Research Assistant','Scientific Jobs','Reports & History'],
    SUPER_ADMIN: ['Global Platform','Medical Academy','Bioinformatics','Molecular Analysis','PDB & Structure','Drug Discovery','Scientific Jobs','Research Assistant','Virtual Laboratory','Reports & History']
  };

  const ICONS = {
    'Medical Academy':'🎓','Bioinformatics':'🧬','Molecular Analysis':'⚗️','PDB & Structure':'🧫',
    'Drug Discovery':'💊','Scientific Jobs':'⚙️','Research Assistant':'📚','Virtual Laboratory':'🧪',
    'Reports & History':'📊','Global Platform':'🌐'
  };

  const LABELS = {
    'Medical Academy':'Medical Academy','Bioinformatics':'Bioinformatics','Molecular Analysis':'Molecular Analysis',
    'PDB & Structure':'PDB & Structure','Drug Discovery':'Drug Discovery','Scientific Jobs':'Scientific Jobs',
    'Research Assistant':'Research Assistant','Virtual Laboratory':'Virtual Laboratory',
    'Reports & History':'Reports & History','Global Platform':'Global Platform'
  };

  function roleKey(user) {
    const r = String(user?.role || 'student');
    return r.toUpperCase() === 'SUPER_ADMIN' ? 'SUPER_ADMIN' : r.toLowerCase();
  }

  function esc(v) {
    return String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }

  function normalize() {
    const user = window.__MEDGEN_USER || window.state?.user || null;
    return user;
  }

  function cleanBoundaries() {
    const login = $('loginView'), dash = $('dashboardView');
    if (login) { login.classList.add('hidden'); login.hidden = true; login.style.setProperty('display','none','important'); }
    if (dash) { dash.classList.remove('hidden'); dash.hidden = false; dash.style.setProperty('display','block','important'); }
  }

  function showLogin() {
    const login = $('loginView'), dash = $('dashboardView');
    if (login) { login.classList.remove('hidden'); login.hidden = false; login.style.removeProperty('display'); }
    if (dash) { dash.classList.add('hidden'); dash.hidden = true; dash.style.setProperty('display','none','important'); }
    document.body.classList.remove('medgen-authenticated');
  }

  function hideDashboardChildren() {
    const d = $('dashboardView');
    if (!d) return;
    d.querySelectorAll(':scope .container > *').forEach(el => el.classList.add('hidden'));
    ['workspace','moduleDirectory','roleDashboard','securityCenter','userDirectoryDashboard','educationPreferencePanel',
     'adminDashboard','supportCenter','aiCenter','communityCenter','scientificWorkflowPanel','moleculeVisualPanel',
     'functionalService','finalHome'].forEach(id => $(id)?.classList.add('hidden'));
  }

  function openWorkspace(module) {
    hideDashboardChildren();
    const ws = $('workspace');
    if (!ws) return;
    ws.classList.remove('hidden');
    ws.style.removeProperty('display');
    const title = $('workspaceTitle');
    if (title) title.textContent = LABELS[module] || module;
    Object.values(MODULES).flat().forEach(id => $(id)?.classList.add('hidden'));
    const ids = MODULES[module] || [];
    let opened = false;
    ids.forEach(id => { const el=$(id); if(el){el.classList.remove('hidden'); opened=true;} });
    const visual = $('moleculeVisualPanel');
    if (module === 'Molecular Analysis' && visual) visual.classList.remove('hidden');
    if (!opened) {
      const fallback = document.createElement('div');
      fallback.className='panel phase1-unavailable';
      fallback.innerHTML='<h3>'+esc(ICONS[module]||'🧬')+' '+esc(module)+'</h3><p>Bu modulning UI qismi keyingi integratsiya bosqichida ulanadi. Foundation shell ishlayapti.</p>';
      ws.appendChild(fallback);
    }
    $('workspaceClose')?.addEventListener('click', openHome, {once:true});
  }

  function openHome() {
    hideDashboardChildren();
    const d = $('dashboardView');
    if (!d) return;
    const container = d.querySelector('.container');
    if (!container) return;
    let home = $('phase1Home');
    if (!home) { home=document.createElement('section'); home.id='phase1Home'; home.className='final-home'; container.prepend(home); }
    const user=normalize(), key=roleKey(user), mods=ROLE_MODULES[key] || ROLE_MODULES.student;
    const label = user?.role_label || key;
    home.innerHTML =
      '<div class="final-welcome"><div><div class="final-kicker">MEDGEN AI • GLOBAL BIOMEDICAL AI PLATFORM</div>'+
      '<h1>'+esc(ICONS[key]||'🧬')+' '+esc(label)+'</h1><p>Shaxsiy ilmiy ish maydoningiz.</p></div>'+
      '<span class="final-role">ROLE: '+esc(key)+'</span></div>'+
      '<div class="final-section-title">ILMIY ISH MAYDONLARI</div><div class="final-grid">'+
      mods.map(m=>'<button type="button" class="final-module phase1-module" data-phase1-module="'+esc(m)+'"><span>'+ICONS[m]+'</span><b>'+esc(LABELS[m])+'</b><small>Ochish →</small></button>').join('')+
      '</div><div class="final-section-title">PLATFORMA</div><div class="final-grid secondary">'+
      '<button type="button" class="final-service" data-phase1-service="support">🆘<b>Yordam markazi</b><small>Hisob va platforma yordami</small></button>'+
      '<button type="button" class="final-service" data-phase1-service="assistant">🤖<b>MedGen AI yordamchi</b><small>Ilmiy savol-javob</small></button>'+
      '<button type="button" class="final-service" data-phase1-service="community">💬<b>Hamjamiyat</b><small>Tadqiqotchilar bilan aloqa</small></button>'+
      '<button type="button" class="final-service" data-phase1-service="security">🔐<b>Xavfsizlik</b><small>Hisob va maxfiylik</small></button></div>';
    home.classList.remove('hidden');
    home.querySelectorAll('[data-phase1-module]').forEach(b=>b.onclick=()=>openWorkspace(b.dataset.phase1Module));
    home.querySelectorAll('[data-phase1-service]').forEach(b=>b.onclick=()=>openService(b.dataset.phase1Service));
  }

  function openService(kind) {
    if (kind === 'security') { $('securityCenter')?.classList.remove('hidden'); hideDashboardChildren(); $('securityCenter')?.classList.remove('hidden'); return; }
    if (typeof window.openFunctionalService === 'function' && ['support','assistant','community'].includes(kind)) {
      window.openFunctionalService(kind);
      return;
    }
    openHome();
  }

  function openProfile() {
    const modal=$('profileModal');
    if (!modal) return;
    modal.classList.remove('hidden');
    modal.style.display='flex';
    const u=normalize()||{};
    [['profileUsername',u.username],['profileEmail',u.email],['profileFullName',u.full_name||u.name],
     ['profileOrganization',u.organization],['profileCountry',u.country]].forEach(([id,v])=>{if($(id)&&v!=null)$(id).value=v;});
  }

  async function login(username,password,status) {
    const res=await fetch(API+'/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username,password})});
    const data=await res.json().catch(()=>({}));
    if(!res.ok) throw new Error(data.detail||data.message||('HTTP '+res.status));
    const t=data.access_token||data.token;
    if(!t) throw new Error('Server access token qaytarmadi.');
    sessionStorage.setItem(TOKEN_KEY,t);
    let user=data.user||{username,role:'student'};
    try {
      const me=await fetch(API+'/auth/me',{headers:{Authorization:'Bearer '+t}});
      if(me.ok) user=await me.json();
    } catch (_) {}
    window.__MEDGEN_USER=user;
    try { window.state.user=user; window.state.token=t; } catch (_) {}
    cleanBoundaries();
    document.body.classList.add('medgen-authenticated');
    openHome();
    if(status) status.textContent='Tizimga muvaffaqiyatli kirildi.';
  }

  function bind() {
    // Remove listeners installed by the old shells by replacing the key controls.
    ['loginForm','medgenMenuBtn','profileBtn','logoutBtn','workspaceClose'].forEach(id=>{
      const el=$(id); if(!el) return;
      const copy=el.cloneNode(true); el.replaceWith(copy);
    });

    const form=$('loginForm');
    form?.addEventListener('submit',async e=>{
      e.preventDefault(); e.stopImmediatePropagation();
      const status=$('loginStatus'), username=($('loginUser')?.value||'').trim(), password=$('loginPassword')?.value||'';
      if(!username||!password){if(status)status.textContent='Foydalanuvchi nomi va parolni kiriting.';return;}
      try{if(status)status.textContent='Tizimga kirilmoqda...';await login(username,password,status);}
      catch(err){if(status)status.textContent='Kirishda xatolik: '+err.message;}
    },true);

    $('medgenMenuBtn')?.addEventListener('click',e=>{
      e.preventDefault(); e.stopImmediatePropagation();
      renderMenu();
      $('phase1Drawer')?.classList.add('open');
    },true);

    $('profileBtn')?.addEventListener('click',e=>{
      e.preventDefault(); e.stopImmediatePropagation(); openProfile();
    },true);

    $('logoutBtn')?.addEventListener('click',e=>{
      e.preventDefault(); sessionStorage.removeItem(TOKEN_KEY); window.__MEDGEN_USER=null; try{window.state.user=null;window.state.token='';}catch(_){ } showLogin();
    },true);

    $('profileClose')?.addEventListener('click',()=>{$('profileModal')?.classList.add('hidden');});
    $('workspaceClose')?.addEventListener('click',openHome);

    const t=token();
    if(!t){showLogin();return;}
    const u=normalize();
    if(u){cleanBoundaries();openHome();return;}
    fetch(API+'/auth/me',{headers:{Authorization:'Bearer '+t}})
      .then(r=>r.ok?r.json():Promise.reject(new Error('Session expired')))
      .then(u=>{window.__MEDGEN_USER=u;cleanBoundaries();openHome();})
      .catch(()=>{sessionStorage.removeItem(TOKEN_KEY);showLogin();});
  }

  function renderMenu() {
    let drawer=$('phase1Drawer');
    if(!drawer){drawer=document.createElement('aside');drawer.id='phase1Drawer';drawer.className='final-drawer';document.body.appendChild(drawer);}
    const user=normalize(),key=roleKey(user),mods=ROLE_MODULES[key]||ROLE_MODULES.student;
    drawer.innerHTML='<div class="final-drawer-head"><b>☰ MENYU</b><button type="button" id="phase1DrawerClose">×</button></div>'+
      '<div class="final-menu-role">👤 '+esc(user?.role_label||key)+'</div>'+
      '<button type="button" class="final-nav" data-phase1-home>🏠 Bosh sahifa</button>'+
      '<button type="button" class="final-nav" data-phase1-profile>👤 Profilim</button>'+
      '<div class="final-nav-title">ILMIY MODULLAR</div>'+
      mods.map(m=>'<button type="button" class="final-nav" data-phase1-module="'+esc(m)+'">'+ICONS[m]+' '+esc(LABELS[m])+'</button>').join('')+
      '<div class="final-nav-title">PLATFORMA</div><button type="button" class="final-nav" data-phase1-service="support">🆘 Yordam</button>'+
      '<button type="button" class="final-nav" data-phase1-service="assistant">🤖 AI yordamchi</button>'+
      '<button type="button" class="final-nav" data-phase1-service="community">💬 Hamjamiyat</button>'+
      '<button type="button" class="final-nav" data-phase1-service="security">🔐 Xavfsizlik</button>';
    $('phase1DrawerClose').onclick=()=>$('phase1Drawer').classList.remove('open');
    drawer.querySelector('[data-phase1-home]').onclick=()=>{drawer.classList.remove('open');openHome();};
    drawer.querySelector('[data-phase1-profile]').onclick=()=>{drawer.classList.remove('open');openProfile();};
    drawer.querySelectorAll('[data-phase1-module]').forEach(b=>b.onclick=()=>{drawer.classList.remove('open');openWorkspace(b.dataset.phase1Module);});
    drawer.querySelectorAll('[data-phase1-service]').forEach(b=>b.onclick=()=>{drawer.classList.remove('open');openService(b.dataset.phase1Service);});
  }

  window.medgenPhase1Controller={openHome,openWorkspace,renderMenu,openProfile,login};
  window.addEventListener('load',bind,{once:true});
})();