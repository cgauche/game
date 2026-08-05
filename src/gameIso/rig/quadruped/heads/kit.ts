/**
 * Boîte à outils des DEFS DE TÊTE quadrupèdes : les fragments d'art PARTAGÉS par plusieurs têtes
 * (œil, oreilles par vue, arrière de crâne générique, têtes-satellites des clusters multi-cous).
 * Une def de tête compose ces briques ; le socle (`quadParts.ts`) ne les connaît plus.
 */
import type { QuadProps } from '../quadSkeleton';

// Œil CALME d'animal : iris sombre + petit reflet (pas le glow jaune g_eye, qui faisait
// « yeux démoniaques/globuleux » sur cheval/ours/rat). ANCRÉ `data-eye`/`data-ec` (même
// convention que les visages bipèdes, cf. parts/eyes.ts) → yeux custom branchables.
export const eyeF = (x: number, y = -3, r = 1.7) =>
  `<g data-eye="${x < 0 ? 'G' : 'D'}" data-ec="${x} ${y}"><ellipse cx="${x}" cy="${y}" rx="${r}" ry="${r + 0.3}" fill="#15100a"/><circle cx="${(x + 0.4).toFixed(1)}" cy="${(y - 0.4).toFixed(1)}" r="${(r * 0.34).toFixed(2)}" fill="#fff" opacity="0.7"/></g>`;

/** Œil de PROFIL (un seul visible), ancré comme `eyeF`. */
export const EYE_PROFILE = `<g data-eye="D" data-ec="6 2"><ellipse cx="6" cy="2" rx="1.6" ry="1.9" fill="#15100a"/><circle cx="6.4" cy="1.4" r="0.6" fill="#fff" opacity="0.7"/></g>`;

export function earProfile(p: QuadProps, x: number, s: number): string {
  if (p.ears === 'pointues')
    return `<path d="M${x} -6 l${2 * s} -10 l${3 * s} 7 z" fill="@corps" stroke="@corpsO" stroke-width="0.5"/><path d="M${x + 1 * s} -7 l${1.5 * s} -6 l${1.5 * s} 4 z" fill="@corpsO"/>`;
  if (p.ears === 'rondes')
    return `<circle cx="${x + 2 * s}" cy="-7" r="3.2" fill="@corps" stroke="@corpsO" stroke-width="0.5"/><circle cx="${x + 2 * s}" cy="-7" r="1.4" fill="@corpsO"/>`;
  return `<path d="M${x} -5 q${3 * s} -8 ${6 * s} -6 q${-1 * s} 5 ${-3 * s} 7 z" fill="@corps" stroke="@corpsO" stroke-width="0.5"/>`;
}

/** Oreilles vues de FACE. `big` = grandes oreilles rondes à intérieur rose (rat) ; sinon petites. */
export function earsFront(p: QuadProps, o: { big?: boolean } = {}): string {
  if (p.ears === 'pointues') // oreilles dressées INCLINÉES VERS L'EXTÉRIEUR + intérieur clair → lues
    // comme des oreilles (canin/félin), PAS des cornes verticales. Base large attachée au crâne.
    return `<path d="M-6 -12 Q-13 -19 -12.5 -13 Q-11 -10 -5 -11 Z" fill="@corps" stroke="@corpsO" stroke-width="0.5"/><path d="M-7 -12 Q-11 -16 -11 -12.6 Q-10 -10.8 -6 -11.4 Z" fill="@peauO" opacity="0.55"/>` +
      `<path d="M6 -12 Q13 -19 12.5 -13 Q11 -10 5 -11 Z" fill="@corps" stroke="@corpsO" stroke-width="0.5"/><path d="M7 -12 Q11 -16 11 -12.6 Q10 -10.8 6 -11.4 Z" fill="@peauO" opacity="0.55"/>`;
  if (p.ears === 'rondes') { // rat = grandes oreilles rondes (intérieur rose) ; ours = petites, hautes
    const big = !!o.big;
    const r = big ? 4.6 : 2.8, dx = big ? 9 : 8, dy = big ? -13 : -13.5, inr = big ? 2.4 : 1.2, inf = big ? '#d8a0a0' : '@peauO';
    return `<circle cx="${-dx}" cy="${dy}" r="${r}" fill="@corps" stroke="@corpsO" stroke-width="0.5"/><circle cx="${-dx}" cy="${dy + 0.4}" r="${inr}" fill="${inf}"/>` +
      `<circle cx="${dx}" cy="${dy}" r="${r}" fill="@corps" stroke="@corpsO" stroke-width="0.5"/><circle cx="${dx}" cy="${dy + 0.4}" r="${inr}" fill="${inf}"/>`;
  }
  // courtes (cheval) : oreilles fines incurvées vers l'extérieur (pas droites)
  return `<path d="M-5 -12 Q-9 -20 -4 -19 Q-3 -15 -2 -13 Z" fill="@corps" stroke="@corpsO" stroke-width="0.5"/><path d="M-5 -13 Q-7 -18 -4.5 -17.6 Q-4 -15 -3 -13.6 Z" fill="@peauO" opacity="0.5"/>` +
    `<path d="M5 -12 Q9 -20 4 -19 Q3 -15 2 -13 Z" fill="@corps" stroke="@corpsO" stroke-width="0.5"/><path d="M5 -13 Q7 -18 4.5 -17.6 Q4 -15 3 -13.6 Z" fill="@peauO" opacity="0.5"/>`;
}

/**
 * Arrière de la tête à la MÊME échelle que la face (de dos on voit le crâne + la nuque + le
 * dos des oreilles — pas de museau, normal) : crâne rond clair (@corps, pas @corpsO « ombre »),
 * oreilles dressées, épi/crinière sur la nuque. Plus une « petite bosse sombre ».
 * `ruff` = collerette qui fait le tour du crâne (félin) ; `earsBig`/`earsInner` = gabarit et
 * intérieur des oreilles rondes (rat, ours).
 */
export function napeGeneric(p: QuadProps, o: { ruff?: string; earsBig?: boolean; earsInner?: string } = {}): string {
  const earBack = p.ears === 'rondes'
    ? (() => { const big = !!o.earsBig; const r = big ? 4.4 : 3.4, dx = big ? 8 : 7; const inf = o.earsInner ?? '@corpsO';
        return `<circle cx="${-dx}" cy="-13" r="${r}" fill="@corps" stroke="@corpsO" stroke-width="0.5"/><circle cx="${-dx}" cy="-13" r="${r * 0.5}" fill="${inf}" opacity="0.6"/>` +
          `<circle cx="${dx}" cy="-13" r="${r}" fill="@corps" stroke="@corpsO" stroke-width="0.5"/><circle cx="${dx}" cy="-13" r="${r * 0.5}" fill="${inf}" opacity="0.6"/>`; })()
    : p.ears === 'pointues'
      ? `<path d="M-5 -11 Q-12 -22 -10.5 -13 Q-9.5 -10 -4 -11 Z" fill="@corps" stroke="@corpsO" stroke-width="0.5"/><path d="M-6 -12 Q-10 -18 -9.5 -13 Q-8.5 -11.4 -5 -12 Z" fill="@corpsO" opacity="0.6"/>` +
        `<path d="M5 -11 Q12 -22 10.5 -13 Q9.5 -10 4 -11 Z" fill="@corps" stroke="@corpsO" stroke-width="0.5"/><path d="M6 -12 Q10 -18 9.5 -13 Q8.5 -11.4 5 -12 Z" fill="@corpsO" opacity="0.6"/>`
      : `<path d="M-4 -12 Q-8 -21 -3 -20 Q-2 -16 -1 -13 Z" fill="@corps" stroke="@corpsO" stroke-width="0.5"/><path d="M4 -12 Q8 -21 3 -20 Q2 -16 1 -13 Z" fill="@corps" stroke="@corpsO" stroke-width="0.5"/>`;
  // crâne/nuque : ovale large (≈ la face de front) qui se prolonge en nuque vers les épaules.
  const skull = `<path d="M-8.5 -12 Q-10 0 -5 9 Q0 13 5 9 Q10 0 8.5 -12 Q0 -16 -8.5 -12 Z" fill="@corps" stroke="@corpsO" stroke-width="0.7"/>`;
  const shade = `<path d="M-6.5 -11 Q-2 -14 1 -13 Q-1 -2 0 8 Q-3 5 -5.5 -4 Z" fill="@corpsH" opacity="0.22"/>` +
    `<path d="M0 -13 Q1 -1 0 10" fill="none" stroke="@corpsO" stroke-width="0.7" opacity="0.4"/>`;
  // épi de crinière sur la nuque (équin couché / loup hirsute) — tell de l'arrière de l'encolure.
  const m = p.mane;
  const mane = m === 'crin' ? `<path d="M-2.4 -13 Q-3 -1 -2 10 L2 10 Q3 -1 2.4 -13 Q0 -15 -2.4 -13 Z" fill="@cheveux" stroke="@cheveuxO" stroke-width="0.4" opacity="0.85"/>`
    : m === 'hirsute' ? `<path d="M0 -14 l-2.5 -3 l0.6 3.4 l-3 -1.6 l1.4 3.4 Q-2 0 -1.4 9 L1.4 9 Q2 0 1.4 -8 l3 -2 l-2.6 -0.4 l1.6 -3 Z" fill="@cheveux" stroke="@cheveuxO" stroke-width="0.4"/>` : '';
  return `<g>${o.ruff ?? ''}${earBack}${skull}${shade}${mane}</g>`;
}

// --- Têtes-SATELLITES des clusters multi-cous (hydre / chimère / déchiqueteur) : dessinées dans
// UN os (encolure en profil, tete de face/dos) → le cluster ondule d'un bloc, pas besoin d'os
// supplémentaires. Repère local de chaque satellite : museau vers +x.

// Tête reptilienne à GUEULE BÉANTE rouge sang (artwork LDB 79 p.323) : mâchoires ouvertes + crocs,
// œil fendu doré, petite crête d'épines @cheveux derrière le crâne.
// `far` = tête/cou du rang LOINTAIN (robe @corpsO, plus sombre → profondeur de l'entrelacs).
export function hydraHeadlet(tx: number, ty: number, rot: number, s: number, far = false): string {
  const c = far ? '@corpsO' : '@corps';
  const o = far ? '#141c0c' : '@corpsO';
  const maw = far ? '#5a100c' : '#7e1410';
  return `<g transform="translate(${tx},${ty}) rotate(${rot}) scale(${s})">` +
    `<path d="M-3.6 -2.6 q-2.8 -3.2 -6 -3.6 q2.6 1.8 3.4 4 q-2.6 -1.4 -4.8 -1 q2.4 1.4 3.4 3 Z" fill="@cheveux" stroke="@cheveuxO" stroke-width="0.35"/>` +
    `<path d="M0 2.6 Q2.6 7.4 7 9.6 Q10.6 11 11.8 9.4 Q9.4 7.6 7 5.6 Q3.8 3.2 1.2 2.4 Z" fill="${c}" stroke="${o}" stroke-width="0.5"/>` +
    `<path d="M0.8 2.8 Q5.4 4.6 10.6 8.2 Q12.4 4.4 13.2 0.6 Q7.4 2.4 0.8 2.8 Z" fill="${maw}"/>` +
    `<path d="M-4.6 -2.4 Q-6 1 -2.6 2.6 Q2 3.6 7.6 2.4 Q11.8 1.4 13.8 -0.8 Q14.6 -1.8 13.2 -2.6 Q8 -3.8 3 -3.4 Q-1.6 -3.4 -4.6 -2.4 Z" fill="${c}" stroke="${o}" stroke-width="0.55"/>` +
    `<path d="M4.6 2.8 l0.5 2 l1 -1.7 M7.8 2.2 l0.5 1.9 l1 -1.7 M10.8 1.2 l0.4 1.7 l0.9 -1.5 M4.2 4.4 l-0.2 -1.7 M6.8 6 l0.3 -1.9 M9.2 7.6 l0.5 -1.8" stroke="#e8e0c8" stroke-width="0.5" fill="none"/>` +
    `<ellipse cx="1.6" cy="-1" rx="1.25" ry="1.45" fill="#d8b020"/><ellipse cx="1.6" cy="-1" rx="0.4" ry="1.3" fill="#0a0603"/>` +
    `<path d="M-0.4 -2.4 Q1.8 -3.2 3.8 -2.2" stroke="${o}" stroke-width="0.7" fill="none"/>` +
    `</g>`;
}
export function hydraNeck(x1: number, y1: number, cx: number, cy: number, x2: number, y2: number, far = false): string {
  const c = far ? '@corpsO' : '@corps';
  const d = `M${x1} ${y1} Q${cx} ${cy} ${x2} ${y2}`;
  return `<path d="${d}" fill="none" stroke="${c}" stroke-width="${far ? 4.6 : 5.5}" stroke-linecap="round"/>` +
    `<path d="${d}" fill="none" stroke="${far ? '#141c0c' : '@corpsO'}" stroke-width="1.3" opacity="0.45" stroke-linecap="round"/>` +
    // bandes d'écailles en reflet métallique (rang proche seulement)
    (far ? '' : `<path d="${d}" fill="none" stroke="@corpsH" stroke-width="1.4" opacity="0.4" stroke-linecap="round" stroke-dasharray="1.6 2.8"/>`);
}
// Déchiqueteur de Cadavres : MÊME satellite que l'hydre, mais tête ROUGE VIF sur cou gris-bleu
// (artwork ZI 5 p.58 : têtes serpentines écarlates contrastées, dents proéminentes, regard perçant
// clair, piquants sombres derrière chaque crâne). `far` = rang lointain (rouge sombre @cheveuxO).
export function shredderHeadlet(tx: number, ty: number, rot: number, s: number, far = false): string {
  const c = far ? '@cheveuxO' : '@cheveux';
  const o = far ? '#2a0c08' : '@cheveuxO';
  const maw = far ? '#1c0d0b' : '#30110d';
  return `<g transform="translate(${tx},${ty}) rotate(${rot}) scale(${s})">` +
    `<path d="M-3.6 -2.6 q-2.4 -3.6 -5.6 -4.2 q2.2 2 3 4.2 q-2.8 -1.6 -5 -1.2 q2.4 1.5 3.4 3.1 Z" fill="@corpsO" stroke="#14161c" stroke-width="0.35"/>` + // piquants sombres de nuque
    `<path d="M0 2.6 Q2.6 7.4 7 9.6 Q10.6 11 11.8 9.4 Q9.4 7.6 7 5.6 Q3.8 3.2 1.2 2.4 Z" fill="${c}" stroke="${o}" stroke-width="0.5"/>` + // mâchoire inférieure décrochée
    `<path d="M0.8 2.8 Q5.4 4.6 10.6 8.2 Q12.4 4.4 13.2 0.6 Q7.4 2.4 0.8 2.8 Z" fill="${maw}"/>` + // gueule béante
    `<path d="M-4.6 -2.4 Q-6 1 -2.6 2.6 Q2 3.6 7.6 2.4 Q11.8 1.4 13.8 -0.8 Q14.6 -1.8 13.2 -2.6 Q8 -3.8 3 -3.4 Q-1.6 -3.4 -4.6 -2.4 Z" fill="${c}" stroke="${o}" stroke-width="0.55"/>` + // crâne + long museau
    `<path d="M4.2 2.9 l0.6 2.5 l1.3 -2.1 M7.4 2.3 l0.6 2.4 l1.2 -2.1 M10.6 1.3 l0.5 2.1 l1 -1.9 M3.9 4.6 l-0.3 -2 M6.6 6.2 l0.4 -2.3 M9.2 7.7 l0.6 -2.1" stroke="#e9e2cd" stroke-width="0.65" fill="none"/>` + // dents PROÉMINENTES
    `<ellipse cx="1.6" cy="-1" rx="1.25" ry="1.45" fill="#cfd4da"/><ellipse cx="1.6" cy="-1" rx="0.4" ry="1.3" fill="#0a0603"/>` + // œil perçant gris pâle fendu
    `<path d="M-0.4 -2.4 Q1.8 -3.2 3.8 -2.2" stroke="${o}" stroke-width="0.7" fill="none"/>` +
    `</g>`;
}
// Chimère, tête LÉONINE (ZI 66 : « l'une est léonine, une autre est celle d'un grand rapace et la
// troisième celle d'un dragon ») : crinière RAYONNANTE en couronne (le tell félin, cf. face 'felin'),
// crâne rond, museau COURT à gueule ouverte et crocs de sabre (artwork ZI 6 p.66 : mufle de lion,
// pas de loup).
export function lionHeadlet(tx: number, ty: number, rot: number, s: number): string {
  return `<g transform="translate(${tx},${ty}) rotate(${rot}) scale(${s})">` +
    `<path d="M-1 -11 L-3.6 -8.2 L-7.6 -10 L-7 -6.2 L-11.4 -6.6 L-8.8 -3.4 L-12.6 -1.4 L-8.6 0.6 L-11 4 L-6.8 3.6 L-7.6 7.8 L-3.8 5.6 L-3.4 10 L-0.2 6.6 L2.6 10 L3.6 5.8 L7.6 7.4 L6 3.4 L9.6 2.4 L6.4 -0.2 L9.2 -3.2 L5.2 -3.6 L6.4 -7.6 L2.6 -5.8 L1.8 -9.8 Z" fill="@cheveux" stroke="@cheveuxO" stroke-width="0.5"/>` + // crinière rayonnante
    `<circle cx="-1.2" cy="-0.6" r="6.6" fill="@cheveuxO" opacity="0.3"/>` +
    `<path d="M-4.2 -4.2 Q-6.6 -0.6 -4.6 2.4 Q-2.4 4.8 1.4 4.9 Q5 5 7.4 3.4 Q9.6 2 9.8 0 Q9.9 -1.8 7.6 -3 Q2.2 -5.5 -4.2 -4.2 Z" fill="@corps" stroke="@corpsO" stroke-width="0.6"/>` + // crâne rond + museau court
    `<path d="M4 -1 Q7.4 -1.8 9.5 -0.4 Q9.4 1.8 7.2 3.2 Q4.8 2.4 4 -1 Z" fill="@corpsH" opacity="0.5"/>` + // mufle clair
    `<path d="M3.2 4.4 Q5.2 8 9 8.6 Q10.8 8.2 10.2 6.6 Q7 6.2 5 4.4 Z" fill="@corps" stroke="@corpsO" stroke-width="0.5"/>` + // mâchoire tombée
    `<path d="M4.6 4.6 Q7 5.6 9.6 6.4 Q9.9 4.8 9.8 3.2 Q7 4.2 4.6 4.6 Z" fill="#5c0f0c"/>` + // gueule
    `<path d="M6 4.4 l0.5 3.2 l1.1 -2.7 Z M8.6 3.4 l0.5 2.6 l1 -2.2 Z" fill="#e8e0c8" stroke="#8a8060" stroke-width="0.3"/>` + // crocs de sabre
    `<path d="M9.1 1.2 l1.5 0.8 l-1.3 1 Z" fill="#1a0f08"/>` + // truffe
    `<path d="M-0.6 -3.2 Q1.6 -4 3.8 -2.8" stroke="@corpsO" stroke-width="0.8" fill="none"/>` + // sourcil
    `<ellipse cx="1.6" cy="-1.4" rx="1.3" ry="1.4" fill="#d8a020"/><circle cx="1.8" cy="-1.4" r="0.55" fill="#0a0603"/></g>`;
}
// Chimère, tête de DRAGON-crocodile : long museau bas bardé de dents débordantes, cornes balayées en
// arrière, œil fendu doré — distincte de la gueule de loup d'hydraHeadlet (artwork ZI 6 p.66).
export function dragonHeadlet(tx: number, ty: number, rot: number, s: number): string {
  return `<g transform="translate(${tx},${ty}) rotate(${rot}) scale(${s})">` +
    `<path d="M-2.6 -3 Q-7.4 -6.4 -10.6 -6 Q-7.4 -4 -5.4 -1.6 Z" fill="@cheveux" stroke="@cheveuxO" stroke-width="0.4"/>` + // corne basse
    `<path d="M-0.6 -3.8 Q-4.6 -8.2 -8 -8.6 Q-5.2 -5.8 -3.2 -2.8 Z" fill="@cheveux" stroke="@cheveuxO" stroke-width="0.4"/>` + // corne haute
    `<path d="M1 2.8 Q4.6 5.8 9.6 6.6 Q12.6 6.6 13.2 5.2 Q9.4 4.6 5.6 3.2 Q3 2.4 1 2.8 Z" fill="@corps" stroke="@corpsO" stroke-width="0.5"/>` + // mâchoire inférieure
    `<path d="M1.6 2.9 Q7 4.6 12.6 5 Q13.6 3.4 14 1.4 Q7.6 2.6 1.6 2.9 Z" fill="#6e1410"/>` + // gueule entrouverte
    `<path d="M-4.6 -3 Q-6.4 0.4 -3.6 2.2 Q0.6 3.6 6 3.2 Q11 2.8 14.4 1 Q15.6 0.2 14.6 -1 Q10 -2.6 5 -2.8 Q-0.6 -3.4 -4.6 -3 Z" fill="@corps" stroke="@corpsO" stroke-width="0.55"/>` + // crâne bas + LONG museau
    `<path d="M4 3 l0.4 1.8 l1 -1.5 M7.2 3.2 l0.4 1.7 l0.9 -1.4 M10 2.8 l0.4 1.6 l0.9 -1.4 M12.4 2.2 l0.3 1.5 l0.8 -1.3 M5.6 4.9 l-0.2 -1.5 M8.6 5.6 l0.2 -1.7" stroke="#e8e0c8" stroke-width="0.45" fill="none"/>` + // dents débordantes
    `<path d="M-1 -2.6 Q6 -2.4 13 -0.8" stroke="@corpsO" stroke-width="0.7" fill="none" opacity="0.7"/>` + // arête écailleuse du museau
    `<ellipse cx="13" cy="-0.2" rx="0.5" ry="0.35" fill="#1a0e08"/>` + // naseau
    `<ellipse cx="0.8" cy="-1" rx="1.2" ry="1.4" fill="#d8b020"/><ellipse cx="0.8" cy="-1" rx="0.4" ry="1.25" fill="#0a0603"/>` + // œil fendu
    `<path d="M-1.4 -2.6 Q0.8 -3.4 3 -2.4" stroke="@corpsO" stroke-width="0.7" fill="none"/></g>`;
}
// Chimère, tête de RAPACE : bec crochu jaune + œil féroce sous sourcil saillant + plumes de nuque.
export function raptorHeadlet(tx: number, ty: number, rot: number, s: number): string {
  return `<g transform="translate(${tx},${ty}) rotate(${rot}) scale(${s})">` +
    `<path d="M-5 -3.5 Q-6.5 2.5 -1.5 4.5 Q3 6 7.5 4.8 Q10 3.8 9.5 1.5 Q5.5 1 2 -0.5 Q-1 -2 -2 -4.5 Q-3.5 -6 -5 -3.5 Z" fill="@corps" stroke="@corpsO" stroke-width="0.6"/>` +
    `<path d="M-4.5 -3 l-2.6 -2.4 l0.6 3 M-2.8 -4.6 l-1.8 -3 l0 3.2" stroke="@corpsO" stroke-width="0.9" fill="none" stroke-linecap="round"/>` + // plumes de nuque
    `<path d="M7 1.2 Q12.5 0.8 14 3.4 Q12.6 5 9.8 5 Q8 6.6 7 4.6 Z" fill="#d4a82e" stroke="#7a5a18" stroke-width="0.4"/>` +
    `<path d="M12.8 3.6 Q14.4 4.4 13.2 6.4 Q11.4 6.2 10.4 4.8 Z" fill="#c79a26" stroke="#7a5a18" stroke-width="0.35"/>` + // crochet du bec
    `<ellipse cx="2.2" cy="-0.8" rx="1.4" ry="1.5" fill="#e8b820"/><circle cx="2.5" cy="-0.8" r="0.65" fill="#0a0603"/>` +
    `<path d="M-0.5 -2.8 Q2.5 -4 5.4 -2.2" stroke="@corpsO" stroke-width="0.9" fill="none"/></g>`;
}
