const {JSDOM}=require('jsdom'),fs=require('fs'),assert=require('node:assert/strict');
(async()=>{
 const source=fs.readFileSync('app.js','utf8');
 const exercise=source.slice(source.indexOf('    const gameQuestions=['),source.indexOf("    $('hubExamPlan')"));
 const expected={uz:'Qon bosimi',en:'Blood pressure',ru:'Артериальное давление'};
 for(const lang of ['uz','en','ru']){
  const dom=new JSDOM('<select id="languageSelector"><option>uz</option><option>en</option><option>ru</option></select><button id="hubStartGame"></button><div id="hubGame"></div><div id="hubAchievement"></div><div id="aiMsgs">Qon bosimi</div>',{url:'http://localhost',runScripts:'outside-only'});
  const w=dom.window;w.localStorage.setItem('medgen_language',lang);w.document.getElementById('languageSelector').value=lang;
  // eval lexical declarations must share the same evaluation as the exercise.
  w.eval("const $=id=>document.getElementById(id); const escapeHtml=s=>s.replaceAll('&','&amp;').replaceAll('<','&lt;'); const saveHubAttempt=(...args)=>window.saved=args;"+exercise);
  w.eval(fs.readFileSync('ux.js','utf8'));
  const settle=()=>new Promise(r=>setTimeout(r,10));await settle();
  w.document.getElementById('hubStartGame').click();await settle();
  assert.equal(w.document.querySelector('[data-answer="0"]').textContent,expected[lang]);
  assert.equal(w.document.getElementById('aiMsgs').textContent,'Qon bosimi','User message must remain unchanged');
  // Switch language mid-attempt: question IDs and scoring must not change.
  const select=w.document.getElementById('languageSelector');select.value=lang==='en'?'ru':'en';select.dispatchEvent(new w.Event('change'));await settle();
  assert.equal(w.document.querySelector('[data-answer="0"]').textContent,expected[select.value]);
  const keys=[0,1,1,1,1,0,0,1,0,0,0,1];
  for(const answer of keys){w.document.querySelector(`[data-answer="${answer}"]`).click();await settle();}
  assert.equal(w.saved[0],'quick');assert.deepEqual(Array.from(w.saved[1]),keys);assert.deepEqual(Array.from(w.saved[2]),keys.map((_,i)=>i));
  assert.match(w.document.getElementById('hubGame').textContent,/12\/12/);w.close();
 }
 console.log('PASS: three UI languages, switching during quiz, all answer IDs and user messages preserved');
})().catch(e=>{console.error(e);process.exitCode=1});
