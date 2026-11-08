// al-Ṣūfī, Kitāb ṣuwar al-kawākib (Book of the Fixed Stars, 964 CE):
//  · star numbers in abjad letters and Arabic names,
//  · "al-Ṣūfī's table of positions and magnitudes for the year 964" (Orion),
//  · the constellation drawing laid over the real sky, with the segmentation of its writing
//    (boxes around the Arabic labels, translation, phonetics, star-number tags).
// Numbering follows Ptolemy's catalogue (Orion: 38 stars), which al-Ṣūfī kept.
// Table values: Bodleian MS Marsh 144 (1009 CE) as edited by I. Hafez, PhD thesis, James Cook University 2010
// (pp. 207–208 and appendix 8.1); modern identifications by HR number from the same work, matched to HIP here.
"use strict";
(function () {
  // abjad numerals: tens before units (26 = ك 20 + و 6 = كو)
  const UNITS = ["", "ا", "ب", "ج", "د", "ه", "و", "ز", "ح", "ط"];
  const TENS = ["", "ي", "ك", "ل", "م", "ن", "س", "ع", "ف", "ص"];
  const HUNDREDS = ["", "ق", "ر", "ش", "ت", "ث", "خ", "ذ", "ض", "ظ"];
  const abjad = (n) => HUNDREDS[Math.floor(n / 100) % 10] + TENS[Math.floor(n / 10) % 10] + UNITS[n % 10];

  // zodiac signs (ecliptic longitude in 30° steps); note: Gemini is also called al-Jawzāʾ
  const SIGNS = [["♈\uFE0E", "Aries", "الحمل"], ["♉\uFE0E", "Taurus", "الثور"], ["♊\uFE0E", "Gemini", "الجوزاء"], ["♋\uFE0E", "Cancer", "السرطان"],
    ["♌\uFE0E", "Leo", "الأسد"], ["♍\uFE0E", "Virgo", "السنبلة"], ["♎\uFE0E", "Libra", "الميزان"], ["♏\uFE0E", "Scorpio", "العقرب"],
    ["♐\uFE0E", "Sagittarius", "القوس"], ["♑\uFE0E", "Capricorn", "الجدي"], ["♒\uFE0E", "Aquarius", "الدلو"], ["♓\uFE0E", "Pisces", "الحوت"]];

  // Orion rows: [n, hip, sign, lonDeg, lonMin, latDeg(S), latMin, al-Ṣūfī mag, Ptolemy mag (as al-Ṣūfī quotes it), modern V, place on the figure]
  // magnitudes: (s) aṣghar = a bit fainter, (k) akbar = a bit brighter, (m) aʿẓam = much brighter
  const ORI = [
    [1, 26207, 2, 9, 42, 13, 50, "neb", "neb", null, "head – a small nebulous group of three stars"],
    [2, 27989, 2, 14, 42, 17, 0, "1(s)", "1(s)", 0.50, "right shoulder – the bright reddish star"],
    [3, 25336, 2, 6, 42, 17, 30, "2", "2(m)", 1.64, "left shoulder"],
    [4, 25813, 2, null, 42, 18, 0, "4(s)", "4(s)", 4.20, "just behind (east of) the left shoulder"],
    [5, 28614, 2, 6, 2, 14, 30, "4", "4", 4.21, "right elbow"],
    [6, 29800, 2, 19, 2, 11, 50, "6", "6", 5.04, "right forearm"],
    [7, 29426, 2, 19, 12, 10, 0, "5", "4", 4.48, "right hand – rear (east) star of the southern pair"],
    [8, 29038, 2, 18, 42, 9, 45, "5", "4", 4.42, "right hand – leading (west) star of the southern pair"],
    [9, 29704, 2, 20, 2, 8, 15, "6", "6", 5.30, "right hand – rear star of the northern pair"],
    [10, 29434, 2, 19, 22, 8, 15, "6", "6", 4.95, "right hand – leading star of the northern pair"],
    [11, 27913, 2, 14, 22, 3, 45, "5", "5", 4.41, "staff – the leading (west) one of two"],
    [12, 28716, 2, 17, 2, 4, 15, "5(s)", "5", 4.63, "staff – the rear one; a double star"],
    [13, 26594, 2, 10, 12, 19, 40, "4", "4", 4.57, "row of four under the left shoulder – rearmost"],
    [14, 26126, 2, 9, 2, 20, 0, "6", "6", 5.36, "row of four – second"],
    [15, 25861, 2, 8, 2, 20, 20, "6", "6", 5.46, "row of four – third"],
    [16, 25473, 2, 6, 52, 20, 40, "5", "5", 4.59, "row of four – leading (westernmost)"],
    [17, 24010, 2, 3, 12, 8, 0, "4", "4", 4.82, "sleeve – 1st of the nine, northernmost"],
    [18, 23607, 2, 2, 2, 8, 10, "4", "4", 4.68, "sleeve – 2nd"],
    [19, 22957, 2, 0, 42, 10, 15, "4", "4", 4.07, "sleeve – 3rd"],
    [20, 22845, 1, 29, 2, 12, 50, "4", "4", 4.65, "sleeve – 4th"],
    [21, 22509, 1, 27, 52, 14, 15, "4", "4", 4.36, "sleeve – 5th"],
    [22, 22449, 1, 27, 32, 15, 50, "3(s)", "3", 3.19, "sleeve – 6th"],
    [23, 22549, 1, 27, 32, 17, 10, "3(s)", "3", 3.69, "sleeve – 7th"],
    [24, 22797, 1, 28, 2, 20, 20, "3(s)", "3", 3.72, "sleeve – 8th"],
    [25, 23123, 1, 29, 2, 21, 30, "4", "3", 4.47, "sleeve – 9th, southernmost"],
    [26, 25930, 2, 8, 2, 24, 10, "2", "2", 2.23, "belt – the leading (west) one of the three"],
    [27, 26311, 2, 10, 2, 24, 50, "2", "2", 1.70, "belt – the middle one"],
    [28, 26727, 2, 10, 52, 25, 40, "2", "2", 2.05, "belt – the rear (east) one"],
    [29, 25281, 2, 6, 32, 25, 50, "3(s)", "3", 3.36, "tip of the sword's handle"],
    [30, 26237, 2, 9, 12, 28, 40, "4", "4", 4.59, "sword – northernmost of three"],
    [31, 26220, 2, 9, 22, 29, 10, "3(s)", "3(s)", null, "sword – the middle one (Orion Nebula region)"],
    [32, 26241, 2, 9, 42, 29, 50, "3(s)", "3", 2.77, "sword – southernmost of three"],
    [33, 26563, 2, 10, 22, 30, 40, "4(s)", "4", 4.80, "under the sword's tip – rear one"],
    [34, 25923, 2, 8, 52, 30, 50, "4(s)", "4", 4.62, "under the sword's tip – leading one"],
    [35, 24436, 2, 2, 32, 31, 30, "1", "1", 0.12, "left foot – the bright star, shared with the river (Eridanus)"],
    [36, 24674, 2, 3, 42, 30, 15, "4(k)", "4(k)", 3.60, "left shin, above the ankle"],
    [37, 25247, 2, 6, 2, 31, 10, "4", "4", 4.14, "under the left heel"],
    [38, 27366, 2, 12, 52, 33, 30, "3(k)", "3(k)", 2.06, "right leg (Ptolemy: below the knee)"],
  ];
  // stars al-Ṣūfī adds in his comments (not in Ptolemy, not in the table)
  const ADDED = [
    [39, 28691, "—", 5.14, "touching star 12 – what makes it a double star (muḍaʿʿaf)"],
    [40, 26549, "4", 3.81, "less than a span south of star 28 – “not mentioned by Ptolemy”"],
  ];
  // misprints in the edited table: printed value and the reading used here
  const FIX = {
    4: "printed “♊\uFE0E 50°42′” – unreadable; the star itself sits near ♊\uFE0E 8° for 964",
    8: "printed “♊\uFE0E 38°42′”; read as ♊\uFE0E 18°42′ (fits the star’s place)",
    24: "printed “♉\uFE0E 18°02′”; read as ♉\uFE0E 28°02′ (fits the sequence 23 → 25)",
  };

  // Arabic names (al-Ṣūfī's comments on the Arab tradition)
  const GROUP = {
    sleeve: { ar: "تاج الجوزاء · ذوائب الجوزاء", tr: "tāj al-jawzāʾ · dhawāʾib al-jawzāʾ", en: "the Crown of al-Jawzāʾ and the Tresses of al-Jawzāʾ – the nine curved stars on the sleeve" },
    belt: { ar: "المنطقة · النطاق · النظم", tr: "al-minṭaqa · an-niṭāq · an-naẓm", en: "the belt, the girdle, the string of pearls – said of all three; the single names came later" },
    sword: { ar: "اللقط · سيف الجبّار", tr: "al-laqaṭ · sayf al-jabbār", en: "the sword of the Giant – stars 30 to 32" },
  };
  const NAMES = {
    1: { ar: "الهقعة", tr: "al-haqʿa", en: "“the whorl” – the 5th lunar mansion; also at-taḥāṭī, al-athāfī (the hearthstones)" },
    2: { ar: "منكب الجوزاء · يد الجوزاء", tr: "mankib al-jawzāʾ · yad al-jawzāʾ", en: "shoulder / hand of al-Jawzāʾ – “Betelgeuse” comes from yad al-jawzāʾ" },
    3: { ar: "المرزم · الناجذ", tr: "al-mirzam · an-nājidh", en: "“the herald” (it rises before the red star) and “the molar tooth”" },
    26: { group: "belt", en: "modern Mintaka, from al-minṭaqa" }, 27: { group: "belt", en: "modern Alnilam, from an-niẓām / an-naẓm" },
    28: { group: "belt", en: "modern Alnitak, from an-niṭāq" },
    30: { group: "sword" }, 31: { group: "sword" }, 32: { group: "sword" },
    35: { ar: "رجل الجوزاء اليسرى · راعي الجوزاء", tr: "rijl al-jawzāʾ al-yusrā · rāʿī al-jawzāʾ", en: "left foot of al-Jawzāʾ – source of “Rigel”; also “shepherd of al-Jawzāʾ”" },
    38: { en: "the modern name Saiph comes from sayf al-jabbār, “sword of the Giant”" },
  };
  for (let n = 17; n <= 25; n++) NAMES[n] = { group: "sleeve" };
  const NOTES = {
    1: "al-Ṣūfī: three small stars close together in a small triangle; Ptolemy put one star in its middle (cluster Collinder 69).",
    2: "Great bright red star; one of the stars drawn on astrolabes.",
    3: "Ptolemy has it as a bright 2nd magnitude.",
    11: "With star 12 and the tip of Taurus’s southern horn on an almost straight line.",
    12: "Double (muḍaʿʿaf): a star touches it – 64 Ori.",
    28: "A 4th-magnitude star lies less than a span to the south, not in Ptolemy (σ Ori).",
    32: "With 33 and 34 an almost equilateral triangle.",
    35: "One of the stars drawn on astrolabes.",
    38: "al-Ṣūfī: more likely on the leg than under the knee, as Ptolemy has it.",
  };

  const MAGW = { s: "aṣghar – a bit fainter", k: "akbar – a bit brighter", m: "aʿẓam – much brighter" };
  const magText = (m) => (m === "neb" ? "nebula" : m === "—" ? "—" : m.replace(/\((s|k|m)\)/, (x, c) => ` (${MAGW[c].split(" – ")[0]})`));
  const lonText = (r) => { const [n, , sg, d, mi] = r; const S = SIGNS[sg]; if (d == null) return `${S[0]} ?°${String(mi).padStart(2, "0")}′`; return `${S[0]} ${d}°${String(mi).padStart(2, "0")}′`; };
  const latText = (r) => `${r[5]}°${String(r[6]).padStart(2, "0")}′ S`;
  // ecliptic longitude (°) in 964 and its J2000 equivalent (precession 964 → 2000, 50.29″/yr)
  const PREC = ((2000 - 964) * 50.29) / 3600;
  const lon964 = (r) => (r[3] == null ? null : r[2] * 30 + r[3] + r[4] / 60);

  const rows = ORI.map((r) => ({ n: r[0], hip: r[1], ab: abjad(r[0]), lon: lonText(r), lat: latText(r), lon964: lon964(r), lat964: -(r[5] + r[6] / 60),
    mag: r[7], ptol: r[8], v: r[9], where: r[10], fix: FIX[r[0]] || null, name: NAMES[r[0]] || null, note: NOTES[r[0]] || null }));
  const added = ADDED.map((r) => ({ n: r[0], hip: r[1], ab: abjad(r[0]), mag: r[2], v: r[3], where: r[4], added: true }));
  const STARS = {};
  rows.concat(added).forEach((r) => (STARS[r.hip] = Object.assign({ con: "Ori" }, r)));
  const CON = { Ori: { ar: "الجبّار · الجوزاء", tr: "al-Jabbār · al-Jawzāʾ", count: 38 } };
  const nameOf = (r) => { const nm = r && r.name; if (!nm) return null; return nm.group ? Object.assign({}, GROUP[nm.group], nm.en ? { en2: nm.en } : {}) : nm; };

  const TABLE = {
    title: "al-Ṣūfī’s table of positions and magnitudes for the year 964",
    con: "Ori", conTitle: "al-Jabbār · al-Jawzāʾ (Orion) – 38 stars, and two he added in his comments",
    note: "Longitude along the zodiac and latitude south of the ecliptic for 964 CE (Ptolemy’s positions + 12°42′ precession). Magnitudes: (s) aṣghar = a bit fainter, (k) akbar = a bit brighter, (m) aʿẓam = much brighter; Ptolemy as al-Ṣūfī quotes him; today = modern visual magnitude.",
    source: "Bodleian MS Marsh 144 (1009 CE), the oldest copy, as edited in I. Hafez, PhD thesis, James Cook University 2010.",
    rows, added, PREC,
  };

  // ---------- drawings ----------
  // coordinates are in a 1212 px wide frame of the page; anchors = [hip, x, y]
  // segmentation (boxes around the Arabic writing, translation, phonetics, number tags) converted from the
  // annotated page built in the project's chat “صورة محادثة مترجمة” (948 px frame × 1212/948)
  const FIGURES = [{
    con: "Ori", src: "vendor/sufi/orion-globe.png", page: "vendor/sufi/orion-page.jpg", frameW: 1212, frameH: 2000,
    title: "Orion – al-Jabbār / al-Jawzāʾ",
    caption: "كوكبة الجبّار وهو الجوزاء على ما يُرى في الكرة — “as seen on the globe”: a mirror image of the sky, so its writing reads reversed here",
    anchors: [[26207, 750, 983], [27989, 893, 1105], [25336, 608, 1112], [25930, 697, 1362],
              [26311, 760, 1384], [26727, 819, 1404], [24436, 533, 1622], [27366, 860, 1712]],
    highlights: [{
      id: "sword", name: "Sword of al-Jabbār", ar: "سيف الجبّار",
      poly: [[700, 1402], [737, 1402], [752, 1505], [805, 1515], [808, 1556], [792, 1562], [802, 1918],
             [722, 1922], [716, 1562], [690, 1552], [688, 1512], [708, 1500]],
      hips: [26237, 26220, 26241],
      html: `<b style="color:#ffd27a">⚔ Sword of al-Jabbār <span class="ar">سيف الجبّار</span></b>
        <i>al-laqaṭ · sayf al-jabbār – stars 30 to 32 (ل لا لب)</i>
        <span>Star 29 (كط) marks the tip of the handle; 33 and 34 (لج لد) lie under the sword’s tip.</span>
        <span>In the sky: c Ori, the Orion Nebula M42 (θ Ori) and ι Ori. Ptolemy and al-Ṣūfī list the nebula as a star; it was first described as a nebula in the 17th century.</span>`,
    }],
    ann: {
      // fitted from the annotated sheets of the chat “صورة محادثة مترجمة” (their 948 px page → this 1212 px frame:
      // x′ = 1.2014x − 0.0039y + 38.7, y′ = −0.0008x + 1.2088y + 19.3, residual ≤ 2 px on six star dots)
      legend: [["#18b4d8", "Box = Arabic writing"], ["#ffffff", "White = translation"], ["#ffb547", "Orange = phonetics"],
               ["#f5c542", "Gold = al-Haqʿa"], ["#ff6fb5", "Pink = alif (1)"]],
      boxes: [
        { id: "sleeve-text", side: "R", ty: 64, hip: 22449, box: [65, 118, 1073, 363], ar: "المقوّسة التي على الكمّ وهي من السابع عشر إلى الخامس والعشرين تاج الجوزاء وذوائب الجوزاء أيضا",
          tr: "The curved stars on the sleeve – numbers 17 to 25 – are the Crown of al-Jawzāʾ and also the Tresses of al-Jawzāʾ.",
          ph: "al-muqawwasa allatī ʿalā l-kumm, wa-hiya min as-sābiʿ ʿashar ilā l-khāmis wa-l-ʿishrīn: tāj al-jawzāʾ wa-dhawāʾib al-jawzāʾ ayḍan" },
        { id: "title", side: "L", ty: 347, hip: 26311, box: [272, 464, 929, 533], ar: "كوكبة الجبّار وهو الجوزاء على ما يُرى في الكرة",
          tr: "The constellation of al-Jabbār (“the Giant”), which is al-Jawzāʾ, as it is seen on the globe",
          ph: "kawkabat al-jabbār, wa-huwa l-jawzāʾ, ʿalā mā yurā fī l-kura" },
        { id: "crown", side: "L", ty: 603, hip: 22449, box: [299, 678, 514, 880], ar: "التاج والذوائب", tr: "Stars 17–25 · The Crown and the Tresses", ph: "at-tāj wa-dh-dhawāʾib" },
        { id: "star3", side: "L", ty: 868, hip: 25336, box: [438, 1077, 642, 1137], ar: "ج · المرزم والناجذ",
          tr: "Star 3 (jīm) · al-Mirzam (“the herald”) and al-Nājidh (“the molar tooth”) = Bellatrix", ph: "jīm · al-mirzam wa-n-nājidh" },
        { id: "also", side: "L", ty: 1111, hip: 22449, box: [189, 1041, 242, 1189], ar: "أيضا", tr: "“also” – belongs to the label above: “the Crown and the Tresses also”", ph: "ayḍan" },
        { id: "haqa", side: "R", ty: 609, hip: 26207, color: "gold", box: [712, 999, 790, 1046], ar: "ا · الهقعة · هقعة الجوزاء",
          tr: "al-Haqʿa (also Haqʿat al-Jawzāʾ): the first star of Orion = three small stars close together on the head, which look like the dots of the letter thāʾ (ث). Other names: al-Taḥāti, al-Taḥiyya, al-Athāfī (“the hearthstones”). The 5th lunar mansion.",
          ph: "al-haqʿa · haqʿat al-jawzāʾ · aṭ-ṭaḥāti · aṭ-ṭaḥiyya · al-athāfī",
          // the parts of this label: pink = the numeral alif (1), gold ring = the three red stars, gold box = the word
          alif: [728, 942, 753, 982], ring: [752, 982, 17.5], dots: [[750.6, 973.7], [743.5, 987.4], [758.6, 987.2]],
          real: [26207, 26176, 26366],                       // λ, φ¹, φ² Ori in the sky
          inset: { view: [682, 925, 140, 140], notes: [
            ["#ff6fb5", "Pink = alif (ا) = number 1", "alif – the star’s catalogue number"],
            ["#f5c542", "Gold circles = the three red stars, set like the 3 dots of the letter ث", "thāʾ"],
            ["#f5c542", "Gold box = the word al-Haqʿa", "al-haqʿa – “the whorl”"]] } },
        { id: "star2", side: "R", ty: 1012, hip: 27989, box: [816, 1064, 924, 1179], ar: "ب · يد الجوزاء", tr: "Star 2 (bāʾ) · Hand of al-Jawzāʾ = Betelgeuse", ph: "bāʾ · yad al-jawzāʾ" },
        { id: "belt", side: "R", ty: 1207, hip: 26311, box: [477, 1337, 813, 1436], ar: "المنطقة ويقال لها النظم أيضا",
          tr: "Stars 26–28 · The Belt, which is also called “the string (of pearls)”", ph: "al-minṭaqa, wa-yuqāl lahā an-naẓm ayḍan" },
        { id: "star35", side: "L", ty: 1461, hip: 24436, box: [274, 1569, 562, 1627], ar: "له · رجل الجوزاء اليسرى", tr: "Star 35 (lām-hāʾ) · Left foot of al-Jawzāʾ = Rigel", ph: "lām-hāʾ · rijl al-jawzāʾ al-yusrā" },
      ],
      // abjad number written next to a star → tag with the number in digits: [n, x, y] (tag centre)
      tags: [[16, 590, 1189], [17, 570, 726], [18, 516, 781], [19, 473, 853], [20, 443, 920], [21, 377, 980], [22, 338, 1030],
             [23, 338, 1085], [24, 338, 1155], [25, 358, 1216], [26, 724, 1310], [27, 796, 1327], [28, 854, 1346], [38, 890, 1712]],
    },
  }];

  window.SpaceshipSufi = { abjad, SIGNS, MAGW, magText, nameOf, star: (hip) => STARS[hip] || null, con: (id) => CON[id] || null, figures: FIGURES, table: TABLE };
})();
