import type { Slot } from '../bones';
import { pickView, type Part, type PartArt } from './types';
import type { View } from '../facing';
import { toViewSet, splitBrasSvg, avantBrasBase, dominantCloth } from './derive';
import { cosmeticPart } from './cosmetic';
import { genericPart } from './generic';
import { tenueFor, resolveWardrobeId } from './career';
import { TENUE_BAREFOOT, TENUE_FOOT_STYLE } from './tenues';
import { armourPart, armourMaterial, weaponPart, shieldPart, isShield, type EquipCtx } from './equipment';
import { ARMOUR, ARMOUR_PALETTES } from './armour';
import { buildTokenMap, applyTokenMap } from '../palette';

// Slots de corps résolus par la table de priorité GÉNÉRIQUE. Le membre supérieur (`bras`+`avantBras`)
// en est SORTI : il se résout comme une UNITÉ (l'avant-bras se DÉRIVE de l'art bras pleine longueur
// par découpe au coude, #633 D1) — cf. `resolveUpperLimb` plus bas.
const BODY_SLOTS: Slot[] = ['tete', 'torse', 'jambes'];

// Pied DIRECTIONNEL (repère os `pied`, origine = cheville, +y descend). Dessiné
// par-dessus le bas de jambe → un pied de profil pointe vers l'avant (botte de côté),
// de face un bout arrondi, de dos un talon. C'est ce qui manquait : les pieds changent
// enfin selon la direction.
// Main (poing) directionnelle, repère os `main` (origine = poignet, +y descend). VRAIE main ancrée
// au poignet réel (#633 D1) : le pivot main* = 18 (bout de l'avant-bras, skeletons.ts) — l'art
// d'avant-bras (0..16) finit au poignet, le poing s'y emboîte. y=-2 (haut du poignet) rejoint le
// bas de l'art d'avant-bras (18-2=16) sans trou ; +7.7 = doigts refermés. AUCUNE remontée sous le
// coude (le cylindre-moignon est mort). Peinte SOUS l'avant-bras (zOverride main*, composeRig) :
// une manche qui atteint le poignet recouvre le haut du poing.
const HAND: PartArt = {
  front: `<path d="M-2.8 -2 Q0 -2.8 2.8 -2 Q3.3 1.6 3 4.7 Q2.6 7.1 0 7.7 Q-2.6 7.1 -3 4.7 Q-3.3 1.6 -2.8 -2 Z" fill="@peau" stroke="@peauO" stroke-width="0.5"/><path d="M-2 1.7 h4.1 M-2 3.5 h4 M-1.8 5.2 h3.6" stroke="@peauO" stroke-width="0.35" opacity="0.55"/><path d="M-2.9 0.5 Q-3.8 1.7 -3.1 3.6" fill="none" stroke="@peauO" stroke-width="0.4" opacity="0.5"/>`,
  back: `<path d="M-2.8 -2 Q0 -2.8 2.8 -2 Q3.3 1.6 3 4.7 Q2.6 7.1 0 7.7 Q-2.6 7.1 -3 4.7 Q-3.3 1.6 -2.8 -2 Z" fill="@peauO" stroke="@peauO" stroke-width="0.5"/><path d="M-1.8 1.6 h3.6 M-1.6 3.4 h3.2" stroke="@peauO" stroke-width="0.3" opacity="0.5"/>`,
  profile: `<path d="M-2.4 -2 Q0.4 -2.8 2.6 -1.9 Q3.2 1.5 2.8 4.7 Q2.4 7.2 -0.2 7.5 Q-2.4 6.9 -2.6 4.5 Q-2.8 1.4 -2.4 -2 Z" fill="@peau" stroke="@peauO" stroke-width="0.5"/><path d="M2.2 0.6 Q1.2 2 1.8 4.1" fill="none" stroke="@peauO" stroke-width="0.4" opacity="0.5"/>`,
};
// Cou SYSTÈME (os `cou`, #633 P2/P3) : cylindre de chair `@peau` couvrant TOUT l'os cou du canon
// (`rig/SKELETON-CONTRACT.md`) — de +4.5 (plongé dans le col du torse, qui le recouvre par z) au bas
// du crâne (y≈−16.4, attache de `tete` à −16). Le visage en couvre le haut ; la tranche visible
// (menton→col) fait ~4 unités + les flancs derrière la mâchoire.
// TOUJOURS résolu (aucune tenue/coiffure ne le porte) — z sous le torse (skeletons.ts) : un col de
// tenue peint dessus le couvre naturellement, sans patch par tenue.
const NECK: PartArt = {
  front: '<path d="M-3.3 4.5 Q-3.8 -6 -2.9 -16.4 Q0 -17.4 2.9 -16.4 Q3.8 -6 3.3 4.5 Q0 5.6 -3.3 4.5 Z" fill="@peau"/>' +
    '<path d="M-3.3 4.5 Q-3.8 -6 -2.9 -16.4 Q-3.6 -6 -3.4 4.2Z" fill="@peauO" opacity="0.35"/>' +
    '<path d="M3.3 4.5 Q3.8 -6 2.9 -16.4 Q3.6 -6 3.4 4.2Z" fill="@peauO" opacity="0.35"/>' +
    '<path d="M-0.9 -16.6 Q0 -17.1 0.9 -16.6 Q1 -8 0.6 1 L-0.6 1 Q-1 -8 -0.9 -16.6Z" fill="@peauH" opacity="0.35"/>',
  back: '<path d="M-3.4 4.5 Q-3.9 -6 -3 -16.4 Q0 -17.4 3 -16.4 Q3.9 -6 3.4 4.5 Q0 5.6 -3.4 4.5 Z" fill="@peau"/>' +
    '<path d="M-2.5 -0.8 Q0 0 2.5 -0.8" stroke="@peauO" stroke-width="0.4" fill="none" opacity="0.35"/>' +
    '<path d="M-0.7 -15.6 Q0 -15.2 0.7 -15.6 Q0.8 -8 0.5 0.6 L-0.5 0.6 Q-0.8 -8 -0.7 -15.6Z" fill="@peauH" opacity="0.3"/>',
  profile: '<path d="M-2.8 4.5 Q-3.2 -6 -2.3 -16.4 Q0.4 -17.3 3.1 -15.8 Q4 -6 3.4 4.5 Q0 5.6 -2.8 4.5 Z" fill="@peau"/>' +
    '<path d="M-2.8 4.5 Q-3.2 -6 -2.3 -16.4 Q-1.1 -14 -0.7 -6 Q-1 0 -1.5 4.3Z" fill="@peauO" opacity="0.35"/>' +
    '<path d="M1.7 -16.2 Q3.2 -13 3.3 -6 Q3.2 0 2.8 4.3" fill="none" stroke="@peauH" stroke-width="0.5" opacity="0.4"/>',
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

/** Applique la découpe au coude à CHAQUE VUE DÉCLARÉE d'un art `bras` pleine longueur (`side` = `haut`
 *  pour l'os épaule, `bas` pour l'os avant-bras rebasé). Une string = front-only (les vues absentes
 *  sont dérivées ensuite par `toViewSet`, déjà scindées au coude) ; un objet garde ses vues déclarées. */
function splitBrasArt(art: PartArt, side: 'haut' | 'bas'): PartArt {
  if (typeof art === 'string') return splitBrasSvg(art)[side];
  const out: { front: string; back?: string; profile?: string } = { front: splitBrasSvg(art.front)[side] };
  if (art.back != null) out.back = splitBrasSvg(art.back)[side];
  if (art.profile != null) out.profile = splitBrasSvg(art.profile)[side];
  return out;
}

const frontOf = (art: PartArt): string => (typeof art === 'string' ? art : art.front);

/** Vue `view` d'un art de DÉTAIL uniquement si la source la DÉCLARE (front toujours ; back/profile
 *  seulement s'ils sont présents) — sans FABRIQUER de silhouette (contrairement à `toViewSet`). Une vue
 *  non déclarée ⇒ '' : c'est la sous-couche de matière seule qui la couvre. */
function declaredView(art: PartArt, view: View): string {
  if (typeof art === 'string') return view === 'front' ? art : '';
  return art[view] ?? '';
}

/**
 * Résolution du MEMBRE SUPÉRIEUR (`bras`+`avantBras`) comme une UNITÉ (#633 D1).
 * BRAS : priorité override(→tenue.bras ?? générique) > armure > tenue.bras > générique. Un gagnant
 * d'ARMURE ou de `tenue.bras` est PLEINE LONGUEUR (épaule→poignet) → découpé au coude (`.haut`) ; le
 * générique est déjà court (épaule→coude) → laissé tel quel.
 * AVANT-BRAS : `tenue.avantBras` explicite prime (écoutille C, honoré tel quel) ; sinon, si le bras est
 * pleine longueur, une sous-couche de COUVERTURE (`avantBrasBase`) remplie de la MATIÈRE DOMINANTE du
 * bras gagnant (manche/armure) est peinte en 3 VUES, puis le DÉTAIL `.bas` de l'art bras est overlayé
 * PAR-DESSUS — mais UNIQUEMENT dans les vues que l'art `bras` source DÉCLARE (`declaredView`) : un art
 * front-only (cas ARMURE, string) n'a de détail QU'EN FRONT, ses back/profile = la sous-couche seule
 * (déjà correcte : acier pour la plaque, tissu pour la manche) — jamais un détail fabriqué par
 * `toViewSet` à partir du seul front, qui retomberait sur un fallback `@vet1` (l'incohérence front↔profil,
 * Lot 2c). Un art `bras` objet {front, back?, profile?} porte son propre `.bas` dans chaque vue déclarée.
 * Bras de chair (dominante `peau` : Nu/monstre) → l'avant-bras reste chair ; sinon le rect de peau dédié
 * `genericPart('avantBras')`. GAGNANT D'ARMURE (front-only) : la découpe ET la dérive de vues des DEUX
 * segments partent de l'art RAW de l'armure (`ARMOUR[mat].bras`, `@tokens` intacts) — ainsi
 * `dominantCloth`/les silhouettes dérivées voient `@metal` (pas le fallback `@vet1` d'un art déjà résolu
 * en hex, l'incohérence front↔profil du haut ET du bas, Lot 2c/2d) — PUIS `matterResolve` recolorie le
 * SVG FINAL des deux segments contre la palette de l'armure gagnante (le bras ne suit pas la palette du
 * porteur). Pour une TENUE, `matterResolve` est nul : les `@tokens` sont gardés et `composeRig` les résout
 * contre la palette du porteur.
 */
function resolveUpperLimb(
  tenue: ReturnType<typeof tenueFor>,
  equip: EquipCtx,
  overridden: boolean,
  boot: string,
  view: View,
): { bras: Part; avantBras: Part } {
  const brasTenue = tenue.bras;
  const armItem = overridden ? undefined : equip.armour.find((it) => armourPart(it, 'bras') != null);
  let matterArt: PartArt;                                        // art RAW porteur des tokens de matière
  let matterResolve: ((svg: string) => string) | null = null;   // recoloriage palette de l'armure gagnante
  let brasEstPleineLongueur: boolean;
  if (armItem) {
    const mat = armourMaterial(armItem);
    matterArt = ARMOUR[mat]?.bras ?? '';                         // tokens @metal/@cuir… intacts
    const map = buildTokenMap(ARMOUR_PALETTES[mat] ?? {}, armItem.skin as Record<string, string> | undefined);
    matterResolve = (svg) => applyTokenMap(svg, map);
    brasEstPleineLongueur = true;
  } else {
    matterArt = brasTenue ?? genericPart('bras');
    brasEstPleineLongueur = brasTenue != null;
  }

  // BRAS HAUT : vues dérivées de l'art RAW (dominantCloth voit @metal/@cuir…), matière résolue au bout.
  const brasArt = brasEstPleineLongueur ? splitBrasArt(matterArt, 'haut') : matterArt;
  let brasSvg = toViewSet('bras', brasArt, { boot })[view];
  if (matterResolve) brasSvg = matterResolve(brasSvg);

  const avantTenue = tenue.avantBras;
  let avantSvg: string;
  if (avantTenue != null) {
    avantSvg = toViewSet('avantBras', avantTenue, { boot })[view];      // écoutille C : honoré tel quel
  } else if (brasEstPleineLongueur) {
    const base = avantBrasBase(dominantCloth(frontOf(matterArt)));      // couverture-matière (tokens RAW)
    const under = toViewSet('avantBras', base, { boot })[view];         // couverture en 3 vues, DERRIÈRE le détail
    const detail = declaredView(splitBrasArt(matterArt, 'bas'), view);  // détail .bas SEULEMENT si la vue est déclarée
    avantSvg = under + detail;
    if (matterResolve) avantSvg = matterResolve(avantSvg);              // matière d'armure résolue (tenue : tokens gardés)
  } else {
    avantSvg = toViewSet('avantBras', genericPart('avantBras'), { boot })[view];
  }

  return {
    bras: { svg: brasSvg },
    avantBras: { svg: avantSvg },
  };
}

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
  const resolvedTenueId = resolveWardrobeId(tenueKey);
  const bareFoot = TENUE_BAREFOOT.has(resolvedTenueId);
  const footStyle = TENUE_FOOT_STYLE.get(resolvedTenueId) ?? 'boot';
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
    const bslot = slot as 'torse' | 'jambes' | 'tete';
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

  // Membre supérieur (#633 D1) résolu en UNITÉ : l'art `bras` authoré (armure/tenue) court épaule→
  // poignet et se DÉCOUPE au coude (`splitBrasSvg`) — le haut sert l'os épaule, le bas rebasé sert l'os
  // avant-bras. Le générique `bras` est DÉJÀ court (épaule→coude) : il ne se scinde pas et l'avant-bras
  // retombe alors sur son rect dédié `genericPart('avantBras')` (jamais le bas d'un art court = sliver).
  const upper = resolveUpperLimb(tenue, equip, overrides.bras != null, boot, view);
  out.bras = upper.bras;
  out.avantBras = upper.avantBras;

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
