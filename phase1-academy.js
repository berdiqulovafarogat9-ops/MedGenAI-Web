(function(){
'use strict';
const A=window.MEDGEN_API_BASE||'/api/v1';
const K='medgen_access_token';
const $=id=>document.getElementById(id);
const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
async function api(path,opt={}){
 const h={...(opt.headers||{}),Authorization:'Bearer '+(sessionStorage.getItem(K)||''),'Content-Type':'application/json'};
 const r=await fetch(A+path,{...opt,headers:h}); const d=await r.json().catch(()=>({}));
 if(!r.ok) throw Error(d.detail||d.message||('HTTP '+r.status)); return d;
}
function ensureShell(){
 const host=$('medicalAcademyTool')||$('studentTool'); if(!host)return null;
 if($('academyV2Root'))return $('academyV2Root');
 const root=document.createElement('div');root.id='academyV2Root';root.className='academy-v2';
 root.innerHTML='<div class="eyebrow">PHASE 1 • MEDICAL ACADEMY</div><h3>🎓 Medical Academy</h3><p class="muted">Course → Subject → Theory → Practice → Quiz → Case → Skills → OSCE → Exam → Progress</p><div id="academySummary"></div><div id="academySubjects"></div><div id="academyPanel" class="hidden"></div>';
 host.appendChild(root);
 const s=document.createElement('style');s.textContent='.academy-v2{display:grid;gap:14px}.academy-v2 .academy-stat{padding:15px;border:1px solid rgba(255,255,255,.1);border-radius:14px;background:rgba(255,255,255,.035)}.academy-v2 .academy-subjects{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.academy-v2 .academy-subject{padding:15px;text-align:left;border:1px solid rgba(255,255,255,.1);border-radius:14px;background:rgba(255,255,255,.035);color:inherit;cursor:pointer}.academy-v2 .academy-subject small{display:block;opacity:.6;margin-top:6px}.academy-v2 .academy-course{min-width:180px;text-align:left}.academy-v2 .academy-panel{padding:16px;border:1px solid rgba(255,255,255,.12);border-radius:15px}.academy-v2 .academy-actions{display:flex;flex-wrap:wrap;gap:8px;margin:12px 0}.academy-v2 button{border:1px solid rgba(255,255,255,.13);border-radius:9px;background:rgba(255,255,255,.06);color:inherit;padding:9px 12px;cursor:pointer}.academy-v2 button.primary{background:rgba(80,150,255,.18)}.academy-v2 .q{padding:13px;margin:10px 0;border:1px solid rgba(255,255,255,.1);border-radius:12px}.academy-v2 label{display:block;padding:7px;cursor:pointer}.academy-v2 .pass{opacity:.95}.academy-v2 .weak{opacity:.7}.academy-v2 .academy-progress{font-size:11px}.academy-v2 .academy-progress.is-complete{color:#5ed6a0}.academy-v2 .academy-muted{opacity:.72;font-size:12px;line-height:1.5}.academy-v2 .academy-lesson p,.academy-v2 .academy-assessment-item p{line-height:1.6}.academy-v2 .academy-assessment-item{padding:14px;margin:10px 0;border:1px solid rgba(255,255,255,.12);border-radius:12px;background:rgba(255,255,255,.025)}.academy-v2 .academy-assessment-item h6{margin:0 0 8px}.academy-v2 .academy-confirm{margin-top:10px;padding:9px;border-radius:8px;background:rgba(80,150,255,.08)}.academy-v2 .academy-puzzle-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.academy-v2 .academy-puzzle-grid label{display:grid;gap:6px}.academy-v2 .academy-puzzle-grid select{width:100%;min-width:0;padding:9px;border:1px solid rgba(255,255,255,.18);border-radius:8px;background:#142536;color:inherit}.academy-v2 .academy-checklist label,.academy-v2 .academy-options label{display:flex;gap:9px;align-items:flex-start}.academy-v2 .academy-checklist input,.academy-v2 .academy-options input,.academy-v2 .academy-confirm input{margin-top:4px;flex:0 0 auto}.academy-v2 .academy-result{border-color:rgba(70,190,130,.4)}.academy-v2 .academy-error{border-color:rgba(220,90,90,.45);color:#ffb2b2}.academy-v2 button:disabled{opacity:.55;cursor:not-allowed}@media(max-width:650px){.academy-v2 .academy-subjects{grid-template-columns:1fr}}';document.head.appendChild(s);return root;
}
let dashboard=null,selectedCourse=null;
function renderSubjects(){
 const host=$('academySubjects');if(!host||!dashboard)return;
 const course=(dashboard.courses||[]).find(x=>Number(x.year)===Number(selectedCourse));
 const subjects=Number(selectedCourse)===Number(dashboard.course)?(dashboard.subjects||[]):(course?.subjects||[]);
 const assessmentLabels={theory:'Nazariya',practice:'Amaliyot',quiz:'Test',case:'Klinik keys',skills:'Ko‘nikma',osce:'OSCE',theory_exam:'Nazariy imtihon',practical_exam:'Amaliy imtihon',exam:'Yakuniy imtihon'};
 host.innerHTML='<section class="academy-stat"><b>Bosqich 1: Kurs tanlash</b><div class="academy-actions">'+(dashboard.courses||[{year:dashboard.course,title:dashboard.course_title}]).map(c=>'<button type="button" class="academy-course '+(Number(c.year)===Number(selectedCourse)?'primary':'')+'" data-course="'+Number(c.year)+'">'+esc(c.title)+'</button>').join('')+'</div></section><section><h4>Bosqich 2: Fan tanlash</h4><div class="academy-subjects">'+subjects.map(s=>{
  const completed=(s.completed_assessments||[]).map(x=>assessmentLabels[x]||x).join(' · ');
  return '<button class="academy-subject" data-sub="'+esc(s.id)+'"><b>'+esc(s.name)+'</b><small>'+esc(s.objective||'Fanni ochish')+'</small><small class="academy-progress '+(s.complete?'is-complete':'')+'">'+(s.complete?'✓ Fan yakunlangan':(completed?'Bajarilgan: '+completed:'Hali baholash bajarilmagan'))+'</small></button>';
 }).join('')+'</div></section>';
 host.querySelectorAll('[data-course]').forEach(btn=>btn.onclick=()=>{selectedCourse=Number(btn.dataset.course);renderSubjects();$('academyPanel')?.classList.add('hidden')});
 host.querySelectorAll('[data-sub]').forEach(btn=>btn.onclick=()=>openSubject(btn.dataset.sub));
}
async function render(){
 const root=ensureShell();if(!root)return;
 try{
  dashboard=await api('/academy/dashboard');
  const profile=dashboard.academic_profile||{};
  if(selectedCourse===null || !(dashboard.courses||[]).some(c=>Number(c.year)===Number(selectedCourse))) selectedCourse=Number(dashboard.course);
  $('academySummary').innerHTML='<div class="academy-stat"><b>Yagona o‘quv yo‘li</b><br><small>'+esc(profile.university||'Universitet tanlanmagan')+' • '+esc(profile.major||'Yo‘nalish tanlanmagan')+' • '+esc(profile.group||'Guruh tanlanmagan')+'</small></div>';
  renderSubjects();
 }catch(e){$('academySummary').innerHTML='<div class="academy-stat">Academy yuklanmadi: '+esc(e.message)+'</div>'}
}
async function openSubject(id){
 const p=$('academyPanel');if(!p)return;p.classList.remove('hidden');p.className='academy-panel';
 const course=Number(selectedCourse||dashboard.course);
 try{
  const d=await api('/academy/subject/'+course+'/'+encodeURIComponent(id));
  const subject=d.subject||{},modules=d.modules||{};
  const assessmentTypes=[
   ['theory','Nazariya'],['practice','Amaliy mashg‘ulot'],['puzzle','Anatomik puzzle'],['quiz','Test'],['case','Klinik keys'],
   ['skills','Amaliy ko‘nikmalar'],['osce','OSCE stansiyasi'],['theory_exam','Nazariy imtihon'],
   ['practical_exam','Amaliy imtihon'],['exam','Yakuniy imtihon']
  ];
  p.innerHTML='<button id="academyBack" type="button">← Fanlar</button><h4>📘 '+esc(subject.name)+'</h4><p class="muted">'+esc(subject.objective)+'</p><h5>Bosqich 3: Fanning ichki ishchi maydoni</h5><p class="academy-muted">Nazariya va amaliy mashg‘ulotlar alohida o‘rganiladi. Test, klinik keys, ko‘nikma, OSCE hamda nazariy/amaliy imtihonlar alohida baholanadi.</p><div class="academy-actions">'+assessmentTypes.map(x=>'<button class="academy-act" type="button" data-type="'+x[0]+'">'+x[1]+'</button>').join('')+'</div><div id="academyLessonList"></div><div id="academyAssessment" aria-live="polite"></div>';
  $('academyBack').onclick=()=>{p.classList.add('hidden');window.scrollTo({top:0,behavior:'smooth'})};
  const lessons=[...(modules.theory||[]),...(modules.practice||[])];
  $('academyLessonList').innerHTML='<h5>O‘quv materiallari</h5>'+lessons.map(x=>{
   const body=x.content||x.task||x.objective||'Mavzuni tegishli nazariya va amaliy baholash orqali o‘rganing.';
   return '<article class="academy-stat academy-lesson"><b>'+esc(x.title||x.task||x.objective||x.id)+'</b>'+(x.prompt?'<p><strong>'+esc(x.prompt)+'</strong></p>':'')+'<p>'+esc(body)+'</p>'+(x.instruction?'<small>'+esc(x.instruction)+'</small>':'')+'</article>';
  }).join('');
  if(id==='BIO-SAMPI-1' && window.medgenBio?.mount) window.medgenBio.mount(p);
  if(id==='Anatomy'){
   const open3d=document.createElement('button');open3d.type='button';open3d.className='primary';open3d.textContent='3D Anatomiya modelini ochish';
   open3d.onclick=()=>{if(window.MedGenAnatomy?.open)window.MedGenAnatomy.open('/models/full_skeleton.glb','3D Anatomiya');else alert('3D anatomiya moduli yuklanmadi.');};
   $('academyLessonList').prepend(open3d);
  }
  p.querySelectorAll('.academy-act').forEach(b=>b.onclick=()=>startAssessment(course,id,b.dataset.type));
 }catch(e){p.innerHTML='<div>Fan yuklanmadi: '+esc(e.message)+'</div>'}
}
async function startAssessment(course,id,type){
 const box=$('academyAssessment');if(!box)return;
 const labels={theory:'Nazariya',practice:'Amaliy mashg‘ulot',puzzle:'Anatomik puzzle',quiz:'Test',case:'Klinik keys',skills:'Amaliy ko‘nikmalar',osce:'OSCE stansiyasi',theory_exam:'Nazariy imtihon',practical_exam:'Amaliy imtihon',exam:'Yakuniy imtihon'};
 const allowed=Object.keys(labels);
 if(!allowed.includes(type)){box.innerHTML='<p>Bu baholash turi hozircha mavjud emas.</p>';return}
 box.innerHTML='<div class="academy-stat">Baholash yuklanmoqda…</div>';
 try{
  const d=await api('/academy/assessment/start',{method:'POST',body:JSON.stringify({course,subject_id:id,assessment_type:type})});
  const items=d.items||[];
  box.innerHTML='<h5>'+esc(labels[type])+'</h5>'+(d.time_limit_minutes?'<p class="academy-muted">Ajratilgan vaqt: '+Number(d.time_limit_minutes)+' daqiqa</p>':'')+'<form id="academyForm" class="academy-assessment-form"></form>';
  const form=$('academyForm');
  if(type==='puzzle'){
   const puzzle=items[0]||{},parts=puzzle.parts||[],slots=puzzle.slots||[];
   if(!parts.length||!slots.length){
    form.innerHTML='<p class="academy-muted">'+esc(puzzle.instruction||'Bu fan uchun interaktiv puzzle hali mavjud emas.')+'</p>';
   }else{
    form.innerHTML='<article class="academy-assessment-item"><h6>'+esc(puzzle.title||'Anatomik puzzle')+'</h6><p>'+esc(puzzle.instruction||'Har bir tuzilmani mos joy bilan bog‘lang.')+'</p><div class="academy-puzzle-grid">'+parts.map(part=>'<label><strong>'+esc(part.label)+'</strong><select name="'+esc(part.id)+'" required><option value="">Joyni tanlang</option>'+slots.map(slot=>'<option value="'+Number(slot.value)+'">'+esc(slot.label)+'</option>').join('')+'</select></label>').join('')+'</div></article>';
   }
  }else if(type==='theory'){
   form.innerHTML=items.map((item,i)=>'<article class="academy-assessment-item"><h6>'+esc(item.title||('Nazariya '+(i+1)))+'</h6>'+(item.prompt?'<p><strong>'+esc(item.prompt)+'</strong></p>':'')+'<p>'+esc(item.content||item.instruction||'')+'</p>'+(item.instruction&&item.content?'<small>'+esc(item.instruction)+'</small>':'')+'<label class="academy-confirm"><input type="checkbox" data-completion-check required> Ushbu bo‘limni o‘qidim va asosiy tushunchalarni tushundim.</label></article>').join('');
  }else if(type==='practice'){
   form.innerHTML=items.map((item,i)=>'<article class="academy-assessment-item"><h6>'+esc(item.title||('Amaliy topshiriq '+(i+1)))+'</h6>'+(item.prompt?'<p><strong>'+esc(item.prompt)+'</strong></p>':'')+'<p>'+esc(item.instruction||item.task||'Amaliy topshiriqni bajaring va natijani tekshiring.')+'</p><label class="academy-confirm"><input type="checkbox" data-completion-check required> Amaliy faoliyatni bajardim va natijani qayta tekshirdim.</label></article>').join('');
  }else if(type==='skills'||type==='osce'||type==='practical_exam'){
   form.innerHTML=items.map((item,i)=>'<article class="academy-assessment-item"><h6>'+esc((i+1)+'. '+(item.question||item.station||item.title||'Ko‘nikma stansiyasi'))+'</h6>'+(item.prompt?'<p>'+esc(item.prompt)+'</p>':'')+'<div class="academy-checklist">'+(item.checklist||[]).map((step,j)=>'<label><input type="checkbox" name="'+esc(item.id)+':'+j+'" value="1"> '+esc(step)+'</label>').join('')+'</div></article>').join('');
  }else{
   form.innerHTML=items.map((q,i)=>'<article class="academy-assessment-item"><b>'+esc((i+1)+'. '+(q.question||q.prompt||q.station||''))+'</b>'+(q.scenario?'<p>'+esc(q.scenario)+'</p>':'')+(q.prompt&&q.question?'<p>'+esc(q.prompt)+'</p>':'')+'<div class="academy-options">'+(q.options||[]).map((o,j)=>'<label><input required type="radio" name="'+esc(q.id)+'" value="'+j+'"> '+esc(o)+'</label>').join('')+'</div></article>').join('');
  }
  if(!items.length)form.insertAdjacentHTML('afterbegin','<p>Ushbu baholash uchun hozircha material mavjud emas.</p>');
  const btn=document.createElement('button');btn.type='submit';btn.className='primary';btn.textContent='Natijani saqlash';form.appendChild(btn);
  form.onsubmit=async e=>{
   e.preventDefault();const answers={};
   if(type==='theory'||type==='practice'){
    const checks=[...form.querySelectorAll('[data-completion-check]')];
    answers.completion=checks.length&&checks.every(x=>x.checked)?1:0;
   }else if(type==='puzzle'){
    form.querySelectorAll('select[name]').forEach(x=>{if(x.value!=='')answers[x.name]=Number(x.value)});
   }else form.querySelectorAll('input:checked').forEach(x=>answers[x.name]=Number(x.value));
   btn.disabled=true;btn.textContent='Saqlanmoqda…';
   try{
    const result=await api('/academy/assessment/submit',{method:'POST',body:JSON.stringify({course,subject_id:id,assessment_type:type,answers})});
    const score=Number(result.score)||0;
    box.insertAdjacentHTML('afterbegin','<div class="academy-stat academy-result"><strong>Natija: '+esc(score)+'%</strong> — '+(result.passed?'O‘TDI':'QAYTA URINING')+'<p>To‘g‘ri bajarilgan: '+esc(result.total??'—')+'</p><small>O‘tish chegarasi: 70%. Har bir urinish tarixda saqlanadi.</small></div>');
    btn.textContent='Saqlangan';await render();
   }catch(err){btn.disabled=false;btn.textContent='Qayta yuborish';box.insertAdjacentHTML('afterbegin','<div class="academy-stat academy-error">'+esc(err.message)+'</div>')}
  };
 }catch(e){box.innerHTML='<div class="academy-stat academy-error">Baholash xatosi: '+esc(e.message)+'</div>'}
}
function observe(){
 const target=$('medicalAcademyTool')||$('studentTool');if(!target)return;
 const obs=new MutationObserver(()=>{if(!target.classList.contains('hidden'))render()});obs.observe(target,{attributes:true,attributeFilter:['class']});
}
window.medgenAcademyV2={render,openSubject};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',observe,{once:true});else observe();
})();