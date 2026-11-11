"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const source = fs.readFileSync("vitals-sim.js", "utf8");

const reportCall = source.indexOf('var rep = await call("/clinical/vitals/report"');
const academyTry = source.indexOf("try {", source.indexOf("var academySyncError = null;"));
const academyCatch = source.indexOf("catch (scoreError)", academyTry);
const renderReport = source.indexOf("showReport(rep);", academyCatch);
const academyFailureNotice = source.indexOf("if (academySyncError)", renderReport);

assert.notEqual(reportCall, -1, "clinical report must be submitted to the backend");
assert.notEqual(academyTry, -1, "academy score synchronization must have its own try block");
assert.notEqual(academyCatch, -1, "academy score synchronization failure must be isolated");
assert.ok(academyCatch > reportCall, "academy score sync must happen after the clinical report is persisted");
assert.ok(renderReport > academyCatch, "authoritative clinical report must render after academy sync failure is caught");
assert.ok(academyFailureNotice > renderReport, "academy sync failure must be shown without hiding the clinical report");
assert.match(source.slice(reportCall, academyFailureNotice), /submit\.disabled = true;\s*submit\.textContent = "Hisobot saqlandi";/,
  "successful clinical report submission must lock the submit button to prevent duplicate quota consumption");

const sbarOverlay = source.match(/epicrisisOverlay = el\("div", "([^"]+)"\);/);
const sbarPaper = source.match(/var paper = el\("section", "([^"]+)"\);/);
assert.ok(sbarOverlay, "SBAR overlay styles must be explicit");
assert.match(sbarOverlay[1], /box-sizing:border-box/, "SBAR overlay must account for padding inside the viewport");
assert.match(sbarOverlay[1], /overflow-y:auto/, "SBAR overlay must scroll vertically on short screens");
assert.ok(sbarPaper, "SBAR paper styles must be explicit");
assert.match(sbarPaper[1], /max-width:100%/, "SBAR paper must not exceed overlay width on narrow phones");
assert.match(sbarPaper[1], /box-sizing:border-box/, "SBAR paper padding must be included in its mobile width");

const reportRenderer = source.slice(source.indexOf("function showReport(r)"));
assert.match(reportRenderer, /r\.score/, "report score must use the server response");
assert.match(reportRenderer, /b\.required_done[\s\S]*b\.required_total/, "required-action count must use server breakdown");
assert.match(reportRenderer, /r\.stabilized_at_s/, "stabilization time must use server response");
assert.match(reportRenderer, /Array\.isArray\(r\.audit\)[\s\S]*\.forEach\(function\(a\)/, "clinical event timeline must render server audit events");
assert.match(reportRenderer, /@media\(max-width:620px\)[\s\S]*grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/,
  "report statistics must collapse to two columns on narrow screens");
const epicrisisRenderer = source.slice(source.indexOf("function showJasurEpicrisis(report)"));
assert.match(epicrisisRenderer, /report && report\.final_vitals \? report\.final_vitals : st/,
  "SBAR final vital signs must prefer server-authoritative values");
assert.match(epicrisisRenderer, /report\.breakdown\.tab_penalty/,
  "SBAR tab penalty must use server-authoritative scoring breakdown");

assert.match(source.slice(academyTry, academyCatch), /academySyncResult\.status !== "saved"/,
  "a null or non-saved Academy response must be reported as a synchronization failure");
assert.match(source.slice(academyCatch, renderReport), /else\s*\{\s*academySyncError = new Error/,
  "missing Academy score service must be reported instead of silently skipped");
process.stdout.write("Clinical report handoff, authoritative data and responsive layout contracts passed.\n");
