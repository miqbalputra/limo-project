/* Render poster HTML -> PNG (untuk review) + JPG (deliverable). */
const path = require("path");
const { chromium } = require("playwright-core");

const DIR = __dirname;
const HTML = "file:///" + path.join(DIR, "update-aplikasi-limo.html").replace(/\\/g, "/");
const PNG = path.join(DIR, "limo-update-client-20261011.png");
const JPG = path.join(DIR, "limo-update-client-20261011.jpg");

(async () => {
  let browser = null;
  for (const channel of ["msedge", "chrome"]) {
    try {
      browser = await chromium.launch({ channel });
      console.log("browser:", channel);
      break;
    } catch (e) {
      console.log(channel, "unavailable:", e.message.split("\n")[0]);
    }
  }
  if (!browser) throw new Error("No Chromium browser available");

  const page = await browser.newPage({
    viewport: { width: 1080, height: 1400 },
    deviceScaleFactor: 2,
  });
  await page.goto(HTML, { waitUntil: "networkidle", timeout: 45000 }).catch(() => {});
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(600);

  const h = await page.evaluate(() => document.querySelector(".canvas").offsetHeight);
  console.log("canvas logical height:", h);

  await page.screenshot({ path: PNG, fullPage: true, type: "png" });
  await page.screenshot({ path: JPG, fullPage: true, type: "jpeg", quality: 90 });
  await browser.close();
  console.log("done:", PNG, "+", JPG);
})();
