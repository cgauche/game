import { careers } from '../../../data';
import {
  TENUE_BY_ID, CLASS_TENUE_BY_ID, TENUE_PALETTE_BY_ID, CLASS_PALETTE_BY_ID,
  TENUE_OVERLAYS_BY_ID, CLASS_OVERLAYS_BY_ID,
  TENUE_NUE, SPECIFIC_TENUES, type TenueSet,
} from './tenues';
import type { StoredPalette } from '../palette';
import type { RigOverlay } from '../bones';

// Carrière (id) → classe (id) ; `careers.json` porte `id` et `class` DÉJÀ en ids.
const CAREER_CLASS_BY_ID: Record<string, string> = {};
for (const row of careers) CAREER_CLASS_BY_ID[row.id] = row.class;

// Carrière (id) → tenue spécifique réutilisée (id) ; `careers.json` porte `tenue` (variants MDG
// « (Côtier) » sans archétype de classe dédié, MDG 09 l.255/343/458) — champ optionnel, DÉJÀ un id.
const CAREER_TENUE_BY_ID: Record<string, string> = {};
for (const row of careers) if (row.tenue) CAREER_TENUE_BY_ID[row.id] = row.tenue;

// Vocabulaire de garde-robe RÉSOLVABLE (id STABLE, jamais un libellé) : carrière (careers.json) ∪ classe
// (CLASS_TENUE_BY_ID) ∪ tenue spécifique (TENUE_BY_ID, dont 'nu'). Hors de cet ensemble = vocabulaire
// INCONNU (faute d'authoring) → repli citadins BRUYANT (#223).
const KNOWN_WARDROBE_IDS = new Set<string>([
  ...Object.keys(CAREER_CLASS_BY_ID),
  ...Object.keys(CLASS_TENUE_BY_ID),
  ...Object.keys(TENUE_BY_ID),
]);
/** Une clé de garde-robe (id de carrière/classe/tenue) résout-elle à une garde-robe connue ? */
export function wardrobeKeyResolves(key: string | undefined): boolean {
  const id = key ?? '';
  return id === '' || id === 'nu' || KNOWN_WARDROBE_IDS.has(id);
}

/** Classe (id) d'une CLÉ — id de carrière (héros) ou id de tenue/inconnu → défaut « citadins ». */
export function careerClass(key: string): string {
  return CAREER_CLASS_BY_ID[key] ?? 'citadins';
}

/** Tenue d'archétype d'une classe (par id de classe). Socle simple ; tenues spécifiques en `defs/`. */
export function tenueForClass(classId: string): TenueSet {
  return CLASS_TENUE_BY_ID[classId] ?? CLASS_TENUE_BY_ID.citadins;
}

/** Options du sélecteur de tenue (affiche le LIBELLÉ, stocke l'ID) — tenues spécifiques (dont « Nu »). */
export function tenueOptions(): { id: string; label: string }[] {
  return SPECIFIC_TENUES.slice().sort((a, b) => a.label.localeCompare(b.label, 'fr'));
}
const TENUE_LABEL_BY_ID: Record<string, string> = Object.fromEntries(SPECIFIC_TENUES.map((t) => [t.id, t.label]));
/** Libellé d'affichage d'un id de tenue (ou l'id en repli). */
export function tenueLabel(id: string | undefined): string { return TENUE_LABEL_BY_ID[id ?? ''] ?? id ?? ''; }

/**
 * Palette STOCKÉE d'une tenue (clé = id STABLE), en miroir EXACT de `tenueFor` : palette par TENUE si
 * dispo, sinon par id de CLASSE direct (#533), sinon palette de l'archétype de CLASSE de la carrière.
 * Empilée sous l'espèce.
 */
export function tenuePaletteFor(tenue: string | undefined): StoredPalette {
  const id = tenue ?? '';
  const specificId = CAREER_TENUE_BY_ID[id] ?? id;
  return TENUE_PALETTE_BY_ID[specificId] ?? CLASS_PALETTE_BY_ID[id] ?? CLASS_PALETTE_BY_ID[careerClass(id)] ?? {};
}

// Parts SYSTÈME du pied (`FOOT`/`CLAWFOOT` de `resolve.ts`) : le pied n'est dessiné par AUCUNE
// tenue, mais sa couleur doit suivre celle qui est portée (#426). Valeurs = celles de l'art
// d'origine, à l'exact (une tenue qui ne déclare rien rend à l'identique).
const SYSTEM_FOOT: StoredPalette = {
  botte: '#3a2614', botteO: '#1f1408', // cuir + contour (face/profil)
  semelle: '#241608',
  botteDos: '#2e1f10', botteDosO: '#1a1208', // cuir dorsal, assombri à la main par l'art
  griffe: '#241a12',
};
/** Bases de la famille `botte`, dont `botte` est la TÊTE (elle propage aux membres non déclarés). */
const FOOT_BASES = ['botte', 'semelle', 'botteDos'] as const;

/**
 * Jetons du pied SYSTÈME pour la palette PORTÉE (espèce ∪ tenue) — à empiler SOUS elle
 * (`rigStoredPalette`, seul appelant côté rendu) :
 *   - `botte` déclarée → TOUTE la botte la suit (cuir, semelle, cuir dorsal) ; les contours/ombres
 *     se dérivent (`buildTokenMap`). Un membre déclaré à part (`semelle`, `botteDos`) garde sa
 *     teinte propre et DÉRIVE la sienne — l'expansion est donc robuste à la déclaration PARTIELLE
 *     (`botteDos` sans `botte` : cuir dorsal honoré, son contour suit ; pas de contour d'origine
 *     survivant sous une base neuve).
 *   - rien de déclaré → pied système (les 117 tenues actuelles rendent à l'identique).
 * `griffe` reste indépendante (pied nu griffu, sans rapport avec le cuir de la botte).
 */
export function footPalette(pal: StoredPalette): StoredPalette {
  const cuir = pal.botte;
  const out: StoredPalette = { griffe: SYSTEM_FOOT.griffe };
  for (const base of FOOT_BASES) {
    const declared = pal[base];
    out[base] = declared ?? cuir ?? SYSTEM_FOOT[base];
    // Ombre d'ORIGINE (peinte à la main par l'art) servie seulement tant que sa base l'est aussi :
    // dès que la donnée pilote la base, l'ombre se dérive (buildTokenMap) — sinon un contour brun
    // survivrait sous un cuir neuf.
    const shade = SYSTEM_FOOT[`${base}O`];
    if (shade != null && declared == null && cuir == null) out[`${base}O`] = shade;
  }
  return out;
}

/**
 * Palette STOCKÉE du rig — SOURCE UNIQUE de l'empilage (composeRig ET ses gardes l'appellent, jamais
 * une réplique) : jetons du pied SYSTÈME SOUS la palette PORTÉE (espèce → tenue). Le pied est expansé
 * depuis la palette portée ENTIÈRE : une RACE qui déclare `botte` pilote sa famille comme une tenue
 * (aucune couche ne tombe entre les deux). Aucune 2e cascade : on lit la sortie de `tenuePaletteFor`.
 */
export function rigStoredPalette(species: StoredPalette | undefined, tenue: string | undefined): StoredPalette {
  const worn = { ...(species ?? {}), ...tenuePaletteFor(tenue) };
  return { ...footPalette(worn), ...worn };
}

/**
 * Calques asymétriques (`TenueDef.overlays`) d'une tenue, en miroir EXACT de `tenuePaletteFor` :
 * tenue spécifique par id, sinon id de CLASSE direct, sinon archétype de CLASSE de la carrière.
 * Vide pour l'écrasante majorité des tenues (canal optionnel — cf. `parts/tenues/types.ts`).
 */
export function tenueOverlaysFor(tenue: string | undefined): RigOverlay[] {
  const id = tenue ?? '';
  const specificId = CAREER_TENUE_BY_ID[id] ?? id;
  return TENUE_OVERLAYS_BY_ID[specificId] ?? CLASS_OVERLAYS_BY_ID[id] ?? CLASS_OVERLAYS_BY_ID[careerClass(id)] ?? [];
}

/** Tenue résolue pour une CLÉ de garde-robe (id STABLE — appearance.tenue = id de tenue, sinon
 *  Combatant.career = id de carrière) : tenue SPÉCIFIQUE si dispo (celle de la carrière, ou celle
 *  réutilisée via `CareerData.tenue` — variants MDG « (Côtier) »), sinon id de CLASSE direct (#533 —
 *  une donnée peut viser un archétype sans carrière, ex. créature), sinon archétype de CLASSE de la
 *  carrière. Id inconnu (ni carrière ∪ classe ∪ tenue) → repli citadins BRUYANT (#223). */
export function tenueFor(tenue: string | undefined): TenueSet {
  const id = tenue ?? '';
  if (id === 'nu') return TENUE_NUE; // corps nu (monstres sans habit)
  const specific = TENUE_BY_ID[CAREER_TENUE_BY_ID[id] ?? id];
  if (specific) return specific;
  if (id !== '' && !wardrobeKeyResolves(id))
    console.warn(`[tenue] « ${tenue} » introuvable au catalogue (careers ∪ classes ∪ tenues) — repli citadins (#223)`);
  return tenueForClass(id in CLASS_TENUE_BY_ID ? id : careerClass(id));
}
