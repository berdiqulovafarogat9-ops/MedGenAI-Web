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
 const host=$('medicalAcademyTool'); if(!host)return null;
 if($('academyV2Root'))return $('academyV2Root');
 host.innerHTML='<div id="academyV2Root" class="academy-v2"><div class="eyebrow">PHASE 1 • MEDICAL ACADEMY</div><h3>🎓 Medical Academy</h3><p class="muted">Course → Subject → Theory → Practice → Quiz → Case → Skills → OSCE → Exam → Progress</p><div id="academySummary"></div><div id="academySubjects"></div><div id="academyPanel" class="hidden"></div></div>';
 const s=document.createElement('style');s.textContent='.academy-v2{display:grid;gap:14px}.academy-v2 .academy-stat{padding:15px;border:1px solid rgba(255,255,255,.1);border-radius:14px;background:rgba(255,255,255,.035)}.academy-v2 .academy-subjects{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.academy-v2 .academy-subject{padding:15px;text-align:left;border:1px solid rgba(255,255,255,.1);border-radius:14px;background:rgba(255,255,255,.035);color:inherit;cursor:pointer}.academy-v2 .academy-subject small{display:block;opacity:.6;margin-top:6px}.academy-v2 .academy-panel{padding:16px;border:1px solid rgba(255,255,255,.12);border-radius:15px}.academy-v2 .academy-actions{display:flex;flex-wrap:wrap;gap:8px;margin:12px 0}.academy-v2 button{border:1px solid rgba(255,255,255,.13);border-radius:9px;background:rgba(255,255,255,.06);color:inherit;padding:9px 12px;cursor:pointer}.academy-v2 button.primary{background:rgba(80,150,255,.18)}.academy-v2 .q{padding:13px;margin:10px 0;border:1px solid rgba(255,255,255,.1);border-radius:12px}.academy-v2 label{display:block;padding:7px;cursor:pointer}.academy-v2 .pass{opacity:.95}.academy-v2 .weak{opacity:.7}@media(max-width:650px){.academy-v2 .academy-subjects{grid-template-columns:1fr}}';document.head.appendChild(s);return host;
}
let dashboard=null;
async function render(){
 const root=ensureShell();if(!root)return;
 try{
  dashboard=await api('/academy/dashboard');
  const profile=dashboard.academic_profile||{};
  $('academySummary').innerHTML='<div class="academy-stat"><b>'+esc(dashboard.course_title)+'</b><br>Progress: <strong>'+esc(dashboard.overall_progress)+'%</strong><br><small>'+esc(profile.university||'University not set')+' • '+esc(profile.major||'Major not set')+' • '+esc(profile.group||'Group not set')+'</small></div>';
  const host=$('academySubjects');
  host.className='academy-subjects';
  host.innerHTML=dashboard.subjects.map(s=>'<button class="academy-subject" data-sub="'+esc(s.id)+'"><b>'+esc(s.name)+'</b><small>'+esc(s.completed_assessments.length)+' / 5 assessments passed'</small><small>'+esc(s.objective)+'</small></button>').join('');
  host.querySelectorAll('[data-sub]').forEach(b=>b.onclick=()=>openSubject(b.dataset.sub));
 }catch(e){$('academySummary').innerHTML='<div class="academy-stat">Academy yuklanmadi: '+esc(e.message)+'</div>'}
}
async function openSubject(id){
 const p=$('academyPanel');if(!p)return;p.classList.remove('hidden');p.className='academy-panel';
 const course=dashboard.course;
 try{
  const d=await api('/academy/subject/'+course+'/'+encodeURIComponent(id));
  const s=d.subject, m=d.modules;
  p.innerHTML='<button id="academyBack">← Fanlar</button><h4>📘 '+esc(s.name)+'</h4><p class="muted">'+esc(s.objective)+'</p><div class="academy-actions">'+['theory','practice','quiz','case','exam'].map(x=>'<button class="academy-act" data-type="'+x+'">'+x.toUpperCase()+'</button>').join('')+'</div><div id="academyLessonList"></div><div id="academyAssessment"></div>';
  $('academyBack').onclick=()=>{p.classList.add('hidden');window.scrollTo({top:0,behavior:'smooth'})};
  const lessons=[...(m.theory||[]),...(m.practice||[])];
  $('academyLessonList').innerHTML='<h5>O‘quv materiallari</h5>'+lessons.map(x=>'<div class="academy-stat"><b>'+esc(x.title||x.task||x.objective||x.id)+'</b><p>'+esc(x.task||x.objective||'Mavzuni o‘rganing va tegishli baholashni bajaring.')+'</p></div>').join('');
  p.querySelectorAll('.academy-act').forEach(b=>b.onclick=()=>startAssessment(course,id,b.dataset.type));
 }catch(e){p.innerHTML='<div>Fan yuklanmadi: '+esc(e.message)+'</div>'}
}
async function startAssessment(course,id,type){
 const box=$('academyAssessment');if(!box)return;
 try{
  if(!['theory','practice','quiz','case','exam'].includes(type)){box.innerHTML='<p>Bu baholash turi hozircha mavjud emas.</p>';return}
  const d=await api('/academy/assessment/start',{method:'POST',body:JSON.stringify({course,subject_id:id,assessment_type:type})});
  const items=d.items||[];
  box.innerHTML='<h5>'+esc(type.toUpperCase())+'</h5><form id="academyForm"></form>';
  const form=$('academyForm');
  if(type==='theory'||type==='practice'){
   form.innerHTML='<p>'+esc(items[0]?.instruction||'O‘quv faoliyatini bajaring.')+'</p><label><input type="checkbox" name="completion" value="1" required> Men bu faoliyatni bajardim va natijani tekshirdim.</label>';
  }else{
   form.innerHTML=items.map((q,i)=>'<div class="q"><b>'+esc((i+1)+'. '+(q.question||q.prompt||''))+'</b>'+(q.scenario?'<p>'+esc(q.scenario)+'</p>':'')+(q.options||[]).map((o,j)=>'<label><input required type="radio" name="'+esc(q.id)+'" value="'+j+'"> '+esc(o)+'</label>').join('')+'</div>').join('');
  }
  const btn=document.createElement('button');btn.type='submit';btn.className='primary';btn.textContent='Natijani saqlash';form.appendChild(btn);
  form.onsubmit=async e=>{
   e.preventDefault();const answers={};
   if(type==='theory'||type==='practice') answers.completion=form.querySelector('[name=completion]')?.checked?1:0;
   else form.querySelectorAll('input:checked').forEach(x=>answers[x.name]=Number(x.value));
   try{
    const r=await api('/academy/assessment/submit',{method:'POST',body:JSON.stringify({course,subject_id:id,assessment_type:type,answers})});
    box.insertAdjacentHTML('afterbegin','<div class="academy-stat">Natija: <strong>'+esc(r.score)+'%</strong> — '+(r.passed?'O‘TDI':'QAYTA URINING')+'</div>');
    await render();
   }catch(e){alert(e.message)}
  };
 }catch(e){box.innerHTML='<div>Baholash xatosi: '+esc(e.message)+'</div>'}
}
function observe(){
 const target=$('medicalAcademyTool');if(!target)return;
 const obs=new MutationObserver(()=>{if(!target.classList.contains('hidden'))render()});obs.observe(target,{attributes:true,attributeFilter:['class']});
}
window.medgenAcademyV2={render,openSubject};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',observe,{once:true});else observe();
})();