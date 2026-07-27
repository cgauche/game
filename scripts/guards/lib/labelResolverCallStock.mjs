// STOCK CLIQUETÉ des appels EXISTANTS, depuis `src/engine`/`src/state`, à un résolveur d'entité par
// LIBELLÉ de `src/data/index.ts` (`findCreature`/`findSpell`/`findTalent`/`findSkill`/`findStar`/
// `findDomain`/`findTrappingByLabel` — détection structurelle, `collectLabelEntityResolvers` de
// `labelLogic.mjs`) — consommé par `src/state/label-logic-guard.test.ts` (#909). Patron
// whitelist-en-lib du dépôt (`folioRatchetStock.mjs`/`entityOrphanStock.mjs`/`manualDocsStock.mjs`).
//
// Compte PAR FICHIER (jamais `fichier:ligne` : la ligne dérive à chaque commit voisin — même
// justification que `LABEL_LITERAL_STOCK`, `labelLogic.mjs`). Aucune de ces entrées n'est une
// exemption : ce sont les 12 appels MESURÉS à la pose de la règle (2026-07-27), zéro dans
// `src/state`, 12 dans `src/engine` — chiffre RE-MESURÉ (ne PAS le confondre avec un décompte brut
// des 3 noms de résolveur cités au ticket sur `src/state`+`src/engine`, TESTS compris, qui donne
// 70+4 : ce dernier compte des FIXTURES de test légitimes, hors périmètre de cette garde — les
// tests restent exclus, cf. `isCorpusExcluded`).
//
// Les 12 sont TOUS le MÊME motif : `findTalent(name)?.id ?? slugId(name)` / `findSkill(name)?.id ?? …`
// — un repli id-depuis-libellé à l'intérieur d'helpers documentés eux-mêmes « couture label→id du
// bord AUTHORING » (`talentRefKeyOf`, `character.ts:80`). Ce N'EST PAS une exemption automatique :
// la doctrine (CLAUDE.md) réserve CETTE couture à `src/data/index.ts` UNIQUEMENT — ces 12 appels
// vivent dans `src/engine`, donc DEUX fautes superposées (résolution par label + couture hors de
// son fichier), pas une seule. Rien n'a été tranché ici : ils restent au stock comme les autres,
// migration hors périmètre de ce lot.
//
// CE QUE CE STOCK NE COUVRE PAS (cf. aussi l'en-tête de `scanLabelResolverCalls`,
// `labelLogic.mjs`) : un appel PAR MÉTHODE (`obj.findCreature(...)`) — seul l'appel BARE (identifiant
// nu) est scanné ; un résolveur importé sous un ALIAS (`import { findCreature as fc }`) — le scan lit
// le nom appelé tel quel, pas la provenance de l'import.
/** @type {Readonly<Record<string, number>>} */
export const LABEL_RESOLVER_CALL_STOCK = {
  'src/engine/character.ts': 6,
  'src/engine/careerSlots.ts': 3,
  'src/engine/creatureEquip.ts': 1,
  'src/engine/magic.ts': 1,
  'src/engine/talentEffects.ts': 1,
};

/** Écarts au stock — cliquet STRICT dans les deux sens (même mécanique que `labelLiteralStockDrift`,
 *  `labelLogic.mjs`) : un compte SUPÉRIEUR (appel neuf) échoue, un compte INFÉRIEUR (dette soldée non
 *  retirée) échoue aussi.
 *  @param {Map<string, number>|Record<string, number>} measured @returns {string[]} */
export function labelResolverCallStockDrift(measured) {
  const entries = measured instanceof Map ? [...measured] : Object.entries(measured);
  const out = [];
  for (const [rel, n] of entries) {
    const stock = LABEL_RESOLVER_CALL_STOCK[rel] ?? 0;
    if (n > stock) {
      out.push(`${rel} : ${n} appel(s) à un résolveur d'entité par LIBELLÉ, stock = ${stock} — résoudre par ` +
        "l'id STABLE déjà tenu par l'appelant (findXById), le résolveur par label est réservé à l'authoring.");
    } else if (n < stock) {
      out.push(`${rel} : ${n} appel(s), stock = ${stock} — dette SOLDÉE, mettre LABEL_RESOLVER_CALL_STOCK à jour dans le même geste.`);
    }
  }
  return out;
}
