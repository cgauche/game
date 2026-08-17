/**
 * Migration #1318 V8c₅ — deux valeurs de `PassiveKind` (`engine/ops.ts`) sont passées d'un id ACCENTUÉ
 * à un id ASCII : `mobilité` → `mobilite`, `intrinsèque` → `intrinseque` (le reste de la famille l'était
 * déjà — `etat`, `douleur`, `structurel`…). C'est un ID, pas un libellé : rien à traduire, rien à
 * afficher ; mais il est **PERSISTÉ** (`Trauma.passiveKind`, `engine/types.ts` — « Persisté entre
 * combats »), donc une save d'avant le renommage en porte l'ancienne forme.
 *
 * Sans remise en correspondance, `PASSIVE_CANCELLERS[kind]` (table TOTALE sur la nouvelle union) rend
 * `undefined` et le collecteur passif (`passiveMods` → `effectiveChar`/`testValue`) LÈVE sur un
 * `for…of` — le rechargement d'une save portant une séquelle à `passiveKind` (cicatrice octroyée à la
 * guérison d'un Critique) plantait. D'où DEUX étages, chacun nécessaire :
 *  - la MIGRATION de save (ce module, `MIGRATIONS[24]`) : la donnée persistée est remise à la forme
 *    courante, une fois pour toutes ;
 *  - le FILET au site (`normalizePassiveKind`, `engine/ops.ts`, lu par `engine/trauma.ts`) : une valeur
 *    ancienne arrivant par une autre porte (import de roster, document réécrit à la main) ne fait ni
 *    crasher ni DÉRIVER en silence — sans normalisation, `isAdditiveKind('intrinsèque')` rendrait faux
 *    et le modificateur quitterait la somme additive pour le pool non-cumul, sans le moindre signe.
 *
 * La CORRESPONDANCE elle-même vit au moteur (`normalizePassiveKind`), foyer du type : ce module ne
 * porte que le parcours. Même primitive que `remapCharKeysDeep` (`charKeyMigration.ts`, #311) :
 * réécriture récursive d'un document déjà cloné par `migrateDoc`, idempotente.
 */
import { normalizePassiveKind } from '../engine/ops';

/** Champs dont la VALEUR est un `PassiveKind` : `Trauma.passiveKind`/`TraumaFiche.passiveKind` (persisté)
 *  et le `kind` d'un `PassiveMod` (posé à l'émission ; couvert par sûreté). Un `kind` d'une AUTRE forme
 *  (`Mutation.kind: 'physique'`, `Combatant.kind: 'hero'`…) n'est pas dans la table de correspondance et
 *  ressort donc INCHANGÉ : le remap est borné par la VALEUR reconnue, pas par le seul nom de champ. */
const PASSIVE_KIND_FIELDS = new Set(['passiveKind', 'kind']);

/** Réécrit récursivement tout `passiveKind`/`kind` portant une ancienne valeur. Ne mute pas l'entrée. */
export function remapPassiveKindDeep(node: unknown): unknown {
  if (Array.isArray(node)) return node.map(remapPassiveKindDeep);
  if (node && typeof node === 'object') {
    return Object.fromEntries(
      Object.entries(node as Record<string, unknown>).map(([k, v]) => {
        if (PASSIVE_KIND_FIELDS.has(k) && typeof v === 'string') {
          const courant = normalizePassiveKind(v);
          if (courant !== v) return [k, courant];
        }
        return [k, remapPassiveKindDeep(v)];
      }),
    );
  }
  return node;
}
