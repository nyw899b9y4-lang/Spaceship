// Soundsphere: a generative soundscape composed from the ship's surroundings (Web Audio, no files).
//   drone        – root note from the building height (more floors → lower, heavier)
//   pad chord    – major when the area is green, minor when it is mostly sealed
//   city rumble  – low brown noise, louder with more streets & paved area
//   wind + birds – filtered noise and short chirps, with more greenery
//   tram bell    – a soft bell now and then if a tram / rail line is near
//   water        – gentle bubbles if water is near
//   star shimmer – quiet high pings, panned by star position in the cockpit
//   scan tone    – during the scan each slice is heard: pitch follows its vegetation
"use strict";
(function () {
  let ctx = null, master = null, nodes = [], timers = [], scanOsc = null, scanGain = null, on = false, scene = null;

  function noiseBuffer(type) {
    const len = ctx.sampleRate * 3, buf = ctx.createBuffer(1, len, ctx.sampleRate), d = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1;
      if (type === "brown") { last = (last + 0.02 * w) / 1.02; d[i] = last * 3.5; } else d[i] = w;
    }
    return buf;
  }
  function loopNoise(type, filterType, freq, q, gain) {
    const src = ctx.createBufferSource(); src.buffer = noiseBuffer(type); src.loop = true;
    const f = ctx.createBiquadFilter(); f.type = filterType; f.frequency.value = freq; f.Q.value = q;
    const gn = ctx.createGain(); gn.gain.value = gain;
    src.connect(f).connect(gn).connect(master); src.start();
    nodes.push(src, f, gn); return { src, f, gn };
  }
  function lfo(param, rate, depth) {
    const o = ctx.createOscillator(), gn = ctx.createGain(); o.frequency.value = rate; gn.gain.value = depth;
    o.connect(gn).connect(param); o.start(); nodes.push(o, gn);
  }
  function tone(freq, type, gain, pan = 0) {
    const o = ctx.createOscillator(); o.type = type; o.frequency.value = freq;
    const gn = ctx.createGain(); gn.gain.value = gain;
    const p = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
    if (p) { p.pan.value = pan; o.connect(gn).connect(p).connect(master); nodes.push(p); } else o.connect(gn).connect(master);
    o.start(); nodes.push(o, gn); return { o, gn };
  }
  function blip(freq, dur, gain, type = "sine", glideTo = null, pan = 0) {
    if (!ctx || !on) return;
    const t = ctx.currentTime, o = ctx.createOscillator(), gn = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t); if (glideTo) o.frequency.exponentialRampToValueAtTime(glideTo, t + dur);
    gn.gain.setValueAtTime(0, t); gn.gain.linearRampToValueAtTime(gain, t + 0.01); gn.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    let out = gn;
    if (ctx.createStereoPanner) { const p = ctx.createStereoPanner(); p.pan.value = pan; gn.connect(p); out = p; }
    o.connect(gn); out.connect(master); o.start(t); o.stop(t + dur + 0.05);
  }
  function every(minS, maxS, fn) {
    const tick = () => { if (!on) return; fn(); timers.push(setTimeout(tick, (minS + Math.random() * (maxS - minS)) * 1000)); };
    timers.push(setTimeout(tick, (minS + Math.random() * (maxS - minS)) * 1000));
  }

  function build(res) {
    const sh = (res && res.satellite && res.satellite.share) || { veg: 0.25, paved: 0.3, roof: 0.2, shade: 0.2, water: 0 };
    const o = (res && res.osm) || {}, geo = (res && res.geometry) || { levels: 4 };
    const root = 110 / Math.pow(2, Math.min(12, geo.levels) / 12);            // A2 … A1 with building height
    const major = sh.veg >= 0.2;
    // drone
    const d1 = tone(root, "sawtooth", 0.0), d2 = tone(root * 1.004, "sawtooth", 0.0);
    const lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 260 + (1 - sh.veg) * 300; lp.Q.value = 2;
    [d1, d2].forEach((d) => { d.gn.disconnect(); d.gn.connect(lp); d.gn.gain.value = 0.05; });
    lp.connect(master); nodes.push(lp); lfo(lp.frequency, 0.05, 120);
    // pad chord
    [1, major ? 5 / 4 : 6 / 5, 3 / 2, 2].forEach((r, i) => { const p = tone(root * 2 * r, "sine", 0.018, (i - 1.5) * 0.4); lfo(p.gn.gain, 0.07 + i * 0.03, 0.012); });
    // city rumble
    loopNoise("brown", "lowpass", 140, 0.7, 0.06 + sh.paved * 0.35);
    // wind
    const wind = loopNoise("white", "bandpass", 700, 0.8, 0.004 + sh.veg * 0.05); lfo(wind.f.frequency, 0.08, 400);
    // birds
    if (sh.veg > 0.12) every(1.5, 5 / (0.5 + sh.veg * 3), () => {
      const f = 2400 + Math.random() * 1800, n = 1 + Math.floor(Math.random() * 3);
      for (let i = 0; i < n; i++) setTimeout(() => blip(f * (1 + i * 0.08), 0.09, 0.05, "sine", f * 1.35, Math.random() * 1.6 - 0.8), i * 120);
    });
    // tram / rail bell
    if (o.tram || o.rail) every(18, 40, () => { blip(988, 1.6, 0.05, "triangle", null, -0.4); setTimeout(() => blip(1318, 1.4, 0.035, "triangle", null, -0.4), 160); });
    // water
    if (o.water || sh.water > 0.02) every(0.3, 1.2, () => blip(300 + Math.random() * 400, 0.12, 0.03, "sine", 700 + Math.random() * 500, Math.random() - 0.5));
    // scan voice
    scanOsc = ctx.createOscillator(); scanOsc.type = "sine"; scanOsc.frequency.value = 220;
    scanGain = ctx.createGain(); scanGain.gain.value = 0; scanOsc.connect(scanGain).connect(master); scanOsc.start(); nodes.push(scanOsc, scanGain);
    scene = { root, major };
  }

  const api = {
    get on() { return on; },
    async start(res) {
      if (on) return;
      if (!ctx) { const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return; ctx = new AC(); }
      if (ctx.state === "suspended") await ctx.resume();
      master = ctx.createGain(); master.gain.value = 0; master.connect(ctx.destination);
      on = true; build(res);
      master.gain.linearRampToValueAtTime(0.5, ctx.currentTime + 2.5);
    },
    stop() {
      if (!on) return; on = false;
      timers.forEach(clearTimeout); timers = [];
      const m = master, ns = nodes; nodes = [];
      m.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.8);
      setTimeout(() => { ns.forEach((n) => { try { n.stop && n.stop(); } catch (_) {} try { n.disconnect(); } catch (_) {} }); try { m.disconnect(); } catch (_) {} }, 1000);
    },
    restart(res) { if (on) { this.stop(); setTimeout(() => this.start(res), 1100); } },
    // during the scan: pitch follows the vegetation of the current slice (0..1)
    scan(v) {
      if (!on || !scanOsc) return;
      const t = ctx.currentTime;
      scanOsc.frequency.setTargetAtTime(scene.root * 4 * Math.pow(2, v * 2), t, 0.05);
      scanGain.gain.setTargetAtTime(0.05, t, 0.1);
    },
    scanEnd() { if (on && scanGain) scanGain.gain.setTargetAtTime(0, ctx.currentTime, 0.4); },
    // star shimmer: x in 0..1 (left..right), mag = star magnitude
    star(x, mag) {
      if (!on) return;
      const pent = [1, 9 / 8, 5 / 4, 3 / 2, 5 / 3, 2], f = scene.root * 16 * pent[Math.floor(Math.random() * pent.length)];
      blip(f, 1.8, Math.max(0.006, 0.03 - mag * 0.004), "sine", null, x * 2 - 1);
    },
  };
  window.SpaceshipSound = api;
})();
