/* eslint-disable no-console */
/**
 * HEATSHIELD AI - runtime smoke test.
 * Loads every page, collects console/page errors, exercises key interactions.
 *
 * Run: node scripts/smoke.mjs
 */
import { chromium } from "@playwright/test";

const BASE = process.env.BASE_URL || "http://127.0.0.1:5173";
const results = [];
const consoleErrors = [];
let failed = 0;

function check(name, cond, extra = "") {
  const ok = !!cond;
  if (!ok) failed++;
  results.push(`${ok ? "PASS" : "FAIL"}  ${name}${extra ? `  (${extra})` : ""}`);
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${extra ? `  (${extra})` : ""}`);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Waits for the ward polygons to actually render instead of sleeping. */
async function waitForWards(page, timeout = 15000) {
  try {
    await page.locator(".leaflet-interactive").first().waitFor({ state: "attached", timeout });
    await page.waitForFunction(() => document.querySelectorAll(".leaflet-interactive").length > 0, {
      timeout,
    });
    return true;
  } catch {
    return false;
  }
}

async function main() {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });

  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(`console: ${msg.text()}`);
  });
  page.on("pageerror", (err) => consoleErrors.push(`pageerror: ${err.message}`));
  page.on("requestfailed", (req) => consoleErrors.push(`requestfailed: ${req.url()} ${req.failure()?.errorText ?? ""}`));

  // ---- Dashboard (default scenario extreme_heat) ----
  await page.goto(`${BASE}/dashboard`, { waitUntil: "networkidle" });
  check("wards drawn on map", await waitForWards(page), `count=${await page.locator(".leaflet-interactive").count()}`);
  await page.waitForTimeout(1300);
  check("dashboard title", (await page.title()).includes("HEATSHIELD"));
  check("dashboard header", await page.getByText("HeatShield", { exact: false }).first().isVisible());
  check("KPI row renders", await page.getByText("Active Alerts").first().isVisible());
  check("map renders", (await page.locator(".leaflet-container").count()) > 0);

  await page.locator(".leaflet-interactive").first().click({ force: true }).catch(() => {});
  await page.waitForTimeout(1400);
  const detailVisible = await page
    .getByText("Recommended action", { exact: false })
    .first()
    .isVisible()
    .catch(() => false);
  check("ward detail panel opens", detailVisible);

  await page.locator('select[aria-label="Demo scenario"]').selectOption("normal").catch(() => {});
  await page.waitForTimeout(1300);
  const normalShapes = await page.locator(".leaflet-interactive").count();
  check("scenario switch keeps map", normalShapes > 0, `count=${normalShapes}`);

  // ---- Forecast page ----
  await page.goto(`${BASE}/forecast`, { waitUntil: "networkidle" });
  await page.waitForTimeout(900);
  check("forecast page", await page.getByText("5-Day Human Heat Risk Forecast").isVisible());
  check("forecast table", await page.getByText("Human Risk").first().isVisible());
  check("forecast charts", (await page.locator(".recharts-wrapper").count()) >= 2);

  // ---- Thermal engine page ----
  await page.goto(`${BASE}/thermal-engine`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1100);
  check("thermal engine", await page.getByText("Thermal stress metrics").first().isVisible());
  const sliders = page.locator('input[type="range"]');
  check("thermal sliders present", (await sliders.count()) >= 4);
  await sliders.first().fill("45");
  await page.waitForTimeout(900);
  check("thermal recalcs", await page.getByText("Human heat risk", { exact: false }).first().isVisible());

  // ---- AI model page ----
  await page.goto(`${BASE}/ai-model?ward=W07`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1800);
  check("ai model page", await page.getByText("Explainable Heat-Risk Machine Learning").isVisible());
  check("model info metrics", await page.getByText("MAE (score pts)").isVisible());
  check("why this ward section", await page.getByText("WHY IS THIS WARD AT RISK?").isVisible());
  check("driver chart renders", (await page.locator(".recharts-wrapper").count()) > 0);

  // ---- Alerts page ----
  await page.goto(`${BASE}/alerts`, { waitUntil: "networkidle" });
  await page.waitForTimeout(900);
  check("alerts page", await page.getByText("Heat Alerts").first().isVisible());
  check("alert list items", (await page.getByText("View Ward").count()) > 0, `count=${await page.getByText("View Ward").count()}`);

  // ---- Presentation mode ----
  await page.goto(`${BASE}/dashboard`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1000);
  const presBtn = page.locator('button:has-text("Presentation")').first();
  check("presentation button exists", (await presBtn.count()) > 0);
  await presBtn.click({ force: true }).catch(() => {});
  await page.waitForTimeout(700);
  const exitVisible = await page
    .locator('button:has-text("Exit Presentation")')
    .first()
    .isVisible()
    .catch(() => false);
  check("presentation activates", exitVisible);
  await page.locator('button:has-text("Exit Presentation")').first().click({ force: true }).catch(() => {});
  await page.waitForTimeout(500);
  check("presentation exits", await page.locator('button:has-text("Presentation")').first().isVisible());

  // ---- Wards page ----
  await page.goto(`${BASE}/wards`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1200);
  check("ward page map", (await page.locator(".leaflet-container").count()) > 0);
  check("ward detail panel", (await page.locator("h3").count()) > 0);

  // ---- Scenario switch on dashboard ----
  await page.goto(`${BASE}/dashboard`, { waitUntil: "networkidle" });
  await waitForWards(page);
  await page.waitForTimeout(1000);
  await page.locator('select[aria-label="Demo scenario"]').selectOption("extreme_vulnerable").catch(() => {});
  check("scenario extreme_vulnerable map", await waitForWards(page), `count=${await page.locator(".leaflet-interactive").count()}`);
  await page.waitForTimeout(1300);

  // ---- Map camera: full extent on load, zoom only on explicit click ----
  await page.goto(`${BASE}/wards`, { waitUntil: "networkidle" });
  check("wards page polygons", await waitForWards(page));
  await page.waitForTimeout(1200);
  const allFits = await page.evaluate(() => {
    const c = document.querySelector(".leaflet-interactive");
    if (!c) return null;
    const b = c.getBoundingClientRect();
    return { w: Math.round(b.width), h: Math.round(b.height), vw: window.innerWidth };
  });
  // If a single ward filled the viewport it would be roughly the full window
  // width; on load every ward must be framed together, so one polygon should be
  // a small fraction of the viewport.
  check(
    "map shows full ward extent on load",
    !!allFits && allFits.w < allFits.vw * 0.75,
    allFits ? `one polygon ${allFits.w}x${allFits.h} in vw ${allFits.vw}` : "no polygons",
  );

  await page.locator(".leaflet-interactive").first().click({ force: true }).catch(() => {});
  await page.waitForTimeout(1200);
  const afterClick = await page.evaluate(() => {
    const c = document.querySelector(".leaflet-interactive");
    if (!c) return null;
    return Math.round(c.getBoundingClientRect().width);
  });
  check(
    "map zooms in on ward click",
    !!afterClick && afterClick > (allFits?.w ?? 0),
    `before=${allFits?.w} after=${afterClick}`,
  );

  await page.locator('button:has-text("Reset view")').first().click({ force: true }).catch(() => {});
  await page.waitForTimeout(1200);
  const afterReset = await page.evaluate(() => {
    const c = document.querySelector(".leaflet-interactive");
    if (!c) return null;
    return Math.round(c.getBoundingClientRect().width);
  });
  check(
    "reset view returns to full extent",
    !!afterReset && Math.abs(afterReset - (allFits?.w ?? -1)) < 12,
    `overview=${allFits?.w} reset=${afterReset}`,
  );

  // ---- Personal heat risk modal ----
  await page.goto(`${BASE}/dashboard`, { waitUntil: "networkidle" });
  await page.waitForTimeout(900);
  await page.locator('button:has-text("My Heat Risk")').first().click({ force: true });
  await page.waitForTimeout(1500);
  const dlg = page.locator('div[role="dialog"]');
  check("personal modal opens", (await dlg.count()) > 0);
  check("personal modal has age groups", (await dlg.getByText("70 and above").count()) > 0);
  check("personal modal has work types", (await dlg.getByText("Mostly outdoor").count()) > 0);
  check("personal modal has locate button", (await dlg.getByText("Use my current location").count()) > 0);
  check("personal modal states privacy", (await dlg.getByText("never sent to our servers").count()) > 0);

  // No location permission is granted in this browser, so the manual ward
  // fallback must be able to drive the assessment on its own.
  await dlg.locator('select[aria-label="Select your ward"]').selectOption("W07");
  await dlg.getByText("70 and above").first().click();
  await dlg.getByText("Mostly outdoor").first().click();
  await dlg.getByText("Heat-sensitive health condition").first().click();
  await page.waitForTimeout(2200);
  check("personal assessment renders a score", (await dlg.getByText("Your personal heat risk").count()) > 0);
  const personalScore = await dlg.locator("p.text-3xl").first().textContent().catch(() => null);
  check("personal score is numeric", !!personalScore && /\d/.test(personalScore), `score=${personalScore?.trim()}`);
  check("personal guidance rendered", (await dlg.getByText("What to do for you").count()) > 0);
  check("personal red flags rendered", (await dlg.getByText("Get help if you notice").count()) > 0);

  const leaked = await page.evaluate(() => window.localStorage.getItem("heatshield.personal.v1"));
  check("nothing stored before opt-in", leaked === null, leaked ? `stored=${leaked}` : "empty");

  await page.keyboard.press("Escape");
  await page.waitForTimeout(500);
  check("personal modal closes on Escape", (await page.locator('div[role="dialog"]').count()) === 0);

  // ---- API direct checks ----
  const predict = await page.evaluate(async () => {
    const r = await fetch("/api/predict-risk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        temperature: 43, humidity: 60, wind_speed: 4, solar_radiation: 700,
        elderly_density: 0.18, outdoor_worker_density: 0.21, population_density: 0.65,
      }),
    });
    return r.json();
  });
  check("predict-risk API", predict.risk_score > 0 && !!predict.risk_level, `score=${predict.risk_score} level=${predict.risk_level}`);
  check("predict confidence numeric", typeof predict.confidence === "number");

  const thermal = await page.evaluate(async () => {
    const r = await fetch("/api/thermal-stress", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ temperature: 40, humidity: 55, wind_speed: 2.5, solar_radiation: 700 }),
    });
    return r.json();
  });
  check("thermal-stress API", thermal.heat_index > 0 && thermal.wbgt > 0 && thermal.utci > 0);

  // ---- Final report ----
  console.log(`\n================ RESULT: ${failed === 0 ? "ALL PASSED" : failed + " FAILED"} ================`);
  console.log(`Console/page errors captured: ${consoleErrors.length}`);
  const unique = [...new Set(consoleErrors)];
  if (unique.length) {
    console.log("--- errors (max 15) ---");
    console.log(unique.slice(0, 15).join("\n"));
  }

  await browser.close();
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error("FATAL", e?.message ?? e);
  process.exit(2);
});