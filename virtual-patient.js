/* MedGen AI — C-stage virtual patient simulator.
   Educational simulation only; not a clinical decision-support system. */
(() => {
  'use strict';
  const CASES = [
    {id:'anaphylaxis', name:'Anafilaktik shok', start:{hr:135,sys:70,dia:40,spo2:88,rr:30}, ecg:'shock',
      clues:['Yangi dori/ovqatdan keyin boshlangan','Eshakemi va yuz/lab shishi','Hansirash, arterial gipotenziya'],
      diagnosis:['Anafilaktik shok','Miokard infarkti','Pnevmoniya'], correct:0,
      actions:[
        {id:'call',label:'Yordam / reanimatsiya guruhini chaqirish',kind:'good',effect:{hr:-2,sys:3,spo2:0,rr:-1},points:10},
        {id:'epi',label:'Adrenalin IM (kattalar algoritmi bo‘yicha) va qayta baholash',kind:'critical',effect:{hr:-18,sys:28,spo2:3,rr:-6},points:30},
        {id:'oxygen',label:'Kislorod berish va nafas yo‘lini baholash',kind:'good',effect:{hr:-4,sys:2,spo2:8,rr:-3},points:20},
        {id:'fluid',label:'IV kirish va izotonik kristalloidni ko‘rib chiqish',kind:'good',effect:{hr:-9,sys:18,spo2:0,rr:-2},points:20},
        {id:'antihistamine',label:'Faqat antigistamin berib, adrenalinni kechiktirish',kind:'bad',effect:{hr:12,sys:-12,spo2:-4,rr:4},points:-15}
      ]},
    {id:'mi',name:'Miokard infarkti (ST elevatsiyasi)',start:{hr:110,sys:90,dia:60,spo2:93,rr:24},ecg:'stemi',
      clues:['Ko‘krak ortida bosuvchi og‘riq','Sovuq ter va ko‘ngil aynishi','EKGda ST segment elevatsiyasi'],
      diagnosis:['Anafilaktik shok','ST elevatsiyali miokard infarkti','Og‘ir pnevmoniya'],correct:1,
      actions:[
        {id:'call',label:'Shoshilinch yordam / reperfuziya yo‘lini faollashtirish',kind:'critical',effect:{hr:-4,sys:2,spo2:0,rr:-1},points:30},
        {id:'ecg',label:'12-kanalli EKG va uzluksiz monitoring',kind:'good',effect:{hr:0,sys:0,spo2:0,rr:0},points:15},
        {id:'oxygen',label:'SpO₂ va nafas holatiga qarab kislorodni ko‘rib chiqish',kind:'good',effect:{hr:-2,sys:0,spo2:4,rr:-2},points:15},
        {id:'aspirin',label:'Qarshi ko‘rsatmalarni tekshirib, mahalliy ACS protokoli bo‘yicha antiagregant',kind:'good',effect:{hr:-7,sys:3,spo2:0,rr:-2},points:20},
        {id:'delay',label:'Yordam chaqirmasdan uzoq kuzatish',kind:'bad',effect:{hr:12,sys:-15,spo2:-3,rr:4},points:-15}
      ]},
    {id:'pneumonia',name:'Og‘ir pnevmoniya / gipoksiya',start:{hr:105,sys:100,dia:65,spo2:84,rr:28},ecg:'tachy',
      clues:['Isitma va yo‘tal','Nafas qisishi, yordamchi mushaklar ishtiroki','SpO₂ past, nafas soni yuqori'],
      diagnosis:['Anafilaktik shok','ST elevatsiyali miokard infarkti','Og‘ir pnevmoniya va gipoksiya'],correct:2,
      actions:[
        {id:'call',label:'Shoshilinch klinik yordamni chaqirish',kind:'critical',effect:{hr:-3,sys:2,spo2:0,rr:-1},points:20},
        {id:'oxygen',label:'Kislorod berish va SpO₂/nafasni qayta baholash',kind:'critical',effect:{hr:-8,sys:1,spo2:12,rr:-6},points:30},
        {id:'airway',label:'Nafas yo‘li, nafas ishi va hushni baholash',kind:'good',effect:{hr:-2,sys:0,spo2:1,rr:-2},points:15},
        {id:'sepsis',label:'Sepsis belgilarini tekshirish va mahalliy protokolga muvofiq yordam',kind:'good',effect:{hr:-7,sys:8,spo2:0,rr:-3},points:20},
        {id:'delay',label:'Gipoksiyani e’tiborsiz qoldirish',kind:'bad',effect:{hr:10,sys:-8,spo2:-8,rr:5},points:-15}
      ]}
  ];
  const $ = (s,r=document)=>r.querySelector(s);
  const esc = s => String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  let state=null, ticker=null, raf=null, lastFrame=0, phase=0, finished=true, blurPenaltyApplied=false;
  function inject(){
    if(!$('#virtualPatientLaunch')){
      const head=$('#roleDashboard .role-dashboard-head');
      if(head){ const b=document.createElement('button'); b.id='virtualPatientLaunch';b.type='button';b.className='primary small';b.textContent='🫀 Virtual bemor / Jonli monitor';head.appendChild(b); }
      else {
        const c=$('.container'); if(c){const b=document.createElement('button');b.id='virtualPatientLaunch';b.className='primary small';b.type='button';b.textContent='🫀 Virtual bemor / Jonli monitor';c.prepend(b);}
      }
    }
    if(!$('#virtualPatientPanel')){
      const panel=document.createElement('section');panel.id='virtualPatientPanel';panel.className='vp-panel hidden';
      panel.innerHTML=`
        <div class="vp-head"><div><p class="eyebrow">C BOSQICH · KLINIK SIMULYATOR</p><h2>Virtual bemor va jonli Vital Monitor</h2><p class="muted">3 daqiqalik o‘quv simulyatsiyasi · barcha qiymatlar simulyatsiya qilingan.</p></div><button id="vpClose" class="ghost" type="button">Yopish</button></div>
        <div class="vp-controls"><label>Keys <select id="vpCase"><option value="anaphylaxis">1 · Anafilaktik shok</option><option value="mi">2 · Miokard infarkti</option><option value="pneumonia">3 · Og‘ir pnevmoniya / gipoksiya</option></select></label><button id="vpStart" class="primary small" type="button">Imtihonni boshlash</button><div id="vpTimer" class="vp-timer">03:00</div><div id="vpStatus" role="status">Keysni tanlab, boshlang.</div></div>
        <div id="vpExam" class="hidden">
          <div class="vp-monitor"><div class="vp-monitor-head"><b>ECG · LEAD II <small>SIMULATSIYA</small></b><span id="vpRhythm">MONITOR STANDBY</span></div><canvas id="vpEcg" height="150" aria-label="Dinamik simulyatsion EKG chizig‘i"></canvas>
          <div class="vp-vitals"><div><small>HR / PULS</small><strong id="vpHr">—</strong><span>bpm</span></div><div><small>BP / QON BOSIMI</small><strong id="vpBp">—</strong><span>mmHg</span></div><div><small>SpO₂</small><strong id="vpSpo2">—</strong><span>%</span></div><div><small>RR / NAFAS</small><strong id="vpRr">—</strong><span>/daq</span></div></div></div>
          <div class="vp-columns"><section class="vp-card"><h3>Bemor holati</h3><div id="vpClues" class="vp-clues"></div><h3>Tashxisni tanlang</h3><div id="vpDiagnoses" class="vp-actions"></div><div id="vpDiagnosisFeedback" class="vp-feedback"></div></section>
          <section class="vp-card"><h3>Klinik harakatlar</h3><p class="muted">Harakatlar simulyatsiyadagi vitallarni o‘zgartiradi. Avval xavfsiz, hayot saqlovchi choralarni bajaring.</p><div id="vpActions" class="vp-actions"></div><div id="vpActionFeedback" class="vp-feedback"></div></section></div>
        </div>
        <div id="vpReport" class="vp-report hidden"></div>
        <section class="vp-card vp-leaderboard"><div class="vp-leaderboard-head"><h3>🏆 Talabalar reytingi</h3><button id="vpLoadLeaderboard" class="ghost small" type="button">Reytingni yangilash</button></div><div id="vpLeaderboard" class="muted" aria-live="polite">Reytingni ko‘rish uchun tizimga kiring.</div></section>
        <p class="vp-disclaimer">O‘quv maqsadida. Bu haqiqiy bemorni boshqarish vositasi emas. Dori, doza va muolajalar mahalliy klinik protokol hamda malakali mutaxassis ko‘rsatmasiga muvofiq tekshirilishi shart.</p>`;
      const container=$('#roleDashboard')?.parentElement||$('.container'); if(container) container.appendChild(panel);
    }
  }
  function setStatus(t,bad=false){const e=$('#vpStatus');if(e){e.textContent=t;e.classList.toggle('bad',bad)}}
  function selectedCase(){return CASES.find(c=>c.id===$('#vpCase').value)||CASES[0]}
  function start(){
    stop(); const c=selectedCase(); state={case:c, vitals:{...c.start}, remaining:180,score:0,actions:[],errors:[],diagnosis:null,startedAt:Date.now(),tabPenalty:0,firstActionSeconds:null,criticalDone:false};
    finished=false;blurPenaltyApplied=false;$('#vpExam').classList.remove('hidden');$('#vpReport').classList.add('hidden');
    $('#vpClues').innerHTML=c.clues.map(x=>'<div>• '+esc(x)+'</div>').join('');
    $('#vpDiagnoses').innerHTML=c.diagnosis.map((x,i)=>'<button class="option-btn" type="button" data-dx="'+i+'">'+esc(x)+'</button>').join('');
    $('#vpActions').innerHTML=c.actions.map(a=>'<button class="option-btn" type="button" data-action="'+a.id+'">'+esc(a.label)+'</button>').join('');
    $('#vpDiagnosisFeedback').textContent='Tashxis hali tanlanmagan.';$('#vpActionFeedback').textContent='';
    $('#vpDiagnoses').querySelectorAll('button').forEach(b=>b.addEventListener('click',()=>diagnose(+b.dataset.dx)));
    $('#vpActions').querySelectorAll('button').forEach(b=>b.addEventListener('click',()=>act(b.dataset.action)));
    renderVitals();setStatus('Imtihon boshlandi. Vaqtni va bemor holatini kuzating.');$('#vpRhythm').textContent='RHYTHM · '+c.name.toUpperCase();
    ticker=setInterval(()=>{if(finished)return;state.remaining--; if(state.remaining<=0){state.remaining=0;finish('Vaqt tugadi.')}else if(state.remaining%12===0&&!state.criticalDone){state.vitals.hr=Math.min(190,state.vitals.hr+2);state.vitals.sys=Math.max(35,state.vitals.sys-2);state.vitals.spo2=Math.max(55,state.vitals.spo2-1);state.vitals.rr=Math.min(42,state.vitals.rr+1);renderVitals()}$('#vpTimer').textContent='0'+Math.floor(state.remaining/60)+':'+String(state.remaining%60).padStart(2,'0');},1000);
    drawLoop();
  }
  function diagnose(i){if(finished)return;state.diagnosis=i;if(i===state.case.correct){state.score+=10;$('#vpDiagnosisFeedback').textContent='To‘g‘ri tashxis (+10).';}else{state.score-=10;state.errors.push('Noto‘g‘ri tashxis tanlandi.');$('#vpDiagnosisFeedback').textContent='Tashxis mos kelmaydi (−10).';}$('#vpDiagnosisFeedback').classList.toggle('bad',i!==state.case.correct);$('#vpDiagnoses').querySelectorAll('button').forEach((b,j)=>{b.disabled=true;if(j===i)b.classList.add('selected')})}
  function act(id){if(finished)return;const a=state.case.actions.find(x=>x.id===id);if(!a||state.actions.some(x=>x.id===id)){setStatus('Bu harakat allaqachon bajarilgan.',true);return}
    if(state.firstActionSeconds===null)state.firstActionSeconds=180-state.remaining;
    state.actions.push({id,label:a.label,kind:a.kind,points:a.points});state.score+=a.points;
    if(a.kind==='bad'){state.errors.push('Xavfli yoki kechiktirilgan harakat: '+a.label);state.vitals.hr+=a.effect.hr;state.vitals.sys+=a.effect.sys;state.vitals.spo2+=a.effect.spo2;state.vitals.rr+=a.effect.rr;$('#vpActionFeedback').textContent='Bemor holati yomonlashdi. '+a.label;}
    else{state.vitals.hr+=a.effect.hr;state.vitals.sys+=a.effect.sys;state.vitals.spo2+=a.effect.spo2;state.vitals.rr+=a.effect.rr;$('#vpActionFeedback').textContent='Harakat qayd etildi: '+a.label;if(a.kind==='critical')state.criticalDone=true;}
    state.vitals.hr=clamp(state.vitals.hr,35,210);state.vitals.sys=clamp(state.vitals.sys,35,220);state.vitals.dia=clamp(Math.min(state.vitals.dia,state.vitals.sys-10),20,140);state.vitals.spo2=clamp(state.vitals.spo2,50,100);state.vitals.rr=clamp(state.vitals.rr,5,50);
    const btn=$('#vpActions [data-action="'+id+'"]');if(btn){btn.disabled=true;btn.classList.add(a.kind==='bad'?'bad-choice':'done')}
    renderVitals();
    if(state.vitals.sys>=95&&state.vitals.spo2>=94&&state.vitals.hr<=100&&state.vitals.rr<=22&&state.criticalDone){finish('Bemor simulyatsiyada barqarorlashdi.');}
  }
  function clamp(n,a,b){return Math.max(a,Math.min(b,Math.round(n)))}
  function renderVitals(){if(!state)return;const v=state.vitals;$('#vpHr').textContent=v.hr;$('#vpBp').textContent=v.sys+'/'+v.dia;$('#vpSpo2').textContent=v.spo2;$('#vpRr').textContent=v.rr;
    [['vpHr',v.hr>120||v.hr<50],['vpBp',v.sys<90],['vpSpo2',v.spo2<92],['vpRr',v.rr>24]].forEach(([id,bad])=>$('#'+id).classList.toggle('critical',bad));}
  function drawLoop(){if(finished)return;const canvas=$('#vpEcg');if(!canvas)return;const dpr=window.devicePixelRatio||1,w=canvas.clientWidth||600,h=canvas.clientHeight||150;if(canvas.width!==Math.floor(w*dpr)||canvas.height!==Math.floor(h*dpr)){canvas.width=Math.floor(w*dpr);canvas.height=Math.floor(h*dpr)}const ctx=canvas.getContext('2d');ctx.setTransform(dpr,0,0,dpr,0,0);ctx.fillStyle='#04120f';ctx.fillRect(0,0,w,h);ctx.strokeStyle='#123c32';ctx.lineWidth=1;for(let x=0;x<w;x+=20){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,h);ctx.stroke()}for(let y=0;y<h;y+=20){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(w,y);ctx.stroke()}
    const bpm=state?.vitals.hr||80,period=60/Math.max(35,bpm)*70;ctx.beginPath();ctx.strokeStyle='#4dffb0';ctx.lineWidth=2;for(let x=0;x<w;x++){const p=((x+phase)%period)/period;let y=h*.55;if(p>.12&&p<.20)y-=Math.sin((p-.12)/.08*Math.PI)*8;if(p>.32&&p<.35)y+=5;if(p>=.35&&p<.39)y-=52;if(p>=.39&&p<.43)y+=20;if(p>.52&&p<.68)y-=Math.sin((p-.52)/.16*Math.PI)*13;if(state?.case.ecg==='stemi'&&p>.43&&p<.52)y-=15;if(state?.case.ecg==='shock')y+=Math.sin(x*.18)*2;ctx.lineTo(x,y)}ctx.stroke();phase=(phase+2)%Math.max(10,period);raf=requestAnimationFrame(drawLoop);}
  function finish(reason){if(finished)return;finished=true;stop();if(state.diagnosis===null){state.errors.push('Tashxis tanlanmadi.');state.score-=10;}if(!state.criticalDone&&state.case.id!=='mi')state.errors.push('Muhim hayot saqlovchi chora bajarilmadi.');
    const accuracy=state.diagnosis===state.case.correct;const finalScore=clamp(state.score,0,100);const record={case_id:state.case.id,case_name:state.case.name,score:finalScore,diagnosis_correct:accuracy,first_action_seconds:state.firstActionSeconds,actions:state.actions,errors:state.errors,tab_switch_penalties:state.tabPenalty,completed_at:new Date().toISOString(),reason};
    try{const key='medgen_virtual_patient_results_v1';const old=JSON.parse(localStorage.getItem(key)||'[]');old.unshift(record);localStorage.setItem(key,JSON.stringify(old.slice(0,50)))}catch(e){}
    $('#vpReport').classList.remove('hidden');$('#vpReport').innerHTML='<h3>📋 Klinik audit hisoboti</h3><p><b>Keys:</b> '+esc(record.case_name)+'</p><p><b>Natija:</b> '+finalScore+'/100 · <b>Tashxis:</b> '+(accuracy?'to‘g‘ri':'noto‘g‘ri yoki tanlanmagan')+'</p><p><b>Birinchi harakat:</b> '+(record.first_action_seconds===null?'bajarilmadi':record.first_action_seconds+' soniyada')+'</p><p><b>Tab almashtirish jarimalari:</b> '+record.tab_switch_penalties+' · <b>Yakun:</b> '+esc(reason)+'</p><h4>Bajarilgan harakatlar</h4><ul>'+(record.actions.map(a=>'<li>'+esc(a.label)+' ('+(a.points>0?'+':'')+a.points+')</li>').join('')||'<li>Harakat bajarilmadi.</li>')+'</ul><h4>Xatolar va izohlar</h4><ul>'+(record.errors.map(e=>'<li>'+esc(e)+'</li>').join('')||'<li>Qayd etilgan xato yo‘q.</li>')+'</ul><p id="vpServerSaveStatus" class="muted">Natija serverga yuborilmoqda…</p><button id="vpAgain" class="primary small" type="button">Yana bir keys</button>';
    $('#vpAgain').addEventListener('click',start);setStatus('Simulyatsiya yakunlandi: '+reason);$('#vpTimer').textContent='YAKUNLANDI';
    saveServerResult(record);
  }

  async function loadLeaderboard(){
    const box=$('#vpLeaderboard'); if(!box)return;
    const token=sessionStorage.getItem('medgen_access_token');
    if(!token){box.textContent='Reyting uchun MedGen AI hisobingizga kiring.';return;}
    const apiBase=(window.MEDGEN_API_BASE||'https://medgenai-web-1.onrender.com/api/v1'); const api=apiBase.endsWith('/')?apiBase.slice(0,-1):apiBase;
    box.textContent='Reyting yuklanmoqda…';
    try{
      const response=await fetch(api+'/academy/virtual-patient/leaderboard?limit=10',{headers:{'Authorization':'Bearer '+token}});
      const data=await response.json().catch(()=>({}));
      if(!response.ok)throw new Error(data.detail||('HTTP '+response.status));
      const rows=data.leaderboard||data.rows||data.results||[];
      if(!rows.length){box.textContent='Hozircha reyting bo‘sh. Birinchi simulyatsiyani yakunlang!';return;}
      box.innerHTML='<ol class="vp-ranking">'+rows.map((row,i)=>'<li><span><b>'+esc(row.username||row.student||'Talaba')+'</b><small>'+Number(row.attempts||1)+' urinish</small></span><strong>'+Number(row.best_score??row.score??0)+'/100</strong></li>').join('')+'</ol>';
    }catch(err){box.textContent='Reytingni yuklab bo‘lmadi: '+String(err.message||err)+'. Simulyatsiya natijangiz baribir mahalliy saqlanadi.';}
  }
  async function saveServerResult(record){
    const box=$('#vpServerSaveStatus'); if(!box)return;
    const token=sessionStorage.getItem('medgen_access_token');
    if(!token){box.textContent='Serverga saqlanmadi: tizimga kirish tokeni topilmadi. Natija ushbu qurilmada saqlandi.';return;}
    const apiBase=(window.MEDGEN_API_BASE||'https://medgenai-web-1.onrender.com/api/v1'); const api=apiBase.endsWith('/')?apiBase.slice(0,-1):apiBase;
    try{
      const response=await fetch(api+'/academy/virtual-patient/result',{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+token},body:JSON.stringify(record)});
      const data=await response.json().catch(()=>({}));
      if(!response.ok)throw new Error(data.detail||('HTTP '+response.status));
      box.textContent='✅ Serverga saqlandi · natija ID: '+data.result_id+'. Reyting jadvaliga yozildi.';
      box.dataset.saved='true';
    }catch(err){box.textContent='Serverga saqlash amalga oshmadi ('+String(err.message||err)+'). Natija hozircha faqat ushbu qurilmada saqlandi.';box.dataset.saved='false';}
  }
  function stop(){if(ticker){clearInterval(ticker);ticker=null}if(raf){cancelAnimationFrame(raf);raf=null}}
  function penalty(){if(finished||!state||blurPenaltyApplied)return;blurPenaltyApplied=true;state.tabPenalty++;state.score-=15;state.errors.push('Brauzer oynasidan chiqish: −15 jarima balli.');const warning=$('#vpWarning')||document.createElement('div');warning.id='vpWarning';warning.className='vp-warning';warning.setAttribute('role','alert');warning.textContent='⚠️ Anti-cheat: boshqa oyna/ilovaga o‘tish aniqlandi. −15 ball.';$('#virtualPatientPanel').prepend(warning);setTimeout(()=>{warning.remove();blurPenaltyApplied=false},5000)}
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden')penalty()});
  window.addEventListener('blur',()=>{if($('#virtualPatientPanel')&&!$('#virtualPatientPanel').classList.contains('hidden'))penalty()});
  document.addEventListener('click',e=>{if(e.target.closest('#virtualPatientLaunch')){inject();$('#virtualPatientPanel').classList.remove('hidden');$('#virtualPatientPanel').scrollIntoView({behavior:'smooth',block:'start'});loadLeaderboard()}if(e.target.closest('#vpClose'))$('#virtualPatientPanel').classList.add('hidden');if(e.target.closest('#vpStart'))start();if(e.target.closest('#vpLoadLeaderboard'))loadLeaderboard()});
  document.addEventListener('DOMContentLoaded',inject);setInterval(inject,1500);
})();