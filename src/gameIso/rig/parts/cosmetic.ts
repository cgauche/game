import type { PartArt } from './types';
import { baseSpeciesOf } from '../skeletons';
import { PART_BEHIND_SEP, PART_DROP_SEP } from '../bones';
import { HEADS_BY_KEY } from './heads';
import { hairstylesForSex, type HairArt } from './hairstyles';
// Têtes (visage + coiffure défaut) en heads/defs, coiffures en hairstyles/defs — CHAQUE chevelure
// porte ses 3 vues + composantes `behind` (masse qui épouse le crâne) et `drop` (chute qui dépasse
// la tête) éventuelles PAR vue (HairArt), pliées ici dans la chaîne de vue (dépliées par composeRig :
// behind → layer −2, drop → plan dorsal ; cf. splitPartBehind dans bones.ts).
// Seul le profil/dos du VISAGE reste un art GÉNÉRIQUE token ci-dessous (PROFILE_FACE / BACK_NAPE).

const foldView = (main: string, behind?: string, drop?: string) => {
  const folded = behind ? `${behind}${PART_BEHIND_SEP}${main}` : main;
  return drop ? `${drop}${PART_DROP_SEP}${folded}` : folded;
};
const foldHair = (h: HairArt): PartArt => ({
  front: foldView(h.front, h.behind?.front, h.drop?.front),
  profile: foldView(h.profile, h.behind?.profile, h.drop?.profile),
  back: foldView(h.back, h.behind?.back, h.drop?.back),
});

// Œil de secours : blanc + iris @yeux + pupille (PAS le gradient monstre g_eye).
// ANCRÉ data-eye comme les têtes générées → remplaçable par le système d'yeux
// (parts/eyes.ts : Vampire rougeoyant, œil de verre…) même sans tête dédiée.
const eye = (cx: number) =>
  `<g data-eye="${cx < 0 ? 'G' : 'D'}" data-ec="${cx} 7"><ellipse cx="${cx}" cy="7" rx="2" ry="1.3" fill="#f3ede1"/><circle cx="${cx}" cy="7" r="1.1" fill="@yeux"/><circle cx="${cx}" cy="7" r="0.6" fill="#140a06"/></g>`;

// Visage de REPLI (espèce sans tête dédiée en heads/defs, ex. Ogre) : crâne @peau + yeux ancrés.
const DEFAULT_VISAGE: string[] = [
  `<circle cx="0" cy="7" r="9" fill="@peau"/>${eye(-3)}${eye(3)}`,
  `<circle cx="0" cy="7" r="9" fill="@peauO"/>${eye(-3)}${eye(3)}`,
];

// =========================================================================================
// VUES PROFIL / DOS du VISAGE — art générique COMMUN (partagé par toutes les espèces),
// 100 % en tokens (@peau/@cheveux…) pour recoloriage correct. La FACE reste l'art détaillé
// par espèce (heads/defs) ; ici on dessine un profil/dos PROPRES qui matchent ses proportions :
// crâne ovale (x±9, y -9..16), yeux à y≈6.6, bouche à y≈12.6. Le profil regarde vers +x.
// (Les CHEVEUX, eux, portent leurs vues DANS leur def — HairArt — plus d'art générique partagé.)
// =========================================================================================

// Nuque/cou vus de dos (le crâne est couvert par les cheveux de la coiffure, la base se fond vers
// le col de la tenue) — cylindre modelé (galbe + ombre portée des cheveux + tendons), PAS un
// trapèze plat : bande exposée entre le bas des cheveux et le col, qui se lit comme un COU.
const BACK_NAPE =
  // silhouette arrondie (coins galbés, pas de coin droit)
  '<path d="M-3.6 11.2 Q0 13.2 3.6 11.2 Q4.2 14.4 3.4 17.6 Q0 19.6 -3.4 17.6 Q-4.2 14.4 -3.6 11.2Z" fill="@peau"/>' +
  // ombre portée par les cheveux, juste sous la ligne d'implantation (fondu, pas un trait net)
  '<path d="M-3.6 11.2 Q0 13.2 3.6 11.2 Q3.1 12.6 0 13.1 Q-3.1 12.6 -3.6 11.2Z" fill="@peauO" opacity="0.5"/>' +
  // volume cylindrique : flancs ombrés vers les oreilles
  '<path d="M-3.6 11.2 Q-4.2 14.4 -3.4 17.6 Q-3.9 14.6 -3 12Z" fill="@peauO" opacity="0.35"/>' +
  '<path d="M3.6 11.2 Q4.2 14.4 3.4 17.6 Q3.9 14.6 3 12Z" fill="@peauO" opacity="0.35"/>' +
  // reflet central (galbe de la nuque)
  '<path d="M-0.9 13.2 Q0 12.8 0.9 13.2 Q1 15.4 0.6 17.4 L-0.6 17.4 Q-1 15.4 -0.9 13.2Z" fill="@peauH" opacity="0.4"/>' +
  // tendons / creux de la base du crâne (fondu vers le col)
  '<path d="M-2.4 16.8 Q0 17.8 2.4 16.8" stroke="@peauO" stroke-width="0.4" fill="none" opacity="0.3"/>';

// VISAGE de PROFIL générique (tokens) : silhouette de côté propre — front, arête du nez, lèvres,
// menton, un œil, une oreille. Remplace l'art headViews profil (hardcodé, déformé). Regarde +x.
const PROFILE_FACE =
  // contour du visage : crâne arrière arrondi (-x) → front (+x) → nez → lèvres → menton → mâchoire
  '<path d="M-8.5 5 Q-9 -2 -1 -2.2 ' + // sommet du crâne
  'Q5 -2 7.2 2.4 ' +                    // front bombé vers l'avant
  'Q8 4 7 5.2 ' +                       // arête au-dessus du nez
  'Q9.2 6.4 8.3 8.2 ' +                 // pointe du nez (saillie +x)
  'Q7.6 9.2 6.4 9.3 ' +                 // base du nez
  'Q7 10.6 5.8 11.4 ' +                 // lèvre supérieure
  'Q6.4 12.6 5.4 13.6 ' +               // menton avancé
  'Q3 16.4 -1 15.6 ' +                  // mâchoire / sous le menton
  'Q-7 14.5 -8.5 5Z" fill="@peau"/>' +
  // joue/tempe en ombre (côté arrière) pour le volume
  '<path d="M-8.5 5 Q-9 -2 -1 -2.2 Q-5 -1.4 -6.4 4 Q-7.4 9.5 -3.4 14.6 Q-7 13.4 -8.5 5Z" fill="@peauO" opacity="0.55"/>' +
  // reflet sur le front/nez (lumière de face)
  '<path d="M2 -1.6 Q6 -1 7.2 2.4 Q8 4 7 5.2 Q5.4 3 2.6 2.2 Q1.4 0 2 -1.6Z" fill="@peauH" opacity="0.5"/>' +
  // sourcil
  '<path d="M2.2 3.6 Q4.6 2.6 6.4 3.8" stroke="@cheveuxO" stroke-width="0.9" fill="none" stroke-linecap="round"/>' +
  // œil (de profil : amande, iris vers l'avant)
  '<ellipse cx="3.9" cy="5.9" rx="1.5" ry="1.15" fill="#f3ede1"/>' +
  '<circle cx="4.6" cy="6" r="1" fill="@yeux"/><circle cx="4.7" cy="6.1" r="0.6" fill="#140a06"/>' +
  // narine + bouche + ligne du menton
  '<path d="M7.4 8.4 Q6.6 8.8 6.2 8.2" stroke="@peauO" stroke-width="0.5" fill="none" stroke-linecap="round"/>' +
  '<path d="M5 11.8 Q6 12 6.2 11.4" stroke="#8a4a3a" stroke-width="0.7" fill="none" stroke-linecap="round"/>' +
  // oreille (côté arrière, vers -x)
  '<path d="M-2.6 6.4 Q-4.6 5.6 -4.8 7.8 Q-4.6 9.8 -2.4 9.4 Q-3.4 8 -2.6 6.4Z" fill="@peau" stroke="@peauO" stroke-width="0.45"/>' +
  '<path d="M-3.6 7.2 Q-4 8 -3.4 8.6" stroke="@peauO" stroke-width="0.4" fill="none"/>';

/** Part cosmétique (toujours espèce×sexe). slot ∈ {visage, cheveux}.
 *  Priorité à la tête dédiée (heads/defs, art LDB) ; sinon visage de repli générique.
 *  CHEVEUX : choix dans [défaut de tête, ...pool de coiffures partagé (hairstyles/defs)] via idx. */
export function cosmeticPart(slot: 'visage' | 'cheveux', species: string, sex: 'M' | 'F', idx: number): PartArt {
  const head = HEADS_BY_KEY[`${baseSpeciesOf(species)}:${sex}`];
  if (slot === 'cheveux') {
    // Pool = [coiffure par défaut de la tête, ...coiffures du sexe] — CHAQUE entrée porte ses
    // 3 vues + `behind` éventuel (HairArt). L'idx (pins.cheveux / seed) choisit.
    const entries: HairArt[] = [
      ...(head?.cheveux != null ? [head.cheveux] : []),
      ...hairstylesForSex(sex),
    ];
    if (!entries.length) return ''; // aucun pool (jamais atteint : le pool par sexe est non vide)
    return foldHair(entries[((idx % entries.length) + entries.length) % entries.length]);
  }
  // Visage : art de tête dédié (dos = nuque, profil = silhouette générique commune à toutes les
  // espèces), sinon repli générique (espèce sans tête, ex. Ogre). `idx` (override/seed) choisit
  // la variante dans le pool de la tête — même convention que les cheveux (pool + idx modulo).
  const pool = head?.visage?.length ? head.visage : DEFAULT_VISAGE;
  const visage = pool[((idx % pool.length) + pool.length) % pool.length];
  return { front: visage, back: BACK_NAPE, profile: PROFILE_FACE };
}
