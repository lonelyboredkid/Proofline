import React, { useState, useRef, useEffect, useCallback } from "react";
import { Upload, Download, Plus, X, Palette, Image as ImageIcon, Copy, ChevronLeft, ChevronRight, Film, Save } from "lucide-react";

/* ============================================================
   PROOFLINE — RENDERING ENGINE
   Pure canvas drawing + layout logic. No React, no DOM events.
   This section is shared verbatim between the Claude.ai artifact
   and the standalone build.
   ============================================================ */

export const PHONE_ASPECT = 1170 / 2532;

export const DEVICE_TYPES = {
  phone: { id: "phone", name: "Phone", aspect: 1170 / 2532, allowOrientation: true, hasStatusBar: true },
  tablet: { id: "tablet", name: "Tablet", aspect: 1640 / 2360, allowOrientation: true, hasStatusBar: true },
  watch: { id: "watch", name: "Watch", aspect: 0.62, allowOrientation: false, hasStatusBar: false },
  laptop: { id: "laptop", name: "Laptop", aspect: 1.55, allowOrientation: false, hasStatusBar: false },
  browser: { id: "browser", name: "Browser", aspect: 1.5, allowOrientation: false, hasStatusBar: false },
};

export const RATIOS = [
  { id: "9:16", w: 1080, h: 1920 },
  { id: "4:5", w: 1080, h: 1350 },
  { id: "1:1", w: 1080, h: 1080 },
  { id: "3:4", w: 1080, h: 1440 },
  { id: "2:3", w: 1080, h: 1620 },
  { id: "4:3", w: 1440, h: 1080 },
  { id: "16:9", w: 1920, h: 1080 },
];

export const SOLID_COLORS = [
  { name: "Mint", color: "#3DBD8C" },
  { name: "Lime", color: "#AEE347" },
  { name: "Terracotta", color: "#8B5E3C" },
  { name: "Sand", color: "#E5C9A3" },
  { name: "Fog", color: "#E8E8E8" },
  { name: "Slate", color: "#9CA0A6" },
  { name: "White", color: "#FFFFFF" },
];

export const BACKDROPS = [
  { name: "Ultramarine", colors: ["#3A5CFF", "#1B2A66"] },
  { name: "Ember", colors: ["#FF6A39", "#C42D0E"] },
  { name: "Seafoam", colors: ["#0FBFA0", "#0A6E63"] },
  { name: "Dusk", colors: ["#6D28D9", "#1E1B4B"] },
  { name: "Blush", colors: ["#FFB6C1", "#FF7A9E"] },
  { name: "Graphite", colors: ["#3F4750", "#15181C"] },
  { name: "Paper", colors: ["#F7F5F0", "#E7E3D9"] },
  { name: "Citrus", colors: ["#FFD23F", "#FF9F1C"] },
  { name: "Ink", colors: ["#0B0F1A", "#05070C"] },
];

export const DEVICE_COLORS = {
  black: { name: "Black", body: "#1c1c1e", edge: "#48484a", button: "#0a0a0a" },
  silver: { name: "Silver", body: "#e3e3e6", edge: "#ffffff", button: "#c7c7cc" },
  gold: { name: "Gold", body: "#e7d5b8", edge: "#f5ead4", button: "#cbb590" },
  blue: { name: "Blue Titanium", body: "#3f4b5b", edge: "#5c6b7f", button: "#2b3440" },
  pink: { name: "Pink", body: "#e8c4c4", edge: "#f5dede", button: "#d1a3a3" },
  graphite: { name: "Graphite", body: "#4a4a4d", edge: "#68686c", button: "#38383a" },
};

export const FONT_CHOICES = {
  system: { name: "System", stack: "system-ui, sans-serif" },
  serif: { name: "Serif", stack: "Georgia, serif" },
  mono: { name: "Mono", stack: "ui-monospace, monospace" },
  rounded: { name: "Rounded", stack: "ui-rounded, system-ui, sans-serif" },
};

export function isHeicFile(file) {
  const name = file && file.name ? String(file.name).toLowerCase() : "";
  const type = file && file.type ? String(file.type).toLowerCase() : "";
  return type === "image/heic" || type === "image/heif" || /\.(heic|heif)$/.test(name);
}

/* ---------- low-level helpers ---------- */

function roundRectPath(ctx, x, y, w, h, r) {
  const rad = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + rad, y);
  ctx.lineTo(x + w - rad, y);
  ctx.arcTo(x + w, y, x + w, y + rad, rad);
  ctx.lineTo(x + w, y + h - rad);
  ctx.arcTo(x + w, y + h, x + w - rad, y + h, rad);
  ctx.lineTo(x + rad, y + h);
  ctx.arcTo(x, y + h, x, y + h - rad, rad);
  ctx.lineTo(x, y + rad);
  ctx.arcTo(x, y, x + rad, y, rad);
  ctx.closePath();
}

function drawImageCover(ctx, img, x, y, w, h, zoom, panX, panY) {
  const z = zoom || 1;
  const px = panX || 0;
  const py = panY || 0;
  const imgRatio = img.width / img.height;
  const boxRatio = w / h;
  let baseDw, baseDh;
  if (imgRatio > boxRatio) {
    baseDh = h;
    baseDw = h * imgRatio;
  } else {
    baseDw = w;
    baseDh = w / imgRatio;
  }
  const dw = baseDw * z;
  const dh = baseDh * z;
  const maxOffsetX = Math.max(0, (dw - w) / 2);
  const maxOffsetY = Math.max(0, (dh - h) / 2);
  const ox = (w - dw) / 2 - px * maxOffsetX;
  const oy = (h - dh) / 2 - py * maxOffsetY;
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  ctx.drawImage(img, x + ox, y + oy, dw, dh);
  ctx.restore();
}

function measureLines(ctx, text, maxWidth) {
  const words = text.split(" ");
  let line = "";
  const lines = [];
  for (const word of words) {
    const test = line ? line + " " + word : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  return lines;
}

/* ---------- iOS-style status bar (phone + tablet) ---------- */

function drawSignalBars(ctx, x, y, size, color) {
  ctx.fillStyle = color;
  const barW = size * 0.16;
  const gap = size * 0.08;
  const heights = [0.38, 0.58, 0.78, 1];
  heights.forEach((f, i) => {
    const h = size * f;
    ctx.fillRect(x + i * (barW + gap), y - h, barW, h);
  });
}

function drawWifiIcon(ctx, x, y, size, color) {
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = size * 0.16;
  ctx.lineCap = "round";
  for (let i = 0; i < 3; i++) {
    const r = size * 0.32 * (i + 1);
    ctx.beginPath();
    ctx.arc(x, y, r, Math.PI * 1.2, Math.PI * 1.8);
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.arc(x, y, size * 0.09, 0, Math.PI * 2);
  ctx.fill();
}

function drawBatteryIcon(ctx, x, y, w, h, color) {
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(w * 0.05, 1.2);
  roundRectPath(ctx, x, y, w, h, h * 0.28);
  ctx.stroke();
  ctx.fillStyle = color;
  const pad = w * 0.12;
  roundRectPath(ctx, x + pad, y + pad, w - pad * 2.4, h - pad * 2, h * 0.15);
  ctx.fill();
  ctx.fillRect(x + w + w * 0.04, y + h * 0.28, w * 0.08, h * 0.44);
}

function drawStatusBar(ctx, sx, sy, sw, isDark) {
  const color = isDark ? "#000000" : "#ffffff";
  const barY = sy + sw * 0.082;
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillStyle = color;
  ctx.font = `600 ${Math.round(sw * 0.05)}px system-ui, sans-serif`;
  ctx.fillText("9:41", sx + sw * 0.075, barY);

  const battW = sw * 0.062;
  const battH = sw * 0.028;
  const battX = sx + sw * 0.925 - battW;
  drawBatteryIcon(ctx, battX, barY - battH / 2, battW, battH, color);

  const wifiX = battX - sw * 0.055;
  drawWifiIcon(ctx, wifiX, barY + sw * 0.01, sw * 0.038, color);

  const sigX = wifiX - sw * 0.075;
  drawSignalBars(ctx, sigX, barY + sw * 0.014, sw * 0.034, color);
}

/* ---------- device frame drawing (one function per device type) ---------- */

function drawPhoneFrame(ctx, rect, img, scheme, statusBarStyle, zoom, panX, panY) {
  const { x, y, w, h } = rect;
  const outerR = w * 0.135;
  const bezel = w * 0.032;

  roundRectPath(ctx, x, y, w, h, outerR);
  const g = ctx.createLinearGradient(x, y, x + w, y + h);
  g.addColorStop(0, scheme.edge);
  g.addColorStop(0.1, scheme.body);
  g.addColorStop(0.5, scheme.body);
  g.addColorStop(0.9, scheme.body);
  g.addColorStop(1, scheme.edge);
  ctx.fillStyle = g;
  ctx.fill();

  const ringInset = bezel * 0.55;
  roundRectPath(ctx, x + ringInset, y + ringInset, w - ringInset * 2, h - ringInset * 2, outerR * 0.85);
  ctx.strokeStyle = "rgba(255,255,255,0.16)";
  ctx.lineWidth = Math.max(w * 0.003, 1);
  ctx.stroke();

  const sx = x + bezel, sy = y + bezel, sw = w - bezel * 2, sh = h - bezel * 2;
  const sr = outerR * 0.72;

  ctx.save();
  roundRectPath(ctx, sx, sy, sw, sh, sr);
  ctx.clip();
  ctx.fillStyle = "#000";
  ctx.fillRect(sx, sy, sw, sh);
  if (img) drawImageCover(ctx, img, sx, sy, sw, sh, zoom, panX, panY);
  if (statusBarStyle && statusBarStyle !== "off") drawStatusBar(ctx, sx, sy, sw, statusBarStyle === "dark");
  ctx.restore();

  const islW = sw * 0.27, islH = sw * 0.072;
  const islX = x + w / 2 - islW / 2, islY = sy + sw * 0.045;
  roundRectPath(ctx, islX, islY, islW, islH, islH / 2);
  ctx.fillStyle = "#000";
  ctx.fill();

  const lensCx = islX + islW - islH * 0.62, lensCy = islY + islH / 2;
  ctx.beginPath();
  ctx.arc(lensCx, lensCy, islH * 0.24, 0, Math.PI * 2);
  ctx.fillStyle = "#0a0a12";
  ctx.fill();
  ctx.beginPath();
  ctx.arc(lensCx - islH * 0.06, lensCy - islH * 0.06, islH * 0.06, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(255,255,255,0.25)";
  ctx.fill();

  ctx.fillStyle = scheme.button;
  const bw = Math.max(w * 0.011, 2);
  const btn = (bx, by, bh) => { roundRectPath(ctx, bx, by, bw, bh, bw / 2); ctx.fill(); };
  btn(x - bw, y + h * 0.108, h * 0.038);
  btn(x - bw, y + h * 0.165, h * 0.062);
  btn(x - bw, y + h * 0.235, h * 0.062);
  btn(x + w, y + h * 0.155, h * 0.09);
}

function drawTabletFrame(ctx, rect, img, scheme, statusBarStyle, zoom, panX, panY) {
  const { x, y, w, h } = rect;
  const outerR = w * 0.09;
  const bezel = w * 0.045;

  roundRectPath(ctx, x, y, w, h, outerR);
  const g = ctx.createLinearGradient(x, y, x + w, y + h);
  g.addColorStop(0, scheme.edge);
  g.addColorStop(0.1, scheme.body);
  g.addColorStop(0.5, scheme.body);
  g.addColorStop(0.9, scheme.body);
  g.addColorStop(1, scheme.edge);
  ctx.fillStyle = g;
  ctx.fill();

  const ringInset = bezel * 0.4;
  roundRectPath(ctx, x + ringInset, y + ringInset, w - ringInset * 2, h - ringInset * 2, outerR * 0.9);
  ctx.strokeStyle = "rgba(255,255,255,0.16)";
  ctx.lineWidth = Math.max(w * 0.003, 1);
  ctx.stroke();

  const sx = x + bezel, sy = y + bezel, sw = w - bezel * 2, sh = h - bezel * 2;
  const sr = outerR * 0.5;

  ctx.save();
  roundRectPath(ctx, sx, sy, sw, sh, sr);
  ctx.clip();
  ctx.fillStyle = "#000";
  ctx.fillRect(sx, sy, sw, sh);
  if (img) drawImageCover(ctx, img, sx, sy, sw, sh, zoom, panX, panY);
  if (statusBarStyle && statusBarStyle !== "off") drawStatusBar(ctx, sx, sy, sw, statusBarStyle === "dark");
  ctx.restore();

  ctx.beginPath();
  ctx.arc(x + w / 2, y + bezel / 2, Math.max(bezel * 0.14, 2), 0, Math.PI * 2);
  ctx.fillStyle = "#0a0a12";
  ctx.fill();

  ctx.fillStyle = scheme.button;
  const bw = Math.max(w * 0.009, 2);
  const btn = (bx, by, bh) => { roundRectPath(ctx, bx, by, bw, bh, bw / 2); ctx.fill(); };
  btn(x - bw, y + h * 0.1, h * 0.05);
  btn(x - bw, y + h * 0.17, h * 0.05);
  btn(x + w, y + h * 0.12, h * 0.04);
}

function drawWatchFrame(ctx, rect, img, scheme, zoom, panX, panY) {
  const { x, y, w, h } = rect;
  const caseH = h * 0.74;
  const caseY = y + (h - caseH) / 2;
  const caseR = w * 0.24;
  const bandW = w * 0.56;
  const bandX = x + (w - bandW) / 2;
  const bandH = (h - caseH) / 2 + h * 0.02;

  ctx.fillStyle = scheme.button;
  roundRectPath(ctx, bandX, y, bandW, bandH, w * 0.06);
  ctx.fill();
  roundRectPath(ctx, bandX, y + h - bandH, bandW, bandH, w * 0.06);
  ctx.fill();

  roundRectPath(ctx, x, caseY, w, caseH, caseR);
  const g = ctx.createLinearGradient(x, caseY, x + w, caseY + caseH);
  g.addColorStop(0, scheme.edge);
  g.addColorStop(0.15, scheme.body);
  g.addColorStop(0.85, scheme.body);
  g.addColorStop(1, scheme.edge);
  ctx.fillStyle = g;
  ctx.fill();

  const bezel = w * 0.065;
  const sx = x + bezel, sy = caseY + bezel, sw = w - bezel * 2, sh = caseH - bezel * 2;
  const sr = caseR * 0.7;

  ctx.save();
  roundRectPath(ctx, sx, sy, sw, sh, sr);
  ctx.clip();
  ctx.fillStyle = "#000";
  ctx.fillRect(sx, sy, sw, sh);
  if (img) drawImageCover(ctx, img, sx, sy, sw, sh, zoom, panX, panY);
  ctx.restore();

  ctx.fillStyle = scheme.button;
  roundRectPath(ctx, x + w - w * 0.01, caseY + caseH * 0.3, w * 0.06, caseH * 0.16, w * 0.02);
  ctx.fill();
  roundRectPath(ctx, x + w - w * 0.01, caseY + caseH * 0.52, w * 0.045, caseH * 0.1, w * 0.015);
  ctx.fill();
}

function drawLaptopFrame(ctx, rect, img, scheme, zoom, panX, panY) {
  const { x, y, w, h } = rect;
  const deckH = h * 0.06;
  const screenH = h - deckH;
  const outerR = w * 0.022;

  roundRectPath(ctx, x, y, w, screenH, outerR);
  ctx.fillStyle = scheme.body;
  ctx.fill();

  const bezel = w * 0.016;
  const sx = x + bezel, sy = y + bezel, sw = w - bezel * 2, sh = screenH - bezel * 2;
  ctx.save();
  roundRectPath(ctx, sx, sy, sw, sh, outerR * 0.6);
  ctx.clip();
  ctx.fillStyle = "#000";
  ctx.fillRect(sx, sy, sw, sh);
  if (img) drawImageCover(ctx, img, sx, sy, sw, sh, zoom, panX, panY);
  ctx.restore();

  ctx.beginPath();
  ctx.arc(x + w / 2, y + bezel * 0.55, Math.max(bezel * 0.2, 2), 0, Math.PI * 2);
  ctx.fillStyle = "#0a0a12";
  ctx.fill();

  const deckW = w * 1.06;
  const deckX = x - (deckW - w) / 2;
  roundRectPath(ctx, deckX, y + screenH, deckW, deckH, deckH * 0.35);
  const dg = ctx.createLinearGradient(deckX, 0, deckX + deckW, 0);
  dg.addColorStop(0, scheme.edge);
  dg.addColorStop(0.5, scheme.body);
  dg.addColorStop(1, scheme.edge);
  ctx.fillStyle = dg;
  ctx.fill();

  roundRectPath(ctx, x + w * 0.43, y + screenH + deckH * 0.28, w * 0.14, deckH * 0.2, deckH * 0.1);
  ctx.fillStyle = "rgba(0,0,0,0.22)";
  ctx.fill();
}

function drawBrowserFrame(ctx, rect, img, scheme, zoom, panX, panY) {
  const { x, y, w, h } = rect;
  const barH = h * 0.09;
  const outerR = w * 0.018;

  roundRectPath(ctx, x, y, w, h, outerR);
  ctx.fillStyle = scheme.body;
  ctx.fill();

  ctx.save();
  roundRectPath(ctx, x, y, w, h, outerR);
  ctx.clip();
  ctx.fillRect(x, y, w, barH);

  const dotR = barH * 0.14;
  const dotY = y + barH / 2;
  ["#ff5f57", "#febc2e", "#28c840"].forEach((c, i) => {
    ctx.beginPath();
    ctx.arc(x + w * 0.025 + i * dotR * 2.6, dotY, dotR, 0, Math.PI * 2);
    ctx.fillStyle = c;
    ctx.fill();
  });

  const sx = x, sy = y + barH, sw = w, sh = h - barH;
  ctx.fillStyle = "#000";
  ctx.fillRect(sx, sy, sw, sh);
  if (img) drawImageCover(ctx, img, sx, sy, sw, sh, zoom, panX, panY);
  ctx.restore();
}

function drawDeviceFrame(ctx, rect, img, scheme, statusBarStyle, zoom, panX, panY, deviceTypeId) {
  switch (deviceTypeId) {
    case "tablet":
      return drawTabletFrame(ctx, rect, img, scheme, statusBarStyle, zoom, panX, panY);
    case "watch":
      return drawWatchFrame(ctx, rect, img, scheme, zoom, panX, panY);
    case "laptop":
      return drawLaptopFrame(ctx, rect, img, scheme, zoom, panX, panY);
    case "browser":
      return drawBrowserFrame(ctx, rect, img, scheme, zoom, panX, panY);
    default:
      return drawPhoneFrame(ctx, rect, img, scheme, statusBarStyle, zoom, panX, panY);
  }
}

/* ---------- shadow + rotation (handles orientation swap AND arbitrary tilt) ---------- */

function drawDeviceShadow(ctx, rect, shapeW, shapeH, cornerRadius, angle) {
  const shortSide = Math.min(rect.w, rect.h);
  const D = shortSide * 0.09;
  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,0.35)";
  ctx.shadowBlur = shortSide * 0.16;
  if (angle) {
    const cx = rect.x + rect.w / 2;
    const cy = rect.y + rect.h / 2;
    ctx.translate(cx, cy);
    ctx.rotate(angle);
    // Compensate so the shadow still falls straight down on screen, regardless
    // of how the shape itself is rotated (shadow offsets are transformed by
    // the current matrix same as everything else, so we counter-rotate here).
    ctx.shadowOffsetX = D * Math.sin(angle);
    ctx.shadowOffsetY = D * Math.cos(angle);
    roundRectPath(ctx, -shapeW / 2, -shapeH / 2, shapeW, shapeH, cornerRadius);
  } else {
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = D;
    roundRectPath(ctx, rect.x, rect.y, rect.w, rect.h, cornerRadius);
  }
  ctx.fillStyle = "rgba(0,0,0,1)";
  ctx.fill();
  ctx.restore();
}

// Draws one device (shadow + frame), handling orientation swap and tilt as a
// single combined rotation. Reused by both the single-device and multi-device
// (fan / side-by-side) layouts.
function drawDeviceWithEffects(ctx, rect, extraTiltRad, orientation, deviceTypeId, img, zoom, panX, panY, deviceScheme, statusBarStyle) {
  const info = DEVICE_TYPES[deviceTypeId] || DEVICE_TYPES.phone;
  const effectiveOrientation = info.allowOrientation ? orientation : "portrait";
  const baseAngle = effectiveOrientation === "landscape" ? -Math.PI / 2 : 0;
  const totalAngle = baseAngle + (extraTiltRad || 0);
  const shortSide = Math.min(rect.w, rect.h);
  const swap = effectiveOrientation === "landscape";
  const shapeW = swap ? rect.h : rect.w;
  const shapeH = swap ? rect.w : rect.h;
  const cornerRadius = shortSide * (deviceTypeId === "watch" ? 0.3 : 0.135);

  drawDeviceShadow(ctx, rect, shapeW, shapeH, cornerRadius, totalAngle);

  if (totalAngle !== 0) {
    const cx = rect.x + rect.w / 2;
    const cy = rect.y + rect.h / 2;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(totalAngle);
    const localRect = { x: -shapeW / 2, y: -shapeH / 2, w: shapeW, h: shapeH };
    drawDeviceFrame(ctx, localRect, img, deviceScheme, statusBarStyle, zoom, panX, panY, deviceTypeId);
    ctx.restore();
  } else {
    drawDeviceFrame(ctx, rect, img, deviceScheme, statusBarStyle, zoom, panX, panY, deviceTypeId);
  }
}

/* ---------- layout: fitting one device into an available box ---------- */

export function computePhoneRect(baseW, baseH, margins, paddingFactor, orientation, deviceAspect) {
  const aspectBase = deviceAspect || PHONE_ASPECT;
  const aspect = orientation === "landscape" ? 1 / aspectBase : aspectBase;
  const availW = baseW - margins.left - margins.right;
  const availH = baseH - margins.top - margins.bottom;
  const maxWByWidth = availW * 0.82;
  const maxWByHeight = availH * aspect;
  const naturalW = Math.min(maxWByWidth, maxWByHeight);
  // paddingFactor is a scale on top of the natural best fit, never beyond it —
  // this guarantees the slider has a visible, proportional effect across its
  // entire range instead of being silently capped by whichever dimension
  // (width or height) happens to be the tighter constraint.
  const phoneW = naturalW * Math.min(paddingFactor, 1);
  const phoneH = phoneW / aspect;
  const x = margins.left + (availW - phoneW) / 2;
  const y = margins.top + (availH - phoneH) / 2;
  return { x, y, w: phoneW, h: phoneH };
}

/* ---------- layout: two devices sharing the available box ---------- */

function computeFanRects(availRect, aspect, paddingFactor) {
  const maxW = availRect.w * 0.66;
  const maxWByH = availRect.h * 0.82 * aspect;
  const naturalW = Math.min(maxW, maxWByH);
  const baseW = naturalW * Math.min(paddingFactor, 1);
  const baseH = baseW / aspect;

  const cx = availRect.x + availRect.w / 2;
  const cy = availRect.y + availRect.h / 2;

  const backW = baseW * 0.85, backH = baseH * 0.85;
  const frontW = baseW, frontH = baseH;

  return {
    back: {
      x: cx - backW / 2 - availRect.w * 0.1,
      y: cy - backH / 2 - availRect.h * 0.04,
      w: backW,
      h: backH,
      tilt: 9 * (Math.PI / 180),
    },
    front: {
      x: cx - frontW / 2 + availRect.w * 0.08,
      y: cy - frontH / 2 + availRect.h * 0.05,
      w: frontW,
      h: frontH,
      tilt: -7 * (Math.PI / 180),
    },
  };
}

function computeSideBySideRects(availRect, aspect, paddingFactor) {
  const gap = availRect.w * 0.05;
  const colW = (availRect.w - gap) / 2;
  const maxWByCol = colW * 0.86;
  const maxWByH = availRect.h * 0.88 * aspect;
  const naturalW = Math.min(maxWByCol, maxWByH);
  const devW = naturalW * Math.min(paddingFactor, 1);
  const devH = devW / aspect;
  const cy = availRect.y + (availRect.h - devH) / 2;

  return {
    left: { x: availRect.x + colW / 2 - devW / 2, y: cy, w: devW, h: devH, tilt: 0 },
    right: { x: availRect.x + colW + gap + colW / 2 - devW / 2, y: cy, w: devW, h: devH, tilt: 0 },
  };
}

/* ---------- background + caption ---------- */

function drawBackground(ctx, w, h, colors) {
  const g = ctx.createLinearGradient(0, 0, w, h);
  g.addColorStop(0, colors[0]);
  g.addColorStop(1, colors[1]);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
}

function drawCaptionScrim(ctx, w, h, position, isDarkText) {
  const scrimH = h * 0.4;
  const shade = isDarkText ? "255,255,255" : "0,0,0";
  if (position === "bottom") {
    const g = ctx.createLinearGradient(0, h - scrimH, 0, h);
    g.addColorStop(0, `rgba(${shade},0)`);
    g.addColorStop(1, `rgba(${shade},0.55)`);
    ctx.fillStyle = g;
    ctx.fillRect(0, h - scrimH, w, scrimH);
  } else {
    const g = ctx.createLinearGradient(0, 0, 0, scrimH);
    g.addColorStop(0, `rgba(${shade},0.55)`);
    g.addColorStop(1, `rgba(${shade},0)`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, scrimH);
  }
}

function drawSideScrim(ctx, w, h, side, isDarkText) {
  const scrimW = w * 0.55;
  const shade = isDarkText ? "255,255,255" : "0,0,0";
  if (side === "left") {
    const g = ctx.createLinearGradient(0, 0, scrimW, 0);
    g.addColorStop(0, `rgba(${shade},0.55)`);
    g.addColorStop(1, `rgba(${shade},0)`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, scrimW, h);
  } else {
    const g = ctx.createLinearGradient(w - scrimW, 0, w, 0);
    g.addColorStop(0, `rgba(${shade},0)`);
    g.addColorStop(1, `rgba(${shade},0.55)`);
    ctx.fillStyle = g;
    ctx.fillRect(w - scrimW, 0, scrimW, h);
  }
}

function drawCaption(ctx, w, h, title, subtitle, isDark, position, fontStack) {
  const color = isDark ? "#15181C" : "#FFFFFF";
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  const font = fontStack || "system-ui, sans-serif";

  const titleSize = Math.round(w * 0.072);
  const titleLineH = w * 0.084;
  const subSize = Math.round(w * 0.038);
  const subLineH = w * 0.05;
  const blockGap = w * 0.045;

  let titleLines = [];
  if (title) {
    ctx.font = `700 ${titleSize}px ${font}`;
    titleLines = measureLines(ctx, title, w * 0.86);
  }
  let subtitleLines = [];
  if (subtitle) {
    ctx.font = `500 ${subSize}px ${font}`;
    subtitleLines = measureLines(ctx, subtitle, w * 0.78);
  }

  const titleBlockH = titleLines.length ? (titleLines.length - 1) * titleLineH : 0;
  const subtitleBlockH = subtitleLines.length ? (subtitleLines.length - 1) * subLineH : 0;
  const gapH = titleLines.length && subtitleLines.length ? blockGap : 0;
  const totalSpan = titleBlockH + gapH + subtitleBlockH;

  const startY = position === "bottom" ? h * 0.94 - totalSpan : h * 0.105;
  let cursorY = startY;
  let bottomY = startY;

  if (titleLines.length) {
    ctx.font = `700 ${titleSize}px ${font}`;
    ctx.fillStyle = color;
    ctx.globalAlpha = 1;
    titleLines.forEach((l, i) => ctx.fillText(l, w / 2, cursorY + i * titleLineH));
    bottomY = cursorY + titleBlockH;
    cursorY = bottomY + blockGap;
  }
  if (subtitleLines.length) {
    ctx.font = `500 ${subSize}px ${font}`;
    ctx.fillStyle = color;
    ctx.globalAlpha = 0.82;
    subtitleLines.forEach((l, i) => ctx.fillText(l, w / 2, cursorY + i * subLineH));
    bottomY = cursorY + subtitleBlockH;
    ctx.globalAlpha = 1;
  }
  return { top: startY, bottom: bottomY };
}

function drawCaptionSide(ctx, w, h, title, subtitle, isDark, side, fontStack) {
  const color = isDark ? "#15181C" : "#FFFFFF";
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  const font = fontStack || "system-ui, sans-serif";

  const columnW = w * 0.42;
  const cx = side === "left" ? columnW / 2 : w - columnW / 2;
  const maxTextWidth = columnW * 0.8;

  const titleSize = Math.round(columnW * 0.135);
  const titleLineH = columnW * 0.155;
  const subSize = Math.round(columnW * 0.068);
  const subLineH = columnW * 0.09;
  const blockGap = columnW * 0.08;

  let titleLines = [];
  if (title) {
    ctx.font = `700 ${titleSize}px ${font}`;
    titleLines = measureLines(ctx, title, maxTextWidth);
  }
  let subtitleLines = [];
  if (subtitle) {
    ctx.font = `500 ${subSize}px ${font}`;
    subtitleLines = measureLines(ctx, subtitle, maxTextWidth);
  }

  const titleBlockH = titleLines.length ? (titleLines.length - 1) * titleLineH : 0;
  const subtitleBlockH = subtitleLines.length ? (subtitleLines.length - 1) * subLineH : 0;
  const gapH = titleLines.length && subtitleLines.length ? blockGap : 0;
  const totalSpan = titleBlockH + gapH + subtitleBlockH;

  let cursorY = (h - totalSpan) / 2;

  if (titleLines.length) {
    ctx.font = `700 ${titleSize}px ${font}`;
    ctx.fillStyle = color;
    ctx.globalAlpha = 1;
    titleLines.forEach((l, i) => ctx.fillText(l, cx, cursorY + i * titleLineH));
    cursorY = cursorY + titleBlockH + blockGap;
  }
  if (subtitleLines.length) {
    ctx.font = `500 ${subSize}px ${font}`;
    ctx.fillStyle = color;
    ctx.globalAlpha = 0.82;
    subtitleLines.forEach((l, i) => ctx.fillText(l, cx, cursorY + i * subLineH));
    ctx.globalAlpha = 1;
  }
  return columnW;
}

/* ---------- main compositor ---------- */

export function renderMockup(ctx, w, h, opts) {
  const {
    slide,
    secondarySlide,
    multiLayout,
    colors,
    transparent,
    backdropImage,
    backdropBrightness,
    backdropBlur,
    deviceScheme,
    deviceTypeId,
    statusBarStyle,
    captionColor,
    captionPosition,
    fontStack,
    paddingFactor,
    orientation,
    tiltDegrees,
  } = opts;

  ctx.clearRect(0, 0, w, h);

  if (backdropImage) {
    const brightness = backdropBrightness || 100;
    const blur = backdropBlur || 0;
    const filterParts = [];
    if (brightness !== 100) filterParts.push(`brightness(${brightness}%)`);
    if (blur > 0) filterParts.push(`blur(${blur}px)`);
    ctx.save();
    if (filterParts.length && "filter" in ctx) ctx.filter = filterParts.join(" ");
    drawImageCover(ctx, backdropImage, 0, 0, w, h, 1, 0, 0);
    ctx.restore();
  } else if (!transparent) {
    drawBackground(ctx, w, h, colors);
  }

  const title = slide && slide.title ? slide.title.trim() : "";
  const subtitle = slide && slide.subtitle ? slide.subtitle.trim() : "";
  const hasCaption = Boolean(title || subtitle);
  const validPositions = ["top", "bottom", "left", "right"];
  const position = validPositions.includes(captionPosition) ? captionPosition : "top";
  const isSide = position === "left" || position === "right";

  const margins = { top: h * 0.06, bottom: h * 0.06, left: 0, right: 0 };

  if (hasCaption) {
    if (isSide) {
      if (backdropImage) drawSideScrim(ctx, w, h, position, captionColor === "dark");
      const columnW = drawCaptionSide(ctx, w, h, title, subtitle, captionColor === "dark", position, fontStack);
      if (position === "left") margins.left = columnW;
      else margins.right = columnW;
    } else {
      if (backdropImage) drawCaptionScrim(ctx, w, h, position, captionColor === "dark");
      const capRect = drawCaption(ctx, w, h, title, subtitle, captionColor === "dark", position, fontStack);
      if (position === "bottom") margins.bottom = Math.max(h * 0.22, h - capRect.top + h * 0.06);
      else margins.top = Math.max(h * 0.22, capRect.bottom + h * 0.06);
    }
  }

  const deviceInfo = DEVICE_TYPES[deviceTypeId] || DEVICE_TYPES.phone;
  const tiltRad = ((tiltDegrees || 0) * Math.PI) / 180;
  const availRect = {
    x: margins.left,
    y: margins.top,
    w: w - margins.left - margins.right,
    h: h - margins.top - margins.bottom,
  };

  if ((multiLayout === "fan" || multiLayout === "side-by-side") && secondarySlide) {
    const rects =
      multiLayout === "fan"
        ? computeFanRects(availRect, deviceInfo.aspect, paddingFactor)
        : computeSideBySideRects(availRect, deviceInfo.aspect, paddingFactor);
    const order = multiLayout === "fan" ? [rects.back, rects.front] : [rects.left, rects.right];
    const slides = multiLayout === "fan" ? [secondarySlide, slide] : [slide, secondarySlide];
    order.forEach((r, i) => {
      const s = slides[i];
      const img = s ? s.img : null;
      const zoom = s && s.zoom ? s.zoom : 1;
      const panX = s && s.panX ? s.panX : 0;
      const panY = s && s.panY ? s.panY : 0;
      drawDeviceWithEffects(
        ctx,
        { x: r.x, y: r.y, w: r.w, h: r.h },
        (r.tilt || 0) + tiltRad,
        orientation,
        deviceTypeId,
        img,
        zoom,
        panX,
        panY,
        deviceScheme,
        statusBarStyle
      );
    });
    return;
  }

  const rect = computePhoneRect(w, h, margins, paddingFactor, orientation, deviceInfo.aspect);
  const img = slide ? slide.img : null;
  const zoom = slide && slide.zoom ? slide.zoom : 1;
  const panX = slide && slide.panX ? slide.panX : 0;
  const panY = slide && slide.panY ? slide.panY : 0;

  drawDeviceWithEffects(ctx, rect, tiltRad, orientation, deviceTypeId, img, zoom, panX, panY, deviceScheme, statusBarStyle);
}

/* ---------- zip export (STORED, no compression — self-contained, no deps) ---------- */

function crc32(buf) {
  let c;
  const table =
    crc32.table ||
    (crc32.table = (() => {
      const t = [];
      for (let n = 0; n < 256; n++) {
        c = n;
        for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
        t[n] = c;
      }
      return t;
    })());
  let crc = 0 ^ -1;
  for (let i = 0; i < buf.length; i++) crc = (crc >>> 8) ^ table[(crc ^ buf[i]) & 0xff];
  return (crc ^ -1) >>> 0;
}

function dosDateTime(date) {
  const time = (date.getHours() << 11) | (date.getMinutes() << 5) | (date.getSeconds() >> 1);
  const d = ((date.getFullYear() - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate();
  return { time, d };
}

export async function buildZip(files) {
  const encoder = new TextEncoder();
  const chunks = [];
  const central = [];
  let offset = 0;
  const { time, d } = dosDateTime(new Date());

  for (const file of files) {
    const nameBytes = encoder.encode(file.name);
    const data = new Uint8Array(await file.blob.arrayBuffer());
    const crc = crc32(data);

    const localHeader = new DataView(new ArrayBuffer(30));
    localHeader.setUint32(0, 0x04034b50, true);
    localHeader.setUint16(4, 20, true);
    localHeader.setUint16(6, 0, true);
    localHeader.setUint16(8, 0, true);
    localHeader.setUint16(10, time, true);
    localHeader.setUint16(12, d, true);
    localHeader.setUint32(14, crc, true);
    localHeader.setUint32(18, data.length, true);
    localHeader.setUint32(22, data.length, true);
    localHeader.setUint16(26, nameBytes.length, true);
    localHeader.setUint16(28, 0, true);
    chunks.push(new Uint8Array(localHeader.buffer), nameBytes, data);

    const centralHeader = new DataView(new ArrayBuffer(46));
    centralHeader.setUint32(0, 0x02014b50, true);
    centralHeader.setUint16(4, 20, true);
    centralHeader.setUint16(6, 20, true);
    centralHeader.setUint16(8, 0, true);
    centralHeader.setUint16(10, 0, true);
    centralHeader.setUint16(12, time, true);
    centralHeader.setUint16(14, d, true);
    centralHeader.setUint32(16, crc, true);
    centralHeader.setUint32(20, data.length, true);
    centralHeader.setUint32(24, data.length, true);
    centralHeader.setUint16(28, nameBytes.length, true);
    centralHeader.setUint16(30, 0, true);
    centralHeader.setUint16(32, 0, true);
    centralHeader.setUint16(34, 0, true);
    centralHeader.setUint16(36, 0, true);
    centralHeader.setUint32(38, 0, true);
    centralHeader.setUint32(42, offset, true);
    central.push(new Uint8Array(centralHeader.buffer), nameBytes);

    offset += 30 + nameBytes.length + data.length;
  }

  const centralStart = offset;
  let centralSize = 0;
  central.forEach((c) => (centralSize += c.length));

  const end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true);
  end.setUint16(4, 0, true);
  end.setUint16(6, 0, true);
  end.setUint16(8, files.length, true);
  end.setUint16(10, files.length, true);
  end.setUint32(12, centralSize, true);
  end.setUint32(16, centralStart, true);
  end.setUint16(20, 0, true);

  return new Blob([...chunks, ...central, new Uint8Array(end.buffer)], { type: "application/zip" });
}

/* ---------- storage adapter: window.storage (Claude.ai artifact) with a
   localStorage fallback (standalone app) — same code works in both ---------- */

const storage = {
  async get(key) {
    try {
      if (typeof window !== "undefined" && window.storage && window.storage.get) {
        const r = await window.storage.get(key);
        return r ? r.value : null;
      }
    } catch (e) {}
    try {
      if (typeof window !== "undefined" && window.localStorage) return window.localStorage.getItem(key);
    } catch (e) {}
    return null;
  },
  async set(key, value) {
    try {
      if (typeof window !== "undefined" && window.storage && window.storage.set) {
        await window.storage.set(key, value);
        return true;
      }
    } catch (e) {}
    try {
      if (typeof window !== "undefined" && window.localStorage) {
        window.localStorage.setItem(key, value);
        return true;
      }
    } catch (e) {}
    return false;
  },
  async remove(key) {
    try {
      if (typeof window !== "undefined" && window.storage && window.storage.delete) {
        await window.storage.delete(key);
        return true;
      }
    } catch (e) {}
    try {
      if (typeof window !== "undefined" && window.localStorage) {
        window.localStorage.removeItem(key);
        return true;
      }
    } catch (e) {}
    return false;
  },
};

const MANIFEST_KEY = "proofline:manifest";
const IMAGE_KEY_PREFIX = "proofline:image:";
const BGIMAGE_KEY = "proofline:bgimage";

const loadImageFromSrc = (src) =>
  new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });

// External images (Unsplash) need crossOrigin set BEFORE loading, or drawing
// them to canvas taints it and every export (toDataURL/toBlob) throws a
// SecurityError. If the remote host doesn't send CORS headers, this makes
// the load fail cleanly instead — which we can catch and message.
const loadCrossOriginImage = (src) =>
  new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Couldn't load that photo (it may not allow embedding from other sites)."));
    img.src = src;
  });

function Section({ n, title, children }) {
  return (
    <div className="space-y-3 pb-6 border-b border-zinc-800">
      <div className="flex items-center gap-2">
        <span className="font-mono text-xs text-orange-500">{n}</span>
        <h3 className="font-mono text-xs tracking-widest text-zinc-400 uppercase">{title}</h3>
      </div>
      {children}
    </div>
  );
}

const CHECKER_STYLE = {
  backgroundImage:
    "linear-gradient(45deg, #ccc 25%, transparent 25%), linear-gradient(-45deg, #ccc 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #ccc 75%), linear-gradient(-45deg, transparent 75%, #ccc 75%)",
  backgroundSize: "16px 16px",
  backgroundPosition: "0 0, 0 8px, 8px -8px, -8px 0px",
};

const CHECKER_STYLE_SMALL = {
  backgroundImage:
    "linear-gradient(45deg, #999 25%, transparent 25%), linear-gradient(-45deg, #999 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #999 75%), linear-gradient(-45deg, transparent 75%, #999 75%)",
  backgroundSize: "8px 8px",
  backgroundPosition: "0 0, 0 4px, 4px -4px, -4px 0px",
  backgroundColor: "#fff",
};

export default function ProoflineStudio({ heicConverter } = {}) {
  const [slides, setSlides] = useState([]);
  const [activeIdx, setActiveIdx] = useState(0);
  const [ratioId, setRatioId] = useState("9:16");
  const [orientation, setOrientation] = useState("portrait");
  const [tilt, setTilt] = useState(0);
  const [deviceTypeId, setDeviceTypeId] = useState("phone");
  const [multiLayout, setMultiLayout] = useState("single");
  const [backdropSource, setBackdropSource] = useState("color"); // 'color' | 'image' | 'unsplash'
  const [colorMode, setColorMode] = useState("gradient"); // 'none' | 'solid' | 'gradient' — only used when backdropSource === 'color'
  const [gradientIdx, setGradientIdx] = useState(0);
  const [customGradient, setCustomGradient] = useState(["#FF6A39", "#7C3AED"]);
  const [solidIdx, setSolidIdx] = useState(3);
  const [customSolidColor, setCustomSolidColor] = useState("#E5C9A3");
  const [bgImage, setBgImage] = useState(null);
  const [unsplashKey, setUnsplashKey] = useState("");
  const [unsplashKeyDraft, setUnsplashKeyDraft] = useState("");
  const [unsplashQuery, setUnsplashQuery] = useState("");
  const [unsplashResults, setUnsplashResults] = useState([]);
  const [unsplashLoading, setUnsplashLoading] = useState(false);
  const [unsplashError, setUnsplashError] = useState(null);
  const [backdropBrightness, setBackdropBrightness] = useState(100);
  const [backdropBlur, setBackdropBlur] = useState(0);
  const [deviceColorId, setDeviceColorId] = useState("black");
  const [statusBar, setStatusBar] = useState("light");
  const [captionColor, setCaptionColor] = useState("light");
  const [captionPosition, setCaptionPosition] = useState("top");
  const [fontId, setFontId] = useState("system");
  const [padding, setPadding] = useState(1);
  const [exportScale, setExportScale] = useState(2);
  const [isDragging, setIsDragging] = useState(false);
  const [isPanning, setIsPanning] = useState(false);
  const [isZipping, setIsZipping] = useState(false);
  const [isExportingVideo, setIsExportingVideo] = useState(false);
  const [videoProgress, setVideoProgress] = useState(0);
  const [fileError, setFileError] = useState(null);
  const [saveStatus, setSaveStatus] = useState("idle"); // idle | saving | saved
  const [hydrated, setHydrated] = useState(false);

  const canvasRef = useRef(null);
  const fileInputRef = useRef(null);
  const bgFileInputRef = useRef(null);
  const activeIdxRef = useRef(0);
  const dragStateRef = useRef(null);
  const latestPointRef = useRef(null);
  const rafRef = useRef(null);
  const saveTimerRef = useRef(null);

  const activeSlide = slides[activeIdx];
  const ratioObj = RATIOS.find((r) => r.id === ratioId);
  const deviceInfo = DEVICE_TYPES[deviceTypeId] || DEVICE_TYPES.phone;
  const isTransparent = backdropSource === "color" && colorMode === "none";
  const colors =
    backdropSource === "color"
      ? colorMode === "solid"
        ? solidIdx === -1
          ? [customSolidColor, customSolidColor]
          : [SOLID_COLORS[solidIdx].color, SOLID_COLORS[solidIdx].color]
        : gradientIdx === -1
        ? customGradient
        : BACKDROPS[gradientIdx].colors
        : BACKDROPS[0].colors; // sensible fallback if Image/Unsplash is picked before a photo is actually chosen
  const backdropImg = (backdropSource === "image" || backdropSource === "unsplash") && bgImage ? bgImage.img : null;
  const fontStack = (FONT_CHOICES[fontId] || FONT_CHOICES.system).stack;
  const secondarySlide = multiLayout !== "single" && activeSlide ? slides.find((s) => s.id === activeSlide.pairId) || null : null;

  useEffect(() => {
    activeIdxRef.current = activeIdx;
  }, [activeIdx]);

  /* ---------- load saved project on mount ---------- */
  useEffect(() => {
    (async () => {
      try {
        const raw = await storage.get(MANIFEST_KEY);
        if (raw) {
          const m = JSON.parse(raw);
          if (m.ratioId) setRatioId(m.ratioId);
          if (m.orientation) setOrientation(m.orientation);
          if (typeof m.tilt === "number") setTilt(m.tilt);
          if (m.deviceTypeId) setDeviceTypeId(m.deviceTypeId);
          if (m.multiLayout) setMultiLayout(m.multiLayout);
          if (m.backdropSource) setBackdropSource(m.backdropSource);
          if (m.colorMode) setColorMode(m.colorMode);
          if (typeof m.gradientIdx === "number") setGradientIdx(m.gradientIdx);
          if (m.customGradient) setCustomGradient(m.customGradient);
          if (typeof m.solidIdx === "number") setSolidIdx(m.solidIdx);
          if (m.customSolidColor) setCustomSolidColor(m.customSolidColor);
          if (m.unsplashKey) setUnsplashKey(m.unsplashKey);
          if (typeof m.backdropBrightness === "number") setBackdropBrightness(m.backdropBrightness);
          if (typeof m.backdropBlur === "number") setBackdropBlur(m.backdropBlur);
          if (m.deviceColorId) setDeviceColorId(m.deviceColorId);
          if (m.statusBar) setStatusBar(m.statusBar);
          if (m.captionColor) setCaptionColor(m.captionColor);
          if (m.captionPosition) setCaptionPosition(m.captionPosition);
          if (m.fontId) setFontId(m.fontId);
          if (typeof m.padding === "number") setPadding(m.padding);
          if (typeof m.exportScale === "number") setExportScale(m.exportScale);

          if (Array.isArray(m.slides) && m.slides.length) {
            const restored = [];
            for (const meta of m.slides) {
              try {
                const src = await storage.get(IMAGE_KEY_PREFIX + meta.id);
                if (src) {
                  const img = await loadImageFromSrc(src);
                  restored.push({ ...meta, img });
                }
              } catch (e) {
                /* skip slides whose image couldn't be restored */
              }
            }
            if (restored.length) setSlides(restored);
          }
          if (m.hasBgImage) {
            try {
              const src = await storage.get(BGIMAGE_KEY);
              if (src) {
                const img = await loadImageFromSrc(src);
                setBgImage({ img, src });
              }
            } catch (e) {}
          }
        }
      } catch (e) {
        /* no saved project, or storage unavailable — start fresh */
      } finally {
        setHydrated(true);
      }
    })();
  }, []);

  /* ---------- debounced autosave ---------- */
  const saveProject = useCallback(async () => {
    setSaveStatus("saving");
    try {
      const manifest = {
        version: 1,
        ratioId,
        orientation,
        tilt,
        deviceTypeId,
        multiLayout,
        backdropSource,
        colorMode,
        gradientIdx,
        customGradient,
        solidIdx,
        customSolidColor,
        unsplashKey,
        backdropBrightness,
        backdropBlur,
        deviceColorId,
        statusBar,
        captionColor,
        captionPosition,
        fontId,
        padding,
        exportScale,
        hasBgImage: Boolean(bgImage),
        slides: slides.map((s) => ({
          id: s.id,
          title: s.title,
          subtitle: s.subtitle,
          zoom: s.zoom,
          panX: s.panX,
          panY: s.panY,
          pairId: s.pairId || null,
        })),
      };
      await storage.set(MANIFEST_KEY, JSON.stringify(manifest));
      for (const s of slides) {
        await storage.set(IMAGE_KEY_PREFIX + s.id, s.img.src);
      }
      if (bgImage) await storage.set(BGIMAGE_KEY, bgImage.src);
      setSaveStatus("saved");
    } catch (e) {
      setSaveStatus("idle");
    }
  }, [
    slides,
    ratioId,
    orientation,
    tilt,
    deviceTypeId,
    multiLayout,
    backdropSource,
    colorMode,
    gradientIdx,
    customGradient,
    solidIdx,
    customSolidColor,
    unsplashKey,
    bgImage,
    backdropBrightness,
    backdropBlur,
    deviceColorId,
    statusBar,
    captionColor,
    captionPosition,
    fontId,
    padding,
    exportScale,
  ]);

  useEffect(() => {
    if (!hydrated) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      saveProject();
    }, 900);
    return () => clearTimeout(saveTimerRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated, saveProject]);

  const clearSavedProject = async () => {
    await storage.remove(MANIFEST_KEY);
    for (const s of slides) await storage.remove(IMAGE_KEY_PREFIX + s.id);
    if (bgImage) await storage.remove(BGIMAGE_KEY);
    setSlides([]);
    setActiveIdx(0);
    setBgImage(null);
    setSaveStatus("idle");
  };

  /* ---------- file loading (JPG/PNG native, HEIC via optional converter) ---------- */
  const loadImage = (file) =>
    new Promise((resolve, reject) => {
      (async () => {
        let workingFile = file;
        if (isHeicFile(file)) {
          if (heicConverter) {
            try {
              workingFile = await heicConverter(file);
            } catch (err) {
              reject(new Error(`"${file.name}" is a HEIC photo and couldn't be converted.`));
              return;
            }
          } else {
            reject(
              new Error(
                `"${file.name}" is a HEIC photo, which this in-chat preview can't decode. Convert it to JPG/PNG first, or use the downloadable app, which supports HEIC directly.`
              )
            );
            return;
          }
        } else if (file.type && !file.type.startsWith("image/")) {
          reject(new Error(`"${file.name}" isn't a supported image file.`));
          return;
        }
        const reader = new FileReader();
        reader.onload = (e) => {
          const img = new Image();
          img.onload = () => resolve(img);
          img.onerror = () => reject(new Error(`"${file.name}" couldn't be decoded as an image.`));
          img.src = e.target.result;
        };
        reader.onerror = () => reject(new Error(`"${file.name}" couldn't be read.`));
        reader.readAsDataURL(workingFile);
      })();
    });

  const addFiles = async (fileList) => {
    const files = Array.from(fileList || []);
    if (!files.length) return;
    const startIdx = slides.length;
    const results = await Promise.allSettled(files.map(loadImage));
    const newOnes = [];
    const errors = [];
    results.forEach((r, i) => {
      if (r.status === "fulfilled") {
        newOnes.push({
          id: `${Date.now()}-${i}-${Math.random().toString(36).slice(2, 7)}`,
          img: r.value,
          title: "",
          subtitle: "",
          zoom: 1,
          panX: 0,
          panY: 0,
          pairId: null,
        });
      } else {
        errors.push(r.reason && r.reason.message ? r.reason.message : "Couldn't load a file.");
      }
    });
    if (newOnes.length) {
      setSlides((prev) => [...prev, ...newOnes]);
      setActiveIdx(startIdx);
    }
    setFileError(errors.length ? errors.join(" ") : null);
  };

  const handleBackdropUpload = async (file) => {
    if (!file) return;
    try {
      const img = await loadImage(file);
      setBgImage({ img, src: img.src });
      setBackdropSource("image");
      setFileError(null);
    } catch (err) {
      setFileError((err && err.message) || "Couldn't load that image as a backdrop.");
    }
  };

  /* ---------- Unsplash: search + select (requires the user's own free API key) ---------- */
  const saveUnsplashKey = () => {
    const key = unsplashKeyDraft.trim();
    if (!key) return;
    setUnsplashKey(key);
    setUnsplashKeyDraft("");
  };

  const searchUnsplash = async () => {
    const key = unsplashKey.trim();
    const query = unsplashQuery.trim();
    if (!key || !query || unsplashLoading) return;
    setUnsplashLoading(true);
    setUnsplashError(null);
    try {
      const res = await fetch(
        `https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&per_page=15&orientation=portrait`,
        { headers: { Authorization: `Client-ID ${key}` } }
      );
      if (!res.ok) {
        if (res.status === 401) throw new Error("That Unsplash key was rejected — double-check you copied the Access Key correctly.");
        if (res.status === 403) throw new Error("Unsplash rate limit reached for this key (demo keys allow 50 requests/hour).");
        throw new Error(`Unsplash search failed (${res.status}).`);
      }
      const data = await res.json();
      const results = data && Array.isArray(data.results) ? data.results : [];
      setUnsplashResults(results);
      if (!results.length) setUnsplashError("No results for that search.");
    } catch (e) {
      setUnsplashResults([]);
      setUnsplashError(
        e && e.message === "Failed to fetch"
          ? "Couldn't reach Unsplash from this preview. Try the downloadable app instead."
          : (e && e.message) || "Unsplash search failed."
      );
    } finally {
      setUnsplashLoading(false);
    }
  };

  const selectUnsplashPhoto = async (photo) => {
    try {
      const img = await loadCrossOriginImage(photo.urls.regular);
      setBgImage({
        img,
        src: photo.urls.regular,
        attribution: {
          name: photo.user && photo.user.name,
          userLink: photo.user && photo.user.links && photo.user.links.html,
          photoLink: photo.links && photo.links.html,
        },
      });
      setBackdropSource("unsplash");
      setFileError(null);
      // Unsplash API guidelines require pinging this when a photo is actually used.
      if (photo.links && photo.links.download_location) {
        fetch(`${photo.links.download_location}&client_id=${unsplashKey.trim()}`).catch(() => {});
      }
    } catch (e) {
      setFileError((e && e.message) || "Couldn't load that Unsplash photo.");
    }
  };

  /* ---------- slide management: remove, reorder, duplicate ---------- */
  const removeSlide = (id) => {
    const idx = slides.findIndex((s) => s.id === id);
    if (idx === -1) return;
    const updated = slides.filter((s) => s.id !== id).map((s) => (s.pairId === id ? { ...s, pairId: null } : s));
    setSlides(updated);
    setActiveIdx((curr) => {
      if (updated.length === 0) return 0;
      if (curr >= updated.length) return updated.length - 1;
      return curr;
    });
  };

  const moveSlide = (idx, dir) => {
    const target = idx + dir;
    if (target < 0 || target >= slides.length) return;
    const updated = slides.slice();
    const tmp = updated[idx];
    updated[idx] = updated[target];
    updated[target] = tmp;
    setSlides(updated);
    setActiveIdx((curr) => {
      if (curr === idx) return target;
      if (curr === target) return idx;
      return curr;
    });
  };

  const duplicateSlide = (idx) => {
    const src = slides[idx];
    if (!src) return;
    const clone = { ...src, id: `${Date.now()}-dup-${Math.random().toString(36).slice(2, 7)}`, pairId: null };
    const updated = slides.slice();
    updated.splice(idx + 1, 0, clone);
    setSlides(updated);
    setActiveIdx(idx + 1);
  };

  const updateSlideField = (idx, field, value) => {
    setSlides((prev) => prev.map((s, i) => (i === idx ? { ...s, [field]: value } : s)));
  };

  const updateActiveSlide = (field, value) => {
    updateSlideField(activeIdxRef.current, field, value);
  };

  const applyZoomToAll = () => {
    if (!activeSlide) return;
    const { zoom, panX, panY } = activeSlide;
    setSlides((prev) => prev.map((s) => ({ ...s, zoom, panX, panY })));
  };

  /* ---------- drag-to-pan on the preview canvas ---------- */
  const getPoint = (e) => (e.touches && e.touches[0] ? e.touches[0] : e);

  const handlePointerDown = (e) => {
    if (!activeSlide || (activeSlide.zoom || 1) <= 1) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const box = canvas.getBoundingClientRect();
    const point = getPoint(e);
    dragStateRef.current = {
      startX: point.clientX,
      startY: point.clientY,
      startPanX: activeSlide.panX || 0,
      startPanY: activeSlide.panY || 0,
      width: box.width || 1,
      height: box.height || 1,
    };
    setIsPanning(true);
  };

  useEffect(() => {
    const move = (e) => {
      if (!dragStateRef.current) return;
      if (e.cancelable) e.preventDefault();
      const point = getPoint(e);
      latestPointRef.current = { x: point.clientX, y: point.clientY };
      if (rafRef.current) return;
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = null;
        const ds = dragStateRef.current;
        const lp = latestPointRef.current;
        if (!ds || !lp) return;
        const dx = lp.x - ds.startX;
        const dy = lp.y - ds.startY;
        const nx = ds.startPanX - dx / (ds.width / 2);
        const ny = ds.startPanY - dy / (ds.height / 2);
        updateActiveSlide("panX", Math.max(-1, Math.min(1, nx)));
        updateActiveSlide("panY", Math.max(-1, Math.min(1, ny)));
      });
    };
    const up = () => {
      dragStateRef.current = null;
      setIsPanning(false);
    };
    window.addEventListener("mousemove", move, { passive: false });
    window.addEventListener("mouseup", up);
    window.addEventListener("touchmove", move, { passive: false });
    window.addEventListener("touchend", up);
    return () => {
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", up);
      window.removeEventListener("touchmove", move);
      window.removeEventListener("touchend", up);
    };
  }, []);

  /* ---------- shared render-options builder ---------- */
  const buildRenderOpts = (slide) => ({
    slide,
    secondarySlide,
    multiLayout,
    colors,
    transparent: isTransparent,
    backdropImage: backdropImg,
    backdropBrightness,
    backdropBlur,
    deviceScheme: DEVICE_COLORS[deviceColorId],
    deviceTypeId,
    statusBarStyle: statusBar,
    captionColor,
    captionPosition,
    fontStack,
    paddingFactor: padding,
    orientation,
    tiltDegrees: tilt,
  });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !ratioObj) return;
    canvas.width = ratioObj.w;
    canvas.height = ratioObj.h;
    const ctx = canvas.getContext("2d");
    renderMockup(ctx, ratioObj.w, ratioObj.h, buildRenderOpts(activeSlide));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    activeSlide,
    secondarySlide,
    multiLayout,
    ratioObj,
    colors,
    isTransparent,
    backdropImg,
    backdropBrightness,
    backdropBlur,
    deviceColorId,
    deviceTypeId,
    statusBar,
    captionColor,
    captionPosition,
    fontStack,
    padding,
    orientation,
    tilt,
  ]);

  /* ---------- export: single PNG, all-slides ZIP, all-ratios ZIP, animated WebM ---------- */
  const renderToTempCanvas = (slide, w, h, scale) => {
    const temp = document.createElement("canvas");
    temp.width = w * scale;
    temp.height = h * scale;
    const ctx = temp.getContext("2d");
    ctx.scale(scale, scale);
    renderMockup(ctx, w, h, buildRenderOpts(slide));
    return temp;
  };

  const canvasToBlob = (canvas) => new Promise((resolve) => canvas.toBlob((blob) => resolve(blob), "image/png"));

  const downloadSlide = (slide, idx) => {
    const temp = renderToTempCanvas(slide, ratioObj.w, ratioObj.h, exportScale);
    const link = document.createElement("a");
    link.download = `proofline-${idx + 1}.png`;
    link.href = temp.toDataURL("image/png");
    link.click();
  };

  const handleDownload = () => {
    if (!activeSlide) return;
    downloadSlide(activeSlide, activeIdx);
  };

  const handleDownloadAll = async () => {
    if (!slides.length || isZipping) return;
    setIsZipping(true);
    try {
      const files = [];
      for (let i = 0; i < slides.length; i++) {
        const temp = renderToTempCanvas(slides[i], ratioObj.w, ratioObj.h, exportScale);
        const blob = await canvasToBlob(temp);
        files.push({ name: `proofline-${i + 1}.png`, blob });
      }
      const zipBlob = await buildZip(files);
      const url = URL.createObjectURL(zipBlob);
      const link = document.createElement("a");
      link.download = "proofline-mockups.zip";
      link.href = url;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
    } finally {
      setIsZipping(false);
    }
  };

  const handleExportAllRatios = async () => {
    if (!slides.length || isZipping) return;
    setIsZipping(true);
    try {
      const files = [];
      for (const r of RATIOS) {
        for (let i = 0; i < slides.length; i++) {
          const temp = renderToTempCanvas(slides[i], r.w, r.h, exportScale);
          const blob = await canvasToBlob(temp);
          files.push({ name: `proofline-${r.id.replace(":", "x")}-${i + 1}.png`, blob });
        }
      }
      const zipBlob = await buildZip(files);
      const url = URL.createObjectURL(zipBlob);
      const link = document.createElement("a");
      link.download = "proofline-all-ratios.zip";
      link.href = url;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
    } finally {
      setIsZipping(false);
    }
  };

  const isVideoExportSupported = () =>
    typeof window !== "undefined" &&
    typeof window.MediaRecorder !== "undefined" &&
    typeof HTMLCanvasElement !== "undefined" &&
    typeof HTMLCanvasElement.prototype.captureStream === "function";

  const getBestMimeType = () => {
    const candidates = ["video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm"];
    for (const c of candidates) {
      if (window.MediaRecorder && MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(c)) return c;
    }
    return "video/webm";
  };

  const handleExportVideo = async () => {
    if (!slides.length || isExportingVideo) return;
    if (!isVideoExportSupported()) {
      setFileError(
        "Animated export needs a browser with MediaRecorder + canvas capture support (recent Chrome, Firefox, or Edge). It isn't available in this browser."
      );
      return;
    }
    setIsExportingVideo(true);
    setVideoProgress(0);
    const FPS = 30;
    const HOLD_S = 1.4;
    const TRANS_S = 0.5;
    try {
      const rec = document.createElement("canvas");
      rec.width = ratioObj.w;
      rec.height = ratioObj.h;
      const rctx = rec.getContext("2d");
      const stream = rec.captureStream(FPS);
      const mimeType = getBestMimeType();
      const recorder = new MediaRecorder(stream, { mimeType });
      const chunks = [];
      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size) chunks.push(e.data);
      };
      const stopped = new Promise((resolve) => {
        recorder.onstop = resolve;
      });
      recorder.start();

      if (slides.length === 1) {
        const total = 3.6;
        const start = performance.now();
        await new Promise((resolve) => {
          const tick = () => {
            const elapsed = (performance.now() - start) / 1000;
            const t = Math.min(1, elapsed / total);
            const eased = 1 - Math.pow(1 - t, 2);
            const kb = {
              ...slides[0],
              zoom: 1 + eased * 0.18,
              panX: (slides[0].panX || 0) + eased * 0.15,
              panY: (slides[0].panY || 0) - eased * 0.08,
            };
            renderMockup(rctx, ratioObj.w, ratioObj.h, buildRenderOpts(kb));
            setVideoProgress(Math.round(t * 100));
            if (t < 1) requestAnimationFrame(tick);
            else resolve();
          };
          requestAnimationFrame(tick);
        });
      } else {
        const n = slides.length;
        const total = n * HOLD_S + (n - 1) * TRANS_S;
        const start = performance.now();
        await new Promise((resolve) => {
          const tick = () => {
            const elapsed = (performance.now() - start) / 1000;
            if (elapsed >= total) {
              renderMockup(rctx, ratioObj.w, ratioObj.h, buildRenderOpts(slides[n - 1]));
              setVideoProgress(100);
              resolve();
              return;
            }
            let t = elapsed;
            for (let i = 0; i < n; i++) {
              if (t < HOLD_S) {
                renderMockup(rctx, ratioObj.w, ratioObj.h, buildRenderOpts(slides[i]));
                break;
              }
              t -= HOLD_S;
              if (i < n - 1 && t < TRANS_S) {
                const progress = t / TRANS_S;
                const a = document.createElement("canvas");
                a.width = ratioObj.w;
                a.height = ratioObj.h;
                renderMockup(a.getContext("2d"), ratioObj.w, ratioObj.h, buildRenderOpts(slides[i]));
                const b = document.createElement("canvas");
                b.width = ratioObj.w;
                b.height = ratioObj.h;
                renderMockup(b.getContext("2d"), ratioObj.w, ratioObj.h, buildRenderOpts(slides[i + 1]));
                rctx.clearRect(0, 0, ratioObj.w, ratioObj.h);
                rctx.globalAlpha = 1;
                rctx.drawImage(a, 0, 0);
                rctx.globalAlpha = progress;
                rctx.drawImage(b, 0, 0);
                rctx.globalAlpha = 1;
                break;
              }
              t -= TRANS_S;
            }
            setVideoProgress(Math.round((elapsed / total) * 100));
            requestAnimationFrame(tick);
          };
          requestAnimationFrame(tick);
        });
      }

      recorder.stop();
      await stopped;
      const blob = new Blob(chunks, { type: mimeType.split(";")[0] });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.download = "proofline-demo.webm";
      link.href = url;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
    } catch (e) {
      setFileError("Animated export failed: " + (e && e.message ? e.message : "unknown error"));
    } finally {
      setIsExportingVideo(false);
      setVideoProgress(0);
    }
  };

  const onDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length) addFiles(e.dataTransfer.files);
  };

  const zoomVal = (activeSlide && activeSlide.zoom) || 1;

  return (
    <div className="flex flex-col lg:flex-row w-full min-h-screen bg-stone-200">
      <div
        className="flex-1 flex flex-col items-center justify-center p-6 lg:p-10 relative"
        onDrop={onDrop}
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        style={{
          backgroundImage:
            "linear-gradient(rgba(120,113,108,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(120,113,108,0.08) 1px, transparent 1px)",
          backgroundSize: "24px 24px",
        }}
      >
        {fileError && (
          <div className="mb-4 max-w-md w-full flex items-start gap-2 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-3 py-2">
            <span className="flex-1">{fileError}</span>
            <button onClick={() => setFileError(null)} className="text-red-400 hover:text-red-600 flex-shrink-0">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {slides.length === 0 ? (
          <button
            onClick={() => fileInputRef.current && fileInputRef.current.click()}
            className={`flex flex-col items-center justify-center gap-3 w-64 h-96 rounded-3xl border-2 border-dashed transition-colors ${
              isDragging ? "border-orange-500 bg-orange-50" : "border-stone-400 bg-stone-100"
            }`}
          >
            <Upload className="w-8 h-8 text-stone-400" />
            <span className="font-medium text-stone-600">Drop a screenshot to start</span>
            <span className="text-sm text-stone-400">JPG, PNG, or HEIC</span>
          </button>
        ) : (
          <div className="relative">
            <span className="absolute -top-3 -left-3 w-6 h-6 border-t-2 border-l-2 border-orange-500" />
            <span className="absolute -top-3 -right-3 w-6 h-6 border-t-2 border-r-2 border-orange-500" />
            <span className="absolute -bottom-3 -left-3 w-6 h-6 border-b-2 border-l-2 border-orange-500" />
            <span className="absolute -bottom-3 -right-3 w-6 h-6 border-b-2 border-r-2 border-orange-500" />
            <canvas
              ref={canvasRef}
              onMouseDown={handlePointerDown}
              onTouchStart={handlePointerDown}
              className="rounded-xl shadow-2xl"
              style={{
                width: "min(78vw, 320px)",
                height: "auto",
                display: "block",
                backgroundColor: "#fff",
                cursor: zoomVal > 1 ? (isPanning ? "grabbing" : "grab") : "default",
                touchAction: "none",
                ...(isTransparent ? CHECKER_STYLE : {}),
              }}
            />
          </div>
        )}

        {slides.length > 0 && ratioObj && (
          <p className="font-mono text-xs text-stone-400 mt-4 tracking-wide text-center">
            {ratioObj.w} × {ratioObj.h} · {ratioObj.id} · {deviceInfo.name} · @{exportScale}×{" "}
            {isTransparent ? "· transparent" : ""}
          </p>
        )}

        <div className="flex items-end gap-2 mt-8 max-w-full overflow-x-auto pb-2">
          {slides.map((s, i) => (
            <div key={s.id} className="flex flex-col items-center gap-1 flex-shrink-0">
              <div className="relative group">
                <button
                  onClick={() => setActiveIdx(i)}
                  className={`w-12 h-20 rounded-md overflow-hidden border-2 ${
                    i === activeIdx ? "border-orange-500" : "border-stone-300"
                  }`}
                >
                  <img src={s.img.src} alt="" className="w-full h-full object-cover" />
                </button>
                <div className="absolute -top-1.5 -right-1.5 flex gap-0.5">
                  <button
                    onClick={() => duplicateSlide(i)}
                    title="Duplicate"
                    className="w-4 h-4 rounded-full bg-stone-700 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <Copy className="w-2.5 h-2.5" />
                  </button>
                  <button
                    onClick={() => removeSlide(s.id)}
                    title="Remove"
                    className="w-4 h-4 rounded-full bg-stone-700 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X className="w-2.5 h-2.5" />
                  </button>
                </div>
              </div>
              <div className="flex gap-1">
                <button
                  onClick={() => moveSlide(i, -1)}
                  disabled={i === 0}
                  className="w-4 h-4 flex items-center justify-center text-stone-400 hover:text-orange-500 disabled:opacity-20"
                >
                  <ChevronLeft className="w-3 h-3" />
                </button>
                <button
                  onClick={() => moveSlide(i, 1)}
                  disabled={i === slides.length - 1}
                  className="w-4 h-4 flex items-center justify-center text-stone-400 hover:text-orange-500 disabled:opacity-20"
                >
                  <ChevronRight className="w-3 h-3" />
                </button>
              </div>
            </div>
          ))}
          <button
            onClick={() => fileInputRef.current && fileInputRef.current.click()}
            className="w-12 h-20 flex-shrink-0 rounded-md border-2 border-dashed border-stone-400 flex items-center justify-center text-stone-400 hover:border-orange-500 hover:text-orange-500 transition-colors mb-5"
          >
            <Plus className="w-5 h-5" />
          </button>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,.heic,.heif"
          multiple
          className="hidden"
          onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }}
        />
        <input
          ref={bgFileInputRef}
          type="file"
          accept="image/*,.heic,.heif"
          className="hidden"
          onChange={(e) => { handleBackdropUpload(e.target.files && e.target.files[0]); e.target.value = ""; }}
        />
      </div>

      <div className="w-full lg:w-96 bg-zinc-900 text-zinc-100 p-6 space-y-6 lg:h-screen lg:overflow-y-auto lg:sticky lg:top-0">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="font-mono text-lg tracking-widest text-white uppercase">Proofline</h1>
            <p className="text-sm text-zinc-500 mt-1">Frame screenshots into shippable mockups.</p>
          </div>
          {slides.length > 0 && (
            <span className="font-mono text-xs text-zinc-600 flex-shrink-0 pt-1">
              {saveStatus === "saving" ? "saving…" : saveStatus === "saved" ? "saved" : ""}
            </span>
          )}
        </div>

        <Section n="01" title="Source">
          <button
            onClick={() => fileInputRef.current && fileInputRef.current.click()}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 transition-colors text-sm font-medium"
          >
            <Upload className="w-4 h-4" /> Add screenshots
          </button>
          <p className="text-xs text-zinc-500">Supports JPG, PNG, and HEIC.</p>
          {slides.length > 0 && (
            <button onClick={clearSavedProject} className="text-xs text-zinc-500 hover:text-zinc-300 underline flex items-center gap-1">
              <Save className="w-3 h-3" /> Clear saved project
            </button>
          )}
        </Section>

        <Section n="02" title="Device">
          <div className="grid grid-cols-3 gap-2">
            {Object.values(DEVICE_TYPES).map((d) => (
              <button
                key={d.id}
                onClick={() => setDeviceTypeId(d.id)}
                className={`py-2 rounded-md text-xs border transition-colors ${
                  deviceTypeId === d.id
                    ? "border-orange-500 text-orange-400 bg-zinc-800"
                    : "border-zinc-700 text-zinc-400 hover:border-zinc-600"
                }`}
              >
                {d.name}
              </button>
            ))}
          </div>
        </Section>

        <Section n="03" title="Frame">
          <div className="grid grid-cols-4 gap-2">
            {RATIOS.map((r) => (
              <button
                key={r.id}
                onClick={() => setRatioId(r.id)}
                className={`py-2 rounded-md text-xs font-mono border transition-colors ${
                  ratioId === r.id
                    ? "border-orange-500 text-orange-400 bg-zinc-800"
                    : "border-zinc-700 text-zinc-400 hover:border-zinc-600"
                }`}
              >
                {r.id}
              </button>
            ))}
          </div>
          {deviceInfo.allowOrientation && (
            <div className="grid grid-cols-2 gap-2">
              {["portrait", "landscape"].map((o) => (
                <button
                  key={o}
                  onClick={() => setOrientation(o)}
                  className={`py-2 rounded-md text-xs capitalize border transition-colors ${
                    orientation === o
                      ? "border-orange-500 text-orange-400 bg-zinc-800"
                      : "border-zinc-700 text-zinc-400 hover:border-zinc-600"
                  }`}
                >
                  {o}
                </button>
              ))}
            </div>
          )}
          <div className="flex items-center gap-2 pt-1">
            {Object.entries(DEVICE_COLORS).map(([key, c]) => (
              <button
                key={key}
                onClick={() => setDeviceColorId(key)}
                title={c.name}
                className={`w-7 h-7 rounded-full border-2 transition-colors ${
                  deviceColorId === key ? "border-orange-500" : "border-transparent"
                }`}
                style={{ backgroundColor: c.body }}
              />
            ))}
          </div>
          <div>
            <div className="flex items-center justify-between text-xs text-zinc-400 mb-1">
              <span>Tilt</span>
              <span className="font-mono">{tilt}°</span>
            </div>
            <input type="range" min="-15" max="15" step="1" value={tilt} onChange={(e) => setTilt(parseInt(e.target.value, 10))} className="w-full accent-orange-500" />
          </div>
        </Section>

        <Section n="04" title="Zoom">
          <div>
            <div className="flex items-center justify-between text-xs text-zinc-400 mb-1">
              <span>Device size</span>
              <span className="font-mono">{Math.round(padding * 100)}%</span>
            </div>
            <input type="range" min="0.5" max="1" step="0.05" value={padding} onChange={(e) => setPadding(parseFloat(e.target.value))} className="w-full accent-orange-500" />
          </div>
          <div>
            <div className="flex items-center justify-between text-xs text-zinc-400 mb-1">
              <span>Screenshot zoom</span>
              <span className="font-mono">{zoomVal.toFixed(2)}×</span>
            </div>
            <input
              type="range" min="1" max="2.5" step="0.05" value={zoomVal}
              onChange={(e) => updateActiveSlide("zoom", parseFloat(e.target.value))}
              disabled={!activeSlide}
              className="w-full accent-orange-500 disabled:opacity-40"
            />
          </div>
          {activeSlide && zoomVal > 1 && (
            <div className="flex items-center justify-between flex-wrap gap-1">
              <p className="text-xs text-zinc-500">Drag the preview to reposition.</p>
              <div className="flex gap-3">
                {slides.length > 1 && (
                  <button onClick={applyZoomToAll} className="text-xs text-zinc-400 hover:text-zinc-200 underline">
                    Apply to all
                  </button>
                )}
                <button
                  onClick={() => { updateActiveSlide("zoom", 1); updateActiveSlide("panX", 0); updateActiveSlide("panY", 0); }}
                  className="text-xs text-zinc-400 hover:text-zinc-200 underline"
                >
                  Reset
                </button>
              </div>
            </div>
          )}
        </Section>

        <Section n="05" title="Layout">
          <div className="grid grid-cols-3 gap-2">
            {["single", "fan", "side-by-side"].map((l) => (
              <button
                key={l}
                onClick={() => setMultiLayout(l)}
                className={`py-2 rounded-md text-xs border transition-colors capitalize ${
                  multiLayout === l
                    ? "border-orange-500 text-orange-400 bg-zinc-800"
                    : "border-zinc-700 text-zinc-400 hover:border-zinc-600"
                }`}
              >
                {l === "side-by-side" ? "Side-by-side" : l}
              </button>
            ))}
          </div>
          {multiLayout !== "single" && activeSlide && (
            <div>
              <p className="text-xs text-zinc-500 mb-2">Pair this slide with:</p>
              <div className="flex items-center gap-2 overflow-x-auto pb-1">
                {slides
                  .filter((s) => s.id !== activeSlide.id)
                  .map((s) => (
                    <button
                      key={s.id}
                      onClick={() => updateActiveSlide("pairId", activeSlide.pairId === s.id ? null : s.id)}
                      className={`w-10 h-16 flex-shrink-0 rounded-md overflow-hidden border-2 ${
                        activeSlide.pairId === s.id ? "border-orange-500" : "border-zinc-700"
                      }`}
                    >
                      <img src={s.img.src} alt="" className="w-full h-full object-cover" />
                    </button>
                  ))}
                {slides.length < 2 && <p className="text-xs text-zinc-600">Add another screenshot first.</p>}
              </div>
            </div>
          )}
        </Section>

        <Section n="06" title="Background">
          <div className="grid grid-cols-3 gap-2">
            {[
              { id: "color", label: "Color" },
              { id: "image", label: "Image" },
              { id: "unsplash", label: "Unsplash" },
            ].map((s) => (
              <button
                key={s.id}
                onClick={() => setBackdropSource(s.id)}
                className={`py-2 rounded-md text-xs border transition-colors ${
                  backdropSource === s.id
                    ? "border-orange-500 text-orange-400 bg-zinc-800"
                    : "border-zinc-700 text-zinc-400 hover:border-zinc-600"
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>

          {backdropSource === "color" && (
            <>
              <div className="grid grid-cols-3 gap-2">
                {["none", "solid", "gradient"].map((m) => (
                  <button
                    key={m}
                    onClick={() => setColorMode(m)}
                    className={`py-1.5 rounded-md text-xs capitalize border transition-colors ${
                      colorMode === m ? "border-orange-500 text-orange-400 bg-zinc-800" : "border-zinc-700 text-zinc-400"
                    }`}
                  >
                    {m}
                  </button>
                ))}
              </div>

              {colorMode === "solid" && (
                <>
                  <div className="grid grid-cols-5 gap-2">
                    {SOLID_COLORS.map((c, i) => (
                      <button
                        key={c.name}
                        onClick={() => setSolidIdx(i)}
                        title={c.name}
                        className={`aspect-square rounded-md border-2 transition-colors ${
                          solidIdx === i ? "border-orange-500" : "border-zinc-700"
                        }`}
                        style={{ backgroundColor: c.color }}
                      />
                    ))}
                    <button
                      onClick={() => setSolidIdx(-1)}
                      title="Custom"
                      className={`aspect-square rounded-md border-2 flex items-center justify-center transition-colors ${
                        solidIdx === -1 ? "border-orange-500" : "border-zinc-700"
                      }`}
                      style={{ backgroundColor: customSolidColor }}
                    >
                      <Palette className="w-3.5 h-3.5 text-white mix-blend-difference" />
                    </button>
                  </div>
                  {solidIdx === -1 && (
                    <div className="flex items-center gap-3 pt-1">
                      <input
                        type="color"
                        value={customSolidColor}
                        onChange={(e) => setCustomSolidColor(e.target.value)}
                        className="w-8 h-8 rounded border border-zinc-700 bg-transparent"
                      />
                      <span className="text-xs text-zinc-500">Custom color</span>
                    </div>
                  )}
                </>
              )}

              {colorMode === "gradient" && (
                <>
                  <div className="grid grid-cols-5 gap-2">
                    {BACKDROPS.map((b, i) => (
                      <button
                        key={b.name}
                        onClick={() => setGradientIdx(i)}
                        title={b.name}
                        className={`aspect-square rounded-md border-2 transition-colors ${
                          gradientIdx === i ? "border-orange-500" : "border-transparent"
                        }`}
                        style={{ backgroundImage: `linear-gradient(135deg, ${b.colors[0]}, ${b.colors[1]})` }}
                      />
                    ))}
                    <button
                      onClick={() => setGradientIdx(-1)}
                      title="Custom"
                      className={`aspect-square rounded-md border-2 flex items-center justify-center transition-colors ${
                        gradientIdx === -1 ? "border-orange-500" : "border-zinc-700"
                      }`}
                      style={{ backgroundImage: `linear-gradient(135deg, ${customGradient[0]}, ${customGradient[1]})` }}
                    >
                      <Palette className="w-3.5 h-3.5 text-white" />
                    </button>
                  </div>
                  {gradientIdx === -1 && (
                    <div className="flex items-center gap-3 pt-1">
                      <input type="color" value={customGradient[0]} onChange={(e) => setCustomGradient([e.target.value, customGradient[1]])} className="w-8 h-8 rounded border border-zinc-700 bg-transparent" />
                      <input type="color" value={customGradient[1]} onChange={(e) => setCustomGradient([customGradient[0], e.target.value])} className="w-8 h-8 rounded border border-zinc-700 bg-transparent" />
                      <span className="text-xs text-zinc-500">Custom gradient</span>
                    </div>
                  )}
                </>
              )}

              {colorMode === "none" && (
                <p className="text-xs text-zinc-500">Exports as a transparent PNG — drop it into Figma, Keynote, or a slide.</p>
              )}
            </>
          )}

          {backdropSource === "image" && (
            <button
              onClick={() => bgFileInputRef.current && bgFileInputRef.current.click()}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 transition-colors text-sm font-medium"
            >
              <ImageIcon className="w-4 h-4" /> {bgImage && backdropSource === "image" ? "Change photo" : "Upload photo"}
            </button>
          )}

          {backdropSource === "unsplash" && (
            <>
              {!unsplashKey ? (
                <div className="space-y-2">
                  <p className="text-xs text-zinc-500">
                    Search needs your own free Unsplash Access Key (demo tier: 50 searches/hour, no approval wait).{" "}
                    <a href="https://unsplash.com/developers" target="_blank" rel="noreferrer" className="text-orange-400 underline">
                      Get one free →
                    </a>
                  </p>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Paste Access Key"
                      value={unsplashKeyDraft}
                      onChange={(e) => setUnsplashKeyDraft(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && saveUnsplashKey()}
                      className="flex-1 bg-zinc-800 border border-zinc-700 rounded-md px-3 py-2 text-sm placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                    />
                    <button onClick={saveUnsplashKey} className="px-3 py-2 rounded-md bg-orange-500 hover:bg-orange-400 text-zinc-950 text-sm font-semibold">
                      Save
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Search photos…"
                      value={unsplashQuery}
                      onChange={(e) => setUnsplashQuery(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && searchUnsplash()}
                      className="flex-1 bg-zinc-800 border border-zinc-700 rounded-md px-3 py-2 text-sm placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                    />
                    <button
                      onClick={searchUnsplash}
                      disabled={unsplashLoading}
                      className="px-3 py-2 rounded-md bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-sm disabled:opacity-50"
                    >
                      {unsplashLoading ? "…" : "Search"}
                    </button>
                  </div>
                  {unsplashError && <p className="text-xs text-red-400">{unsplashError}</p>}
                  {unsplashResults.length > 0 && (
                    <div className="grid grid-cols-4 gap-1.5 max-h-40 overflow-y-auto">
                      {unsplashResults.map((p) => (
                        <button
                          key={p.id}
                          onClick={() => selectUnsplashPhoto(p)}
                          title={(p.alt_description || "").slice(0, 60)}
                          className="aspect-square rounded-md overflow-hidden border-2 border-transparent hover:border-orange-500 transition-colors"
                          style={{ backgroundImage: `url(${p.urls.thumb})`, backgroundSize: "cover", backgroundPosition: "center" }}
                        />
                      ))}
                    </div>
                  )}
                  <button onClick={() => { setUnsplashKey(""); setUnsplashResults([]); }} className="text-xs text-zinc-500 hover:text-zinc-300 underline">
                    Change key
                  </button>
                </>
              )}
            </>
          )}

          {(backdropSource === "image" || backdropSource === "unsplash") && bgImage && (
            <>
              {bgImage.attribution && bgImage.attribution.name && (
                <p className="text-xs text-zinc-600">
                  Photo by{" "}
                  <a href={`${bgImage.attribution.userLink}?utm_source=proofline&utm_medium=referral`} target="_blank" rel="noreferrer" className="underline hover:text-zinc-400">
                    {bgImage.attribution.name}
                  </a>{" "}
                  on{" "}
                  <a href="https://unsplash.com/?utm_source=proofline&utm_medium=referral" target="_blank" rel="noreferrer" className="underline hover:text-zinc-400">
                    Unsplash
                  </a>
                </p>
              )}
              <div>
                <div className="flex items-center justify-between text-xs text-zinc-400 mb-1">
                  <span>Brightness</span>
                  <span className="font-mono">{backdropBrightness}%</span>
                </div>
                <input type="range" min="50" max="150" step="5" value={backdropBrightness} onChange={(e) => setBackdropBrightness(parseInt(e.target.value, 10))} className="w-full accent-orange-500" />
              </div>
              <div>
                <div className="flex items-center justify-between text-xs text-zinc-400 mb-1">
                  <span>Blur</span>
                  <span className="font-mono">{backdropBlur}px</span>
                </div>
                <input type="range" min="0" max="20" step="1" value={backdropBlur} onChange={(e) => setBackdropBlur(parseInt(e.target.value, 10))} className="w-full accent-orange-500" />
              </div>
            </>
          )}
        </Section>

        {deviceInfo.hasStatusBar && (
          <Section n="07" title="Status bar">
            <div className="grid grid-cols-3 gap-2">
              {["off", "light", "dark"].map((opt) => (
                <button
                  key={opt}
                  onClick={() => setStatusBar(opt)}
                  className={`py-2 rounded-md text-xs capitalize border transition-colors ${
                    statusBar === opt
                      ? "border-orange-500 text-orange-400 bg-zinc-800"
                      : "border-zinc-700 text-zinc-400 hover:border-zinc-600"
                  }`}
                >
                  {opt}
                </button>
              ))}
            </div>
          </Section>
        )}

        <Section n="08" title="Caption">
          <input
            type="text" placeholder="Headline (optional)"
            value={activeSlide && activeSlide.title ? activeSlide.title : ""}
            onChange={(e) => updateActiveSlide("title", e.target.value)}
            disabled={!activeSlide}
            className="w-full bg-zinc-800 border border-zinc-700 rounded-md px-3 py-2 text-sm placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 disabled:opacity-40"
          />
          <input
            type="text" placeholder="Subheadline (optional)"
            value={activeSlide && activeSlide.subtitle ? activeSlide.subtitle : ""}
            onChange={(e) => updateActiveSlide("subtitle", e.target.value)}
            disabled={!activeSlide}
            className="w-full bg-zinc-800 border border-zinc-700 rounded-md px-3 py-2 text-sm placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 disabled:opacity-40"
          />
          <div className="grid grid-cols-2 gap-2">
            {["top", "bottom", "left", "right"].map((p) => (
              <button
                key={p}
                onClick={() => setCaptionPosition(p)}
                className={`py-1.5 rounded-md text-xs capitalize border transition-colors ${
                  captionPosition === p ? "border-orange-500 text-orange-400 bg-zinc-800" : "border-zinc-700 text-zinc-400"
                }`}
              >
                {p}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            {["light", "dark"].map((opt) => (
              <button
                key={opt}
                onClick={() => setCaptionColor(opt)}
                className={`flex-1 py-1.5 rounded-md text-xs capitalize border transition-colors ${
                  captionColor === opt ? "border-orange-500 text-orange-400 bg-zinc-800" : "border-zinc-700 text-zinc-400"
                }`}
              >
                {opt} text
              </button>
            ))}
          </div>
          <div className="grid grid-cols-4 gap-2">
            {Object.entries(FONT_CHOICES).map(([key, f]) => (
              <button
                key={key}
                onClick={() => setFontId(key)}
                className={`py-1.5 rounded-md text-xs border transition-colors ${
                  fontId === key ? "border-orange-500 text-orange-400 bg-zinc-800" : "border-zinc-700 text-zinc-400"
                }`}
                style={{ fontFamily: f.stack }}
              >
                {f.name}
              </button>
            ))}
          </div>
        </Section>

        <Section n="09" title="Export">
          <div className="flex gap-2">
            {[1, 2, 3].map((s) => (
              <button
                key={s}
                onClick={() => setExportScale(s)}
                className={`flex-1 py-2 rounded-md text-xs font-mono border transition-colors ${
                  exportScale === s ? "border-orange-500 text-orange-400 bg-zinc-800" : "border-zinc-700 text-zinc-400 hover:border-zinc-600"
                }`}
              >
                {s}×
              </button>
            ))}
          </div>
          <button
            onClick={handleDownload}
            disabled={!activeSlide}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-lg bg-orange-500 hover:bg-orange-400 text-zinc-950 font-semibold text-sm transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <Download className="w-4 h-4" /> Download PNG
          </button>
          {slides.length > 1 && (
            <button
              onClick={handleDownloadAll}
              disabled={isZipping}
              className="w-full text-center text-xs text-zinc-400 hover:text-zinc-200 py-1 transition-colors disabled:opacity-50"
            >
              {isZipping ? "Zipping…" : `Download all ${slides.length} as ZIP`}
            </button>
          )}
          {activeSlide && (
            <button
              onClick={handleExportAllRatios}
              disabled={isZipping}
              className="w-full text-center text-xs text-zinc-400 hover:text-zinc-200 py-1 transition-colors disabled:opacity-50"
            >
              {isZipping ? "Zipping…" : `Export all ${RATIOS.length} ratios as ZIP`}
            </button>
          )}
          {activeSlide && (
            <button
              onClick={handleExportVideo}
              disabled={isExportingVideo}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-sm font-medium transition-colors disabled:opacity-50"
            >
              <Film className="w-4 h-4" />
              {isExportingVideo ? `Recording… ${videoProgress}%` : "Export animated WebM"}
            </button>
          )}
          {activeSlide && (
            <div className="flex justify-center pt-1">
              <div className="inline-flex items-center gap-1.5 border border-dashed border-teal-500 rounded-full px-3 py-1 -rotate-3">
                <span className="font-mono text-xs tracking-widest text-teal-400 uppercase">Proof ready</span>
              </div>
            </div>
          )}
        </Section>
      </div>
    </div>
  );
}
