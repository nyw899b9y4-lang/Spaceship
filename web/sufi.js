// al-Ṣūfī, Kitāb ṣuwar al-kawākib (Book of the Fixed Stars, 964 CE) – bilingual (de / en):
//  · star numbers in abjad letters and Arabic names (with translations),
//  · “al-Ṣūfī’s table of positions and magnitudes for the year 964” (Orion),
//  · the constellation drawing laid over the real sky, with the segmentation of its writing
//    (boxes around the Arabic labels, translation, phonetics, star-number tags; gold = al-Haqʿa, violet = the Tresses).
// Numbering follows Ptolemy's catalogue (Orion: 38 stars), which al-Ṣūfī kept.
// Table values: Bodleian MS Marsh 144 (1009 CE) as edited by I. Hafez, PhD thesis, James Cook University 2010
// (pp. 207–208 and appendix 8.1); modern identifications by HR number from the same work, matched to HIP here.
"use strict";
(function () {
  const L = (o) => (window.I18N ? I18N.L(o) : o == null ? "" : typeof o === "string" ? o : o.en);
  const B = (en, de) => ({ en, de });

  // abjad numerals: tens before units (26 = ك 20 + و 6 = كو)
  const UNITS = ["", "ا", "ب", "ج", "د", "ه", "و", "ز", "ح", "ط"];
  const TENS = ["", "ي", "ك", "ل", "م", "ن", "س", "ع", "ف", "ص"];
  const HUNDREDS = ["", "ق", "ر", "ش", "ت", "ث", "خ", "ذ", "ض", "ظ"];
  const abjad = (n) => HUNDREDS[Math.floor(n / 100) % 10] + TENS[Math.floor(n / 10) % 10] + UNITS[n % 10];

  // zodiac signs (text presentation, no emoji)
  const SIGNS = ["♈︎", "♉︎", "♊︎", "♋︎", "♌︎", "♍︎", "♎︎", "♏︎", "♐︎", "♑︎", "♒︎", "♓︎"];

  // Orion rows: [n, hip, sign, lonDeg, lonMin, latDeg(S), latMin, al-Ṣūfī mag, Ptolemy mag (as al-Ṣūfī quotes it), modern V, place on the figure]
  // magnitudes: (s) aṣghar = a bit fainter, (k) akbar = a bit brighter, (m) aʿẓam = much brighter
  const ORI = [
    [1, 26207, 2, 9, 42, 13, 50, "neb", "neb", null, B("head – a small nebulous group of three stars", "Kopf – eine kleine neblige Gruppe aus drei Sternen")],
    [2, 27989, 2, 14, 42, 17, 0, "1(s)", "1(s)", 0.50, B("right shoulder – the bright reddish star", "rechte Schulter – der helle rötliche Stern")],
    [3, 25336, 2, 6, 42, 17, 30, "2", "2(m)", 1.64, B("left shoulder", "linke Schulter")],
    [4, 25813, 2, null, 42, 18, 0, "4(s)", "4(s)", 4.20, B("just behind (east of) the left shoulder", "gleich hinter (östlich) der linken Schulter")],
    [5, 28614, 2, 6, 2, 14, 30, "4", "4", 4.21, B("right elbow", "rechter Ellbogen")],
    [6, 29800, 2, 19, 2, 11, 50, "6", "6", 5.04, B("right forearm", "rechter Unterarm")],
    [7, 29426, 2, 19, 12, 10, 0, "5", "4", 4.48, B("right hand – rear (east) star of the southern pair", "rechte Hand – hinterer (östlicher) Stern des südlichen Paars")],
    [8, 29038, 2, 18, 42, 9, 45, "5", "4", 4.42, B("right hand – leading (west) star of the southern pair", "rechte Hand – vorderer (westlicher) Stern des südlichen Paars")],
    [9, 29704, 2, 20, 2, 8, 15, "6", "6", 5.30, B("right hand – rear star of the northern pair", "rechte Hand – hinterer Stern des nördlichen Paars")],
    [10, 29434, 2, 19, 22, 8, 15, "6", "6", 4.95, B("right hand – leading star of the northern pair", "rechte Hand – vorderer Stern des nördlichen Paars")],
    [11, 27913, 2, 14, 22, 3, 45, "5", "5", 4.41, B("staff – the leading (west) one of two", "Stab – der vordere (westliche) von zweien")],
    [12, 28716, 2, 17, 2, 4, 15, "5(s)", "5", 4.63, B("staff – the rear one; a double star", "Stab – der hintere; ein Doppelstern")],
    [13, 26594, 2, 10, 12, 19, 40, "4", "4", 4.57, B("row of four under the left shoulder – rearmost", "Viererreihe unter der linken Schulter – der hinterste")],
    [14, 26126, 2, 9, 2, 20, 0, "6", "6", 5.36, B("row of four – second", "Viererreihe – der zweite")],
    [15, 25861, 2, 8, 2, 20, 20, "6", "6", 5.46, B("row of four – third", "Viererreihe – der dritte")],
    [16, 25473, 2, 6, 52, 20, 40, "5", "5", 4.59, B("row of four – leading (westernmost)", "Viererreihe – der vorderste (westlichste)")],
    [17, 24010, 2, 3, 12, 8, 0, "4", "4", 4.82, B("sleeve – 1st of the nine, northernmost", "Ärmel – 1. der neun, der nördlichste")],
    [18, 23607, 2, 2, 2, 8, 10, "4", "4", 4.68, B("sleeve – 2nd", "Ärmel – 2.")],
    [19, 22957, 2, 0, 42, 10, 15, "4", "4", 4.07, B("sleeve – 3rd", "Ärmel – 3.")],
    [20, 22845, 1, 29, 2, 12, 50, "4", "4", 4.65, B("sleeve – 4th", "Ärmel – 4.")],
    [21, 22509, 1, 27, 52, 14, 15, "4", "4", 4.36, B("sleeve – 5th", "Ärmel – 5.")],
    [22, 22449, 1, 27, 32, 15, 50, "3(s)", "3", 3.19, B("sleeve – 6th", "Ärmel – 6.")],
    [23, 22549, 1, 27, 32, 17, 10, "3(s)", "3", 3.69, B("sleeve – 7th", "Ärmel – 7.")],
    [24, 22797, 1, 28, 2, 20, 20, "3(s)", "3", 3.72, B("sleeve – 8th", "Ärmel – 8.")],
    [25, 23123, 1, 29, 2, 21, 30, "4", "3", 4.47, B("sleeve – 9th, southernmost", "Ärmel – 9., der südlichste")],
    [26, 25930, 2, 8, 2, 24, 10, "2", "2", 2.23, B("belt – the leading (west) one of the three", "Gürtel – der vordere (westliche) der drei")],
    [27, 26311, 2, 10, 2, 24, 50, "2", "2", 1.70, B("belt – the middle one", "Gürtel – der mittlere")],
    [28, 26727, 2, 10, 52, 25, 40, "2", "2", 2.05, B("belt – the rear (east) one", "Gürtel – der hintere (östliche)")],
    [29, 25281, 2, 6, 32, 25, 50, "3(s)", "3", 3.36, B("tip of the sword's handle", "Spitze des Schwertgriffs")],
    [30, 26237, 2, 9, 12, 28, 40, "4", "4", 4.59, B("sword – northernmost of three", "Schwert – der nördlichste von dreien")],
    [31, 26220, 2, 9, 22, 29, 10, "3(s)", "3(s)", null, B("sword – the middle one (Orion Nebula region)", "Schwert – der mittlere (Gebiet des Orionnebels)")],
    [32, 26241, 2, 9, 42, 29, 50, "3(s)", "3", 2.77, B("sword – southernmost of three", "Schwert – der südlichste von dreien")],
    [33, 26563, 2, 10, 22, 30, 40, "4(s)", "4", 4.80, B("under the sword's tip – rear one", "unter der Schwertspitze – der hintere")],
    [34, 25923, 2, 8, 52, 30, 50, "4(s)", "4", 4.62, B("under the sword's tip – leading one", "unter der Schwertspitze – der vordere")],
    [35, 24436, 2, 2, 32, 31, 30, "1", "1", 0.12, B("left foot – the bright star, shared with the river (Eridanus)", "linker Fuß – der helle Stern, gemeinsam mit dem Fluss (Eridanus)")],
    [36, 24674, 2, 3, 42, 30, 15, "4(k)", "4(k)", 3.60, B("left shin, above the ankle", "linkes Schienbein, über dem Knöchel")],
    [37, 25247, 2, 6, 2, 31, 10, "4", "4", 4.14, B("under the left heel", "unter der linken Ferse")],
    [38, 27366, 2, 12, 52, 33, 30, "3(k)", "3(k)", 2.06, B("right leg (Ptolemy: below the knee)", "rechtes Bein (Ptolemäus: unter dem Knie)")],
  ];
  // stars al-Ṣūfī adds in his comments (not in Ptolemy, not in the table)
  const ADDED = [
    [39, 28691, "—", 5.14, B("touching star 12 – what makes it a double star (muḍaʿʿaf)", "berührt Stern 12 – macht ihn zum Doppelstern (muḍaʿʿaf)")],
    [40, 26549, "4", 3.81, B("less than a span south of star 28 – “not mentioned by Ptolemy”", "weniger als eine Spanne südlich von Stern 28 – „von Ptolemäus nicht erwähnt“")],
  ];
  // misprints in the edited table
  const FIX = {
    4: B("printed “♊︎ 50°42′” – unreadable; the star itself sits near ♊︎ 8° for 964", "gedruckt „♊︎ 50°42′“ – unlesbar; der Stern selbst steht 964 nahe ♊︎ 8°"),
    8: B("printed “♊︎ 38°42′”; read as ♊︎ 18°42′ (fits the star’s place)", "gedruckt „♊︎ 38°42′“; gelesen als ♊︎ 18°42′ (passt zum Ort des Sterns)"),
    24: B("printed “♉︎ 18°02′”; read as ♉︎ 28°02′ (fits the sequence 23 → 25)", "gedruckt „♉︎ 18°02′“; gelesen als ♉︎ 28°02′ (passt zur Folge 23 → 25)"),
  };

  // the other names of al-Haqʿa, with their meanings (al-Ṣūfī lists them; meanings: Lane’s Lexicon and the dictionaries)
  const HAQA_NAMES = [
    ["الهقعة", "al-haqʿa", B("“the whorl” – a whorl of hair on a horse’s coat (the dictionaries call it an unlucky mark)",
                              "„der Haarwirbel“ – ein Haarwirbel im Fell eines Pferdes (laut den Wörterbüchern ein ungeliebtes Zeichen)")],
    ["هقعة الجوزاء", "haqʿat al-jawzāʾ", B("the whorl of al-Jawzāʾ", "der Haarwirbel der Jawzāʾ")],
    ["التحايي", "at-taḥāyī (Hafez: al-Taḥāti)", B("“the rain-bringers” – from al-ḥayā, the rain that brings life: their setting at dawn was said to bring much rain",
                                                  "„die Regenbringer“ – von al-ḥayā, dem Regen, der Leben bringt: ihr Untergang in der Morgendämmerung brachte viel Regen")],
    ["التحية", "at-taḥiyya", B("“the greeting”, literally a wish for life – same root ḥ-y-y “life”; a variant of the name before",
                               "„der Gruß“, wörtlich ein Wunsch auf Leben – dieselbe Wurzel ḥ-y-y „Leben“; eine Spielform des vorigen Namens")],
    ["الأثافي", "al-athāfī", B("“the hearthstones” – the three stones a cooking pot stands on, like the three stars",
                               "„die Herdsteine“ – die drei Steine, auf denen der Kochtopf steht, wie die drei Sterne")],
  ];

  // Arabic names (al-Ṣūfī's comments on the Arab tradition)
  const GROUP = {
    sleeve: { ar: "تاج الجوزاء · ذوائب الجوزاء", tr: "tāj al-jawzāʾ · dhawāʾib al-jawzāʾ", color: "violet",
      txt: B("the Crown of al-Jawzāʾ and the Tresses of al-Jawzāʾ – the nine curved stars on the sleeve",
             "die Krone der Jawzāʾ und die Locken der Jawzāʾ – die neun gebogenen Sterne auf dem Ärmel") },
    belt: { ar: "المنطقة · النطاق · النظم", tr: "al-minṭaqa · an-niṭāq · an-naẓm",
      txt: B("the belt, the girdle, the string of pearls – said of all three; the single names came later",
             "der Gürtel, das Band, die Perlenschnur – für alle drei gesagt; die Einzelnamen kamen erst später") },
    sword: { ar: "اللقط · سيف الجبّار", tr: "al-laqaṭ · sayf al-jabbār", txt: B("the sword of the Giant – stars 30 to 32", "das Schwert des Riesen – Sterne 30 bis 32") },
  };
  const NAMES = {
    1: { ar: "الهقعة", tr: "al-haqʿa", color: "gold",
      txt: B("“the whorl” – the 5th lunar mansion; other names: at-taḥāyī “the rain-bringers”, at-taḥiyya “the greeting”, al-athāfī “the hearthstones”",
             "„der Haarwirbel“ – die 5. Mondstation; weitere Namen: at-taḥāyī „die Regenbringer“, at-taḥiyya „der Gruß“, al-athāfī „die Herdsteine“") },
    2: { ar: "منكب الجوزاء · يد الجوزاء", tr: "mankib al-jawzāʾ · yad al-jawzāʾ",
      txt: B("shoulder / hand of al-Jawzāʾ – “Betelgeuse” comes from yad al-jawzāʾ", "Schulter / Hand der Jawzāʾ – „Beteigeuze“ kommt von yad al-jawzāʾ") },
    3: { ar: "المرزم · الناجذ", tr: "al-mirzam · an-nājidh",
      txt: B("“the herald” (it rises before the red star) and “the molar tooth”", "„der Vorbote“ (er geht vor dem roten Stern auf) und „der Backenzahn“") },
    26: { group: "belt", txt2: B("modern Mintaka, from al-minṭaqa", "heute Mintaka, von al-minṭaqa") },
    27: { group: "belt", txt2: B("modern Alnilam, from an-niẓām / an-naẓm", "heute Alnilam, von an-niẓām / an-naẓm") },
    28: { group: "belt", txt2: B("modern Alnitak, from an-niṭāq", "heute Alnitak, von an-niṭāq") },
    30: { group: "sword" }, 31: { group: "sword" }, 32: { group: "sword" },
    35: { ar: "رجل الجوزاء اليسرى · راعي الجوزاء", tr: "rijl al-jawzāʾ al-yusrā · rāʿī al-jawzāʾ",
      txt: B("left foot of al-Jawzāʾ – source of “Rigel”; also “shepherd of al-Jawzāʾ”", "linker Fuß der Jawzāʾ – daher „Rigel“; auch „Hirte der Jawzāʾ“") },
    38: { txt: B("the modern name Saiph comes from sayf al-jabbār, “sword of the Giant”", "der heutige Name Saiph kommt von sayf al-jabbār, „Schwert des Riesen“") },
  };
  for (let n = 17; n <= 25; n++) NAMES[n] = { group: "sleeve" };
  const NOTES = {
    1: B("al-Ṣūfī: three small stars close together in a small triangle; Ptolemy put one star in its middle (cluster Collinder 69).",
         "al-Ṣūfī: drei kleine Sterne dicht beieinander in einem kleinen Dreieck; Ptolemäus setzte einen Stern in dessen Mitte (Sternhaufen Collinder 69)."),
    2: B("Great bright red star; one of the stars drawn on astrolabes.", "Großer heller roter Stern; einer der Sterne, die auf Astrolabien eingezeichnet sind."),
    3: B("Ptolemy has it as a bright 2nd magnitude.", "Bei Ptolemäus ein heller Stern 2. Größe."),
    11: B("With star 12 and the tip of Taurus’s southern horn on an almost straight line.", "Mit Stern 12 und der Spitze des südlichen Stierhorns auf einer fast geraden Linie."),
    12: B("Double (muḍaʿʿaf): a star touches it – 64 Ori.", "Doppelstern (muḍaʿʿaf): ein Stern berührt ihn – 64 Ori."),
    28: B("A 4th-magnitude star lies less than a span to the south, not in Ptolemy (σ Ori).", "Weniger als eine Spanne südlich steht ein Stern 4. Größe, nicht bei Ptolemäus (σ Ori)."),
    32: B("With 33 and 34 an almost equilateral triangle.", "Mit 33 und 34 ein fast gleichseitiges Dreieck."),
    35: B("One of the stars drawn on astrolabes.", "Einer der Sterne, die auf Astrolabien eingezeichnet sind."),
    38: B("al-Ṣūfī: more likely on the leg than under the knee, as Ptolemy has it.", "al-Ṣūfī: eher auf dem Bein als unter dem Knie, wie bei Ptolemäus."),
  };

  const MAGW = { s: B("aṣghar – a bit fainter", "aṣghar – etwas schwächer"), k: B("akbar – a bit brighter", "akbar – etwas heller"), m: B("aʿẓam – much brighter", "aʿẓam – viel heller") };
  const magText = (m) => (m === "neb" ? (window.I18N ? I18N.t("nebula") : "nebula") : m === "—" ? "—" : m.replace(/\((s|k|m)\)/, (x, c) => ` (${L(MAGW[c]).split(" – ")[0]})`));
  const lonText = (r) => `${SIGNS[r[2]]} ${r[3] == null ? "?" : r[3]}°${String(r[4]).padStart(2, "0")}′`;
  const latText = (r) => `${r[5]}°${String(r[6]).padStart(2, "0")}′ S`;
  // ecliptic longitude (°) in 964 and its J2000 equivalent (precession 964 → 2000, 50.29″/yr)
  const PREC = ((2000 - 964) * 50.29) / 3600;
  const lon964 = (r) => (r[3] == null ? null : r[2] * 30 + r[3] + r[4] / 60);

  const rows = ORI.map((r) => ({ n: r[0], hip: r[1], ab: abjad(r[0]), lon: lonText(r), lat: latText(r), lon964: lon964(r), lat964: -(r[5] + r[6] / 60),
    mag: r[7], ptol: r[8], v: r[9], whereB: r[10], fixB: FIX[r[0]] || null, name: NAMES[r[0]] || null, noteB: NOTES[r[0]] || null }));
  const added = ADDED.map((r) => ({ n: r[0], hip: r[1], ab: abjad(r[0]), mag: r[2], v: r[3], whereB: r[4], added: true }));
  // language-dependent fields resolve on access
  rows.concat(added).forEach((r) => Object.defineProperties(r, {
    where: { get() { return L(this.whereB); } }, fix: { get() { return this.fixB ? L(this.fixB) : null; } }, note: { get() { return this.noteB ? L(this.noteB) : null; } } }));
  const STARS = {};
  rows.concat(added).forEach((r) => { r.con = "Ori"; STARS[r.hip] = r; });
  const CON = { Ori: { ar: "الجبّار · الجوزاء", tr: "al-Jabbār · al-Jawzāʾ", count: 38 } };
  const nameOf = (r) => { const nm = r && r.name; if (!nm) return null;
    if (nm.group) { const g = GROUP[nm.group]; return { ar: g.ar, tr: g.tr, color: g.color, en: L(g.txt), en2: nm.txt2 ? L(nm.txt2) : null }; }
    return { ar: nm.ar, tr: nm.tr, color: nm.color, en: L(nm.txt) }; };

  const TABLE = {
    titleB: B("al-Ṣūfī’s table of positions and magnitudes for the year 964", "al-Ṣūfīs Tabelle der Positionen und Helligkeiten für das Jahr 964"),
    conTitleB: B("al-Jabbār · al-Jawzāʾ (Orion) – 38 stars, and two he added in his comments", "al-Jabbār · al-Jawzāʾ (Orion) – 38 Sterne, dazu zwei, die er in seinen Kommentaren ergänzt"),
    noteB: B("Longitude along the zodiac and latitude south of the ecliptic for 964 CE (Ptolemy’s positions + 12°42′ precession). Magnitudes: (s) aṣghar = a bit fainter, (k) akbar = a bit brighter, (m) aʿẓam = much brighter; Ptolemy as al-Ṣūfī quotes him; today = modern visual magnitude.",
             "Länge entlang des Tierkreises und Breite südlich der Ekliptik für 964 n. Chr. (Ptolemäus’ Positionen + 12°42′ Präzession). Helligkeiten: (s) aṣghar = etwas schwächer, (k) akbar = etwas heller, (m) aʿẓam = viel heller; Ptolemäus so, wie al-Ṣūfī ihn zitiert; heute = moderne visuelle Helligkeit."),
    sourceB: B("Bodleian MS Marsh 144 (1009 CE), the oldest copy, as edited in I. Hafez, PhD thesis, James Cook University 2010.",
               "Bodleian MS Marsh 144 (1009 n. Chr.), die älteste Abschrift, nach der Edition von I. Hafez, Dissertation, James Cook University 2010."),
    con: "Ori", rows, added, PREC,
  };
  Object.defineProperties(TABLE, { title: { get() { return L(this.titleB); } }, conTitle: { get() { return L(this.conTitleB); } },
    note: { get() { return L(this.noteB); } }, source: { get() { return L(this.sourceB); } } });

  // ---------- drawings ----------
  // coordinates are in a 1212 px wide frame of the page; anchors = [hip, x, y]
  const FIGURES = [{
    con: "Ori", src: "vendor/sufi/orion-globe.png", page: "vendor/sufi/orion-page.jpg", frameW: 1212, frameH: 2000,
    title: "Orion – al-Jabbār / al-Jawzāʾ",
    caption: B("كوكبة الجبّار وهو الجوزاء على ما يُرى في الكرة — “as seen on the globe”: a mirror image of the sky, so its writing reads reversed here",
               "كوكبة الجبّار وهو الجوزاء على ما يُرى في الكرة — „wie auf dem Globus gesehen“: ein Spiegelbild des Himmels, daher erscheint die Schrift hier gespiegelt"),
    anchors: [[26207, 750, 983], [27989, 893, 1105], [25336, 608, 1112], [25930, 697, 1362],
              [26311, 760, 1384], [26727, 819, 1404], [24436, 533, 1622], [27366, 860, 1712]],
    highlights: [{
      id: "sword", name: B("Sword of al-Jabbār", "Schwert des Riesen"), ar: "سيف الجبّار",
      poly: [[700, 1402], [737, 1402], [752, 1505], [805, 1515], [808, 1556], [792, 1562], [802, 1918],
             [722, 1922], [716, 1562], [690, 1552], [688, 1512], [708, 1500]],
      hips: [26237, 26220, 26241],
      html: B(`<b style="color:#ffd27a">⚔ Sword of al-Jabbār <span class="ar">سيف الجبّار</span></b>
        <i>al-laqaṭ · sayf al-jabbār – stars 30 to 32 (ل لا لب)</i>
        <span>Star 29 (كط) marks the tip of the handle; 33 and 34 (لج لد) lie under the sword’s tip.</span>
        <span>In the sky: c Ori, the Orion Nebula M42 (θ Ori) and ι Ori. Ptolemy and al-Ṣūfī list the nebula as a star; it was first described as a nebula in the 17th century.</span>`,
              `<b style="color:#ffd27a">⚔ Schwert des Riesen <span class="ar">سيف الجبّار</span></b>
        <i>al-laqaṭ · sayf al-jabbār – Sterne 30 bis 32 (ل لا لب)</i>
        <span>Stern 29 (كط) markiert die Spitze des Griffs; 33 und 34 (لج لد) liegen unter der Schwertspitze.</span>
        <span>Am Himmel: c Ori, der Orionnebel M42 (θ Ori) und ι Ori. Ptolemäus und al-Ṣūfī führen den Nebel als Stern; als Nebel beschrieben wurde er erst im 17. Jahrhundert.</span>`),
    }],
    ann: {
      // fitted from the annotated sheets of the chat “صورة محادثة مترجمة” (their 948 px page → this 1212 px frame:
      // x′ = 1.2014x − 0.0039y + 38.7, y′ = −0.0008x + 1.2088y + 19.3, residual ≤ 2 px on six star dots)
      legend: [["#18b4d8", B("Box = Arabic writing", "Rahmen = arabische Schrift")], ["#ffffff", B("White = translation", "Weiß = Übersetzung")],
               ["#ffb547", B("Orange = phonetics", "Orange = Lautschrift")], ["#f5c542", B("Gold = al-Haqʿa", "Gold = al-Haqʿa")],
               ["#ff6fb5", B("Pink = alif (1)", "Pink = Alif (1)")], ["#b98cff", B("Violet = the Tresses (stars 17–25)", "Violett = die Locken (Sterne 17–25)")]],
      boxes: [
        { id: "sleeve-text", side: "R", ty: 64, hip: 22449, box: [65, 118, 1073, 363], ar: "المقوّسة التي على الكمّ وهي من السابع عشر إلى الخامس والعشرين تاج الجوزاء وذوائب الجوزاء أيضا",
          tr: B("The curved stars on the sleeve – numbers 17 to 25 – are the Crown of al-Jawzāʾ and also the Tresses of al-Jawzāʾ.",
                "Die gebogenen Sterne auf dem Ärmel – Nummer 17 bis 25 – sind die Krone der Jawzāʾ und auch die Locken der Jawzāʾ."),
          ph: "al-muqawwasa allatī ʿalā l-kumm, wa-hiya min as-sābiʿ ʿashar ilā l-khāmis wa-l-ʿishrīn: tāj al-jawzāʾ wa-dhawāʾib al-jawzāʾ ayḍan" },
        { id: "title", side: "L", ty: 347, hip: 26311, box: [272, 464, 929, 533], ar: "كوكبة الجبّار وهو الجوزاء على ما يُرى في الكرة",
          tr: B("The constellation of al-Jabbār (“the Giant”), which is al-Jawzāʾ, as it is seen on the globe",
                "Das Sternbild al-Jabbār („der Riese“), das ist al-Jawzāʾ, wie man es auf dem Globus sieht"),
          ph: "kawkabat al-jabbār, wa-huwa l-jawzāʾ, ʿalā mā yurā fī l-kura" },
        // violet: the Tresses – the word in the label, the line “and also the Tresses of al-Jawzāʾ” above, and the nine stars
        { id: "crown", side: "L", ty: 603, hip: 22449, color: "violet", boxColor: "cyan", box: [299, 678, 514, 880], ar: "التاج والذوائب · ذوائب الجوزاء",
          tr: B("Stars 17–25 · The Crown and the Tresses. Dhawāʾib are long locks or plaits of hair hanging down from the head – the Tresses of al-Jawzāʾ; tāj is her crown. They are the nine curved stars on the sleeve (al-kumm) of the left arm; today 15 and 11 Orionis, ο² and π¹–π⁶ Orionis – in the Greek figure the shield or the lion skin.",
                "Sterne 17–25 · Die Krone und die Locken. Dhawāʾib sind lange, vom Kopf herabhängende Haarlocken oder Zöpfe – die Locken der Jawzāʾ; tāj ist ihre Krone. Es sind die neun gebogenen Sterne auf dem Ärmel (al-kumm) des linken Arms; heute 15 und 11 Orionis, ο² und π¹–π⁶ Orionis – in der griechischen Figur der Schild bzw. das Löwenfell."),
          ph: "at-tāj wa-dh-dhawāʾib · dhawāʾib al-jawzāʾ · al-kumm",
          parts: { rects: [[728, 262, 1072, 356]], polys: [[[400, 734], [414, 772], [324, 858], [290, 804]]],
            dots: [[524.3, 758.9, 9], [459.2, 772.3, 15], [407.1, 828.0, 15], [353.3, 905.8, 15], [302.5, 968.1, 12], [271.7, 1041.1, 19], [268.4, 1091.2, 16], [266.7, 1156.9, 18], [311.5, 1242.6, 16]] },
          real: [24010, 23607, 22957, 22845, 22509, 22449, 22549, 22797, 23123] },
        { id: "star3", side: "L", ty: 868, hip: 25336, box: [438, 1077, 642, 1137], ar: "ج · المرزم والناجذ",
          tr: B("Star 3 (jīm) · al-Mirzam (“the herald”) and al-Nājidh (“the molar tooth”) = Bellatrix",
                "Stern 3 (jīm) · al-Mirzam („der Vorbote“) und an-Nājidh („der Backenzahn“) = Bellatrix"), ph: "jīm · al-mirzam wa-n-nājidh" },
        { id: "also", side: "L", ty: 1111, hip: 22449, box: [189, 1041, 242, 1189], ar: "أيضا",
          tr: B("“also” – belongs to the label above: “the Crown and the Tresses also”", "„auch“ – gehört zur Beschriftung darüber: „die Krone und die Locken auch“"), ph: "ayḍan" },
        { id: "haqa", side: "R", ty: 609, hip: 26207, color: "gold", box: [712, 999, 790, 1046], ar: "ا · الهقعة · هقعة الجوزاء",
          tr: B("al-Haqʿa (also Haqʿat al-Jawzāʾ): the first star of Orion = three small stars close together on the head, which look like the dots of the letter thāʾ (ث). The 5th lunar mansion. Its names:",
                "al-Haqʿa (auch Haqʿat al-Jawzāʾ): der erste Stern des Orion = drei kleine, dicht beieinander stehende Sterne auf dem Kopf, die wie die Punkte des Buchstabens thāʾ (ث) aussehen. Die 5. Mondstation. Ihre Namen:"),
          ph: "al-haqʿa · haqʿat al-jawzāʾ · at-taḥāyī · at-taḥiyya · al-athāfī",
          names: HAQA_NAMES,
          alif: [728, 942, 753, 982], ring: [752, 982, 17.5], dots: [[750.6, 973.7], [743.5, 987.4], [758.6, 987.2]],
          real: [26207, 26176, 26366],                       // λ, φ¹, φ² Ori in the sky
          inset: { view: [682, 925, 140, 140], notes: [
            ["#ff6fb5", B("Pink = alif (ا) = number 1", "Pink = Alif (ا) = Nummer 1"), B("alif – the star’s catalogue number", "alif – die Katalognummer des Sterns")],
            ["#f5c542", B("Gold circles = the three red stars, set like the 3 dots of the letter ث", "Goldene Kreise = die drei roten Sterne, angeordnet wie die 3 Punkte des Buchstabens ث"), B("thāʾ", "thāʾ")],
            ["#f5c542", B("Gold box = the word al-Haqʿa", "Goldener Rahmen = das Wort al-Haqʿa"), B("al-haqʿa – “the whorl”", "al-haqʿa – „der Haarwirbel“")]] } },
        { id: "star2", side: "R", ty: 1012, hip: 27989, box: [816, 1064, 924, 1179], ar: "ب · يد الجوزاء",
          tr: B("Star 2 (bāʾ) · Hand of al-Jawzāʾ = Betelgeuse", "Stern 2 (bāʾ) · Hand der Jawzāʾ = Beteigeuze"), ph: "bāʾ · yad al-jawzāʾ" },
        { id: "belt", side: "R", ty: 1207, hip: 26311, box: [477, 1337, 813, 1436], ar: "المنطقة ويقال لها النظم أيضا",
          tr: B("Stars 26–28 · The Belt, which is also called “the string (of pearls)”", "Sterne 26–28 · Der Gürtel, der auch „die (Perlen-)Schnur“ genannt wird"),
          ph: "al-minṭaqa, wa-yuqāl lahā an-naẓm ayḍan" },
        { id: "star35", side: "L", ty: 1461, hip: 24436, box: [274, 1569, 562, 1627], ar: "له · رجل الجوزاء اليسرى",
          tr: B("Star 35 (lām-hāʾ) · Left foot of al-Jawzāʾ = Rigel", "Stern 35 (lām-hāʾ) · Linker Fuß der Jawzāʾ = Rigel"), ph: "lām-hāʾ · rijl al-jawzāʾ al-yusrā" },
      ],
      // abjad number written next to a star → tag with the number in digits: [n, x, y] (tag centre)
      tags: [[16, 590, 1189], [17, 570, 726], [18, 516, 781], [19, 473, 853], [20, 443, 920], [21, 377, 980], [22, 338, 1030],
             [23, 338, 1085], [24, 338, 1155], [25, 358, 1216], [26, 724, 1310], [27, 796, 1327], [28, 854, 1346], [38, 890, 1712]],
    },
  }];
  const COLORS = { gold: "#f5c542", violet: "#b98cff", pink: "#ff6fb5", cyan: "#18b4d8" };

  window.SpaceshipSufi = { abjad, SIGNS, MAGW, magText, nameOf, L, COLORS, star: (hip) => STARS[hip] || null, con: (id) => CON[id] || null, figures: FIGURES, table: TABLE };
})();
