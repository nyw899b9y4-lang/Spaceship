// Spectral scan of the 200 m surroundings, drawn full-size on the main stage.
// Look: MRI base layer (high-contrast greyscale, distance rings), a slice band that reveals a
// continuous biodiversity spectrum (vegetation index → indigo … green … yellow) with contour
// lines, a radial sweep tracing structure edges, then the spectrum flows into the building and
// a portal opens into the star cockpit.
"use strict";
(function () {
  const D2R = Math.PI / 180;
  // perceptual "biodiversity" spectrum: sealed/barren → dense vegetation
  const STOPS = [[0, [24, 14, 52]], [0.22, [44, 72, 180]], [0.42, [25, 160, 200]], [0.6, [52, 200, 120]], [0.8, [190, 228, 80]], [1, [255, 246, 170]]];
  function spectrum(t) {
    t = Math.max(0, Math.min(1, t));
    for (let i = 1; i < STOPS.length; i++) if (t <= STOPS[i][0]) {
      const [a, ca] = STOPS[i - 1], [b, cb] = STOPS[i], k = (t - a) / (b - a);
      return ca.map((c, j) => Math.round(c + (cb[j] - c) * k));
    }
    return STOPS[STOPS.length - 1][1];
  }
  const css = (c, a = 1) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;

  // ---- precompute layers from the north-up satellite image ----
  function prepare(res, ring, windows) {
    const src = res.satImage, n = 384;
    const c = document.createElement("canvas"); c.width = n; c.height = n;
    const g = c.getContext("2d"); g.drawImage(src, 0, 0, n, n);
    let d; try { d = g.getImageData(0, 0, n, n).data; } catch (_) { return null; }
    const lum = new Float32Array(n * n), veg = new Float32Array(n * n);
    for (let i = 0; i < n * n; i++) {
      const r = d[i * 4], gg = d[i * 4 + 1], b = d[i * 4 + 2];
      lum[i] = (0.299 * r + 0.587 * gg + 0.114 * b) / 255;
      const v = (2 * gg - r - b) / (r + gg + b + 1);                       // excess-green vegetation index
      veg[i] = Math.max(0, Math.min(1, (v + 0.04) / 0.32)) * (lum[i] < 0.12 ? 0.6 : 1);   // dim in deep shade
    }
    // smooth the vegetation field (box blur, 2 passes) → continuous spectrum
    const blur = (a, r) => {
      const out = new Float32Array(n * n), tmp = new Float32Array(n * n);
      for (let y = 0; y < n; y++) { let s = 0; for (let x = -r; x <= r; x++) s += a[y * n + Math.min(n - 1, Math.max(0, x))];
        for (let x = 0; x < n; x++) { tmp[y * n + x] = s / (2 * r + 1); s += a[y * n + Math.min(n - 1, x + r + 1)] - a[y * n + Math.max(0, x - r)]; } }
      for (let x = 0; x < n; x++) { let s = 0; for (let y = -r; y <= r; y++) s += tmp[Math.min(n - 1, Math.max(0, y)) * n + x];
        for (let y = 0; y < n; y++) { out[y * n + x] = s / (2 * r + 1); s += tmp[Math.min(n - 1, y + r + 1) * n + x] - tmp[Math.max(0, y - r) * n + x]; } }
      return out;
    };
    const vs = blur(blur(veg, 3), 3);
    const R = (200 / res.metresPerPx) * (n / src.width), cx = n / 2;
    const mk = () => { const cv = document.createElement("canvas"); cv.width = n; cv.height = n; return cv; };
    const mri = mk(), heat = mk(), edges = mk(), iso = mk();
    const im = mri.getContext("2d").createImageData(n, n), ih = heat.getContext("2d").createImageData(n, n);
    const ie = edges.getContext("2d").createImageData(n, n), ii = iso.getContext("2d").createImageData(n, n);
    const rowVeg = new Float32Array(n), rowN = new Float32Array(n);
    let vegSum = 0, sealed = 0, cnt = 0;
    for (let y = 1; y < n - 1; y++) for (let x = 1; x < n - 1; x++) {
      const i = y * n + x, k = i * 4, inside = (x - cx) ** 2 + (y - cx) ** 2 <= R * R;
      // MRI base: contrast curve, cool tint
      const l = Math.pow(lum[i], 0.8), m = Math.max(0, Math.min(255, (l - 0.08) * 330));
      im.data[k] = m * 0.86; im.data[k + 1] = m * 0.93; im.data[k + 2] = m; im.data[k + 3] = 255;
      // spectrum
      const col = spectrum(vs[i]);
      ih.data[k] = col[0]; ih.data[k + 1] = col[1]; ih.data[k + 2] = col[2]; ih.data[k + 3] = 205;
      // structure edges (Sobel on luminance)
      const gx = -lum[i - n - 1] - 2 * lum[i - 1] - lum[i + n - 1] + lum[i - n + 1] + 2 * lum[i + 1] + lum[i + n + 1];
      const gy = -lum[i - n - 1] - 2 * lum[i - n] - lum[i - n + 1] + lum[i + n - 1] + 2 * lum[i + n] + lum[i + n + 1];
      const e = Math.min(1, Math.hypot(gx, gy) * 2.2);
      if (e > 0.32) { ie.data[k] = 190; ie.data[k + 1] = 240; ie.data[k + 2] = 255; ie.data[k + 3] = Math.round(e * 200); }
      // iso-lines of vegetation density
      const q = (v) => Math.floor(v * 7);
      if (q(vs[i]) !== q(vs[i + 1]) || q(vs[i]) !== q(vs[i + n])) { ii.data[k] = 255; ii.data[k + 1] = 255; ii.data[k + 2] = 255; ii.data[k + 3] = 120; }
      if (inside) { rowVeg[y] += veg[i]; rowN[y]++; vegSum += veg[i]; if (veg[i] < 0.08 && lum[i] > 0.18) sealed++; cnt++; }
    }
    mri.getContext("2d").putImageData(im, 0, 0); heat.getContext("2d").putImageData(ih, 0, 0);
    edges.getContext("2d").putImageData(ie, 0, 0); iso.getContext("2d").putImageData(ii, 0, 0);
    for (let y = 0; y < n; y++) rowVeg[y] = rowN[y] ? rowVeg[y] / rowN[y] : 0;
    // building outline + windows in image pixels
    const mpp = res.metresPerPx * (src.width / n), c0 = res.center;
    const toPx = (lat, lon) => {
      const x = (lon - c0.lon) * D2R * 6371008.8 * Math.cos(c0.lat * D2R), y = (lat - c0.lat) * D2R * 6371008.8;
      return [cx + x / mpp, cx - y / mpp];
    };
    return { n, R, cx, mri, heat, edges, iso, rowVeg, outline: ring.map(([a, b]) => toPx(a, b)),
             windows: windows.map((w) => toPx(w.lat, w.lon)), greenery: cnt ? vegSum / cnt : 0, sealed: cnt ? sealed / cnt : 0 };
  }

  // circular spectral thumbnail for the composition layer
  function thumbnail(data, size) {
    const c = document.createElement("canvas"); c.width = size; c.height = size;
    const g = c.getContext("2d"), s = size / data.n, R = data.R * s, cx = size / 2;
    g.save(); g.beginPath(); g.arc(cx, cx, R, 0, 2 * Math.PI); g.clip();
    g.drawImage(data.mri, 0, 0, size, size); g.globalAlpha = 0.82; g.drawImage(data.heat, 0, 0, size, size);
    g.globalAlpha = 0.35; g.drawImage(data.iso, 0, 0, size, size); g.globalAlpha = 0.5; g.drawImage(data.edges, 0, 0, size, size);
    g.restore();
    g.strokeStyle = "rgba(255,255,255,.5)"; g.lineWidth = 1; g.beginPath(); g.arc(cx, cx, R, 0, 2 * Math.PI); g.stroke();
    g.strokeStyle = "#ff8ad8"; g.lineWidth = 1.5; g.beginPath();
    data.outline.forEach(([x, y], i) => (i ? g.lineTo(x * s, y * s) : g.moveTo(x * s, y * s))); g.closePath(); g.stroke();
    return c;
  }

  // ---- play the scan on a stage canvas ----
  const ease = (x) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));
  const seg = (t, a, b) => ease((t - a) / (b - a));
  function play(canvas, data, opts = {}) {
    const g = canvas.getContext("2d");
    let raf = 0, t0 = null, stopped = false;
    const labels = opts.labels || [];
    const DUR = 10.6;
    function frame(ts) {
      if (stopped) return;
      if (t0 == null) t0 = ts;
      const t = (ts - t0) / 1000;
      const dpr = Math.min(2, window.devicePixelRatio || 1), r = canvas.getBoundingClientRect();
      if (canvas.width !== Math.round(r.width * dpr)) { canvas.width = Math.round(r.width * dpr); canvas.height = Math.round(r.height * dpr); }
      const W = canvas.width, H = canvas.height, S = Math.min(W, H) * 0.94, s = S / data.n;
      const ox = (W - S) / 2, oy = (H - S) / 2, CX = W / 2, CY = H / 2, R = data.R * s;
      const fadeIn = seg(t, 0, 1.2), slice = Math.max(0, Math.min(1, (t - 1.2) / 4)), sweep = Math.max(0, Math.min(1, (t - 5.2) / 2));
      const conv = seg(t, 7.2, 9.0), portal = seg(t, 9.0, 10.4);
      g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, W, H);
      g.fillStyle = `rgba(3,5,12,${1 - portal * 0})`; g.fillRect(0, 0, W, H);
      // convergence: everything zooms gently into the building
      const bc = data.outline.reduce((a, p) => [a[0] + p[0] / data.outline.length, a[1] + p[1] / data.outline.length], [0, 0]);
      const bx = ox + bc[0] * s, by = oy + bc[1] * s, zoom = 1 + conv * 2.2;
      g.save();
      g.translate(bx, by); g.scale(zoom, zoom); g.translate(-bx, -by);
      g.save(); g.beginPath(); g.arc(CX, CY, R, 0, 2 * Math.PI); g.clip();
      // MRI base with grain
      g.globalAlpha = fadeIn * (1 - conv * 0.7); g.drawImage(data.mri, ox, oy, S, S);
      // slice reveal of the spectrum (+ contour lines)
      const sliceY = oy + (data.cx - data.R + 2 * data.R * slice) * s;
      if (slice > 0) {
        g.save(); g.beginPath(); g.rect(0, 0, W, sliceY); g.clip();
        g.globalAlpha = 0.85 * (1 - conv * 0.4); g.drawImage(data.heat, ox, oy, S, S);
        g.globalAlpha = 0.4 * (1 - conv); g.drawImage(data.iso, ox, oy, S, S);
        g.restore();
      }
      // radial sweep: structure edges
      if (sweep > 0) {
        g.save(); g.beginPath(); g.moveTo(CX, CY); g.arc(CX, CY, R * 1.02, -Math.PI / 2, -Math.PI / 2 + sweep * 2 * Math.PI); g.closePath(); g.clip();
        g.globalAlpha = 0.75 * (1 - conv); g.drawImage(data.edges, ox, oy, S, S); g.restore();
      }
      g.restore();   // circle clip
      // slice band
      if (slice > 0 && slice < 1) {
        const bandH = Math.max(6, S * 0.03), gr = g.createLinearGradient(0, sliceY - bandH, 0, sliceY + bandH * 0.3);
        gr.addColorStop(0, "rgba(140,220,255,0)"); gr.addColorStop(0.85, "rgba(170,235,255,.55)"); gr.addColorStop(1, "rgba(255,255,255,.95)");
        g.globalAlpha = 1; g.fillStyle = gr;
        const half = Math.sqrt(Math.max(0, R * R - (sliceY - CY) ** 2));
        g.fillRect(CX - half, sliceY - bandH, 2 * half, bandH * 1.3);
        if (opts.onSlice) { const row = Math.round((sliceY - oy) / s); opts.onSlice(data.rowVeg[Math.max(0, Math.min(data.n - 1, row))] || 0); }
      }
      if (sweep > 0 && sweep < 1) {
        const a = -Math.PI / 2 + sweep * 2 * Math.PI;
        const sg = g.createLinearGradient(CX, CY, CX + Math.cos(a) * R, CY + Math.sin(a) * R);
        sg.addColorStop(0, "rgba(255,255,255,0)"); sg.addColorStop(1, "rgba(200,240,255,.9)");
        g.strokeStyle = sg; g.lineWidth = 2 * dpr; g.beginPath(); g.moveTo(CX, CY); g.lineTo(CX + Math.cos(a) * R, CY + Math.sin(a) * R); g.stroke();
      }
      // distance rings 50/100/150/200 m + crosshair
      g.globalAlpha = fadeIn * (1 - conv);
      g.strokeStyle = "rgba(200,230,255,.28)"; g.lineWidth = 1 * dpr;
      [0.25, 0.5, 0.75, 1].forEach((f) => { g.beginPath(); g.arc(CX, CY, R * f, 0, 2 * Math.PI); g.stroke(); });
      g.beginPath(); g.moveTo(CX - R, CY); g.lineTo(CX + R, CY); g.moveTo(CX, CY - R); g.lineTo(CX, CY + R); g.stroke();
      g.fillStyle = "rgba(200,230,255,.6)"; g.font = `${11 * dpr}px -apple-system, BlinkMacSystemFont, sans-serif`; g.textAlign = "left";
      ["50 m", "100 m", "150 m", "200 m"].forEach((l, i) => g.fillText(l, CX + R * (i + 1) / 4 * 0.707 + 4 * dpr, CY - R * (i + 1) / 4 * 0.707));
      g.textAlign = "center"; g.fillText("N", CX, CY - R - 8 * dpr);
      // building outline + windows
      g.globalAlpha = Math.max(fadeIn, 0) * (1 - portal);
      g.strokeStyle = "#ff8ad8"; g.lineWidth = (1.5 + conv * 2) * dpr; g.shadowColor = "#ff8ad8"; g.shadowBlur = (6 + conv * 18) * dpr;
      g.beginPath(); data.outline.forEach(([x, y], i) => (i ? g.lineTo(ox + x * s, oy + y * s) : g.moveTo(ox + x * s, oy + y * s))); g.closePath(); g.stroke();
      g.shadowBlur = 0;
      g.restore();   // zoom
      // portal into space: expanding hole from the building
      if (portal > 0) {
        g.save(); g.globalCompositeOperation = "destination-out";
        const pr = portal * Math.hypot(W, H);
        const pg = g.createRadialGradient(bx, by, pr * 0.6, bx, by, pr);
        pg.addColorStop(0, "rgba(0,0,0,1)"); pg.addColorStop(1, "rgba(0,0,0,0)");
        g.fillStyle = pg; g.beginPath(); g.arc(bx, by, pr, 0, 2 * Math.PI); g.fill(); g.restore();
      }
      // minimal labels (fade in/out)
      const la = Math.min(seg(t, 1.4, 2.2), 1 - seg(t, 8.2, 9.0));
      if (la > 0.01) {
        g.globalAlpha = la; g.fillStyle = "rgba(220,235,255,.9)"; g.textAlign = "left";
        g.font = `500 ${12 * dpr}px -apple-system, BlinkMacSystemFont, sans-serif`;
        const lx = Math.max(16 * dpr, ox + S * 0.02), ly = oy + S * 0.06;
        g.fillText((window.I18N ? I18N.t("SPECTRAL SCAN · 200 m") : "SPECTRAL SCAN · 200 m"), lx, ly);
        g.font = `${11 * dpr}px -apple-system, BlinkMacSystemFont, sans-serif`; g.fillStyle = "rgba(200,215,240,.7)";
        labels.slice(0, Math.min(labels.length, 1 + Math.floor(Math.max(0, t - 2) / 1.2))).forEach((l, i) => g.fillText(l, lx, ly + (i + 1) * 18 * dpr));
        // spectrum legend
        const lw = Math.min(220 * dpr, S * 0.35), lh = 6 * dpr, lx2 = W - lw - 20 * dpr, ly2 = oy + S - 30 * dpr;
        for (let i = 0; i < lw; i++) { g.fillStyle = css(spectrum(i / lw)); g.fillRect(lx2 + i, ly2, 1, lh); }
        g.fillStyle = "rgba(200,215,240,.75)"; g.font = `${10 * dpr}px -apple-system, BlinkMacSystemFont, sans-serif`;
        g.textAlign = "left"; g.fillText((window.I18N ? I18N.t("sealed") : "sealed"), lx2, ly2 + lh + 13 * dpr); g.textAlign = "right"; g.fillText((window.I18N ? I18N.t("dense vegetation") : "dense vegetation"), lx2 + lw, ly2 + lh + 13 * dpr);
        g.textAlign = "center"; g.fillText((window.I18N ? I18N.t("biodiversity spectrum") : "biodiversity spectrum"), lx2 + lw / 2, ly2 - 7 * dpr);
      }
      g.globalAlpha = 1;
      if (t >= DUR) { stop(); opts.onDone && opts.onDone(); return; }
      raf = requestAnimationFrame(frame);
    }
    function stop() { stopped = true; cancelAnimationFrame(raf); }
    raf = requestAnimationFrame(frame);
    return { stop };
  }

  window.SpaceshipScan = { prepare, play, thumbnail, spectrum };
})();
