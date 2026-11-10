// Browser regression for the complete Medical Academy assessment workflow.
// Uses deterministic local API fixtures; it does not call production services.
"use strict";
const { chromium } = require("playwright");
const assert = require("node:assert/strict");
const path = require("node:path");
const root = path.resolve(__dirname, "..");

const assessmentFixtures = {
  theory: [{ id: "theory-1", title: "Bosh miya nazariyasi", prompt: "Asosiy tuzilmalar", content: "Bosh miya korteksi va uning bo‘limlari haqida to‘liq nazariya matni.", instruction: "Matnni o‘qing va asosiy tushunchalarni izohlang." }],
  puzzle: [{ id: "brain-assembly-v1", title: "Bosh miya qismlarini joylashtiring", instruction: "Har bir tuzilmani mos joyga biriktiring.", parts: [{ id: "frontal", label: "Peshona bo‘lagi" }, { id: "cerebellum", label: "Miyacha" }], slots: [{ value: 0, label: "Oldingi-yuqori" }, { value: 4, label: "Orqa-pastki" }] }],
  practice: [{ id: "practice-1", title: "Anatomik amaliy mashq", prompt: "Tuzilmalarni farqlang", instruction: "Berilgan anatomik tuzilmalarni aniqlang va natijani qayta tekshiring." }],
  quiz: [{ id: "quiz-1", question: "Qaysi tuzilma muvozanatni muvofiqlashtiradi?", options: ["Miyacha", "Ensa bo‘lagi"] }],
  case: [{ id: "case-1", scenario: "Bemor koordinatsiya buzilishi bilan murojaat qildi.", prompt: "Qaysi tuzilmani baholash kerak?", options: ["Miyacha", "Ko‘ruv nervi"] }],
  skills: [{ id: "skill-1", question: "Anatomik ko‘rik ko‘nikmasi", prompt: "Tuzilmani ko‘rsating.", checklist: ["Tuzilmani to‘g‘ri aniqlash", "Natijani aniq qayd etish"] }],
  osce: [{ id: "osce-1", question: "OSCE: bemorni tekshirish", prompt: "Stansiya topshirig‘ini bajaring.", checklist: ["Bemor bilan tanishish", "Tekshiruvni izchil bajarish"] }],
  theory_exam: [{ id: "theory-exam-1", question: "Nazariy imtihon savoli", options: ["To‘g‘ri javob", "Noto‘g‘ri javob"] }],
  practical_exam: [
    { id: "skill-1", question: "Amaliy imtihon: ko‘nikma", checklist: ["Tuzilmani aniqlash", "Natijani qayd etish"] },
    { id: "osce-1", question: "Amaliy imtihon: OSCE", checklist: ["Bemor xavfsizligini ta’minlash"] }
  ],
  exam: [{ id: "exam-1", question: "Yakuniy imtihon savoli", options: ["A javob", "B javob"] }]
};

(async () => {
  const browser = await chromium.launch({
    args: ["--no-sandbox", "--disable-dev-shm-usage", "--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"]
  });
  try {
    for (const viewport of [{ width: 1440, height: 1000 }, { width: 390, height: 844 }]) {
      const context = await browser.newContext({ viewport });
      try {
        const page = await context.newPage();
        const pageErrors = [];
        page.on("pageerror", error => pageErrors.push(error.message));
        await page.addInitScript(({ fixtures }) => {
          window.MEDGEN_API_BASE = "/api/v1";
          window.__academySubmits = [];
          window.fetch = async (url, options = {}) => {
            const path = String(url);
            const method = String(options.method || "GET").toUpperCase();
            let data;
            if (path.endsWith("/academy/dashboard") && method === "GET") {
              data = {
                status: "ok", course: 1, course_title: "1-kurs",
                academic_profile: { university: "Samarkand State Medical University", major: "Davolash ishi", group: "101" },
                subjects: [{ id: "Anatomy", name: "Anatomiya", objective: "Inson tanasi tuzilishi", completed_assessments: ["theory"], complete: false }],
                courses: [{ year: 1, title: "1-kurs — Fundamental fanlar", subjects: [{ id: "Anatomy", name: "Anatomiya", objective: "Inson tanasi tuzilishi" }] }]
              };
            } else if (path.includes("/academy/subject/1/Anatomy") && method === "GET") {
              data = {
                status: "ok", course: 1,
                subject: { id: "Anatomy", name: "Anatomiya", objective: "Inson tanasi tuzilishi" },
                modules: {
                  theory: [{ id: "lesson-1", title: "Bosh miya tuzilishi", content: "Dars kartasida ko‘rinadigan nazariya mazmuni." }],
                  practice: [{ id: "practice-lesson-1", title: "Anatomik mashq", task: "Anatomik tuzilmalarni aniqlash." }],
                  quiz: { count: 1, passing_score: 70 }, case: { count: 1, passing_score: 70 }, exam: { count: 1, passing_score: 70 }
                }
              };
            } else if (path.endsWith("/academy/assessment/start") && method === "POST") {
              const body = JSON.parse(options.body || "{}");
              data = { status: "started", items: fixtures[body.assessment_type] || [], time_limit_minutes: body.assessment_type.includes("exam") ? 60 : null };
            } else if (path.endsWith("/academy/assessment/submit") && method === "POST") {
              const body = JSON.parse(options.body || "{}");
              window.__academySubmits.push(body);
              data = { status: "recorded", score: 85, passed: true, total: 2, progress: { passed: true } };
            } else {
              return new Response(JSON.stringify({ detail: "Unexpected Academy API request: " + method + " " + path }), { status: 404, headers: { "Content-Type": "application/json" } });
            }
            return new Response(JSON.stringify(data), { status: 200, headers: { "Content-Type": "application/json" } });
          };
        }, { fixtures: assessmentFixtures });
        await page.goto("http://127.0.0.1:8080/api/v1/health/live", { waitUntil: "domcontentloaded" });
        await page.setContent('<!doctype html><html lang="uz"><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><main id="studentTool"></main></body></html>');
        await page.addScriptTag({ path: path.join(root, "phase1-academy.js") });
        await page.evaluate(() => window.medgenAcademyV2.render());
        await page.locator('[data-sub="Anatomy"]').click();
        await page.getByText("Dars kartasida ko‘rinadigan nazariya mazmuni.").waitFor();
        assert.match(await page.locator("#academySubjects").innerText(), /Nazariya/);

        const types = ["theory", "practice", "puzzle", "quiz", "case", "skills", "osce", "theory_exam", "practical_exam", "exam"];
        for (const type of types) {
          await page.locator('[data-type="' + type + '"]').click();
          await page.locator("#academyForm").waitFor({ state: "visible" });
          if (type === "theory" || type === "practice") {
            assert.ok(await page.locator("#academyForm [data-completion-check]").count() > 0, type + " must show completion controls");
            await page.locator("#academyForm [data-completion-check]").check();
          } else if (type === "puzzle") {
            const slots = page.locator("#academyForm select[name]");
            assert.equal(await slots.count(), 2, "puzzle must render each anatomical part");
            await slots.nth(0).selectOption("0");
            await slots.nth(1).selectOption("4");
          } else if (["skills", "osce", "practical_exam"].includes(type)) {
            const checks = page.locator('#academyForm input[type="checkbox"]');
            assert.ok(await checks.count() > 0, type + " must render checklist items");
            for (let i = 0; i < await checks.count(); i++) await checks.nth(i).check();
          } else {
            const radios = page.locator('#academyForm input[type="radio"]');
            assert.ok(await radios.count() > 0, type + " must render question options");
            await radios.first().check();
          }
          await page.locator('#academyForm button[type="submit"]').click();
          await page.locator(".academy-result").last().waitFor({ state: "visible" });
          assert.match(await page.locator(".academy-result").last().innerText(), /85%.*O‘TDI/s);
        }

        const submissions = await page.evaluate(() => window.__academySubmits);
        assert.deepEqual(submissions.map(x => x.assessment_type), types);
        assert.equal(submissions.find(x => x.assessment_type === "theory").answers.completion, 1);
        assert.equal(submissions.find(x => x.assessment_type === "practice").answers.completion, 1);
        assert.equal(submissions.find(x => x.assessment_type === "puzzle").answers.frontal, 0);
        assert.equal(submissions.find(x => x.assessment_type === "puzzle").answers.cerebellum, 4);
        assert.equal(submissions.find(x => x.assessment_type === "skills").answers["skill-1:0"], 1);
        assert.equal(submissions.find(x => x.assessment_type === "osce").answers["osce-1:1"], 1);
        assert.equal(submissions.find(x => x.assessment_type === "practical_exam").answers["skill-1:1"], 1);
        assert.deepEqual(pageErrors, [], "Academy assessment workflow must not throw browser errors");
        console.log("PASS Academy workflow " + viewport.width + "px: lesson content, theory, practice, quiz, case, skills, OSCE, theory/practical/final exams and persisted result payloads");
      } finally {
        await context.close();
      }
    }
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exit(1); });
