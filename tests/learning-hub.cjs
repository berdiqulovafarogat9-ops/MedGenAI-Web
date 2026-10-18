// Exercise the actual Learning Hub handlers against a controlled API in jsdom.
const {JSDOM}=require('jsdom');
const fs=require('node:fs');
const vm=require('node:vm');
const assert=require('node:assert/strict');
const path=require('node:path');
const app=fs.readFileSync(path.join(__dirname,'../app.js'),'utf8');
const start=app.indexOf("  if (moduleName === 'Learning Hub') {");
const end=app.indexOf('    hub.classList.remove',start);
const finish=app.indexOf('\n  }',end)+4;
const dom=new JSDOM('<div id="workspace"></div>',{url:'https://medgen-ai.pages.dev',runScripts:'outside-only'});
const w=dom.window, calls=[];
let fail=false;
w.testApi=async(p,options)=>{
 if(!options)return {attempts:[],readings:{}};
 if(p.endsWith('/readings')){calls.push(JSON.parse(options.body));return {storage:'postgresql'};}
 const body=JSON.parse(options.body);calls.push(body);
 if(fail)throw Error('offline');
 return {attempt:{score:1,total:body.answers.length},storage:'postgresql'};
};
vm.runInContext(`const $=id=>document.getElementById(id);const state={token:'alice'};
 const escapeHtml=s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;');
 const api=window.testApi;
 function openHub(moduleName){${app.slice(start,finish)}}
 openHub('Learning Hub');`,dom.getInternalVMContext());
const click=s=>{const b=w.document.querySelector(s);assert.ok(b,s);b.click();};
const flush=()=>new Promise(r=>setImmediate(r));
(async()=>{
 await flush();
 click('#hubStartGame');for(let i=0;i<12;i++)click('#hubGame [data-answer="0"]');
 await flush();assert.equal(calls.at(-1).activity,'quick');assert.equal(calls.at(-1).answers.length,12);
 for(const [button,box,activity] of [['#hubTheoryExamStart','hubTheoryExam','theory'],['#hubClinicalStart','hubClinicalExam','clinical']]){
  click(button);
  for(let i=0;i<5;i++){click('#'+box+' [data-exam-answer="0"]');click('#'+box+'Next');}
  await flush();assert.equal(calls.at(-1).activity,activity);assert.equal(calls.at(-1).answers.length,5);
 }
 click('#hubMoleculeStart');
 for(let i=0;i<5;i++){
  click('#hubMoleculeGame [data-correct="1"]');
  const next=[...w.document.querySelectorAll('#hubMoleculeGame button')].find(b=>['Keyingi','Natija'].includes(b.textContent));
  assert.ok(next);next.click();
 }
 await flush();const mol=calls.at(-1);assert.equal(mol.activity,'molecule');
 assert.deepEqual(mol.answers,mol.question_ids);assert.equal(new Set(mol.question_ids).size,5);
 click('#hubTheoryOpen');click('#hubTheoryContent [data-theory-answer="0"]');await flush();
 assert.equal(calls.at(-1).activity,'lesson_cell');
 click('#hubStartLanguage');
 [...w.document.querySelectorAll('#hubLanguageLesson button')].find(b=>b.textContent==='O‘qib chiqdim').click();
 await flush();assert.equal(calls.at(-1).language,'en');
 click('#organGameStart');
 for(const [organ,zone] of [['heart','chest'],['lungs','chest'],['brain','head'],['stomach','upperbelly'],['kidneys','back']]){
   click('[data-organ="'+organ+'"]');click('[data-zone="'+zone+'"]');
 }
 await flush();assert.equal(calls.at(-1).activity,'organ');assert.deepEqual(calls.at(-1).answers,[1,1,0,2,3]);
 fail=true;click('#hubTheoryExamStart');
 for(let i=0;i<5;i++){click('#hubTheoryExam [data-exam-answer="0"]');click('#hubTheoryExamNext');}
 await flush();const first=calls.at(-1);
 const retry=[...w.document.querySelectorAll('#hubTheoryExam button')].find(b=>b.textContent==='Qayta saqlash');
 assert.ok(retry);fail=false;retry.click();await flush();
 assert.equal(calls.at(-1).attempt_id,first.attempt_id);
 assert.match(w.document.getElementById('hubTheoryExam').textContent,/Bazaga saqlandi/);
 console.log('PASS: quick, theory, clinical, shuffled molecule, organ placement, theory lesson and language reading; save error and idempotent retry UI');
 dom.window.close();
})().catch(e=>{console.error(e);dom.window.close();process.exitCode=1;});
