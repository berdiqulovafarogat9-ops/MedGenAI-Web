const {chromium}=require('playwright'),assert=require('node:assert/strict'),{randomUUID}=require('node:crypto');
(async()=>{
 const executablePath=process.env.MEDGEN_TEST_CHROMIUM;
 const browser=await chromium.launch(executablePath?{executablePath,args:['--no-sandbox']}:{});
 try{
  const context=await browser.newContext({viewport:{width:390,height:1000}});
  await context.route('**/*',r=>new URL(r.request().url()).hostname==='127.0.0.1'?r.continue():r.abort());
  const base='http://127.0.0.1:8080/api/v1',username='prof_'+randomUUID().slice(0,8),password=randomUUID()+'Aa1';
  assert.equal((await context.request.post(base+'/auth/register',{data:{username,password,role:'professor',full_name:'Professor Test',email:username+'@example.org'}})).status(),200);
  const login=await context.request.post(base+'/auth/login',{data:{username,password}}),headers={Authorization:'Bearer '+(await login.json()).access_token};
  for(const [method,path,data] of [
   ['put','/profile',{full_name:'Professor Test',email:username+'@example.org',country:'UZ',region:'Test',district:'Test',city:'Test',birth_year:2000,birth_month:1,birth_day:1}],
   ['put','/academy/profile',{university:'Test',faculty:'Test',major:'Test',group:'Test',country_code:'UZ',year:1}],
   ['post','/legal/consent',{terms_accepted:true,privacy_accepted:true,data_processing_accepted:true,research_disclaimer_accepted:true}]
  ])assert.equal((await context.request[method](base+path,{headers,data})).status(),200);
  const page=await context.newPage();await page.goto('http://127.0.0.1:8080/');
  await page.locator('#loginUser').fill(username);await page.locator('#loginPassword').fill(password);await page.locator('#loginSubmitBtn').click();
  await page.locator('#openOpportunities').click();
  const form=page.locator('#opportunitiesPanel form');await form.waitFor({state:'visible'});
  for(const [name,value] of Object.entries({title:'Test scholarship',organization:'Test organization',description:'An educational test opportunity with clear eligibility.',deadline:new Date(Date.now()+86400000*10).toISOString().slice(0,10),source_url:'https://example.org/scholarship'}))await form.locator('[name="'+name+'"]').fill(value);
  await form.locator('button[type="submit"]').click();
  await page.waitForFunction(()=>document.querySelector('#opportunitiesPanel article')?.textContent.includes('Test scholarship'));
  assert.match(await page.locator('#opportunitiesPanel article').textContent(),/Tekshiruvda/);
  assert.equal(await page.locator('#opportunitiesPanel article button').count(),0);
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  console.log('PASS mobile professor: submit scholarship, pending review, no self-publish control');
  await context.close();
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
