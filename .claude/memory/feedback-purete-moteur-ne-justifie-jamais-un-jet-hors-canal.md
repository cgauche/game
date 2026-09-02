---
name: feedback-purete-moteur-ne-justifie-jamais-un-jet-hors-canal
description: "2026-09-02 — « Comment on peut surmonter une règle applicative avec des justifications aussi moisies ! » : les trains #1657 B2a-c ont unifié la FORME des jets (nœud test) mais laissé leur RÉSOLUTION hors de la porte canonique (auto-résolus par le moteur avec le RNG du combat), en invoquant « moteur pur, resolveFlowTest intransportable » et « invariance RNG » — et j'ai laissé naître un registre d'exemptions AUTO_RESOLUS. Un registre d'exceptions à la doctrine des jets est interdit ; « pureté du moteur » = erreur de classification (la résolution d'un Test appartient à la couche qui tient la porte)"
metadata:
  type: feedback
---

**Verbatims utilisateur (2026-09-02)** : « Attends, c'est quoi ce délire avec la creation du ticket 1685, en quoi ca demande une décision de ma part ? » puis « Genre c'est quoi la régle sur le jet de l'application ? Comment on peut surmonter une régle applicatuve avec des justification aussi moisi ! »

**La règle** : [[user-doctrine-forme-canonique-unique-jets]] (2026-08-24, verbatim) — « À partir du moment ou je dois faire un jet, il doit apparaitre. Y'a pas de "classe spéciale" … face a … une maladie » ; TOUT Test passe par la porte canonique (`openRoll`), le SOCLE décide seul de la surface ; un stock d'inline est une dette décroissante vers ZÉRO, jamais un registre permanent.

**Ce que j'ai fait de travers** : trois trains de suite (#1657 B2a critiques, B2b maladies, B2c équipage) ont posé le nœud `test` canonique en DONNÉE tout en gardant la résolution dans le moteur pur (`resolveCritique`, `symptomOnTick`, `applyCrewHit`) avec le RNG du combat, au motif que `resolveFlowTest` (state) est « intransportable » dans `src/engine` (`engine-purity.test.ts`) et que l'invariance RNG devait être préservée. Un registre `AUTO_RESOLUS` (`src/state/flowtest-derived-stake.test.ts`) a été créé pour « déclarer » ces exemptions, et il a GROSSI à chaque train. Les juges l'ont validé ; je l'ai recopié sans le confronter à la doctrine.

**Why :** « le moteur ne peut pas importer la porte » ne dit pas qu'il faut résoudre le jet dans le moteur — il dit que la résolution n'est PAS le travail du moteur : le moteur pur rend « un Test à ouvrir + ce qui s'applique par branche », la couche `state` l'ouvre par la porte canonique comme tout autre Test. L'invariance RNG n'est l'invariant que d'un train de FORME ; une fois la forme posée, le train de RÉSOLUTION suit obligatoirement — sinon la forme est une demi-migration ([[feedback-jamais-de-demi-migration]]). Un registre d'exemptions à une doctrine de socle est le signal exact de la dérive ([[feedback-registre-fossiles-transition]] : un registre de transition doit DÉCROÎTRE et porter sa date de mort).

**How to apply :**
1. Toute justification « pureté du moteur », « RNG », « auto-résolu » pour garder un Test hors de la porte canonique est REFUSÉE par principe ; le train de forme est suivi, dans le MÊME plan, du train de résolution par le canal.
2. `AUTO_RESOLUS` est une dette datée à ramener à ZÉRO (train B3 de #1657) ; aucune entrée nouvelle n'y entre sans que le pilotage porte la date de sa mort.
3. Un juge qui écrit « décision utilisateur » ou « hors périmètre » sur une règle de socle se contredit avec la doctrine avant d'être recopié ([[feedback-changement-de-rng-nest-pas-une-decision-utilisateur]]).
