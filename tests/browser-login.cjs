// Run only against the disposable localhost preview, never production.
const {chromium} = require('playwright');
const assert = require('node:assert/strict');
const {randomUUID} = require('node:crypto');
(async () => {
  const browser = await chromium.launch();
  try {
    for (const viewport of [{width: 1440, height: 1000}, {width: 390, height: 844}]) {
      const context = await browser.newContext({viewport});
      try {
        const username = 'e2e_' + randomUUID().replaceAll('-', '').slice(0, 12);
        const password = randomUUID() + 'A1';
        const registration = await context.request.post('http://127.0.0.1:8080/api/v1/auth/register', {
          data: {username, password, full_name: 'CI Browser Test', email: username + '@example.org', role: 'student'}
        });
        assert.equal(registration.status(), 200);
        const page = await context.newPage();
        await page.goto('http://127.0.0.1:8080/');
        await page.locator('#loginUser').fill(username);
        await page.locator('#loginPassword').fill(password);
        const loginResponse = page.waitForResponse(r => r.url().endsWith('/auth/login') && r.request().method() === 'POST');
        await page.locator('#loginSubmitBtn').click();
        assert.equal((await loginResponse).status(), 200);
        await page.waitForFunction(() => !document.getElementById('dashboardView').classList.contains('hidden'));
        const token = await page.evaluate(() => sessionStorage.getItem('medgen_access_token'));
        assert.ok(token);
        const me = await context.request.get('http://127.0.0.1:8080/api/v1/auth/me', {headers: {Authorization: 'Bearer ' + token}});
        assert.equal(me.status(), 200);
        assert.equal((await me.json()).username, username);
        console.log('PASS real browser registration/login/dashboard: ' + viewport.width + 'px');
      } finally { await context.close(); }
    }
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
