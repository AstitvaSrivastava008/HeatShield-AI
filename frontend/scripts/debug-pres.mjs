/* eslint-disable no-console */
import { chromium } from "@playwright/test";

const BASE = process.env.BASE_URL || "http://127.0.0.1:5173";

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
page.on("console", (m) => {
  if (m.type() === "error") console.log("CONSOLE ERR:", m.text());
});
page.on("pageerror", (e) => console.log("PAGE ERR:", e.message));

await page.goto(`${BASE}/dashboard`, { waitUntil: "networkidle" });
await page.waitForTimeout(1200);

console.log("Buttons containing 'Presentation':", await page.locator('button:has-text("Presentation")').count());
const loc = page.locator('button:has-text("Presentation")').first();
console.log("isVisible:", await loc.isVisible().catch((e) => "ERR " + e.message));
console.log("box:", JSON.stringify(await loc.boundingBox()));
await loc.click({ force: true, timeout: 5000 });
await page.waitForTimeout(800);

console.log("After click — buttons containing 'Presentation':", await page.locator('button:has-text("Presentation")').count());
console.log("Buttons containing 'Exit':", await page.locator('button:has-text("Exit")').count());
console.log("Exit visible:", await page.locator('button:has-text("Exit Presentation")').count().catch((e) => "ERR " + e.message));
const header = await page.locator("header").textContent().catch(() => "");
console.log("Header text:", header?.slice(0, 200));
await page.screenshot({ path: "debug-pres.png", fullPage: false });
console.log("screenshot saved");
await browser.close();