/**
 * Migration #311 — `CharKey` (`'CC'|'CT'|'F'|'E'|'I'|'Ag'|'Dex'|'Int'|'FM'|'Soc'`) → slugs pleins
 * (`engine/types.ts`), portée sur l'état RUNTIME sérialisé (saves `SAVE_VERSION` MIGRATIONS[2],
 * export roster `ROSTER_MIGRATIONS[1]`) — SOURCE UNIQUE, jamais dupliquée entre `saves.ts`/`roster.ts`.
 */

const OLD_CHARKEY_TO_NEW: Record<string, string> = {
  CC: 'capacite-de-combat',
  CT: 'capacite-de-tir',
  F: 'force',
  E: 'endurance',
  I: 'initiative',
  Ag: 'agilite',
  Dex: 'dexterite',
  Int: 'intelligence',
  FM: 'force-mentale',
  Soc: 'sociabilite',
};
const OLD_CHARKEYS = new Set(Object.keys(OLD_CHARKEY_TO_NEW));

/** Champs (valeur = CharKey) recensés dans l'état runtime (#311) : `Condition.compare`/`Formula`
 *  (`engine/ops.ts`), `FlowTest`/`ManeuverDef`/`CreatureAttack`/`DomainData` (mêmes clés que la donnée
 *  JSON, `scripts/migrations/2026-07-11-charkey-slugs.mjs`), + `resolveChar`/`testModChar`
 *  (runtime-only, cf. `engine/types.ts`). */
const CHARKEY_SCALAR_FIELDS = new Set([
  'characteristic', 'char', 'bonusOf', 'charOf', 'castingChar', 'radiusStat', 'cap', 'attacker',
  'rangeChar', 'stat', 'resolveChar', 'testModChar',
]);
/** Champs dont les CLÉS (pas les valeurs) sont des CharKey : les caractéristiques brutes du
 *  `Combatant`/`baseChars`, `CreatorDraft.charAdvancesAlloc`, `Character.charAdvances`,
 *  `CustomStatblock.char`. */
const CHARKEY_RECORD_FIELDS = new Set(['characteristics', 'baseChar', 'char', 'charAdvances', 'charAdvancesAlloc', 'chars']);

/** Réécrit récursivement TOUTE occurrence de CharKey (valeur scalaire OU clé de Record) rencontrée sous
 *  les noms de champ recensés — même primitive que la migration des données app-owned (#311), portée
 *  ici sur l'état RUNTIME sérialisé (save/export roster). Ne mute pas l'entrée : reconstruit (le
 *  round-trip `JSON.parse` de `migrateDoc` a déjà cloné le document). Idempotent (aucun ancien token
 *  restant après un premier passage → no-op sur un doc déjà migré). */
export function remapCharKeysDeep(node: unknown): unknown {
  if (Array.isArray(node)) return node.map(remapCharKeysDeep);
  if (node && typeof node === 'object') {
    const entries = Object.entries(node as Record<string, unknown>).map(([k, v]) => {
      if (CHARKEY_RECORD_FIELDS.has(k) && v && typeof v === 'object' && !Array.isArray(v)) {
        const keys = Object.keys(v as Record<string, unknown>);
        if (keys.some((kk) => OLD_CHARKEYS.has(kk)) && keys.every((kk) => OLD_CHARKEYS.has(kk) || kk === 'M' || kk === 'B')) {
          const remapped = Object.fromEntries(
            Object.entries(v as Record<string, unknown>).map(([kk, vv]) => [OLD_CHARKEY_TO_NEW[kk] ?? kk, vv]),
          );
          return [k, remapped];
        }
        return [k, remapCharKeysDeep(v)];
      }
      if (CHARKEY_SCALAR_FIELDS.has(k) && typeof v === 'string' && OLD_CHARKEYS.has(v)) {
        return [k, OLD_CHARKEY_TO_NEW[v]];
      }
      return [k, remapCharKeysDeep(v)];
    });
    return Object.fromEntries(entries);
  }
  return node;
}
