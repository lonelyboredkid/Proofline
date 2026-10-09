// Guards the realism pass: glare/gloss must never hide the screenshot, on any device or color.
// Break caught: an overlay (glare, bezel, hinge) drawn over the screen with too much opacity,
// or a frame whose screen rect drifts off-centre so the screenshot is not where we sample.
import test from "node:test";
import assert from "node:assert/strict";
import { createCanvas, Image } from "canvas";

const { renderMockup, DEVICE_COLORS } = await import(process.env.BUILT || "./studio.built.mjs");

// Solid pure-green "screenshot": any glare tint stays strongly green-dominant.
const shot = (() => {
  const c = createCanvas(400, 800);
  const g = c.getContext("2d");
  g.fillStyle = "#00ff00";
  g.fillRect(0, 0, 400, 800);
  const img = new Image();
  img.src = c.toBuffer("image/png");
  return img;
})();

function render(deviceTypeId, scheme) {
  const out = createCanvas(1080, 1920);
  const ctx = out.getContext("2d");
  renderMockup(ctx, 1080, 1920, {
    slide: { id: "a", img: shot, title: "", subtitle: "", zoom: 1, panX: 0, panY: 0 },
    secondarySlide: null, multiLayout: "single", colors: ["#202020", "#202020"], transparent: false,
    backdropImage: null, backdropBrightness: 100, backdropBlur: 0,
    deviceScheme: DEVICE_COLORS[scheme], deviceTypeId, statusBarStyle: "off",
    captionColor: "light", captionPosition: "top", fontStack: "system-ui, sans-serif",
    paddingFactor: 0.85, orientation: "portrait", tiltDegrees: 0,
  });
  return ctx;
}

for (const device of ["phone", "tablet", "watch", "laptop", "browser"]) {
  for (const scheme of Object.keys(DEVICE_COLORS)) {
    test(`${device} / ${scheme}: screenshot stays visible through the glass`, () => {
      const ctx = render(device, scheme);
      const W = 1080, H = 1920;
      const px = ctx.getImageData(0, 0, W, H).data;
      // Bounding box of the (loosely) green screen area.
      let x0 = W, y0 = H, x1 = 0, y1 = 0;
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        const i = (y * W + x) * 4;
        if (px[i + 1] > 150 && px[i + 1] > px[i] * 2 && px[i + 1] > px[i + 2] * 2) {
          if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
        }
      }
      assert.ok(x1 - x0 > 100 && y1 - y0 > 60, "no screen area found");
      // Corners (inset past the rounded radius) and centre must be nearly pure screenshot green:
      // glare is allowed to tint it, not to wash it out.
      const bw = x1 - x0, bh = y1 - y0;
      const pts = [[0.12, 0.12], [0.88, 0.12], [0.12, 0.88], [0.88, 0.88], [0.5, 0.5]];
      for (const [fx, fy] of pts) {
        const i = (Math.round(y0 + bh * fy) * W + Math.round(x0 + bw * fx)) * 4;
        const [r, g, b] = [px[i], px[i + 1], px[i + 2]];
        assert.ok(g > 215 && r < 40 && b < 40, `point (${fx},${fy}) rgb(${r},${g},${b}) is washed out`);
      }
    });
  }
}
