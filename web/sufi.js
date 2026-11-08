// al-Ṣūfī, Kitāb ṣuwar al-kawākib (Book of the Fixed Stars, c. 964): star numbers in abjad letters,
// Arabic names, and the constellation drawing laid over the real sky.
// Numbering follows Ptolemy's Almagest catalogue (Orion: 38 stars), which al-Ṣūfī kept.
"use strict";
(function () {
  // abjad numerals: tens before units (26 = ك 20 + و 6 = كو)
  const UNITS = ["", "ا", "ب", "ج", "د", "ه", "و", "ز", "ح", "ط"];
  const TENS = ["", "ي", "ك", "ل", "م", "ن", "س", "ع", "ف", "ص"];
  const HUNDREDS = ["", "ق", "ر", "ش", "ت", "ث", "خ", "ذ", "ض", "ظ"];
  const abjad = (n) => HUNDREDS[Math.floor(n / 100) % 10] + TENS[Math.floor(n / 10) % 10] + UNITS[n % 10];

  // star identifications by Hipparcos number – only those that are certain and labelled on the manuscript page
  const STARS = {
    26207: { con: "Ori", n: 1, ar: "الهقعة", tr: "al-Haqʿa", en: "the white spot (on the head)" },
    27989: { con: "Ori", n: 2, ar: "يد الجوزاء", tr: "Yad al-Jawzāʾ", en: "hand of al-Jawzāʾ – source of the name Betelgeuse" },
    25336: { con: "Ori", n: 3, ar: "المرزم · الناجذ", tr: "al-Mirzam · an-Nājidh", en: "the roarer · the molar tooth" },
    25930: { con: "Ori", n: 26, ar: "المنطقة", tr: "al-Minṭaqa", en: "the belt – source of Mintaka" },
    26311: { con: "Ori", n: 27, ar: "النظم", tr: "an-Naẓm", en: "the string of pearls – source of Alnilam" },
    26727: { con: "Ori", n: 28, ar: "النطاق", tr: "an-Niṭāq", en: "the girdle – source of Alnitak" },
    24436: { con: "Ori", n: 35, ar: "رجل الجوزاء اليسرى", tr: "Rijl al-Jawzāʾ al-Yusrā", en: "left foot of al-Jawzāʾ – source of Rigel" },
    27366: { con: "Ori", n: 38, ar: "", tr: "", en: "knee of the figure (modern name Saiph, from sayf al-jabbār, “sword of the giant”)" },
  };
  const CON = { Ori: { ar: "الجبّار · الجوزاء", tr: "al-Jabbār · al-Jawzāʾ", count: 38 } };

  // drawings. Coordinates are in a 1212 px wide frame of the page; anchors = [hip, x, y]
  const FIGURES = [{
    con: "Ori", src: "vendor/sufi/orion-globe.png", frameW: 1212, frameH: 2000,
    title: "Orion – al-Jabbār / al-Jawzāʾ",
    caption: "كوكبة الجبّار وهو الجوزاء على ما يُرى في الكرة — “as seen on the globe”: a mirror image of the sky, so its writing reads reversed here",
    anchors: [[26207, 750, 983], [27989, 893, 1105], [25336, 608, 1112], [25930, 697, 1362],
              [26311, 760, 1384], [26727, 819, 1404], [24436, 533, 1622], [27366, 860, 1712]],
    highlights: [{
      id: "sword", name: "Sword of al-Jabbār", ar: "سيف الجبّار",
      poly: [[700, 1402], [737, 1402], [752, 1505], [805, 1515], [808, 1556], [792, 1562], [802, 1918],
             [722, 1922], [716, 1562], [690, 1552], [688, 1512], [708, 1500]],
      // the real sword stars below the belt (c Ori, θ/M42, ι Ori)
      hips: [26237, 26241],
      html: `<b style="color:#ffd27a">⚔ Sword of al-Jabbār <span class="ar">سيف الجبّار</span></b>
        <i>al-Ṣūfī · the stars on the sword carry the numbers from كط (29) onwards</i>
        <span>The sword hangs from the belt. In the sky: c Ori (Mizan Batil), the Orion Nebula M42 (θ Ori) and ι Ori (Hatysa).</span>
        <span>In Ptolemy's and al-Ṣūfī's catalogues the Orion Nebula is listed as a star; it was first described as a nebula in the 17th century.</span>`,
    }],
  }];

  window.SpaceshipSufi = { abjad, star: (hip) => STARS[hip] || null, con: (id) => CON[id] || null, figures: FIGURES };
})();
