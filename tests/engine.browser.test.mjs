// Real-Chromium render tests (needs: node tests/build.mjs first).
import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { chromium } from "playwright-core";

let browser, page;
before(async () => {
  browser = await chromium.launch({ executablePath: process.env.CHROMIUM || "/opt/pw-browsers/chromium-1194/chrome-linux/chrome", args: ["--no-sandbox"] });
  page = await browser.newPage();
  await page.setContent("<body></body>");
  await page.addScriptTag({ content: fs.readFileSync(new URL("./engine.iife.js", import.meta.url), "utf8") });
  await page.evaluate(() => {
    const P = Proofline, W = 540, H = 960;
    const shot = document.createElement("canvas"); shot.width = 600; shot.height = 1300;
    const sx = shot.getContext("2d"); sx.fillStyle = "#ff0000"; sx.fillRect(0, 0, 600, 1300);
    window.T = {
      P, W, H, shot,
      opts: (e = {}) => ({ slide: { img: shot, title: "", subtitle: "", zoom: 1, panX: 0, panY: 0 }, multiLayout: "single", colors: ["#e0e0e0", "#e0e0e0"], transparent: false, backdropImage: null,
        deviceScheme: P.DEVICE_COLORS.black, deviceTypeId: "phone", statusBarStyle: "off", captionColor: "dark", captionPosition: "top", fontStack: "system-ui",
        paddingFactor: 0.6, orientation: "portrait", tiltDegrees: 0, phoneStyle: "island", shadowStrength: 100, reflection: false, ...e }),
      render(scale, e) { const c = document.createElement("canvas"); c.width = W * scale; c.height = H * scale; const x = c.getContext("2d"); x.scale(scale, scale); P.renderMockup(x, W, H, this.opts(e)); return c; },
      px(c, scale, X, Y) { return Array.from(c.getContext("2d").getImageData(Math.round(X * scale), Math.round(Y * scale), 1, 1).data); },
      down(c) { const d = document.createElement("canvas"); d.width = W; d.height = H; const x = d.getContext("2d"); x.drawImage(c, 0, 0, W, H); return x.getImageData(0, 0, W, H).data; },
      diff(a, b) { let s = 0; for (let i = 0; i < a.length; i += 4) s += Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2]); return s / (a.length / 4) / 3; },
    };
  });
});
after(() => browser.close());

test("2×/3× exports match the 1× preview (shadow, tilt, landscape, backdrop blur)", async () => {
  const d = await page.evaluate(() => {
    const t = T, out = {};
    const bg = document.createElement("canvas"); bg.width = 400; bg.height = 400; const b = bg.getContext("2d");
    for (let i = 0; i < 40; i++) { b.fillStyle = i % 2 ? "#fff" : "#000"; b.fillRect(i * 10, 0, 5, 400); }
    const cases = { plain: {}, tilt: { tiltDegrees: 12 }, landscape: { orientation: "landscape", tiltDegrees: 8 }, blur: { backdropImage: bg, backdropBlur: 12 }, shadow200: { shadowStrength: 200 } };
    for (const [n, e] of Object.entries(cases)) { const base = t.down(t.render(1, e)); for (const s of [2, 3]) out[`${n}@${s}`] = t.diff(base, t.down(t.render(s, e))); }
    return out;
  });
  for (const [k, v] of Object.entries(d)) assert.ok(v < 2.5, `${k} differs from 1× by ${v.toFixed(2)}`);
});
test("shadow reaches the same logical distance at 1×, 2× and 3×", async () => {
  const lum = await page.evaluate(() => {
    const t = T, r = t.P.computePhoneRect(t.W, t.H, { top: t.H * 0.06, bottom: t.H * 0.06, left: 0, right: 0 }, 0.6, "portrait", t.P.DEVICE_TYPES.phone.aspect);
    const y = r.y + r.h + 24, x = r.x + r.w / 2;
    return [1, 2, 3].map((s) => t.px(t.render(s), s, x, y)[0]);
  });
  assert.ok(Math.max(...lum) - Math.min(...lum) <= 6, JSON.stringify(lum));
  assert.ok(lum[0] < 215, "there is a visible shadow 24px below the device");
});
test("tilted device shadow falls straight down (symmetric left/right)", async () => {
  const [l, r] = await page.evaluate(() => {
    const t = T, c = t.render(1, { tiltDegrees: 0 });
    const rc = t.P.computePhoneRect(t.W, t.H, { top: t.H * 0.06, bottom: t.H * 0.06, left: 0, right: 0 }, 0.6, "portrait", t.P.DEVICE_TYPES.phone.aspect);
    const y = rc.y + rc.h + 10, cx = rc.x + rc.w / 2, dx = rc.w * 0.25;
    return [t.px(c, 1, cx - dx, y)[0], t.px(c, 1, cx + dx, y)[0]];
  });
  assert.ok(Math.abs(l - r) <= 4, `${l} vs ${r}`);
});
test("screenshot zoom 1×/1.5×/2.5× always covers the screen (no gaps), pan extremes too", async () => {
  const bad = await page.evaluate(() => {
    const t = T, fails = [];
    const rc = t.P.computePhoneRect(t.W, t.H, { top: t.H * 0.06, bottom: t.H * 0.06, left: 0, right: 0 }, 1, "portrait", t.P.DEVICE_TYPES.phone.aspect);
    for (const z of [1, 1.5, 2.5]) for (const [px, py] of [[0, 0], [1, 1], [-1, -1], [1, -1]]) {
      const c = t.render(1, { paddingFactor: 1, shadowStrength: 0, slide: { img: t.shot, title: "", subtitle: "", zoom: z, panX: px, panY: py } });
      // sample the inside of the screen (well clear of bezel/island/rounded corners)
      for (const [fx, fy] of [[0.5, 0.5], [0.15, 0.15], [0.85, 0.15], [0.15, 0.85], [0.85, 0.85], [0.5, 0.92]]) {
        const p = t.px(c, 1, rc.x + rc.w * fx, rc.y + rc.h * fy);
        if (!(p[0] > 200 && p[1] < 60)) fails.push(`z${z} pan(${px},${py}) @${fx},${fy} -> ${p}`);
      }
    }
    return fails;
  });
  assert.deepEqual(bad, []);
});
test("every device type, orientation and layout renders inside the canvas without throwing", async () => {
  const r = await page.evaluate(() => {
    const t = T, errs = [];
    const s2 = { img: t.shot, title: "", subtitle: "", zoom: 1, panX: 0, panY: 0 };
    for (const d of Object.keys(t.P.DEVICE_TYPES)) for (const o of ["portrait", "landscape"]) for (const ml of ["single", "fan", "side-by-side"])
      for (const f of t.P.ALL_FRAMES) try { const c = document.createElement("canvas"); c.width = Math.min(f.w, 800); c.height = Math.round(c.width * f.h / f.w);
        t.P.renderMockup(c.getContext("2d"), c.width, c.height, t.opts({ deviceTypeId: d, orientation: o, multiLayout: ml, secondarySlide: s2, reflection: true, slide: { ...s2, title: "Track *every* habit", subtitle: "Simple" } })); }
      catch (e) { errs.push(`${d}/${o}/${ml}/${f.id}: ${e.message}`); }
    return errs;
  });
  assert.deepEqual(r, []);
});
test("caption highlight pill and colour draw the accent colour", async () => {
  const found = await page.evaluate(() => {
    const t = T, out = {};
    for (const style of ["color", "pill"]) {
      const c = t.render(1, { captionColor: "light", captionAccent: "#00ff00", accentStyle: style, slide: { img: t.shot, title: "*WWWW* WWWW", subtitle: "", zoom: 1, panX: 0, panY: 0 } });
      const d = c.getContext("2d").getImageData(0, 0, t.W, Math.round(t.H * 0.2)).data; let n = 0;
      for (let i = 0; i < d.length; i += 4) if (d[i] < 60 && d[i + 1] > 200 && d[i + 2] < 60) n++;
      out[style] = n;
    }
    return out;
  });
  assert.ok(found.color > 50 && found.pill > found.color, JSON.stringify(found));
});
test("floor reflection paints below the device only when enabled", async () => {
  const d = await page.evaluate(() => {
    const t = T, rc = t.P.computePhoneRect(t.W, t.H, { top: t.H * 0.06, bottom: t.H * 0.06, left: 0, right: 0 }, 0.5, "portrait", t.P.DEVICE_TYPES.phone.aspect);
    const y = rc.y + rc.h + 6, x = rc.x + rc.w / 2;
    return [t.px(t.render(1, { paddingFactor: 0.5, shadowStrength: 0, reflection: false }), 1, x, y)[1], t.px(t.render(1, { paddingFactor: 0.5, shadowStrength: 0, reflection: true }), 1, x, y)[1]];
  });
  assert.ok(d[0] - d[1] > 8, `off=${d[0]} on=${d[1]}`);
});
