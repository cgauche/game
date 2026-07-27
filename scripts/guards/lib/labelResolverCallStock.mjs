// STOCK CLIQUETÉ des appels EXISTANTS, depuis `src/engine`/`src/state`, à un résolveur d'entité par
// LIBELLÉ de `src/data/index.ts` (`findCreature`/`findSpell`/`findTalent`/`findSkill`/`findStar`/
// `findDomain`/`findTrappingByLabel` — détection structurelle, `collectLabelEntityResolvers` de
// `labelLogic.mjs`) — consommé par `src/state/label-logic-guard.test.ts` (#909). Patron
// whitelist-en-lib du dépôt (`folioRatchetStock.mjs`/`entityOrphanStock.mjs`/`manualDocsStock.mjs`).
//
// Compte PAR FICHIER (jamais `fichier:ligne` : la ligne dérive à chaque commit voisin — même
// justification que `LABEL_LITERAL_STOCK`, `labelLogic.mjs`).
//
// Lot 2026-07-27 (solde 11/12) — les 11 appels `findTalent(name)?.id ?? slugId(name)` /
// `findSkill(name)?.id ?? …` de `character.ts`/`careerSlots.ts`/`magic.ts`/`talentEffects.ts`
// étaient TOUS le cas 2 de l'arbitrage : l'appelant ne tenait qu'un LIBELLÉ D'AUTHORING (entrée de
// carrière/espèce, param `label`/`talentLabel` documenté « bord authoring/tests ») — la couture
// était légitime mais MAL PLACÉE. Soldé par DÉPLACEMENT de la couture (comportement inchangé,
// vérifié aux tests) vers `src/data/index.ts` : `skillIdByLabel`/`talentIdByLabel`/`wildcardSpecIds`
// (convention `xIdByLabel` déjà posée par `conditionIdByLabel`/`charKeyByLabel`/
// `weaponGroupIdByLabel`) — leur retour n'est pas une entité `XxxData`, donc hors du critère
// structurel de `collectLabelEntityResolvers` : `src/engine` qui les appelle n'est plus vu par ce
// scan. `careerSlots.ts:339`/`talentEffects.ts:78` étaient déjà signalés « appel légitime repéré »
// dans `labelLogic.mjs` (le scan ne pouvait pas les isoler mécaniquement) — le déplacement les
// résout au lieu de les documenter en exception.
//
// `src/engine/creatureEquip.ts` (1, IRRÉDUCTIBLE au 2026-07-27) : `weaponFromLabel` appelle
// `findTrappingByLabel(label)?.shape` — cas 3 (« ni l'un ni l'autre »), mesuré : ZÉRO appelant en
// PRODUCTION (`SceneEntity.weapon` porte un `trappingId` et passe par `weaponFromId`, jamais par
// ici) — seul un fixture de test rig (`biped-golden.test.ts`) construit des armes par libellé
// FR brut (« Épée », « Grande hache ») pour la lisibilité du golden test. Ni cas 1 (aucun id tenu
// en amont, la fonction n'a pas d'appelant réel) ni cas 2 franc (le seul consommateur réel est un
// test, hors du périmètre « authoring ») : reste au stock, DÉPLACER la couture ne changerait aucun
// comportement réel puisque rien en production ne l'exerce.
//
// CE QUE CE STOCK NE COUVRE PAS (cf. aussi l'en-tête de `scanLabelResolverCalls`,
// `labelLogic.mjs`) : un appel PAR MÉTHODE (`obj.findCreature(...)`) — seul l'appel BARE (identifiant
// nu) est scanné ; un résolveur importé sous un ALIAS (`import { findCreature as fc }`) — le scan lit
// le nom appelé tel quel, pas la provenance de l'import.
/** @type {Readonly<Record<string, number>>} */
export const LABEL_RESOLVER_CALL_STOCK = {
  'src/engine/creatureEquip.ts': 1,
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
