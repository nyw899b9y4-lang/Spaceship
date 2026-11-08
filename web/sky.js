// Real sky for a window view: which stars, constellations, Sun, Moon and planets lie in the
// direction a window photo was taken, at a given time, drawn into the sky part of the photo.
// Star data: d3-celestial (BSD-3-Clause). Sun/Moon/planets: astronomy-engine (MIT).
"use strict";
(function () {
  const D2R = Math.PI / 180, R2D = 180 / Math.PI;
  let catalog = null, loading = null;

  function load() {
    if (catalog) return Promise.resolve(catalog);
    if (!loading) loading = fetch("vendor/sky/sky.json?v=2").then((r) => r.json()).then((j) => (catalog = j));
    return loading;
  }

  // --- time & coordinates -------------------------------------------------
  function lstDeg(date, lon) {                               // local sidereal time in degrees
    const jd = date.getTime() / 86400000 + 2440587.5, d = jd - 2451545.0, T = d / 36525;
    return (((280.46061837 + 360.98564736629 * d + 0.000387933 * T * T + lon) % 360) + 360) % 360;
  }
  // equatorial (deg) → horizontal unit vector in east/north/up
  function horizVec(raDeg, decDeg, lat, lst) {
    const H = (lst - raDeg) * D2R, d = decDeg * D2R, p = lat * D2R;
    const sinAlt = Math.sin(p) * Math.sin(d) + Math.cos(p) * Math.cos(d) * Math.cos(H);
    const alt = Math.asin(sinAlt);
    const az = Math.atan2(-Math.cos(d) * Math.sin(H), Math.sin(d) * Math.cos(p) - Math.cos(d) * Math.sin(p) * Math.cos(H));
    return [Math.cos(alt) * Math.sin(az), Math.cos(alt) * Math.cos(az), Math.sin(alt)];
  }
  const vecAzAlt = (azDeg, altDeg) => {
    const a = azDeg * D2R, e = altDeg * D2R;
    return [Math.cos(e) * Math.sin(a), Math.cos(e) * Math.cos(a), Math.sin(e)];
  };
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];

  // camera looking at (az, el) with a horizontal/vertical field of view → projector to image px
  function camera(az, el, hfov, vfov, w, h) {
    const f = vecAzAlt(az, el), r = [Math.cos(az * D2R), -Math.sin(az * D2R), 0], u = cross(r, f);
    const kx = w / 2 / Math.tan((hfov / 2) * D2R), ky = h / 2 / Math.tan((vfov / 2) * D2R);
    return (v) => {
      const z = dot(v, f); if (z <= 0.05) return null;
      return [w / 2 + (dot(v, r) / z) * kx, h / 2 - (dot(v, u) / z) * ky];
    };
  }

  // star colour from B–V index
  function bvColor(bv) {
    const t = Math.max(-0.3, Math.min(2, bv));
    const stops = [[-0.3, [155, 176, 255]], [0, [202, 216, 255]], [0.4, [248, 247, 255]], [0.8, [255, 244, 234]], [1.3, [255, 210, 161]], [2, [255, 160, 110]]];
    for (let i = 1; i < stops.length; i++) if (t <= stops[i][0]) {
      const [a, ca] = stops[i - 1], [b, cb] = stops[i], k = (t - a) / (b - a);
      return `rgb(${ca.map((c, j) => Math.round(c + (cb[j] - c) * k)).join(",")})`;
    }
    return "rgb(255,160,110)";
  }

  // --- sky mask from the photo (where is open sky?) ------------------------
  // blue-ish bright pixels, smoothed; falls back to bright neutral pixels in the upper part (overcast)
  function skyMask(img, w, h) {
    const mw = 160, mh = Math.max(1, Math.round((mw * h) / w));
    const c = document.createElement("canvas"); c.width = mw; c.height = mh;
    const g = c.getContext("2d"); g.drawImage(img, 0, 0, mw, mh);
    let data;
    try { data = g.getImageData(0, 0, mw, mh); } catch (_) { return null; }   // photo not readable → no mask
    const d = data.data, n = mw * mh, blue = new Uint8Array(n), grey = new Uint8Array(n);
    let nb = 0;
    for (let i = 0; i < n; i++) {
      const r = d[i * 4], gg = d[i * 4 + 1], b = d[i * 4 + 2], lum = 0.299 * r + 0.587 * gg + 0.114 * b;
      const mx = Math.max(r, gg, b), mn = Math.min(r, gg, b), sat = mx ? (mx - mn) / mx : 0;
      if (b > r + 12 && b >= gg - 6 && lum > 70) { blue[i] = 1; nb++; }
      if (lum > 165 && sat < 0.18 && Math.floor(i / mw) < mh * 0.65) grey[i] = 1;
    }
    const pick = nb > n * 0.03 ? blue : grey;
    // remove specks: keep pixels with ≥5 of 9 neighbours set
    const out = g.createImageData(mw, mh);
    for (let y = 0; y < mh; y++) for (let x = 0; x < mw; x++) {
      let s = 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const xx = x + dx, yy = y + dy;
        if (xx >= 0 && yy >= 0 && xx < mw && yy < mh) s += pick[yy * mw + xx];
      }
      const k = (y * mw + x) * 4; out.data[k] = out.data[k + 1] = out.data[k + 2] = 255; out.data[k + 3] = s >= 5 ? 255 : 0;
    }
    g.putImageData(out, 0, 0);
    return { canvas: c, coverage: nb / n };
  }

  // --- bodies -------------------------------------------------------------
  const BODIES = [["Sun", "☀"], ["Moon", "☾"], ["Mercury", "☿"], ["Venus", "♀"], ["Mars", "♂"], ["Jupiter", "♃"], ["Saturn", "♄"]];
  function bodies(date, lat, lon) {
    if (!window.Astronomy) return [];
    const obs = new Astronomy.Observer(lat, lon, 0);
    return BODIES.map(([name, sym]) => {
      const eq = Astronomy.Equator(name, date, obs, true, true);
      const hor = Astronomy.Horizon(date, obs, eq.ra, eq.dec, "normal");
      const o = { name, sym, az: hor.azimuth, alt: hor.altitude };
      if (name === "Moon") o.phase = Astronomy.MoonPhase(date);   // 0 new, 90 first quarter, 180 full
      return o;
    });
  }

  const altOf = (v) => Math.asin(Math.max(-1, Math.min(1, v[2]))) * R2D;
  // simple label placement: shift a label down until it no longer overlaps an earlier one
  function placer() {
    const boxes = [];
    return (x, y, w, h) => {
      for (let i = 0; i < 6; i++) {
        if (!boxes.some((b) => x < b[0] + b[2] && x + w > b[0] && y - h < b[1] && y > b[1] - b[3])) break;
        y += h + 2;
      }
      boxes.push([x, y, w, h]); return y;
    };
  }

  // --- render ---------------------------------------------------------------
  // view: { lat, lon, az, el, time, mode: "space" | "photo" }
  function render(canvas, img, view) {
    const g = canvas.getContext("2d"), W = canvas.width, H = canvas.height;
    g.clearRect(0, 0, W, H);
    if (!img || !img.naturalWidth) return null;
    const space = view.mode !== "photo" && catalog;
    // photo mode: whole photo (contain). Space mode: the photo is an inset and the real sky
    // continues around it at the same angular scale – a much bigger "heavens screen".
    const s = space ? Math.min((W * 0.36) / img.naturalWidth, (H * 0.62) / img.naturalHeight)
                    : Math.min(W / img.naturalWidth, H / img.naturalHeight);
    const pw = img.naturalWidth * s, ph = img.naturalHeight * s, ox = (W - pw) / 2, oy = space ? (H - ph) * 0.42 : (H - ph) / 2;
    if (!space) {   // ambient fill
      g.save(); g.filter = "blur(18px) brightness(.45)"; const as = Math.max(W / img.naturalWidth, H / img.naturalHeight) * 1.15;
      g.drawImage(img, (W - img.naturalWidth * as) / 2, (H - img.naturalHeight * as) / 2, img.naturalWidth * as, img.naturalHeight * as); g.restore();
    }
    const portrait = img.naturalHeight >= img.naturalWidth;
    const hfov = portrait ? 53 : 67, vfov = portrait ? 67 : 53;      // phone main camera (~26 mm equiv.)
    const sun = bodies(view.time, view.lat, view.lon).find((b) => b.name === "Sun");
    const info = { hfov, vfov, sunAlt: sun ? sun.alt : null, inView: [], mask: null };
    if (view.mode === "photo" || !catalog) { g.drawImage(img, ox, oy, pw, ph); return info; }

    // 1) darkened photo (frame, buildings)
    g.save(); g.filter = "brightness(.42) saturate(.7) contrast(1.1)"; g.drawImage(img, ox, oy, pw, ph); g.restore();
    // 2) sky layer
    const sky = document.createElement("canvas"); sky.width = W; sky.height = H;
    const k = sky.getContext("2d");
    const grad = k.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, "#000106"); grad.addColorStop(0.7, "#060a22"); grad.addColorStop(1, "#141838");
    k.fillStyle = grad; k.fillRect(0, 0, W, H);
    const proj0 = camera(view.az, view.el, hfov, vfov, pw, ph), proj = (v) => { const p = proj0(v); return p && [p[0] + ox, p[1] + oy]; };
    const lst = lstDeg(view.time, view.lon), inside = (p, m = 0) => p && p[0] > -m && p[0] < W + m && p[1] > -m && p[1] < H + m;
    const scale = Math.max(0.9, H / 520), place = placer();
    // constellation lines + names
    k.lineWidth = 1.2 * scale; k.strokeStyle = "rgba(125,252,255,.38)";
    catalog.cons.forEach((c) => {
      c.l.forEach((seg) => {
        k.beginPath(); let started = false;
        seg.forEach(([ra, dec]) => {
          const p = proj(horizVec(ra, dec, view.lat, lst));
          if (!p) { started = false; return; }
          if (started) k.lineTo(p[0], p[1]); else { k.moveTo(p[0], p[1]); started = true; }
        });
        k.stroke();
      });
      const cv = horizVec(c.p[0], c.p[1], view.lat, lst), p = proj(cv);
      if (inside(p, -20) && altOf(cv) > 0) {
        k.fillStyle = "rgba(125,252,255,.55)"; k.font = `600 ${Math.round(10 * scale)}px ui-monospace,monospace`; k.textAlign = "center";
        const y = place(p[0] - 40 * scale, p[1], 80 * scale, 11 * scale);
        k.fillText(c.n.toUpperCase(), p[0], y); info.inView.push({ type: "constellation", name: c.n });
      }
    });
    // stars – bright, glowing, the brightest with light rays
    const objects = []; info.objects = objects;
    if (!catalog.conName) { catalog.conName = {}; catalog.cons.forEach((c) => (catalog.conName[c.id] = c.n)); }
    catalog.stars.forEach(([ra, dec, mag, bv, name, desig, con, hip]) => {
      const sv = horizVec(ra, dec, view.lat, lst), p = proj(sv);
      if (!inside(p) || altOf(sv) < -1) return;           // below the horizon: hidden by the Earth
      const r = Math.max(1.2, (7.4 - mag) * 0.9) * scale, col = bvColor(bv);
      if (mag < 5) {                                       // soft halo on every visible star
        const hr = r * (mag < 2 ? 5 : mag < 3.5 ? 3.2 : 2.1);
        const halo = k.createRadialGradient(p[0], p[1], 0, p[0], p[1], hr);
        halo.addColorStop(0, col.replace("rgb", "rgba").replace(")", mag < 2.5 ? ",.7)" : mag < 3.5 ? ",.45)" : ",.28)")); halo.addColorStop(1, "rgba(0,0,0,0)");
        k.fillStyle = halo; k.beginPath(); k.arc(p[0], p[1], hr, 0, 2 * Math.PI); k.fill();
      }
      if (mag < 2.5) {                                     // diffraction spikes
        k.strokeStyle = col.replace("rgb", "rgba").replace(")", ",.7)"); k.lineWidth = Math.max(1, scale * 0.8);
        const L = r * 5;
        k.beginPath(); k.moveTo(p[0] - L, p[1]); k.lineTo(p[0] + L, p[1]); k.moveTo(p[0], p[1] - L); k.lineTo(p[0], p[1] + L); k.stroke();
      }
      k.fillStyle = col; k.shadowColor = col; k.shadowBlur = (mag < 2.5 ? 10 : 4) * scale;
      k.beginPath(); k.arc(p[0], p[1], r, 0, 2 * Math.PI); k.fill(); k.shadowBlur = 0;
      k.fillStyle = "#fff"; k.beginPath(); k.arc(p[0], p[1], r * 0.45, 0, 2 * Math.PI); k.fill();   // hot core
      const az = (Math.atan2(sv[0], sv[1]) * R2D + 360) % 360;
      objects.push({ type: "star", x: p[0], y: p[1], r, mag, bv, name, desig, con, conName: catalog.conName[con] || con, hip,
                     alt: altOf(sv), az, ra, dec });
      if (name && mag < 2.3) {
        k.fillStyle = "rgba(255,255,255,.85)"; k.font = `${Math.round(11 * scale)}px -apple-system,sans-serif`; k.textAlign = "left";
        const y = place(p[0] + r + 4, p[1] + 4, name.length * 6.5 * scale, 12 * scale);
        k.fillText(name, p[0] + r + 4, y); info.inView.push({ type: "star", name, mag });
      }
    });
    // Sun, Moon, planets
    bodies(view.time, view.lat, view.lon).forEach((b) => {
      const p = proj(vecAzAlt(b.az, b.alt));
      if (!inside(p) || b.alt < -1) return;
      const big = b.name === "Sun" || b.name === "Moon", r = (big ? 9 : 4) * scale;
      k.save();
      k.fillStyle = b.name === "Sun" ? "#ffd75e" : b.name === "Moon" ? "#e9edf7" : "#ffc6f0";
      k.shadowColor = k.fillStyle; k.shadowBlur = (big ? 24 : 10) * scale;
      k.beginPath(); k.arc(p[0], p[1], r, 0, 2 * Math.PI); k.fill(); k.restore();
      if (b.name === "Moon") {          // simple phase shading
        const ph = b.phase * D2R, lit = (1 - Math.cos(ph)) / 2;
        k.save(); k.globalAlpha = 0.85; k.fillStyle = "#0a1030"; k.beginPath();
        k.ellipse(p[0] + (b.phase < 180 ? -1 : 1) * r * lit * 2, p[1], r, r, 0, 0, 2 * Math.PI); k.fill(); k.restore();
      }
      const ill = window.Astronomy && b.name !== "Sun" ? Astronomy.Illumination(b.name, view.time) : null;
      objects.push({ type: "body", x: p[0], y: p[1], r: r * 1.5, name: b.name, sym: b.sym, alt: b.alt, az: b.az, phase: b.phase,
                     mag: ill ? ill.mag : -26.7, distAU: ill ? ill.geo_dist : 1 });
      k.fillStyle = "#ff9be6"; k.font = `700 ${Math.round(11 * scale)}px ui-monospace,monospace`; k.textAlign = "left";
      const label = `${b.sym} ${b.name.toUpperCase()}`;
      const y = place(p[0] + r + 5, p[1] + 4, label.length * 7.5 * scale, 13 * scale);
      k.fillText(label, p[0] + r + 5, y);
      info.inView.push({ type: "body", name: b.name, alt: b.alt });
    });
    // 3) keep the sky only where the photo shows open sky
    const m = skyMask(img, img.naturalWidth, img.naturalHeight);
    const mk = document.createElement("canvas"); mk.width = W; mk.height = H;
    const mg = mk.getContext("2d");
    mg.fillStyle = "#fff"; mg.fillRect(0, 0, W, H); mg.clearRect(ox, oy, pw, ph);          // open sky around the photo
    if (m) { info.mask = m.coverage; mg.save(); mg.filter = `blur(${Math.max(1, pw / 300)}px)`; mg.drawImage(m.canvas, ox, oy, pw, ph); mg.restore(); }
    else { mg.fillRect(ox, oy, pw, ph * 0.6); }
    k.globalCompositeOperation = "destination-in"; k.drawImage(mk, 0, 0); k.globalCompositeOperation = "source-over";
    info.visibleAt = (x, y) => { try { return mg.getImageData(Math.round(x), Math.round(y), 1, 1).data[3] > 60; } catch (_) { return true; } };
    g.drawImage(sky, 0, 0);
    // horizon and ground around the photo (below altitude 0)
    const hz = [];
    for (let a = -100; a <= 100; a += 4) { const p = proj(vecAzAlt(view.az + a, 0)); if (p) hz.push(p); }
    if (hz.length > 1) {
      g.save(); g.beginPath(); g.rect(0, 0, W, H); g.rect(ox, oy, pw, ph); g.clip("evenodd");
      g.beginPath(); g.moveTo(hz[0][0], hz[0][1]); hz.forEach((p) => g.lineTo(p[0], p[1]));
      g.lineTo(hz[hz.length - 1][0], H + 10); g.lineTo(hz[0][0], H + 10); g.closePath();
      const gy = Math.min(...hz.map((p) => p[1])), gg = g.createLinearGradient(0, gy, 0, H);
      gg.addColorStop(0, "#1a2140"); gg.addColorStop(0.08, "#0b0f1f"); gg.addColorStop(1, "#04060c");
      g.fillStyle = gg; g.fill();
      g.beginPath(); g.moveTo(hz[0][0], hz[0][1]); hz.forEach((p) => g.lineTo(p[0], p[1]));
      g.strokeStyle = "rgba(125,252,255,.55)"; g.lineWidth = 1.5 * scale; g.shadowColor = "#7dfcff"; g.shadowBlur = 12 * scale; g.stroke();
      g.restore();
      // compass labels along the horizon
      g.save(); g.fillStyle = "rgba(125,252,255,.7)"; g.font = `700 ${Math.round(11 * scale)}px ui-monospace,monospace`; g.textAlign = "center";
      ["N", "NE", "E", "SE", "S", "SW", "W", "NW"].forEach((n, i) => {
        const p = proj(vecAzAlt(i * 45, 0)); if (p && p[0] > 10 && p[0] < W - 10 && !(p[0] > ox && p[0] < ox + pw && p[1] > oy && p[1] < oy + ph)) g.fillText(n, p[0], p[1] + 16 * scale);
      });
      g.restore();
    }
    // the window photo as a glowing porthole
    g.save(); g.strokeStyle = "rgba(255,107,214,.75)"; g.lineWidth = 2 * scale; g.shadowColor = "#ff6bd6"; g.shadowBlur = 16 * scale;
    g.strokeRect(ox, oy, pw, ph); g.restore();
    info.photoRect = [ox, oy, pw, ph];
    return info;
  }

  // B–V colour index → surface temperature (Ballesteros 2012) and spectral class
  function starPhysics(bv) {
    const T = 4600 * (1 / (0.92 * bv + 1.7) + 1 / (0.92 * bv + 0.62));
    const cls = bv < -0.02 ? ["B", "blue-white"] : bv < 0.3 ? ["A", "white"] : bv < 0.58 ? ["F", "yellow-white"]
              : bv < 0.81 ? ["G", "yellow (like the Sun)"] : bv < 1.4 ? ["K", "orange"] : ["M", "red"];
    return { tempK: Math.round(T / 100) * 100, cls: cls[0], colour: cls[1] };
  }
  window.SpaceshipSky = { load, render, bodies, starPhysics, bvColor };
})();
