// End-to-end clinical workflow in a real Chromium page, using a deterministic API fixture.
// This validates the learner flow and WebGL scene initialization with a deterministic GLB fallback; it does not claim photorealistic fidelity.
"use strict";
const { chromium } = require("playwright");
const assert = require("node:assert/strict");
const path = require("node:path");
const patientGlbPath = process.env.MEDGEN_TEST_PATIENT_GLB || "";
const threeRoot = path.resolve(path.dirname(require.resolve("three")), "..");

const root = path.resolve(__dirname, "..");
const caseData = {
  id: "anaphylaxis_jasur",
  title: "4-keys: Jasur — anafilaktik shok",
  level: "Shoshilinch",
  story: "Yong‘oqdan keyin yuz-lab shishi, xirillash va og‘ir gipotenziya.",
  patient: { name: "Jasur", age_years: 22, setting: "Shoshilinch qabul bo‘limi" },
  anamnesis: [],
  allergies: [],
  dialogue: [],
  init: { hr: 142, sbp: 68, dbp: 38, spo2: 86, rr: 32 },
  ecg: "normal",
  worsen: { hr: 0.05, sbp: -0.3, dbp: -0.2, spo2: -0.03, rr: 0.02 },
  actions: [
    { id: "epi_thigh", label: "Adrenalin 0.5 mg IM — sonning old-yon qismiga", effects: { hr: -35, sbp: 32, dbp: 22, spo2: 4, rr: -5 }, grade: "required" },
    { id: "oxygen_high", label: "Yuqori oqimli kislorod — niqob orqali", effects: { spo2: 6, rr: -8 }, grade: "required" },
    { id: "crystalloid_bolus", label: "Izotonik kristalloid 500 ml IV infuziya va gemodinamik qayta baholash", effects: { sbp: 10, dbp: 10, hr: -8 }, grade: "required" },
    { id: "monitor", label: "Uzluksiz monitoring va ABC qayta baholash", effects: {}, grade: "neutral" }
  ],
  diagnosis_options: ["Anafilaktik shok", "O‘tkir astma xuruji", "Miokard infarkti", "Vazovagal sinkope"],
  diagnosis_correct: 0,
  diagnosis_explain: "Teri shishi, nafas qisilishi va keskin gipotenziya anafilaktik shokni ko‘rsatadi."
};
(async () => {
  const executablePath = process.env.MEDGEN_TEST_CHROMIUM;
  const launchOptions = {
    args: ["--no-sandbox", "--disable-dev-shm-usage", "--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"]
  };
  if (executablePath) launchOptions.executablePath = executablePath;
  const browser = await chromium.launch(launchOptions);
  try {
    for (const viewport of [{ width: 1440, height: 1000 }, { width: 390, height: 844 }]) {
      const context = await browser.newContext({ viewport });
      try {
        const page = await context.newPage();
        const pageErrors = [];
        page.on("pageerror", error => pageErrors.push(error.message));
        await page.addInitScript(({ fixture }) => {
          window.MEDGEN_API_BASE = "http://127.0.0.1:8080/api/v1";
          window.__MEDGEN_TEST_MODE = true;
          window.__clinicalReportPayloads = [];
          window.__clinicalApiCalls = [];
          window.submitStudentScore = async () => ({ status: "saved" });
          window.fetch = async (url, options = {}) => {
            const path = String(url);
            window.__clinicalApiCalls.push({ url: path, method: options.method || "GET" });
            if (path.endsWith("/clinical/vitals/cases")) {
              return new Response(JSON.stringify({ cases: [fixture] }), { status: 200, headers: { "Content-Type": "application/json" } });
            }
            if (path.endsWith("/clinical/vitals/report") && options.method === "POST") {
              const body = JSON.parse(options.body || "{}");
              window.__clinicalReportPayloads.push(body);
              return new Response(JSON.stringify({
                score: 92, title: fixture.title, disclaimer: "Ta’limiy simulyatsiya.",
                stabilized: true, stabilized_at_s: body.elapsed_seconds, seconds_used: body.elapsed_seconds,
                final_vitals: { hr: 99, sbp: 110, dbp: 70, spo2: 96, rr: 18 },
                breakdown: { required_done: 3, required_total: 3, diagnosis_correct: true, tab_penalty: 0 },
                audit: [{ type: "performed", t: 0, action: "Adrenalin IM", text: "Server audit fixture." }]
              }), { status: 200, headers: { "Content-Type": "application/json" } });
            }
            return new Response(JSON.stringify({ detail: "Unexpected API request: " + path }), { status: 404, headers: { "Content-Type": "application/json" } });
          };
        }, { fixture: caseData });
        // Use a same-origin page: about:blank has an opaque origin and blocks sessionStorage.
        await page.goto("http://127.0.0.1:8080/api/v1/health/live", { waitUntil: "domcontentloaded" });
        await page.setContent('<!doctype html><html lang="uz"><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><main id="clinical-root"></main></body></html>');
        // Load the exact pinned Three.js runtime from the CI package, without CDN variability.
        await page.addScriptTag({ path: path.join(threeRoot, "build/three.min.js") });
        await page.addScriptTag({ path: path.join(threeRoot, "examples/js/controls/OrbitControls.js") });
        await page.addScriptTag({ path: path.join(threeRoot, "examples/js/loaders/GLTFLoader.js") });
        // Keep the test deterministic: exercise the real WebGL scene with its procedural patient fallback.
        await page.route("**/models/medgen-patient.glb", route => patientGlbPath
          ? route.fulfill({ path: patientGlbPath, contentType: "model/gltf-binary" })
          : route.fulfill({ status: 404, body: "fixture: use procedural patient fallback" }));
        await page.addScriptTag({ path: path.join(root, "vitals-3d.js") });
        await page.addScriptTag({ path: path.join(root, "vitals-core.js") });
        await page.addScriptTag({ path: path.join(root, "vitals-sim.js") });
        await page.evaluate(() => window.medgenOpenVitalsSimulationEmbedded(document.getElementById("clinical-root"), "anaphylaxis_jasur"));
        const webglCanvas = page.locator(".medgen-jasur-3d-stage canvas#three-canvas");
        try {
          // Mount is complete when the first real treatment control is attached.
          await page.locator('button[data-id="epi_thigh"]').waitFor({ state: "attached", timeout: 10000 });
          await page.locator(".medgen-jasur-3d-stage canvas#three-canvas").waitFor({ state: "attached", timeout: 10000 });
          assert.equal(await webglCanvas.count(), 1, "Jasur 3D scene must mount one real WebGL canvas");
          assert.equal(await webglCanvas.evaluate(canvas => !!(canvas.getContext("webgl2") || canvas.getContext("webgl"))), true, "WebGL context must be available");
          const expectedPatientModelState = patientGlbPath ? "loaded" : "fallback";
          await page.waitForFunction(expected => document.querySelector(".medgen-jasur-3d-stage")?.dataset.patientModelStatus === expected, expectedPatientModelState, { timeout: 15000 });

        } catch (error) {
          throw new Error("Clinical mount failed. DOM=" + (await page.locator("#clinical-root").innerText()) + " API=" + JSON.stringify(await page.evaluate(() => window.__clinicalApiCalls)) + " pageErrors=" + JSON.stringify(pageErrors));
        }
        await page.waitForFunction(() => !!window.__medgenClinicalTest);
        const cameraBefore = await page.evaluate(() => window.__medgenClinicalTest.cameraState());
        const canvasBounds = await webglCanvas.boundingBox();
        await page.mouse.move(canvasBounds.x + canvasBounds.width * 0.5, canvasBounds.y + canvasBounds.height * 0.5);
        await page.mouse.down();
        await page.mouse.move(canvasBounds.x + canvasBounds.width * 0.63, canvasBounds.y + canvasBounds.height * 0.59, { steps: 5 });
        await page.mouse.up();
        await page.waitForTimeout(180);
        const cameraAfterOrbit = await page.evaluate(() => window.__medgenClinicalTest.cameraState());
        assert.ok(Math.abs(cameraBefore.x - cameraAfterOrbit.x) + Math.abs(cameraBefore.y - cameraAfterOrbit.y) + Math.abs(cameraBefore.z - cameraAfterOrbit.z) > 0.01, "dragging the 3D canvas must orbit the camera");
        await page.mouse.move(canvasBounds.x + canvasBounds.width * 0.5, canvasBounds.y + canvasBounds.height * 0.5);
        await page.mouse.wheel(0, -320);
        await page.waitForTimeout(450);
        const cameraAfterZoom = await page.evaluate(() => window.__medgenClinicalTest.cameraState());
        assert.ok(Math.abs(cameraAfterOrbit.distance - cameraAfterZoom.distance) > 0.01, "scrolling the 3D canvas must zoom the camera; before=" + JSON.stringify(cameraAfterOrbit) + " after=" + JSON.stringify(cameraAfterZoom));
        await page.evaluate(() => window.__medgenClinicalTest.resetCamera());
        await page.waitForTimeout(180);
        const monitorTap = await page.evaluate(() => {
          const api = window.__medgenClinicalTest;
          const clicked = api.clickZone("monitor");
          return { clicked, result: api.resultText() };
        });
        assert.equal(monitorTap.clicked, true, "3D monitor hotspot must be raycastable");
        assert.match(monitorTap.result, /BEDSIDE MONITOR/);
        if (!patientGlbPath) {
          const epiTap = await page.evaluate(() => {
            const api = window.__medgenClinicalTest;
            return { clicked: api.clickZone("thigh"), accepted: api.hasAction("epi_thigh") };
          });
          assert.deepEqual(epiTap, { clicked: true, accepted: true }, "procedural fallback thigh hotspot must deliver IM adrenaline");
        } else {
          // The imported Quaternius character is validated as a loaded/rendered GLB;
          // anatomy hotspot interaction is covered by the deterministic fallback pass.
          await page.locator('button[data-id="epi_thigh"]').click();
          assert.equal(await page.evaluate(() => window.__medgenClinicalTest.hasAction("epi_thigh")), true);
        }
        const oxygenTap = await page.evaluate(() => {
          const api = window.__medgenClinicalTest;
          return { clicked: api.clickZone("oxygen"), accepted: api.hasAction("oxygen_high") };
        });
        assert.deepEqual(oxygenTap, { clicked: true, accepted: true }, "3D oxygen equipment hotspot must start oxygen; diagnostic=" + JSON.stringify(await page.evaluate(() => window.__medgenClinicalTest.lastClickDiagnostic)));
        const ivTap = await page.evaluate(() => {
          const api = window.__medgenClinicalTest;
          return { clicked: api.clickZone("iv"), accepted: api.hasAction("crystalloid_bolus") };
        });
        assert.deepEqual(ivTap, { clicked: true, accepted: true }, "3D IV equipment hotspot must start crystalloid");
        assert.equal(await page.locator('button[data-id="epi_thigh"]').isDisabled(), true);
        assert.equal(await page.locator('button[data-id="oxygen_high"]').isDisabled(), true);
        assert.equal(await page.locator('button[data-id="crystalloid_bolus"]').isDisabled(), true);
        await page.locator('.fc-v-tab[data-tab="audit"]').click();
        await page.locator(".fc-clinical-log").getByText(/Adrenalin 0.5 mg IM/).waitFor();
        await page.locator('.fc-v-tab[data-tab="handoff"]').click();
        const finishedControl = page.locator("#fc-pane-handoff button").filter({ hasText: "Yakunlash bosqichi ochildi" });
        await finishedControl.waitFor({ state: "visible" });
        assert.equal(await finishedControl.isDisabled(), true, "automatic stabilization must lock the finish control");
        await page.locator('#fc-pane-handoff input[type="radio"]').first().check();
        await page.getByRole("button", { name: "Hisobotni olish" }).click();
        await page.locator(".mg-report-score").filter({ hasText: "92" }).waitFor();
        await page.getByText("Klinik hisobot: " + caseData.title).waitFor();
        const payloads = await page.evaluate(() => window.__clinicalReportPayloads);
        assert.equal(payloads.length, 1, "clinical report must be submitted exactly once");
        assert.equal(payloads[0].case_id, "anaphylaxis_jasur");
        assert.equal(payloads[0].actions.length, 3);
        assert.deepEqual(payloads[0].actions.map(action => action.id), ["epi_thigh", "oxygen_high", "crystalloid_bolus"]);
        assert.equal(Number.isInteger(payloads[0].elapsed_seconds), true);
        assert.ok(payloads[0].elapsed_seconds >= 0 && payloads[0].elapsed_seconds <= 180, "elapsed time must stay within the three-minute case limit");
        assert.equal(await page.getByRole("button", { name: "Hisobotni olish" }).count(), 0, "report view must not expose a second submit control");
        assert.equal(await page.locator(".mg-report-stat").count(), 4);
        assert.equal(await page.locator(".mg-report-audit .mg-report-event").count(), 1);
        assert.deepEqual(pageErrors, [], "clinical simulator must not throw browser errors");
        console.log("PASS clinical simulator learner flow " + viewport.width + "px: 3D model, orbit/zoom controls, raycast hotspots, action locking, timeline, diagnosis, authoritative report and SBAR render");
      } finally {
        await context.close();
      }
    }
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exit(1); });
