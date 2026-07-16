---
name: game-tests-isolate-false-speedup
description: Suite vitest 5.5× plus rapide via test.isolate:false ; tout NOUVEAU singleton de module doit être reset dans test-setup.ts
metadata: 
  node_type: memory
  type: project
  originSessionId: 5cf12250-6437-449a-b64d-bd0ce1aaaf4c
---

`vite.config.ts` → `test.isolate: false` : le graphe de modules (moteur + ~1 Mo `src/data/*.json`)
est évalué une fois PAR WORKER au lieu d'une fois par fichier → la phase `collect` (≈98 % du temps)
s'effondre. **Suite 79 s → 14 s (5.5×)**, ~6570 tests. Diagnostic = `Duration (… collect …)` du
reporter default : c'était `collect 918 s` sommé, pas `tests` (≈17 s). Sûr car AUCUN `vi.mock`/
`vi.spyOn` dans toute la suite et AUCUN `beforeAll`.

**Contrepartie : les SINGLETONS de module fuient entre fichiers d'un worker.** `src/test-setup.ts`
(setupFiles, hooks les plus EXTERNES → tournent AVANT le beforeEach du fichier) reset 3 singletons
avant chaque test : (1) store zustand `useGame` (parse d'un `PRISTINE_STATE` figé, merge partiel
préserve les actions) ; (2) registre règles optionnelles `engine/policy` via `loadRuleOverrides({})` ;
(3) registre `cascadeAppliers` (`state/cascade`) snapshot/restore (un test enregistre un FAUX `shelter`
qui écrasait le vrai → `rest-flow` n'insérait plus l'Exposition, flake selon l'ordre des fichiers).

**RÈGLE : tout nouveau singleton mutable de module (registre `register*`, cache, état partagé)
DOIT être reset dans `test-setup.ts`, sinon flake sous isolate:false.** `combatHooks` (HOOKS non
exporté) fuit aussi mais bénin (les hooks de test ne mutent aucun état de jeu).

Garde : `npx vitest run --isolate` force isolate:true (comportement d'origine) — même jeu d'échecs
prouve qu'un échec est PRÉ-EXISTANT (WIP), pas une fuite. Voir [[env-use-powershell-not-bash]].
