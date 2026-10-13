// Mounts the real <ProoflineStudio/> in Chromium (needs: node tests/build.mjs).
import test, { before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { chromium } from "playwright-core";

const ORIGIN = "http://app.test";
const appJs = fs.readFileSync(new URL("./app.iife.js", import.meta.url), "utf8");
const PNG1 = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");
let browser, ctx, page;

const open = async () => {
  page = await ctx.newPage();
  await page.route(`${ORIGIN}/**`, (r) => {
    const u = new URL(r.request().url());
    if (u.pathname === "/app.js") return r.fulfill({ contentType: "text/javascript", body: appJs });
    return r.fulfill({ contentType: "text/html", body: '<div id="root"></div><script src="/app.js"></script>' });
  });
  // A third-party photo host that no longer serves the saved URL.
  await page.route("http://photos.test/**", (r) => r.abort()); // host unreachable / refuses CORS
  await page.goto(ORIGIN + "/");
  await page.waitForSelector("text=Proofline");
  return page;
};
const addSlides = (n) =>
  page.evaluate(async (n) => {
    const files = [];
    for (let i = 0; i < n; i++) {
      const c = document.createElement("canvas");
      c.width = 300;
      c.height = 650;
      const x = c.getContext("2d");
      x.fillStyle = `hsl(${i * 70},80%,50%)`;
      x.fillRect(0, 0, 300, 650);
      const b = await new Promise((r) => c.toBlob(r));
      files.push(new File([b], `s${i}.png`, { type: "image/png" }));
    }
    const input = document.querySelector("input[type=file][multiple]");
    const dt = new DataTransfer();
    files.forEach((f) => dt.items.add(f));
    input.files = dt.files;
    input.dispatchEvent(new Event("change", { bubbles: true }));
  }, n);
const keys = () => page.evaluate(() => Object.keys(localStorage));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

before(async () => {
  browser = await chromium.launch({ executablePath: process.env.CHROMIUM || "/opt/pw-browsers/chromium-1194/chrome-linux/chrome", args: ["--no-sandbox"] });
});
after(() => browser.close());
beforeEach(async () => {
  if (ctx) await ctx.close();
  ctx = await browser.newContext({ acceptDownloads: true });
});

test("'Device size' and 'Screenshot zoom' are separate sections and there is no bare 'Zoom' section", async () => {
  await open();
  const titles = await page.$$eval("h3", (hs) => hs.map((h) => h.textContent.trim().toLowerCase()));
  assert.ok(titles.includes("device size") && titles.includes("screenshot zoom"), titles.join(","));
  assert.ok(!titles.includes("zoom"));
});

test("undo/redo restores a caption edit and the buttons reflect availability", async () => {
  await open();
  await addSlides(1);
  await sleep(700);
  const head = page.locator('input[placeholder^="Headline"]');
  await head.fill("Hello");
  await sleep(700);
  assert.equal(await page.getByLabel("Undo").isEnabled(), true);
  await page.getByLabel("Undo").click();
  await sleep(100);
  assert.equal(await head.inputValue(), "");
  assert.equal(await page.getByLabel("Redo").isEnabled(), true);
  await page.getByLabel("Redo").click();
  await sleep(100);
  assert.equal(await head.inputValue(), "Hello");
});

test("per-slide device override: marks the thumbnail, leaves global alone, can be reset", async () => {
  await open();
  await addSlides(2);
  await sleep(300);
  await page.getByRole("button", { name: "This slide only" }).click();
  await page.getByRole("button", { name: "Tablet", exact: true }).click();
  await sleep(100);
  assert.equal(await page.getByText("dev", { exact: true }).count(), 1);
  await page.getByRole("button", { name: "All slides" }).click();
  const phoneActive = await page.getByRole("button", { name: "Phone", exact: true }).evaluate((b) => /border-orange/.test(b.className));
  assert.ok(phoneActive, "global device is still Phone");
  await page.getByRole("button", { name: "Reset all to global" }).click();
  await sleep(100);
  assert.equal(await page.getByText("dev", { exact: true }).count(), 0);
});

test("storage: images written once, removed slides' images are deleted, 'Clear saved project' empties everything", async () => {
  await open();
  await addSlides(2);
  await sleep(1500);
  assert.equal((await keys()).filter((k) => k.startsWith("proofline:image:")).length, 2);
  await page.locator('button[title="Remove"]').first().click({ force: true });
  await sleep(1500);
  assert.equal((await keys()).filter((k) => k.startsWith("proofline:image:")).length, 1, "orphaned image was left in storage");
  await page.getByText("Clear saved project").click();
  await sleep(300);
  assert.deepEqual((await keys()).filter((k) => k.startsWith("proofline:") && k !== "proofline:presets"), []);
});

test("reload restores slides and settings", async () => {
  await open();
  await addSlides(2);
  await page.getByRole("button", { name: "1:1" }).click();
  await sleep(1500);
  await page.reload();
  await page.waitForSelector("text=Proofline");
  await sleep(800);
  assert.equal((await page.locator("img").count()) >= 2, true);
  assert.match(await page.locator("p.font-mono").first().textContent(), /1080 × 1080/);
});

test("safe-area guide overlay appears in the preview only", async () => {
  await open();
  await addSlides(1);
  assert.equal(await page.getByTestId("guides").count(), 0);
  await page.getByRole("button", { name: "Safe area" }).click();
  assert.equal(await page.getByTestId("guides").count(), 1);
});

test("App Store size exports a PNG at exactly 1320×2868, ignoring the 2×/3× scale", async () => {
  await open();
  await addSlides(1);
  await sleep(300);
  await page.getByRole("button", { name: "iPhone 6.9″" }).click();
  const [dl] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: /Download PNG/ }).click()]);
  const buf = fs.readFileSync(await dl.path());
  assert.equal(buf.readUInt32BE(16), 1320);
  assert.equal(buf.readUInt32BE(20), 2868);
});

test("restoring a saved remote (Unsplash) background that blocks CORS reports it, and export still works", async () => {
  await open();
  await addSlides(1);
  await sleep(1300);
  await page.evaluate(() => {
    const m = JSON.parse(localStorage.getItem("proofline:manifest"));
    m.backdropSource = "unsplash";
    m.hasBgImage = true;
    localStorage.setItem("proofline:manifest", JSON.stringify(m));
    localStorage.setItem("proofline:bgimage", "http://photos.test/nocors.png");
  });
  await page.reload();
  await page.waitForSelector("text=Proofline");
  await page.waitForSelector("text=couldn't be restored", { timeout: 5000 });
  const [dl] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: /Download PNG/ }).click()]);
  assert.ok(fs.statSync(await dl.path()).size > 100);
});
