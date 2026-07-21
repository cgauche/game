import type { Slot } from '../bones';
import { pickView, type Part, type PartArt } from './types';
import type { View } from '../facing';
import { toViewSet } from './derive';
import { cosmeticPart } from './cosmetic';
import { genericPart } from './generic';
import { tenueFor } from './career';
import { TENUE_BAREFOOT, TENUE_FOOT_STYLE } from './tenues';
import { armourPart, weaponPart, shieldPart, isShield, type EquipCtx } from './equipment';

const BODY_SLOTS: Slot[] = ['tete', 'bras', 'torse', 'jambes'];

// Pied DIRECTIONNEL (repère os `pied`, origine = cheville, +y descend). Dessiné
// par-dessus le bas de jambe → un pied de profil pointe vers l'avant (botte de côté),
// de face un bout arrondi, de dos un talon. C'est ce qui manquait : les pieds changent
// enfin selon la direction.
// Main (poing) directionnelle, repère os `main` (origine = poignet, +y descend).
// MOIGNON DE POIGNET : le pivot à 14 (skeletons.ts) ne suffit PAS — mesuré sur les 117 tenues,
// l'art de bras finit souvent AVANT le poignet FK (4-6 unités : familles skaven ; jusqu'à 12 :
// manche large tombante du Prophète gris) → le poing seul lisait comme un disque flottant. Un
// cylindre `@peau` remonte donc du poing jusque SOUS le coude (y=-12 ; coude à -14) : sous une
// manche qui atteint le poignet il disparaît dessous (la main est peinte SOUS l'art de bras,
// cf. zOverride mainG/mainD de composeRig) ; sous une manche courte il est l'avant-bras nu qui
// en émerge ; sur bras nu il est la continuité de l'avant-bras (même `@peau`).
const WRIST = (dx: number, fill: string) =>
  `<path d="M${(-2.3 + dx).toFixed(1)} -12 Q${dx} -12.8 ${(2.3 + dx).toFixed(1)} -12 L${(2.3 + dx).toFixed(1)} 1.5 Q${dx} 2.6 ${(-2.3 + dx).toFixed(1)} 1.5 Z" fill="${fill}" stroke="@peauO" stroke-width="0.5"/>`;
const HAND: PartArt = {
  front: `${WRIST(0, '@peau')}<ellipse cx="0" cy="2.6" rx="2.8" ry="3.2" fill="@peau" stroke="@peauO" stroke-width="0.5"/><path d="M-1.4 1.6 h2.8 M-1.4 3.2 h2.8" stroke="@peauO" stroke-width="0.4" opacity="0.5"/>`,
  back: `${WRIST(0, '@peauO')}<ellipse cx="0" cy="2.6" rx="2.8" ry="3.2" fill="@peauO" stroke="@peauO" stroke-width="0.5"/>`,
  profile: `${WRIST(0.6, '@peau')}<ellipse cx="0.6" cy="2.6" rx="2.6" ry="3.2" fill="@peau" stroke="@peauO" stroke-width="0.5"/>`,
};
// Cou SYSTÈME (os `cou`, #633 P2) : cylindre de chair `@peau` reliant le sommet du torse (y=0,
// repère local du cou = base) au bas du crâne (y≈-6.4, repère local = sommet, attache de `tete`).
// TOUJOURS résolu (aucune tenue/coiffure ne le porte) — z sous le torse (skeletons.ts) : un col de
// tenue peint dessus le couvre naturellement, sans patch par tenue.
const NECK: PartArt = {
  front: '<path d="M-3.1 0.4 Q-3.5 -3 -2.8 -6.4 Q0 -7.4 2.8 -6.4 Q3.5 -3 3.1 0.4 Z" fill="@peau"/>' +
    '<path d="M-3.1 0.4 Q-3.5 -3 -2.8 -6.4 Q-3.4 -3 -3.2 0.1Z" fill="@peauO" opacity="0.35"/>' +
    '<path d="M3.1 0.4 Q3.5 -3 2.8 -6.4 Q3.4 -3 3.2 0.1Z" fill="@peauO" opacity="0.35"/>' +
    '<path d="M-0.9 -6.6 Q0 -7.1 0.9 -6.6 Q1 -4 0.6 -1 L-0.6 -1 Q-1 -4 -0.9 -6.6Z" fill="@peauH" opacity="0.35"/>',
  back: '<path d="M-3.2 0.4 Q-3.6 -3 -2.9 -6.4 Q0 -7.4 2.9 -6.4 Q3.6 -3 3.2 0.4 Z" fill="@peau"/>' +
    '<path d="M-2.4 -1.2 Q0 -0.4 2.4 -1.2" stroke="@peauO" stroke-width="0.4" fill="none" opacity="0.35"/>' +
    '<path d="M-0.7 -5.8 Q0 -5.4 0.7 -5.8 Q0.8 -3 0.5 -0.6 L-0.5 -0.6 Q-0.8 -3 -0.7 -5.8Z" fill="@peauH" opacity="0.3"/>',
  profile: '<path d="M-2.6 0.4 Q-2.9 -3 -2.2 -6.2 Q0.4 -7.3 3 -6 Q3.6 -3 3.1 0.4 Z" fill="@peau"/>' +
    '<path d="M-2.6 0.4 Q-2.9 -3 -2.2 -6.2 Q-1 -5.6 -0.6 -3 Q-0.9 -1 -1.4 0.2Z" fill="@peauO" opacity="0.35"/>' +
    '<path d="M1.6 -6.4 Q3 -5.6 3.1 -3 Q3 -1 2.6 0.2" fill="none" stroke="@peauH" stroke-width="0.5" opacity="0.4"/>',
};
// Botte SYSTÈME : peinte en JETONS de la famille `botte` (cuir `@botte` + contour `@botteO`,
// `@semelle`, et `@botteDos`/`@botteDosO` pour le cuir dorsal que l'art assombrit à la main) —
// une tenue pilote donc la couleur de ses bottes par sa `palette` (`botte`, cf. tenues/types.ts).
// Défauts (art d'origine) et expansion de la famille : `footPalette` (career.ts), empilée sous la
// palette portée (espèce ∪ tenue) par `rigStoredPalette` — la SEULE construction de cet empilage.
const FOOT: PartArt = {
  front: `<path d="M-3.4 -1 Q-4.4 7 0 8 Q4.4 7 3.4 -1 Z" fill="@botte" stroke="@botteO" stroke-width="0.6"/><path d="M-3.6 6.5 Q0 8.6 3.6 6.5 L3.4 8 Q0 9.4 -3.4 8 Z" fill="@semelle"/>`,
  back: `<path d="M-3.2 -1 Q-3.8 6 0 6.5 Q3.8 6 3.2 -1 Z" fill="@botteDos" stroke="@botteDosO" stroke-width="0.5"/>`,
  profile: `<path d="M-3 -1 L-3 5 Q-3 7.4 0 7.4 L8.6 7.4 Q10.6 7.4 9.4 4 L5.4 1 Z" fill="@botte" stroke="@botteO" stroke-width="0.6"/><path d="M-3 6.4 L9.6 6.4 L9.8 8 Q4 9 -3 8 Z" fill="@semelle"/>`,
};
// Pied NU GRIFFU (espèces nues : squelette/goule/troll…) — chair/os/pelage `@peau` + griffes
// `@griffe` (au lieu de la botte, incohérente sur un monstre nu).
const CLAWFOOT: PartArt = {
  front: `<path d="M-3.4 -1 Q-4.2 6 0 7 Q4.2 6 3.4 -1 Z" fill="@peau" stroke="@peauO" stroke-width="0.5"/><path d="M-2.4 6 l-0.5 2.7 M0 6.6 l0 2.9 M2.4 6 l0.5 2.7" stroke="@griffe" stroke-width="0.9" stroke-linecap="round"/>`,
  back: `<path d="M-3.2 -1 Q-3.7 5 0 5.6 Q3.7 5 3.2 -1 Z" fill="@peauO" stroke="@peauO" stroke-width="0.4"/>`,
  profile: `<path d="M-3 -1 L-3 4.6 Q-3 6.8 0 6.8 L8 6.8 Q9.8 6.8 8.8 3.6 L5 1 Z" fill="@peau" stroke="@peauO" stroke-width="0.5"/><path d="M3.6 6.8 l0.3 2.6 M6.2 6.6 l1.4 2.4 M8 6.4 l1.8 2.1" stroke="@griffe" stroke-width="0.9" stroke-linecap="round"/>`,
};
// Pied NU LISSE (civilisés va-nu-pieds : halfling, humain sans chaussure…) — même géométrie que
// CLAWFOOT (chair `@peau`), plante + orteils suggérés, SANS griffe (#481 : un civilisé nu-pieds
// n'est pas un monstre).
const PLAINFOOT: PartArt = {
  front: `<path d="M-3.4 -1 Q-4.2 6 0 7 Q4.2 6 3.4 -1 Z" fill="@peau" stroke="@peauO" stroke-width="0.5"/><path d="M-2.4 6.4 Q0 7.6 2.4 6.4" fill="none" stroke="@peauO" stroke-width="0.4" opacity="0.6"/>`,
  back: `<path d="M-3.2 -1 Q-3.7 5 0 5.6 Q3.7 5 3.2 -1 Z" fill="@peauO" stroke="@peauO" stroke-width="0.4"/>`,
  profile: `<path d="M-3 -1 L-3 4.6 Q-3 6.8 0 6.8 L8 6.8 Q9.8 6.8 8.8 3.6 L5 1 Z" fill="@peau" stroke="@peauO" stroke-width="0.5"/><path d="M3.6 7.2 Q6 7.8 8.4 6.6" fill="none" stroke="@peauO" stroke-width="0.4" opacity="0.6"/>`,
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
  tenueKey: string | undefined,
  equip: EquipCtx,
  overrides: Partial<Record<Slot, number>>,
  seed: number,
  view: View = 'front',
): Record<Slot, Part | null> {
  const tenue = tenueFor(tenueKey);
  // Corps non chaussé (flag bareFoot du def : 'Nu', squelette décharné, tenues de MONSTRE) — pieds
  // griffus et substitutions dos/profil en chair plutôt qu'en botte/tissu. SOURCE UNIQUE : le flag
  // du def, clé par ID stable de garde-robe.
  const tenueId = tenueKey ?? '';
  const bareFoot = TENUE_BAREFOOT.has(tenueId);
  const footStyle = TENUE_FOOT_STYLE.get(tenueId) ?? 'boot';
  const out = {} as Record<Slot, Part | null>;
  const P = (art: PartArt | null | undefined): Part => ({ svg: pickView(art, view) });

  // Cosmétique (toujours). overrides priment, sinon variante dérivée du seed.
  out.visage = P(cosmeticPart('visage', species, sex, overrides.visage ?? seed % 2));
  out.cheveux = P(cosmeticPart('cheveux', species, sex, overrides.cheveux ?? (seed >> 2)));
  // Cou (toujours, corps de base garanti — #633 P2) : indépendant de la tenue/coiffure.
  out.cou = P(NECK);

  // Corps : PURE table de priorité (override → armure équipée → carrière → générique) → art `PartArt`
  // legacy, ENROBÉ en `ViewSet` TOTAL par le shim `toViewSet` (P1), qui matérialise les vues absentes
  // (silhouette dérivée, `derive.ts`) — plus AUCUNE branche par vue ni génération de silhouette ici.
  // `boot` = bas de jambe nu (@peau) pour un corps déchaussé, cuir sinon.
  const boot = bareFoot ? 'peau' : 'cuir';
  for (const slot of BODY_SLOTS) {
    const bslot = slot as 'torse' | 'jambes' | 'bras' | 'tete';
    const tenuePart = tenue[bslot];
    let art: PartArt | null | undefined;
    if (overrides[slot] != null) {
      art = tenuePart ?? genericPart(slot);
    } else {
      const armed = equip.armour.map((it) => armourPart(it, slot)).find((p) => p != null);
      art = armed ?? tenuePart ?? (slot === 'tete' ? '' : genericPart(slot));
    }
    out[slot] = { svg: toViewSet(bslot, art, { boot })[view] };
  }

  // Pieds : botte de cuir, pied nu griffu (monstre) ou pied nu lisse (civilisé) — footStyle, dérivé
  // par défaut de bareFoot pour rétro-compat (#481).
  out.pied = P(footStyle === 'claw' ? CLAWFOOT : footStyle === 'plain' ? PLAINFOOT : FOOT);

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
