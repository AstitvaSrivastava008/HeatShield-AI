/* eslint-disable no-console */
import { chromium } from "@playwright/test";

const BASE = process.env.BASE_URL || "http://127.0.0.1:5173";
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
await page.goto(`${BASE}/dashboard`, { waitUntil: "networkidle" });
await page.waitForTimeout(1600);

const audit = await page.evaluate(() => {
  const out = {};
  const body = document.body;
  out.hScroll = document.documentElement.scrollWidth - document.documentElement.clientWidth;
  out.dashboardScrollable = window.getComputedStyle(document.querySelector("main")).overflowY;
  // sidebar width
  const aside = document.querySelector("aside");
  out.sidebarWidth = aside ? getComputedStyle(aside).width : "no-sidebar";
  // header
  const header = document.querySelector("header");
  out.headerBg = header ? getComputedStyle(header).backgroundColor : "";
  out.headerHeight = header ? getComputedStyle(header).height : "";
  // cards
  const cards = document.querySelectorAll("section.card");
  out.cardCount = cards.length;
  out.cardRadius = cards.length ? getComputedStyle(cards[0]).borderRadius : "";
  // main bg
  out.bodyBg = getComputedStyle(body).backgroundColor;
  // body text color
  out.bodyColor = getComputedStyle(body).color;
  // fonts
  out.fontFamily = getComputedStyle(body).fontFamily.split(",")[0];
  // map
  const map = document.querySelector(".leaflet-container");
  out.mapHeight = map ? getComputedStyle(map).height : "";
  out.mapBg = map ? getComputedStyle(map).backgroundImage.slice(0, 60) : "";
  // KPI value sizes
  const kpiVal = Array.from(document.querySelectorAll("h3, .text-2xl")).map((e) => getComputedStyle(e).fontSize);
  // presentation button
  const pres = Array.from(document.querySelectorAll("button")).find((b) => b.textContent.includes("Presentation"));
  out.presButton = pres ? pres.textContent.trim() : "missing";
  out.presButtonBg = pres ? getComputedStyle(pres).backgroundColor : "";
  // console-level text contrast rough check: none
  const recharts = document.querySelectorAll(".recharts-wrapper").length;
  out.recharts = recharts;

  // color samples from any element with class text-red-700 / etc
  const redBadge = document.querySelector(".text-red-700");
  out.redBadgeColor = redBadge ? getComputedStyle(redBadge).color : "none";
  return out;
});

console.log(JSON.stringify(audit, null, 2));
await browser.close();