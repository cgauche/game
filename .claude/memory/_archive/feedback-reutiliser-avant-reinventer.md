---
name: feedback-reutiliser-avant-reinventer
description: "Avant d'écrire tout composant/logique, GREP l'existant et réutiliser — l'utilisateur est excédé que je réinvente à chaque prompt"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 583862c1-7e63-4e95-b150-b9b93ba918ab
---

L'utilisateur (excédé, verbatim) : « j'en ai vraiment ras le bol que tu réinventes l'existant inlassablement dès que je fais un nouveau prompt ». Exemple concret : j'ai écrit un `PassiveModField` à la main (gestion de liste add/remove + sélecteur de kind) alors que **`GameOpEditor` édite DÉJÀ une liste de `GameOp[]`** (c'est ce que `EffectList` lui passe : `<GameOpEditor ops=… onChange=… />`). J'ai aussi itéré la donnée 3× (typé → PassiveMod[] → GameOp[]) au lieu de cadrer la représentation d'emblée.

**Why** : ça crée du va-et-vient (composant créé puis supprimé, données re-migrées), c'est exactement ce que le `Game/CLAUDE.md` interdit (« Primitives partagées — RÉUTILISER, ne JAMAIS réécrire à la main ») et ça épuise l'utilisateur.

**How to apply** :
- AVANT d'écrire un composant/une fonction/un mot-clef d'op : **grep l'existant lié à la tâche** d'abord. Pour l'édition d'ops : `GameOpEditor` (liste), `EffectList`, `FlowEditor`, `OpFields`/`newOp`/`opSummary`. Pour l'UI : la table « Primitives partagées » du CLAUDE.md. Pour une représentation de donnée : matcher un patron existant (un passif = `GameOp[]` comme `Trauma.ops`, kind affecté par le collecteur — pas un nouveau wrapper).
- Chaque mot-clef d'op doit être **le plus global/paramétrable possible** ; ne PAS multiplier le vocabulaire quand un op existant + params fait l'affaire (cf. `movementHalved`→`moveScale`).
- Cadrer la forme de donnée UNE fois (en s'alignant sur l'existant), pas par itérations successives sous l'œil de l'utilisateur.

Prolonge [[feedback-ecran-touche-audit-primitives]] (audit primitives) et [[game-existant-poc-refactor-libre]].
