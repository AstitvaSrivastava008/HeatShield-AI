/* eslint-disable no-console */
import { chromium } from "@playwright/test";

const BASE = process.env.BASE_URL || "http://127.0.0.1:5173";
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });

const pages = [
  ["/dashboard", "shot-dashboard.png"],
  ["/wards", "shot-wards.png"],
  ["/forecast", "shot-forecast.png"],
  ["/thermal-engine", "shot-thermal.png"],
  ["/ai-model?ward=W07", "shot-ai.png"],
  ["/alerts", "shot-alerts.png"],
];

for (const [path, name] of pages) {
  await page.goto(`${BASE}${path}`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1600);
  await page.screenshot({ path: `shots/${name}`, fullPage: false });
  console.log("shot", name);
}

// Presentation mode shot
await page.goto(`${BASE}/dashboard`, { waitUntil: "networkidle" });
await page.waitForTimeout(1200);
await page.locator('button:has-text("Presentation")').first().click({ force: true }).catch(() => {});
await page.waitForTimeout(1800);
await page.screenshot({ path: "shots/shot-presentation.png", fullPage: false });
console.log("shot presentation");
await browser.close();