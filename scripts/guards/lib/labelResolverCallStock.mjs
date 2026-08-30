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
// `src/engine/creatureEquip.ts` (soldé 2026-07-27) : `weaponFromLabel` (le seul cas 3 « ni l'un ni
// l'autre » du stock) est SUPPRIMÉ — son unique appelant (`biped-golden.test.ts`) construit
// désormais son arme de fixture par `weaponFromId` (id de catalogue stable), comme la production.
//
// CE QUE CE STOCK NE COUVRE PAS (cf. aussi l'en-tête de `scanLabelResolverCalls`,
// `labelLogic.mjs`) : un appel PAR MÉTHODE (`obj.findCreature(...)`) — seul l'appel BARE (identifiant
// nu) est scanné ; un résolveur importé sous un ALIAS (`import { findCreature as fc }`) — le scan lit
// le nom appelé tel quel, pas la provenance de l'import.
// ÉTAT : le stock est VIDE, et ce zéro est un CLIQUET TENU (même forme que le solde de
// `folioTitleRatchetStock.mjs:18-19`) — le plafond du test est à ZÉRO, donc le premier appel neuf
// depuis `src/engine`/`src/state` rougit, sans marge d'accueil. L'écart se calcule chez le
// consommateur par la primitive partagée `ecartsDeStock` (`stock.mjs`), jamais par un calcul local.
/** @type {Readonly<Record<string, number>>} */
export const LABEL_RESOLVER_CALL_STOCK = {};
