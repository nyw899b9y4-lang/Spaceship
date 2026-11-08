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
    // roof → hull: with the satellite roof brightness (lumAt) the real roof features become hull shading
    const ROOF = [PAL.outline, PAL.hullDark, PAL.panel, PAL.hull, PAL.hullLight, PAL.hullHi];
    const BAYER = [[0, 2], [3, 1]];
    function paintHull(lumAt) {
      mask.forEach((k) => {
        const [x, y] = k.split(",").map(Number);
        const edge = !has(x - 1, y) || !has(x + 1, y) || !has(x, y - 1) || !has(x, y + 1);
        if (edge) return put(x, y, PAL.outline);
        const top = !has(x, y - 2), bottom = !has(x, y + 2), left = !has(x - 2, y);
        let c;
        if (lumAt) {
          const l = lumAt(x, y);                                         // 0..1, normalised over the roof
          const v = l * (ROOF.length - 1.01) + (BAYER[y & 1][x & 1] / 4 - 0.375) * 0.9;   // ordered dithering
          c = ROOF[Math.max(1, Math.min(ROOF.length - 1, Math.floor(v + 0.5)))];
          if (top || left) c = l > 0.35 ? PAL.hullHi : PAL.hullLight;
          else if (bottom) c = PAL.hullDark;
          else if (y === midY && (x - gx0) % 14 > 2 && l > 0.3) c = PAL.stripe;
        } else {
          c = y < midY ? PAL.hullLight : PAL.hull;
          if (top || left) c = PAL.hullHi;
          else if (bottom) c = PAL.hullDark;
          else if ((x - gx0) % 14 === 0 && Math.abs(y - midY) > 1) c = PAL.panel;    // panel seams
          else if (y === midY && (x - gx0) % 14 > 2) c = PAL.stripe;                  // racing stripe
          else if ((x - gx0) % 14 === 3 && (y - gy0) % 6 === 3) c = PAL.rivet;        // rivet rows
        }
        put(x, y, c);
      });
    }
    paintHull(null);
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
    const paintCanopy = () => { if (nr) {
      const nx = Math.max(...nr) - 9;
      for (let dy = -2; dy <= 2; dy++) for (let dx = -4; dx <= 4; dx++) {
        if ((dx * dx) / 20 + (dy * dy) / 5 <= 1 && has(nx + dx, midY + dy) && has(nx + dx + 2, midY + dy))
          put(nx + dx, midY + dy, dx > 1 && dy < 0 ? PAL.glassHi : PAL.glass);
      }
    } };
    paintCanopy();
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
    const paintTurrets = () => ports.forEach((p) => {
      if (p.dir) for (let s = 1; s <= 4; s++) put(Math.round(p.x + p.dir[0] * s), Math.round(p.y + p.dir[1] * s), s === 4 ? PAL.metalLight : PAL.metal);
    });
    paintTurrets();
    // re-skin the hull from the real roof (satellite canvas aligned to the ship pixels)
    const reskin = (groundCanvas) => {
      try {
        const sm = document.createElement("canvas"); sm.width = W; sm.height = H;
        const sg = sm.getContext("2d"); sg.imageSmoothingEnabled = true; sg.drawImage(groundCanvas, 0, 0, W, H);
        const d = sg.getImageData(0, 0, W, H).data, L = (x, y) => { const i = (y * W + x) * 4; return 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]; };
        const vals = []; mask.forEach((k) => { const [x, y] = k.split(",").map(Number); vals.push(L(x, y)); });
        vals.sort((a, b) => a - b);
        const lo = vals[Math.floor(vals.length * 0.04)], hi = vals[Math.floor(vals.length * 0.96)] || lo + 1;
        g.clearRect(0, 0, W, H); g.drawImage(pristine, 0, 0);
        paintHull((x, y) => Math.max(0, Math.min(1, (L(x, y) - lo) / (hi - lo || 1))));
        paintCanopy(); paintTurrets();
        base = snap();                                   // skinned hull = new base for the modules
        if (lastRes) decorate(lastRes);
        return true;
      } catch (_) { return false; }   // satellite image not readable (no CORS) → keep the plain hull
    };
    // ---- modules from the 200 m composition (solar sails, shield pods, bio-domes, coolant, maglev)
    const snap = () => { const c = document.createElement("canvas"); c.width = W; c.height = H; c.getContext("2d").drawImage(cv, 0, 0); return c; };
    const pristine = snap();          // hull + engines + canopy + turrets, before roof skin and modules
    let base = null, lastRes = null;
    const xsAll = [...mask].map((k) => +k.split(",")[0]), hullMinX = Math.min(...xsAll), hullMaxX = Math.max(...xsAll), HL = hullMaxX - hullMinX;
    const topAt = (x) => { for (let y = gy0; y <= gy1; y++) if (has(x, y)) return y; return null; };
    const botAt = (x) => { for (let y = gy1; y >= gy0; y--) if (has(x, y)) return y; return null; };
    const spanOf = (a, b, f) => { const v = []; for (let x = a; x <= b; x++) { const r = f(x); if (r != null) v.push(r); } return v; };
    const decorate = (res) => {
      lastRes = res;
      if (!base) base = pristine;
      g.clearRect(0, 0, W, H); g.drawImage(base, 0, 0);
      const st = res.stats, caps = new Set(res.capabilities.map((c) => c.id));
      if (caps.has("solar")) {                                            // solar sails = wings above and below
        const x0 = Math.round(hullMinX + HL * 0.36), w = Math.max(10, Math.round(HL * 0.22)), len = Math.min(16, 6 + Math.round(st.energy / 9));
        [-1, 1].forEach((dir) => {
          const edges = spanOf(x0, x0 + w, dir < 0 ? topAt : botAt); if (!edges.length) return;
          const ye = dir < 0 ? Math.min(...edges) : Math.max(...edges);
          for (let k = 1; k <= 2; k++) { put(x0 + Math.round(w / 2), ye + dir * k, PAL.metal); put(x0 + Math.round(w / 2) + 1, ye + dir * k, PAL.metalDark); }
          for (let yy = 3; yy < 3 + len; yy++) for (let xx = 0; xx < w; xx++) {
            const edge = xx === 0 || xx === w - 1 || yy === 3 || yy === 2 + len, grid = xx % 4 === 0 || yy % 3 === 0;
            put(x0 + xx, ye + dir * yy, edge ? PAL.metalDark : grid ? "#2a4a9c" : (xx + yy) % 7 === 0 ? PAL.glassHi : PAL.glass);
          }
        });
      }
      const pods = st.shield >= 70 ? 2 : st.shield >= 45 ? 1 : 0;           // shield pods
      for (let i = 0; i < pods; i++) {
        const px = Math.round(hullMinX + HL * (i === 0 ? 0.14 : 0.74));
        [-1, 1].forEach((dir) => {
          const ye = dir < 0 ? topAt(px + 3) : botAt(px + 3); if (ye == null) return;
          put(px + 3, ye + dir, PAL.metal); put(px + 3, ye + dir * 2, PAL.metal);
          for (let yy = 3; yy <= 6; yy++) for (let xx = 0; xx < 8; xx++) {
            if ((xx === 0 || xx === 7) && (yy === 3 || yy === 6)) continue;
            put(px + xx, ye + dir * yy, yy === 3 || yy === 6 || xx === 0 || xx === 7 ? PAL.outline : yy === (dir < 0 ? 4 : 5) ? PAL.metalLight : "#7dfcff");
          }
        });
      }
      if (caps.has("bio_dome")) {                                          // green bio-domes on the hull
        const n = st.lifeSupport >= 70 ? 3 : st.lifeSupport >= 45 ? 2 : 1;
        for (let i = 0; i < n; i++) {
          const cx = Math.round(hullMinX + HL * (0.2 + 0.17 * i)), top = topAt(cx); if (top == null) continue;
          const cy = top + 5;
          for (let dy = -3; dy <= 3; dy++) for (let dx = -4; dx <= 4; dx++)
            if ((dx * dx) / 16 + (dy * dy) / 9 <= 1 && has(cx + dx, cy + dy) && has(cx + dx, cy + dy - 1))
              put(cx + dx, cy + dy, (dx * dx) / 16 + (dy * dy) / 9 > 0.7 ? "#1f5e2a" : dx < 0 && dy < 0 ? "#c9ffb0" : dy > 0 ? "#2f8f3a" : "#5fd068");
        }
      }
      if (caps.has("hydro")) {                                             // coolant tanks along the bottom
        for (let x = Math.round(hullMinX + HL * 0.3); x <= Math.round(hullMinX + HL * 0.62); x++) {
          const b = botAt(x); if (b == null || !has(x, b - 4)) continue;
          put(x, b - 3, "#2f6fe0"); put(x, b - 4, x % 3 === 0 ? "#9cc4ff" : "#4b8cff");
        }
      }
      if (caps.has("maglev")) {                                            // maglev rails under the hull
        for (let x = Math.round(hullMinX + HL * 0.08); x <= Math.round(hullMinX + HL * 0.92); x++) {
          const b = botAt(x); if (b == null) continue;
          put(x, b + 2, x % 2 ? "#7dfcff" : "#36c9d8"); if (x % 6 === 0) put(x, b + 1, PAL.metal);
        }
      }
    };
    // exact (unrounded) transforms between lat/lon and ship pixels, used by the satellite intro
    const llToPx = (lat, lon) => {
      const [x, y] = rot(localXY(lat, lon, ref));
      return [W / 2 - 6 + (x - cx) * scale, H / 2 - (y - cy) * scale];
    };
    const pxToLL = (px, py) => {
      const xr = (px - (W / 2 - 6)) / scale + cx, yr = -(py - H / 2) / scale + cy;
      const x = xr * Math.cos(theta) - yr * Math.sin(theta), y = xr * Math.sin(theta) + yr * Math.cos(theta);
      return [ref[0] + (y / 6371008.8) * R2D, ref[1] + (x / (6371008.8 * Math.cos(ref[0] * D2R))) * R2D];
    };
    return { sprite: cv, ports, engines, theta, ringPx: poly, northUp: [Math.sin(theta), -Math.cos(theta)], gy0, gy1,
             llToPx, pxToLL, scale, ref, reskin, decorate, baseSprite: () => base || pristine };
  }

  // ---------- take-off intro: satellite image → pixel hull → lift-off ----------
  const K = 4;                                   // hi-res factor of the intro canvas (one ship pixel = 4×4)
  let intro = null;
  function inCH(lat, lon) { return lat > 45.8 && lat < 47.9 && lon > 5.9 && lon < 10.6; }
  function tileUrl(z, x, y, ch) {
    return ch ? `https://wmts.geo.admin.ch/1.0.0/ch.swisstopo.swissimage/default/current/3857/${z}/${x}/${y}.jpeg`
              : `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${z}/${y}/${x}`;
  }
  const lon2g = (lon, z) => ((lon + 180) / 360) * 256 * 2 ** z;
  const lat2g = (lat, z) => { const r = lat * D2R; return ((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * 256 * 2 ** z; };
  const g2lon = (x, z) => (x / (256 * 2 ** z)) * 360 - 180;
  const g2lat = (y, z) => { const n = Math.PI - (2 * Math.PI * y) / (256 * 2 ** z); return R2D * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n))); };
  // render the real satellite image, rotated/scaled exactly like the ship, into a hi-res canvas
  // Render the real satellite image, rotated/scaled exactly like the ship, into a hi-res canvas.
  // F = how much wider than the ship view the canvas reaches (F=8 → 8× wider, using coarser tiles).
  function buildGround(st, sh, F = 1, R = 1) {        // R = extra canvas resolution
    const cv = document.createElement("canvas"); cv.width = W * K * R; cv.height = H * K * R;
    const g = cv.getContext("2d"); g.fillStyle = "#1a1f1a"; g.fillRect(0, 0, cv.width, cv.height);
    const lat0 = st.address.lat, ch = inCH(lat0, st.address.lon);
    const viewM = W / sh.scale, tileM = (40075016 * Math.cos(lat0 * D2R)) / 2 ** 19;
    const zDetail = Math.max(15, Math.min(ch ? 20 : 19, Math.round(19 + Math.log2(tileM / (viewM / 3)))));
    const z = Math.max(12, zDetail - Math.round(Math.log2(F / R)));
    const toCanvas = ([px, py]) => [(W / 2 + (px - W / 2) / F) * K * R, (H / 2 + (py - H / 2) / F) * K * R];
    const corners = [[0, 0], [W, 0], [0, H], [W, H]].map(([x, y]) => sh.pxToLL(W / 2 + (x - W / 2) * F, H / 2 + (y - H / 2) * F));
    const gx = corners.map(([la, lo]) => lon2g(lo, z)), gy = corners.map(([la]) => lat2g(la, z));
    const tx0 = Math.floor(Math.min(...gx) / 256), tx1 = Math.floor(Math.max(...gx) / 256);
    const ty0 = Math.floor(Math.min(...gy) / 256), ty1 = Math.floor(Math.max(...gy) / 256);
    const jobs = [];
    for (let tx = tx0; tx <= tx1; tx++) for (let ty = ty0; ty <= ty1; ty++) {
      jobs.push(new Promise((resolve) => {
        const img = new Image(); img.crossOrigin = "anonymous";
        img.onload = () => {
          const P = (gxp, gyp) => toCanvas(sh.llToPx(g2lat(gyp, z), g2lon(gxp, z)));
          const nw = P(tx * 256, ty * 256), ne = P(tx * 256 + 256, ty * 256), sw = P(tx * 256, ty * 256 + 256);
          g.save();
          g.setTransform((ne[0] - nw[0]) / 256, (ne[1] - nw[1]) / 256, (sw[0] - nw[0]) / 256, (sw[1] - nw[1]) / 256, nw[0], nw[1]);
          g.drawImage(img, -0.5, -0.5, 257, 257);   // tiny overlap hides tile seams
          g.restore(); resolve(true);
        };
        img.onerror = () => resolve(false);
        img.src = tileUrl(z, tx, ty, ch);
      }));
    }
    const timeout = new Promise((r) => setTimeout(() => r("timeout"), 6000));
    return Promise.race([Promise.all(jobs), timeout]).then(() => cv);
  }
  // building outline; m = current magnification of the intro camera (1 = ship scale)
  function ringPath(g, sh, k, m = 1) {
    g.beginPath();
    const ring = outlineRing(cur);
    ring.forEach(([la, lo], i) => {
      const [x, y] = sh.llToPx(la, lo), X = (W / 2 + (x - W / 2) * m) * k, Y = (H / 2 + (y - H / 2) * m) * k;
      i ? g.lineTo(X, Y) : g.moveTo(X, Y);
    });
    g.closePath();
  }
  const ease = (x) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));
  const seg = (t, a, b) => ease((t - a) / (b - a));
  const WIDE = 12;                                 // the approach starts 12× wider than the ship view
  function feather(src) {                          // soft edges so the detail image blends into the wide one
    const c = document.createElement("canvas"); c.width = src.width; c.height = src.height;
    const g = c.getContext("2d"); g.drawImage(src, 0, 0);
    g.globalCompositeOperation = "destination-in";
    const fx = c.width * 0.1, fy = c.height * 0.1;
    const gh = g.createLinearGradient(0, 0, c.width, 0);
    gh.addColorStop(0, "rgba(0,0,0,0)"); gh.addColorStop(fx / c.width, "#000"); gh.addColorStop(1 - fx / c.width, "#000"); gh.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = gh; g.fillRect(0, 0, c.width, c.height);
    const gv = g.createLinearGradient(0, 0, 0, c.height);
    gv.addColorStop(0, "rgba(0,0,0,0)"); gv.addColorStop(fy / c.height, "#000"); gv.addColorStop(1 - fy / c.height, "#000"); gv.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = gv; g.fillRect(0, 0, c.width, c.height);
    return c;
  }
  function startIntro() {
    if (!ui) return;
    const cv = ui.q(".lv-intro"); cv.hidden = false; cv.style.opacity = 1;
    ui.q(".lv-caption").hidden = false; ui.q(".lv-caption").textContent = "ACQUIRING SATELLITE LINK…";
    intro = { t0: null, ground: null, wide: null, ready: false, cv, g: cv.getContext("2d"),
              tmp: document.createElement("canvas"), silhouette: null };
    const g0 = intro.g; g0.fillStyle = PAL.space; g0.fillRect(0, 0, cv.width, cv.height);
    // silhouette of the hull for the lift-off shadow
    const sil = document.createElement("canvas"); sil.width = W; sil.height = H;
    const sg = sil.getContext("2d"); sg.drawImage(ship.sprite, 0, 0); sg.globalCompositeOperation = "source-in";
    sg.fillStyle = "#000"; sg.fillRect(0, 0, W, H); intro.silhouette = sil;
    const detailP = ui.groundP || (ui.groundP = buildGround(cur, ship, 1));
    const midP = ui.midP || (ui.midP = buildGround(cur, ship, 3, 1.5));
    const wideP = ui.wideP || (ui.wideP = buildGround(cur, ship, WIDE, 2));
    Promise.all([detailP, midP, wideP]).then(([c, mid, w]) => {
      if (!ship.reskinned) { ship.reskinned = true; ship.reskin(c); }
      if (!intro) return;
      intro.ground = c; intro.groundSoft = feather(c); intro.mid = feather(mid); intro.wide = w; intro.ready = true;
    });
  }
  // draw a layer that covers `extent`× the ship view, at camera magnification m, centred
  function drawLayer(g, img, extent, m, alpha = 1) {
    const CW = W * K, CH = H * K, s = extent * m;
    g.save(); g.globalAlpha = alpha;
    g.translate(CW / 2, CH / 2); g.scale(s, s); g.translate(-CW / 2, -CH / 2);
    g.drawImage(img, 0, 0, CW, CH); g.restore();
  }
  // geo-referenced north-up image (e.g. the classification overlay) drawn into the intro frame
  function drawGeoImage(g, img, mpp, center, m, alpha) {
    const n = img.width, toCv = (u, v) => {
      const x = (u - n / 2) * mpp, y = -(v - n / 2) * mpp;
      const lat = center.lat + (y / 6371008.8) * R2D, lon = center.lon + (x / (6371008.8 * Math.cos(center.lat * D2R))) * R2D;
      const [px, py] = ship.llToPx(lat, lon);
      return [(W / 2 + (px - W / 2) * m) * K, (H / 2 + (py - H / 2) * m) * K];
    };
    const o = toCv(0, 0), ex = toCv(n, 0), ey = toCv(0, n);
    g.save(); g.globalAlpha = alpha;
    g.setTransform((ex[0] - o[0]) / n, (ex[1] - o[1]) / n, (ey[0] - o[0]) / n, (ey[1] - o[1]) / n, o[0], o[1]);
    g.drawImage(img, 0, 0); g.restore();
  }
  const CAT = [["veg", "GREENERY", "lifeSupport", "LIFE SUPPORT"], ["paved", "STREETS", "speed", "SPEED"], ["roof", "ROOFS", "energy", "ENERGY"],
               ["shade", "SHADE", "stealth", "STEALTH"], ["water", "WATER", "lifeSupport", "COOLING"]];
  function scanHud(t, res, phase, prog) {
    const hud = ui.q(".lv-scanhud"); if (!hud) return;
    hud.hidden = false;
    const share = res && res.satellite && res.satellite.share, o = res && res.osm, st = res && res.stats;
    let html = "";
    if (phase === "scan") {
      html += `<b>SURFACE SCAN · 200 M</b>`;
      CAT.forEach(([k, label]) => {
        const v = share ? Math.round(share[k] * 100 * prog) : 0, c = SpaceshipCompose.CLASS[k];
        html += `<div><s style="background:rgb(${c.join(",")})"></s>${label}<em>${share ? v + "%" : "…"}</em></div>`;
      });
      html += `<b style="margin-top:6px">STRUCTURE SCAN · OSM</b>`;
      if (o) {
        const lines = [`${o.buildings} BUILDINGS`, `Ø ${o.avgLevels ? o.avgLevels.toFixed(1) : "?"} FLOORS`, `${o.roads + o.majorRoads} ROADS · ${o.majorRoads} MAIN`,
          o.tram || o.rail ? `${[o.tram && "TRAM", o.rail && "RAIL"].filter(Boolean).join(" + ")} ✓` : "NO RAIL", `${o.trees} TREES · ${o.parks + o.green} GREEN AREAS`,
          `${o.shops + o.food} SHOPS & CAFÉS`];
        lines.slice(0, Math.max(1, Math.ceil(prog * lines.length))).forEach((l) => (html += `<div>${l}</div>`));
      } else html += `<div class="dim">LINKING TO OPENSTREETMAP…</div>`;
    } else if (phase === "compose") {
      html += `<b>CALCULATING SHIP DNA</b>`;
      const rows = [];
      if (share) CAT.slice(0, 4).forEach(([k, label, sk, slabel]) => rows.push(`${label} ${Math.round(share[k] * 100)}% → ${slabel} ${st[sk]}`));
      if (o) { rows.push(`${o.buildings} BUILDINGS → SHIELD ${st.shield}`); rows.push(`${o.roads + o.majorRoads} ROADS → ACCEL ${st.acceleration}`); }
      const g0 = res.geometry;
      rows.push(`${g0.windows} WINDOWS · ${Math.round(g0.spreadDeg)}° → SENSORS ${st.sensors}`);
      rows.push(`${Math.round(g0.area)} M² × ${g0.levels} DECKS → HULL ${st.hull}`);
      rows.slice(0, Math.max(1, Math.ceil(prog * rows.length))).forEach((r) => (html += `<div>${r}</div>`));
    } else if (phase === "modules") {
      html += `<b>FITTING MODULES</b>`;
      const caps = res ? res.capabilities : [];
      caps.slice(0, Math.max(0, Math.ceil(prog * caps.length))).forEach((c) => (html += `<div class="add">+ ${c.name.toUpperCase()}</div>`));
      if (!caps.length) html += `<div class="dim">NO MODULES</div>`;
    }
    if (hud.innerHTML !== html) hud.innerHTML = html;
  }
  function drawIntro(ts) {
    const it = intro; if (!it || !it.ready) return;
    if (it.t0 == null) { it.t0 = ts; it.last = ts; }
    let t = (ts - it.t0) / 1000;
    const res = ui.spec, g = it.g, CW = W * K, CH = H * K;
    // wait (max 5 s) at the start of the scan until the satellite classification is ready
    if (t > 2 && t < 2.1 && !(res && res.overlay) && (it.waited || 0) < 5) { it.waited = (it.waited || 0) + (ts - it.last) / 1000; it.t0 += ts - it.last; t = (ts - it.t0) / 1000; }
    it.last = ts;
    g.imageSmoothingEnabled = true;
    const cap = ui.q(".lv-caption");
    // Timeline (s): 0–2 approach · 2–6 radar scan of 200 m · 6–8.5 composition (particles + DNA) ·
    //   8.5–10.5 lock-on zoom · 9.8–11.4 surroundings fade · 10.5–11.5 pixelate · 11.1–12.1 hull wipe ·
    //   12.2–13.6 modules · 13.6–14.4 systems · 14.4–15.8 lift-off · 15.6–16.2 hand-over
    const mFit = Math.max(1 / WIDE, Math.min(0.5, (H * 0.86) / (2 * SpaceshipCompose.RADIUS * ship.scale)));
    const a1 = seg(t, 0, 2), a2 = seg(t, 8.5, 10.5);
    const m = Math.exp(Math.log(1 / WIDE) + (Math.log(mFit) - Math.log(1 / WIDE)) * a1 + (Math.log(1) - Math.log(mFit)) * a2);
    const scan = Math.min(1, Math.max(0, (t - 2) / 4)), comp = seg(t, 6, 8.5);
    const pix = seg(t, 10.5, 11.5), dark = seg(t, 9.8, 11.4), wipe = seg(t, 11.1, 12.1), mods = seg(t, 12.2, 13.6), sys = seg(t, 13.6, 14.4);
    const lift = seg(t, 14.4, 15.8), out = seg(t, 15.6, 16.2), groundAlpha = 1 - seg(t, 14.4, 15.2);
    g.fillStyle = PAL.space; g.fillRect(0, 0, CW, CH);
    // --- ground: wide neighbourhood → middle → detailed building area
    if (groundAlpha > 0) {
      if (m < 0.999) {
        if (it.wide) drawLayer(g, it.wide, WIDE, m, groundAlpha);
        if (it.mid) drawLayer(g, it.mid, 3, m, groundAlpha * Math.max(0, Math.min(1, (m - 0.26) / 0.1)));
        drawLayer(g, it.groundSoft, 1, m, groundAlpha * Math.max(0, Math.min(1, (m - 0.45) / 0.2)));
      } else {
        const block = Math.max(1, Math.round(1 + pix * (K - 1)));
        const tw = Math.ceil(CW / block), th = Math.ceil(CH / block);
        it.tmp.width = tw; it.tmp.height = th;
        const tg = it.tmp.getContext("2d"); tg.imageSmoothingEnabled = true; tg.drawImage(it.ground, 0, 0, tw, th);
        g.imageSmoothingEnabled = false;
        g.save(); g.globalAlpha = groundAlpha; g.drawImage(it.tmp, 0, 0, tw, th, 0, 0, CW, CH); g.restore();
      }
      if (dark > 0) {
        g.save(); ringPath(g, ship, K, m); g.rect(CW, 0, -CW, CH); g.clip("evenodd");
        g.fillStyle = `rgba(20,17,39,${0.92 * dark * groundAlpha})`; g.fillRect(0, 0, CW, CH); g.restore();
      }
    }
    // --- radar scan of the 200 m circle: classification colours appear behind the sweep
    const center = res ? res.center : { lat: cur.address.lat, lon: cur.address.lon };
    const [cpx, cpy] = ship.llToPx(center.lat, center.lon);
    const CX = (W / 2 + (cpx - W / 2) * m) * K, CY = (H / 2 + (cpy - H / 2) * m) * K;
    const RR = SpaceshipCompose.RADIUS * ship.scale * m * K, scanVis = Math.min(seg(t, 1.6, 2.2), 1 - seg(t, 8.2, 9.6));
    if (scanVis > 0.01) {
      const ang = -Math.PI / 2 + scan * 2 * Math.PI;
      if (res && res.overlay && scan > 0) {
        g.save(); g.beginPath(); g.moveTo(CX, CY); g.arc(CX, CY, RR, -Math.PI / 2, ang); g.closePath(); g.clip();
        drawGeoImage(g, res.overlay, res.metresPerPx, center, m, 0.72 * scanVis * (1 - comp * 0.6));
        g.restore();
      }
      g.save(); g.globalAlpha = scanVis;
      g.strokeStyle = "rgba(125,252,255,.8)"; g.lineWidth = 2 * K / 2; g.setLineDash([4 * K, 3 * K]);
      g.beginPath(); g.arc(CX, CY, RR, 0, 2 * Math.PI); g.stroke(); g.setLineDash([]);
      if (scan > 0 && scan < 1) {                                  // sweep beam with fading trail
        for (let i = 0; i < 24; i++) {
          const a = ang - i * 0.03; g.strokeStyle = `rgba(125,252,255,${0.9 * (1 - i / 24)})`; g.lineWidth = (i ? 1 : 3) * K / 2;
          g.beginPath(); g.moveTo(CX, CY); g.lineTo(CX + Math.cos(a) * RR, CY + Math.sin(a) * RR); g.stroke();
        }
      }
      g.fillStyle = "rgba(125,252,255,.9)"; g.font = `700 ${5 * K / 2}px ui-monospace,monospace`; g.textAlign = "center";
      g.fillText("200 M", CX, CY - RR - 3 * K / 2);
      g.restore();
    }
    // --- composition: coloured particles stream from the surroundings into the building
    if (comp > 0 && comp < 1 && res && res.satellite) {
      if (!it.parts) {
        it.parts = []; const sh = res.satellite.share;
        CAT.slice(0, 5).forEach(([k]) => { const n = Math.round(sh[k] * 420); for (let i = 0; i < n; i++) {
          const a = Math.random() * 2 * Math.PI, r = Math.sqrt(Math.random()) * 0.95 + 0.05;
          it.parts.push({ k, a, r, d: Math.random() * 0.35 }); } });
      }
      g.save();
      it.parts.forEach((p) => {
        const q = Math.min(1, Math.max(0, (comp - p.d) / (1 - p.d))), e = q * q;
        const r = p.r * (1 - e) * RR, a = p.a + e * 1.2, c = SpaceshipCompose.CLASS[p.k];
        g.fillStyle = `rgba(${c.join(",")},${0.9 * (1 - e * 0.5)})`;
        const sz = K * (2.2 - e * 0.8);
        g.shadowColor = g.fillStyle; g.shadowBlur = K * 2;
        g.fillRect(CX + Math.cos(a) * r - sz / 2, CY + Math.sin(a) * r - sz / 2, sz, sz);
      });
      g.restore();
    }
    // --- target marker
    const glow = (1 - wipe) * (0.6 + 0.4 * Math.sin(t * 9)) * seg(t, 0.8, 1.6);
    if (glow > 0.02) {
      g.save(); g.globalAlpha = glow; ringPath(g, ship, K, m);
      g.strokeStyle = "#ff6bd6"; g.lineWidth = K * (m < 0.6 ? 1.2 : 1); g.setLineDash([3 * K, 2 * K]); g.lineDashOffset = -t * 40; g.stroke();
      g.restore();
    }
    // --- stars
    if (dark > 0) {
      g.fillStyle = `rgba(255,255,255,${dark})`;
      stars.forEach((st) => g.fillRect(Math.round(st.x) * K, Math.round(st.y) * K, K, K));
    }
    // --- hull (without modules first), then modules fade in with a flash
    const sc = 1 + Math.sin(lift * Math.PI) * 0.14 + lift * 0.02, shadowOff = lift * 10 * K;
    if (wipe > 0) {
      const base = ship.baseSprite ? ship.baseSprite() : ship.sprite;
      const xs = ship.ringPx.map((p) => p[0]), x0 = Math.min(...xs) - 6, x1 = Math.max(...xs) + 2;
      const reveal = (x0 + (x1 - x0) * wipe) * K;
      g.save(); g.imageSmoothingEnabled = false;
      g.translate(CW / 2, CH / 2); g.scale(sc, sc); g.translate(-CW / 2, -CH / 2);
      if (lift > 0) { g.globalAlpha = 0.45 * (1 - out); g.drawImage(it.silhouette, shadowOff, shadowOff * 0.8, CW, CH); g.globalAlpha = 1; }
      g.save(); g.beginPath(); g.rect(0, 0, reveal, CH); g.clip();
      g.drawImage(base, 0, 0, CW, CH);
      if (wipe < 1) { g.fillStyle = "rgba(125,252,255,.85)"; g.fillRect(reveal - K, 0, K, CH); }
      g.restore();
      if (mods > 0) {
        g.globalAlpha = mods; g.drawImage(ship.sprite, 0, 0, CW, CH); g.globalAlpha = 1;
        if (mods < 1) {                                           // energy ring while modules lock in
          g.strokeStyle = `rgba(255,107,214,${1 - mods})`; g.lineWidth = K;
          g.beginPath(); g.arc(CW / 2, CH / 2, (0.15 + mods * 0.5) * CW, 0, 2 * Math.PI); g.stroke();
        }
      }
      g.restore();
    }
    // --- systems
    if (sys > 0) {
      g.save(); g.translate(CW / 2, CH / 2); g.scale(sc, sc); g.translate(-CW / 2, -CH / 2);
      const n = ship.ports.length;
      ship.ports.forEach((p, i) => {
        if (sys < (i + 1) / (n + 1)) return;
        g.fillStyle = "rgba(255,107,214,.4)"; g.fillRect((p.x - 3) * K, (p.y - 3) * K, 7 * K, 7 * K);
        g.fillStyle = PAL.port; g.fillRect((p.x - 1) * K, (p.y - 1) * K, 3 * K, 3 * K);
      });
      if (sys > 0.6) ship.engines.forEach(([ex, ey], k) => {
        const L = 2 + Math.round((Math.sin(t * 22 + k) + 1) * 2 + lift * 4);
        for (let i = 0; i < L; i++) { g.fillStyle = i < 2 ? PAL.flame1 : PAL.flame2; g.fillRect((ex - i) * K, ey * K, K, K); }
      });
      g.restore();
    }
    // --- captions + scan readout (information stays in the intro, outside the sky screen)
    const label = cur.address.label || "", name = label.split(/\s\d{4}\s/)[0].toUpperCase();
    const town = ((label.match(/\d{4,5}\s+(.+)$/) || [])[1] || "").toUpperCase();
    const alt = Math.round((1 / m) * (W / ship.scale) * 1.2);
    cap.textContent = t < 2 ? `APPROACHING ${town || "TARGET"} · ALT ${alt} M` : t < 6 ? `SCANNING ${name} + 200 M` : t < 8.5 ? "COMPOSING SHIP DNA…"
      : t < 10.5 ? `TARGET LOCK: ${name}` : t < 12.2 ? "CONVERTING STRUCTURE…" : t < 13.6 ? "FITTING MODULES" : t < 14.4 ? "SYSTEMS ONLINE" : "LIFT-OFF";
    cap.classList.toggle("go", t >= 14.4);
    if (t >= 2 && t < 8.5) scanHud(t, res, t < 6 ? "scan" : "compose", t < 6 ? scan : comp);
    else if (t >= 12.2 && t < 14.4) scanHud(t, res, "modules", mods);
    else { const h = ui.q(".lv-scanhud"); if (h) h.hidden = true; }
    if (out > 0) it.cv.style.opacity = String(1 - out);
    if (t >= 16.2) { it.cv.hidden = true; cap.hidden = true; const h = ui.q(".lv-scanhud"); if (h) h.hidden = true; intro = null; }
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
    if (intro) drawIntro(ts);
    raf = requestAnimationFrame(frame);
  }

  // ---------- cockpit ----------
  const compass = (az) => ["N", "NE", "E", "SE", "S", "SW", "W", "NW"][Math.round(az / 45) % 8];
  function selectWindow(i, st) {
    active = i; const w = st.windows[i], c = w.capture || {};
    const az = w.wall_azimuth_deg != null ? w.wall_azimuth_deg : c.camera_azimuth_deg;
    const tilt = c.camera_elevation_deg;
    ui.view.innerHTML = "";
    ui.photo = null;
    if (w.photo && w.photo.url) {   // photo is drawn into a canvas together with the real sky
      const img = new Image(); img.crossOrigin = "anonymous";
      img.onload = () => { if (ui && ui.photo === img) renderSky(); };
      img.src = w.photo.url; ui.photo = img;
      ui.view.innerHTML = '<canvas class="ck-sky"></canvas><canvas class="ck-hl"></canvas><div class="ck-tip"></div>';
    }
    else ui.view.innerHTML = '<div class="nosignal">NO SIGNAL</div>';
    const floor = Number(document.getElementById("floor").value) || 0;
    ui.q("#ck-name").textContent = (w.label || "Window " + (i + 1)).toUpperCase();
    ui.q("#ck-hdg").textContent = az != null ? `${String(Math.round(az)).padStart(3, "0")}° ${compass(az)}` : "---";
    ui.q("#ck-tilt").textContent = tilt != null ? `${tilt >= 0 ? "+" : ""}${Math.round(tilt)}°` : "--";
    ui.q("#ck-alt").textContent = `DECK ${floor} · ~${Math.max(0, floor * 3 + 1.5).toFixed(0)} M`;
    ui.q("#ck-pos").textContent = `${w.lat.toFixed(5)}N ${w.lon.toFixed(5)}E`;
    const vv = viewOf(w);
    ui.q("#ck-src").textContent = vv.az == null ? "HDG UNKNOWN" : `VIEW ${Math.round(vv.az)}° (${vv.azSrc}) · ${vv.el >= 0 ? "+" : ""}${Math.round(vv.el)}° (${vv.elSrc})`;
    drawTape(az);
    // horizon line tilts with the recorded camera elevation
    ui.qa(".ck-win").forEach((b, k) => b.classList.toggle("on", k === i));
  }
  // ---------- ship composition panel ----------
  const STAT_LABELS = [["speed", "SPEED"], ["acceleration", "ACCEL"], ["turn", "TURN"], ["tilt", "TILT/ROLL"], ["hull", "HULL"],
    ["shield", "SHIELD"], ["sensors", "SENSORS"], ["energy", "ENERGY"], ["stealth", "STEALTH"], ["lifeSupport", "LIFE SUPPORT"], ["trade", "TRADE"]];
  const CLS_LABEL = { veg: "Greenery", water: "Water", roof: "Roofs", paved: "Streets & paved", shade: "Shade" };
  function drawSpecMap(res) {
    const el = ui && ui.root.querySelector(".sp-map canvas"); if (!el || !res.satImage) return;
    const g = el.getContext("2d"), n = el.width, sc = n / res.satImage.width;
    g.clearRect(0, 0, n, n); g.drawImage(res.satImage, 0, 0, n, n);
    if (ui.specOverlay && res.overlay) g.drawImage(res.overlay, 0, 0, n, n);
    const R = (SpaceshipCompose.RADIUS / res.metresPerPx) * sc, c = n / 2;
    // outside the 200 m circle: dark
    g.save(); g.beginPath(); g.rect(0, 0, n, n); g.arc(c, c, R, 0, 2 * Math.PI, true); g.fillStyle = "rgba(8,10,22,.78)"; g.fill(); g.restore();
    g.strokeStyle = "#7dfcff"; g.lineWidth = 2; g.setLineDash([6, 4]); g.beginPath(); g.arc(c, c, R, 0, 2 * Math.PI); g.stroke(); g.setLineDash([]);
    const toPx = (lat, lon) => { const [x, y] = localXY(lat, lon, [res.center.lat, res.center.lon]); return [c + (x / res.metresPerPx) * sc, c - (y / res.metresPerPx) * sc]; };
    g.strokeStyle = "#ff6bd6"; g.lineWidth = 2.5; g.beginPath();
    outlineRing(cur).forEach(([la, lo], i) => { const [x, y] = toPx(la, lo); i ? g.lineTo(x, y) : g.moveTo(x, y); }); g.closePath(); g.stroke();
    cur.windows.forEach((w) => {
      const [x, y] = toPx(w.lat, w.lon), az = w.capture && w.capture.camera_azimuth_deg != null ? w.capture.camera_azimuth_deg : w.wall_azimuth_deg;
      if (az != null) { g.strokeStyle = "rgba(255,107,214,.8)"; g.lineWidth = 1.5; g.beginPath(); g.moveTo(x, y);
        g.lineTo(x + Math.sin(az * D2R) * R * 0.9, y - Math.cos(az * D2R) * R * 0.9); g.stroke(); }
      g.fillStyle = "#ff6bd6"; g.fillRect(x - 3, y - 3, 6, 6);
    });
    g.fillStyle = "#7dfcff"; g.font = "bold 14px ui-monospace,monospace"; g.textAlign = "center"; g.fillText("N", c, c - R - 6 < 12 ? 14 : c - R - 6);
    g.font = "11px ui-monospace,monospace"; g.fillText("200 m", c + R * 0.72, c + R * 0.72 + 14);
  }
  function renderSpec(res) {
    if (!ui) return;
    const root = ui.root.querySelector("#lv-spec"); ui.spec = res;
    const share = res.satellite && res.satellite.share, o = res.osm;
    const bars = STAT_LABELS.map(([k, l]) => {
      const v = res.stats[k], segs = Math.round(v / 5);
      return `<div class="sp-bar"><span>${l}</span><i>${"▮".repeat(segs)}<em>${"▮".repeat(20 - segs)}</em></i><b>${v}</b></div>`;
    }).join("");
    const legend = share ? Object.keys(CLS_LABEL).map((k) => {
      const c = SpaceshipCompose.CLASS[k];
      return `<div><s style="background:rgb(${c.join(",")})"></s>${CLS_LABEL[k]} <b>${Math.round(share[k] * 100)}%</b></div>`;
    }).join("") : "<div class='muted'>Satellite analysis…</div>";
    const osmLine = o ? `${o.buildings} buildings${o.avgLevels ? ` (Ø ${o.avgLevels.toFixed(1)} floors)` : ""} · ${o.roads + o.majorRoads} roads${o.majorRoads ? ` (${o.majorRoads} main)` : ""}` +
      `${o.tram ? " · tram" : ""}${o.rail ? " · rail" : ""}${o.water ? " · water" : ""} · ${o.parks + o.green} green areas · ${o.trees} trees · ${o.shops + o.food} shops/cafés · ${o.amenities} facilities`
      : res.status.osm === "failed" ? "OpenStreetMap not reachable – using estimates" : "Loading OpenStreetMap data… (up to ~40 s)";
    const p = res.physics, geo = res.geometry;
    root.innerHTML = `<div class="sp-head"><b>SHIP COMPOSITION</b><span>200 M SCAN · ${geo.area.toFixed(0)} M² HULL · ${geo.levels} DECKS</span></div>
      <div class="sp-top">
        <div class="sp-map"><canvas width="360" height="360"></canvas><button type="button" class="sp-toggle">${ui.specOverlay ? "◐ PHOTO" : "◑ ANALYSIS"}</button></div>
        <div class="sp-right"><div class="sp-legend">${legend}</div><div class="sp-osm">${osmLine}</div>
          <div class="sp-phys"><span>MAX SPEED <b>${p.max_speed}</b></span><span>TURN <b>${p.turn_rate_deg_s}°/s</b></span>
          <span>PITCH <b>${p.pitch_rate_deg_s}°/s</b></span><span>ROLL <b>${p.roll_rate_deg_s}°/s</b></span>
          <span>MAX TILT <b>${p.max_tilt_deg}°</b></span><span>ENGINES <b>${p.engines}</b></span>
          <span>MASS <b>${p.mass_t.toLocaleString()} t</b></span><span>SENSOR RANGE <b>${p.sensor_range} m</b></span></div></div>
      </div>
      <div class="sp-stats">${bars}</div>
      <div class="sp-caps">${res.capabilities.map((c) => `<span title="${c.desc}">◆ ${c.name}<small>${c.desc}</small></span>`).join("") || "<span>No special capabilities yet</span>"}</div>
      <div class="sp-foot"><button type="button" class="sp-dl">⬇ Ship spec (JSON)</button>
        <small>Sources: ${res.status.satellite === "ok" ? "satellite ✓" : "satellite …"} · ${res.status.osm === "ok" ? "OpenStreetMap ✓" : res.status.osm === "failed" ? "OpenStreetMap ✗" : "OpenStreetMap …"}</small></div>`;
    root.querySelector(".sp-toggle").addEventListener("click", () => { ui.specOverlay = !ui.specOverlay; renderSpec(ui.spec); });
    root.querySelector(".sp-dl").addEventListener("click", () => {
      const blob = new Blob([SpaceshipCompose.specJSON(ui.spec, cur)], { type: "application/json" });
      const a = document.createElement("a"); a.href = URL.createObjectURL(blob);
      a.download = "spaceship-" + (cur.address.label || "ship").split(/\s\d{4}/)[0].replace(/[^\w]+/g, "-").toLowerCase() + ".json"; a.click();
    });
    drawSpecMap(res);
    // modules on the pixel ship (after the roof skin is in place)
    (ui.groundP || Promise.resolve()).then(() => { if (ui && ship) ship.decorate(res); });
  }

  // ---------- real sky in the window ----------
  function skyTime() { return new Date(Date.now() + (ui ? ui.timeOffsetH : 0) * 3600000); }
  function viewOf(w) {
    const c = w.capture || {};
    // the phone's own reading is the true direction of the photo; the wall direction is the fallback
    const az = c.camera_azimuth_deg != null ? c.camera_azimuth_deg : w.wall_azimuth_deg;
    const el = c.camera_elevation_deg != null ? c.camera_elevation_deg : 5;
    return { az, el, azSrc: c.camera_azimuth_deg != null ? "PHONE" : "HULL", elSrc: c.camera_elevation_deg != null ? "PHONE" : "EST." };
  }
  function renderSky() {
    if (!ui || !ui.photo || !ui.photo.naturalWidth) return;
    const cv = ui.view.querySelector(".ck-sky"); if (!cv) return;
    const r = ui.view.getBoundingClientRect(), dpr = Math.min(2, window.devicePixelRatio || 1);
    cv.width = Math.max(320, Math.round(r.width * dpr)); cv.height = Math.max(200, Math.round(r.height * dpr));
    const w = cur.windows[active], v = viewOf(w), t = skyTime();
    if (v.az == null || !window.SpaceshipSky) { cv.getContext("2d").drawImage(ui.photo, 0, 0, cv.width, cv.height); return; }
    const info = SpaceshipSky.render(cv, ui.photo, { lat: w.lat, lon: w.lon, az: v.az, el: v.el, time: t, mode: ui.skyMode });
    ui.skyInfo = info; hideTip();
    const named = info && info.inView.filter((x) => x.type !== "constellation").map((x) => x.name);
    const cons = info && info.inView.filter((x) => x.type === "constellation").map((x) => x.name);
    ui.q("#ck-sky-info").textContent = ui.skyMode === "photo" ? "SKY: PHOTO" :
      (cons && cons.length ? cons.slice(0, 3).join(" · ").toUpperCase() : "NO CONSTELLATION IN VIEW") +
      (named && named.length ? " ★ " + named.slice(0, 3).join(", ") : "");
    ui.q("#ck-sun").textContent = info && info.sunAlt != null ? `SUN ${info.sunAlt >= 0 ? "+" : ""}${Math.round(info.sunAlt)}° ${info.sunAlt > 0 ? "DAY" : info.sunAlt > -12 ? "TWILIGHT" : "NIGHT"}` : "";
    ui.q("#ck-time").textContent = t.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    ui.q("#ck-date").textContent = ui.timeOffsetH ? `${ui.timeOffsetH > 0 ? "+" : ""}${ui.timeOffsetH} H · ${t.toLocaleDateString()}` : "NOW · LIVE";
  }

  // ---------- hover / tap: star info ----------
  const compass16 = (az) => ["N","NNE","NE","ENE","E","ESE","SE","SSE","S","SSW","SW","WSW","W","WNW","NW","NNW"][Math.round(az / 22.5) % 16];
  function magWords(m) {
    return m < 0 ? "one of the brightest objects in the sky" : m < 1 ? "one of the brightest stars" : m < 2 ? "very bright"
         : m < 3.5 ? "clearly visible" : m < 5 ? "visible to the eye" : "faint – needs a dark sky";
  }
  function tipHtml(o) {
    const pos = `${o.alt >= 0 ? Math.round(o.alt) + "° above the horizon" : "below the horizon"} · ${Math.round(o.az)}° ${compass16(o.az)}`;
    if (o.type === "star") {
      const ph = SpaceshipSky.starPhysics(o.bv), title = o.name || o.desig || `HIP ${o.hip}`;
      const sub = [o.name && o.desig ? o.desig : "", o.conName].filter(Boolean).join(" · ");
      return `<b style="color:${SpaceshipSky.bvColor(o.bv)}">★ ${title}</b><i>${sub}</i>
        <span>Brightness ${o.mag.toFixed(2)} mag – ${magWords(o.mag)}</span>
        <span>${ph.colour} star · type ${ph.cls} · ~${ph.tempK.toLocaleString()} K</span>
        <span>Now ${pos}</span><small>HIP ${o.hip} · RA ${(o.ra / 15).toFixed(2)} h · Dec ${o.dec.toFixed(1)}°</small>`;
    }
    const km = o.distAU * 149597870.7, lightMin = (o.distAU * 499.005) / 60;
    let extra = "";
    if (o.name === "Moon") extra = `<span>${Math.round(((1 - Math.cos(o.phase * Math.PI / 180)) / 2) * 100)}% lit · ${Math.round(km).toLocaleString()} km away</span>`;
    else if (o.name === "Sun") extra = `<span>Light needs ${lightMin.toFixed(1)} minutes to reach your window</span>`;
    else extra = `<span>${o.distAU.toFixed(2)} AU away · light travels ${lightMin.toFixed(0)} min</span><span>Brightness ${o.mag.toFixed(1)} mag</span>`;
    return `<b style="color:#ff9be6">${o.sym} ${o.name}</b>${extra}<span>Now ${pos}</span>`;
  }
  function hideTip() {
    if (!ui) return;
    const tip = ui.view.querySelector(".ck-tip"), hl = ui.view.querySelector(".ck-hl");
    if (tip) tip.classList.remove("on");
    if (hl) hl.getContext("2d").clearRect(0, 0, hl.width, hl.height);
    ui.hover = null;
  }
  function pickAt(clientX, clientY) {
    const cv = ui.view.querySelector(".ck-sky"), info = ui.skyInfo;
    if (!cv || !info || !info.objects || ui.skyMode !== "space") return null;
    const r = cv.getBoundingClientRect(), sx = cv.width / r.width;
    const x = (clientX - r.left) * sx, y = (clientY - r.top) * sx;
    let best = null, bd = Infinity;
    info.objects.forEach((o) => {
      const d = Math.hypot(o.x - x, o.y - y), lim = Math.max(16 * sx, o.r + 8 * sx);
      // prefer bright objects: a little bonus for brightness
      const score = d - (6 - Math.min(6, o.mag)) * 1.5 * sx;
      if (d < lim && score < bd && (!info.visibleAt || info.visibleAt(o.x, o.y))) { bd = score; best = o; }
    });
    return best && { o: best, sx, rect: r };
  }
  function showTip(hit) {
    const tip = ui.view.querySelector(".ck-tip"), hl = ui.view.querySelector(".ck-hl"), cv = ui.view.querySelector(".ck-sky");
    if (!tip || !hl) return;
    if (ui.hover === hit.o) return;
    ui.hover = hit.o;
    hl.width = cv.width; hl.height = cv.height;
    const g = hl.getContext("2d"), o = hit.o, R = Math.max(10 * hit.sx, o.r * 2.2);
    g.clearRect(0, 0, hl.width, hl.height);
    g.strokeStyle = "#ff6bd6"; g.lineWidth = 2 * hit.sx;
    g.beginPath(); g.arc(o.x, o.y, R, 0, 2 * Math.PI); g.stroke();
    [[0, -1], [0, 1], [-1, 0], [1, 0]].forEach(([dx, dy]) => { g.beginPath(); g.moveTo(o.x + dx * R * 1.3, o.y + dy * R * 1.3); g.lineTo(o.x + dx * R * 1.9, o.y + dy * R * 1.9); g.stroke(); });
    tip.innerHTML = tipHtml(o);
    const cx = o.x / hit.sx, cy = o.y / hit.sx, W0 = hit.rect.width;
    tip.style.left = Math.min(W0 - 230, Math.max(8, cx + 18)) + "px";
    tip.style.top = Math.max(8, cy - 20) + "px";
    tip.classList.remove("on"); void tip.offsetWidth; tip.classList.add("on");   // restart the fade-in
  }
  function bindHover() {
    const v = ui.view;
    v.addEventListener("mousemove", (e) => { const h = pickAt(e.clientX, e.clientY); if (h) showTip(h); else if (ui.hover) hideTip(); });
    v.addEventListener("mouseleave", hideTip);
    v.addEventListener("click", (e) => { const h = pickAt(e.clientX, e.clientY); if (h) { ui.hover = null; showTip(h); } else hideTip(); });
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
          <canvas class="lv-main" width="${W}" height="${H}"></canvas>
          <canvas class="lv-intro" width="${W * K}" height="${H * K}" hidden></canvas>
          <div class="lv-caption" hidden></div>
          <div class="lv-scanhud" hidden></div>
          <canvas class="lv-origin" width="${W * 2}" height="${H * 2}" title="Origin: your building from above"></canvas>
          <button class="lv-replay" type="button">↺ Replay take-off</button>
          <div class="lv-hud lv-tl">${String(Math.round(st.windows.length * 1000 + floor * 137 + 4242)).padStart(5, "0")}</div>
          <div class="lv-hud lv-tr">DECK ${floor}</div>
          <div class="lv-hud lv-bl">${name.slice(0, 26)}</div>
          <div class="lv-hud lv-br">PORTS ${st.windows.length}</div>
        </div>
        <div class="lv-spec" id="lv-spec"><div class="sp-head"><b>SHIP COMPOSITION</b><span>200 M SCAN</span></div>
          <div class="sp-status">Scanning the surroundings…</div></div>
        <div class="lv-cockpit">
          <div class="ck-view" id="ck-view"></div>
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
          <div class="ck-dash">
            <div class="ck-panel ck-wins"><button class="ck-mode" type="button" title="Real stars / original photo">★ SPACE</button></div>
            <canvas class="ck-radar" width="120" height="120"></canvas>
            <div class="ck-panel ck-clock"><div class="row" style="gap:6px;align-items:baseline"><span id="ck-time">--:--</span>
              <button class="ck-now" type="button">NOW</button></div>
              <input class="ck-slider" type="range" min="-12" max="12" step="0.25" value="0" aria-label="Time offset in hours">
              <small id="ck-date">NOW · LIVE</small></div>
          </div>
        </div>
        <div class="lv-info">
          <div class="ck-tape" id="ck-tape"></div>
          <div class="li-row">
            <div class="li-col"><b id="ck-name">–</b><span>HDG <i id="ck-hdg">–</i></span><span>TILT <i id="ck-tilt">–</i></span></div>
            <div class="li-col li-mid" id="ck-sky-info"></div>
            <div class="li-col li-right"><span id="ck-alt">–</span><span id="ck-pos">–</span><span id="ck-src">–</span><span id="ck-sun"></span></div>
          </div>
        </div>
      </div>`;
    const q = (s) => root.querySelector(s), qa = (s) => root.querySelectorAll(s);
    const cvs = root.querySelector(".lv-main"), ctx = cvs.getContext("2d");
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
    ui.timeOffsetH = 0; ui.skyMode = "space";
    const modeBtn = q(".ck-mode");
    modeBtn.addEventListener("click", () => { ui.skyMode = ui.skyMode === "space" ? "photo" : "space";
      modeBtn.textContent = ui.skyMode === "space" ? "★ SPACE" : "▣ PHOTO"; renderSky(); });
    const slider = q(".ck-slider");
    slider.addEventListener("input", () => { ui.timeOffsetH = Number(slider.value); renderSky(); });
    q(".ck-now").addEventListener("click", () => { slider.value = 0; ui.timeOffsetH = 0; renderSky(); });
    ui.clock = setInterval(renderSky, 30000);                 // the sky turns: refresh every 30 s
    ui.onResize = () => renderSky(); window.addEventListener("resize", ui.onResize);
    if (window.SpaceshipSky) SpaceshipSky.load().then(renderSky);
    bindHover();
    ship = buildShip(st); initStars(); lasers = []; active = 0;
    selectWindow(0, st);
    // origin inset: the real building from above with its outline – stays visible during flight
    startIntro();
    ui.groundP.then((gcv) => {
      if (!ui) return;
      const o = ui.q(".lv-origin"), og = o.getContext("2d");
      og.drawImage(gcv, 0, 0, o.width, o.height);
      og.save(); ringPath(og, ship, o.width / W); og.strokeStyle = "#7dfcff"; og.lineWidth = 3; og.stroke(); og.restore();
      o.classList.add("on");
    });
    q(".lv-replay").addEventListener("click", startIntro);
    ui.specOverlay = true;
    st.floor = floor;
    if (window.SpaceshipCompose) SpaceshipCompose.analyze(st, renderSpec);
    t0 = performance.now(); cancelAnimationFrame(raf); raf = requestAnimationFrame(frame);
  }
  function unmount() {
    cancelAnimationFrame(raf);
    if (ui && ui.clock) clearInterval(ui.clock);
    if (ui && ui.onResize) window.removeEventListener("resize", ui.onResize);
    ui = null;
  }

  window.SpaceshipLaunch = { mount, unmount };
})();
