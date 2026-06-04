/**
 * public/ambush.html — « Du Sang Sur la Route » (EiO ch.2), scène isométrique
 * ANIMÉE, fidèle à la source : forêt, diligence renversée + 2 chevaux dans le
 * harnais, mutant musclé tête-minuscule à la hache, chien-tête blessé qui hurle,
 * mutant ogive qui le bande, mutant pieds-fourchus dévorant un corps, Knud
 * Cratinx (écailleux, arbalète), corps de Kastor + parchemin. Un Tueur arrive.
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const TW = 60, TH = 30, OX = 480, OY = 60;
const iso = (x, y) => [OX + (x - y) * TW, OY + (x + y) * TH];

const diamond = (x, y, fill) => {
  const [cx, cy] = iso(x, y);
  return `<path d="M${cx},${cy} l${TW},${TH} l${-TW},${TH} l${-TW},${-TH} z" fill="${fill}" stroke="rgba(0,0,0,0.18)"/>`;
};
const shadow = (x, y, rx = 24) => {
  const [cx, cy] = iso(x, y);
  return `<ellipse cx="${cx}" cy="${cy + TH}" rx="${rx}" ry="${rx / 2}" fill="#000" opacity="0.4"/>`;
};
const bloodPool = (x, y, rx = 28) => {
  const [cx, cy] = iso(x, y);
  return `<ellipse cx="${cx}" cy="${cy + TH + 3}" rx="${rx}" ry="${rx / 2.4}" fill="url(#blood)"/><ellipse cx="${cx + rx * 0.45}" cy="${cy + TH}" rx="${rx * 0.4}" ry="${rx * 0.16}" fill="url(#blood)"/>`;
};
function bloodTrail(x0, y0, x1, y1, n = 7) {
  let s = '';
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1), x = x0 + (x1 - x0) * t, y = y0 + (y1 - y0) * t;
    const [cx, cy] = iso(x, y), r = 12 - i * 1.1 + (i % 2) * 3;
    s += `<ellipse cx="${cx + (i % 2 ? 7 : -5)}" cy="${cy + TH + 5}" rx="${r}" ry="${r / 2.3}" fill="url(#blood)" opacity="${0.8 - t * 0.45}"/>`;
  }
  return s;
}
// place un sprite (boîte locale 120x150, pieds en (60,150)) sur la tuile
function put(inner, x, y, scale = 0.6, sh = 22) {
  const [cx, cy] = iso(x, y);
  return `${sh ? shadow(x, y, sh) : ''}<g transform="translate(${cx - 60 * scale},${cy + TH - 150 * scale}) scale(${scale})">${inner}</g>`;
}

// --- Forêt : pins isométriques --------------------------------------------
function tree(x, y, h = 1) {
  const [cx, cy] = iso(x, y);
  const s = 1 + h * 0.25;
  return `${shadow(x, y, 30 * s)}<g transform="translate(${cx},${cy + TH}) scale(${s})">
    <rect x="-7" y="-34" width="14" height="40" rx="3" fill="#4a3220"/>
    <path d="M0 -150 L40 -78 L14 -86 L46 -30 L-46 -30 L-14 -86 L-40 -78 Z" fill="#1d3d18"/>
    <path d="M0 -150 L40 -78 L14 -86 L46 -30 L0 -44 Z" fill="#2a5320"/>
    <path d="M0 -120 L28 -70 L0 -80 Z" fill="#327026" opacity="0.6"/>
  </g>`;
}

// --- Diligence renversée + parchemin --------------------------------------
function wheel(cx, cy, r) {
  let sp = '';
  for (let a = 0; a < 8; a++) { const rad = (a / 8) * Math.PI * 2; sp += `<line x1="${cx}" y1="${cy}" x2="${(cx + Math.cos(rad) * r).toFixed(1)}" y2="${(cy + Math.sin(rad) * r * 0.5).toFixed(1)}" stroke="#3a2a18" stroke-width="3"/>`; }
  return `<ellipse cx="${cx}" cy="${cy}" rx="${r}" ry="${r * 0.5}" fill="none" stroke="#241a10" stroke-width="6"/>${sp}`;
}
function coach(x, y) {
  const [cx, cy] = iso(x, y);
  return `<g transform="translate(${cx},${cy - 8})">
    <ellipse cx="0" cy="58" rx="118" ry="40" fill="#000" opacity="0.35"/>
    ${wheel(-108, 62, 32)}
    <g transform="rotate(-15)">
      <rect x="-92" y="-6" width="176" height="80" rx="14" fill="url(#coach)" stroke="#2a0e0e" stroke-width="3"/>
      <rect x="-92" y="-6" width="176" height="18" rx="9" fill="#7a2630"/>
      <rect x="-74" y="20" width="46" height="40" rx="6" fill="#39151a" stroke="#d8a93b" stroke-width="2"/>
      <rect x="-66" y="26" width="30" height="18" rx="3" fill="#15080a"/>
      <path d="M-92 34 h176 M-92 12 h176" stroke="#d8a93b" stroke-width="2" opacity="0.7"/>
      <circle cx="58" cy="38" r="9" fill="#d8a93b"/><circle cx="58" cy="38" r="5" fill="#5a3a10"/>
    </g>
    ${wheel(38, -36, 28)} ${wheel(92, -8, 24)}
    <g transform="translate(118 54)"><rect x="-15" y="-15" width="30" height="26" rx="3" fill="#7a5a32" stroke="#3a2a18" stroke-width="2"/></g>
  </g>`;
}

// --- Chevaux qui se débattent dans le harnais ----------------------------
function horse(x, y, flip) {
  const f = flip ? -1 : 1;
  const inner = `<g transform="translate(${flip ? 120 : 0},0) scale(${f},1)">
    <!-- queue -->
    <path d="M8 102 q-16 10 -10 32 q10 -6 14 -22z" fill="#1a1008"/>
    <!-- corps couché + croupe -->
    <ellipse cx="56" cy="116" rx="46" ry="23" fill="url(#horse)"/>
    <ellipse cx="24" cy="110" rx="20" ry="20" fill="url(#horse)"/>
    <!-- 4 pattes qui ruent (pivot à la hanche) -->
    <path class="kick"  style="transform-box:fill-box;transform-origin:50% 8%" d="M40 128 l-7 28 l9 2 l5 -26z" fill="#33210f"/>
    <path class="kick2" style="transform-box:fill-box;transform-origin:50% 8%" d="M28 130 l-14 22 l8 4 l10 -22z" fill="#241608"/>
    <path class="kick2" style="transform-box:fill-box;transform-origin:50% 8%" d="M74 126 l8 26 l9 -2 l-9 -26z" fill="#33210f"/>
    <path class="kick"  style="transform-box:fill-box;transform-origin:50% 8%" d="M86 124 l16 18 l6 -7 l-14 -18z" fill="#241608"/>
    <!-- encolure DRESSÉE (vivant, paniqué) + tête -->
    <path d="M90 106 Q116 90 114 58 Q112 42 98 44 Q94 66 82 92 Z" fill="url(#horse)"/>
    <path d="M110 56 Q124 48 130 36 Q120 36 108 50 Z" fill="url(#horse)"/>
    <path d="M100 38 l3 -11 l7 8z" fill="url(#horse)"/>
    <path d="M96 54 q7 -6 15 -6 M93 64 q7 -6 15 -6 M91 74 q7 -6 15 -6" stroke="#1a1008" stroke-width="3" fill="none"/>
    <ellipse cx="116" cy="50" rx="3" ry="4.5" fill="#0e0804"/><circle cx="117" cy="49" r="1.3" fill="#e8d0b0"/>
  </g>`;
  return put(inner, x, y, 0.6, 30);
}

// --- Mutants (fidèles à la source) ----------------------------------------
const legs = '<path d="M48 96 L42 150 L60 150 L60 100 Z" fill="url(#mutDark)"/><path d="M72 96 L82 150 L62 150 L62 100 Z" fill="url(#mutDark)"/>';
const eye = (cx, cyy, r = 4) => `<ellipse cx="${cx}" cy="${cyy}" rx="${r}" ry="${r + 1}" fill="url(#eye)"/><circle cx="${cx}" cy="${cyy}" r="1.5" fill="#1a1a08"/>`;

// 1) musclé, tête minuscule, à la hache (mutile les chevaux)
function mutantAxe(x, y) {
  const inner = `<path d="M48 100 L42 150 L58 150 L60 104 Z" fill="url(#mutDark)"/><path d="M74 100 L84 150 L66 150 L62 104 Z" fill="url(#mutDark)"/>
    <path d="M42 96 L38 122 L52 114 L60 124 L70 114 L80 122 L76 96 Z" fill="#544c32"/>
    <path d="M28 92 Q24 46 60 42 Q100 40 98 84 Q94 106 62 110 Q38 110 28 92 Z" fill="url(#mut)"/>
    <g fill="#2a3c18" opacity="0.7"><ellipse cx="46" cy="62" rx="6" ry="4"/><ellipse cx="72" cy="56" rx="7" ry="5"/><ellipse cx="86" cy="78" rx="6" ry="4"/><ellipse cx="58" cy="86" rx="8" ry="5"/><ellipse cx="38" cy="80" rx="5" ry="3"/></g>
    <circle cx="60" cy="40" r="10" fill="url(#mut)"/>${eye(56, 39, 2)}${eye(64, 39, 2)}
    <path d="M53 46 q7 5 14 0" stroke="#2a160f" stroke-width="2" fill="none"/>
    <g class="chop" style="transform-box:fill-box;transform-origin:62% 88%">
      <path d="M86 64 Q122 44 120 4" stroke="url(#mut)" stroke-width="16" fill="none" stroke-linecap="round"/>
      <g transform="translate(120 2)"><rect x="-3" y="-16" width="6" height="42" fill="#4a2f17"/><path d="M-22 -16 q26 -10 26 18 q-26 0 -26 -18z" fill="url(#axe)" stroke="#2a3038"/><path d="M-6 24 l10 8" stroke="#7a1a1a" stroke-width="2"/></g>
    </g>`;
  return put(inner, x, y, 0.66, 28);
}
// 2) chien-tête, blessé, hurle à la mort (Rolf)
function mutantDog(x, y) {
  const inner = `<g transform="rotate(6)">
    <!-- torse au sol -->
    <ellipse cx="60" cy="120" rx="40" ry="20" fill="url(#mut)"/>
    <g fill="#2a3c18" opacity="0.6"><ellipse cx="50" cy="116" rx="6" ry="4"/><ellipse cx="72" cy="122" rx="6" ry="4"/></g>
    <!-- jambes -->
    <path d="M46 132 l-16 16 M58 136 l-10 18" stroke="url(#mutDark)" stroke-width="10" stroke-linecap="round"/>
    <!-- jambe blessée + sang qui gicle -->
    <path d="M76 130 l24 6" stroke="url(#mutDark)" stroke-width="11" stroke-linecap="round"/>
    <path class="gush" d="M100 134 q12 -2 20 8 q-10 4 -20 -2z" fill="url(#blood)"/>
    <!-- bras tendu -->
    <path d="M46 112 l-18 -4" stroke="url(#mut)" stroke-width="8" stroke-linecap="round"/>
    <!-- COU + tête de chien qui hurle (rattachés au torse) -->
    <g class="howl" style="transform-box:fill-box;transform-origin:46% 92%">
      <path d="M50 116 Q42 96 48 80 L66 80 Q72 98 64 116 Z" fill="url(#mut)"/>
      <path d="M38 78 Q42 58 60 58 Q78 60 76 80 Q72 92 56 92 Q42 90 38 78 Z" fill="url(#mut)"/>
      <path d="M34 72 Q20 64 12 52 Q26 52 38 64 Z" fill="url(#mut)"/>
      <ellipse cx="16" cy="54" rx="5" ry="7" fill="#140a06"/>
      <path d="M40 58 l-5 -16 l13 9 z" fill="url(#mut)"/><path d="M64 56 l6 -16 l9 12 z" fill="url(#mut)"/>
      ${eye(52, 72, 2.5)}
    </g>
  </g>`;
  return put(inner, x, y, 0.62, 30);
}
// 3) tête en ogive, bande la jambe du chien-tête
function mutantOgive(x, y) {
  const inner = `${legs}
    <path d="M40 72 Q60 56 84 72 Q92 96 84 112 Q60 120 44 112 Q34 96 40 72 Z" fill="url(#mut)"/>
    <path d="M48 56 Q62 16 76 56 Q70 72 62 74 Q54 72 48 56 Z" fill="url(#mut)"/>${eye(56, 52, 2.5)}${eye(68, 52, 2.5)}
    <path d="M82 84 Q112 92 120 112" stroke="url(#mut)" stroke-width="10" fill="none" stroke-linecap="round"/>
    <path d="M40 84 Q16 92 12 110" stroke="url(#mut)" stroke-width="9" fill="none" stroke-linecap="round"/>
    <path class="wrap" d="M108 108 q12 6 16 14 q-10 4 -18 -2" stroke="#e8e0d0" stroke-width="6" fill="none" stroke-linecap="round"/>`;
  return put(inner, x, y, 0.6, 26);
}
// 4) pieds fourchus, dévore un cadavre
function mutantHoof(x, y) {
  const inner = `<g class="feed" style="transform-box:fill-box;transform-origin:50% 95%">
    <path d="M46 100 L40 138 L52 150 L58 104 Z" fill="url(#mutDark)"/><path d="M70 100 L82 138 L70 150 L62 104 Z" fill="url(#mutDark)"/>
    <path d="M40 134 l-8 8 l12 2 M82 134 l8 8 l-12 2" fill="#1a120a"/>
    <path d="M38 96 L34 122 L50 114 L58 126 L66 114 L74 122 L70 96 Z" fill="#544c32"/>
    <path d="M28 96 Q22 48 60 42 Q104 38 100 84 Q96 110 64 112 Q40 112 28 96 Z" fill="url(#mut)"/>
    <g fill="#2a3c18" opacity="0.7"><ellipse cx="48" cy="62" rx="7" ry="5"/><ellipse cx="74" cy="56" rx="7" ry="5"/><ellipse cx="86" cy="78" rx="6" ry="4"/><ellipse cx="58" cy="88" rx="9" ry="5"/><ellipse cx="38" cy="80" rx="5" ry="4"/></g>
    <path d="M90 70 Q112 88 102 112" stroke="url(#mut)" stroke-width="20" fill="none" stroke-linecap="round"/>
    <path d="M102 112 l-4 12 m4 -12 l9 8" stroke="#cdd9a0" stroke-width="3.5" stroke-linecap="round"/>
    <circle cx="40" cy="72" r="12" fill="url(#mut)"/>${eye(35, 70, 2.5)}${eye(45, 70, 2.5)}
    <path d="M33 80 q7 5 14 0" stroke="#2a160f" stroke-width="2.5" fill="none"/>
  </g>
  <ellipse cx="86" cy="138" rx="28" ry="12" fill="url(#blood)"/>
  <path d="M64 136 l34 -4 l-4 12 z" fill="#54331f"/><circle cx="102" cy="130" r="8" fill="#cdb89a"/>`;
  return put(inner, x, y, 0.66, 32);
}
// 5) Knud Cratinx — peau écailleuse, arbalète chargée, inspecte les corps
function knud(x, y) {
  const inner = `<path d="M48 96 L44 150 L60 150 L60 100 Z" fill="#3a4a2a"/><path d="M72 96 L80 150 L62 150 L62 100 Z" fill="#33421f"/>
    <path d="M40 64 Q60 48 84 64 Q92 90 84 112 Q60 122 44 112 Q32 90 40 64 Z" fill="url(#scale)"/>
    <path d="M52 76 l-6 18 M70 72 l6 20 M60 94 l-4 16" stroke="#243a18" stroke-width="2" opacity="0.6" fill="none"/>
    <g fill="#2f4a22" opacity="0.6"><circle cx="52" cy="80" r="2.5"/><circle cx="70" cy="84" r="2.5"/><circle cx="60" cy="100" r="2.5"/></g>
    <!-- bras droit levé qui épaule l'arbalète -->
    <path d="M82 78 Q92 90 86 100" stroke="url(#scale)" stroke-width="9" fill="none" stroke-linecap="round"/>
    <!-- ARBALÈTE épaulée : fût vertical, arc courbé + corde + carreau + étrier -->
    <g transform="translate(86 100)">
      <rect x="-4" y="-94" width="8" height="98" rx="2" fill="#5a3a1c"/>
      <rect x="-4" y="-46" width="8" height="9" fill="#33220f"/>
      <path d="M-42 -86 Q0 -100 42 -86" fill="none" stroke="#2a1c12" stroke-width="6" stroke-linecap="round"/>
      <line x1="-40" y1="-85" x2="40" y2="-85" stroke="#d8cdb0" stroke-width="2.2"/>
      <line x1="0" y1="-85" x2="0" y2="-48" stroke="#cfd6df" stroke-width="2.6"/>
      <path d="M0 -85 l-4 9 l8 0 z" fill="#9aa6b8"/>
      <path d="M-6 4 q6 10 12 0" fill="none" stroke="#33220f" stroke-width="4"/>
    </g>
    <circle cx="62" cy="46" r="13" fill="url(#scale)"/>${eye(57, 45, 3)}${eye(69, 45, 3)}
    <path d="M55 52 q8 5 14 0" stroke="#1a2410" stroke-width="2" fill="none"/>
    <g stroke="#243a18" stroke-width="1.4" opacity="0.7" fill="none"><path d="M55 40 l5 6 M68 40 l-3 7 M62 52 l3 6"/></g>`;
  return put(inner, x, y, 0.66, 28);
}

// --- Cadavres -------------------------------------------------------------
function corpse(x, y, rot, clothes, hat, parchment) {
  const [cx, cy] = iso(x, y);
  return `${bloodPool(x, y, 28)}<g transform="translate(${cx},${cy + TH}) rotate(${rot})">
    <path d="M0 0 L34 -10 M0 0 L30 16" stroke="${clothes}" stroke-width="11" stroke-linecap="round"/>
    <path d="M32 -11 l10 -3 M28 17 l9 5" stroke="#241a12" stroke-width="7" stroke-linecap="round"/>
    <path d="M-6 -2 L-30 -16 M-6 2 L-26 18" stroke="${clothes}" stroke-width="8" stroke-linecap="round"/>
    <path d="M-30 -16 l-8 -2 M-26 18 l-8 3" stroke="#e2b48c" stroke-width="5" stroke-linecap="round"/>
    <ellipse cx="-2" cy="0" rx="20" ry="13" fill="${clothes}"/><ellipse cx="-2" cy="0" rx="20" ry="13" fill="url(#deadShade)"/>
    ${parchment ? '<rect x="-4" y="-8" width="20" height="14" rx="1" fill="#e8dcb0" transform="rotate(-18 6 -1)"/><path d="M-2 -6 h12 M-2 -2 h10" stroke="#9a8" stroke-width="0.8"/><path d="M2 4 l6 -2" stroke="#7a1a1a" stroke-width="2"/>' : ''}
    <circle cx="-24" cy="-2" r="10" fill="#cdb89a"/>
    ${hat ? '<path d="M-36 -6 q12 -10 22 0 z" fill="#2a1d12"/><ellipse cx="-25" cy="-6" rx="15" ry="4" fill="#2a1d12"/>' : ''}
  </g>`;
}

// --- Tueur nain (arrive, animé) -------------------------------------------
function slayer(x, y) {
  const inner = `<g class="breathe" style="transform-box:fill-box;transform-origin:50% 96%">
    <path d="M44 96 L38 148 L56 148 L58 100 Z" fill="#5a3f28"/><path d="M70 96 L78 148 L60 148 L60 100 Z" fill="#4c3520"/>
    <path d="M36 150 h22 l2 6 h-26z" fill="#241a12"/><path d="M80 150 h-22 l-2 6 h26z" fill="#1c140e"/>
    <path d="M40 80 Q60 70 80 80 L84 100 Q60 108 36 100 Z" fill="#6b4a2b"/>
    <path d="M34 50 Q60 38 86 50 Q92 74 82 92 Q60 100 38 92 Q28 74 34 50 Z" fill="url(#flesh)"/>
    <path d="M46 58 q8 8 0 18 M74 58 q-8 8 0 18 M60 54 v34" stroke="#2f6db0" stroke-width="2.4" fill="none" opacity="0.85"/>
    <path d="M36 56 Q16 70 12 46" stroke="url(#flesh)" stroke-width="11" fill="none" stroke-linecap="round"/>
    <path d="M84 56 Q104 70 108 46" stroke="url(#flesh)" stroke-width="11" fill="none" stroke-linecap="round"/>
    <g transform="translate(6 18) rotate(-18)"><rect x="-2" y="0" width="4" height="40" fill="#4a2f17"/><path d="M-16 0 q16 -14 16 14 q-16 -2 -16 -14z" fill="url(#axe)" stroke="#2a3038"/></g>
    <g transform="translate(108 18) rotate(18) scale(-1,1)"><rect x="-2" y="0" width="4" height="40" fill="#4a2f17"/><path d="M-16 0 q16 -14 16 14 q-16 -2 -16 -14z" fill="url(#axe)" stroke="#2a3038"/></g>
    <circle cx="60" cy="34" r="15" fill="#f0c49a"/>
    <path d="M46 38 Q60 80 74 38 Q66 56 60 58 Q54 56 46 38 Z" fill="#c43f0a"/>
    <path d="M60 -2 Q55 18 60 22 Q65 18 60 -2 Z" fill="url(#crest)"/>
    <path d="M50 6 Q48 20 56 22 M70 6 Q72 20 64 22" stroke="url(#crest)" stroke-width="6" fill="none" stroke-linecap="round"/>
    ${eye(54, 34, 1.6)}${eye(66, 34, 1.6)}
  </g>`;
  return put(inner, x, y, 0.6, 24);
}
// --- Sorcier (collège Céleste, bâton à orbe) ------------------------------
function sorcier(x, y) {
  const inner = `<g class="breathe" style="transform-box:fill-box;transform-origin:50% 96%">
    <path d="M40 70 Q60 60 80 70 L98 150 L22 150 Z" fill="url(#robe)"/>
    <g fill="#cfe3ff" opacity="0.85"><circle cx="44" cy="112" r="1.6"/><circle cx="60" cy="130" r="2"/><circle cx="74" cy="118" r="1.6"/><circle cx="52" cy="142" r="1.6"/><circle cx="70" cy="140" r="1.6"/></g>
    <path d="M44 84 Q30 92 30 122" stroke="url(#robe)" stroke-width="10" fill="none" stroke-linecap="round"/>
    <rect x="27" y="18" width="5" height="112" rx="2" fill="#6a4a2a"/>
    <circle class="glow" cx="29" cy="16" r="11" fill="url(#glow)"/><circle cx="29" cy="16" r="4.5" fill="#d6f7ff"/>
    <path d="M76 84 Q90 92 88 112" stroke="url(#robe)" stroke-width="9" fill="none" stroke-linecap="round"/>
    <path d="M46 56 Q60 28 74 56 Q72 76 60 80 Q48 76 46 56 Z" fill="url(#robe)"/>
    <circle cx="60" cy="58" r="11" fill="#e2b48c"/>
    <path d="M52 62 Q60 80 68 62 L66 78 Q60 86 54 78 Z" fill="#d8d8d8"/>
    ${eye(56, 57, 1.5)}${eye(64, 57, 1.5)}</g>`;
  return put(inner, x, y, 0.62, 22);
}
// --- Halfelin (rondouillard, pieds nus, couteau) --------------------------
function halfling(x, y) {
  const inner = `<g class="breathe" style="transform-box:fill-box;transform-origin:50% 96%">
    <ellipse cx="50" cy="148" rx="12" ry="6" fill="#c8a06a"/><ellipse cx="72" cy="148" rx="12" ry="6" fill="#b8905a"/>
    <rect x="46" y="120" width="12" height="26" rx="4" fill="#5a4630"/><rect x="62" y="120" width="12" height="26" rx="4" fill="#4c3a26"/>
    <ellipse cx="60" cy="104" rx="26" ry="24" fill="#d8c9a0"/>
    <path d="M40 92 Q60 84 80 92 L82 120 Q60 128 38 120 Z" fill="url(#hVest)"/>
    <circle cx="60" cy="106" r="1.8" fill="#3a2f10"/><circle cx="60" cy="114" r="1.8" fill="#3a2f10"/>
    <path d="M40 96 Q28 104 30 116" stroke="#d8c9a0" stroke-width="8" fill="none" stroke-linecap="round"/>
    <path d="M80 96 Q92 104 90 116" stroke="#d8c9a0" stroke-width="8" fill="none" stroke-linecap="round"/>
    <rect x="88" y="98" width="3" height="18" fill="#cfd6df" transform="rotate(22 89 107)"/>
    <circle cx="60" cy="74" r="15" fill="#f0c8a0"/>
    <path d="M44 72 q-2 -20 16 -20 q18 0 16 20 q-7 -9 -16 -9 q-9 0 -16 9z" fill="#7a4a22"/>
    <circle cx="47" cy="72" r="4" fill="#7a4a22"/><circle cx="73" cy="72" r="4" fill="#7a4a22"/>
    ${eye(55, 74, 1.6)}${eye(65, 74, 1.6)}
    <path d="M55 80 q5 4 10 0" stroke="#8a5a2a" stroke-width="1.5" fill="none"/></g>`;
  return put(inner, x, y, 0.5, 18);
}
// --- Répurgateur / chasseur de sorcières ----------------------------------
function witchHunter(x, y) {
  const inner = `<g class="breathe" style="transform-box:fill-box;transform-origin:50% 96%">
    <path d="M44 72 Q60 64 76 72 L92 150 L28 150 Z" fill="url(#coat)"/>
    <rect x="50" y="120" width="9" height="30" fill="#1a140e"/><rect x="61" y="120" width="9" height="30" fill="#120e08"/>
    <path d="M46 70 Q60 62 74 70 L78 104 Q60 110 42 104 Z" fill="url(#coat)"/>
    <path d="M54 70 L60 92 L66 70 Z" fill="#e8e4da"/>
    <rect x="42" y="100" width="36" height="6" fill="#3a2a18"/><path d="M60 106 l4 8 l-4 4 l-4 -4z" fill="#d8a93b"/>
    <path d="M46 78 Q30 86 32 108" stroke="url(#coat)" stroke-width="9" fill="none" stroke-linecap="round"/>
    <g transform="translate(24 104)"><rect x="-2" y="-3" width="20" height="6" rx="1" fill="#241a12"/><rect x="-7" y="0" width="9" height="11" rx="2" fill="#3a2a18"/><rect x="16" y="-2" width="9" height="4" fill="#4a4a52"/></g>
    <path d="M74 78 Q90 86 88 112" stroke="url(#coat)" stroke-width="9" fill="none" stroke-linecap="round"/>
    <line x1="88" y1="112" x2="102" y2="150" stroke="#cfd6df" stroke-width="2"/>
    <circle cx="60" cy="56" r="12" fill="#e2b48c"/>
    <path d="M38 50 q22 -7 44 0 q-7 5 -22 5 q-15 0 -22 -5z" fill="#15120c"/>
    <path d="M49 50 q11 -24 22 0 z" fill="#15120c"/><rect x="55" y="39" width="10" height="3" fill="#d8a93b"/>
    ${eye(55, 56, 1.4)}${eye(65, 56, 1.4)}</g>`;
  return put(inner, x, y, 0.62, 22);
}
// --- Soldat humain (cuirasse, bouclier, épée, cape) -----------------------
function soldier(x, y) {
  const inner = `<g class="breathe" style="transform-box:fill-box;transform-origin:50% 96%">
    <path d="M40 72 Q60 60 80 72 Q90 110 80 150 L60 140 L40 150 Q30 110 40 72 Z" fill="url(#cloak)"/>
    <rect x="50" y="118" width="9" height="30" fill="#3a2c22"/><rect x="61" y="118" width="9" height="30" fill="#46362a"/>
    <path d="M44 70 Q60 58 76 70 L80 116 Q60 126 40 116 Z" fill="url(#steel)" stroke="#3a4150" stroke-width="1.5"/>
    <path d="M60 70 L60 116" stroke="#5a6478" stroke-width="1.4"/>
    <path d="M42 74 Q26 88 28 112" stroke="url(#steelDark)" stroke-width="10" fill="none" stroke-linecap="round"/>
    <circle cx="26" cy="112" r="18" fill="#8a4030" stroke="#d8a93b" stroke-width="3"/><circle cx="26" cy="112" r="5" fill="#d8a93b"/>
    <path d="M78 74 Q94 80 92 50" stroke="#9aa6b8" stroke-width="9" fill="none" stroke-linecap="round"/>
    <rect x="89" y="14" width="6" height="38" rx="2" fill="url(#steel)" transform="rotate(8 92 33)"/>
    <ellipse cx="44" cy="70" rx="12" ry="8" fill="url(#steelDark)"/><ellipse cx="76" cy="70" rx="12" ry="8" fill="url(#steelDark)"/>
    <circle cx="60" cy="48" r="14" fill="#e2b48c"/>
    <path d="M46 46 Q60 26 74 46 L74 38 Q60 24 46 38 Z" fill="url(#steel)" stroke="#3a4150"/>
    <rect x="58" y="40" width="4" height="18" rx="2" fill="#7a8496"/>
    ${eye(55, 49, 1.6)}${eye(65, 49, 1.6)}</g>`;
  return put(inner, x, y, 0.6, 24);
}
const flies = (x, y) => { const [cx, cy] = iso(x, y); let d = ''; for (let i = 0; i < 4; i++) d += `<circle class="fly f${i}" cx="${cx}" cy="${cy + 8}" r="1.6" fill="#111"/>`; return d; };

// --- Assemblage -----------------------------------------------------------
const W = 12, H = 9, parts = [];
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
  let f = 'url(#grassF)';
  if (y >= 4 && y <= 5) f = 'url(#road)';
  parts.push(diamond(x, y, f));
}
parts.push(bloodTrail(2, 5, 8, 4, 9));
parts.push(bloodTrail(9, 6, 6, 5, 6));

// Arbres de forêt (bordures + clairière) — profondeur incluse plus bas
const trees = [[0,0,1],[2,0,0],[4,0,1],[6,0,0],[9,0,1],[11,0,0],[0,2,0],[0,4,1],[0,6,0],[11,2,1],[11,4,0],[11,6,1],[1,7,0],[3,8,1],[7,8,0],[10,7,1],[5,0,0]];

const objs = [];
const D = (x, y, e = 0) => x + y + e;
for (const [tx, ty, th] of trees) objs.push({ d: D(tx, ty, -0.5), html: tree(tx, ty, th) });
objs.push({ d: D(8, 3, 0.2), html: coach(8, 3) });
objs.push({ d: D(6, 2), html: horse(6, 2, false) });
objs.push({ d: D(7, 2, 0.1), html: horse(7, 2, true) });
objs.push({ d: D(3, 4), html: corpse(3, 4, 14, '#54331f', true, false) });
objs.push({ d: D(5, 5, 0.05), html: corpse(5, 5, -26, '#2f2750', false, true) }); // Kastor + parchemin
objs.push({ d: D(9, 5), html: corpse(9, 5, 64, '#4a2a1a', false, false) + flies(9, 5) });
objs.push({ d: D(6, 1, 0.3), html: mutantAxe(6, 1) });          // mutile les chevaux
objs.push({ d: D(4, 5, 0.2), html: mutantDog(4, 5) });          // chien-tête blessé
objs.push({ d: D(3, 5, 0.25), html: mutantOgive(3, 5) });       // le bande
objs.push({ d: D(9, 5, 0.3), html: mutantHoof(9, 5) });         // dévore un corps
objs.push({ d: D(7, 4, 0.2), html: knud(7, 4) });               // Knud, arbalète
// Le groupe arrive par la gauche, en formation logique face à la menace (à droite) :
// ligne de front (mêlée), puis distance, lanceur protégé à l'arrière.
objs.push({ d: D(2, 3, 0.15), html: slayer(2, 3) });           // Tueur — front haut
objs.push({ d: D(2, 4, 0.15), html: soldier(2, 4) });          // Soldat — front bas (bouclier)
objs.push({ d: D(1, 2), html: witchHunter(1, 2) });            // Répurgateur — distance (pistolet)
objs.push({ d: D(1, 4), html: halfling(1, 4) });               // Halfelin — flanc/éclaireur
objs.push({ d: D(0, 3), html: sorcier(0, 3) });                // Sorcier — arrière protégé
objs.sort((a, b) => a.d - b.d);
for (const o of objs) parts.push(o.html);

const defs = `
  <lineargradient id="grassF" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#34552a"/><stop offset="100%" stop-color="#20381b"/></lineargradient>
  <lineargradient id="road" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#8f7a4e"/><stop offset="100%" stop-color="#6f5d3a"/></lineargradient>
  <radialgradient id="blood" cx="50%" cy="50%" r="50%"><stop offset="0%" stop-color="#7e1212"/><stop offset="100%" stop-color="#360707"/></radialgradient>
  <lineargradient id="coach" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#6e2a30"/><stop offset="100%" stop-color="#3e1418"/></lineargradient>
  <lineargradient id="horse" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#6e4a2c"/><stop offset="100%" stop-color="#432b18"/></lineargradient>
  <lineargradient id="mut" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#7c9152"/><stop offset="100%" stop-color="#39501f"/></lineargradient>
  <lineargradient id="mutDark" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#5d7540"/><stop offset="100%" stop-color="#2a3c18"/></lineargradient>
  <lineargradient id="scale" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#6f8f54"/><stop offset="100%" stop-color="#3a4f2a"/></lineargradient>
  <lineargradient id="flesh" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#e8b88e"/><stop offset="100%" stop-color="#b07a52"/></lineargradient>
  <lineargradient id="crest" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#ff7a1a"/><stop offset="100%" stop-color="#c43f0a"/></lineargradient>
  <lineargradient id="axe" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#dfe6ef"/><stop offset="100%" stop-color="#6a7384"/></lineargradient>
  <lineargradient id="steel" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#e8edf5"/><stop offset="45%" stop-color="#9aa6b8"/><stop offset="100%" stop-color="#5a6376"/></lineargradient>
  <lineargradient id="steelDark" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#8b94a6"/><stop offset="100%" stop-color="#444b5a"/></lineargradient>
  <lineargradient id="cloak" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#a8323a"/><stop offset="100%" stop-color="#5e1418"/></lineargradient>
  <radialgradient id="eye" cx="50%" cy="50%" r="50%"><stop offset="0%" stop-color="#ffe14a"/><stop offset="70%" stop-color="#d88a1a"/><stop offset="100%" stop-color="#7a3a08"/></radialgradient>
  <radialgradient id="deadShade" cx="50%" cy="30%" r="70%"><stop offset="0%" stop-color="#000" stop-opacity="0"/><stop offset="100%" stop-color="#000" stop-opacity="0.35"/></radialgradient>
  <lineargradient id="robe" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#3a3f7a"/><stop offset="100%" stop-color="#171a36"/></lineargradient>
  <radialgradient id="glow" cx="50%" cy="50%" r="50%"><stop offset="0%" stop-color="#bdf3ff"/><stop offset="55%" stop-color="#4ec3e0" stop-opacity="0.7"/><stop offset="100%" stop-color="#4ec3e0" stop-opacity="0"/></radialgradient>
  <lineargradient id="coat" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#30303a"/><stop offset="100%" stop-color="#141419"/></lineargradient>
  <lineargradient id="hVest" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#6f7e3a"/><stop offset="100%" stop-color="#46521f"/></lineargradient>
  <radialgradient id="warm" cx="60%" cy="14%" r="80%"><stop offset="0%" stop-color="#ffce78" stop-opacity="0.16"/><stop offset="100%" stop-color="#ffce78" stop-opacity="0"/></radialgradient>
  <radialgradient id="vig" cx="50%" cy="42%" r="60%"><stop offset="48%" stop-color="#000" stop-opacity="0"/><stop offset="100%" stop-color="#04030a" stop-opacity="0.82"/></radialgradient>`;

const css = `
  .breathe{animation:breathe 3s ease-in-out infinite}.feed{animation:feed 1.4s ease-in-out infinite}
  .howl{animation:howl 2.4s ease-in-out infinite}.chop{animation:chop 1.1s ease-in-out infinite}
  .kick{animation:kick .7s ease-in-out infinite}.kick2{animation:kick .7s ease-in-out infinite reverse}
  .wrap{animation:wrap 1.8s ease-in-out infinite}.gush{animation:gush 1.6s ease-in-out infinite;transform-box:fill-box;transform-origin:0 50%}
  .warm{animation:flicker 3.6s ease-in-out infinite}
  .crow{animation:crowfly 10s linear infinite}.crow .wing{animation:flap .28s ease-in-out infinite;transform-box:fill-box;transform-origin:50% 50%}
  .fly{animation:orbit 1.1s linear infinite}.f1{animation-delay:-.3s}.f2{animation-delay:-.6s}.f3{animation-delay:-.85s}
  .glow{animation:glow 2.2s ease-in-out infinite;transform-box:fill-box;transform-origin:center}
  @keyframes glow{0%,100%{transform:scale(.8);opacity:.6}50%{transform:scale(1.35);opacity:1}}
  @keyframes breathe{0%,100%{transform:scaleY(1)}50%{transform:scaleY(1.035)}}
  @keyframes feed{0%,100%{transform:translateY(0) rotate(0)}50%{transform:translateY(4px) rotate(-2deg)}}
  @keyframes howl{0%,100%{transform:rotate(-3deg)}50%{transform:rotate(7deg)}}
  @keyframes chop{0%,100%{transform:rotate(-14deg)}55%{transform:rotate(20deg)}}
  @keyframes kick{0%,100%{transform:rotate(-6deg)}50%{transform:rotate(10deg)}}
  @keyframes wrap{0%,100%{transform:translate(0,0)}50%{transform:translate(-2px,2px)}}
  @keyframes gush{0%,100%{transform:scaleX(.7);opacity:.7}50%{transform:scaleX(1.2);opacity:1}}
  @keyframes flicker{0%,100%{opacity:.85}40%{opacity:1}65%{opacity:.7}}
  @keyframes crowfly{from{transform:translate(-120px,50px)}to{transform:translate(1120px,-20px)}}
  @keyframes flap{0%,100%{transform:scaleY(1)}50%{transform:scaleY(.35)}}
  @keyframes orbit{0%{transform:translate(9px,0)}25%{transform:translate(0,-7px)}50%{transform:translate(-9px,0)}75%{transform:translate(0,7px)}100%{transform:translate(9px,0)}}`;

const crow = `<g class="crow"><ellipse cx="0" cy="0" rx="7" ry="3" fill="#0a0a0a"/><path class="wing" d="M-2 0 q-14 -8 -22 -2 q12 4 22 2" fill="#0a0a0a"/><path class="wing" d="M2 0 q14 -8 22 -2 q-12 4 -22 2" fill="#0a0a0a"/><circle cx="6" cy="-1" r="2.4" fill="#0a0a0a"/></g>`;

const html = `<!doctype html><html lang="fr"><head><meta charset="utf-8"/><title>Embuscade des mutants — animé</title>
<style>body{margin:0;background:#04030a;color:#e8e0f0;font-family:'Segoe UI',sans-serif}
h1{color:#d8a93b;font-size:18px;margin:14px 22px 4px}.cap{color:#a99fbd;font-size:12.5px;margin:8px 22px;max-width:980px}
${css}</style></head><body>
<h1>🩸 Du Sang Sur la Route — l'embuscade des mutants (forêt, scène animée)</h1>
<svg width="1000" height="660" viewBox="0 0 1000 660"><defs>${defs}</defs>
<rect width="1000" height="660" fill="#0a0810"/>
${parts.join('\n')}
${crow}
<rect class="warm" width="1000" height="660" fill="url(#warm)"/>
<rect width="1000" height="660" fill="url(#vig)"/></svg>
</body></html>`;

mkdirSync(resolve(ROOT, 'public'), { recursive: true });
writeFileSync(resolve(ROOT, 'public/ambush.html'), html, 'utf8');
console.log('public/ambush.html généré (' + html.length + ' octets)');
