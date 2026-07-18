---
name: game-collision-livres-identique-vs-divergent
description: "Deux livres définissent la même entité : DIVERGENTS → entrées distinctes (3b651133) ; IDENTIQUES ou sur-ensemble strict → UNE entrée. Le split redoutable ZI/MDG était une duplication ET un axe faux."
metadata: 
  node_type: memory
  type: project
  originSessionId: cb384a41-d20a-494b-aa60-728b2ed7534f
---

> ⚠ **SUPERSÉDÉ LE JOUR MÊME sur son cas (C)** — voir **[[game-doctrine-une-entite-n-livres-n-variantes]]**. La doctrine user est : « **jamais ca ne sera 2 talents différents** ». Une divergence entre livres est une **VARIANTE de la même entité** (gatée par la règle optionnelle), **pas** une seconde entrée. Ne pas se réclamer du cas (C) ci-dessous. Le reste de cette fiche (le bug d'AXE, et la leçon d'orchestration) reste valide et important.

**Arbitrage user (2026-07-17, verbatim)** : « **Oui enfin redoutable de ZI et MDG sont identiques non ? Pourquoi dupliquer la donnée ?** »

Il avait raison, et plus gravement que sa question ne le disait.

## La règle qui se dégageait — trois cas (⚠ le (C) est FAUX, voir l'encadré)

1. **Les livres DIVERGENT** (valeurs ou clauses différentes) → **entrées DISTINCTES**, chacune taguée à SA source. Patron `3b651133` (« Mur de pierre AA en entrée distincte par source — collision résolue par coexistence », #450). **Reste valide pour SON cas.**
2. **Un livre B GLOSE la définition de A** (version allégée/altérée au passage) → **la définition de A prime**, la glose de B est écartée. Voir [[game-collision-edoc-ldb-belliqueux-tranchee]] (⚠ son cas fondateur était une dette FANTÔME).
3. **Les livres sont IDENTIQUES, ou l'un est un SUR-ENSEMBLE STRICT** → **UNE SEULE entrée**, sourcée au livre qui porte le texte le plus complet. **Dupliquer est de la dette ; scoper par livre est un AXE FAUX.**

## Le cas fondateur du cas 3 — mesuré au Source

`Source/WH - V4 - Le zoo impérial/14 - Expéditions prévues.md:1045` et `Source/WH - V4 - La Mer de Griffe/16 - Bestiaire.md:11` sont **identiques MOT POUR MOT** (seule l'amorce en gras diffère : `**Redoutable (Indice) :** cette` vs `Cette`). MDG l.13 **ajoute** : « *Si vous utilisez les règles d'Avantage de groupe du supplément **Aux Armes !**, la créature génère un nombre d'Avantages égal à son Indice […] pour la réserve d'Avantages des adversaires.* »

**LE BUG D'AXE** : cette clause est conditionnée au **MODULE DE RÈGLES**, pas au livre d'origine de la créature — elle dit ce que fait « la créature », toute créature portant Redoutable, quand le module optionnel est actif. Le split (`461e3ef4`) faisait qu'**un dragon ZI ne nourrissait JAMAIS la réserve adverse même en mode Avantage de groupe**, alors qu'un kraken MDG le faisait.

**Le comble** : `src/state/combat/advantagePool.ts` était **déjà** gardé par `groupAdvantage()` à chaque entrée (l.29, 42, 62, 79, 103). La condition « si vous utilisez ces règles » était **déjà modélisée sur le bon axe** — le split l'a doublée d'un axe faux.

## Why — la leçon d'orchestration, la plus chère du tour

**J'ai appliqué un précédent (`3b651133`) sans vérifier qu'il s'appliquait.** Pire : l'agent de #536 me l'avait ÉCRIT — « MDG scope le rider au module de règles, pas au livre d'origine de la créature », « caractérisation juste : MDG = sur-ensemble strict » — et j'ai classé ça en « **réserve de conception, chantier collisions différé** » au lieu d'y voir un **bug vivant**. C'est exactement le [[feedback-jamais-de-constat-silencieux]] que le credo interdit, commis par l'orchestrateur et pas par un agent.

**How to apply :**
- Avant d'invoquer un précédent de collision, **lire les DEUX passages au Source** et établir lequel des 3 cas s'applique. Le titre du précédent ne suffit pas — `3b651133` est fondé sur des **valeurs divergentes** (c'est dans son message de commit), pas sur « deux livres parlent de la même chose ».
- Une « réserve de conception » d'agent qui décrit un **écart de comportement** n'est pas un chantier différé : c'est un bug. Le test : « est-ce que le jeu fait aujourd'hui quelque chose que le RAW ne dit pas ? » → oui → ticket ou fix, jamais une note.
- Le RAW conditionne souvent à un **module optionnel** (« si vous utilisez les règles de X »). Cet axe se modélise par un gate de règle (`groupAdvantage()`), **jamais** par le livre d'origine de l'entité.

Lié : [[game-collisions-variantes-livres-deferred]], [[game-source-page-multi-folios-convention-raw]] (même tour : l'user a redressé deux fois en pointant la source), [[feedback-verifier-les-claims-architecturaux-des-agents]], [[game-data-driven-architecture]].
