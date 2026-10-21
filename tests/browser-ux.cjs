// Real local browser regressions for the problems reported on Android.
const {chromium}=require('playwright'),assert=require('node:assert/strict'),{randomUUID}=require('node:crypto');
(async()=>{
 const executablePath=process.env.MEDGEN_TEST_CHROMIUM;
 const browser=await chromium.launch(executablePath?{executablePath,args:['--no-sandbox','--disable-dev-shm-usage']}:{});
 try{for(const width of [390,1440]){
  const context=await browser.newContext({viewport:{width,height:1000},geolocation:{latitude:0,longitude:0},permissions:['geolocation']});
  try{
   await context.route('**/*',r=>new URL(r.request().url()).hostname==='127.0.0.1'?r.continue():r.abort());
   const base='http://127.0.0.1:8080/api/v1',username='ux_'+randomUUID().slice(0,8),password=randomUUID()+'Aa1';
   assert.equal((await context.request.post(base+'/auth/register',{data:{username,password,role:'biotech',full_name:'UX Test',email:username+'@example.org'}})).status(),200);
   const login=await context.request.post(base+'/auth/login',{data:{username,password}}),headers={Authorization:'Bearer '+(await login.json()).access_token};
   await context.request.put(base+'/profile',{headers,data:{full_name:'UX Test',email:username+'@example.org',country:'UZ',region:'Test',district:'Test',city:'Test',birth_year:2000,birth_month:1,birth_day:1}});
   await context.request.post(base+'/legal/consent',{headers,data:{terms_accepted:true,privacy_accepted:true,data_processing_accepted:true,research_disclaimer_accepted:true}});
   const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
   await page.goto('http://127.0.0.1:8080/');
   for(const [lang,label] of [['en','Register'],['ru','Регистрация'],['uz','Ro‘yxatdan o‘tish']]){
    await page.locator('#loginLanguageSelector').selectOption(lang);
    await page.waitForFunction(expected=>document.getElementById('showRegister').textContent===expected,label);
   }
   await page.locator('[data-theme-select]').first().selectOption('dark');
   assert.equal(await page.locator('html').getAttribute('data-theme'),'dark');
   await page.reload();assert.equal(await page.locator('html').getAttribute('data-theme'),'dark');
   await page.locator('#loginUser').fill(username);await page.locator('#loginPassword').fill(password);await page.locator('#loginSubmitBtn').click();
   await page.locator('#finalHome').waitFor({state:'visible'});
   assert.equal(await page.locator('#roleDashboard').isVisible(),false);
   await page.locator('#openOpportunities').click();await page.locator('#opportunitiesPanel').waitFor({state:'visible'});
   await page.locator('#opportunitiesPanel > button').click();
   await page.locator('#languageSelector').selectOption('en');
   await page.waitForFunction(()=>document.querySelector('#cabinetWelcome h1').textContent==='Your scientific workspace');
   await page.locator('#languageSelector').selectOption('ru');
   await page.waitForFunction(()=>document.querySelector('#cabinetWelcome h1').textContent==='Ваш научный кабинет');
   await page.locator('#languageSelector').selectOption('uz');
   await page.locator('#profileBtn').click();await page.locator('#profileModal').waitFor({state:'visible'});
   const saved=page.waitForResponse(r=>r.url().endsWith('/security/location'));
   await page.locator('#detectLocationBtn').click();assert.equal((await saved).status(),200);
   await page.waitForFunction(()=>document.getElementById('locationStatus').textContent.includes('saqlandi'));
   const profile=(await (await context.request.get(base+'/profile',{headers})).json());
   const p=profile.profile||profile;assert.equal(p.location_lat,0);assert.equal(p.location_lon,0);
   await page.locator('#profileClose').click();
   await page.locator('#finalHome [data-final-service="ai"]').click();
   await page.locator('#aiInput').fill('login haqida savol\nIkkinchi qator');
   assert.ok((await page.locator('#aiInput').boundingBox()).height>=120);
   await page.locator('#aiForm button').click();
   await page.waitForFunction(()=>document.getElementById('aiMsgs').textContent.includes('Parolingizni'));
   assert.match(await page.locator('#aiMsgs').textContent(),/login haqida savol/);
   await page.locator('#functionalBack').click();
   await page.locator('#finalHome [data-final-service="community"]').click();
   await page.locator('#communityInput').fill('My own message\nSecond line');
   assert.ok((await page.locator('#communityInput').boundingBox()).height>=120);
   await page.locator('#communityForm button').click();
   await page.waitForFunction(()=>document.getElementById('communityMsgs').textContent.includes('My own message'));
   await page.locator('#languageSelector').selectOption('ru');
   assert.match(await page.locator('#communityMsgs').textContent(),/My own message/,'user content remains original');
   await page.locator('#functionalBack').click();
   await page.locator('#finalHome [data-final-module="Molecular Analysis"]').click();
   await page.locator('#moleculeVisualPanel').waitFor({state:'visible'});
   assert.equal(await page.locator('#moleculeVisualPanel').evaluate(e=>!!e.closest('#dashboardView')),true);
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'no horizontal overflow');
   await page.locator('#workspaceClose').click();
   for(const theme of ['light','dark']){
    await page.locator('.top-actions [data-theme-select]').selectOption(theme);
    assert.equal(await page.locator('html').getAttribute('data-theme'),theme);
    await page.waitForTimeout(250);
    if(process.env.MEDGEN_SCREENSHOTS)await page.screenshot({path:process.env.MEDGEN_SCREENSHOTS+'/ux-'+theme+'-'+width+'.png',fullPage:true});
   }
   await context.setOffline(true);
   await page.locator('#logoutBtn').click();
   await page.locator('#loginView').waitFor({state:'visible',timeout:2000});
   assert.equal(await page.evaluate(()=>sessionStorage.getItem('medgen_access_token')),null);
   assert.equal(await page.locator('#moleculeVisualPanel').isVisible(),false);
   assert.equal(await page.locator('#dashboardView').isVisible(),false);
   assert.deepEqual(errors,[]);
   console.log('PASS UX '+width+': language, themes, zero-coordinate GPS save, chat, community, visual lab, offline logout');
  }finally{await context.close();}
 }}finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
