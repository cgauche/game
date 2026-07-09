import { careers } from '../../../data';
import { slugId } from '../../../data/slug';
import {
  TENUE_BY_ID, CLASS_TENUE_BY_ID, TENUE_PALETTE_BY_ID, CLASS_PALETTE_BY_ID,
  TENUE_NUE, SPECIFIC_TENUE_NAMES, type TenueSet,
} from './tenues';
import type { StoredPalette } from '../palette';

// Carrière (id) → classe (id) ; `careers.json` porte `id` et `class` DÉJÀ en slugs.
const CAREER_CLASS_BY_ID: Record<string, string> = {};
for (const row of careers) CAREER_CLASS_BY_ID[row.id] = row.class;

// Vocabulaire de garde-robe RÉSOLVABLE (id stable, `slugId` absorbe le libellé authoré) : carrière
// (careers.json) ∪ classe (CLASS_TENUE_BY_ID) ∪ tenue spécifique (TENUE_BY_ID, dont 'nu'). Hors de
// cet ensemble = vocabulaire INCONNU (faute d'authoring) → repli citadins BRUYANT (#223).
const KNOWN_WARDROBE_IDS = new Set<string>([
  ...Object.keys(CAREER_CLASS_BY_ID),
  ...Object.keys(CLASS_TENUE_BY_ID),
  ...Object.keys(TENUE_BY_ID),
]);
/** Une clé de garde-robe (id ou libellé) résout-elle à une carrière/classe/tenue connue ? */
export function wardrobeKeyResolves(key: string | undefined): boolean {
  const id = slugId(key ?? '');
  return id === '' || id === 'nu' || KNOWN_WARDROBE_IDS.has(id);
}

/** Classe (id) d'une CLÉ — id de carrière (héros) ou id de tenue/inconnu → défaut « citadins ».
 *  `slugId` absorbe un libellé authoré éventuel. */
export function careerClass(key: string): string {
  return CAREER_CLASS_BY_ID[slugId(key)] ?? 'citadins';
}

/** Tenue d'archétype d'une classe (par id de classe). Socle simple ; tenues spécifiques en `defs/`. */
export function tenueForClass(classId: string): TenueSet {
  return CLASS_TENUE_BY_ID[slugId(classId)] ?? CLASS_TENUE_BY_ID.citadins;
}

/** Options du sélecteur de tenue (affiche le LIBELLÉ, stocke l'ID) — tenues spécifiques (dont « Nu »). */
export function tenueOptions(): { id: string; label: string }[] {
  return SPECIFIC_TENUE_NAMES.slice()
    .sort((a, b) => a.localeCompare(b, 'fr'))
    .map((name) => ({ id: slugId(name), label: name }));
}
const TENUE_LABEL_BY_ID: Record<string, string> = Object.fromEntries(SPECIFIC_TENUE_NAMES.map((n) => [slugId(n), n]));
/** Libellé d'affichage d'un id de tenue (ou l'id en repli). */
export function tenueLabel(id: string | undefined): string { return TENUE_LABEL_BY_ID[slugId(id ?? '')] ?? id ?? ''; }

/**
 * Palette STOCKÉE d'une tenue (clé = id, absorbe un libellé authoré via slugId), en miroir EXACT de
 * `tenueFor` : palette par TENUE si dispo, sinon palette de l'archétype de CLASSE. Empilée sous l'espèce.
 */
export function tenuePaletteFor(tenue: string | undefined): StoredPalette {
  const id = slugId(tenue ?? '');
  return TENUE_PALETTE_BY_ID[id] ?? CLASS_PALETTE_BY_ID[careerClass(tenue ?? '')] ?? {};
}

/** Tenue résolue pour une CLÉ de tenue (id slug ; `slugId` absorbe un libellé authoré — race.tenue/
 *  perso.tenue) : tenue SPÉCIFIQUE si dispo, sinon archétype de CLASSE. */
export function tenueFor(tenue: string | undefined): TenueSet {
  const id = slugId(tenue ?? '');
  if (id === 'nu') return TENUE_NUE; // corps nu (monstres sans habit)
  const specific = TENUE_BY_ID[id];
  if (specific) return specific;
  if (!wardrobeKeyResolves(id))
    console.warn(`[tenue] « ${tenue} » introuvable au catalogue (careers ∪ classes ∪ tenues) — repli citadins (#223)`);
  return tenueForClass(careerClass(tenue ?? ''));
}
