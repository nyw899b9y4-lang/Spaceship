// Full-screen star window ("dome"): stereographic projection around a free view direction.
// Stereographic keeps star patterns locally true (conformal) while showing a very wide field.
// Layers: sky glow · Milky Way · grids · ecliptic/equator · constellations · deep-sky (Messier)
//         · stars · Sun/Moon/planets · ground · window foreground (skyline from the photo,
//         window frame removed) · cardinal points.
"use strict";
(function () {
  const D2R = Math.PI / 180, R2D = 180 / Math.PI;
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const norm = (a) => { const l = Math.hypot(a[0], a[1], a[2]); return [a[0] / l, a[1] / l, a[2] / l]; };
  const altOf = (v) => Math.asin(Math.max(-1, Math.min(1, v[2]))) * R2D;
  const azOf = (v) => (Math.atan2(v[0], v[1]) * R2D + 360) % 360;

  // ---------- stereographic camera ----------
  function makeCam(az, alt, hfov, W, H) {
    const S = SpaceshipSky.vecAzAlt;
    const c = S(az, alt), r = [Math.cos(az * D2R), -Math.sin(az * D2R), 0], u = cross(r, c);
    const k = (W / 2) / (2 * Math.tan((hfov * D2R) / 4));
    const project = (v) => {
      const ct = dot(v, c); if (ct < -0.75) return null;
      const f = 2 / (1 + ct);
      return [W / 2 + f * dot(v, r) * k, H / 2 - f * dot(v, u) * k];
    };
    // inverse (screen → direction), for dragging
    const unproject = (x, y) => {
      const X = (x - W / 2) / k, Y = -(y - H / 2) / k, rho2 = X * X + Y * Y, d = 4 + rho2;
      const ct = (4 - rho2) / d, s = 4 / d;
      return norm([c[0] * ct + (r[0] * X + u[0] * Y) * s, c[1] * ct + (r[1] * X + u[1] * Y) * s, c[2] * ct + (r[2] * X + u[2] * Y) * s]);
    };
    return { project, unproject, k, c, r, u, W, H };
  }

  // ---------- window anchor: the lower part of the photo, stylized ----------
  // Kept: everything below the photo's own horizon (balcony, sill, facade) – always visible as a fixed point –
  // plus buildings/trees below the skyline. Removed: open sky and window bars above the skyline.
  // Look: dark blueprint tone with glowing edges, so the stars stay the main thing.
  const fgCache = new WeakMap();
  function foreground(img, el, vfov) {
    const key = `${Math.round(el)}|${vfov}`, cached = fgCache.get(img);
    if (cached && cached.key === key) return cached;
    const OW = 600, OH = Math.round((OW * img.naturalHeight) / img.naturalWidth);
    const out = document.createElement("canvas"); out.width = OW; out.height = OH;
    const og = out.getContext("2d", { willReadFrequently: true }); og.drawImage(img, 0, 0, OW, OH);
    // row of the true horizon in the photo (gnomonic, centre column)
    const hzY = Math.max(0, Math.min(1, 0.5 + Math.tan(el * D2R) / (2 * Math.tan((vfov / 2) * D2R))));
    // per-column skyline from the sky mask: end of the lowest real sky run (specks and low reflections ignored)
    let sm = null;
    const m = SpaceshipSky.skyMask(img, img.naturalWidth, img.naturalHeight);
    if (m) {
      const cw = m.canvas.width, ch = m.canvas.height, md = m.canvas.getContext("2d").getImageData(0, 0, cw, ch).data;
      const sk = new Float32Array(cw).fill(-1);
      for (let x = 0; x < cw; x++) {
        let low = -1, count = 0, run = 0;
        for (let y = 0; y <= ch; y++) {
          const sky = y < ch && md[(y * cw + x) * 4 + 3] > 128;
          if (sky) run++; else { if (run > ch * 0.03 && y - run < ch * 0.7) { low = y - 1; count += run; } run = 0; }
        }
        if (count > ch * 0.04) sk[x] = (low + 1) / ch;
      }
      const vals = Array.from(sk).filter((v) => v >= 0).sort((a, b) => a - b);
      if (vals.length > cw * 0.1) {
        const med = vals[vals.length >> 1];
        // columns without (enough) sky: take the median skyline – no spikes, no notches
        for (let x = 0; x < cw; x++) if (sk[x] < med * 0.6) sk[x] = med;
        // wide running median for a calm silhouette
        sm = new Float32Array(cw);
        for (let x = 0; x < cw; x++) { const w = []; for (let k = -6; k <= 6; k++) w.push(sk[Math.max(0, Math.min(cw - 1, x + k))]); w.sort((a, b) => a - b); sm[x] = w[6]; }
      }
    }
    // stylize: dark blueprint tone + glowing edges
    try {
      const id = og.getImageData(0, 0, OW, OH), d = id.data, gy = new Float32Array(OW * OH);
      for (let i = 0; i < OW * OH; i++) gy[i] = 0.299 * d[i * 4] + 0.587 * d[i * 4 + 1] + 0.114 * d[i * 4 + 2];
      for (let y = 0; y < OH; y++) for (let x = 0; x < OW; x++) {
        const i = y * OW + x, k = i * 4, g = gy[i];
        let e = 0;
        if (x > 0 && y > 0 && x < OW - 1 && y < OH - 1) {
          const gx = gy[i - OW + 1] + 2 * gy[i + 1] + gy[i + OW + 1] - gy[i - OW - 1] - 2 * gy[i - 1] - gy[i + OW - 1];
          const gv = gy[i + OW - 1] + 2 * gy[i + OW] + gy[i + OW + 1] - gy[i - OW - 1] - 2 * gy[i - OW] - gy[i - OW + 1];
          e = Math.min(1, Math.hypot(gx, gv) / 260);
        }
        const r = d[k], gg = d[k + 1], b = d[k + 2];
        // keep a hint of the real colour (plants stay greenish), mostly a deep blue tone
        d[k] = 8 + g * 0.16 + r * 0.06 + e * 110;
        d[k + 1] = 14 + g * 0.2 + gg * 0.07 + e * 220;
        d[k + 2] = 34 + g * 0.26 + b * 0.05 + e * 235;
      }
      og.putImageData(id, 0, 0);
    } catch (_) { /* photo not readable: keep it as it is */ }
    // alpha mask: below the skyline OR below the photo's horizon (the anchor), soft edges
    const mask = document.createElement("canvas"); mask.width = OW; mask.height = OH;
    const mg = mask.getContext("2d"); mg.fillStyle = "#fff";
    if (sm) {
      const cw = sm.length; mg.beginPath(); mg.moveTo(0, OH);
      for (let x = 0; x <= cw; x++) mg.lineTo((x / cw) * OW, sm[Math.min(cw - 1, x)] * OH);
      mg.lineTo(OW, OH); mg.closePath(); mg.filter = "blur(3px)"; mg.fill(); mg.filter = "none";
    }
    const hg = mg.createLinearGradient(0, (hzY - 0.06) * OH, 0, (hzY + 0.04) * OH);
    hg.addColorStop(0, "rgba(255,255,255,0)"); hg.addColorStop(1, "#fff"); mg.fillStyle = hg; mg.fillRect(0, 0, OW, OH);
    // feather the left/right edges (destination-in clears outside the drawn rect → fill the whole canvas)
    mg.globalCompositeOperation = "destination-in";
    const fe = mg.createLinearGradient(0, 0, OW, 0);
    fe.addColorStop(0, "rgba(0,0,0,0)"); fe.addColorStop(0.07, "#000"); fe.addColorStop(0.93, "#000"); fe.addColorStop(1, "rgba(0,0,0,0)");
    mg.fillStyle = fe; mg.fillRect(0, 0, OW, OH);
    og.globalCompositeOperation = "destination-in"; og.drawImage(mask, 0, 0); og.globalCompositeOperation = "source-over";
    const res = { canvas: out, key };
    fgCache.set(img, res); return res;
  }
  // full original photo, downsized once (for the periodic blend and photo mode)
  const phCache = new WeakMap();
  function photoCanvas(img) {
    if (phCache.has(img)) return phCache.get(img);
    const c = document.createElement("canvas"); c.width = 900; c.height = Math.round((900 * img.naturalHeight) / img.naturalWidth);
    c.getContext("2d").drawImage(img, 0, 0, c.width, c.height); phCache.set(img, c); return c;
  }
  // texture-mapped triangle (affine)
  function tri(g, img, s0, s1, s2, d0, d1, d2) {
    const den = (s1[0] - s0[0]) * (s2[1] - s0[1]) - (s2[0] - s0[0]) * (s1[1] - s0[1]); if (!den) return;
    const a = ((d1[0] - d0[0]) * (s2[1] - s0[1]) - (d2[0] - d0[0]) * (s1[1] - s0[1])) / den;
    const b = ((d1[1] - d0[1]) * (s2[1] - s0[1]) - (d2[1] - d0[1]) * (s1[1] - s0[1])) / den;
    const c = ((d2[0] - d0[0]) * (s1[0] - s0[0]) - (d1[0] - d0[0]) * (s2[0] - s0[0])) / den;
    const d = ((d2[1] - d0[1]) * (s1[0] - s0[0]) - (d1[1] - d0[1]) * (s2[0] - s0[0])) / den;
    const e = d0[0] - a * s0[0] - c * s0[1], f = d0[1] - b * s0[0] - d * s0[1];
    // expand the triangle by ~0.6 px to hide seams
    const cx = (d0[0] + d1[0] + d2[0]) / 3, cy = (d0[1] + d1[1] + d2[1]) / 3, ex = (p) => { const dx = p[0] - cx, dy = p[1] - cy, l = Math.hypot(dx, dy) || 1; return [p[0] + (dx / l) * 0.6, p[1] + (dy / l) * 0.6]; };
    const q0 = ex(d0), q1 = ex(d1), q2 = ex(d2);
    g.save(); g.beginPath(); g.moveTo(q0[0], q0[1]); g.lineTo(q1[0], q1[1]); g.lineTo(q2[0], q2[1]); g.closePath(); g.clip();
    g.setTransform(a, b, c, d, e, f); g.drawImage(img, 0, 0); g.restore();
  }
  // draw a photo (gnomonic camera az/el/hfov/vfov) warped into the dome
  function drawPhoto(g, cam, src, ph, dpr) {
    const S = SpaceshipSky.vecAzAlt, f = S(ph.az, ph.el), r = [Math.cos(ph.az * D2R), -Math.sin(ph.az * D2R), 0], u = cross(r, f);
    const tx = Math.tan((ph.hfov / 2) * D2R), ty = Math.tan((ph.vfov / 2) * D2R), NX = 18, NY = 24, w = src.width, h = src.height;
    const P = [];
    for (let j = 0; j <= NY; j++) { const row = []; for (let i = 0; i <= NX; i++) {
      const X = (i / NX * 2 - 1) * tx, Y = (1 - j / NY * 2) * ty;
      row.push(cam.project(norm([f[0] + r[0] * X + u[0] * Y, f[1] + r[1] * X + u[1] * Y, f[2] + r[2] * X + u[2] * Y])));
    } P.push(row); }
    g.save(); g.setTransform(1, 0, 0, 1, 0, 0);
    for (let j = 0; j < NY; j++) for (let i = 0; i < NX; i++) {
      const a = P[j][i], b = P[j][i + 1], c = P[j + 1][i], d = P[j + 1][i + 1]; if (!a || !b || !c || !d) continue;
      const sa = [i / NX * w, j / NY * h], sb = [(i + 1) / NX * w, j / NY * h], sc = [i / NX * w, (j + 1) / NY * h], sd = [(i + 1) / NX * w, (j + 1) / NY * h];
      tri(g, src, sa, sb, sc, a, b, c); tri(g, src, sb, sd, sc, b, d, c);
    }
    g.restore();
    return P;
  }

  // ---------- historic figure layer (al-Ṣūfī) ----------
  const figImgs = {};
  function figImage(f, onload) {
    if (!figImgs[f.src]) { const im = new Image(); im.onload = () => onload && onload(); im.src = f.src; figImgs[f.src] = im; }
    return figImgs[f.src];
  }
  // least-squares affine (image → screen) from anchor stars; the reflection of a "globe" drawing comes out by itself
  function fitAffine(pairs) {
    const n = pairs.length; if (n < 3) return null;
    let Sxx = 0, Sxy = 0, Syy = 0, Sx = 0, Sy = 0, SxX = 0, SyX = 0, SX = 0, SxY = 0, SyY = 0, SY = 0;
    pairs.forEach(([x, y, X, Y]) => { Sxx += x * x; Sxy += x * y; Syy += y * y; Sx += x; Sy += y; SxX += x * X; SyX += y * X; SX += X; SxY += x * Y; SyY += y * Y; SY += Y; });
    const M = [[Sxx, Sxy, Sx], [Sxy, Syy, Sy], [Sx, Sy, n]];
    const solve = (b) => {   // Cramer's rule, 3×3
      const det = (m) => m[0][0] * (m[1][1] * m[2][2] - m[1][2] * m[2][1]) - m[0][1] * (m[1][0] * m[2][2] - m[1][2] * m[2][0]) + m[0][2] * (m[1][0] * m[2][1] - m[1][1] * m[2][0]);
      const D = det(M); if (Math.abs(D) < 1e-9) return null;
      return [0, 1, 2].map((i) => det(M.map((row, r) => row.map((v, c) => (c === i ? b[r] : v)))) / D);
    };
    const px = solve([SxX, SyX, SX]), py = solve([SxY, SyY, SY]);
    if (!px || !py) return null;
    return { a: px[0], c: px[1], e: px[2], b: py[0], d: py[1], f: py[2] };
  }
  const pip = (pt, poly) => { let ins = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if ((yi > pt[1]) !== (yj > pt[1]) && pt[0] < ((xj - xi) * (pt[1] - yi)) / (yj - yi) + xi) ins = !ins; } return ins; };

  // ---------- ecliptic → equatorial ----------
  const EPS = 23.4393 * D2R;
  function eclToEq(lonDeg) {
    const l = lonDeg * D2R, ra = Math.atan2(Math.sin(l) * Math.cos(EPS), Math.cos(l)), dec = Math.asin(Math.sin(EPS) * Math.sin(l));
    return [(ra * R2D + 360) % 360, dec * R2D];
  }
  const DSO_STYLE = { s: ["galaxy", "#ff7a7a"], e: ["galaxy", "#ff7a7a"], i: ["galaxy", "#ff7a7a"], gc: ["globular cluster", "#ffd36b"],
    oc: ["open cluster", "#ffd36b"], pn: ["planetary nebula", "#7dffb0"], rn: ["nebula", "#7dffb0"], sfr: ["star-forming nebula", "#7dffb0"],
    snr: ["supernova remnant", "#7dffb0"], pos: ["asterism", "#c9c9c9"] };

  // ---------- main render ----------
  // view: { lat, lon, time, az, alt, fov, layers:{mw,grid,eq,ecl,cons,dso,labels}, photo:{img,az,el,hfov,vfov}, mode }
  function render(canvas, view) {
    const g = canvas.getContext("2d"), W = canvas.width, H = canvas.height, cat = SpaceshipSky.catalog();
    const dpr = Math.min(2, window.devicePixelRatio || 1), L = view.layers || {};
    g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, W, H);
    const cam = makeCam(view.az, view.alt, view.fov, W, H), proj = cam.project;
    const lst = SpaceshipSky.lstDeg(view.time, view.lon), HV = (ra, dec) => SpaceshipSky.horizVec(ra, dec, view.lat, lst);
    const bodies = SpaceshipSky.bodies(view.time, view.lat, view.lon), sun = bodies.find((b) => b.name === "Sun");
    const sunAlt = sun ? sun.alt : -30, cssW = W / dpr, cssH = H / dpr, scale = Math.min(1.4, Math.max(0.85, cssH / 760)) * (120 / view.fov) ** 0.3;
    const objects = [], info = { objects, sunAlt, inView: [] };
    const onScreen = (p, m = 0) => p && p[0] > -m && p[0] < W + m && p[1] > -m && p[1] < H + m;
    // 1) sky: deep space, faint glow above the horizon, twilight tint when the Sun is just below
    const bg = g.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, "#01020a"); bg.addColorStop(0.6, "#050a1f"); bg.addColorStop(1, "#0b1433"); g.fillStyle = bg; g.fillRect(0, 0, W, H);
    const hz = proj(SpaceshipSky.vecAzAlt(view.az, 0));
    if (hz) {
      const tw = sunAlt < 0 && sunAlt > -18 ? (18 + sunAlt) / 18 : 0;
      const hg = g.createRadialGradient(hz[0], hz[1] + H * 0.6, H * 0.2, hz[0], hz[1] + H * 0.6, H * 1.1);
      hg.addColorStop(0, `rgba(${40 + tw * 120},${60 + tw * 50},${120 - tw * 30},${0.35 + tw * 0.25})`); hg.addColorStop(1, "rgba(0,0,0,0)");
      g.fillStyle = hg; g.fillRect(0, 0, W, H);
    }
    if (!cat) return info;
    // 2) Milky Way – soft, layered, slightly blurred (drawn at reduced resolution)
    if (L.mw !== false && cat.mw) {
      const s = 0.35, mc = document.createElement("canvas"); mc.width = Math.ceil(W * s); mc.height = Math.ceil(H * s);
      const m = mc.getContext("2d"); m.globalCompositeOperation = "lighter";
      cat.mw.forEach((lv) => {
        m.fillStyle = `rgba(${150 + lv.l * 12},${165 + lv.l * 10},${210 + lv.l * 6},${0.035 + lv.l * 0.012})`;
        lv.r.forEach((ring) => {
          m.beginPath(); let ok = 0, first = true;
          ring.forEach(([ra, dec]) => { const p = proj(HV(ra, dec)); if (!p) { first = true; return; } ok++;
            if (first) { m.moveTo(p[0] * s, p[1] * s); first = false; } else m.lineTo(p[0] * s, p[1] * s); });
          if (ok > 2) m.fill();
        });
      });
      g.save(); g.filter = `blur(${Math.round(6 * dpr)}px)`; g.globalCompositeOperation = "lighter"; g.drawImage(mc, 0, 0, W, H); g.restore();
    }
    // 2b) al-Ṣūfī constellation drawings, fitted onto the real stars
    info.regions = [];
    if (L.sufi && window.SpaceshipSufi && cat) {
      const byHip = cat.hipIndex || (cat.hipIndex = Object.fromEntries(cat.stars.map((st) => [st[7], st])));
      SpaceshipSufi.figures.forEach((f) => {
        const pairs = [];
        f.anchors.forEach(([hip, x, y]) => { const st = byHip[hip]; if (!st) return; const p = proj(HV(st[0], st[1])); if (p) pairs.push([x, y, p[0], p[1]]); });
        if (pairs.length < f.anchors.length) return;           // part of the figure is behind the viewer
        const T = fitAffine(pairs); if (!T) return;
        const im = figImage(f, view.onAsset); if (!im.complete || !im.naturalWidth) return;
        const s = f.frameW / im.naturalWidth;                 // image px → frame px
        g.save(); g.globalAlpha = view.figAlpha != null ? view.figAlpha : 0.5;
        g.setTransform(T.a * s, T.b * s, T.c * s, T.d * s, T.e, T.f); g.drawImage(im, 0, 0); g.restore();
        const toScr = ([x, y]) => [T.a * x + T.c * y + T.e, T.b * x + T.d * y + T.f];
        (f.highlights || []).forEach((h) => {
          const poly = h.poly.map(toScr);
          g.save(); g.beginPath(); poly.forEach((p, i) => (i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]))); g.closePath();
          g.fillStyle = "rgba(255,200,90,.10)"; g.fill();
          g.shadowColor = "#ffcf6b"; g.shadowBlur = 14 * dpr; g.strokeStyle = "rgba(255,207,107,.85)"; g.lineWidth = 2 * dpr; g.stroke(); g.restore();
          info.regions.push({ poly, o: { type: "region", id: h.id, name: h.name, html: h.html, x: poly.reduce((a, p) => a + p[0], 0) / poly.length, y: poly.reduce((a, p) => a + p[1], 0) / poly.length } });
        });
        info.figure = { title: f.title, caption: f.caption };
      });
    }
    info.regionAt = (x, y) => { const r = info.regions.find((rg) => pip([x, y], rg.poly)); return r ? r.o : null; };
    // helper: polyline through sky directions
    const path = (dirs, style, width, dash) => {
      g.save(); g.strokeStyle = style; g.lineWidth = width * dpr; if (dash) g.setLineDash(dash.map((d) => d * dpr));
      g.beginPath(); let first = true, last = null;
      dirs.forEach((v) => { const p = proj(v); if (!p || (last && Math.hypot(p[0] - last[0], p[1] - last[1]) > W * 0.6)) { first = true; last = null; return; }
        if (first) { g.moveTo(p[0], p[1]); first = false; } else g.lineTo(p[0], p[1]); last = p; });
      g.stroke(); g.restore();
    };
    const S = SpaceshipSky.vecAzAlt;
    // 3) grids
    if (L.grid) {
      for (let a = 0; a < 360; a += 15) path(Array.from({ length: 19 }, (_, i) => S(a, i * 5)), "rgba(80,200,150,.14)", 0.8);
      for (let h = 10; h < 90; h += 10) path(Array.from({ length: 73 }, (_, i) => S(i * 5, h)), "rgba(80,200,150,.14)", 0.8);
    }
    if (L.eq) {
      for (let ra = 0; ra < 360; ra += 15) path(Array.from({ length: 37 }, (_, i) => HV(ra, -90 + i * 5)), "rgba(90,130,255,.16)", 0.8);
      for (let dec = -60; dec <= 80; dec += 20) path(Array.from({ length: 73 }, (_, i) => HV(i * 5, dec)), dec === 0 ? "rgba(120,160,255,.45)" : "rgba(90,130,255,.16)", dec === 0 ? 1.2 : 0.8);
    }
    if (L.ecl !== false) path(Array.from({ length: 145 }, (_, i) => { const [ra, dec] = eclToEq(i * 2.5); return HV(ra, dec); }), "rgba(255,190,90,.55)", 1.2, [6, 4]);
    // 4) constellations
    if (L.cons !== false) {
      cat.cons.forEach((c) => c.l.forEach((seg) => path(seg.map(([ra, dec]) => HV(ra, dec)), "rgba(150,200,255,.30)", 1)));
      if (L.labels !== false) cat.cons.forEach((c) => {
        const v = HV(c.p[0], c.p[1]), p = proj(v); if (!onScreen(p, -10) || altOf(v) < 1) return;
        g.fillStyle = "rgba(150,190,255,.6)"; g.font = `500 ${Math.round(11 * scale * dpr)}px -apple-system,BlinkMacSystemFont,sans-serif`; g.textAlign = "center";
        g.fillText(c.n, p[0], p[1]); info.inView.push({ type: "constellation", name: c.n });
      });
    }
    // 5) deep-sky objects (Messier)
    if (L.dso !== false && cat.dso) cat.dso.forEach(([ra, dec, mag, type, mname, alt, desig, dim]) => {
      const v = HV(ra, dec), p = proj(v); if (!onScreen(p) || altOf(v) < 0) return;
      if (mag > 9.5 && view.fov > 90) return;
      const [kind, col] = DSO_STYLE[type] || ["deep-sky object", "#c9c9c9"], r = Math.max(3, (10 - mag) * 1.1) * dpr * scale * 0.8;
      g.save(); g.strokeStyle = col; g.globalAlpha = 0.75; g.lineWidth = 1.1 * dpr;
      if (kind === "galaxy") { g.beginPath(); g.ellipse(p[0], p[1], r * 1.4, r * 0.7, -0.5, 0, 2 * Math.PI); g.stroke(); }
      else if (kind.includes("cluster")) { g.setLineDash([2 * dpr, 2 * dpr]); g.beginPath(); g.arc(p[0], p[1], r, 0, 2 * Math.PI); g.stroke(); }
      else { g.strokeRect(p[0] - r, p[1] - r, 2 * r, 2 * r); }
      if (L.labels !== false && (mag < 7 || view.fov < 70)) {
        g.globalAlpha = 0.8; g.fillStyle = col; g.font = `${Math.round(10 * scale * dpr)}px -apple-system,BlinkMacSystemFont,sans-serif`; g.textAlign = "left";
        g.fillText(alt ? `${mname} ${alt}` : mname, p[0] + r + 3 * dpr, p[1] + 3 * dpr);
      }
      g.restore();
      objects.push({ type: "dso", x: p[0], y: p[1], r: r + 4, mag, name: mname, alias: alt, desig, kind, dim, alt: altOf(v), az: azOf(v), ra, dec });
    });
    // 6) stars
    const limit = (view.fov > 140 ? 5.2 : view.fov > 100 ? 5.6 : 6.2) - (cssW < 600 ? 0.7 : 0);
    cat.stars.forEach(([ra, dec, mag, bv, name, desig, con, hip]) => {
      if (mag > limit) return;
      const v = HV(ra, dec), p = proj(v); if (!onScreen(p) || altOf(v) < -1) return;
      const r = Math.max(0.7, (limit + 1.2 - mag) * 0.62) * scale * dpr, col = SpaceshipSky.bvColor(bv);
      if (mag < 3.2) {
        const hr = r * (mag < 1 ? 6 : 3.5), halo = g.createRadialGradient(p[0], p[1], 0, p[0], p[1], hr);
        halo.addColorStop(0, col.replace("rgb", "rgba").replace(")", ",.55)")); halo.addColorStop(1, "rgba(0,0,0,0)");
        g.fillStyle = halo; g.beginPath(); g.arc(p[0], p[1], hr, 0, 2 * Math.PI); g.fill();
      }
      if (mag < 1.2) { g.strokeStyle = col.replace("rgb", "rgba").replace(")", ",.55)"); g.lineWidth = dpr;
        const Lr = r * 6; g.beginPath(); g.moveTo(p[0] - Lr, p[1]); g.lineTo(p[0] + Lr, p[1]); g.moveTo(p[0], p[1] - Lr); g.lineTo(p[0], p[1] + Lr); g.stroke(); }
      g.fillStyle = col; g.beginPath(); g.arc(p[0], p[1], r, 0, 2 * Math.PI); g.fill();
      if (mag < 2.5) { g.fillStyle = "#fff"; g.beginPath(); g.arc(p[0], p[1], r * 0.45, 0, 2 * Math.PI); g.fill(); }
      if (L.labels !== false && name && (mag < 2.2 || (view.fov < 70 && mag < 3.5))) {
        g.fillStyle = "rgba(235,240,255,.85)"; g.font = `${Math.round(11 * scale * dpr)}px -apple-system,BlinkMacSystemFont,sans-serif`; g.textAlign = "left";
        g.fillText(name, p[0] + r + 4 * dpr, p[1] + 4 * dpr); info.inView.push({ type: "star", name, mag });
      }
      objects.push({ type: "star", x: p[0], y: p[1], r, mag, bv, name, desig, con, conName: (cat.conName || {})[con] || con, hip, alt: altOf(v), az: azOf(v), ra, dec });
    });
    if (!cat.conName) { cat.conName = {}; cat.cons.forEach((c) => (cat.conName[c.id] = c.n)); }
    // 7) Sun, Moon, planets
    bodies.forEach((b) => {
      const v = S(b.az, b.alt), p = proj(v); if (!onScreen(p, 40) || b.alt < -2) return;
      const isSun = b.name === "Sun", isMoon = b.name === "Moon", r = (isSun ? 12 : isMoon ? 10 : 4) * scale * dpr;
      if (isSun) { const sg = g.createRadialGradient(p[0], p[1], 0, p[0], p[1], r * 10);
        sg.addColorStop(0, "rgba(255,250,230,1)"); sg.addColorStop(0.1, "rgba(255,240,200,.8)"); sg.addColorStop(1, "rgba(255,200,120,0)");
        g.fillStyle = sg; g.beginPath(); g.arc(p[0], p[1], r * 10, 0, 2 * Math.PI); g.fill(); }
      g.save(); g.fillStyle = isSun ? "#fff7d6" : isMoon ? "#e9edf7" : "#ffd9f2"; g.shadowColor = g.fillStyle; g.shadowBlur = (isMoon ? 22 : 10) * dpr;
      g.beginPath(); g.arc(p[0], p[1], r, 0, 2 * Math.PI); g.fill(); g.restore();
      if (isMoon) { const lit = (1 - Math.cos(b.phase * D2R)) / 2; g.save(); g.globalAlpha = 0.85; g.fillStyle = "#050a1f";
        g.beginPath(); g.ellipse(p[0] + (b.phase < 180 ? -1 : 1) * r * lit * 2, p[1], r, r, 0, 0, 2 * Math.PI); g.fill(); g.restore(); }
      if (L.labels !== false) { g.fillStyle = "#ffc4ec"; g.font = `600 ${Math.round(12 * scale * dpr)}px -apple-system,BlinkMacSystemFont,sans-serif`; g.textAlign = "left";
        g.fillText(b.name, p[0] + r + 6 * dpr, p[1] + 4 * dpr); }
      const ill = window.Astronomy && !isSun ? Astronomy.Illumination(b.name, view.time) : null;
      objects.push({ type: "body", x: p[0], y: p[1], r: r * 1.5, name: b.name, sym: b.sym, alt: b.alt, az: b.az, phase: b.phase, mag: ill ? ill.mag : -26.7, distAU: ill ? ill.geo_dist : 1 });
      info.inView.push({ type: "body", name: b.name });
    });
    // 8) ground below the horizon
    const fgC = document.createElement("canvas"); fgC.width = W; fgC.height = H; const fg = fgC.getContext("2d");
    const hzPts = []; for (let a = -180; a <= 180; a += 3) { const p = proj(S(view.az + a, 0)); if (p) hzPts.push(p); }
    if (hzPts.length > 2) {
      fg.beginPath(); fg.moveTo(hzPts[0][0], hzPts[0][1]); hzPts.forEach((p) => fg.lineTo(p[0], p[1]));
      const nadir = proj(S(view.az, -89.9)) || [W / 2, H * 3];
      fg.lineTo(hzPts[hzPts.length - 1][0], Math.max(H, nadir[1])); fg.lineTo(hzPts[0][0], Math.max(H, nadir[1])); fg.closePath();
      const gy = Math.min(...hzPts.map((p) => p[1])), gg = fg.createLinearGradient(0, Math.max(0, gy), 0, H);
      gg.addColorStop(0, "#0c1226"); gg.addColorStop(0.15, "#070b18"); gg.addColorStop(1, "#020308"); fg.fillStyle = gg; fg.fill();
    }
    // 9) window anchor: stylized lower part of the photo (or the whole photo in photo mode)
    if (view.photo && view.photo.img && view.photo.img.naturalWidth) {
      const src = view.mode === "photo" ? photoCanvas(view.photo.img) : foreground(view.photo.img, view.photo.el, view.photo.vfov).canvas;
      const tmp = document.createElement("canvas"); tmp.width = W; tmp.height = H;
      drawPhoto(tmp.getContext("2d"), cam, src, view.photo, dpr);
      fg.drawImage(tmp, 0, 0);
    }
    g.drawImage(fgC, 0, 0);
    // horizon line + cardinal points
    if (hzPts.length > 2) {
      g.save(); g.strokeStyle = "rgba(143,211,255,.35)"; g.lineWidth = 1 * dpr; g.beginPath(); hzPts.forEach((p, i) => (i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]))); g.stroke(); g.restore();
      ["N", "NE", "E", "SE", "S", "SW", "W", "NW"].forEach((n, i) => { const p = proj(S(i * 45, 0)); if (!onScreen(p, -10)) return;
        g.fillStyle = n.length === 1 ? "rgba(255,120,110,.9)" : "rgba(255,160,150,.6)"; g.font = `600 ${Math.round((n.length === 1 ? 15 : 11) * dpr)}px -apple-system,BlinkMacSystemFont,sans-serif`;
        g.textAlign = "center"; g.fillText(n, p[0], p[1] + 20 * dpr); });
    }
    // occlusion test for hover: hidden behind ground/foreground?
    let fgData = null;
    info.visibleAt = (x, y) => { try { if (!fgData) fgData = fg.getImageData(0, 0, W, H).data; return fgData[(Math.round(y) * W + Math.round(x)) * 4 + 3] < 90; } catch (_) { return true; } };
    info.cam = cam;
    return info;
  }

  // the original photo alone, warped into the same projection (overlay that fades in and out)
  function renderPhoto(canvas, view) {
    const g = canvas.getContext("2d"), W = canvas.width, H = canvas.height;
    g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, W, H);
    if (!view.photo || !view.photo.img || !view.photo.img.naturalWidth) return;
    drawPhoto(g, makeCam(view.az, view.alt, view.fov, W, H), photoCanvas(view.photo.img), view.photo, 1);
  }

  window.SpaceshipDome = { render, renderPhoto, makeCam, altOf, azOf };
})();
