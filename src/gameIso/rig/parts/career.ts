import { careers } from '../../../data';
import {
  TENUE_BY_ID, CLASS_TENUE_BY_ID, TENUE_PALETTE_BY_ID, CLASS_PALETTE_BY_ID,
  TENUE_NUE, SPECIFIC_TENUES, type TenueSet,
} from './tenues';
import type { StoredPalette } from '../palette';

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
 * dispo, sinon palette de l'archétype de CLASSE. Empilée sous l'espèce.
 */
export function tenuePaletteFor(tenue: string | undefined): StoredPalette {
  const id = tenue ?? '';
  const specificId = CAREER_TENUE_BY_ID[id] ?? id;
  return TENUE_PALETTE_BY_ID[specificId] ?? CLASS_PALETTE_BY_ID[careerClass(id)] ?? {};
}

/** Tenue résolue pour une CLÉ de garde-robe (id STABLE — appearance.tenue = id de tenue, sinon
 *  Combatant.career = id de carrière) : tenue SPÉCIFIQUE si dispo (celle de la carrière, ou celle
 *  réutilisée via `CareerData.tenue` — variants MDG « (Côtier) »), sinon archétype de CLASSE. Id
 *  inconnu (ni carrière ∪ classe ∪ tenue) → repli citadins BRUYANT (#223). */
export function tenueFor(tenue: string | undefined): TenueSet {
  const id = tenue ?? '';
  if (id === 'nu') return TENUE_NUE; // corps nu (monstres sans habit)
  const specific = TENUE_BY_ID[CAREER_TENUE_BY_ID[id] ?? id];
  if (specific) return specific;
  if (id !== '' && !wardrobeKeyResolves(id))
    console.warn(`[tenue] « ${tenue} » introuvable au catalogue (careers ∪ classes ∪ tenues) — repli citadins (#223)`);
  return tenueForClass(careerClass(id));
}
