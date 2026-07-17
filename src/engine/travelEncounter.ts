/**
 * Rencontres de voyage (EDOC 8 l.182-233) — DÉCLENCHEUR par la qualité des Tests d'Activité de
 * l'Étape. Module FEUILLE pur (testable) : il ne tire pas le d100 ni n'applique d'effet ; il rend la
 * CATÉGORIE de la table de Rencontres à consulter (l'appelant tire et applique).
 *
 * RAW (verbatim) :
 *  - Positives  : « peuvent être déclenchées par un Succès Impressionnant ou mieux » (l.188).
 *  - Fortuites  : « si le Personnage n'a pas obtenu un Succès Impressionnant ou a eu un Échec
 *                  Impressionnant » (l.203) — le terrain neutre.
 *  - Dangereuses: « Si l'un des Personnages, ou la majorité des Personnages, échouent » (l.221).
 *
 * Les conditions RAW se CHEVAUCHENT (issues à discrétion du MJ « peut advenir »). Pour un moteur
 * déterministe, on les classe par SÉVÉRITÉ, en réutilisant la primitive PARTAGÉE des paliers de DR
 * (`isImpressiveSuccess`, LDB 12) — pas de seuil magique recopié :
 *  1. un Succès Impressionnant (DR ≥ +4) quelque part → positives ;
 *  2. sinon la MAJORITÉ des testeurs échouent → dangereuses (l.221 « la majorité ») ;
 *  3. sinon au moins un échec (minorité / Échec Impressionnant) → fortuites (l.203) ;
 *  4. sinon (tous réussissent sans éclat) → aucune Rencontre (voyage calme).
 * Seuls les héros ayant réellement passé un Test comptent (Activités sans Test ignorées).
 */
import type { TravelActivityResult } from './activities';
import type { EncounterCategory } from './travelTables';
import { isImpressiveSuccess } from './tests';

export function stageEncounterCategory(results: readonly TravelActivityResult[]): EncounterCategory | null {
  const tested = results.filter((r) => r.roll != null);
  if (!tested.length) return null;
  if (tested.some((r) => isImpressiveSuccess(r.success, r.sl))) return 'positives';
  const failed = tested.filter((r) => !r.success).length;
  if (failed === 0) return null;
  return failed * 2 > tested.length ? 'dangereuses' : 'fortuites';
}
