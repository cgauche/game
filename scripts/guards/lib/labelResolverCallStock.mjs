// STOCK CLIQUETÉ des appels EXISTANTS, depuis `src/engine`/`src/state`, à un résolveur d'entité par
// LIBELLÉ de `src/data/index.ts` (`findCreature`/`findSpell`/`findTalent`/`findSkill`/`findStar`/
// `findDomain`/`findTrappingByLabel` — détection structurelle, `collectLabelEntityResolvers` de
// `labelLogic.mjs`) — consommé par `src/state/label-logic-guard.test.ts` (#909). Patron
// whitelist-en-lib du dépôt (`folioRatchetStock.mjs`/`entityOrphanStock.mjs`/`manualDocsStock.mjs`).
//
// Compte PAR FICHIER (jamais `fichier:ligne` : la ligne dérive à chaque commit voisin — même
// justification que `LABEL_LITERAL_STOCK`, `labelLogic.mjs`).
//
// CE QUE CE STOCK NE COUVRE PAS (cf. aussi l'en-tête de `scanLabelResolverCalls`,
// `labelLogic.mjs`) : un appel PAR MÉTHODE (`obj.findCreature(...)`) — seul l'appel BARE (identifiant
// nu) est scanné ; un résolveur importé sous un ALIAS (`import { findCreature as fc }`) — le scan lit
// le nom appelé tel quel, pas la provenance de l'import.
// ÉTAT : le stock est VIDE, et ce zéro est un CLIQUET TENU (même forme que le solde de
// `folioTitleRatchetStock.mjs:18-19`) — le premier appel neuf depuis `src/engine`/`src/state` est une
// entrée que ce stock ne porte pas, donc une `neuve` du volet consommateur : il rougit sans marge
// d'accueil, et sans qu'aucun plafond ne double ce zéro. L'écart se calcule chez le consommateur par
// la primitive partagée `ecartsDeStock` (`stock.mjs`), jamais par un calcul local.
/** @type {Readonly<Record<string, number>>} */
export const LABEL_RESOLVER_CALL_STOCK = {};
