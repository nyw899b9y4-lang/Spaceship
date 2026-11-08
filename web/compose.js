// Ship composition: the 200 m surroundings of the building become the ship's "DNA".
// Sources: satellite image classification (vegetation / water / roofs / paved / shade),
// OpenStreetMap counts within 200 m, and the building's own geometry and windows.
// Output: a stable parameter set (spec v1) for later functionality – stats, physical
// movement parameters and special capabilities.
"use strict";
(function () {
  const D2R = Math.PI / 180, R2D = 180 / Math.PI, RADIUS = 200;
  const clamp = (v, a = 5, b = 99) => Math.max(a, Math.min(b, Math.round(v)));

  // ---------- geometry of the building ----------
  function localXY(lat, lon, ref) {
    return [(lon - ref[1]) * D2R * 6371008.8 * Math.cos(ref[0] * D2R), (lat - ref[0]) * D2R * 6371008.8];
  }
  function geometry(st) {
    const ring = st.building && st.building.ring && st.building.ring.length > 3 ? st.building.ring : null;
    const c = ring ? ring.reduce((s, p) => [s[0] + p[0] / ring.length, s[1] + p[1] / ring.length], [0, 0]) : [st.address.lat, st.address.lon];
    let area = 300, perimeter = 70, length = 20, width = 15;
    if (ring) {
      const pts = ring.map(([a, b]) => localXY(a, b, c));
      area = 0; perimeter = 0;
      for (let i = 0; i < pts.length - 1; i++) {
        area += pts[i][0] * pts[i + 1][1] - pts[i + 1][0] * pts[i][1];
        perimeter += Math.hypot(pts[i + 1][0] - pts[i][0], pts[i + 1][1] - pts[i][1]);
      }
      area = Math.abs(area) / 2;
      // dominant wall direction → length/width along the building's own axes
      let C = 0, S = 0;
      for (let i = 0; i < pts.length - 1; i++) {
        const dx = pts[i + 1][0] - pts[i][0], dy = pts[i + 1][1] - pts[i][1], l = Math.hypot(dx, dy), a = Math.atan2(dy, dx);
        C += l * Math.cos(4 * a); S += l * Math.sin(4 * a);
      }
      const th = Math.atan2(S, C) / 4;
      const xs = pts.map(([x, y]) => x * Math.cos(-th) - y * Math.sin(-th)), ys = pts.map(([x, y]) => x * Math.sin(-th) + y * Math.cos(-th));
      const a = Math.max(...xs) - Math.min(...xs), b = Math.max(...ys) - Math.min(...ys);
      length = Math.max(a, b); width = Math.min(a, b);
    }
    const floor = Number(st.floor != null ? st.floor : 0) || 0;
    const levels = (st.building && st.building.levels) || Math.max(floor + 1, 3);
    const az = st.windows.map((w) => (w.capture && w.capture.camera_azimuth_deg != null ? w.capture.camera_azimuth_deg : w.wall_azimuth_deg)).filter((v) => v != null);
    // angular spread of the window directions (smallest arc containing all)
    let spread = 0;
    if (az.length > 1) {
      const s = [...az].sort((x, y) => x - y); let maxGap = 0;
      for (let i = 0; i < s.length; i++) maxGap = Math.max(maxGap, ((s[(i + 1) % s.length] - s[i]) + 360) % 360 || 360);
      spread = 360 - maxGap;
    }
    const south = az.filter((a) => Math.abs(((a - 180 + 540) % 360) - 180) <= 60).length;
    const elev = st.windows.map((w) => w.capture && w.capture.camera_elevation_deg).filter((v) => v != null);
    return { center: c, area, perimeter, length, width, aspect: length / Math.max(1, width), levels, floor,
             windows: st.windows.length, spreadDeg: spread, southWindows: south, avgTiltDeg: elev.length ? elev.reduce((a, b) => a + b, 0) / elev.length : 0 };
  }

  // ---------- satellite classification within 200 m ----------
  const inCH = (lat, lon) => lat > 45.8 && lat < 47.9 && lon > 5.9 && lon < 10.6;
  const lon2g = (lon, z) => ((lon + 180) / 360) * 256 * 2 ** z;
  const lat2g = (lat, z) => { const r = lat * D2R; return ((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * 256 * 2 ** z; };
  function tileUrl(z, x, y, ch) {
    return ch ? `https://wmts.geo.admin.ch/1.0.0/ch.swisstopo.swissimage/default/current/3857/${z}/${x}/${y}.jpeg`
              : `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${z}/${y}/${x}`;
  }
  // north-up image of the circle (radius 200 m + margin), with metres-per-pixel known
  function satelliteCanvas(lat, lon) {
    const z = 17, size = 512, ch = inCH(lat, lon);
    const mpp = (156543.03392 * Math.cos(lat * D2R)) / 2 ** z;      // metres per tile pixel
    const cxg = lon2g(lon, z), cyg = lat2g(lat, z), half = (RADIUS * 1.1) / mpp;
    const cv = document.createElement("canvas"); cv.width = size; cv.height = size;
    const g = cv.getContext("2d"), k = size / (2 * half);
    g.fillStyle = "#222"; g.fillRect(0, 0, size, size);
    const tx0 = Math.floor((cxg - half) / 256), tx1 = Math.floor((cxg + half) / 256);
    const ty0 = Math.floor((cyg - half) / 256), ty1 = Math.floor((cyg + half) / 256);
    const jobs = [];
    for (let tx = tx0; tx <= tx1; tx++) for (let ty = ty0; ty <= ty1; ty++) jobs.push(new Promise((res) => {
      const img = new Image(); img.crossOrigin = "anonymous";
      img.onload = () => { g.drawImage(img, (tx * 256 - (cxg - half)) * k, (ty * 256 - (cyg - half)) * k, 256 * k + 0.5, 256 * k + 0.5); res(true); };
      img.onerror = () => res(false);
      img.src = tileUrl(z, tx, ty, ch);
    }));
    const timeout = new Promise((r) => setTimeout(r, 8000));
    return Promise.race([Promise.all(jobs), timeout]).then(() => ({ canvas: cv, metresPerPx: (2 * half * mpp) / size }));
  }
  const CLASS = { veg: [86, 196, 94], water: [64, 140, 255], roof: [230, 122, 74], paved: [150, 156, 170], shade: [40, 44, 70] };
  function classify(sat) {
    const cv = sat.canvas, n = cv.width, g = cv.getContext("2d");
    let d; try { d = g.getImageData(0, 0, n, n).data; } catch (_) { return null; }
    const R = RADIUS / sat.metresPerPx, cx = n / 2;
    const counts = { veg: 0, water: 0, roof: 0, paved: 0, shade: 0 }; let total = 0;
    const overlay = g.createImageData(n, n);
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      if ((x - cx) ** 2 + (y - cx) ** 2 > R * R) continue;
      const i = (y * n + x) * 4, r = d[i], gg = d[i + 1], b = d[i + 2], lum = 0.299 * r + 0.587 * gg + 0.114 * b;
      const mx = Math.max(r, gg, b), mn = Math.min(r, gg, b), sat_ = mx ? (mx - mn) / mx : 0, exg = 2 * gg - r - b;
      let c;
      if (lum < 48) c = "shade";
      else if (exg > 14 && gg > r) c = "veg";
      else if (b > r + 18 && b > gg + 4) c = "water";
      else if (r > gg + 8 && r > b + 18 && sat_ > 0.16) c = "roof";
      else if (sat_ < 0.16) c = lum > 150 ? "roof" : "paved";      // light flat roofs vs grey asphalt
      else c = "paved";
      counts[c]++; total++;
      const col = CLASS[c]; overlay.data[i] = col[0]; overlay.data[i + 1] = col[1]; overlay.data[i + 2] = col[2]; overlay.data[i + 3] = 150;
    }
    const share = {}; Object.keys(counts).forEach((k2) => (share[k2] = total ? counts[k2] / total : 0));
    const oc = document.createElement("canvas"); oc.width = n; oc.height = n; oc.getContext("2d").putImageData(overlay, 0, 0);
    return { share, overlay: oc };
  }

  // ---------- OpenStreetMap within 200 m ----------
  const OVERPASS = ["https://overpass-api.de/api/interpreter", "https://overpass.private.coffee/api/interpreter",
                    "https://maps.mail.ru/osm/tools/overpass/api/interpreter"];
  async function overpass(q) {
    const ctrls = OVERPASS.map(() => new AbortController());
    const timer = setTimeout(() => ctrls.forEach((c) => c.abort()), 50000);
    try {
      return await Promise.any(OVERPASS.map(async (url, i) => {
        const res = await fetch(url, { method: "POST", body: "data=" + encodeURIComponent(q), signal: ctrls[i].signal,
          headers: { "Content-Type": "application/x-www-form-urlencoded" } });
        if (!res.ok) throw new Error(res.status);
        const j = await res.json(); ctrls.forEach((c, k) => k !== i && c.abort()); return j;
      }));
    } finally { clearTimeout(timer); }
  }
  async function osmCounts(lat, lon, ownId) {
    const key = `spaceship-osm-v1-${lat.toFixed(5)},${lon.toFixed(5)}`;
    try { const c = JSON.parse(localStorage.getItem(key) || "null"); if (c && Date.now() - c.t < 7 * 864e5) return c.v; } catch (_) {}
    const A = `(around:${RADIUS},${lat},${lon})`;
    const q = `[out:json][timeout:40];(way["building"]${A};way["highway"]${A};way["railway"]${A};nwr["natural"="water"]${A};way["waterway"]${A};` +
      `nwr["leisure"~"park|garden|playground|pitch|sports_centre"]${A};nwr["landuse"~"grass|forest|meadow|recreation_ground|allotments|village_green"]${A};` +
      `node["natural"="tree"]${A};nwr["amenity"]${A};nwr["shop"]${A};);out tags qt;`;
    const j = await overpass(q);
    const v = { buildings: 0, levelsSum: 0, levelsN: 0, roads: 0, majorRoads: 0, footways: 0, tram: false, rail: false, water: false,
                parks: 0, green: 0, trees: 0, amenities: 0, shops: 0, schools: 0, worship: 0, food: 0 };
    (j.elements || []).forEach((e) => {
      const t = e.tags || {};
      if (t.building && e.id !== ownId) { v.buildings++; const l = parseFloat(t["building:levels"]); if (l) { v.levelsSum += l; v.levelsN++; } }
      if (t.highway) {
        if (/^(primary|secondary|tertiary|trunk)/.test(t.highway)) v.majorRoads++;
        else if (/footway|path|pedestrian|cycleway|steps/.test(t.highway)) v.footways++;
        else v.roads++;
      }
      if (t.railway === "tram") v.tram = true;
      if (/^(rail|light_rail|subway|narrow_gauge)$/.test(t.railway || "")) v.rail = true;
      if (t.natural === "water" || t.waterway) v.water = true;
      if (t.leisure) v.parks++;
      if (t.landuse) v.green++;
      if (t.natural === "tree") v.trees++;
      if (t.amenity) { v.amenities++; if (/school|kindergarten|university|college/.test(t.amenity)) v.schools++;
        if (t.amenity === "place_of_worship") v.worship++; if (/restaurant|cafe|bar|pub|fast_food|bakery/.test(t.amenity)) v.food++; }
      if (t.shop) v.shops++;
    });
    v.avgLevels = v.levelsN ? v.levelsSum / v.levelsN : null; delete v.levelsSum; delete v.levelsN;
    try { localStorage.setItem(key, JSON.stringify({ t: Date.now(), v })); } catch (_) {}
    return v;
  }

  // ---------- parameters ----------
  function compute(geo, satShare, osm) {
    const s = satShare || { veg: 0.25, water: 0, roof: 0.35, paved: 0.3, shade: 0.1 };
    const o = osm || { buildings: 40, roads: 6, majorRoads: 1, footways: 4, tram: false, rail: false, water: false, parks: 1, green: 1, trees: 10, amenities: 5, shops: 2, avgLevels: null, food: 1, schools: 0, worship: 0 };
    const mass = geo.area * geo.levels;                                  // m² × floors ≈ size of the ship
    const engines = Math.max(1, Math.min(4, Math.round(1 + (o.roads + 2 * o.majorRoads) / 8)));
    const st = {
      hull:        clamp(18 + Math.min(45, geo.area / 18) + Math.min(30, geo.levels * 4)),
      speed:       clamp(28 + s.paved * 70 + (o.tram ? 10 : 0) + (o.rail ? 10 : 0) + Math.min(15, o.majorRoads * 3) - Math.min(25, mass / 500)),
      acceleration:clamp(22 + engines * 11 + s.paved * 25 - Math.min(20, mass / 700)),
      turn:        clamp(25 + 45 / geo.aspect + s.veg * 25 + Math.min(10, o.footways) - Math.min(18, geo.area / 60)),
      tilt:        clamp(25 + Math.min(30, geo.floor * 6) + (1 - s.roof) * 25 + Math.min(10, Math.abs(geo.avgTiltDeg))),
      shield:      clamp(15 + Math.min(40, o.buildings * 0.8) + s.veg * 35 + Math.min(10, o.trees * 0.2)),
      sensors:     clamp(15 + geo.windows * 9 + geo.spreadDeg / 6 + geo.floor * 3),
      energy:      clamp(18 + geo.southWindows * 16 + s.roof * 45 + (1 - s.shade) * 10),
      stealth:     clamp(10 + s.roof * 55 + s.shade * 80 + Math.min(10, o.buildings * 0.15)),
      lifeSupport: clamp(12 + s.veg * 90 + (o.water || s.water > 0.02 ? 12 : 0) + Math.min(15, (o.parks + o.green) * 3)),
      trade:       clamp(8 + Math.min(70, (o.shops + o.food) * 3 + o.amenities)),
    };
    // physical movement parameters for later gameplay (fictional units)
    const physics = {
      engines,
      mass_t: Math.round(mass * 0.9),                                       // "tonnes"
      max_speed: Math.round(st.speed * 12),                                 // units/s
      acceleration: Math.round(st.acceleration * 2.5),                     // units/s²
      turn_rate_deg_s: Math.round(15 + st.turn * 1.6),
      pitch_rate_deg_s: Math.round(10 + st.tilt * 1.2),
      roll_rate_deg_s: Math.round(20 + st.tilt * 1.8),
      max_tilt_deg: Math.round(15 + st.tilt * 0.6),
      shield_regen_per_s: Math.round(st.lifeSupport / 10 + st.shield / 20),
      sensor_range: Math.round(200 + st.sensors * 25),                      // matches the real 200 m scan at minimum
    };
    const caps = [];
    const add = (id, name, desc, cond, de) => cond && caps.push({ id, name, desc, de });
    add("bio_dome", "Bio-dome regeneration", `Hull repairs itself – ${Math.round(s.veg * 100)} % greenery around the house`, s.veg >= 0.22 || o.parks + o.green >= 3,
      ["Biokuppel-Regeneration", `Rumpf repariert sich selbst – ${Math.round(s.veg * 100)} % Grün rund ums Haus`]);
    add("hydro", "Hydro-cooling", "Water nearby cools the engines – longer boost", o.water || s.water >= 0.02,
      ["Wasserkühlung", "Wasser in der Nähe kühlt die Triebwerke – längerer Boost"]);
    add("maglev", "Maglev boost", `${o.tram ? "Tram" : "Rail"} line within 200 m – short burst of extra speed`, o.tram || o.rail,
      ["Magnetschwebe-Boost", `${o.tram ? "Tram" : "Bahn"}linie im Umkreis von 200 m – kurzer Extraschub`]);
    add("solar", "Solar sails", `${geo.southWindows} south-facing window${geo.southWindows === 1 ? "" : "s"} – recharge from starlight`, geo.southWindows >= 1 || s.roof >= 0.4,
      ["Sonnensegel", `${geo.southWindows} Fenster nach Süden – Aufladen mit Sternenlicht`]);
    add("cloak", "Urban cloaking", `${o.buildings} buildings around – hide in the crowd`, o.buildings >= 60 || s.roof >= 0.38,
      ["Stadttarnung", `${o.buildings} Gebäude ringsum – in der Menge verschwinden`]);
    add("panorama", "Panorama sensors", `Windows cover ${Math.round(geo.spreadDeg)}° of the horizon`, geo.windows >= 3 || geo.spreadDeg >= 120,
      ["Panorama-Sensoren", `Die Fenster überblicken ${Math.round(geo.spreadDeg)}° des Horizonts`]);
    add("high_orbit", "High orbit", `Deck ${geo.floor} – starts above the rooftops`, geo.floor >= 4,
      ["Hoher Orbit", `Deck ${geo.floor} – startet über den Dächern`]);
    add("trade_port", "Trade port", `${o.shops + o.food} shops & cafés nearby`, o.shops + o.food >= 8,
      ["Handelshafen", `${o.shops + o.food} Läden & Cafés in der Nähe`]);
    add("academy", "Academy link", "School nearby – faster skill upgrades", o.schools >= 1,
      ["Akademie-Anschluss", "Schule in der Nähe – schnellere Upgrades"]);
    add("sanctuary", "Sanctuary", "Place of worship nearby – calm shield", o.worship >= 1,
      ["Refugium", "Gotteshaus in der Nähe – ruhiger Schild"]);
    add("arterial", "Arterial jump", `${o.majorRoads} main road${o.majorRoads === 1 ? "" : "s"} – quick jump to the next sector`, o.majorRoads >= 2,
      ["Hauptstraßen-Sprung", `${o.majorRoads} Hauptstraße${o.majorRoads === 1 ? "" : "n"} – schneller Sprung in den nächsten Sektor`]);
    return { stats: st, physics, capabilities: caps };
  }

  // ---------- public: analyse (incremental updates) ----------
  function analyze(st, onUpdate) {
    const geo = geometry(st), [lat, lon] = geo.center;
    const result = { spec: "spaceship-composition", version: 1, radius_m: RADIUS, center: { lat, lon }, geometry: geo,
                     satellite: null, osm: null, status: { satellite: "loading", osm: "loading" } };
    const emit = () => { Object.assign(result, compute(geo, result.satellite && result.satellite.share, result.osm)); onUpdate && onUpdate(result); };
    emit();
    satelliteCanvas(lat, lon).then((sat) => {
      const cl = classify(sat);
      result.satImage = sat.canvas; result.metresPerPx = sat.metresPerPx;
      if (cl) { result.satellite = { share: cl.share }; result.overlay = cl.overlay; result.status.satellite = "ok"; }
      else result.status.satellite = "unreadable";
      emit();
    }).catch(() => { result.status.satellite = "failed"; emit(); });
    osmCounts(lat, lon, st.building && st.building.osm_id).then((v) => { result.osm = v; result.status.osm = "ok"; emit(); })
      .catch(() => { result.status.osm = "failed"; emit(); });
    return result;
  }
  // JSON spec without canvases
  function specJSON(r, st) {
    const out = { spec: r.spec, version: r.version, created: new Date().toISOString(), address: st.address.label, radius_m: r.radius_m,
      center: r.center, geometry: r.geometry, surroundings: { satellite: r.satellite, osm: r.osm, status: r.status },
      stats: r.stats, physics: r.physics, capabilities: r.capabilities.map(({ id, name, desc }) => ({ id, name, desc })) };
    return JSON.stringify(out, (k, v) => (typeof v === "number" ? Math.round(v * 1000) / 1000 : v), 2);
  }

  window.SpaceshipCompose = { analyze, specJSON, CLASS, RADIUS };
})();
