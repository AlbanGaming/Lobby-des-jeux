// Illustrations des objets, dessinées pour le jeu (style « autocollant » : contour encre, aplats).
// viewBox 64×64. Classes de remplissage (voir style.css) :
//   t teinte de l'objet · d teinte foncée · l teinte claire · p papier · g métal · y or · w pain/bois clair
//   c chocolat · r tomate · n feuille · b ciel · k encre · s écran · f peau · o contour seul · h reflet
//   ts trait couleur teinte (pour les cadres, guidons, manches…) · nf sans contour

// Trait épais teinté avec contour encre (cadre de vélo, manche…)
const F = (d, w = 4) => `<path class="o" style="stroke-width:${w + 3}" d="${d}"/><path class="ts" style="stroke-width:${w}" d="${d}"/>`;
// Trait encre épais
const K = (d, w = 4) => `<path class="o" style="stroke-width:${w}" d="${d}"/>`;
// Union de formes : un contour commun, puis les remplissages par-dessus (pas de trait intérieur)
const U = (shapes, cls) =>
  shapes.map((s) => s.replace(/^<(\w+)/, '<$1 class="o" style="stroke-width:5"')).join('') +
  shapes.map((s) => s.replace(/^<(\w+)/, `<$1 class="${cls} nf"`)).join('');

export const ART = {
  bottle: {
    tint: '#4cc3ff',
    svg: `<path class="l" d="M26 6h12v9l6 8v31a5 5 0 0 1-5 5H25a5 5 0 0 1-5-5V23l6-8z"/><rect class="t" x="25" y="4" width="14" height="7" rx="2"/><rect class="p" x="20" y="31" width="24" height="14"/><path class="t nf" d="M24 36h16v4H24z"/><path class="h" d="M25 25v4M25 49v4"/>`,
  },
  baguette: {
    tint: '#d9954a',
    svg: `<path class="w" d="M9 47c-4-4-2-10 3-14L39 10c5-4 12-5 15-1s2 10-3 14L24 47c-5 4-12 4-15 0z"/><path class="o" d="M18 39l7-3M27 32l7-3M36 25l7-3M45 18l5-2"/><path class="h" d="M14 41c3-3 8-7 12-10"/>`,
  },
  jar: {
    tint: '#ffc93c',
    svg: `<path class="t" d="M15 23a4 4 0 0 1 4-4h26a4 4 0 0 1 4 4v28a7 7 0 0 1-7 7H22a7 7 0 0 1-7-7z"/><rect class="c" x="17" y="9" width="30" height="10" rx="3"/><path class="p" d="M20 31h24v14H20z"/><path class="y" d="M29 35l3-2 3 2v4l-3 2-3-2z"/><path class="t" d="M33 19v7a2.5 2.5 0 0 0 5 0v-4"/><path class="h" d="M19 48v4"/>`,
  },
  coffeebag: {
    tint: '#8a5a3b',
    svg: `<path class="t" d="M18 16h28l5 41H13z"/><path class="d" d="M17 8h30v8H17z"/><path class="o" d="M21 12h22"/><ellipse class="p" cx="32" cy="37" rx="10" ry="12"/><ellipse class="c" cx="32" cy="37" rx="5.5" ry="7.5"/><path class="o" style="stroke:#fff8ec;stroke-width:2" d="M32 30.5c-2.5 4 2.5 9 0 13"/>`,
  },
  eggs: {
    tint: '#d9c3a0',
    svg: `<ellipse class="p" cx="19" cy="29" rx="7.5" ry="9.5"/><ellipse class="p" cx="32" cy="26" rx="7.5" ry="9.5"/><ellipse class="p" cx="45" cy="29" rx="7.5" ry="9.5"/><path class="t" d="M5 34h54l-5 20H10z"/><path class="o" d="M18 34c0 6 5 8 7 8s7-2 7-8c0 6 5 8 7 8s7-2 7-8"/><path class="h" d="M16 25c0-3 1-5 3-6M29 22c0-3 1-5 3-6"/>`,
  },
  cheese: {
    tint: '#ffc93c',
    svg: `<path class="l" d="M6 38L44 14l14 13z"/><path class="t" d="M6 38h52v15H6z"/><circle class="d" cx="18" cy="45.5" r="3.5"/><circle class="d" cx="35" cy="47" r="4"/><circle class="d" cx="49" cy="43" r="2.2"/><ellipse class="d" cx="40" cy="27" rx="3.5" ry="1.8"/><ellipse class="d" cx="28" cy="33" rx="2.5" ry="1.2"/>`,
  },
  flowers: {
    tint: '#ff5a4e',
    svg: `<path class="o" d="M32 34V16M25 36l-7-15M39 36l7-15"/><path class="n" d="M32 32c-7-2-10-7-10-11 6 0 9 5 10 11z"/><path class="n" d="M33 30c5-4 10-4 12-2-3 4-7 5-12 2z"/>${U(['<circle cx="32" cy="9" r="4"/>', '<circle cx="26" cy="14" r="4"/>', '<circle cx="38" cy="14" r="4"/>', '<circle cx="28.5" cy="20" r="4"/>', '<circle cx="35.5" cy="20" r="4"/>'], 't')}<circle class="y" cx="32" cy="15" r="3.2"/><circle class="b" cx="17" cy="19" r="6"/><circle class="p" cx="17" cy="19" r="2.2"/><circle class="y" cx="47" cy="19" r="6"/><circle class="c" cx="47" cy="19" r="2.2"/><path class="p" d="M13 33h38L39 59H25z"/><path class="r" d="M24 45h16l-2 5H26z"/>`,
  },
  chocolate: {
    tint: '#ff5a4e',
    svg: `<rect class="c" x="14" y="6" width="36" height="34" rx="3"/><path class="o" style="stroke:#3d2318" d="M26 6v26M38 6v26M14 18h36M14 29h36"/><path class="t" d="M11 31l42-4 3 30H8z"/><rect class="p" x="16" y="38" width="32" height="11" rx="2" transform="rotate(-4 32 43)"/><path class="h" d="M17 10h6"/>`,
  },
  toiletroll: {
    tint: '#cfe8ff',
    svg: `<path class="p" d="M14 16h36v36c0 3-8 6-18 6s-18-3-18-6z"/><ellipse class="l" cx="32" cy="16" rx="18" ry="7"/><ellipse class="g" cx="32" cy="16" rx="6" ry="2.4"/><path class="p" d="M14 34h-4v20h4"/><path class="o" style="stroke-dasharray:2 3" d="M14 44h-4"/><path class="t nf" d="M15 30c8 3 26 3 34 0v4c-8 3-26 3-34 0z"/>`,
  },
  toothbrush: {
    tint: '#3ee6a8',
    svg: `<rect class="p" x="27" y="4" width="10" height="22" rx="4"/><rect class="b" x="28.5" y="5" width="7" height="8" rx="1.5"/><path class="o" d="M30 7v4M33 7v4"/><rect class="t" x="23" y="24" width="18" height="34" rx="8"/><circle class="p" cx="32" cy="36" r="3.2"/><path class="h" d="M27 30v20"/>`,
  },
  ticket: {
    tint: '#ff5a4e',
    svg: `<g transform="rotate(-12 32 32)"><path class="t" d="M6 20h52v8a4 4 0 0 0 0 8v8H6v-8a4 4 0 0 0 0-8z"/><path class="o" style="stroke-dasharray:3 3" d="M44 20v24"/><path class="y" d="M24 23l2.6 5.2 5.7.8-4.1 4 1 5.7-5.2-2.7-5.1 2.7 1-5.7-4.1-4 5.7-.8z"/><path class="p nf" d="M48 27h6v3h-6zM48 34h6v3h-6z"/></g>`,
  },
  croissant: {
    tint: '#e0a049',
    svg: `<path class="t" d="M6 42c1-15 13-26 26-26s25 11 26 26c-4 3-9 1-11-3-2 4-7 5-10 2-3 4-8 4-10 0-3 3-8 2-10-2-2 4-7 6-11 3z"/><path class="d nf" d="M10 40c3-2 6-2 8 1-2 2-6 2-8-1zM46 41c2-3 5-3 8-1-2 3-6 3-8 1z"/><path class="o" d="M21 21c3 6 3 13 0 20M32 17v24M43 21c-3 6-3 13 0 20"/><path class="h" d="M26 22c-3 2-5 5-6 8"/>`,
  },
  umbrella: {
    tint: '#a68bff',
    svg: `<path class="t" d="M6 33a26 26 0 0 1 52 0c-3-3-8-3-9 0-3-3-9-3-11 0-2-3-9-3-12 0-2-3-8-3-11 0-1-3-6-3-9 0z"/><path class="d nf" d="M32 8c-7 6-9 15-9 25 3-3 6-3 9 0z"/><path class="o" d="M32 8c-7 6-9 15-9 25M32 8c7 6 9 15 9 25"/>${K('M32 33v19a4.5 4.5 0 0 1-9 0', 3.5)}<path class="o" d="M32 8V4"/>`,
  },
  pizza: {
    tint: '#ff5a4e',
    svg: `<circle class="w" cx="32" cy="32" r="25"/><circle class="y" cx="32" cy="32" r="20"/><circle class="r" cx="24" cy="23" r="4"/><circle class="r" cx="41" cy="26" r="4"/><circle class="r" cx="27" cy="41" r="4"/><circle class="r" cx="42" cy="41" r="3.5"/><ellipse class="n" cx="33" cy="33" rx="3" ry="1.6" transform="rotate(30 33 33)"/><ellipse class="n" cx="19" cy="33" rx="3" ry="1.6"/><path class="o" d="M32 12v40M14 22l36 20M14 42l36-20"/>`,
  },
  apple: {
    tint: '#ff5a4e',
    svg: `<path class="t" d="M32 20c-6-4-21-4-21 13 0 12 8 24 15 24 3 0 4-2 6-2s3 2 6 2c7 0 15-12 15-24 0-17-15-17-21-13z"/>${K('M32 21c0-6 2-10 5-13', 3)}<path class="n" d="M35 15c4-6 11-7 13-4-2 5-9 7-13 4z"/><path class="h" d="M19 31c0-4 2-7 5-8"/>`,
  },
  battery: {
    tint: '#ff8a3d',
    svg: `<rect class="g" x="17" y="9" width="6" height="5" rx="1"/><rect class="g" x="41" y="9" width="6" height="5" rx="1"/><rect class="k" x="12" y="13" width="16" height="44" rx="3"/><rect class="k" x="36" y="13" width="16" height="44" rx="3"/><path class="t nf" d="M13.3 14.3h13.4v13H13.3zM37.3 14.3h13.4v13H37.3z"/><path class="y" d="M21 33l-4 9h4l-2 8 7-11h-4l2-6zM45 33l-4 9h4l-2 8 7-11h-4l2-6z"/>`,
  },
  kettle: {
    tint: '#ff8a5b',
    svg: `${K('M46 22c9 0 9 22 0 22', 5)}<path class="t" d="M17 30L7 23l1 12z"/><path class="t" d="M13 53l3-28c1-7 7-11 16-11s15 4 16 11l3 28z"/><rect class="k" x="10" y="51" width="44" height="6" rx="2"/><rect class="k" x="27" y="9" width="10" height="5" rx="2"/><rect class="b" x="38" y="27" width="5" height="19" rx="2.5"/><path class="h" d="M22 24c-2 4-3 12-3 20"/>`,
  },
  toaster: {
    tint: '#3ee6a8',
    svg: `<path class="w" d="M17 27v-9a4 4 0 0 1 4-4h8a4 4 0 0 1 4 4v9M35 27v-7a4 4 0 0 1 4-4h6a4 4 0 0 1 4 4v7"/><rect class="t" x="8" y="24" width="48" height="30" rx="9"/><path class="o" d="M17 27h16M35 27h14"/><rect class="k" x="53" y="33" width="7" height="4" rx="1.5"/><path class="o" d="M15 54v4M49 54v4"/><path class="h" d="M14 32v14"/>`,
  },
  espresso: {
    tint: '#ff5a4e',
    svg: `<path class="l" d="M19 11l3-7h20l3 7z"/><circle class="c nf" cx="27" cy="8" r="1.3"/><circle class="c nf" cx="32" cy="7" r="1.3"/><circle class="c nf" cx="37" cy="8" r="1.3"/><rect class="t" x="11" y="11" width="42" height="13" rx="3"/><rect class="g" x="14" y="24" width="36" height="21"/><rect class="k" x="25" y="24" width="14" height="6" rx="1"/><path class="o" style="stroke:#6b3f2a" d="M30 30v4M34 30v4"/><path class="p" d="M26 35h12v6a3 3 0 0 1-3 3h-6a3 3 0 0 1-3-3z"/><rect class="t" x="9" y="44" width="46" height="11" rx="3"/><circle class="p" cx="45" cy="17.5" r="3"/>`,
  },
  vacuum: {
    tint: '#a68bff',
    svg: `${F('M44 10L22 52', 4)}<rect class="t" x="31" y="18" width="13" height="20" rx="6" transform="rotate(27 37 28)"/><rect class="b" x="34" y="22" width="5" height="10" rx="2" transform="rotate(27 37 28)"/><path class="t" d="M40 4h9l2 11-7 3z"/><path class="k" d="M10 50h22a4.5 4.5 0 0 1 0 9H10a4.5 4.5 0 0 1 0-9z"/><path class="g nf" d="M10 55h22v2H10z"/>`,
  },
  washer: {
    tint: '#4cc3ff',
    svg: `<rect class="p" x="11" y="6" width="42" height="52" rx="5"/><path class="o" d="M11 17h42"/><circle class="t" cx="19" cy="11.5" r="2.5"/><rect class="k" x="36" y="9.5" width="12" height="4" rx="1"/><circle class="g" cx="32" cy="37" r="14"/><circle class="l" cx="32" cy="37" r="9.5"/><path class="t nf" d="M22.6 38c3-2 6 2 9.4 0s6.5-2 9.4 0a9.5 9.5 0 0 1-18.8 0z"/><path class="h" d="M27 31a7 7 0 0 1 5-2"/>`,
  },
  fridge: {
    tint: '#dfe7f2',
    svg: `<rect class="t" x="15" y="3" width="34" height="58" rx="5"/><path class="o" d="M15 24h34"/>${K('M21 11v7M21 30v12', 3.5)}<circle class="r" cx="39" cy="33" r="3"/><rect class="y" x="34" y="40" width="9" height="7" rx="1" transform="rotate(-8 38 43)"/><circle class="b" cx="40" cy="12" r="2.5"/><path class="o" d="M19 61v1M45 61v1"/>`,
  },
  microwave: {
    tint: '#c9d1e0',
    svg: `<rect class="t" x="5" y="15" width="54" height="36" rx="4"/><rect class="s" x="10" y="20" width="33" height="26" rx="2"/><ellipse class="y nf" cx="26.5" cy="41" rx="11" ry="2.6" opacity=".7"/><path class="h" d="M14 24l6 0M14 28l3 0"/><rect class="k" x="47" y="21" width="8" height="6" rx="1"/><circle class="p" cx="51" cy="33" r="2"/><circle class="p" cx="51" cy="40" r="2"/><path class="o" d="M12 51v3M52 51v3"/>`,
  },
  pan: {
    tint: '#c98a54',
    svg: `${F('M45 31l15-7', 5)}<ellipse class="k" cx="26" cy="34" rx="21" ry="17"/><ellipse class="s" cx="26" cy="34" rx="16" ry="12.5"/><path class="p" d="M19 29c2-6 11-6 13-1 5 1 5 8 0 10-3 4-11 3-13-1-4-1-4-7 0-8z"/><circle class="y" cx="25" cy="33" r="4"/>`,
  },
  sofa: {
    tint: '#ff8a5b',
    svg: `<rect class="t" x="10" y="16" width="44" height="22" rx="6"/><path class="o" d="M32 18v16"/><rect class="l" x="14" y="33" width="36" height="11" rx="3"/><path class="o" d="M32 33v11"/><rect class="d" x="3" y="27" width="13" height="23" rx="6"/><rect class="d" x="48" y="27" width="13" height="23" rx="6"/><rect class="t" x="14" y="43" width="36" height="7"/><path class="o" style="stroke-width:3.5" d="M9 50v5M55 50v5"/>`,
  },
  lamp: {
    tint: '#4cc3ff',
    svg: `<path class="o" style="stroke:#ffc93c;stroke-width:2.5" d="M38 31l2 6M32 30l-3 5M44 27l5 3"/>${F('M20 52L16 33l17-14', 3.5)}<circle class="k" cx="16" cy="33" r="3"/><path class="t" d="M27 10l15-6 9 17-21 3z"/><ellipse class="t" cx="20" cy="54" rx="13" ry="4.5"/><circle class="y" cx="38" cy="22" r="3"/>`,
  },
  pillow: {
    tint: '#b9d4ff',
    svg: `<path class="t" d="M8 19c9-7 39-7 48 0 4 9 4 21 0 30-9 7-39 7-48 0-4-9-4-21 0-30z"/><path class="l nf" d="M13 24c8-4 30-4 38 0 2 6 2 14 0 20-8 4-30 4-38 0-2-6-2-14 0-20z"/><path class="o" style="stroke-dasharray:2 3" d="M13 24c8-4 30-4 38 0 2 6 2 14 0 20-8 4-30 4-38 0-2-6-2-14 0-20z"/>`,
  },
  plant: {
    tint: '#4fcf7a',
    svg: `<path class="t" d="M32 40c-3-11-1-23 7-31 3 12-1 24-7 31z"/><path class="d" d="M32 40c-6-8-16-11-23-9 4 8 14 12 23 9z"/><path class="d" d="M32 40c4-9 13-14 21-13-3 8-12 14-21 13z"/><path class="t" d="M31 40c-4-10-12-17-18-18 0 9 8 16 18 18z"/><path class="o" d="M32 40V26"/><path class="w" d="M19 41h26l-4 18H23z"/><rect class="w" x="16" y="37" width="32" height="7" rx="2"/>`,
  },
  mixer: {
    tint: '#ff5a4e',
    svg: `<rect class="t" x="39" y="18" width="12" height="35" rx="5"/><path class="t" d="M14 19c0-7 5-11 11-11h21c5 0 7 3 7 8v9H14z"/><circle class="p" cx="45" cy="16" r="2"/>${K('M27 25v12', 3)}<path class="g" d="M12 35h28c0 10-6 16-14 16s-14-6-14-16z"/><path class="h" d="M16 39c1 4 3 7 6 8"/><rect class="t" x="10" y="51" width="44" height="6" rx="3"/>`,
  },
  drill: {
    tint: '#3ee6a8',
    svg: `<path class="g" d="M50 22h10v4H50z"/><rect class="k" x="44" y="18" width="8" height="12" rx="1.5"/><rect class="t" x="12" y="14" width="34" height="19" rx="7"/><path class="t" d="M20 31h14l-3 17H19z"/><path class="k" d="M30 33h4v6h-5z"/><rect class="k" x="13" y="46" width="26" height="10" rx="2"/><path class="h" d="M17 19h14"/>`,
  },
  bed: {
    tint: '#a6c8ff',
    svg: `<path class="l" d="M4 34l15-13h41L45 34z"/><path class="t" d="M4 34h41v14H4z"/><path class="d" d="M45 34l15-13v14L45 48z"/><circle class="k nf" cx="20" cy="27.5" r="1.3"/><circle class="k nf" cx="32" cy="27.5" r="1.3"/><circle class="k nf" cx="44" cy="27.5" r="1.3"/><circle class="k nf" cx="27" cy="31" r="1.3"/><circle class="k nf" cx="39" cy="31" r="1.3"/><path class="o" style="stroke-dasharray:2 3" d="M8 41h33"/>`,
  },
  mug: {
    tint: '#4cc3ff',
    svg: `${K('M44 26h4a7 7 0 0 1 0 14h-4', 5)}<path class="t" d="M12 20h33v27a9 9 0 0 1-9 9H21a9 9 0 0 1-9-9z"/><path class="r" d="M28.5 42c-6-4-8-7-6-10 2-2 5-1 6 1 1-2 4-3 6-1 2 3 0 6-6 10z"/><path class="o" d="M22 15c-2-3 2-5 0-9M31 15c-2-3 2-5 0-9"/><path class="h" d="M17 26v16"/>`,
  },
  toolbox: {
    tint: '#ff5a4e',
    svg: `${K('M23 24v-7h18v7', 4.5)}${F('M44 22l10-14', 3)}<circle class="g" cx="55" cy="7" r="4"/><rect class="t" x="6" y="22" width="52" height="32" rx="3"/><path class="d nf" d="M7.3 33h49.4v3H7.3z"/><path class="o" d="M6 33h52"/><rect class="g" x="28" y="30" width="8" height="8" rx="1"/>`,
  },
  bike: {
    tint: '#ff5a4e',
    svg: `<circle class="o" style="stroke-width:3.5" cx="15" cy="43" r="11"/><circle class="o" style="stroke-width:3.5" cx="49" cy="43" r="11"/><circle class="k" cx="15" cy="43" r="2"/><circle class="k" cx="49" cy="43" r="2"/>${F('M15 43l10-19h20l4 19M25 24l9 19H15M34 43l11-19M23 18l2 6M45 24l-2-9', 3)}<path class="k" d="M18 16h10l-2 3h-7z"/>${K('M39 14h8', 3.5)}<circle class="g" cx="34" cy="43" r="3"/>`,
  },
  ball: {
    tint: '#1b1626',
    svg: `<circle class="p" cx="32" cy="32" r="24"/><path class="k" d="M32 22l9 6.5-3.4 10.5H26.4L23 28.5z"/><path class="o" d="M32 22v-9M41 28.5l9-3M37.6 39l5 8M26.4 39l-5 8M23 28.5l-9-3"/><path class="k nf" d="M24 10l8 3 8-3a24 24 0 0 0-16 0zM52 28l-2-2.5L54 18a24 24 0 0 1 2 12zM12 18l2 7.5L12 28a24 24 0 0 1 0-10z"/><path class="h" d="M16 22a18 18 0 0 1 6-6"/>`,
  },
  racket: {
    tint: '#4cc3ff',
    svg: `${F('M29 37L12 56', 5)}<ellipse class="o" style="stroke-width:9" cx="40" cy="22" rx="13" ry="17" transform="rotate(42 40 22)"/><ellipse class="l nf" cx="40" cy="22" rx="11" ry="15" transform="rotate(42 40 22)"/><path class="o" style="stroke-width:1.2;opacity:.6" d="M30 18l20 12M28 24l17 10M34 12l20 12M36 30l8-20M30 28l10-20M42 34l8-20"/><ellipse class="ts" style="stroke-width:4" cx="40" cy="22" rx="13" ry="17" transform="rotate(42 40 22)"/><circle class="y" style="fill:#d7f04a" cx="14" cy="17" r="7"/><path class="o" style="stroke:#fff8ec;stroke-width:1.6" d="M9 14c3 2 3 6 0 8M19 12c-3 2-3 8 0 10"/>`,
  },
  sneaker: {
    tint: '#4cc3ff',
    svg: `<path class="t" d="M5 45c0-7 2-15 5-19 6 2 12 1 16-4l11 10c6 2 18 4 22 10v4H5z"/><path class="d nf" d="M6 38c4 0 10 1 14 4l-1 4H6z"/><path class="p" d="M5 45h54v6a3 3 0 0 1-3 3H8a3 3 0 0 1-3-3z"/><path class="o" d="M27 26l-4 4M31 29.5l-4 4M35 33l-4 4"/><path class="o" style="stroke-dasharray:2 3" d="M8 49h48"/>`,
  },
  tent: {
    tint: '#ff8a5b',
    svg: `<path class="t" d="M3 54L31 12l30 42z"/><path class="d nf" d="M31 12l-4 42h-6z"/><path class="k" d="M31 27l-8 27h16z"/><path class="o" d="M31 12V6M3 54h58"/><path class="o" d="M31 27l-6 0" style="opacity:0"/><path class="y" d="M43 8l2 3 3 .5-2 2 .5 3-3-1.5-3 1.5.5-3-2-2 3-.5z"/>`,
  },
  skate: {
    tint: '#a68bff',
    svg: `<path class="t" d="M4 28c3 4 7 7 13 7h30c6 0 10-3 13-7l-1 6c-3 5-7 7-12 7H17c-5 0-9-2-12-7z"/><path class="y nf" d="M22 36h20v3H22z"/><path class="g" d="M15 41h10v4H15zM39 41h10v4H39z"/><circle class="y" cx="17" cy="50" r="5"/><circle class="y" cx="47" cy="50" r="5"/><circle class="k nf" cx="17" cy="50" r="1.6"/><circle class="k nf" cx="47" cy="50" r="1.6"/>`,
  },
  guitar: {
    tint: '#d9954a',
    svg: `${F('M33 31L52 9', 4)}<path class="c" d="M50 4l9 1 1 8-5 2-7-6z"/>${U(['<circle cx="21" cy="45" r="13"/>', '<circle cx="31" cy="34" r="9.5"/>'], 't')}<circle class="c" cx="25" cy="40" r="4.5"/><path class="c" d="M14 50l7-7 3 3-7 7z"/><path class="o" style="stroke-width:1;opacity:.7" d="M18 51l31-38M19.5 52.5l31-38"/>`,
  },
  piano: {
    tint: '#1b1626',
    svg: `<rect class="t" x="3" y="20" width="58" height="13" rx="2"/><rect class="p" x="5" y="30" width="54" height="13"/><path class="o" style="stroke-width:1.5" d="M11.8 30v13M18.6 30v13M25.4 30v13M32.2 30v13M39 30v13M45.8 30v13M52.6 30v13"/><path class="k nf" d="M9.8 30h4v7h-4zM16.6 30h4v7h-4zM30.2 30h4v7h-4zM37 30h4v7h-4zM43.8 30h4v7h-4z"/><circle class="b" cx="10" cy="25" r="1.6"/><circle class="r" cx="15" cy="25" r="1.6"/>${K('M9 43v14M55 43v14M9 51h46', 3.5)}`,
  },
  grandpiano: {
    tint: '#1b1626',
    svg: `<path class="t" d="M9 31L42 9l3 4-31 21z"/>${K('M33 31l3-15', 2.5)}<path class="t" d="M5 31h29c6 0 10-6 17-6 6 0 10 3 10 7s-4 9-10 9H5z"/><path class="h" d="M38 30c4-2 8-2 12-1"/><path class="p" d="M5 41h17v6H5z"/><path class="o" style="stroke-width:1.2" d="M9 41v6M13 41v6M17 41v6"/>${K('M9 47v11M51 41v17M31 41v11', 3.5)}<path class="y" d="M28 52h7v3h-7z"/>`,
  },
  yogamat: {
    tint: '#a68bff',
    svg: `<rect class="t" x="6" y="21" width="42" height="22" rx="11"/><path class="l" d="M6 43h40v8H8z"/><circle class="l" cx="47" cy="32" r="11"/><path class="o" d="M47 32m-6 0a6 6 0 1 0 6-6a3 3 0 0 0-3 3"/><path class="k nf" d="M20 21h5v22h-5z"/>`,
  },
  dumbbell: {
    tint: '#ff5a4e',
    svg: `<rect class="g" x="18" y="29" width="28" height="6" rx="2"/><rect class="t" x="10" y="16" width="9" height="32" rx="3"/><rect class="t" x="45" y="16" width="9" height="32" rx="3"/><rect class="k" x="4" y="22" width="7" height="20" rx="2"/><rect class="k" x="53" y="22" width="7" height="20" rx="2"/><path class="h" d="M13 21v8M48 21v8"/>`,
  },
  boardgame: {
    tint: '#3ee6a8',
    svg: `<rect class="t" x="5" y="20" width="40" height="32" rx="3"/><path class="d nf" d="M6.3 44h37.4v6.7H6.3z"/><rect class="p" x="10" y="25" width="30" height="14" rx="2"/><path class="y" d="M18 32l3-5 3 5-3 5zM28 32l3-5 3 5-3 5z"/><rect class="p" x="36" y="34" width="20" height="20" rx="4" transform="rotate(12 46 44)"/><circle class="k nf" cx="42" cy="40" r="2"/><circle class="k nf" cx="49" cy="46" r="2"/><circle class="k nf" cx="45.5" cy="43" r="2"/><path class="r" d="M50 26l3-9h4l3 9z"/><circle class="r" cx="55" cy="13" r="4"/>`,
  },
  puzzle: {
    tint: '#ffc93c',
    svg: `<path class="b" d="M32 8h18v12a4.5 4.5 0 1 0 0 9v12H32" transform="rotate(8 40 24)"/><path class="t" d="M10 20h12a5 5 0 1 1 10 0h12v12a5 5 0 1 0 0 10v12H32a5 5 0 1 1-10 0H10V42a5 5 0 1 0 0-10z"/><path class="h" d="M14 26v6"/>`,
  },
  scooter: {
    tint: '#4cc3ff',
    svg: `${F('M46 48L40 9', 3.5)}${K('M33 9h14', 4)}<path class="k" d="M10 43h36l2 6H10z"/><circle class="t" cx="14" cy="52" r="6"/><circle class="t" cx="48" cy="52" r="6"/><circle class="k nf" cx="14" cy="52" r="2"/><circle class="k nf" cx="48" cy="52" r="2"/><rect class="y" x="41" y="16" width="5" height="4" rx="1"/>`,
  },
  fishing: {
    tint: '#ff5a4e',
    svg: `${F('M8 56L53 7', 3)}<path class="o" style="stroke-width:1.4" d="M53 7v31"/><path class="o" style="stroke-width:2" d="M53 38a3 3 0 1 1-3 3"/><circle class="g" cx="19" cy="44" r="6"/><circle class="k nf" cx="19" cy="44" r="2"/><path class="b" d="M30 52c5-6 14-6 18 0-4 6-13 6-18 0zM30 52l-6-5v10z"/><circle class="k nf" cx="43" cy="51" r="1.2"/>`,
  },
  kayak: {
    tint: '#ffc93c',
    svg: `${F('M14 18l38 28', 3)}<ellipse class="r" cx="12" cy="16" rx="6" ry="3.5" transform="rotate(37 12 16)"/><ellipse class="r" cx="54" cy="47" rx="6" ry="3.5" transform="rotate(37 54 47)"/><path class="t" d="M5 52C14 32 38 14 59 10 53 30 28 47 5 52z"/><ellipse class="k" cx="32" cy="31" rx="8" ry="4.5" transform="rotate(-36 32 31)"/><path class="h" d="M14 44c8-8 18-16 30-22"/>`,
  },
  skis: {
    tint: '#ff5a4e',
    svg: `${F('M10 58L36 10q2-4 6-3', 4.5)}${F('M24 58L50 10q2-4 6-3', 4.5)}<rect class="k" x="18" y="34" width="9" height="6" rx="1.5" transform="rotate(-61 22 37)"/><rect class="k" x="32" y="34" width="9" height="6" rx="1.5" transform="rotate(-61 36 37)"/>`,
  },
  book: {
    tint: '#4cc3ff',
    svg: `<path class="t" d="M14 6h32a4 4 0 0 1 4 4v42H18a4 4 0 0 1-4-4z"/><path class="p" d="M18 46h32v10H18a5 5 0 0 1 0-10z"/><path class="o" style="stroke-width:1.2" d="M22 50h26M22 53h26"/><rect class="y" x="23" y="15" width="20" height="7" rx="1"/><path class="d nf" d="M15.3 7.3h4v38h-4z"/>`,
  },
  surf: {
    tint: '#4cc3ff',
    svg: `<path class="t" d="M12 56C7 41 29 11 52 6c5 15-18 45-40 50z"/><path class="y nf" d="M14 52C16 40 32 18 48 10c-2 2-26 32-34 42z"/><path class="o" d="M14 52C22 36 36 20 49 9"/><path class="k" d="M18 46l-6-2 2 6z"/>`,
  },
  phone: {
    tint: '#4a5878',
    svg: `<rect class="t" x="17" y="3" width="30" height="58" rx="7"/><rect class="s" x="20.5" y="8" width="23" height="46" rx="3"/><rect class="k nf" x="28" y="10" width="8" height="2.5" rx="1.2"/><rect class="r nf" x="23.5" y="18" width="7" height="7" rx="2"/><rect class="y nf" x="33.5" y="18" width="7" height="7" rx="2"/><rect class="b nf" x="23.5" y="28" width="7" height="7" rx="2"/><rect class="n nf" x="33.5" y="28" width="7" height="7" rx="2"/><path class="h" d="M24 46l8-8"/>`,
  },
  laptop: {
    tint: '#c9d1e0',
    svg: `<rect class="t" x="11" y="9" width="42" height="30" rx="3"/><rect class="s" x="14.5" y="12.5" width="35" height="23"/><path class="b nf" d="M18 17h14v2H18zM18 22h22v2H18zM18 27h10v2H18z"/><path class="t" d="M3 41h58l-5 9H8z"/><path class="o" d="M27 45h10"/>`,
  },
  console: {
    tint: '#2b3350',
    svg: `<path class="t" d="M17 21h30c7 0 11 9 11 20 0 7-7 9-11 4l-6-6H23l-6 6c-4 5-11 3-11-4 0-11 4-20 11-20z"/>${K('M18 27v10M13 32h10', 3.5)}<circle class="r" cx="44" cy="28" r="2.6"/><circle class="b" cx="49" cy="32" r="2.6"/><circle class="y" cx="39" cy="32" r="2.6"/><circle class="n" cx="44" cy="36" r="2.6"/><path class="g" d="M28 28h8v3h-8z"/>`,
  },
  handheld: {
    tint: '#a68bff',
    svg: `<rect class="t" x="3" y="17" width="58" height="30" rx="10"/><rect class="s" x="17" y="20" width="30" height="24" rx="2"/><path class="b nf" d="M20 38l6-6 4 4 5-7 9 9z"/><circle class="y nf" cx="40" cy="26" r="2.5"/><circle class="k" cx="10" cy="27" r="3.6"/><circle class="k" cx="53" cy="37" r="3.6"/><circle class="p" cx="53" cy="25" r="1.8"/><circle class="p" cx="10" cy="38" r="1.8"/>`,
  },
  headphones: {
    tint: '#2b3350',
    svg: `${F('M12 38v-8a20 20 0 0 1 40 0v8', 4.5)}<rect class="t" x="5" y="33" width="15" height="24" rx="6"/><rect class="t" x="44" y="33" width="15" height="24" rx="6"/><rect class="k" x="16" y="36" width="6" height="18" rx="2"/><rect class="k" x="42" y="36" width="6" height="18" rx="2"/><path class="h" d="M9 39v10"/>`,
  },
  earbuds: {
    tint: '#fff8ec',
    svg: `<rect class="p" x="11" y="28" width="42" height="29" rx="12"/><path class="o" d="M11 39h42"/><circle class="n" cx="32" cy="48" r="1.8"/><circle class="p" cx="23" cy="13" r="6"/><rect class="p" x="20.5" y="15" width="5" height="13" rx="2.5"/><circle class="p" cx="41" cy="13" r="6"/><rect class="p" x="38.5" y="15" width="5" height="13" rx="2.5"/><circle class="k nf" cx="24.5" cy="12" r="2"/><circle class="k nf" cx="39.5" cy="12" r="2"/>`,
  },
  tv: {
    tint: '#3ee6a8',
    svg: `<path class="k" d="M25 46l-4 9h22l-4-9z"/><rect class="k" x="3" y="9" width="58" height="38" rx="3"/><rect class="s" x="6.5" y="12.5" width="51" height="31"/><circle class="y nf" cx="45" cy="21" r="4.5"/><path class="t nf" d="M6.5 43.5l14-14 10 10 8-7 19 11z"/>`,
  },
  tablet: {
    tint: '#4cc3ff',
    svg: `<rect class="k" x="10" y="5" width="44" height="54" rx="6"/><rect class="s" x="14" y="10" width="36" height="44" rx="1.5"/><path class="t nf" d="M14 34c8-4 14 4 22 0s10-2 14 0v20H14z"/><circle class="y nf" cx="40" cy="20" r="4"/><path class="h" d="M18 16l6 0"/>`,
  },
  smartwatch: {
    tint: '#4cc3ff',
    svg: `<rect class="t" x="22" y="2" width="20" height="60" rx="6"/><rect class="k" x="16" y="16" width="32" height="32" rx="9"/><rect class="s" x="19.5" y="19.5" width="25" height="25" rx="6"/><path class="o" style="stroke:#3ee6a8;stroke-width:3" d="M24 35l4-6 4 8 3-5 5 0"/><rect class="k" x="47" y="26" width="4" height="7" rx="1.5"/>`,
  },
  watch: {
    tint: '#c9d1e0',
    svg: `<path class="d" d="M24 3h16v58H24z"/><circle class="t" cx="32" cy="32" r="17"/><rect class="t" x="48" y="29" width="5" height="6" rx="1.5"/><circle class="p" cx="32" cy="32" r="12.5"/><path class="o" style="stroke-width:2" d="M32 21.5v3M32 39.5v3M21.5 32h3M39.5 32h3"/><path class="o" style="stroke-width:2.5" d="M32 32v-8M32 32l6 4"/><circle class="k nf" cx="32" cy="32" r="1.8"/>`,
  },
  camera: {
    tint: '#1b1626',
    svg: `<path class="t" d="M20 18l4-7h15l4 7z"/><rect class="t" x="5" y="17" width="54" height="36" rx="6"/><rect class="y" x="46" y="12" width="8" height="5" rx="1.5"/><circle class="g" cx="32" cy="36" r="14"/><circle class="s" cx="32" cy="36" r="9"/><circle class="b nf" cx="32" cy="36" r="4"/><path class="h" d="M27 31a6 6 0 0 1 4-2"/><path class="d nf" d="M6.3 24h7v27.7h-7z"/>`,
  },
  speaker: {
    tint: '#ff8a5b',
    svg: `<rect class="t" x="15" y="6" width="34" height="52" rx="13"/><circle class="k" cx="32" cy="27" r="10"/><circle class="g" cx="32" cy="27" r="4"/><path class="d nf" d="M22 43h20v3H22zM22 48h20v3H22z"/><circle class="p" cx="32" cy="12.5" r="1.8"/>`,
  },
  mouse: {
    tint: '#c9d1e0',
    svg: `<path class="o" d="M32 8c0-4 6-4 6 0"/><rect class="t" x="17" y="9" width="30" height="48" rx="15"/><path class="o" d="M17 28h30M32 9v19"/><rect class="k" x="29.5" y="14" width="5" height="9" rx="2.5"/><path class="h" d="M22 34v12"/>`,
  },
  keyboard: {
    tint: '#ff5a4e',
    svg: `<rect class="k" x="3" y="18" width="58" height="29" rx="4"/>${[0, 1, 2]
      .map((r) => Array.from({ length: 9 }, (_, i) => `<rect class="${(r === 0 && i === 8) || (r === 1 && i === 0) ? 't' : 'p'} nf" x="${7 + i * 5.7}" y="${22 + r * 6.5}" width="4.4" height="4.6" rx="1"/>`).join(''))
      .join('')}<rect class="p nf" x="18" y="41.5" width="28" height="3.4" rx="1"/>`,
  },
  drone: {
    tint: '#ff5a4e',
    svg: `${K('M14 16l36 28M50 16L14 44', 4)}<ellipse class="g" cx="14" cy="15" rx="10" ry="3"/><ellipse class="g" cx="50" cy="15" rx="10" ry="3"/><ellipse class="g" cx="14" cy="45" rx="10" ry="3"/><ellipse class="g" cx="50" cy="45" rx="10" ry="3"/><rect class="t" x="23" y="23" width="18" height="14" rx="5"/><circle class="k" cx="32" cy="41" r="3.5"/><circle class="b nf" cx="32" cy="41" r="1.4"/>`,
  },
  printer: {
    tint: '#c9d1e0',
    svg: `<rect class="p" x="16" y="5" width="32" height="16"/><rect class="t" x="5" y="18" width="54" height="25" rx="4"/><circle class="n" cx="51" cy="25" r="2.2"/><path class="k" d="M13 37h38v4H13z"/><path class="p" d="M16 39h32v19H16z"/><path class="o" style="stroke-width:1.4" d="M20 45h20M20 49h24M20 53h14"/>`,
  },
  usb: {
    tint: '#ff5a4e',
    svg: `<rect class="g" x="24" y="4" width="16" height="15"/><rect class="k nf" x="27.5" y="8.5" width="3.5" height="3.5"/><rect class="k nf" x="33" y="8.5" width="3.5" height="3.5"/><rect class="t" x="20" y="17" width="24" height="41" rx="5"/><circle class="p" cx="32" cy="50" r="3"/><path class="h" d="M25 23v14"/>`,
  },
  monitor: {
    tint: '#4cc3ff',
    svg: `<path class="g" d="M27 42h10l2 11H25z"/><rect class="g" x="17" y="52" width="30" height="5" rx="2.5"/><rect class="k" x="3" y="7" width="58" height="36" rx="3"/><rect class="s" x="6.5" y="10.5" width="51" height="29"/><rect class="t nf" x="10" y="14" width="22" height="14" rx="1"/><rect class="p nf" x="35" y="14" width="19" height="9" rx="1"/><rect class="y nf" x="35" y="26" width="12" height="10" rx="1"/>`,
  },
  jeans: {
    tint: '#3b5ba5',
    svg: `<path class="t" d="M15 5h34l5 52H39L33 22h-2l-6 35H10z"/><path class="o" d="M15 12h34M32 12v10"/><path class="o" style="stroke:#ffc93c;stroke-width:1.6;stroke-dasharray:2 2" d="M18 15c1 5 4 7 8 7M46 15c-1 5-4 7-8 7"/><circle class="y" cx="32" cy="8.5" r="1.8"/>`,
  },
  tshirt: {
    tint: '#3ee6a8',
    svg: `<path class="t" d="M22 7L7 15l6 13 7-3v32h24V25l7 3 6-13-15-8c-2 5-6 7-10 7s-8-2-10-7z"/><path class="o" d="M22 7c2 5 6 7 10 7s8-2 10-7"/><path class="y" d="M32 28l2.6 5.2 5.7.8-4.1 4 1 5.7-5.2-2.7-5.1 2.7 1-5.7-4.1-4 5.7-.8z"/>`,
  },
  jacket: {
    tint: '#ff8a5b',
    svg: `<path class="t" d="M22 6l-12 6-5 43h13l2-27v30h24V28l2 27h13l-5-43-12-6-10 10z"/><path class="d" d="M22 6l10 22 10-22-10 9z"/><path class="o" d="M32 28v30"/><circle class="k nf" cx="35.5" cy="36" r="1.5"/><circle class="k nf" cx="35.5" cy="45" r="1.5"/><path class="o" d="M23 40h5"/>`,
  },
  backpack: {
    tint: '#ff8a5b',
    svg: `${K('M26 11a6 6 0 0 1 12 0', 3.5)}<path class="t" d="M13 23a12 12 0 0 1 12-12h14a12 12 0 0 1 12 12v31a4 4 0 0 1-4 4H17a4 4 0 0 1-4-4z"/><rect class="d" x="19" y="34" width="26" height="18" rx="4"/><path class="o" d="M19 41h26"/><rect class="y" x="30" y="38" width="4" height="6" rx="1"/><path class="h" d="M18 22v8"/>`,
  },
  sunglasses: {
    tint: '#ff5a4e',
    svg: `${F('M5 25h54', 3.5)}<path class="s" d="M8 25h21v9a9 9 0 0 1-9 9h-3a9 9 0 0 1-9-9z"/><path class="s" d="M35 25h21v9a9 9 0 0 1-9 9h-3a9 9 0 0 1-9-9z"/><path class="o" d="M29 28c2-2 4-2 6 0"/><path class="h" d="M12 30l5-3M39 30l5-3"/>`,
  },
  scarf: {
    tint: '#ff5a4e',
    svg: `<path class="t" d="M16 9c9 5 23 5 32 0v13c-9 5-23 5-32 0z"/><path class="t" d="M21 20h11l-2 32H18z"/><path class="d" d="M34 20h9l2 30H33z"/><path class="y nf" d="M17 13c9 4 21 4 30 0v3c-9 4-21 4-30 0zM20 32h11v3H20zM34 32h10v3H34z"/><path class="o" d="M19 52v5M23 52v5M27 52v5M35 50v5M39 50v5M43 50v5"/>`,
  },
  perfume: {
    tint: '#ff7aa8',
    svg: `<rect class="y" x="23" y="5" width="18" height="10" rx="2"/><rect class="g" x="27" y="15" width="10" height="8"/><rect class="l" x="12" y="22" width="40" height="36" rx="7"/><path class="t nf" d="M13.3 37h37.4v14a5.7 5.7 0 0 1-5.7 5.7H19a5.7 5.7 0 0 1-5.7-5.7z"/><rect class="p" x="22" y="33" width="20" height="10" rx="2"/><path class="h" d="M17 28v6"/>`,
  },
  cap: {
    tint: '#4cc3ff',
    svg: `<path class="t" d="M9 37a23 23 0 0 1 46 0z"/><path class="o" d="M32 14v23M20 18c3 6 4 13 4 19M44 18c-3 6-4 13-4 19"/><circle class="d" cx="32" cy="14" r="2.5"/><path class="d" d="M7 37h41c7 0 11 3 13 7H14c-5 0-7-3-7-7z"/><path class="y" d="M40 23l1.6 3.2 3.5.5-2.5 2.5.6 3.5-3.2-1.7-3.2 1.7.6-3.5-2.5-2.5 3.5-.5z"/>`,
  },
  boot: {
    tint: '#8a5a3b',
    svg: `<path class="t" d="M17 5h20v31l17 8c5 2 7 6 7 10v1H13l2-25z"/><path class="d nf" d="M18 6.3h18v6H18z"/><path class="o" d="M17 12h20"/><path class="k" d="M13 53h48v6H13z"/><circle class="y" cx="33" cy="20" r="1.5"/><circle class="y" cx="33" cy="27" r="1.5"/><path class="o" d="M33 20l-6 3M33 27l-6 3"/>`,
  },
  tie: {
    tint: '#ff5a4e',
    svg: `<path class="o" d="M20 4l12 6 12-6"/><path class="d" d="M26 8h12l-2 9h-8z"/><path class="t" d="M28 17h8l7 31-11 12-11-12z"/><path class="y nf" d="M29 22l8 6v4l-9-7zM27 33l11 8-1 4-11-8zM24 44l8 6-2 3-6-5z"/>`,
  },
  ring: {
    tint: '#c9d1e0',
    svg: `<ellipse class="o" style="stroke-width:10" cx="32" cy="42" rx="17" ry="15"/><ellipse class="ts" style="stroke-width:5.5" cx="32" cy="42" rx="17" ry="15"/><path class="t" d="M24 27l2-6h12l2 6z"/><path class="b" d="M22 14h20l5 7-15 12-15-12z"/><path class="o" style="stroke-width:1.5" d="M17 21h30M27 14l-3 7 8 12 8-12-3-7"/><path class="h" d="M25 17l3 0"/>`,
  },
  car: {
    tint: '#ff5a4e',
    svg: `<path class="t" d="M5 43v-9c0-3 2-5 5-6l9-2 7-8c2-2 4-3 7-3h9c3 0 6 1 8 3l6 8c4 1 7 3 7 7v10z"/><path class="b" d="M24 26l5-6c1-1 2-2 4-2h4v8zM41 18h2c2 0 3 1 4 2l5 6H41z"/><circle class="k" cx="18" cy="45" r="7"/><circle class="g" cx="18" cy="45" r="3"/><circle class="k" cx="47" cy="45" r="7"/><circle class="g" cx="47" cy="45" r="3"/><path class="y" d="M55 31h4v4h-4z"/><path class="o" d="M33 30h4"/>`,
  },
  moto: {
    tint: '#3ee6a8',
    svg: `${F('M47 47L42 17', 3.5)}${K('M37 15h11', 4)}<path class="t" d="M12 41c0-7 4-11 11-11h10l5 11h11c4 0 6 2 6 6H12z"/><rect class="k" x="16" y="25" width="17" height="6" rx="3"/><circle class="k" cx="17" cy="49" r="7"/><circle class="g" cx="17" cy="49" r="2.5"/><circle class="k" cx="48" cy="49" r="7"/><circle class="g" cx="48" cy="49" r="2.5"/><circle class="y" cx="45" cy="23" r="3"/>`,
  },
  handbag: {
    tint: '#c43a50',
    svg: `${K('M21 26v-6a11 11 0 0 1 22 0v6', 4.5)}<path class="t" d="M9 26h46l-4 31H13z"/><path class="d" d="M9 26h46l-7 13H16z"/><rect class="y" x="28.5" y="34" width="7" height="7" rx="1.5"/><path class="h" d="M15 44l-1 8"/>`,
  },
  hottub: {
    tint: '#4cc3ff',
    svg: `<path class="o" d="M20 16c-3-4 3-6 0-10M32 16c-3-4 3-6 0-10M44 16c-3-4 3-6 0-10"/><path class="w" d="M4 31h56v20a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5z"/><path class="o" d="M16 37v18M28 37v19M40 37v19M52 37v18"/><ellipse class="c" cx="32" cy="31" rx="28" ry="8"/><ellipse class="t" cx="32" cy="31" rx="23" ry="5.5"/><circle class="p" cx="22" cy="30" r="1.6"/><circle class="p" cx="38" cy="32" r="1.6"/><circle class="p" cx="31" cy="29" r="1.2"/>`,
  },
  plane: {
    tint: '#4cc3ff',
    svg: `<circle class="y" cx="16" cy="16" r="10"/><path class="t" d="M29 31L12 22l-6 3 16 14z"/><path class="t" d="M37 37l9 18 4-3-5-18z"/><path class="p" d="M10 52L51 14c3-3 8-1 5 3L19 57z"/><path class="t" d="M10 52l-3-9 4-2 5 6z"/><circle class="b nf" cx="40" cy="25" r="1.4"/><circle class="b nf" cx="35" cy="30" r="1.4"/><circle class="b nf" cx="30" cy="34.5" r="1.4"/>`,
  },
  truffle: {
    tint: '#4a3426',
    svg: `<path class="n" d="M44 18c4-8 12-9 15-6-3 6-10 8-15 6z"/><path class="t" d="M12 37c-2-10 6-18 16-18 4-4 12-2 14 2 8 0 13 8 11 14 4 6 0 14-8 14-4 4-12 4-16 0-8 2-17-4-17-12z"/><circle class="k nf" cx="22" cy="30" r="1.4"/><circle class="k nf" cx="34" cy="27" r="1.4"/><circle class="k nf" cx="44" cy="35" r="1.4"/><circle class="k nf" cx="27" cy="42" r="1.4"/><circle class="k nf" cx="38" cy="45" r="1.4"/><path class="h" style="opacity:.35" d="M18 32c1-4 4-7 8-8"/>`,
  },
  wine: {
    tint: '#8a1c3a',
    svg: `<path class="k" d="M27 4h10v14c6 4 9 8 9 14v23a4 4 0 0 1-4 4H22a4 4 0 0 1-4-4V32c0-6 3-10 9-14z"/><rect class="t" x="27" y="4" width="10" height="10"/><rect class="p" x="20" y="34" width="24" height="15" rx="1"/><path class="y" d="M28 38h8l-1 6h-6z"/><path class="h" d="M23 24c-1 2-2 4-2 6"/>`,
  },
  gnome: {
    tint: '#4cc3ff',
    svg: `<path class="t" d="M17 46c0-5 5-8 9-8h12c4 0 9 3 9 8v13H17z"/><path class="k" d="M17 56h13v4H17zM34 56h13v4H34z"/><circle class="f" cx="32" cy="27" r="9"/><path class="p" d="M21 29c0 11 5 19 11 19s11-8 11-19c-3 3-7 4-11 4s-8-1-11-4z"/><path class="r" d="M20 25L31 2l14 23c-4 2-9 3-13 3s-9-1-12-3z"/><circle class="f" cx="32" cy="30" r="3.4"/><circle class="k nf" cx="28" cy="26" r="1.3"/><circle class="k nf" cx="36" cy="26" r="1.3"/>`,
  },
  jukebox: {
    tint: '#ff5a4e',
    svg: `<path class="t" d="M11 31a21 21 0 0 1 42 0v28H11z"/><path class="o" style="stroke:#ffc93c;stroke-width:3" d="M15 31a17 17 0 0 1 34 0"/><path class="s" d="M19 32a13 13 0 0 1 26 0v6H19z"/><circle class="k" cx="32" cy="32" r="6"/><circle class="y nf" cx="32" cy="32" r="1.8"/><rect class="d" x="17" y="42" width="30" height="13" rx="2"/><path class="o" style="stroke-width:1.5" d="M17 46h30M17 50h30"/>`,
  },
  cottoncandy: {
    tint: '#ff9ec7',
    svg: `${K('M32 32v28', 3.5)}<path class="t" d="M14 26c-4-8 4-17 11-14 2-7 15-7 17 0 7-3 15 6 11 14 3 7-4 13-11 11-4 4-13 4-17 0-7 2-14-4-11-11z"/><path class="l nf" d="M22 20c3-4 8-4 10-1-3 1-6 2-10 1zM38 28c3-2 7-1 8 2-3 1-6 0-8-2z"/>`,
  },
  pinball: {
    tint: '#a68bff',
    svg: `<rect class="d" x="15" y="3" width="34" height="19" rx="2"/><rect class="s" x="19" y="7" width="26" height="11" rx="1"/><path class="y nf" d="M23 10h18v2H23zM26 14h12v2H26z"/><path class="t" d="M15 21h34l9 27H6z"/><circle class="r" cx="25" cy="29" r="3.5"/><circle class="r" cx="39" cy="29" r="3.5"/><circle class="y" cx="32" cy="35" r="3"/><circle class="g" cx="36" cy="41" r="2"/><path class="y" d="M19 44l7 2-7 0zM45 44l-7 2 7 0z"/>${K('M10 48v10M54 48v10', 3.5)}`,
  },
  caviar: {
    tint: '#4cc3ff',
    svg: `<ellipse class="t" cx="32" cy="17" rx="22" ry="8"/><path class="b nf" d="M24 17c4-3 12-3 16 0-4 3-12 3-16 0z" style="fill:#fff8ec"/><path class="g" d="M8 34v7c0 5 11 9 24 9s24-4 24-9v-7"/><ellipse class="k" cx="32" cy="34" rx="24" ry="9"/>${Array.from({ length: 9 }, (_, i) => `<circle class="g nf" cx="${18 + (i % 5) * 7 + (i > 4 ? 3.5 : 0)}" cy="${i > 4 ? 37 : 32}" r="1.4"/>`).join('')}`,
  },
  armchair: {
    tint: '#3b4a6b',
    svg: `<rect class="t" x="15" y="5" width="34" height="32" rx="9"/><circle class="d" cx="25" cy="15" r="2.5"/><circle class="d" cx="39" cy="15" r="2.5"/><circle class="d" cx="25" cy="25" r="2.5"/><circle class="d" cx="39" cy="25" r="2.5"/><rect class="l" x="13" y="34" width="38" height="11" rx="4"/><rect class="d" x="7" y="26" width="10" height="23" rx="4"/><rect class="d" x="47" y="26" width="10" height="23" rx="4"/><path class="t" d="M19 49h26l-4 9H23z"/><rect class="k" x="49" y="31" width="6" height="4" rx="1"/>`,
  },
  balloon: {
    tint: '#ff5a4e',
    svg: `<path class="t" d="M32 3C18 3 9 13 9 24c0 10 10 18 17 23h12c7-5 17-13 17-23C55 13 46 3 32 3z"/><path class="y nf" d="M32 3c-6 6-9 14-9 21s4 17 4 23h10c0-6 4-16 4-23S38 9 32 3z"/><path class="o" d="M32 3c-6 6-9 14-9 21s4 17 4 23M32 3c6 6 9 14 9 21s-4 17-4 23"/><path class="o" d="M27 47l1 6M37 47l-1 6"/><rect class="w" x="26" y="52" width="12" height="9" rx="1.5"/>`,
  },
};

/** SVG d'un objet, teinté selon la fiche (ou la teinte par défaut de l'illustration). */
export function itemSVG(item, { className = 'jp-ico', label } = {}) {
  const a = ART[item.icon] ?? ART.bottle;
  const tint = item.tint ?? a.tint;
  const aria = label ? `role="img" aria-label="${label}"` : 'aria-hidden="true"';
  return `<svg class="${className}" viewBox="0 0 64 64" style="--tint:${tint}" ${aria} focusable="false">${a.svg}</svg>`;
}
