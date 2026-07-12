import type { CreatureDef } from '../types';

// Grand Cerf (ZI) — être transcendant des forêts, « manifestation suprême de l'âme d'une forêt ».
// Réf art : art-ref/zi/page014_full.png — cerf MASSIF au pelage presque NOIR hirsute, en plein
// BRAMEMENT : encolure tendue vers le ciel, museau levé gueule ouverte, immense ramure dense
// (une dizaine d'andouillers par perche) balayée vers l'arrière, épaisse toison de gorge/fanon
// qui déborde sur le poitrail. Quadrupède 'equine' porté en masse :
//   - pose : neckAngle -16 (encolure ~72° au-dessus de l'horizontale) + headPitch -95 (nouveau
//     prop de squelette : museau ~35° au-dessus de l'horizontale, oreilles couchées en arrière) —
//     valeurs calculées pour que le museau reste DANS la boîte 120×150 (à -58 il sortait du cadre) ;
//   - ramure : deco.tete (éventail SYMÉTRIQUE ±35° dessiné dressé → couronne large de face/dos,
//     et basculé avec la tête en profil = perches balayées en arrière au-dessus du dos, andouillers
//     vers le haut, comme l'illustration) — remplace headgear 'bois' (2-3 branches, trop simple) ;
//   - brame + fanon : deco.encolure — os SANS art de face/dos, donc rendu en PROFIL SEULEMENT :
//     mâchoire inférieure décrochée + gueule sombre béante placées sous le museau levé (positions
//     calculées dans le repère de l'encolure), frange de toison dentelée le long de la gorge qui
//     retombe en fanon sur le poitrail ;
//   - robe charbon quasi noir (@corps), toison et ramure noires (@cheveux), reflets gris cendré.
const RAMURE_COTE = (sx: number): string => {
  const X = (n: number) => (n * sx).toFixed(1);
  // deux PERCHES par côté qui s'élèvent en s'incurvant, hérissées d'andouillers vers le haut/dehors
  const perches = `M${X(3)} -8 Q${X(10)} -17 ${X(15)} -25 Q${X(18)} -31 ${X(17)} -37 ` +
    `M${X(1.5)} -9 Q${X(5)} -19 ${X(7.5)} -28 Q${X(9)} -34 ${X(7)} -40`;
  const andouillers = `M${X(3)} -6.5 Q${X(9)} -6 ${X(12.5)} -10 ` + // andouiller d'œil (au-dessus du chanfrein)
    `M${X(8)} -14.5 Q${X(14)} -16 ${X(17)} -21 M${X(11.5)} -20.5 Q${X(17)} -23 ${X(20)} -28 ` +
    `M${X(14)} -27 Q${X(19.5)} -30 ${X(22)} -35 M${X(16)} -33 Q${X(20)} -37 ${X(21)} -42 ` +
    `M${X(4)} -17 Q${X(8)} -19 ${X(10)} -24 M${X(6)} -24 Q${X(10)} -27 ${X(11.5)} -32 ` +
    `M${X(7.5)} -31 Q${X(11)} -35 ${X(11)} -40 M${X(7)} -37 Q${X(4)} -41 ${X(2)} -43`;
  return `<path d="${perches}" stroke="@cheveux" stroke-width="2.4"/>` +
    `<path d="${andouillers}" stroke="@cheveux" stroke-width="1.5"/>` +
    `<path d="${perches}" stroke="@cheveuxO" stroke-width="0.55" opacity="0.6"/>` +
    `<path d="${perches}" stroke="@corpsH" stroke-width="0.35" opacity="0.35"/>`; // liseré cendré (lisibilité du noir sur noir)
};
const RAMURE = `<g data-deco="ramure" fill="none" stroke-linecap="round">${RAMURE_COTE(-1)}${RAMURE_COTE(1)}</g>`;

// Repère local de l'encolure (base du cou = origine, -y vers la tête ; tête à (0,-31.5), museau
// levé aboutissant vers (18,-55)). Rendu SOUS l'os tête (z 6 < 7) : la charnière disparaît sous
// le crâne, seuls dépassent la mandibule décrochée et le noir de la gueule.
const BRAME =
  `<g data-deco="brame">` +
  // gueule béante : triangle sombre entre le museau levé et la mandibule décrochée
  `<path d="M10.4 -46.5 L17.9 -55.3 L20.1 -48.1 Z" fill="#180c07"/>` +
  `<path d="M11.6 -46.9 L15.8 -50.9 L16.6 -47.4 Z" fill="#6e2422"/>` + // langue au fond de la gueule
  // mandibule inférieure (barre de mâchoire ouverte, sous la gueule)
  `<path d="M10.2 -46.6 L20.1 -48.3 Q22 -47.5 21 -45.4 L11 -43.9 Q9.4 -45.2 10.2 -46.6 Z" fill="@corps" stroke="@corpsO" stroke-width="0.55"/>` +
  `<path d="M13 -44.4 l1 3 l1.9 -2.3 l1.1 2.8 l2 -2.5" stroke="@cheveux" stroke-width="1.1" fill="none" stroke-linecap="round"/>` + // barbiche sous la mâchoire
  // toison de gorge : frange dentelée le long du devant de l'encolure, qui s'épaissit en
  // descendant et retombe en FANON sur le poitrail (le poil déborde la base du cou)
  `<path d="M6.2 -28 L10.8 -24.6 L8.2 -21.4 L12.4 -17.6 L9.6 -14.6 L13.6 -10.4 L10.8 -7.4 L14.6 -3 L11.8 0 L15.4 4.6 L12 6.8 L16 12 L10.5 16.5 L12.8 21 L7 18 Q4.5 6 4.8 -12 Q5 -22 6.2 -28 Z" fill="@cheveux" stroke="@cheveuxO" stroke-width="0.5"/>` +
  `<path d="M7.5 -20 Q8.5 -6 9.5 8" stroke="@cheveuxO" stroke-width="0.5" fill="none" opacity="0.5"/>` + // mèches internes
  `</g>`;

export const creature: CreatureDef = {
  name: 'Grand Cerf',
  plan: 'quadruped',
  quad: {
    sl: 1.12, build: 'equine', girth: 1.16, bodyLen: 1.02, neckLen: 1.05, neckAngle: -16, headPitch: -95, legLen: 1.16,
    head: 'cheval', tail: 'touffe', mane: 'hirsute', ears: 'pointues', foot: 'sabot', headScale: 0.9, tailLen: 0.5,
    deco: { tete: RAMURE, encolure: BRAME },
    stored: { corps: '#2e2921', corpsO: '#0f0c09', corpsH: '#5a5244', cheveux: '#241f18', cheveuxO: '#0b0906', cuir: '#161210' },
  },
};
