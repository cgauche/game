/** Catalogue de décors (placeables NWN). Chaque render renvoie un SVG en boîte
 *  locale 120×150, pieds en (60,150) — comme les autres sprites de sprites.ts. */
import type { PropViz } from './types';

const tonneau = () =>
  `<g><ellipse cx="60" cy="146" rx="22" ry="8" fill="#3a2a18"/><path d="M40 110 Q60 104 80 110 L78 144 Q60 150 42 144 Z" fill="#6a4a2a"/><path d="M40 122 h40 M40 134 h40" stroke="#2a1c10" stroke-width="3"/><ellipse cx="60" cy="110" rx="20" ry="7" fill="#7a5a32"/></g>`;
const caisse = () =>
  `<g><path d="M30 150 L30 110 L60 96 L90 110 L90 150 L60 164 Z" fill="#7a5a32"/><path d="M30 110 L60 124 L90 110 L60 96 Z" fill="#8a6a3c"/><path d="M60 124 L60 164 M30 110 L30 150 M90 110 L90 150" stroke="#3a2a18" stroke-width="2"/></g>`;
const puits = () =>
  `<g><ellipse cx="60" cy="142" rx="30" ry="14" fill="#5a5550"/><ellipse cx="60" cy="138" rx="23" ry="10" fill="#241f1b"/><rect x="33" y="58" width="6" height="84" fill="#4a3220"/><rect x="81" y="58" width="6" height="84" fill="#4a3220"/><path d="M26 60 L60 38 L94 60 Z" fill="#7a2d22"/><rect x="50" y="64" width="20" height="8" rx="2" fill="#3a2a18"/></g>`;
const fontaine = () =>
  `<g><ellipse cx="60" cy="144" rx="34" ry="15" fill="#7d7a74"/><ellipse cx="60" cy="140" rx="27" ry="11" fill="#3a6a8a" opacity="0.85"/><rect x="56" y="96" width="8" height="40" fill="#9a968e"/><ellipse cx="60" cy="96" rx="12" ry="5" fill="#aaa69e"/><circle cx="60" cy="90" r="6" fill="#cfe3ff" opacity="0.7"/></g>`;
const charrette = () =>
  `<g><circle cx="44" cy="138" r="16" fill="#3a2a18"/><circle cx="44" cy="138" r="6" fill="#6a4a2a"/><circle cx="86" cy="138" r="16" fill="#3a2a18"/><circle cx="86" cy="138" r="6" fill="#6a4a2a"/><path d="M30 110 L96 110 L90 130 L36 130 Z" fill="#6e4a28"/><path d="M30 110 L96 110" stroke="#4a3220" stroke-width="3"/><path d="M96 116 L112 122" stroke="#4a3220" stroke-width="4"/></g>`;
const etalMarche = () =>
  `<g><rect x="30" y="118" width="60" height="26" fill="#7a5a32"/><rect x="30" y="112" width="60" height="8" fill="#8a6a3c"/><rect x="34" y="118" width="6" height="26" fill="#4a3220"/><rect x="80" y="118" width="6" height="26" fill="#4a3220"/><path d="M26 88 L94 88 L88 108 L32 108 Z" fill="#a8423a"/><path d="M26 88 L94 88" stroke="#6a261f" stroke-width="2"/><circle cx="48" cy="114" r="4" fill="#c0392b"/><circle cx="60" cy="114" r="4" fill="#e0a000"/><circle cx="72" cy="114" r="4" fill="#2e8b57"/></g>`;
const statue = () =>
  `<g><ellipse cx="60" cy="146" rx="22" ry="8" fill="#3a3833"/><rect x="46" y="128" width="28" height="18" fill="#8a877f"/><path d="M52 128 Q50 88 60 70 Q70 88 68 128 Z" fill="#a6a39b"/><circle cx="60" cy="64" r="9" fill="#b4b1a8"/></g>`;
const lampadaire = () =>
  `<g><ellipse cx="60" cy="146" rx="12" ry="5" fill="#2a2622"/><rect x="57" y="70" width="6" height="76" fill="#2e2a25"/><path d="M50 70 L70 70 L66 56 L54 56 Z" fill="#3a352f"/><rect x="53" y="56" width="14" height="4" fill="#2e2a25"/><circle class="warm" cx="60" cy="64" r="5" fill="#ffd479"/></g>`;
const panneau = () =>
  `<g><ellipse cx="60" cy="146" rx="10" ry="4" fill="#2a2018"/><rect x="57" y="92" width="6" height="54" fill="#4a3220"/><rect x="40" y="78" width="40" height="18" rx="2" fill="#6e4a28" stroke="#3a2a18" stroke-width="2"/><path d="M80 87 l10 -5 l-10 -5 z" fill="#6e4a28"/></g>`;
const cloture = () =>
  `<g><path d="M28 150 v-26 M48 150 v-30 M68 150 v-30 M88 150 v-26" stroke="#5a4226" stroke-width="5"/><path d="M24 128 h70 M24 140 h70" stroke="#6a4f2c" stroke-width="4"/></g>`;
const tasFoin = () =>
  `<g><ellipse cx="60" cy="148" rx="34" ry="12" fill="#3a2f12"/><path d="M28 144 Q60 96 92 144 Q60 156 28 144 Z" fill="#c8a23a"/><path d="M40 140 Q60 112 80 140" stroke="#a8842a" stroke-width="2" fill="none"/></g>`;
const feuCamp = () =>
  `<g><ellipse cx="60" cy="146" rx="22" ry="9" fill="#2a2018"/><path d="M44 144 L74 132 M48 146 L80 138 M40 140 L70 128" stroke="#5a4226" stroke-width="5" stroke-linecap="round"/><g class="warm"><path d="M60 138 Q48 118 60 100 Q66 116 72 110 Q78 128 60 138 Z" fill="#ff7a1a"/><path d="M60 136 Q54 124 60 112 Q64 122 60 136 Z" fill="#ffd479"/></g></g>`;
const arbre = () =>
  `<g><ellipse cx="60" cy="148" rx="26" ry="11" fill="#000" opacity="0.3"/><rect x="53" y="110" width="14" height="40" rx="3" fill="#4a3220"/><path d="M60 50 L100 122 L74 114 L60 130 L46 114 L20 122 Z" fill="#1d3d18"/><path d="M60 50 L100 122 L74 114 L60 92 Z" fill="#2a5320"/><path d="M60 72 L84 116 L60 108 Z" fill="#327026" opacity="0.6"/></g>`;
// Décors « ADN » d'une embuscade (cf. public/ambush.html), boîte 120×150 / sol ≈ y146.
const mareSang = () =>
  `<g><ellipse cx="60" cy="142" rx="38" ry="14" fill="url(#g_blood)" opacity="0.92"/><ellipse cx="38" cy="134" rx="14" ry="5.5" fill="url(#g_blood)" opacity="0.8"/><ellipse cx="86" cy="147" rx="11" ry="4.5" fill="url(#g_blood)" opacity="0.72"/><ellipse cx="60" cy="140" rx="24" ry="8" fill="#360707" opacity="0.55"/><ellipse cx="92" cy="135" rx="4" ry="2" fill="#7e1212" opacity="0.85"/><ellipse cx="28" cy="145" rx="3.5" ry="1.8" fill="#7e1212" opacity="0.8"/><ellipse cx="74" cy="128" rx="3" ry="1.6" fill="#7e1212" opacity="0.75"/></g>`;
const cadavre = () =>
  `<g><ellipse cx="60" cy="146" rx="32" ry="10" fill="#5e1010" opacity="0.5"/><path d="M60 132 L94 124 M60 134 L90 148" stroke="#54331f" stroke-width="11" stroke-linecap="round"/><path d="M54 130 L30 116 M54 134 L34 150" stroke="#54331f" stroke-width="8" stroke-linecap="round"/><ellipse cx="58" cy="132" rx="20" ry="13" fill="#54331f"/><ellipse cx="58" cy="132" rx="20" ry="13" fill="#000" opacity="0.18"/><circle cx="34" cy="128" r="10" fill="#cdb89a"/><path d="M24 124 q10 -9 20 0z" fill="#2a1d12"/></g>`;
const chevalMort = () =>
  `<g><ellipse cx="62" cy="146" rx="42" ry="11" fill="#000" opacity="0.25"/><path d="M40 112 q-14 6 -10 26 q10 -6 12 -18z" fill="#1a1008"/><ellipse cx="58" cy="128" rx="40" ry="20" fill="#5a3c22"/><ellipse cx="26" cy="124" rx="17" ry="16" fill="#5a3c22"/><path d="M44 142 l-4 14 M58 144 l0 14 M74 140 l4 14 M86 138 l8 12" stroke="#3a2614" stroke-width="6" stroke-linecap="round"/><path d="M88 120 Q104 122 112 134 Q108 140 96 134 Z" fill="#5a3c22"/><path d="M108 130 Q121 134 125 143 L112 140 Z" fill="#4a2f1a"/><ellipse cx="117" cy="138" rx="3" ry="2.4" fill="#1a0e06"/></g>`;
const epaveCarrosse = () =>
  `<g><ellipse cx="60" cy="146" rx="44" ry="12" fill="#000" opacity="0.3"/><g transform="rotate(-8 60 110)"><rect x="24" y="84" width="78" height="46" rx="8" fill="#6e2a30" stroke="#2a0e0e" stroke-width="3"/><rect x="24" y="84" width="78" height="10" rx="5" fill="#7a2630"/><rect x="40" y="103" width="24" height="24" rx="3" fill="#39151a" stroke="#d8a93b" stroke-width="2"/><path d="M24 116 h78" stroke="#d8a93b" stroke-width="1.5" opacity="0.7"/></g><ellipse cx="33" cy="140" rx="18" ry="8" fill="none" stroke="#241a10" stroke-width="5"/><line x1="15" y1="140" x2="51" y2="140" stroke="#3a2a18" stroke-width="2.5"/><line x1="33" y1="132" x2="33" y2="148" stroke="#3a2a18" stroke-width="2.5"/><circle cx="93" cy="126" r="15" fill="none" stroke="#241a10" stroke-width="5"/><circle cx="93" cy="126" r="4" fill="#3a2a18"/></g>`;

// Décors fouillables/ramassables (SP2) — `searchable` pré-arme l'interact à la pose (éditeur).
const lettre = () =>
  `<g><ellipse cx="60" cy="148" rx="28" ry="6" fill="#000" opacity="0.18"/><path d="M30 150 L88 132 Q96 130 95 138 L40 156 Q30 158 30 150 Z" fill="#e8dcae"/><path d="M30 150 L88 132" stroke="#c9b988" stroke-width="2"/><path d="M46 147 h26 M46 151 h22" stroke="#7a6a44" stroke-width="1" opacity="0.6"/><ellipse cx="36" cy="150" rx="8" ry="9" fill="#d8c79a"/><ellipse cx="36" cy="150" rx="3.4" ry="5" fill="#b8a06e"/><circle cx="74" cy="142" r="7" fill="#9e2a22"/><circle cx="74" cy="142" r="7" fill="#000" opacity="0.12"/><path d="M71 142 l3 3 l4 -5" stroke="#5e120e" stroke-width="1.4" fill="none"/></g>`;
const coffre = () =>
  `<g><ellipse cx="60" cy="148" rx="32" ry="8" fill="#000" opacity="0.22"/><rect x="30" y="118" width="60" height="30" rx="3" fill="#6e4a28"/><path d="M30 118 Q60 96 90 118 Z" fill="#7a5230"/><path d="M30 118 Q60 100 90 118" fill="none" stroke="#4a3018" stroke-width="2"/><path d="M44 102 L44 148 M76 102 L76 148" stroke="#7d7a74" stroke-width="4"/><path d="M30 118 h60" stroke="#5a5550" stroke-width="3"/><rect x="54" y="124" width="12" height="12" rx="2" fill="#d8a93b"/><circle cx="60" cy="130" r="2.4" fill="#3a2a10"/></g>`;
const cle = () =>
  `<g><ellipse cx="60" cy="146" rx="22" ry="6" fill="#000" opacity="0.18"/><g transform="rotate(20 60 142)"><circle cx="36" cy="142" r="11" fill="none" stroke="#9a968e" stroke-width="5"/><rect x="46" y="139.5" width="42" height="5" rx="2.5" fill="#9a968e"/><path d="M82 144 v8 h4 v-4 h4 v4 h4 v-8 Z" fill="#9a968e"/></g><circle cx="33" cy="139" r="2" fill="#cfccc4"/></g>`;
const bourse = () =>
  `<g><ellipse cx="55" cy="151" rx="30" ry="7" fill="#000" opacity="0.2"/><path d="M33 134 Q32 153 55 153 Q78 153 77 134 Q76 124 65 124 Q55 121 45 124 Q34 124 33 134 Z" fill="#6a4a2a"/><path d="M44 133 v18 M55 132 v21 M66 133 v18" stroke="#4a3018" stroke-width="1.3" fill="none" opacity="0.4"/><ellipse cx="55" cy="124" rx="12" ry="4.5" fill="#3a2614"/><path d="M43 129 q12 5 24 0" stroke="#241a0e" stroke-width="2.6" fill="none"/><ellipse cx="50" cy="121" rx="4.6" ry="2.5" fill="#e8c25a"/><ellipse cx="60" cy="120.5" rx="4.6" ry="2.5" fill="#f0d070"/><ellipse cx="55" cy="116.5" rx="4.6" ry="2.5" fill="#e8c25a"/><circle cx="55" cy="115" r="1.4" fill="#fff" opacity="0.5"/><ellipse cx="80" cy="152" rx="7" ry="3.4" fill="#caa033"/><ellipse cx="80" cy="150.2" rx="7" ry="3.4" fill="#e8c25a"/><ellipse cx="72" cy="153.4" rx="5.6" ry="2.8" fill="#d8a93b"/></g>`;
const etagere = () =>
  `<g><ellipse cx="60" cy="148" rx="28" ry="7" fill="#000" opacity="0.2"/><rect x="34" y="60" width="6" height="88" fill="#5a3c22"/><rect x="80" y="60" width="6" height="88" fill="#5a3c22"/><rect x="32" y="62" width="56" height="7" fill="#6e4a28"/><rect x="32" y="96" width="56" height="7" fill="#6e4a28"/><rect x="32" y="130" width="56" height="7" fill="#6e4a28"/><rect x="42" y="50" width="9" height="12" rx="2" fill="#7a5a32"/><path d="M58 50 q6 0 6 6 v6 h-12 v-6 q0 -6 6 -6z" fill="#8a6a3c"/><rect x="44" y="84" width="14" height="12" fill="#9e2a22"/><rect x="62" y="86" width="10" height="10" rx="2" fill="#3a6a8a"/></g>`;

export const PROPS: Record<string, PropViz> = {
  tonneau: { id: 'tonneau', label: 'Tonneau', render: tonneau },
  caisse: { id: 'caisse', label: 'Caisse', render: caisse },
  puits: { id: 'puits', label: 'Puits', render: puits },
  fontaine: { id: 'fontaine', label: 'Fontaine', render: fontaine },
  charrette: { id: 'charrette', label: 'Charrette', render: charrette },
  'etal-marche': { id: 'etal-marche', label: 'Étal de marché', render: etalMarche },
  statue: { id: 'statue', label: 'Statue', render: statue },
  lampadaire: { id: 'lampadaire', label: 'Lampadaire', render: lampadaire },
  panneau: { id: 'panneau', label: 'Panneau', render: panneau },
  cloture: { id: 'cloture', label: 'Clôture', render: cloture },
  'tas-foin': { id: 'tas-foin', label: 'Tas de foin', render: tasFoin },
  'feu-camp': { id: 'feu-camp', label: 'Feu de camp', render: feuCamp },
  arbre: { id: 'arbre', label: 'Arbre', render: arbre },
  cadavre: { id: 'cadavre', label: 'Cadavre', render: cadavre },
  'mare-sang': { id: 'mare-sang', label: 'Mare de sang', render: mareSang },
  'cheval-mort': { id: 'cheval-mort', label: 'Cheval mort', render: chevalMort },
  'epave-carrosse': { id: 'epave-carrosse', label: 'Épave de carrosse', render: epaveCarrosse },
  lettre: { id: 'lettre', label: 'Lettre', render: lettre, searchable: true },
  coffre: { id: 'coffre', label: 'Coffre', render: coffre, searchable: true },
  cle: { id: 'cle', label: 'Clé', render: cle, searchable: true },
  bourse: { id: 'bourse', label: 'Bourse', render: bourse, searchable: true },
  etagere: { id: 'etagere', label: 'Étagère', render: etagere, searchable: true },
};

export function propSvg(ref: string): string {
  return (PROPS[ref] ?? PROPS.tonneau).render({}, { dims: { w: 0, h: 0 } });
}
