// Disposable localhost only: real account, consent, profile, navigation and computation.
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const {randomUUID}=require('node:crypto');
const fs=require('node:fs');
(async()=>{
 const executablePath=process.env.MEDGEN_TEST_CHROMIUM;
 const browser=await chromium.launch(executablePath?{executablePath,args:['--no-sandbox','--disable-dev-shm-usage','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']}:{});
 try{
  for(const width of [1440,390])for(const role of ['student','biotech','company']){
   const context=await browser.newContext({viewport:{width,height:1000}});
   try{
    // No production API calls from old optional integrations in this local test.
    await context.route('**/*',route=>new URL(route.request().url()).hostname==='127.0.0.1'?route.continue():route.abort());
    const username='ui_'+randomUUID().slice(0,8),password=randomUUID()+'Aa1';
    const base='http://127.0.0.1:8080/api/v1';
    const response=await context.request.post(base+'/auth/register',{data:{username,password,role,full_name:'UI Test',email:username+'@example.org'}});
    assert.equal(response.status(),200);
    const login=await context.request.post(base+'/auth/login',{data:{username,password}});
    const headers={Authorization:'Bearer '+(await login.json()).access_token};
    for(const [method,path,data] of [
     ['put','/profile',{full_name:'UI Test',email:username+'@example.org',country:'UZ',region:'Test',district:'Test',city:'Test',birth_year:2000,birth_month:1,birth_day:1}],
     ['put','/academy/profile',{university:'Test',faculty:'Test',major:'Test',group:'Test',country_code:'UZ',year:1}],
     ['post','/legal/consent',{terms_accepted:true,privacy_accepted:true,data_processing_accepted:true,research_disclaimer_accepted:true}]
    ])assert.equal((await context.request[method](base+path,{headers,data})).status(),200,path);
    const page=await context.newPage();
    await page.goto('http://127.0.0.1:8080/');
    await page.locator('#loginUser').fill(username);await page.locator('#loginPassword').fill(password);await page.locator('#loginSubmitBtn').click();
    await page.locator('#finalHome').waitFor({state:'visible'});
    assert.equal(await page.locator('.cabinet-card').count(),6);
    const overflow=await page.evaluate(()=>[...document.querySelectorAll('body *')].filter(e=>e.getBoundingClientRect().right>innerWidth+1&&e.getBoundingClientRect().width>0).slice(0,12).map(e=>e.tagName+'#'+e.id+'.'+e.className));
    if(overflow.length)console.log('Overflow candidates:',overflow);
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'home horizontal overflow');
    if(process.env.MEDGEN_SCREENSHOTS){fs.mkdirSync(process.env.MEDGEN_SCREENSHOTS,{recursive:true});await page.screenshot({path:process.env.MEDGEN_SCREENSHOTS+'/home-'+role+'-'+width+'.png',fullPage:true});}
    const module={student:'Learning Hub',biotech:'Molecular Analysis',company:'Research Assistant'}[role];
    await page.locator('#finalHome [data-final-module="'+module+'"]').first().click();
    await page.locator('#workspaceGuide').waitFor({state:'visible'});
    await page.locator({student:'#hubStartGame',biotech:'#molecularRun',company:'#researchRun'}[role]).waitFor({state:'visible'});
    assert.equal(await page.locator('#finalHome').isVisible(),false);
    if(role==='student'){
     await page.locator('#hubStartGame').click();
     for(let i=0;i<12;i++)await page.locator('#hubGame [data-answer="0"]').click();
     await page.waitForFunction(()=>document.querySelector('#hubGame').textContent.includes('Vaqtinchalik server xotirasida'));
     const progress=await context.request.get(base+'/learning-hub/progress',{headers});
     assert.equal((await progress.json()).attempts.length,1);
     await page.locator('.hub-history-nav button').click();
     assert.equal(await page.locator('#hubProgress').evaluate(e=>e===document.activeElement),true);
    }else if(role==='biotech'){
     await page.locator('#smilesInput').fill('CCO');
     const calculation=page.waitForResponse(r=>r.url().endsWith('/molecules/analyze'));
     await page.locator('#molecularRun').click();assert.equal((await calculation).status(),200);
     await page.waitForFunction(()=>document.querySelector('#molecularResult').textContent.includes('CCO'));
     assert.ok((await page.locator('#molecularResultSummary').textContent()).includes('46.069'));
    }
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'workspace horizontal overflow');
    if(process.env.MEDGEN_SCREENSHOTS)await page.screenshot({path:process.env.MEDGEN_SCREENSHOTS+'/workspace-'+role+'-'+width+'.png',fullPage:true});
    await page.locator('#workspaceClose').click();await page.locator('#finalHome').waitFor({state:'visible'});
    for(const extra of (role==='biotech'?['Bioinformatics','PDB & Structure']:role==='company'?['Virtual Laboratory','Global Platform','Drug Discovery']:[])){
     await page.locator('#finalHome [data-final-module="'+extra+'"]').first().click();
     await page.locator('#workspaceGuide').waitFor({state:'visible'});
     if(extra==='Bioinformatics'){
      await page.locator('#bioSequence').fill('ATGC');await page.locator('#bioRun').click();
      await page.locator('#bioResultSummary').waitFor({state:'visible'});
      assert.ok((await page.locator('#bioResultSummary').textContent()).includes('50'));
     }
     assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),extra+' overflow');
     if(process.env.MEDGEN_SCREENSHOTS)await page.screenshot({path:process.env.MEDGEN_SCREENSHOTS+'/'+extra.replaceAll(' ','-')+'-'+width+'.png',fullPage:true});
     await page.locator('#workspaceClose').click();await page.locator('#finalHome').waitFor({state:'visible'});
    }
    console.log('PASS real workspace '+role+' '+width+'px; navigation, available calculations and return home');
   }finally{await context.close();}
  }
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
