const {JSDOM}=require('jsdom'),fs=require('fs'),assert=require('node:assert/strict');
(async()=>{
 const dom=new JSDOM('<div class="language-box"></div><div class="top-actions"></div><div id="hubLanguageLesson"><ol><li><b>Guten Morgen</b> — Xayrli tong</li></ol></div><select id="hubLanguage"><option value="de">German</option></select>',{url:'http://localhost',runScripts:'outside-only'}),w=dom.window;
 const spoken=[];w.SpeechSynthesisUtterance=function(text){this.text=text;};w.speechSynthesis={cancel(){},speak(item){spoken.push(item);}};
 w.eval(fs.readFileSync('ux.js','utf8'));
 await new Promise(r=>setTimeout(r,20));
 const actions=w.document.querySelector('.language-practice-actions');assert.ok(actions);
 actions.children[0].click();assert.equal(w.document.querySelector('#hubLanguageLesson li>span').hidden,true);
 actions.children[1].click();assert.equal(spoken[0].text,'Guten Morgen');assert.equal(spoken[0].lang,'de-DE');
 actions.children[0].click();assert.equal(w.document.querySelector('#hubLanguageLesson li>span').hidden,false);
 assert.equal(w.document.querySelectorAll('.language-practice-actions').length,1);
 console.log('PASS language practice: recall toggle and selected German speech locale');w.close();
})().catch(e=>{console.error(e);process.exitCode=1});
