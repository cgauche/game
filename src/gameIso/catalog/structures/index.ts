import type { StructureAppearanceDef, WallPart } from './types';
import type { WallSeg } from '../../../state/scene';
import { structureAppearances } from '../../../data';
import { shade } from '../../shade';
import { catalogEntry, MISSING_ID, MISSING_TONE, MISSING_TONE_DARK } from '../missing';
export type { StructureAppearanceDef, WallPart } from './types';

const MAP: Record<string, StructureAppearanceDef> = Object.fromEntries(structureAppearances.map((s) => [s.id, s]));

/** Entrée de REPLI VISIBLE (#877) : un mur au ton d'alarme, jamais l'apparence d'une autre structure. */
const MISSING: StructureAppearanceDef = {
  id: MISSING_ID,
  label: 'Apparence absente du catalogue',
  material: 'pierre',
  face: MISSING_TONE,
  post: MISSING_TONE_DARK,
};

/** Apparence d'une structure par id. `id` absent = INTENTIONNEL (aucune structure posée) → mur nu.
 *  Un `id` PRÉSENT mais SANS entrée dans `structureAppearance.json` est une donnée à corriger (#832) :
 *  repli VISIBLE + avertissement DEV, jamais l'identité d'une autre apparence. */
export function structureAppearance(id?: string): StructureAppearanceDef {
  if (!id) return MAP['plain'];
  return catalogEntry(MAP, id, 'structure', MISSING);
}

/** Apparence d'un mur d'arête — SOURCE UNIQUE iso + POV : sa structure, sinon rempart de pierre si
 *  surélevé (base > 1 m), sinon mur nu. */
export function wallApp(seg: WallSeg, baseH: number): StructureAppearanceDef {
  return seg.structure ? structureAppearance(seg.structure) : structureAppearance(baseH > 1 ? 'mur-en-pierre' : 'plain');
}

// Facteur d'OMBRAGE dérivé de la face (jamais une couleur en dur) : fond d'embrasure de porte.
const EMBRASURE = 0.19;

/** Croisée de repli (def SANS bloc `window`) = celle de `plain` (DONNÉE JSON : verre froid + ambre allumé) —
 *  jamais un littéral de couleur (garde-fou renderer), au même titre que `FLOOR_FALLBACK`/`CEIL_BASE`. */
const defaultWindow = () => structureAppearance('plain').window;
/** Couleur ÉMISSIVE d'une fenêtre allumée (nuit) — la def sinon le repli `plain`. Source unique iso + POV. */
export function windowLit(app: StructureAppearanceDef): string {
  return app.window?.lit ?? defaultWindow()?.lit ?? app.face;
}

/** Couleur de BASE d'une partie de mur du pivot — SOURCE UNIQUE des deux backends (écran-affine + POV),
 *  qui y appliquent ensuite chacun LEUR lumière (ombre d'orientation iso / tint + brume POV). Tout vient
 *  des CHAMPS de la def (replis `?? face` pour une def incomplète), jamais d'un littéral. */
export function wallPartColor(app: StructureAppearanceDef, part: WallPart): string {
  switch (part) {
    case 'face': case 'parapet': case 'linteau': return app.face;
    case 'panneau': return app.wood?.inset ?? app.face;
    case 'moulure': case 'chambranle': return app.wood?.frame ?? app.face;
    case 'plinthe': return app.wood?.skirt ?? app.face;
    case 'couronnement': return app.wood?.cap ?? app.cap ?? app.face;
    case 'arase': case 'merlon': return app.cap ?? app.face;
    case 'bande': case 'herse-barreau': return app.band ?? app.face;
    case 'embrasure': return shade(app.face, EMBRASURE);
    case 'jambage': return app.door?.jamb ?? app.face;
    case 'vantail': return app.door?.leaf ?? app.wood?.inset ?? shade(app.face, 0.78);
    case 'vantail-planche': return app.door?.plank ?? app.wood?.skirt ?? app.post;
    case 'poignee': return app.door?.handle ?? app.cap ?? app.wood?.cap ?? app.face;
    case 'vitre': return app.window?.glass ?? defaultWindow()?.glass ?? app.face;
    case 'meneau': return app.window?.mullion ?? app.wood?.frame ?? app.post;
    case 'poteau': return app.post;
    case 'herse-traverse': return app.door?.herse?.traverseColor ?? app.band ?? app.face;
    case 'gravats': case 'seuil': return app.rubble ?? app.wood?.rubble ?? app.face;
    case 'gravats-tas': return app.rubbleHi ?? app.wood?.rubbleHi ?? app.face;
  }
}
