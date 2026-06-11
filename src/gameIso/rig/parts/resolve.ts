import type { Slot } from '../bones';
import { pickView, type Part, type PartArt } from './types';
import type { View } from '../facing';
import { cosmeticPart } from './cosmetic';
import { genericPart } from './generic';
import { careerTenueFor } from './career';
import { armourPart, weaponPart, shieldPart, isShield, type EquipCtx } from './equipment';

const BODY_SLOTS: Slot[] = ['tete', 'bras', 'torse', 'jambes'];

// --- Profil : silhouettes de CÔTÉ du corps (le pantin est de face ; de profil le
// torse/les jambes doivent être plus étroits et le buste légèrement avancé). Elles sont
// PEINTES EN TOKENS (`@vet1`/`@cuir`…) dérivés de la tenue → elles SUIVENT le recoloriage
// de carrière au lieu d'un gris muet → cohérent de profil pour TOUTE tenue sans art dédié.
// Une tenue PEUT fournir `profile` sur torse/jambes/tete pour un rendu détaillé (prioritaire,
// p.ex. Soldat). Le token de tissu dominant est déduit du fragment FRONT (cf. dominantCloth). ---
const PROFILE_TORSE = (t: string) =>
  // buste de côté (poitrine avancée +x) avec reflet avant + ombre dorsale, en token tissu.
  `<path d="M-5 -28 Q3 -31 7 -26 Q8.5 -10 6 4 L5 33 Q-1 37 -6 33 L-5 4 Q-7 -13 -5 -28 Z" fill="@${t}" stroke="@${t}O" stroke-width="0.6"/>` +
  `<path d="M3 -27 Q6 -10 4.6 4 L4 30" fill="none" stroke="@${t}H" stroke-width="0.8" opacity="0.5"/>` +
  `<path d="M-5 -2 Q-7 -13 -5 -28 Q-3 -30 -1 -29 L-1 4 Z" fill="@${t}O" opacity="0.5"/>`;
const PROFILE_JAMBE = (t: string, boot = 'cuir') =>
  // jambe de côté (token tissu) + genou (renflement ~y22) + botte (bas, @boot) qui pointe
  // vers l'avant : sinon de profil la jambe est un poteau nu sans botte ni genou. Le token de
  // botte est `cuir` pour les habillés, `peau` pour les nus (bas de jambe nu + griffes ajoutées
  // par CLAWFOOT) → pas de botte de cuir brune incohérente sur un monstre nu.
  `<path d="M-3.2 0 Q-4 18 -2.6 30 L-2.6 30 Q-4 40 -2.4 49 L3.4 49 Q4 24 3.2 0 Z" fill="@${t}" stroke="@${t}O" stroke-width="0.5"/>` +
  `<path d="M-3.6 18 Q-5 22 -2.8 26 Q2.4 27 4.2 23 Q4.8 19 2.8 16 Q0 17 -3.6 18 Z" fill="@${t}H" stroke="@${t}O" stroke-width="0.5" opacity="0.85"/>` +
  `<path d="M-3 32 Q-3.9 42 -2.4 49 L4.2 49 Q4.6 46 4 42 L3.7 32 Q0 34 -3 32 Z" fill="@${boot}" stroke="@${boot}O" stroke-width="0.5"/>` +
  `<path d="M3.7 34 L7.8 34 Q9 38 7.6 41 L4 41Z" fill="@${boot}" stroke="@${boot}O" stroke-width="0.4"/>`; // bout de la botte (+x)
// Couvre-chef de PROFIL générique : seulement si la tenue a un couvre-chef de FACE (tete non
// vide). Calotte de côté en token, couvrant le sommet, visage dégagé. Si pas de couvre-chef,
// resolveParts laisse tete vide → la tête nue (cheveux profil cosmétiques) s'affiche.
const PROFILE_TETE = (t: string) =>
  `<path d="M-8 -2 Q-8.5 -12 0 -13 Q7 -12 8 -3 Q1 -6 -8 -2Z" fill="@${t}" stroke="@${t}O" stroke-width="0.6"/>` +
  `<path d="M-7 -3 Q-7.5 -11 0 -12.4 Q3 -11.6 4 -3 Q-1 -5.6 -7 -3Z" fill="@${t}H" opacity="0.4"/>`;

/** Token de tissu DOMINANT d'un fragment de tenue (pour peindre la silhouette de profil avec
 *  la bonne famille de couleur). Compte les occurrences de @vet1/@vet2/@cuir/@metal ; défaut vet1.
 *  (Le gradient g_steel/g_robe… → metal/vet1 approximatif pour l'art non tokenisé restant.) */
function dominantCloth(svg: string): string {
  // peau/corps en DERNIER : un habit (vet/cuir/metal) gagne les égalités ; mais une tenue
  // « Nu » (100 % @peau) n'a aucun token de tissu → on retombe sur @peau (et non vet1 brun),
  // sinon le torse/jambes de profil d'un monstre nu vire au brun incohérent.
  const cand = ['vet1', 'vet2', 'cuir', 'metal', 'peau', 'corps'] as const;
  let best = 'vet1', bestN = -1;
  for (const c of cand) {
    const n = (svg.match(new RegExp(`@${c}\\b`, 'g')) ?? []).length;
    if (n > bestN) { bestN = n; best = c; }
  }
  if (bestN <= 0) {
    if (/g_steel/.test(svg)) return 'metal';
    if (/g_cloak|g_crest/.test(svg)) return 'vet1';
    if (/g_robe/.test(svg)) return 'vet2';
  }
  return best;
}
const hasProfileView = (p: PartArt | undefined): boolean => typeof p === 'object' && p != null && !!p.profile;

// Pied DIRECTIONNEL (repère os `pied`, origine = cheville, +y descend). Dessiné
// par-dessus le bas de jambe → un pied de profil pointe vers l'avant (botte de côté),
// de face un bout arrondi, de dos un talon. Botte de cuir neutre (couvre la plupart
// des tenues). C'est ce qui manquait : les pieds changent enfin selon la direction.
// Main (poing) directionnelle, repère os `main` (origine = poignet, +y descend).
// Le raccord à la manche est GÉOMÉTRIQUE (pivot du poignet à 14, cf. skeletons.ts) :
// le poing chevauche la fin du bras peint, sans pont de chair rapporté.
const HAND: PartArt = {
  front: `<ellipse cx="0" cy="2.6" rx="2.8" ry="3.2" fill="@peau" stroke="@peauO" stroke-width="0.5"/><path d="M-1.4 1.6 h2.8 M-1.4 3.2 h2.8" stroke="@peauO" stroke-width="0.4" opacity="0.5"/>`,
  back: `<ellipse cx="0" cy="2.6" rx="2.8" ry="3.2" fill="@peauO" stroke="@peauO" stroke-width="0.5"/>`,
  profile: `<ellipse cx="0.6" cy="2.6" rx="2.6" ry="3.2" fill="@peau" stroke="@peauO" stroke-width="0.5"/>`,
};
const FOOT: PartArt = {
  front: `<path d="M-3.4 -1 Q-4.4 7 0 8 Q4.4 7 3.4 -1 Z" fill="#3a2614" stroke="#1f1408" stroke-width="0.6"/><path d="M-3.6 6.5 Q0 8.6 3.6 6.5 L3.4 8 Q0 9.4 -3.4 8 Z" fill="#241608"/>`,
  back: `<path d="M-3.2 -1 Q-3.8 6 0 6.5 Q3.8 6 3.2 -1 Z" fill="#2e1f10" stroke="#1a1208" stroke-width="0.5"/>`,
  profile: `<path d="M-3 -1 L-3 5 Q-3 7.4 0 7.4 L8.6 7.4 Q10.6 7.4 9.4 4 L5.4 1 Z" fill="#3a2614" stroke="#1f1408" stroke-width="0.6"/><path d="M-3 6.4 L9.6 6.4 L9.8 8 Q4 9 -3 8 Z" fill="#241608"/>`,
};
// Pied NU GRIFFU (espèces nues : squelette/goule/troll…) — chair/os/pelage `@peau` + griffes
// sombres (au lieu de la botte de cuir, incohérente sur un monstre nu).
const CLAWFOOT: PartArt = {
  front: `<path d="M-3.4 -1 Q-4.2 6 0 7 Q4.2 6 3.4 -1 Z" fill="@peau" stroke="@peauO" stroke-width="0.5"/><path d="M-2.4 6 l-0.5 2.7 M0 6.6 l0 2.9 M2.4 6 l0.5 2.7" stroke="#241a12" stroke-width="0.9" stroke-linecap="round"/>`,
  back: `<path d="M-3.2 -1 Q-3.7 5 0 5.6 Q3.7 5 3.2 -1 Z" fill="@peauO" stroke="@peauO" stroke-width="0.4"/>`,
  profile: `<path d="M-3 -1 L-3 4.6 Q-3 6.8 0 6.8 L8 6.8 Q9.8 6.8 8.8 3.6 L5 1 Z" fill="@peau" stroke="@peauO" stroke-width="0.5"/><path d="M3.6 6.8 l0.3 2.6 M6.2 6.6 l1.4 2.4 M8 6.4 l1.8 2.1" stroke="#241a12" stroke-width="0.9" stroke-linecap="round"/>`,
};

/**
 * Choisit une part par slot, par priorité :
 *   override éditeur > équipement porté > tenue de carrière > générique.
 * visage/cheveux : toujours (cosmétique espèce×sexe), variante via overrides/seed.
 * `view` choisit la vue (front/back/profile) de chaque part, avec fallback front.
 */
export function resolveParts(
  species: string,
  sex: 'M' | 'F',
  career: string | undefined,
  equip: EquipCtx,
  overrides: Partial<Record<Slot, number>>,
  seed: number,
  view: View = 'front',
): Record<Slot, Part | null> {
  const tenue = careerTenueFor(career);
  const out = {} as Record<Slot, Part | null>;
  const P = (art: PartArt | null | undefined): Part => ({ svg: pickView(art, view) });

  // Cosmétique (toujours). overrides priment, sinon variante dérivée du seed.
  out.visage = P(cosmeticPart('visage', species, sex, overrides.visage ?? seed % 2));
  out.cheveux = P(cosmeticPart('cheveux', species, sex, overrides.cheveux ?? (seed >> 2) % 3));

  // Corps : override → armure équipée → carrière → générique.
  for (const slot of BODY_SLOTS) {
    const tenuePart = tenue[slot as 'torse' | 'jambes' | 'bras' | 'tete'];
    if (overrides[slot] != null) {
      out[slot] = P(tenuePart ?? genericPart(slot));
      continue;
    }
    const armed = equip.armour.map((it) => armourPart(it, slot)).find((p) => p != null);
    if (armed != null) { out[slot] = P(armed); continue; }
    out[slot] = P(tenuePart ?? (slot === 'tete' ? '' : genericPart(slot)));
  }

  // Profil : remplace torse/jambes par la silhouette de côté EN TOKENS (sauf si la tenue
  // fournit déjà une vue `profile` détaillée). Suit le recoloriage de carrière.
  if (view === 'profile') {
    if (!hasProfileView(tenue.torse) && out.torse?.svg) out.torse = { svg: PROFILE_TORSE(dominantCloth(out.torse.svg)) };
    if (!hasProfileView(tenue.jambes) && out.jambes?.svg) out.jambes = { svg: PROFILE_JAMBE(dominantCloth(out.jambes.svg), career === 'Nu' ? 'peau' : 'cuir') };
    // Couvre-chef : silhouette de profil seulement s'il y en a un de face (sinon tête nue +
    // cheveux de profil cosmétiques). Évite l'art de face plaqué qui « s'enfonce » dans le crâne.
    if (!hasProfileView(tenue.tete) && out.tete?.svg) out.tete = { svg: PROFILE_TETE(dominantCloth(out.tete.svg)) };
  }

  // Pieds : botte de cuir (habillés) ou pied nu (monstres sans chaussure : « Nu » + squelette
  // osseux) → CLAWFOOT en @peau (chair/os) à griffes/orteils sombres.
  const bareFoot = career === 'Nu' || career === 'Squelette';
  out.pied = P(bareFoot ? CLAWFOOT : FOOT);

  // Mains : petit poing à chaque poignet → agrippe l'arme/le bouclier (sinon l'arme
  // « flotte dans le vide » au bout de la manche). Sous l'arme (z) = la main tient.
  out.main = P(HAND);

  // Mains : arme principale (1re non-bouclier) à l'os `arme` ; main secondaire (os `bouclier`) =
  // bouclier si présent, sinon la 2e arme tenue (dual-wield non-bouclier : dague, main-gauche…) —
  // détectée par `hand:'off'`. Ainsi épée+bouclier ET épée+dague s'affichent (plus seulement la principale).
  const mainWeapon = equip.weapons.find((w) => !isShield(w));
  const offWeapon = equip.weapons.find((w) => w.hand === 'off' && !isShield(w) && w !== mainWeapon);
  out.arme = P(mainWeapon ? weaponPart(mainWeapon) : '');
  out.bouclier = P(equip.shield ? shieldPart(equip.shield) : offWeapon ? weaponPart(offWeapon) : '');

  return out;
}
