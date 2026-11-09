// Languages: German (default) and English.
//  · I18N.t("English text {x}", {x}) → translated text with placeholders filled
//  · I18N.L({ en, de }) → pick the field for the current language
//  · static text and simple dynamic text are translated automatically: every text node (and title /
//    placeholder / alt / aria-label) whose exact text is a dictionary key is replaced, also when it
//    appears later (MutationObserver); switching back restores the original English.
"use strict";
(function () {
  const DE = {
    // ---------- start page / wizard ----------
    "🚀 Spaceship": "🚀 Raumschiff",
    "Turn your apartment into a spaceship: its real shape, its windows, and the view from each window into the sky.":
      "Verwandle deine Wohnung in ein Raumschiff: ihre echte Form, ihre Fenster und den Blick aus jedem Fenster in den Himmel.",
    "1 · Your address": "1 · Deine Adresse", "Street, number and town.": "Straße, Hausnummer und Ort.", "Search": "Suchen",
    "e.g. Bahnhofstrasse 1, Zürich": "z. B. Bahnhofstrasse 1, Zürich", "Searching…": "Suche…",
    "No address found. Check the spelling and add the town.": "Keine Adresse gefunden. Schreibweise prüfen und den Ort ergänzen.",
    "🔑 Open a spaceship": "🔑 Raumschiff öffnen", "Already built one? Paste its ID or link.": "Schon eins gebaut? ID oder Link einfügen.",
    "Open": "Öffnen", "Ship ID or link": "Schiffs-ID oder Link", "On this device:": "Auf diesem Gerät:",
    "That doesn't look like a ship ID (it has the form xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx).":
      "Das sieht nicht nach einer Schiffs-ID aus (Form: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx).",
    "2 · Your building and windows": "2 · Dein Gebäude und deine Fenster", "Loading the building outline…": "Gebäudeumriss wird geladen…",
    "⏳ Loading the building outline…": "⏳ Gebäudeumriss wird geladen…", "(can take up to half a minute)": "(kann bis zu einer halben Minute dauern)",
    "No building outline found here. Zoom in and": "Hier wurde kein Gebäudeumriss gefunden. Zoome hinein und",
    "tap your windows": "tippe deine Fenster an",
    "where they are on the image – you'll set the direction with the phone's compass in the next step.":
      "dort, wo sie im Bild sind – die Richtung setzt du im nächsten Schritt mit dem Kompass des Handys.",
    "Blue = your building (tap another outline if it's wrong).": "Blau = dein Gebäude (tippe einen anderen Umriss an, falls er falsch ist).",
    "Tap on the outline where each of your windows is.": "Tippe auf den Umriss, wo jedes deiner Fenster ist.",
    "The arrow shows the direction it looks out.": "Der Pfeil zeigt, wohin es hinausschaut.",
    "Please wait until the building outline has loaded.": "Bitte warten, bis der Gebäudeumriss geladen ist.",
    "Tap closer to the blue outline to place a window.": "Tippe näher an den blauen Umriss, um ein Fenster zu setzen.",
    "Room (e.g. Living room)": "Raum (z. B. Wohnzimmer)", "looks {dir}": "schaut nach {dir}", "direction from phone": "Richtung vom Handy",
    "Remove": "Entfernen", "Your floor": "Dein Stockwerk", "0 = ground floor": "0 = Erdgeschoss",
    "Next: photograph the views": "Weiter: die Aussichten fotografieren", "← Change address": "← Adresse ändern",
    "3 · View from window": "3 · Blick aus dem Fenster", "3 · View from window {i} of {n}": "3 · Blick aus Fenster {i} von {n}",
    "Stand back from the window so the": "Tritt so weit vom Fenster zurück, dass der", "whole window frame": "ganze Fensterrahmen",
    "and the": "und der", "sky": "Himmel",
    "are in the picture. Hold the phone upright and point it straight out of the window.":
      "im Bild sind. Halte das Handy aufrecht und richte es gerade aus dem Fenster.",
    "Start camera": "Kamera starten", "Camera on": "Kamera an", "📸 Take photo": "📸 Foto aufnehmen", "Retake": "Neu aufnehmen",
    "Upload photo(s) instead": "Stattdessen Foto(s) hochladen",
    "Several photos at once? Select them together – they are assigned to this window and the following ones in order.":
      "Mehrere Fotos auf einmal? Gemeinsam auswählen – sie werden der Reihe nach diesem und den folgenden Fenstern zugeordnet.",
    "Next window ›": "Nächstes Fenster ›", "Next window ({a} of {b}) ›": "Nächstes Fenster ({a} von {b}) ›",
    "✓ Done – review & save": "✓ Fertig – prüfen & speichern", "✓ Done – review & save ({d}/{n} photos)": "✓ Fertig – prüfen & speichern ({d}/{n} Fotos)",
    "← Back to map": "← Zurück zur Karte",
    "No motion sensor readings – the photo works, but without the phone's direction.": "Keine Bewegungssensor-Daten – das Foto geht, aber ohne die Richtung des Handys.",
    "Motion sensors not allowed – the photo works, but without the phone's direction.": "Bewegungssensoren nicht erlaubt – das Foto geht, aber ohne die Richtung des Handys.",
    "Camera not available ({e}). Use “Upload a photo instead”.": "Kamera nicht verfügbar ({e}). Nutze „Stattdessen Foto(s) hochladen“.",
    "{n} photos selected, but only {k} window(s) left – the extra photos were ignored. Add more windows on the map to use them.":
      "{n} Fotos gewählt, aber nur noch {k} Fenster frei – die übrigen Fotos wurden ignoriert. Setze weitere Fenster auf der Karte, um sie zu nutzen.",
    "✓ Photo saved": "✓ Foto gespeichert", " · phone pointed {az}° {dir}, tilt {el}°": " · Handy zeigte nach {az}° {dir}, Neigung {el}°",
    "That's {d}° away from the wall direction on the map – fine if you shot at an angle; otherwise retake.":
      "Das sind {d}° Abweichung von der Wandrichtung auf der Karte – in Ordnung, wenn du schräg fotografiert hast; sonst neu aufnehmen.",
    " (wall: {w}°)": " (Wand: {w}°)", " · tilt {el}°": " · Neigung {el}°",
    "4 · Your spaceship plan": "4 · Dein Raumschiff-Plan",
    "The building outline, your windows and the direction each one looks out.": "Der Gebäudeumriss, deine Fenster und die Richtung, in die jedes hinausschaut.",
    "I agree that my address, the window positions, the photos and the sensor readings are sent to and stored by the Spaceship project.":
      "Ich bin einverstanden, dass meine Adresse, die Fensterpositionen, die Fotos und die Sensordaten an das Spaceship-Projekt gesendet und dort gespeichert werden.",
    "💾 Save & launch my spaceship": "💾 Speichern & Raumschiff starten", "Just preview without saving": "Nur Vorschau, ohne Speichern",
    "Add at least one window photo first": "Zuerst mindestens ein Fensterfoto hinzufügen", "Tick the box above to save": "Zum Speichern oben das Häkchen setzen",
    "← Back to photos": "← Zurück zu den Fotos", "Uploading photo {i} of {n}…": "Lade Foto {i} von {n} hoch…", "Saving…": "Speichere…",
    "✓ Saved – your spaceship is registered.": "✓ Gespeichert – dein Raumschiff ist registriert.",
    "Your spaceship link (keep it – it opens your ship any time):": "Der Link zu deinem Raumschiff (gut aufbewahren – er öffnet dein Schiff jederzeit):",
    "Could not send: {e}. Please try again.": "Senden fehlgeschlagen: {e}. Bitte nochmals versuchen.",
    "Loading spaceship…": "Raumschiff wird geladen…",
    "Could not open this spaceship: {e}. You can build a new one below.": "Dieses Raumschiff ließ sich nicht öffnen: {e}. Unten kannst du ein neues bauen.",
    "Registered {date} · {n} window(s) · floor {f}": "Registriert am {date} · {n} Fenster · Stockwerk {f}",
    "🚀 Your spaceship": "🚀 Dein Raumschiff", "🚀 Spaceship · {name}": "🚀 Raumschiff · {name}", "← Back": "← Zurück", "Build your own": "Eigenes bauen",
    "Left: your building as a ship – the glowing ports are your windows, the turrets point where they really look out. Tap a port (or a number) to switch the cockpit view.":
      "Dein Gebäude als Schiff – die leuchtenden Luken sind deine Fenster, die Geschütztürme zeigen, wohin sie wirklich hinausschauen. Tippe auf eine Luke (oder eine Nummer), um die Cockpit-Ansicht zu wechseln.",
    "Imagery: © swisstopo (Switzerland), © Esri and its data providers (elsewhere). Buildings & search: © OpenStreetMap contributors.":
      "Bilder: © swisstopo (Schweiz), © Esri und Datenanbieter (anderswo). Gebäude & Suche: © OpenStreetMap-Mitwirkende.",

    // ---------- cockpit ----------
    "★ Space": "★ Himmel", "▣ Photo": "▣ Foto", "Real stars / original photo": "Echte Sterne / Originalfoto",
    "Milky Way": "Milchstraße", "Lines": "Linien", "Constellation lines": "Sternbildlinien", "Ecliptic": "Ekliptik",
    "Ecliptic – path of Sun, Moon and planets": "Ekliptik – Bahn von Sonne, Mond und Planeten", "Deep sky": "Deep Sky",
    "Galaxies, nebulae, clusters (Messier)": "Galaxien, Nebel, Sternhaufen (Messier)", "Alt-azimuth grid": "Horizont-Gitter (Höhe/Azimut)",
    "Equatorial grid": "Äquator-Gitter", "Names": "Namen", "Photo blend": "Foto einblenden",
    "Blend the real window photo in and out every 10 s": "Das echte Fensterfoto alle 10 s ein- und ausblenden",
    "al-Ṣūfī's constellation drawing (Book of the Fixed Stars, c. 964)": "al-Ṣūfīs Sternbildzeichnung (Buch der Fixsterne, um 964)",
    "Segments": "Segmente", "Boxes around the Arabic writing, translation and phonetics, star-number tags":
      "Rahmen um die arabische Schrift, Übersetzung und Lautschrift, Sternnummern",
    "drag · scroll/pinch zoom · double-click resets": "ziehen · scrollen/zwei Finger zoomen · Doppelklick setzt zurück",
    "🔑 Ship ID": "🔑 Schiffs-ID", "Show this ship's ID and link": "ID und Link dieses Schiffs anzeigen", "Ship ID": "Schiffs-ID",
    "Copy ID": "ID kopieren", "Copy link": "Link kopieren", "✓ Copied": "✓ Kopiert", "Select & copy": "Markieren & kopieren",
    "Keep it – paste it on the start page under “Open a spaceship” to come back.":
      "Gut aufbewahren – auf der Startseite unter „Raumschiff öffnen“ einfügen, um zurückzukehren.",
    "This ship is not saved yet – go back and use": "Dieses Schiff ist noch nicht gespeichert – geh zurück und nutze",
    "Save & launch": "Speichern & starten", "to get an ID.": ", um eine ID zu bekommen.",
    "Original window photo": "Originales Fensterfoto", "Original photo – tap to show it in the sky": "Originalfoto – antippen, um es am Himmel zu zeigen",
    "Now": "Jetzt", "now · live": "jetzt · live", "NOW · LIVE": "JETZT · LIVE", "Time offset in hours": "Zeitverschiebung in Stunden",
    "SUN": "SONNE", "DAY": "TAG", "TWILIGHT": "DÄMMERUNG", "NIGHT": "NACHT", "hdg": "Kurs", "· tilt": "· Neigung", "FOV": "Sichtfeld",
    "deck {n}": "Deck {n}", "HDG UNKNOWN": "KURS UNBEKANNT", "VIEW": "BLICK", "PHONE": "HANDY", "HULL": "RUMPF", "EST.": "GESCH.",
    "Ship": "Schiff", "{n} ports": "{n} Luken", "↺ Take-off": "↺ Start", "Origin: your building from above": "Ursprung: dein Gebäude von oben",
    "Skip scan ›": "Scan überspringen ›", "Close": "Schließen",
    "Composition": "Komposition", "scanning…": "Scan läuft…", "complete": "fertig",
    "Speed": "Tempo", "Agility": "Wendigkeit", "Shield": "Schild", "Sensors": "Sensoren", "Energy": "Energie",
    "↻ Scan": "↻ Scan", "🔈 Soundsphere": "🔈 Klangsphäre", "🔊 Sound on": "🔊 Ton an",
    "greenery {p} %": "Grün {p} %", "sealed & paved {p} %": "versiegelt & befestigt {p} %", "{b} structures · {t} trees": "{b} Bauten · {t} Bäume",
    "{w} windows · {d}° view": "{w} Fenster · {d}° Blick", "SPECTRAL SCAN · 200 m": "SPEKTRAL-SCAN · 200 m",
    "biodiversity spectrum": "Biodiversitäts-Spektrum", "dense vegetation": "dichte Vegetation", "sealed": "versiegelt",
    "ACQUIRING SATELLITE LINK…": "SATELLITENVERBINDUNG…", "APPROACHING {town} · ALT {alt} M": "ANFLUG {town} · HÖHE {alt} M", "TARGET": "ZIEL",
    "SCANNING {name} + 200 M": "SCANNE {name} + 200 M", "COMPOSING SHIP DNA…": "KOMPONIERE SCHIFFS-DNA…", "TARGET LOCK: {name}": "ZIEL ERFASST: {name}",
    "CONVERTING STRUCTURE…": "WANDLE STRUKTUR UM…", "FITTING MODULES": "MONTIERE MODULE", "SYSTEMS ONLINE": "SYSTEME BEREIT", "LIFT-OFF": "ABHEBEN",
    // star info
    "Layer 1 – Babylonian: SIPA.ZI.AN.NA, the Faithful Shepherd of Anu (MUL.APIN)": "Layer 1 – babylonisch: SIPA.ZI.AN.NA, der treue Hirte des Anu (MUL.APIN)",
    "Layer 2 – al-Ṣūfī's constellation drawing (Book of the Fixed Stars, c. 964)": "Layer 2 – al-Ṣūfīs Sternbildzeichnung (Buch der Fixsterne, um 964)",
    "{a}° above the horizon": "{a}° über dem Horizont", "below the horizon": "unter dem Horizont", "Now {pos}": "Jetzt {pos}",
    "Brightness {m} mag – {w}": "Helligkeit {m} mag – {w}", "one of the brightest objects in the sky": "eines der hellsten Objekte am Himmel",
    "one of the brightest stars": "einer der hellsten Sterne", "very bright": "sehr hell", "clearly visible": "gut sichtbar",
    "visible to the eye": "mit bloßem Auge sichtbar", "faint – needs a dark sky": "schwach – braucht einen dunklen Himmel",
    "{c} star · type {t} · ~{k} K": "Farbe: {c} · Spektraltyp {t} · ~{k} K", "blue-white": "blauweiß", "white": "weiß",
    "yellow-white": "gelblich-weiß", "yellow (like the Sun)": "gelb (wie die Sonne)", "orange": "orange", "red": "rot",
    "visible to the eye in a dark sky": "bei dunklem Himmel mit bloßem Auge sichtbar", "binoculars or a telescope": "Fernglas oder Teleskop",
    "Size on the sky ~{d}′": "Größe am Himmel ~{d}′", "{p}% lit · {km} km away": "{p} % beleuchtet · {km} km entfernt",
    "Light needs {m} minutes to reach your window": "Das Licht braucht {m} Minuten bis zu deinem Fenster",
    "{au} AU away · light travels {m} min": "{au} AE entfernt · das Licht braucht {m} min", "Brightness {m} mag": "Helligkeit {m} mag",
    "galaxy": "Galaxie", "globular cluster": "Kugelsternhaufen", "open cluster": "offener Sternhaufen", "planetary nebula": "planetarischer Nebel",
    "nebula": "Nebel", "star-forming nebula": "Sternentstehungsnebel", "supernova remnant": "Supernova-Überrest", "asterism": "Asterismus",
    "deep-sky object": "Deep-Sky-Objekt",
    "Sun": "Sonne", "Moon": "Mond", "Mercury": "Merkur", "Venus": "Venus", "Mars": "Mars", "Jupiter": "Jupiter", "Saturn": "Saturn",
    // common names that differ in German
    "Betelgeuse": "Beteigeuze", "Vega": "Wega", "Altair": "Atair", "Arcturus": "Arktur", "Capella": "Kapella", "Procyon": "Prokyon",
    "Castor": "Kastor", "Polaris": "Polarstern", "Spica": "Spika",
    "Orion Nebula": "Orionnebel", "Crab Nebula": "Krebsnebel", "Andromeda Galaxy": "Andromedagalaxie", "Pleiades": "Plejaden",
    "Ring Nebula": "Ringnebel", "Dumbbell Nebula": "Hantelnebel", "Lagoon Nebula": "Lagunennebel", "Trifid Nebula": "Trifidnebel",
    "Eagle Nebula": "Adlernebel", "Omega Nebula": "Omeganebel", "Owl Nebula": "Eulennebel", "Triangulum Galaxy": "Dreiecksgalaxie",
    "Whirlpool Galaxy": "Whirlpool-Galaxie", "Sombrero Galaxy": "Sombrerogalaxie", "Pinwheel Galaxy": "Feuerradgalaxie",
    "Beehive Cluster": "Krippe (Praesepe)", "Wild Duck Cluster": "Wildentenhaufen", "Butterfly Cluster": "Schmetterlingshaufen",
    "Hercules Cluster": "Herkuleshaufen", "Cigar Galaxy": "Zigarrengalaxie", "Bode's Galaxy": "Bodes Galaxie",

    // ---------- al-Ṣūfī ----------
    "📜 al-Ṣūfī 964": "📜 al-Ṣūfī 964",
    "al-Ṣūfī’s table of positions and magnitudes for the year 964": "al-Ṣūfīs Tabelle der Positionen und Helligkeiten für das Jahr 964",
    "📖 The page, read": "📖 Die Seite, gelesen", "📜 Positions & magnitudes": "📜 Positionen & Helligkeiten",
    "Mark al-Ṣūfī’s 964 positions in the sky (◇, dashed line to the real star)": "al-Ṣūfīs Positionen von 964 am Himmel markieren (◇, gestrichelte Linie zum echten Stern)",
    "№": "Nr.", "Place on the figure": "Ort in der Figur", "Longitude": "Länge", "Latitude": "Breite", "Ptolemy": "Ptolemäus", "Today": "Heute",
    "Arabic name": "Arabischer Name", "Added by al-Ṣūfī in his comments": "Von al-Ṣūfī in seinen Kommentaren ergänzt",
    "Tap a row to find the star.": "Tippe auf eine Zeile, um den Stern zu finden.", "Show this star in the sky": "Diesen Stern am Himmel zeigen",
    "Show in the sky": "Am Himmel zeigen", "↗ sky": "↗ Himmel",
    "This star is below the horizon right now – move the time slider to see it rise.": "Dieser Stern steht gerade unter dem Horizont – verschiebe den Zeitregler, um ihn aufgehen zu sehen.",
    "This star is too faint for the sky map.": "Dieser Stern ist zu schwach für die Himmelskarte.",
    "{ab} = {n} of the {c} stars of {con} – {where}": "{ab} = Nr. {n} der {c} Sterne von {con} – {where}",
    "{ab} = {n} · added by al-Ṣūfī to {con} (not in Ptolemy)": "{ab} = {n} · von al-Ṣūfī zu {con} ergänzt (nicht bei Ptolemäus)",
    "964: {lon}, {lat} · al-Ṣūfī {m} · Ptolemy {p}": "964: {lon}, {lat} · al-Ṣūfī {m} · Ptolemäus {p}",
    "Zoom on the head:": "Zoom auf den Kopf:", "al-Ṣūfī · Orion page as seen on the globe": "al-Ṣūfī · Orion-Seite, wie auf dem Globus gesehen",
    "The drawing is “as seen on the globe”, the mirror image of the sky – in the cockpit it is flipped onto the real stars. Segmentation and readings from the project chat “صورة محادثة مترجمة”.":
      "Die Zeichnung ist „wie auf dem Globus gesehen“, das Spiegelbild des Himmels – im Cockpit wird sie auf die echten Sterne gespiegelt. Segmentierung und Lesungen aus dem Projekt-Chat „صورة محادثة مترجمة“.",
    "Tresses of al-Jawzāʾ": "Locken der Jawzāʾ",
  };

  const DIRS_DE = { E: "O", NE: "NO", SE: "SO", ENE: "ONO", ESE: "OSO", NNE: "NNO", SSE: "SSO" };
  const KEY = "spaceship.lang";
  let lang = (() => {
    const q = new URLSearchParams(location.search).get("lang");
    if (q === "de" || q === "en") return q;
    try { const s = localStorage.getItem(KEY); if (s === "de" || s === "en") return s; } catch (_) {}
    return "de";
  })();
  const listeners = [];
  const fill = (s, v) => (v ? s.replace(/\{(\w+)\}/g, (m, k) => (v[k] != null ? v[k] : m)) : s);
  const t = (en, v) => fill(lang === "de" && DE[en] != null ? DE[en] : en, v);
  const L = (o) => (o == null ? "" : typeof o === "string" ? o : o[lang] != null ? o[lang] : o.en != null ? o.en : "");
  const dir = (abbr) => (lang === "de" ? (DIRS_DE[abbr] || abbr.replace(/E/g, "O")) : abbr);
  const num = (n, d = 0) => Number(n).toLocaleString(lang === "de" ? "de-CH" : "en-US", { minimumFractionDigits: d, maximumFractionDigits: d });

  // ---------- automatic translation of the DOM ----------
  const ATTRS = ["title", "placeholder", "alt", "aria-label"];
  const SKIP = new Set(["SCRIPT", "STYLE", "TEXTAREA", "CODE"]);
  // node.__en = the original (English) text, node.__out = what was last written; if the app writes new text, that becomes the original
  function trText(node) {
    const cur = node.nodeValue;
    const en = node.__out !== undefined && cur === node.__out ? node.__en : cur;
    node.__en = en;
    const m = /^(\s*)([\s\S]*?)(\s*)$/.exec(en), key = m[2];
    const out = key && lang === "de" && DE[key] != null ? m[1] + DE[key] + m[3] : en;
    node.__out = out;
    if (out !== cur) node.nodeValue = out;
  }
  function trEl(el) {
    ATTRS.forEach((a) => {
      if (!el.hasAttribute(a)) return;
      const cur = el.getAttribute(a), store = (el.__enA = el.__enA || {}), outs = (el.__outA = el.__outA || {});
      const en = store[a] !== undefined && cur === outs[a] ? store[a] : cur;
      store[a] = en; const out = lang === "de" && DE[en] != null ? DE[en] : en; outs[a] = out;
      if (out !== cur) el.setAttribute(a, out);
    });
  }
  function walk(root) {
    if (!root) return;
    if (root.nodeType === 3) { if (root.nodeValue.trim()) trText(root); return; }
    if (root.nodeType !== 1 || SKIP.has(root.nodeName)) return;
    if (root.closest && root.closest("[data-no-i18n]")) return;
    trEl(root);
    const tw = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, {
      acceptNode: (n) => (n.nodeType === 1 && (SKIP.has(n.nodeName) || n.hasAttribute("data-no-i18n")) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT) });
    let n; while ((n = tw.nextNode())) { if (n.nodeType === 3) { if (n.nodeValue.trim()) trText(n); } else trEl(n); }
  }
  let busy = false;
  const mo = new MutationObserver((recs) => {
    if (busy) return; busy = true;
    try {
      recs.forEach((r) => {
        if (r.type === "childList") r.addedNodes.forEach(walk);
        else if (r.type === "characterData") { const n = r.target; if (n.nodeValue !== n.__out && n.nodeValue.trim()) trText(n); }
        else if (r.type === "attributes" && ATTRS.includes(r.attributeName)) trEl(r.target);
      });
    } finally { mo.takeRecords(); busy = false; }
  });
  function start() {
    busy = true; walk(document.body); mo.takeRecords(); busy = false;
    mo.observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ATTRS });
    document.documentElement.lang = lang;
    syncSwitches();
  }
  function syncSwitches() { document.querySelectorAll(".lang-switch button").forEach((b) => b.classList.toggle("on", b.dataset.lang === lang)); }
  function set(l) {
    if (l === lang || (l !== "de" && l !== "en")) return;
    lang = l; try { localStorage.setItem(KEY, l); } catch (_) {}
    document.documentElement.lang = l;
    busy = true; walk(document.body); mo.takeRecords(); busy = false;
    syncSwitches();
    listeners.forEach((f) => { try { f(l); } catch (e) { console.warn(e); } });
  }
  document.addEventListener("click", (e) => { const b = e.target.closest && e.target.closest(".lang-switch button"); if (b) set(b.dataset.lang); });
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start); else start();

  window.I18N = { get lang() { return lang; }, t, L, dir, num, set, on: (f) => listeners.push(f), DE };
})();
