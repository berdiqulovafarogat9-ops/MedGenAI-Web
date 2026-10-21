const {JSDOM}=require('jsdom'),fs=require('fs'),vm=require('vm'),assert=require('node:assert/strict');
(async()=>{
 const app=fs.readFileSync('app.js','utf8'),start=app.indexOf("  if (moduleName === 'Learning Hub') {"),end=app.indexOf('\n  }',app.indexOf('    hub.classList.remove',start))+4;
 for(const lang of ['en','ru']){
  const dom=new JSDOM('<div id="workspace"></div>',{url:'http://localhost',runScripts:'outside-only'}),w=dom.window,calls=[];
  w.localStorage.setItem('medgen_language',lang);w.testApi=async(p,o)=>{if(!o)return{attempts:[],readings:{}};const data=JSON.parse(o.body);calls.push(data);return{attempt:{score:1,total:data.answers.length},storage:'postgresql'}};
  vm.runInContext(`const $=id=>document.getElementById(id);const state={token:'test'};const escapeHtml=s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;');const api=window.testApi;function openHub(moduleName){${app.slice(start,end)}}openHub('Learning Hub');`,dom.getInternalVMContext());
  w.eval(fs.readFileSync('ux.js','utf8'));const settle=()=>new Promise(r=>setTimeout(r,10));await settle();
  for(const topic of ['cell','blood','heart','dna','micro']){
   w.document.getElementById('hubTheoryTopic').value=topic;w.document.getElementById('hubTheoryOpen').click();await settle();
   const box=w.document.getElementById('hubTheoryContent');assert.doesNotMatch(box.textContent,/hujayra|qon |asosiy|qaysi|ishlatiladi/i);
   box.querySelector('[data-theory-answer="0"]').click();await settle();assert.equal(calls.at(-1).activity,'lesson_'+topic);assert.deepEqual(calls.at(-1).answers,[0]);
  }
  for(const [startId,boxId,activity] of [['hubTheoryExamStart','hubTheoryExam','theory'],['hubClinicalStart','hubClinicalExam','clinical']]){
   w.document.getElementById(startId).click();await settle();
   for(let i=0;i<5;i++){
    const box=w.document.getElementById(boxId);assert.doesNotMatch(box.textContent,/Savol|qaysi|nima|Bemor|oldin|muhim/);
    box.querySelector('[data-exam-answer="0"]').click();await settle();assert.doesNotMatch(box.textContent,/To‘g‘ri|Noto‘g‘ri|hisobga|talab qiladi/);
    w.document.getElementById(boxId+'Next').click();await settle();
   }
   assert.equal(calls.at(-1).activity,activity);assert.deepEqual(calls.at(-1).answers,[0,0,0,0,0]);assert.match(w.document.getElementById(boxId).textContent,/5\/5/);
  }
  w.document.getElementById('hubStartLanguage').click();await settle();
  assert.equal(w.document.querySelector('#hubLanguageLesson li>b').textContent,'symptom','Target language phrase must stay unchanged');
  assert.doesNotMatch(w.document.querySelector('#hubLanguageLesson li>span').textContent,/alomat/);
  w.document.getElementById('organGameStart').click();await settle();
  for(const [organ,zone] of [['heart','chest'],['lungs','chest'],['brain','head'],['stomach','upperbelly'],['kidneys','back']]){
   w.document.querySelector('[data-organ="'+organ+'"]').click();await settle();
   assert.doesNotMatch(w.document.getElementById('organGameFeedback').textContent,/Tanlangan|Endi mos/);
   w.document.querySelector('[data-zone="'+zone+'"]').click();await settle();
  }
  assert.equal(calls.at(-1).activity,'organ');assert.deepEqual(calls.at(-1).answers,[1,1,0,2,3]);
  assert.doesNotMatch(w.document.getElementById('organGameFeedback').textContent,/Ajoyib|Yakuniy ball|Bazaga/);
  assert.doesNotMatch(w.document.getElementById('hubProgress').textContent,/Saqlangan|Hali saqlangan|O‘qilgan/);
  w.close();
 }
 console.log('PASS: five lessons and ten theory/clinical questions in English/Russian, server answer identities unchanged');
})().catch(e=>{console.error(e);process.exitCode=1});
