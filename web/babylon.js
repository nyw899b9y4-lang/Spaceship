// Layer 1 – the Babylonian view of Orion: SIPA.ZI.AN.NA (𒉺𒇻𒍣𒀭𒈾), the “Faithful Shepherd of Anu / of Heaven”
// (Akkadian šitaddaru / šidallu). Data after the ASE wiki (Astronomical Star Names of the Ancient Near East):
// https://ase.exopla.net/index.php/SIPA.ZI.AN.NA – constellation-line stars, extent (RA 73.56°–95.74°, Dec −9.67°…+22.51°),
// MUL.APIN references and the GU-text identifications. The stick figure drawn here is our own simplification of those stars.
// Layer 2 is al-Ṣūfī (sufi.js); the belt keeps its abjad numbers كو 26 · كز 27 · كح 28 in both layers.
"use strict";
(function () {
  const B = (en, de) => ({ en, de });
  const L = (o) => (window.I18N ? I18N.L(o) : o == null ? "" : typeof o === "string" ? o : o.en);
  const CLAY = "#e8935a";                      // terracotta, like a clay tablet

  // stars of the figure and their part – HIP → { part, src }
  const STARS = {
    26207: { part: B("head", "Kopf") },
    27989: { part: B("shoulder (raised arm)", "Schulter (erhobener Arm)") },
    25336: { part: B("shoulder", "Schulter") },
    25930: { part: B("belt / waist", "Gürtel / Hüfte"), belt: 26 },
    26311: { part: B("belt / waist", "Gürtel / Hüfte"), belt: 27 },
    26727: { part: B("belt / waist", "Gürtel / Hüfte"), belt: 28 },
    24436: { part: B("foot – brightest star of the figure", "Fuß – hellster Stern der Figur") },
    27366: { part: B("foot", "Fuß") },
    28614: { part: B("raised arm", "erhobener Arm") },
    29038: { part: B("right hand (GU-text)", "rechte Hand (GU-Text)"), src: "GU" },
    29426: { part: B("right hand (GU-text)", "rechte Hand (GU-Text)"), src: "GU" },
    29655: { part: B("edge of the figure – in Gemini (constellation lines, ASE)", "Rand der Figur – in den Zwillingen (Sternbildlinien, ASE)") },
    30343: { part: B("edge of the figure – in Gemini (constellation lines, ASE)", "Rand der Figur – in den Zwillingen (Sternbildlinien, ASE)") },
    28103: { part: B("back heel (GU-text; outside the hull)", "hintere Ferse (GU-Text; außerhalb der Hülle)"), src: "GU" },
  };
  // figure lines (solid) and the reach of the raised arm to Gemini (dashed)
  const LINES = [[26207, 27989], [26207, 25336], [27989, 26727], [25336, 25930], [25930, 26311], [26311, 26727],
                 [25930, 24436], [26727, 27366], [27989, 28614], [28614, 29038], [29038, 29426]];
  const DASHED = [[29426, 29655], [29655, 30343], [27366, 28103]];
  // convex hull of the figure (ASE): its corners give the extent RA 73.56°–95.74°, Dec −9.67°…+22.51°
  const HULL = [30343, 29655, 22797, 24436, 27366];
  const BELT = { 26: [25930, "كو"], 27: [26311, "كز"], 28: [26727, "كح"] };

  const NAME = {
    sum: "SIPA.ZI.AN.NA", cun: "𒉺𒇻𒍣𒀭𒈾", akk: "šitaddaru · šidallu",
    tr: B("The Faithful Shepherd of Anu (of Heaven)", "Der treue Hirte des Anu (des Himmels)"),
  };
  const INFO = B(
    `<b style="color:${CLAY}">𒉺𒇻𒍣𒀭𒈾 SIPA.ZI.AN.NA</b><i>Babylonian · Sumerian · “The Faithful Shepherd of Anu”</i>
     <span>The main body of Orion – torso, arms and legs – as a bearded man. Akkadian <i>šitaddaru / šidallu</i>, first in an Old Babylonian prayer to the Gods of the Night; the origin of the word is uncertain.</span>
     <span><b>MUL.APIN</b>: one of the stars of Anu (no. 8); its heliacal rising and the stars rising and setting with it are listed; it stands “in the path of the Moon”.</span>
     <span><b>GU-text</b>: right hand = ξ and ν Ori; back heel = η Lep.</span>
     <span>Belt: possibly mul U5.RI2.IN (a suggestion). In al-Ṣūfī: كو 26 · كز 27 · كح 28.</span>
     <span>Extent: RA 73.6°–95.7°, Dec −9.7°…+22.5° – reaches into Taurus, Eridanus and Gemini.</span>
     <small>Source: ASE wiki, ase.exopla.net · Layer 1 of 2 (layer 2: al-Ṣūfī)</small>`,
    `<b style="color:${CLAY}">𒉺𒇻𒍣𒀭𒈾 SIPA.ZI.AN.NA</b><i>babylonisch · sumerisch · „Der treue Hirte des Anu“</i>
     <span>Der Hauptkörper des Orion – Rumpf, Arme und Beine – als bärtiger Mann. Akkadisch <i>šitaddaru / šidallu</i>, zuerst in einem altbabylonischen Gebet an die Götter der Nacht; die Herkunft des Wortes ist unsicher.</span>
     <span><b>MUL.APIN</b>: einer der Sterne des Anu (Nr. 8); sein heliakischer Aufgang und die mit ihm auf- und untergehenden Sterne sind verzeichnet; er steht „im Pfad des Mondes“.</span>
     <span><b>GU-Text</b>: rechte Hand = ξ und ν Ori; hintere Ferse = η Lep.</span>
     <span>Gürtel: möglicherweise mul U5.RI2.IN (ein Vorschlag). Bei al-Ṣūfī: كو 26 · كز 27 · كح 28.</span>
     <span>Ausdehnung: RA 73,6°–95,7°, Dek −9,7°…+22,5° – reicht in Stier, Eridanus und Zwillinge.</span>
     <small>Quelle: ASE-Wiki, ase.exopla.net · Layer 1 von 2 (Layer 2: al-Ṣūfī)</small>`);

  // star tip line (shown before the al-Ṣūfī lines)
  function starHtml(hip) {
    const s = STARS[hip]; if (!s) return "";
    const b = s.belt ? ` · <span class="ar">${BELT[s.belt][1]}</span> ${s.belt}` : "";
    return `<span class="ck-sufi" style="color:${CLAY}">𒉺 SIPA.ZI.AN.NA – ${L(s.part)}${b}</span>`;
  }

  window.SpaceshipBabylon = { CLAY, STARS, LINES, DASHED, HULL, BELT, NAME, info: () => L(INFO), title: () => L(NAME.tr), starHtml };
})();
