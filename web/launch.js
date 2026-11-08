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
  function startIntro(skip = 0) {
    if (!ui) return;
    const cv = ui.q(".lv-intro"); cv.hidden = false; cv.style.opacity = 1;
    ui.q(".lv-caption").hidden = false; ui.q(".lv-caption").textContent = "ACQUIRING SATELLITE LINK…";
    intro = { t0: null, skip, ground: null, wide: null, ready: false, cv, g: cv.getContext("2d"),
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
    let t = (ts - it.t0) / 1000 + (it.skip || 0);
    const res = ui.spec, g = it.g, CW = W * K, CH = H * K;
    // wait (max 5 s) at the start of the scan until the satellite classification is ready
    if (t > 2 && t < 2.1 && !(res && res.overlay) && (it.waited || 0) < 5) { it.waited = (it.waited || 0) + (ts - it.last) / 1000; it.t0 += ts - it.last; t = (ts - it.t0) / 1000 + (it.skip || 0); }
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
    const T_ = window.I18N ? I18N.t : (x, v) => x.replace(/\{(\w+)\}/g, (m, k) => v[k]);
    cap.textContent = t < 2 ? T_("APPROACHING {town} · ALT {alt} M", { town: town || T_("TARGET"), alt }) : t < 6 ? T_("SCANNING {name} + 200 M", { name }) : t < 8.5 ? T_("COMPOSING SHIP DNA…")
      : t < 10.5 ? T_("TARGET LOCK: {name}", { name }) : t < 12.2 ? T_("CONVERTING STRUCTURE…") : t < 13.6 ? T_("FITTING MODULES") : t < 14.4 ? T_("SYSTEMS ONLINE") : T_("LIFT-OFF");
    cap.classList.toggle("go", t >= 14.4);
    const hud0 = ui.q(".lv-scanhud"); if (hud0) hud0.hidden = true;   // the scan now plays on the main stage
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
  const t = (s, v) => (window.I18N ? I18N.t(s, v) : s);
  const N = (n, d) => (window.I18N ? I18N.num(n, d) : Number(n).toFixed(d));
  const DIR = (a) => (window.I18N ? I18N.dir(a) : a);
  const compass = (az) => DIR(["N", "NE", "E", "SE", "S", "SW", "W", "NW"][Math.round(az / 45) % 8]);
  function selectWindowReadouts() {
    if (!ui || !cur) return; const vv = viewOf(cur.windows[active]);
    ui.q("#ck-src").textContent = vv.az == null ? t("HDG UNKNOWN") : `${t("VIEW")} ${Math.round(vv.az)}° (${t(vv.azSrc)}) · ${vv.el >= 0 ? "+" : ""}${Math.round(vv.el)}° (${t(vv.elSrc)})`;
  }
  function selectWindow(i, st) {
    active = i; const w = st.windows[i], c = w.capture || {};
    const az = w.wall_azimuth_deg != null ? w.wall_azimuth_deg : c.camera_azimuth_deg;
    const tilt = c.camera_elevation_deg;
    ui.view.innerHTML = "";
    ui.photo = null; resetCam(st.windows[i]);
    if (w.photo && w.photo.url) {   // photo is drawn into a canvas together with the real sky
      const img = new Image(); img.crossOrigin = "anonymous";
      img.onload = () => { if (ui && ui.photo === img) renderSky(); };
      img.src = w.photo.url; ui.photo = img;
      ui.view.innerHTML = '<canvas class="ck-sky"></canvas><canvas class="ck-ph"></canvas><canvas class="ck-hl"></canvas><div class="ck-tip"></div>';
    }
    else ui.view.innerHTML = '<div class="nosignal">NO SIGNAL</div>';
    const floor = Number(document.getElementById("floor").value) || 0;
    ui.q("#ck-name").textContent = (w.label || (window.I18N && I18N.lang === "de" ? "Fenster " : "Window ") + (i + 1)).toUpperCase();
    ui.q("#ck-hdg").textContent = az != null ? `${String(Math.round(az)).padStart(3, "0")}° ${compass(az)}` : "---";
    ui.q("#ck-tilt").textContent = tilt != null ? `${tilt >= 0 ? "+" : ""}${Math.round(tilt)}°` : "--";
    ui.q("#ck-alt").textContent = `DECK ${floor} · ~${Math.max(0, floor * 3 + 1.5).toFixed(0)} M`;
    ui.q("#ck-pos").textContent = `${w.lat.toFixed(5)}N ${w.lon.toFixed(5)}E`;
    const vv = viewOf(w);
    selectWindowReadouts();
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
    const st = res.stats, agility = Math.round((st.turn + st.tilt) / 2);
    const bars = [[t("Speed"), st.speed], [t("Agility"), agility], [t("Shield"), st.shield], [t("Sensors"), st.sensors], [t("Energy"), st.energy]]
      .map(([l, v]) => `<div class="cp-bar"><span>${l}</span><i><em style="width:${v}%"></em></i><b>${v}</b></div>`).join("");
    const de = window.I18N && I18N.lang === "de";
    const tags = res.capabilities.map((c) => `<span title="${de && c.de ? c.de[1] : c.desc}">${de && c.de ? c.de[0] : c.name}</span>`).join("");
    root.innerHTML = `<div class="ly-head"><span>${t("Composition")}</span><small>200 m · ${t(res.status.satellite === "ok" && res.status.osm === "ok" ? "complete" : "scanning…")}</small></div>
      <div class="cp-row"><div class="cp-thumb"></div><div class="cp-bars">${bars}</div></div>
      <div class="cp-tags">${tags}</div>
      <div class="cp-actions"><button type="button" class="cp-scan">↻ Scan</button>
        <button type="button" class="cp-sound">${window.SpaceshipSound && SpaceshipSound.on ? "🔊 Sound on" : "🔈 Soundsphere"}</button>
        <button type="button" class="cp-dl">⬇ JSON</button></div>`;
    if (ui.scanData) root.querySelector(".cp-thumb").appendChild(SpaceshipScan.thumbnail(ui.scanData, 180));
    root.querySelector(".cp-scan").addEventListener("click", () => playScan(true));
    root.querySelector(".cp-sound").addEventListener("click", toggleSound);
    root.querySelector(".cp-dl").addEventListener("click", () => {
      const blob = new Blob([SpaceshipCompose.specJSON(ui.spec, cur)], { type: "application/json" });
      const a = document.createElement("a"); a.href = URL.createObjectURL(blob);
      a.download = "spaceship-" + (cur.address.label || "ship").split(/\s\d{4}/)[0].replace(/[^\w]+/g, "-").toLowerCase() + ".json"; a.click();
    });
    // first time the satellite image is in: prepare the spectral scan and play it on the main stage
    if (res.satImage && !ui.scanData && window.SpaceshipScan) {
      ui.scanData = SpaceshipScan.prepare(res, outlineRing(cur), cur.windows);
      if (ui.scanData) { root.querySelector(".cp-thumb").appendChild(SpaceshipScan.thumbnail(ui.scanData, 180)); if (!ui.scanPlayed) playScan(false); }
    }
    if (window.SpaceshipSound && SpaceshipSound.on && ui.soundScene !== res.status.osm) { ui.soundScene = res.status.osm; SpaceshipSound.restart(res); }
    // modules on the pixel ship (after the roof skin is in place)
    (ui.groundP || Promise.resolve()).then(() => { if (ui && ship) ship.decorate(res); });
  }
  // ---------- main-stage spectral scan + sound ----------
  function playScan(manual) {
    if (!ui || !ui.scanData) return;
    ui.scanPlayed = true;
    const cv = ui.q(".st-scan"), skip = ui.q(".st-skip");
    if (ui.scanCtl) ui.scanCtl.stop();
    cv.hidden = false; skip.hidden = false; cv.style.opacity = 1;
    const res = ui.spec, sh = res.satellite && res.satellite.share, o = res.osm, geo = res.geometry;
    const labels = [];
    if (sh) { labels.push(t("greenery {p} %", { p: Math.round(sh.veg * 100) })); labels.push(t("sealed & paved {p} %", { p: Math.round((sh.paved + sh.roof) * 100) })); }
    if (o) labels.push(t("{b} structures · {t} trees", { b: o.buildings, t: o.trees }));
    labels.push(t("{w} windows · {d}° view", { w: geo.windows, d: Math.round(geo.spreadDeg) }));
    const done = () => {
      if (!ui) return;
      cv.hidden = true; skip.hidden = true; ui.scanCtl = null;
      if (window.SpaceshipSound) SpaceshipSound.scanEnd();
      startIntro(8.5);                                   // the small ship converts and lifts off
    };
    ui.scanCtl = SpaceshipScan.play(cv, ui.scanData, { labels, onDone: done, onSlice: (v) => window.SpaceshipSound && SpaceshipSound.scan(v) });
    skip.onclick = () => { if (ui.scanCtl) ui.scanCtl.stop(); done(); };
  }
  async function toggleSound() {
    if (!window.SpaceshipSound) return;
    if (SpaceshipSound.on) SpaceshipSound.stop(); else { await SpaceshipSound.start(ui.spec); ui.soundScene = ui.spec && ui.spec.status.osm; }
    if (ui.spec) renderSpec(ui.spec);
  }
  // star shimmer: now and then a bright star in view "rings"
  function starShimmer() {
    if (!ui || !window.SpaceshipSound || !SpaceshipSound.on || !ui.skyInfo || !ui.skyInfo.objects) return;
    const stars = ui.skyInfo.objects.filter((o) => o.type === "star" && o.mag < 3.2 && (!ui.skyInfo.visibleAt || ui.skyInfo.visibleAt(o.x, o.y)));
    if (!stars.length) return;
    const o = stars[Math.floor(Math.random() * stars.length)], cv = ui.view.querySelector(".ck-sky");
    SpaceshipSound.star(cv ? o.x / cv.width : 0.5, o.mag);
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
  // free camera for the full-screen dome: starts looking through the selected window
  function resetCam(w) {
    const v = viewOf(w), r = ui.view.getBoundingClientRect(), portrait = r.height > r.width;
    const fov = portrait ? 100 : 120;
    // horizon in the lower third: look a bit above it
    ui.cam = { az: v.az != null ? v.az : 180, alt: portrait ? 26 : 13, fov };   // horizon a bit below the middle: the window anchor stays in sight
    if (ui.inlay) ui.inlay.src = w.photo && w.photo.url ? w.photo.url : "";
  }
  let skyRaf = 0;
  function requestSky(interactive = true) {
    if (interactive && ui) { ui.interacting = true; clearTimeout(ui.sharpT); ui.sharpT = setTimeout(() => { if (ui) { ui.interacting = false; renderSky(); } }, 220); }
    if (!skyRaf) skyRaf = requestAnimationFrame(() => { skyRaf = 0; renderSky(); });
  }
  function renderSky() {
    if (!ui || !ui.photo || !ui.photo.naturalWidth) return;
    if (window.SpaceshipDome && ui.cam) return renderDome();
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
    ui.q("#ck-time").textContent = t.toLocaleTimeString(window.I18N && I18N.lang === "de" ? "de-CH" : [], { hour: "2-digit", minute: "2-digit" });
    ui.q("#ck-date").textContent = ui.timeOffsetH ? `${ui.timeOffsetH > 0 ? "+" : ""}${ui.timeOffsetH} H · ${t.toLocaleDateString(window.I18N && I18N.lang === "de" ? "de-CH" : undefined)}` : "NOW · LIVE";
  }

  function renderDome() {
    const cv = ui.view.querySelector(".ck-sky"); if (!cv) return;
    const r = ui.view.getBoundingClientRect(), dpr = ui.interacting ? 1 : Math.min(2, window.devicePixelRatio || 1);
    const Wc = Math.max(320, Math.round(r.width * dpr)), Hc = Math.max(200, Math.round(r.height * dpr));
    if (cv.width !== Wc || cv.height !== Hc) { cv.width = Wc; cv.height = Hc; }
    const w = cur.windows[active], v = viewOf(w), t = skyTime(), img = ui.photo, portrait = img.naturalHeight >= img.naturalWidth;
    const photo = v.az != null ? { img, az: v.az, el: v.el, hfov: portrait ? 53 : 67, vfov: portrait ? 67 : 53 } : null;
    const info = SpaceshipDome.render(cv, { lat: w.lat, lon: w.lon, time: t, az: ui.cam.az, alt: ui.cam.alt, fov: ui.cam.fov,
      layers: ui.layers, photo, mode: ui.skyMode, onAsset: () => requestSky(false), dpr });
    ui.skyInfo = info; if (ui.pinned) repin(); else hideTip();
    // the real window photo fades in and out every ~10 s (toggle "Photo blend")
    const ph = ui.view.querySelector(".ck-ph");
    if (ph) {
      const on = ui.layers.blend && ui.skyMode === "space" && photo && !ui.interacting;
      ph.classList.toggle("cycle", !!on);
      if (on) { if (ph.width !== Wc || ph.height !== Hc) { ph.width = Wc; ph.height = Hc; }
        SpaceshipDome.renderPhoto(ph, { az: ui.cam.az, alt: ui.cam.alt, fov: ui.cam.fov, photo }); }
    }
    const cons = info.inView.filter((x) => x.type === "constellation").map((x) => x.name);
    const named = info.inView.filter((x) => x.type !== "constellation").map((x) => x.name);
    ui.q("#ck-sky-info").textContent = (cons.length ? cons.slice(0, 3).join(" · ").toUpperCase() : "") + (named.length ? " ★ " + named.slice(0, 3).join(", ") : "");
    ui.q("#ck-hdg").textContent = `${String(Math.round(ui.cam.az)).padStart(3, "0")}° ${compass(ui.cam.az)}`;
    ui.q("#ck-tilt").textContent = `${ui.cam.alt >= 0 ? "+" : ""}${Math.round(ui.cam.alt)}° · ${I18N.t("FOV")} ${Math.round(ui.cam.fov)}°`;
    drawTape(ui.cam.az);
    ui.q("#ck-sun").textContent = `${I18N.t("SUN")} ${info.sunAlt >= 0 ? "+" : ""}${Math.round(info.sunAlt)}° ${I18N.t(info.sunAlt > 0 ? "DAY" : info.sunAlt > -12 ? "TWILIGHT" : "NIGHT")}`;
    ui.q("#ck-time").textContent = t.toLocaleTimeString(window.I18N && I18N.lang === "de" ? "de-CH" : [], { hour: "2-digit", minute: "2-digit" });
    ui.q("#ck-date").textContent = ui.timeOffsetH ? `${ui.timeOffsetH > 0 ? "+" : ""}${ui.timeOffsetH} H · ${t.toLocaleDateString(window.I18N && I18N.lang === "de" ? "de-CH" : undefined)}` : "NOW · LIVE";
  }
  // drag = look around, wheel / pinch = zoom, double-click = back to the window view
  function bindNav() {
    const v = ui.view, pts = new Map(); let last = null, moved = 0, pinch0 = null;
    v.addEventListener("pointerdown", (e) => { pts.set(e.pointerId, [e.clientX, e.clientY]); v.setPointerCapture(e.pointerId); moved = 0;
      if (pts.size === 2) { const [a, b] = [...pts.values()]; pinch0 = { d: Math.hypot(a[0] - b[0], a[1] - b[1]), fov: ui.cam.fov }; } });
    v.addEventListener("pointermove", (e) => {
      if (!pts.has(e.pointerId) || !ui.cam) return;
      const prev = pts.get(e.pointerId); pts.set(e.pointerId, [e.clientX, e.clientY]);
      if (pts.size === 2 && pinch0) { const [a, b] = [...pts.values()]; const d = Math.hypot(a[0] - b[0], a[1] - b[1]);
        ui.cam.fov = Math.max(15, Math.min(200, pinch0.fov * pinch0.d / Math.max(10, d))); moved += 10; requestSky(); return; }
      const dx = e.clientX - prev[0], dy = e.clientY - prev[1]; moved += Math.abs(dx) + Math.abs(dy);
      const dpp = ui.cam.fov / v.getBoundingClientRect().width;
      ui.cam.az = (ui.cam.az - dx * dpp + 360) % 360; ui.cam.alt = Math.max(-30, Math.min(90, ui.cam.alt + dy * dpp));
      if (moved > 4) { v.classList.add("dragging"); requestSky(); }
    });
    const up = (e) => { pts.delete(e.pointerId); if (pts.size < 2) pinch0 = null; if (!pts.size) setTimeout(() => v.classList.remove("dragging"), 0); };
    v.addEventListener("pointerup", up); v.addEventListener("pointercancel", up);
    v.addEventListener("wheel", (e) => { if (!ui.cam) return; e.preventDefault();
      ui.cam.fov = Math.max(15, Math.min(200, ui.cam.fov * Math.pow(1.0015, e.deltaY))); requestSky(); }, { passive: false });
    v.addEventListener("dblclick", () => { resetCam(cur.windows[active]); renderSky(); });
    ui.wasDrag = () => moved > 6;
  }

  // ---------- hover / tap: star info ----------
  const compass16 = (az) => DIR(["N","NNE","NE","ENE","E","ESE","SE","SSE","S","SSW","SW","WSW","W","WNW","NW","NNW"][Math.round(az / 22.5) % 16]);
  function magWords(m) {
    return t(m < 0 ? "one of the brightest objects in the sky" : m < 1 ? "one of the brightest stars" : m < 2 ? "very bright"
         : m < 3.5 ? "clearly visible" : m < 5 ? "visible to the eye" : "faint – needs a dark sky");
  }
  // al-Ṣūfī / Ptolemy: number in abjad letters, Arabic name (+ translation), 964 position and magnitudes
  function sufiHtml(o) {
    const SU = window.SpaceshipSufi, S = SU && SU.star(o.hip); if (!S) return "";
    const c = SU.con(S.con) || {}, nm = SU.nameOf(S), col = nm && nm.color ? SU.COLORS[nm.color] : null, st = col ? ` style="color:${col}"` : "";
    const head = S.added
      ? `<span class="ck-sufi">${t("{ab} = {n} · added by al-Ṣūfī to {con} (not in Ptolemy)", { ab: `<span class="ar">${S.ab}</span>`, n: `<em>${S.n}</em>`, con: c.tr || S.con })}</span>`
      : `<span class="ck-sufi">${t("{ab} = {n} of the {c} stars of {con} – {where}", { ab: `<span class="ar">${S.ab}</span>`, n: `<em>${S.n}</em>`, c: c.count || "?", con: c.tr || S.con, where: S.where })}</span>`;
    const name = nm ? `<span class="ck-sufi"${st}>${nm.ar ? `<span class="ar"${st}>${nm.ar}</span> ` : ""}${nm.tr ? `<i class="seg-ph">${nm.tr}</i> – ` : ""}${nm.en || ""}${nm.en2 ? ` · ${nm.en2}` : ""}</span>` : "";
    const pos = S.lon ? `<span class="ck-sufi">${t("964: {lon}, {lat} · al-Ṣūfī {m} · Ptolemy {p}", { lon: S.lon, lat: S.lat + (S.fix ? " *" : ""), m: SU.magText(S.mag), p: SU.magText(S.ptol) })}</span>`
      : `<span class="ck-sufi">al-Ṣūfī ${SU.magText(S.mag)} · ${S.where}</span>`;
    return head + name + pos + (S.note ? `<span class="ck-sufi ck-note">${S.note}</span>` : "");
  }
  function tipHtml(o) {
    if (o.type === "region") return o.html;
    const pos = `${o.alt >= 0 ? t("{a}° above the horizon", { a: Math.round(o.alt) }) : t("below the horizon")} · ${Math.round(o.az)}° ${compass16(o.az)}`;
    if (o.type === "star") {
      const ph = SpaceshipSky.starPhysics(o.bv), title = t(o.name || "") || o.desig || `HIP ${o.hip}`;
      const sub = [o.name && o.desig ? o.desig : "", o.conName].filter(Boolean).join(" · ");
      return `<b style="color:${SpaceshipSky.bvColor(o.bv)}">★ ${title}</b><i>${sub}</i>
        <span>${t("Brightness {m} mag – {w}", { m: N(o.mag, 2), w: magWords(o.mag) })}</span>
        <span>${t("{c} star · type {t} · ~{k} K", { c: t(ph.colour), t: ph.cls, k: N(ph.tempK, 0) })}</span>
        <span>${t("Now {pos}", { pos })}</span>${sufiHtml(o)}<small>HIP ${o.hip} · RA ${N(o.ra / 15, 2)} h · Dec ${N(o.dec, 1)}°</small>`;
    }
    if (o.type === "dso") {
      return `<b style="color:#ffb4b4">◌ ${o.name}${o.alias ? " · " + t(o.alias) : ""}</b><i>${t(o.kind)}${o.desig ? " · " + o.desig : ""}</i>
        <span>${t("Brightness {m} mag – {w}", { m: N(o.mag, 1), w: t(o.mag < 5 ? "visible to the eye in a dark sky" : "binoculars or a telescope") })}</span>
        ${o.dim ? `<span>${t("Size on the sky ~{d}′", { d: o.dim })}</span>` : ""}<span>${t("Now {pos}", { pos })}</span><small>RA ${N(o.ra / 15, 2)} h · Dec ${N(o.dec, 1)}°</small>`;
    }
    const km = o.distAU * 149597870.7, lightMin = (o.distAU * 499.005) / 60;
    let extra = "";
    if (o.name === "Moon") extra = `<span>${t("{p}% lit · {km} km away", { p: Math.round(((1 - Math.cos(o.phase * Math.PI / 180)) / 2) * 100), km: N(Math.round(km), 0) })}</span>`;
    else if (o.name === "Sun") extra = `<span>${t("Light needs {m} minutes to reach your window", { m: N(lightMin, 1) })}</span>`;
    else extra = `<span>${t("{au} AU away · light travels {m} min", { au: N(o.distAU, 2), m: N(lightMin, 0) })}</span><span>${t("Brightness {m} mag", { m: N(o.mag, 1) })}</span>`;
    return `<b style="color:#ff9be6">${o.sym} ${t(o.name)}</b>${extra}<span>${t("Now {pos}", { pos })}</span>`;
  }
  // tap = pin the info box (stays, follows the star while you drag); tap empty sky or × = close
  const keyOf = (o) => o && (o.type === "star" ? "s" + o.hip : o.type === "region" ? "r" + o.id : o.type + o.name);
  function hideTip(force) {
    if (!ui) return;
    if (ui.pinned && !force) return;
    const tip = ui.view.querySelector(".ck-tip"), hl = ui.view.querySelector(".ck-hl");
    if (tip) tip.classList.remove("on", "pinned");
    if (hl) hl.getContext("2d").clearRect(0, 0, hl.width, hl.height);
    ui.hover = null; ui.pinned = null;
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
    if (!best && info.regionAt) { const rg = info.regionAt(x, y); if (rg) return { o: rg, sx, rect: r, at: [x, y] }; }
    return best && { o: best, sx, rect: r };
  }
  // after a re-render: put a pinned box back on its (moved) object
  function repin() {
    if (!ui || !ui.pinned) return;
    const info = ui.skyInfo, k = ui.pinned.key, cv = ui.view.querySelector(".ck-sky");
    let o = info && info.objects.find((x) => keyOf(x) === k);
    if (!o && info && info.regions) { const rg = info.regions.find((x) => keyOf(x.o) === k); o = rg && rg.o; }
    if (!o || !cv) { hideTip(true); return; }
    const r = cv.getBoundingClientRect(); ui.hover = null;
    showTip({ o, sx: cv.width / r.width, rect: r }, true);
  }
  function showTip(hit, pin) {
    const tip = ui.view.querySelector(".ck-tip"), hl = ui.view.querySelector(".ck-hl"), cv = ui.view.querySelector(".ck-sky");
    if (!tip || !hl) return;
    if (ui.hover === hit.o && !pin) return;
    const fresh = keyOf(ui.hover) !== keyOf(hit.o);
    ui.hover = hit.o;
    if (pin) ui.pinned = { key: keyOf(hit.o) };
    hl.width = cv.width; hl.height = cv.height;
    const g = hl.getContext("2d"), o = hit.o, R = Math.max(10 * hit.sx, (o.r || 6) * 2.2);
    g.clearRect(0, 0, hl.width, hl.height);
    if (o.type !== "region") {
      g.strokeStyle = pin ? "#ffd27a" : "#ff6bd6"; g.lineWidth = 2 * hit.sx;
      g.beginPath(); g.arc(o.x, o.y, R, 0, 2 * Math.PI); g.stroke();
      [[0, -1], [0, 1], [-1, 0], [1, 0]].forEach(([dx, dy]) => { g.beginPath(); g.moveTo(o.x + dx * R * 1.3, o.y + dy * R * 1.3); g.lineTo(o.x + dx * R * 1.9, o.y + dy * R * 1.9); g.stroke(); });
    }
    tip.innerHTML = (pin ? '<button class="ck-tip-x" type="button" aria-label="Close">×</button>' : "") + tipHtml(o);
    tip.classList.toggle("pinned", !!pin);
    const cx = o.x / hit.sx, cy = o.y / hit.sx, W0 = hit.rect.width, H0 = hit.rect.height;
    tip.style.left = Math.min(W0 - 250, Math.max(8, cx + 18)) + "px";
    tip.style.top = Math.min(H0 - 40 - tip.offsetHeight, Math.max(8, cy - 20)) + "px";
    if (fresh) { tip.classList.remove("on"); void tip.offsetWidth; }   // restart the fade-in only for a new object
    tip.classList.add("on");
  }
  function bindHover() {
    const v = ui.view;
    v.addEventListener("mousemove", (e) => { if (e.buttons || ui.pinned) return; const h = pickAt(e.clientX, e.clientY); if (h) showTip(h); else if (ui.hover) hideTip(); });
    v.addEventListener("mouseleave", () => hideTip());
    v.addEventListener("click", (e) => {
      if (e.target.closest && e.target.closest(".ck-tip-x")) { hideTip(true); return; }
      if (e.target.closest && e.target.closest(".ck-tip")) return;
      if (ui.wasDrag && ui.wasDrag()) return;
      const h = pickAt(e.clientX, e.clientY);
      if (h) { ui.hover = null; showTip(h, true); } else hideTip(true);
    });
  }

  // ---------- al-Ṣūfī panel: “al-Ṣūfī’s table of positions and magnitudes for the year 964” ----------
  // tab 1: the annotated page (segmentation of the Arabic writing, translation, phonetics, number tags)
  // tab 2: the table of positions and magnitudes
  function toggleTable(force) {
    const el = ui.q(".sufi-table"), T = window.SpaceshipSufi && SpaceshipSufi.table; if (!el || !T) return;
    const open = force != null ? force : el.hidden;
    el.hidden = !open; ui.q(".ck-table-btn").classList.toggle("on", open);
    if (open && !el.dataset.built) buildPanel(el, T);
    ui.layers.pos964 = open && el.dataset.tab === "table" && el.querySelector(".st-pos964").checked;
    renderSky();
  }
  function showInSky(hip) {
    const el = ui.q(".sufi-table"), res = lookAtHip(hip);
    if (res === "below") { el.querySelector(".stb-msg").textContent = "This star is below the horizon right now – move the time slider to see it rise."; return; }
    toggleTable(false);
  }
  function buildPanel(el, T) {
    const esc = (t) => String(t).replace(/&/g, "&amp;").replace(/</g, "&lt;");
    el.innerHTML = `
      <div class="stb-head"><div><h3>${esc(T.title)}</h3><small>${esc(T.conTitle)}</small></div><button type="button" class="stb-x" aria-label="Close">×</button></div>
      <div class="stb-tabs"><button type="button" data-tab="page" class="on">📖 The page, read</button><button type="button" data-tab="table">📜 Positions &amp; magnitudes</button></div>
      <div class="stb-body stb-page"></div>
      <div class="stb-body stb-table" hidden></div>
      <p class="stb-msg"></p>`;
    el.dataset.built = "1"; el.dataset.tab = "page";
    el.querySelector(".stb-x").addEventListener("click", () => toggleTable(false));
    el.querySelectorAll(".stb-tabs button").forEach((b) => b.addEventListener("click", () => {
      el.dataset.tab = b.dataset.tab;
      el.querySelectorAll(".stb-tabs button").forEach((x) => x.classList.toggle("on", x === b));
      el.querySelector(".stb-page").hidden = b.dataset.tab !== "page"; el.querySelector(".stb-table").hidden = b.dataset.tab !== "table";
      ui.layers.pos964 = b.dataset.tab === "table" && el.querySelector(".st-pos964").checked; renderSky();
    }));
    buildPage(el.querySelector(".stb-page"), SpaceshipSufi.figures[0]);
    buildTable(el.querySelector(".stb-table"), T);
  }
  // the page with its writing segmented – wide screens: callouts left/right like the annotated sheet; narrow: numbered list below
  function buildPage(box, f) {
    const SU = SpaceshipSufi, LL = SU.L, A = f.ann, esc = (x) => String(x).replace(/&/g, "&amp;").replace(/</g, "&lt;");
    const wide = box.parentElement.getBoundingClientRect().width >= 760;
    const SIDE = wide ? 700 : 0, VW = f.frameW + 2 * SIDE, VH = f.frameH + (wide ? 90 : 10);
    const cls = (b) => (b.color === "gold" ? " gold" : b.color === "violet" ? " violet" : "");
    const R = (r, c, id) => `<rect class="${c}" data-id="${id}" x="${r[0] + SIDE}" y="${r[1]}" width="${r[2] - r[0]}" height="${r[3] - r[1]}" rx="8"></rect>`;
    const P = (pts, c, id) => `<polygon class="${c}" data-id="${id}" points="${pts.map(([x, y]) => `${x + SIDE},${y}`).join(" ")}"></polygon>`;
    const parts = (b) => { if (!b.parts) return ""; const Q = b.parts;
      return (Q.rects || []).map((r) => R(r, "sg-box violet", b.id)).join("") + (Q.polys || []).map((q) => P(q, "sg-box violet", b.id)).join("") +
        `<polyline class="sg-curve" data-id="${b.id}" points="${Q.dots.map(([x, y]) => `${x + SIDE},${y}`).join(" ")}"></polyline>` +
        Q.dots.map(([x, y, r]) => `<circle class="sg-ring violet" data-id="${b.id}" cx="${x + SIDE}" cy="${y}" r="${r + 7}"></circle>`).join(""); };
    const rects = A.boxes.map((b, k) => R(b.box, "sg-box" + (b.boxColor === "cyan" ? "" : cls(b)), b.id) + parts(b) +
      (b.alif ? R(b.alif, "sg-alif", b.id) + `<circle class="sg-ring" data-id="${b.id}" cx="${b.ring[0] + SIDE}" cy="${b.ring[1]}" r="${b.ring[2]}"></circle>` : "") +
      (wide ? "" : `<g class="sg-mark${cls(b)}" data-id="${b.id}"><circle cx="${b.box[0] + SIDE}" cy="${b.box[1]}" r="26"></circle><text x="${b.box[0] + SIDE}" y="${b.box[1] + 1}">${k + 1}</text></g>`)).join("");
    const tags = A.tags.map(([n, x, y]) => { const w = String(n).length > 1 ? 44 : 30;
      return `<g class="sg-tag${n >= 17 && n <= 25 ? " violet" : ""}" data-n="${n}"><rect x="${x + SIDE - w / 2}" y="${y - 17}" width="${w}" height="34" rx="7"></rect><text x="${x + SIDE}" y="${y + 1}">${n}</text></g>`; }).join("");
    const names = (b) => (b.names ? `<div class="sg-names">${b.names.map(([ar, tr, m]) => `<p><b class="sg-ar-i" dir="rtl">${ar}</b> <i>${esc(tr)}</i> – ${esc(LL(m))}</p>`).join("")}</div>` : "");
    const textBlock = (b) => `<button type="button" class="sg-go" data-hip="${b.hip}" title="Show in the sky">↗ sky</button><p class="sg-ar" dir="rtl">${esc(b.ar)}</p><p class="sg-tr">${esc(LL(b.tr))}</p>${names(b)}<p class="sg-ph">${esc(b.ph)}</p>`;
    // zoom on the head: the same page, cropped by a nested viewBox, with each of the three stars ringed
    const inset = (b, x, y, size) => { const [vx, vy, vw, vh] = b.inset.view, k = vw / size;
      return `<svg class="sg-inset" x="${x}" y="${y}" width="${size}" height="${size}" viewBox="${vx} ${vy} ${vw} ${vh}">
        <image href="${f.page}" x="0" y="0" width="${f.frameW}" height="${f.frameH}"></image>
        <rect class="sg-alif" x="${b.alif[0]}" y="${b.alif[1]}" width="${b.alif[2] - b.alif[0]}" height="${b.alif[3] - b.alif[1]}" rx="${3 * k}" style="stroke-width:${3 * k}px"></rect>
        ${b.dots.map(([dx, dy]) => `<circle class="sg-ring" cx="${dx}" cy="${dy}" r="${5.5}" style="stroke-width:${3 * k}px"></circle>`).join("")}
        <rect class="sg-box gold" x="${b.box[0]}" y="${b.box[1]}" width="${b.box[2] - b.box[0]}" height="${b.box[3] - b.box[1]}" rx="${4 * k}" style="stroke-width:${3 * k}px"></rect>
        <rect x="${vx}" y="${vy}" width="${vw}" height="${vh}" fill="none" stroke="#f5c542" stroke-width="${3 * k}"></rect></svg>`; };
    const notes = (b) => b.inset.notes.map(([col, tx, sub]) => `<p class="sg-tr" style="color:${col}">${esc(LL(tx))}</p><p class="sg-ph">${esc(LL(sub))}</p>`).join("");
    let calls = "", extra = "";
    if (wide) calls = A.boxes.map((b) => {
      const [x0, y0, x1, y1] = b.box, Ls = b.side === "L", hi = !!b.color;
      const fx = Ls ? 24 : SIDE + f.frameW + 76, fw = SIDE - 100, ax = Ls ? SIDE - 64 : SIDE + f.frameW + 64, ay = b.ty + (hi ? 120 : 26);
      const ex = Ls ? x0 + SIDE : x1 + SIDE, ey = Math.max(y0, Math.min(y1, ay));
      if (b.inset) {   // the zoom sits under the last callout on the right (placed by relayout)
        const ix = SIDE + f.frameW + 76, iy = 1395, size = 430;
        extra += `<g class="sg-inset-g" data-size="${size}">` + inset(b, ix, iy, size) + `<foreignObject class="sg-notes-fo" x="${ix}" y="${iy + size + 12}" width="${fw}" height="300"><div xmlns="http://www.w3.org/1999/xhtml" class="sg-text sg-notes">
          <p class="sg-tr">${esc(t("Zoom on the head:"))}</p>${notes(b)}</div></foreignObject></g>`;
      }
      return `<g class="sg-call${cls(b)}" data-id="${b.id}" data-side="${b.side}" data-ty="${b.ty}" data-y0="${y0}" data-y1="${y1}"><line x1="${ex}" y1="${ey}" x2="${ax}" y2="${ay}"></line><circle cx="${ax}" cy="${ay}" r="7"></circle>
        <foreignObject x="${fx}" y="${b.ty}" width="${fw}" height="${hi ? 640 : 520}"><div xmlns="http://www.w3.org/1999/xhtml" class="sg-text${cls(b)}">${textBlock(b)}</div></foreignObject></g>`; }).join("");
    const legLine = (items, dy) => `<text class="sg-legend" x="${SIDE}" y="${f.frameH + 62}" data-dy="${dy}">${items.map(([col, tx], k) => `<tspan ${k ? 'dx="30"' : ""} style="fill:${col}">${esc(LL(tx))}</tspan>`).join("")}</text>`;
    const legend = wide ? legLine(A.legend.slice(0, 3), 0) + legLine(A.legend.slice(3), 44) : "";
    box.innerHTML = `<div class="sg-wrap${wide ? " wide" : ""}"><svg class="sg-svg" viewBox="0 0 ${VW} ${VH}" preserveAspectRatio="xMidYMin meet">
        <image href="${f.page}" x="${SIDE}" y="0" width="${f.frameW}" height="${f.frameH}"></image>${rects}${tags}${calls}${extra}${legend}</svg>
      ${wide ? "" : `<ol class="sg-list">${A.boxes.map((b) => `<li data-id="${b.id}" class="${cls(b).trim()}">${textBlock(b)}${b.inset
          ? `<div class="sg-list-inset"><svg viewBox="0 0 300 300" width="150" height="150">${inset(b, 0, 0, 300)}</svg><div>${b.inset.notes.map(([col, tx, sub]) => `<p style="color:${col}">${esc(LL(tx))}</p><p class="sg-ph">${esc(LL(sub))}</p>`).join("")}</div></div>` : ""}</li>`).join("")}</ol>
        <p class="sg-legend-h">${A.legend.map(([col, tx]) => `<span style="color:${col}">${esc(LL(tx))}</span>`).join(" · ")}</p>`}
      <p class="stb-src">The drawing is “as seen on the globe”, the mirror image of the sky – in the cockpit it is flipped onto the real stars. Segmentation and readings from the project chat “صورة محادثة مترجمة”.</p></div>`;
    // highlight a segment everywhere when one of its parts is touched
    const all = (id) => box.querySelectorAll(`[data-id="${id}"]`);
    box.querySelectorAll("[data-id]").forEach((n) => {
      n.addEventListener("mouseenter", () => all(n.dataset.id).forEach((x) => x.classList.add("on")));
      n.addEventListener("mouseleave", () => all(n.dataset.id).forEach((x) => x.classList.remove("on")));
      n.addEventListener("click", (e) => { if (e.target.closest(".sg-go")) return;
        box.querySelectorAll(".pin").forEach((x) => x.classList.remove("pin")); all(n.dataset.id).forEach((x) => x.classList.add("pin"));
        if (!wide) { const li = box.querySelector(`li[data-id="${n.dataset.id}"]`); li && li.scrollIntoView({ block: "nearest", behavior: "smooth" }); } });
    });
    box.querySelectorAll(".sg-go").forEach((b) => b.addEventListener("click", () => showInSky(Number(b.dataset.hip))));
    // measured layout: stack the callouts of each side without overlap, then hang the head zoom under the right column
    if (wide) requestAnimationFrame(() => {
      const svg = box.querySelector(".sg-svg"), k = VW / Math.max(1, svg.getBoundingClientRect().width); let maxBottom = f.frameH;
      ["L", "R"].forEach((side) => {
        let bottom = -Infinity;
        [...box.querySelectorAll(`.sg-call[data-side="${side}"]`)].sort((a, b) => a.dataset.ty - b.dataset.ty).forEach((gEl) => {
          const fo = gEl.querySelector("foreignObject"), h = fo.firstElementChild.getBoundingClientRect().height * k;
          const y = Math.max(Number(gEl.dataset.ty), bottom + 28);
          fo.setAttribute("y", y); fo.setAttribute("height", h + 24);
          const ay = y + Math.min(gEl.classList.contains("gold") || gEl.classList.contains("violet") ? 120 : 26, h / 2), line = gEl.querySelector("line");
          line.setAttribute("y2", ay); gEl.querySelector("circle").setAttribute("cy", ay);
          line.setAttribute("y1", Math.max(Number(gEl.dataset.y0), Math.min(Number(gEl.dataset.y1), ay)));
          bottom = y + h;
        });
        const ins = side === "R" && box.querySelector(".sg-inset-g");
        if (ins) { const size = Number(ins.dataset.size), iy = Math.max(bottom + 44, 0);
          ins.querySelector("svg").setAttribute("y", iy); const nf = ins.querySelector(".sg-notes-fo"); nf.setAttribute("y", iy + size + 14);
          bottom = iy + size + 14 + nf.firstElementChild.getBoundingClientRect().height * k; }
        maxBottom = Math.max(maxBottom, bottom);
      });
      const ly = Math.max(f.frameH + 62, maxBottom + 56);
      svg.querySelectorAll(".sg-legend").forEach((lg) => lg.setAttribute("y", ly + Number(lg.dataset.dy || 0)));
      svg.setAttribute("viewBox", `0 0 ${VW} ${Math.max(VH, ly + 74)}`);
    });
    box.querySelectorAll(".sg-tag").forEach((tg) => tg.addEventListener("click", () => {
      const r = SpaceshipSufi.table.rows.find((x) => x.n === Number(tg.dataset.n)); if (r) showInSky(r.hip); }));
  }
  function buildTable(el, T) {
    const SU = SpaceshipSufi, esc = (t) => String(t).replace(/&/g, "&amp;").replace(/</g, "&lt;");
    const nameCell = (r) => { const nm = SU.nameOf(r); if (!nm) return ""; const st = nm.color ? ` style="color:${SU.COLORS[nm.color]}"` : "";
      return `${nm.ar ? `<span class="ar"${st}>${nm.ar}</span>` : ""}${nm.tr ? `<i>${esc(nm.tr)}</i>` : ""}`; };
    const row = (r) => `<tr data-hip="${r.hip}" class="${r.n >= 17 && r.n <= 25 ? "violet" : r.n === 1 ? "gold" : ""}" title="${esc(r.fix || r.note || "Show this star in the sky")}">
      <td class="n"><span class="ar">${r.ab}</span><b>${r.n}</b></td><td>${esc(r.where)}${r.fix ? ' <span class="fix">*</span>' : ""}</td>
      <td class="mono">${r.lon || "—"}</td><td class="mono">${r.lat || "—"}</td>
      <td class="mono">${esc(r.mag === "neb" ? "nebula" : r.mag)}</td><td class="mono">${esc(r.ptol ? (r.ptol === "neb" ? "nebula" : r.ptol) : "—")}</td>
      <td class="mono">${r.v != null ? r.v.toFixed(2) : r.n === 31 ? "M42 ≈ 4" : "—"}</td><td class="nm">${nameCell(r)}</td></tr>`;
    const fixes = T.rows.filter((r) => r.fix).map((r) => `<li><b>${r.n}</b>: ${esc(r.fix)}</li>`).join("");
    el.innerHTML = `
      <label class="stb-opt"><input type="checkbox" class="st-pos964" checked> Mark al-Ṣūfī’s 964 positions in the sky (◇, dashed line to the real star)</label>
      <div class="stb-scroll"><table>
        <thead><tr><th>№</th><th>Place on the figure</th><th>Longitude</th><th>Latitude</th><th>al-Ṣūfī</th><th>Ptolemy</th><th>Today</th><th>Arabic name</th></tr></thead>
        <tbody>${T.rows.map(row).join("")}<tr class="sep"><td colspan="8">Added by al-Ṣūfī in his comments</td></tr>${T.added.map(row).join("")}</tbody>
      </table></div>
      <div class="stb-foot"><p>${esc(T.note)}</p><ul>${fixes}</ul><p class="stb-src">${esc(T.source)} ${esc(t("Tap a row to find the star."))}</p></div>`;
    el.querySelector(".st-pos964").addEventListener("change", (e) => { ui.layers.pos964 = e.target.checked; renderSky(); });
    el.querySelectorAll("tbody tr[data-hip]").forEach((tr) => tr.addEventListener("click", () => {
      el.querySelectorAll("tr.sel").forEach((x) => x.classList.remove("sel")); tr.classList.add("sel");
      const hip = Number(tr.dataset.hip), res = lookAtHip(hip);
      ui.q(".sufi-table .stb-msg").textContent = res === "below" ? "This star is below the horizon right now – move the time slider to see it rise." : res === "missing" ? "This star is too faint for the sky map." : "";
    }));
  }
  // point the dome at a catalogue star and pin its info box
  function lookAtHip(hip) {
    const cat = window.SpaceshipSky && SpaceshipSky.catalog(); if (!cat || !ui) return "missing";
    const st = cat.stars.find((x) => x[7] === hip); if (!st) return "missing";
    const w = cur.windows[active], t = skyTime();
    const v = SpaceshipSky.horizVec(st[0], st[1], w.lat, SpaceshipSky.lstDeg(t, w.lon));
    const alt = Math.asin(Math.max(-1, Math.min(1, v[2]))) * 180 / Math.PI, az = (Math.atan2(v[0], v[1]) * 180 / Math.PI + 360) % 360;
    ui.pinned = { key: "s" + hip }; ui.hover = null;
    Object.assign(ui.cam, { az, alt: Math.max(-10, alt), fov: Math.min(ui.cam.fov, 60) }); renderSky();
    return alt < 0 ? "below" : "ok";
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
    if (!ui.radar) return;
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
      <div class="lv-stage">
        <div class="lv-cockpit">
          <div class="ck-view" id="ck-view"></div>
          <svg class="ck-frame" viewBox="0 0 1000 640" preserveAspectRatio="none" aria-hidden="true">
            <defs><linearGradient id="ckm" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#0d1222"/><stop offset="1" stop-color="#03050b"/></linearGradient></defs>
            <path d="M0 0 H1000 V34 Q760 14 500 12 Q240 14 0 34 Z" fill="url(#ckm)"/>
            <path d="M0 0 V640 H22 L70 34 Q30 30 0 34 Z" fill="url(#ckm)"/>
            <path d="M1000 0 V640 H978 L930 34 Q970 30 1000 34 Z" fill="url(#ckm)"/>
            <path d="M0 612 Q500 590 1000 612 V640 H0 Z" fill="url(#ckm)"/>
            <path d="M70 34 Q500 4 930 34" stroke="#8fd3ff" stroke-opacity=".25" stroke-width="1.5" fill="none"/>
            <path d="M70 34 L22 640 M930 34 L978 640" stroke="#8fd3ff" stroke-opacity=".15" stroke-width="1.5"/>
          </svg>
        </div>
        <canvas class="st-scan" hidden></canvas>
        <div class="sufi-table" hidden></div>
        <button class="st-skip" type="button" hidden>Skip scan ›</button>

        <div class="ly ly-tl">
          <div class="ly-head"><span>${(st.address.label || "").replace(/</g, "&lt;")}</span><small>${t("deck {n}", { n: floor })}</small></div>
          <div class="ck-wins"><button class="ck-mode" type="button" title="Real stars / original photo">★ Space</button></div>
          <div class="ck-layers">
            <button data-l="mw" class="on" title="Milky Way">Milky Way</button><button data-l="cons" class="on" title="Constellation lines">Lines</button>
            <button data-l="ecl" class="on" title="Ecliptic – path of Sun, Moon and planets">Ecliptic</button><button data-l="dso" class="on" title="Galaxies, nebulae, clusters (Messier)">Deep sky</button>
            <button data-l="grid" title="Alt-azimuth grid">Alt/Az</button><button data-l="eq" title="Equatorial grid">RA/Dec</button><button data-l="labels" class="on" title="Names">Names</button><button data-l="blend" class="on" title="Blend the real window photo in and out every 10 s">Photo blend</button><button data-l="sufi" class="on" title="al-Ṣūfī's constellation drawing (Book of the Fixed Stars, c. 964)">al-Ṣūfī</button><button data-l="sufiSeg" title="Boxes around the Arabic writing, translation and phonetics, star-number tags">Segments</button><button class="ck-table-btn" type="button" title="al-Ṣūfī’s table of positions and magnitudes for the year 964">📜 al-Ṣūfī 964</button>
          </div>
          <div class="ck-idrow"><button class="ck-id" type="button" title="Show this ship's ID and link">🔑 Ship ID</button></div>
          <div class="ck-idbox" hidden></div>
          <img class="ck-inlay" alt="Original window photo" title="Original photo – tap to show it in the sky">
          <small class="ck-hint">drag · scroll/pinch zoom · double-click resets</small>
        </div>
        <div class="ly ly-tr">
          <div class="row" style="gap:8px;align-items:baseline;justify-content:space-between"><span id="ck-time">--:--</span><button class="ck-now" type="button">Now</button></div>
          <input class="ck-slider" type="range" min="-12" max="12" step="0.25" value="0" aria-label="Time offset in hours">
          <small id="ck-date">now · live</small><small id="ck-sun"></small>
        </div>
        <div class="ly ly-bc lv-info">
          <div class="ck-tape" id="ck-tape"></div>
          <div class="li-row">
            <div class="li-col"><b id="ck-name">–</b><span>hdg <i id="ck-hdg">–</i> · tilt <i id="ck-tilt">–</i></span></div>
            <div class="li-col li-mid" id="ck-sky-info"></div>
            <div class="li-col li-right"><span id="ck-alt">–</span><span id="ck-src">–</span><span id="ck-pos" hidden>–</span></div>
          </div>
        </div>
        <div class="ly ly-bl">
          <div class="ly-head"><span>Ship</span><small>${t("{n} ports", { n: st.windows.length })}</small></div>
          <div class="lv-pixel">
            <canvas class="lv-main" width="${W}" height="${H}"></canvas>
            <canvas class="lv-intro" width="${W * K}" height="${H * K}" hidden></canvas>
            <div class="lv-caption" hidden></div>
            <div class="lv-scanhud" hidden></div>
            <canvas class="lv-origin" width="${W * 2}" height="${H * 2}" title="Origin: your building from above"></canvas>
            <button class="lv-replay" type="button">↺ Take-off</button>
          </div>
        </div>
        <div class="ly ly-br" id="lv-spec"><div class="ly-head"><span>Composition</span><small>scanning…</small></div></div>
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
    ui.layers = { mw: true, cons: true, ecl: true, dso: true, grid: false, eq: false, labels: true, blend: true, sufi: true, sufiSeg: false, pos964: false };
    ui.inlay = q(".ck-inlay");
    // ship ID: to reopen this ship later (also on another device)
    q(".ck-id").addEventListener("click", () => {
      const box = q(".ck-idbox"); if (!box.hidden) { box.hidden = true; return; }
      const id = st.loadedId;
      if (!id) { box.innerHTML = "<span>This ship is not saved yet – go back and use <b>Save &amp; launch</b> to get an ID.</span>"; box.hidden = false; return; }
      const link = location.origin + location.pathname + "?ship=" + id;
      box.innerHTML = `<span>Ship ID</span><code>${id}</code><span>Link</span><code>${link}</code>
        <div class="row" style="gap:6px;margin-top:6px"><button type="button" data-copy="${id}">Copy ID</button><button type="button" data-copy="${link}">Copy link</button></div>
        <small>Keep it – paste it on the start page under “Open a spaceship” to come back.</small>`;
      box.querySelectorAll("[data-copy]").forEach((b) => b.addEventListener("click", async () => {
        try { await navigator.clipboard.writeText(b.dataset.copy); b.textContent = "✓ Copied"; }
        catch (_) { const r = document.createRange(); r.selectNodeContents(b.previousElementSibling || box); b.textContent = "Select & copy"; }
      }));
      box.hidden = false;
    });
    qa(".ck-layers button[data-l]").forEach((b) => b.addEventListener("click", () => { const k = b.dataset.l; ui.layers[k] = !ui.layers[k]; b.classList.toggle("on", ui.layers[k]); renderSky(); }));
    bindNav();
    const modeBtn = q(".ck-mode");
    modeBtn.addEventListener("click", () => { ui.skyMode = ui.skyMode === "space" ? "photo" : "space";
      modeBtn.textContent = ui.skyMode === "space" ? "★ Space" : "▣ Photo"; ui.inlay.classList.toggle("on", ui.skyMode === "photo"); renderSky(); });
    ui.inlay.addEventListener("click", () => modeBtn.click());
    q(".ck-table-btn").addEventListener("click", () => toggleTable());
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
    // the small ship waits for the main-stage scan; prepare its satellite layers meanwhile
    ui.groundP = buildGround(st, ship, 1); ui.midP = buildGround(st, ship, 3, 1.5); ui.wideP = buildGround(st, ship, WIDE, 2);
    ui.groundP.then((c) => { if (ui && !ship.reskinned) { ship.reskinned = true; ship.reskin(c); } });
    ui.scanTimeout = setTimeout(() => { if (ui && !ui.scanPlayed) { ui.scanPlayed = true; ui.q(".st-scan").hidden = true; startIntro(8.5); } }, 15000);
    ui.shimmer = setInterval(starShimmer, 1400);
    ui.groundP.then((gcv) => {
      if (!ui) return;
      const o = ui.q(".lv-origin"), og = o.getContext("2d");
      og.drawImage(gcv, 0, 0, o.width, o.height);
      og.save(); ringPath(og, ship, o.width / W); og.strokeStyle = "#7dfcff"; og.lineWidth = 3; og.stroke(); og.restore();
      o.classList.add("on");
    });
    q(".lv-replay").addEventListener("click", () => startIntro(8.5));
    { const sc = q(".st-scan"); sc.hidden = false; const g0 = sc.getContext("2d"); sc.width = 10; sc.height = 10; g0.fillStyle = "#03050c"; g0.fillRect(0, 0, 10, 10); }
    ui.specOverlay = true;
    st.floor = floor;
    if (window.SpaceshipCompose) SpaceshipCompose.analyze(st, renderSpec);
    t0 = performance.now(); cancelAnimationFrame(raf); raf = requestAnimationFrame(frame);
  }
  function unmount() {
    cancelAnimationFrame(raf);
    if (ui && ui.clock) clearInterval(ui.clock);
    if (ui && ui.shimmer) clearInterval(ui.shimmer);
    if (ui && ui.scanTimeout) clearTimeout(ui.scanTimeout);
    if (ui && ui.scanCtl) ui.scanCtl.stop();
    if (window.SpaceshipSound) SpaceshipSound.stop();
    if (ui && ui.onResize) window.removeEventListener("resize", ui.onResize);
    ui = null;
  }

  // point the dome at a direction (also used by tests)
  function look(az, alt, fov) { if (!ui || !ui.cam) return; Object.assign(ui.cam, { az, alt }, fov ? { fov } : {}); renderSky(); }
  if (window.I18N) I18N.on(() => {
    if (!ui) return;
    if (ui.spec) renderSpec(ui.spec);
    const el = ui.q(".sufi-table");
    if (el && el.dataset.built) { const open = !el.hidden, tab = el.dataset.tab; delete el.dataset.built; el.innerHTML = "";
      if (open) { buildPanel(el, SpaceshipSufi.table); if (tab === "table") el.querySelector('.stb-tabs button[data-tab="table"]').click(); } }
    ui.q(".ly-tl .ly-head small").textContent = t("deck {n}", { n: cur.floor || 0 });
    ui.q(".ly-bl .ly-head small").textContent = t("{n} ports", { n: cur.windows.length });
    selectWindowReadouts(); ui.pinned = null; renderSky();
  });
  window.SpaceshipLaunch = { mount, unmount, look };
})();
