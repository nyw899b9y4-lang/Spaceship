// Spaceship launch view: an old-school pixel-art top view generated from the building outline,
// and a cockpit view built from the window photos. Uses the in-page `state` from index.html.
"use strict";
(function () {
  const D2R = Math.PI / 180, R2D = 180 / Math.PI;
  const W = 240, H = 150;                       // logical pixel-art resolution (scaled up crisp)
  const PAL = {
    space: "#141127", star1: "#ffffff", star2: "#8f8bb8", star3: "#4b4775",
    outline: "#2a0d14", hullDark: "#7a2a22", hull: "#c4452f", hullLight: "#e8714f", hullHi: "#ffb08a",
    stripe: "#f4a640", panel: "#9c3427", rivet: "#ffd2b0", metal: "#5a5f74", metalLight: "#9aa1b8", metalDark: "#2c2f3d",
    glass: "#3e6fd0", glassHi: "#9cc4ff", port: "#ff6bd6", portHi: "#ffd1f3", flame1: "#8ff7ff", flame2: "#36c9d8", flame3: "#1f7f9c",
    laser: "#7dfcff",
  };
  let ui = null, cur = null, raf = 0, ship = null, stars = [], lasers = [], t0 = 0, active = 0, radarSweep = 0;

  // ---------- geometry: local metres, principal axis ----------
  function localXY(lat, lon, ref) {
    return [(lon - ref[1]) * D2R * 6371008.8 * Math.cos(ref[0] * D2R), (lat - ref[0]) * D2R * 6371008.8];
  }
  function outlineRing(st) {
    if (st.building && st.building.ring && st.building.ring.length > 3) return st.building.ring;
    // no outline: invent a capsule around the windows / address so there is always a ship
    const c = [st.address.lat, st.address.lon], pts = [];
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * 2 * Math.PI, x = Math.cos(a) * 14, y = Math.sin(a) * 7;
      pts.push([c[0] + (y / 6371008.8) * R2D, c[1] + (x / (6371008.8 * Math.cos(c[0] * D2R))) * R2D]);
    }
    pts.push(pts[0]); return pts;
  }
  function buildShip(st) {
    const ringLL = outlineRing(st);
    const ref = ringLL.reduce((s, p) => [s[0] + p[0] / ringLL.length, s[1] + p[1] / ringLL.length], [0, 0]);
    const ring = ringLL.map(([a, b]) => localXY(a, b, ref));
    // dominant wall direction (length-weighted, modulo 90°) → walls become clean horizontal/vertical pixel lines
    let C = 0, S = 0;
    for (let i = 0; i < ring.length - 1; i++) {
      const dx = ring[i + 1][0] - ring[i][0], dy = ring[i + 1][1] - ring[i][1], l = Math.hypot(dx, dy), a = Math.atan2(dy, dx);
      C += l * Math.cos(4 * a); S += l * Math.sin(4 * a);
    }
    let theta = Math.atan2(S, C) / 4;
    const rotBy = (th) => ([x, y]) => [x * Math.cos(-th) - y * Math.sin(-th), x * Math.sin(-th) + y * Math.cos(-th)];
    const extent = (th) => { const q = ring.map(rotBy(th)); const xs = q.map((p) => p[0]), ys = q.map((p) => p[1]);
      return (Math.max(...xs) - Math.min(...xs)) / (Math.max(...ys) - Math.min(...ys) || 1); };
    if (extent(theta) < 1) theta += Math.PI / 2;            // long side horizontal: the ship flies sideways like an arcade shooter
    const rot = rotBy(theta);
    let R = ring.map(rot);
    const xs = R.map((p) => p[0]), ys = R.map((p) => p[1]);
    const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
    const len = maxX - minX, wid = maxY - minY;
    const scale = Math.min(150 / len, 96 / wid);                 // pixels per metre
    const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;
    const toPx = ([x, y]) => [Math.round(W / 2 - 6 + (x - cx) * scale), Math.round(H / 2 - (y - cy) * scale)];
    const poly = R.map(toPx);
    // rasterise
    const gx0 = Math.min(...poly.map((p) => p[0])) - 1, gx1 = Math.max(...poly.map((p) => p[0])) + 1;
    const gy0 = Math.min(...poly.map((p) => p[1])) - 1, gy1 = Math.max(...poly.map((p) => p[1])) + 1;
    const inside = (px, py) => {
      let c = false;
      for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
        const [xi, yi] = poly[i], [xj, yj] = poly[j];
        if ((yi > py) !== (yj > py) && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) c = !c;
      }
      return c;
    };
    const mask = new Set(), key = (x, y) => x + "," + y;
    for (let y = gy0; y <= gy1; y++) for (let x = gx0; x <= gx1; x++) if (inside(x + 0.5, y + 0.5)) mask.add(key(x, y));
    const has = (x, y) => mask.has(key(x, y));
    // static hull sprite
    const cv = document.createElement("canvas"); cv.width = W; cv.height = H;
    const g = cv.getContext("2d");
    const put = (x, y, c) => { g.fillStyle = c; g.fillRect(x, y, 1, 1); };
    let seed = 7; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    const rows = {};
    mask.forEach((k) => { const [x, y] = k.split(",").map(Number); (rows[y] = rows[y] || []).push(x); });
    const midY = Math.round((gy0 + gy1) / 2);
    mask.forEach((k) => {
      const [x, y] = k.split(",").map(Number);
      const edge = !has(x - 1, y) || !has(x + 1, y) || !has(x, y - 1) || !has(x, y + 1);
      if (edge) return put(x, y, PAL.outline);
      const top = !has(x, y - 2), bottom = !has(x, y + 2), left = !has(x - 2, y);
      let c = y < midY ? PAL.hullLight : PAL.hull;
      if (top || left) c = PAL.hullHi;
      else if (bottom) c = PAL.hullDark;
      else if ((x - gx0) % 14 === 0 && Math.abs(y - midY) > 1) c = PAL.panel;    // panel seams
      else if (y === midY && (x - gx0) % 14 > 2) c = PAL.stripe;                  // racing stripe
      else if ((x - gx0) % 14 === 3 && (y - gy0) % 6 === 3) c = PAL.rivet;        // rivet rows
      put(x, y, c);
    });
    // engines on the rear (left) edge
    // only rows whose hull starts at the rear edge get an engine
    const minCol = Math.min(...Object.values(rows).map((r) => Math.min(...r)));
    const rearRows = Object.keys(rows).map(Number).filter((y) => Math.min(...rows[y]) <= minCol + 2).sort((a, b) => a - b);
    const ry0 = rearRows[0], ry1 = rearRows[rearRows.length - 1], span = ry1 - ry0;
    const nEng = span > 30 ? 3 : span > 12 ? 2 : 1;
    const engRows = Array.from({ length: nEng }, (_, k) => {
      const want = Math.round(ry0 + ((k + 1) / (nEng + 1)) * span);
      return rearRows.reduce((b, y) => (Math.abs(y - want) < Math.abs(b - want) ? y : b), rearRows[0]);
    });
    const engines = [];
    engRows.forEach((ey) => {
      const r = rows[ey]; if (!r) return;
      const lx = Math.min(...r);
      for (let dy = -1; dy <= 1; dy++) for (let dx = 1; dx <= 4; dx++) put(lx - dx, ey + dy, dx === 4 ? PAL.metalDark : dy === -1 ? PAL.metalLight : PAL.metal);
      engines.push([lx - 5, ey]);
    });
    // canopy near the nose (right end)
    const nr = rows[midY] || rows[midY + 1];
    if (nr) {
      const nx = Math.max(...nr) - 9;
      for (let dy = -2; dy <= 2; dy++) for (let dx = -4; dx <= 4; dx++) {
        if ((dx * dx) / 20 + (dy * dy) / 5 <= 1 && has(nx + dx, midY + dy) && has(nx + dx + 2, midY + dy))
          put(nx + dx, midY + dy, dx > 1 && dy < 0 ? PAL.glassHi : PAL.glass);
      }
    }
    // windows → ports + turrets (real view directions rotated into ship frame)
    const ports = st.windows.map((w, i) => {
      const [x, y] = rot(localXY(w.lat, w.lon, ref));
      const [px, py] = toPx([x, y]);
      const az = w.wall_azimuth_deg != null ? w.wall_azimuth_deg : (w.capture && w.capture.camera_azimuth_deg);
      let dir = null;
      if (az != null) {
        const v = rot([Math.sin(az * D2R), Math.cos(az * D2R)]);   // east,north → ship frame
        const n = Math.hypot(v[0], v[1]); dir = [v[0] / n, -v[1] / n]; // screen y down
      }
      return { i, x: px, y: py, dir, az };
    });
    ports.forEach((p) => {
      if (p.dir) for (let s = 1; s <= 4; s++) put(Math.round(p.x + p.dir[0] * s), Math.round(p.y + p.dir[1] * s), s === 4 ? PAL.metalLight : PAL.metal);
    });
    return { sprite: cv, ports, engines, theta, ringPx: poly, northUp: [Math.sin(theta), -Math.cos(theta)], gy0, gy1 };
  }

  // ---------- pixel view animation ----------
  function initStars() {
    stars = Array.from({ length: 90 }, () => ({ x: Math.random() * W, y: Math.random() * H, z: 1 + Math.floor(Math.random() * 3) }));
  }
  function frame(ts) {
    if (!ui) return;
    const t = (ts - t0) / 1000, g = ui.ctx;
    g.fillStyle = PAL.space; g.fillRect(0, 0, W, H);
    stars.forEach((s) => {
      s.x -= s.z * 0.35; if (s.x < 0) { s.x = W; s.y = Math.random() * H; }
      g.fillStyle = s.z === 3 ? PAL.star1 : s.z === 2 ? PAL.star2 : PAL.star3; g.fillRect(Math.round(s.x), Math.round(s.y), 1, 1);
    });
    const bob = Math.round(Math.sin(t * 2) * 1);
    // engine flames
    ship.engines.forEach(([ex, ey], k) => {
      const L = 3 + Math.round((Math.sin(t * 22 + k * 2) + 1) * 2);
      for (let i = 0; i < L; i++) {
        g.fillStyle = i < 2 ? PAL.flame1 : i < 4 ? PAL.flame2 : PAL.flame3;
        g.fillRect(ex - i, ey + bob, 1, 1);
        if (i < 3) { g.fillRect(ex - i, ey - 1 + bob, 1, 1); g.fillRect(ex - i, ey + 1 + bob, 1, 1); }
      }
      if (Math.random() < 0.5) { g.fillStyle = PAL.flame3; g.fillRect(ex - L - Math.floor(Math.random() * 6), ey + bob + Math.round(Math.random() * 2 - 1), 1, 1); }
    });
    g.drawImage(ship.sprite, 0, bob);
    // ports glow, active one blinks
    ship.ports.forEach((p) => {
      const on = p.i === active ? Math.sin(t * 8) > -0.3 : true;
      if (p.i === active) { g.fillStyle = "rgba(255,107,214,0.35)"; g.fillRect(p.x - 3, p.y - 3 + bob, 7, 7); }
      g.fillStyle = PAL.outline; g.fillRect(p.x - 2, p.y - 2 + bob, 5, 5);
      g.fillStyle = on ? (p.i === active ? PAL.portHi : PAL.port) : PAL.outline;
      g.fillRect(p.x - 1, p.y - 1 + bob, 3, 3);
      g.fillStyle = "#fff"; if (on) g.fillRect(p.x - 1, p.y - 1 + bob, 1, 1);
    });
    // lasers along real view directions
    if (Math.random() < 0.04) {
      const p = ship.ports[Math.floor(Math.random() * ship.ports.length)];
      if (p && p.dir) lasers.push({ x: p.x + p.dir[0] * 5, y: p.y + p.dir[1] * 5 + bob, dx: p.dir[0], dy: p.dir[1], life: 34 });
    }
    lasers = lasers.filter((l) => l.life-- > 0);
    lasers.forEach((l) => {
      l.x += l.dx * 3; l.y += l.dy * 3;
      g.fillStyle = PAL.laser;
      for (let k = 0; k < 3; k++) g.fillRect(Math.round(l.x - l.dx * k), Math.round(l.y - l.dy * k), 1, 1);
    });
    // radar in cockpit
    drawRadar(t);
    raf = requestAnimationFrame(frame);
  }

  // ---------- cockpit ----------
  const compass = (az) => ["N", "NE", "E", "SE", "S", "SW", "W", "NW"][Math.round(az / 45) % 8];
  function selectWindow(i, st) {
    active = i; const w = st.windows[i], c = w.capture || {};
    const az = w.wall_azimuth_deg != null ? w.wall_azimuth_deg : c.camera_azimuth_deg;
    const tilt = c.camera_elevation_deg;
    ui.view.innerHTML = "";
    if (w.photo && w.photo.url) {   // whole photo (window frame stays visible) over a blurred, cropped copy
      ui.view.innerHTML = `<img class="ck-ambient" src="${w.photo.url}" alt=""><img class="ck-photo" src="${w.photo.url}" alt="">`;
    }
    else ui.view.innerHTML = '<div class="nosignal">NO SIGNAL</div>';
    const floor = Number(document.getElementById("floor").value) || 0;
    ui.q("#ck-name").textContent = (w.label || "Window " + (i + 1)).toUpperCase();
    ui.q("#ck-hdg").textContent = az != null ? `${String(Math.round(az)).padStart(3, "0")}° ${compass(az)}` : "---";
    ui.q("#ck-tilt").textContent = tilt != null ? `${tilt >= 0 ? "+" : ""}${Math.round(tilt)}°` : "--";
    ui.q("#ck-alt").textContent = `DECK ${floor} · ~${Math.max(0, floor * 3 + 1.5).toFixed(0)} M`;
    ui.q("#ck-pos").textContent = `${w.lat.toFixed(5)}N ${w.lon.toFixed(5)}E`;
    ui.q("#ck-src").textContent = w.wall_azimuth_deg != null ? "HDG FROM HULL (MAP)" : c.camera_azimuth_deg != null ? "HDG FROM PHONE COMPASS" : "HDG UNKNOWN";
    drawTape(az);
    // horizon line tilts with the recorded camera elevation
    ui.q("#ck-horizon").style.transform = `translateY(${tilt != null ? Math.max(-40, Math.min(40, tilt * 2.2)) : 0}%)`;
    ui.qa(".ck-win").forEach((b, k) => b.classList.toggle("on", k === i));
  }
  function drawTape(az) {
    const tape = ui.q("#ck-tape"); tape.innerHTML = "";
    if (az == null) { tape.innerHTML = '<span class="tk lbl" style="left:50%">NO HEADING</span>'; return; }
    for (let d = -45; d <= 45; d += 5) {
      const v = (Math.round(az / 5) * 5 + d + 360) % 360, off = ((v - az + 540) % 360) - 180;
      const left = 50 + (off / 45) * 50; if (left < 0 || left > 100) continue;
      const major = v % 15 === 0, label = v % 45 === 0 ? compass(v) : major ? String(v) : "";
      tape.insertAdjacentHTML("beforeend", `<span class="tk${major ? " maj" : ""}" style="left:${left}%"></span>` +
        (label ? `<span class="tk lbl" style="left:${left}%">${label}</span>` : ""));
    }
  }
  function drawRadar(t) {
    const cv = ui.radar, g = cv.getContext("2d"), S = cv.width, st = cur;
    g.clearRect(0, 0, S, S);
    g.strokeStyle = "rgba(125,252,255,.25)"; g.lineWidth = 1;
    [0.2, 0.33, 0.46].forEach((r) => { g.beginPath(); g.arc(S / 2, S / 2, S * r, 0, 2 * Math.PI); g.stroke(); });
    const ring = outlineRing(st), ref = ring[0];
    const pts = ring.map(([a, b]) => localXY(a, b, ref));
    const ext = Math.max(...pts.map(([x, y]) => Math.max(Math.abs(x), Math.abs(y)))) || 10;
    const cxy = pts.reduce((s, p) => [s[0] + p[0] / pts.length, s[1] + p[1] / pts.length], [0, 0]);
    const k = (S * 0.28) / ext, P = ([x, y]) => [S / 2 + (x - cxy[0]) * k, S / 2 - (y - cxy[1]) * k];
    // view cone of the active window (≈ 65° phone field of view)
    const w = st.windows[active];
    if (w) {
      const az = w.wall_azimuth_deg != null ? w.wall_azimuth_deg : w.capture && w.capture.camera_azimuth_deg;
      const [wx, wy] = P(localXY(w.lat, w.lon, ref));
      if (az != null) {
        const a1 = (az - 32.5 - 90) * D2R, a2 = (az + 32.5 - 90) * D2R;
        const grad = g.createRadialGradient(wx, wy, 0, wx, wy, S * 0.5);
        grad.addColorStop(0, "rgba(255,107,214,.55)"); grad.addColorStop(1, "rgba(255,107,214,0)");
        g.fillStyle = grad; g.beginPath(); g.moveTo(wx, wy); g.arc(wx, wy, S * 0.5, a1, a2); g.closePath(); g.fill();
      }
    }
    g.strokeStyle = "#7dfcff"; g.lineWidth = 1.5; g.beginPath();
    pts.forEach((p, i) => { const [x, y] = P(p); i ? g.lineTo(x, y) : g.moveTo(x, y); }); g.stroke();
    st.windows.forEach((ww, i) => { const [x, y] = P(localXY(ww.lat, ww.lon, ref)); g.fillStyle = i === active ? "#ffd1f3" : "#ff6bd6"; g.fillRect(x - 2, y - 2, 4, 4); });
    // sweep
    radarSweep = (t * 1.4) % (2 * Math.PI);
    g.strokeStyle = "rgba(125,252,255,.6)"; g.beginPath(); g.moveTo(S / 2, S / 2);
    g.lineTo(S / 2 + Math.cos(radarSweep) * S * 0.46, S / 2 + Math.sin(radarSweep) * S * 0.46); g.stroke();
    g.fillStyle = "#7dfcff"; g.font = "bold 9px ui-monospace,monospace"; g.textAlign = "center"; g.fillText("N", S / 2, 10);
  }

  // ---------- mount ----------
  function mount(root, st) {
    const floor = Number(document.getElementById("floor").value) || 0;
    const name = (st.address.label || "").split(/[,·]/)[0].toUpperCase();
    root.innerHTML = `
      <div class="lv-grid">
        <div class="lv-pixel">
          <canvas width="${W}" height="${H}"></canvas>
          <div class="lv-hud lv-tl">${String(Math.round(st.windows.length * 1000 + floor * 137 + 4242)).padStart(5, "0")}</div>
          <div class="lv-hud lv-tr">DECK ${floor}</div>
          <div class="lv-hud lv-bl">${name.slice(0, 26)}</div>
          <div class="lv-hud lv-br">PORTS ${st.windows.length}</div>
        </div>
        <div class="lv-cockpit">
          <div class="ck-view" id="ck-view"></div>
          <div class="ck-horizon" id="ck-horizon"></div>
          <div class="ck-scan"></div>
          <svg class="ck-frame" viewBox="0 0 1000 640" preserveAspectRatio="none" aria-hidden="true">
            <defs><linearGradient id="ckm" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#1b2338"/><stop offset="1" stop-color="#080b14"/></linearGradient></defs>
            <path d="M0 0 H1000 V70 Q760 32 500 30 Q240 32 0 70 Z" fill="url(#ckm)"/>
            <path d="M0 0 V640 H70 L170 70 Q90 60 0 70 Z" fill="url(#ckm)"/>
            <path d="M1000 0 V640 H930 L830 70 Q910 60 1000 70 Z" fill="url(#ckm)"/>
            <path d="M0 470 Q500 420 1000 470 V640 H0 Z" fill="url(#ckm)"/>
            <path d="M170 70 Q500 18 830 70" stroke="#7dfcff" stroke-opacity=".35" stroke-width="2" fill="none"/>
            <path d="M170 70 L80 470 M830 70 L920 470" stroke="#7dfcff" stroke-opacity=".25" stroke-width="2"/>
            <path d="M0 470 Q500 420 1000 470" stroke="#7dfcff" stroke-opacity=".45" stroke-width="2" fill="none"/>
          </svg>
          <div class="ck-tape" id="ck-tape"></div>
          <div class="ck-reticle"><span></span></div>
          <div class="ck-side ck-left"><b id="ck-name">–</b><span>HDG <i id="ck-hdg">–</i></span><span>TILT <i id="ck-tilt">–</i></span></div>
          <div class="ck-side ck-right"><span id="ck-alt">–</span><span id="ck-pos">–</span><span id="ck-src">–</span></div>
          <div class="ck-dash">
            <div class="ck-panel ck-wins"></div>
            <canvas class="ck-radar" width="120" height="120"></canvas>
            <div class="ck-panel ck-clock"><span id="ck-time">--:--</span><small>SHIP TIME</small></div>
          </div>
        </div>
      </div>`;
    const q = (s) => root.querySelector(s), qa = (s) => root.querySelectorAll(s);
    const cvs = root.querySelector(".lv-pixel canvas"), ctx = cvs.getContext("2d");
    ctx.imageSmoothingEnabled = false;
    ui = { root, q, qa, ctx, view: q("#ck-view"), radar: q(".ck-radar") }; cur = st;
    const wins = q(".ck-wins");
    st.windows.forEach((w, i) => {
      const b = document.createElement("button"); b.className = "ck-win"; b.textContent = String(i + 1);
      b.title = w.label || "Window " + (i + 1); b.addEventListener("click", () => selectWindow(i, st)); wins.appendChild(b);
    });
    // tap a port on the pixel ship to switch the cockpit view
    cvs.addEventListener("click", (e) => {
      const r = cvs.getBoundingClientRect(), x = ((e.clientX - r.left) / r.width) * W, y = ((e.clientY - r.top) / r.height) * H;
      let best = -1, bd = 12;
      ship.ports.forEach((p) => { const d = Math.hypot(p.x - x, p.y - y); if (d < bd) { bd = d; best = p.i; } });
      if (best >= 0) selectWindow(best, st);
    });
    const tick = () => { if (ui) { ui.q("#ck-time").textContent = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }); } };
    tick(); ui.clock = setInterval(tick, 10000);
    ship = buildShip(st); initStars(); lasers = []; active = 0;
    selectWindow(0, st);
    t0 = performance.now(); cancelAnimationFrame(raf); raf = requestAnimationFrame(frame);
  }
  function unmount() { cancelAnimationFrame(raf); if (ui && ui.clock) clearInterval(ui.clock); ui = null; }

  window.SpaceshipLaunch = { mount, unmount };
})();
