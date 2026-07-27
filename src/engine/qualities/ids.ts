/**
 * IDS STABLES des qualités d'objet — clés de RÈGLES côté moteur. L'`id` = `qualities.json[].id` :
 * ce que la DONNÉE et le runtime (`ItemInstance/Weapon.qualities`, des `QualityInstance{id,
 * value?}`) stockent. `hasQuality`/`qualityIndice` comparent par cet id.
 *
 * `QualityId` est GÉNÉRÉ depuis `qualities.json` par `scripts/gen-quality-ids.mjs`
 * (`npm run gen:quality-ids`) — voir `./qualityId.generated.ts`, NE PAS ÉDITER À LA MAIN. Union de
 * littéraux seulement (aucun export runtime) : les sites d'appel écrivent l'id directement
 * (`hasQuality(w, 'flexible')`), typé `QualityId` — un id renommé/retiré de `qualities.json` fait
 * échouer la compilation aux sites qui le citaient. Fraîcheur vérifiée par `ids.test.ts`
 * (mode `--check`).
 */
import { slugId } from '../../data/slug';

export type { QualityId } from './qualityId.generated';

/** Id stable d'une qualité depuis sa clé de registre (label FR canonique). */
export const qualityIdOf = (key: string): string => slugId(key);
