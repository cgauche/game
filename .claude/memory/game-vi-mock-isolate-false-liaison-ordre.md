---
name: game-vi-mock-isolate-false-liaison-ordre
description: "vi.mock sous isolate:false se lie selon l'ORDRE des fichiers du worker — flake CI déterministe (vert local, rouge CI), le mock peut n'être JAMAIS appelé"
metadata: 
  node_type: memory
  type: project
  originSessionId: 032f0876-8eb3-421a-bddc-50a550c9bc09
  modified: 2026-07-28T22:32:32.412Z
---

Sous `isolate: false` (vite.config.ts, cf. [[game-tests-isolate-false-speedup]]), le graphe de modules est PARTAGÉ par worker : un `vi.mock('./x')` ne prend PAS si un fichier de test antérieur du même worker a déjà instancié le module réel. La répartition fichiers→workers dépend du nombre de cœurs → **vert sur la machine locale (beaucoup de cœurs), rouge déterministe en CI (2 cœurs)**.

Vécu 2026-07-28/29 : `resolve-membre.test.ts` (seul `vi.mock` de la suite) — sonde décisive : `callsAfter = 0`, le mock n'était JAMAIS appelé (pas un `mockReturnValueOnce` consommé ailleurs). Deux runs CI rouges identiques sur la même assertion ; repro locale par `--no-file-parallelism --sequence.shuffle` (5 seeds sur 5).

**Why:** un mock de module sous graphe partagé est une liaison DÉPENDANTE DE L'ORDRE, pas une garantie ; et le symptôme (« la valeur mockée n'arrive pas ») imite parfaitement un cache/mémo court-circuitant le mock — mon diagnostic mémo était FAUX, réfuté par la sonde de comptage d'appels.

**How to apply:**
- Jamais de `vi.mock` dans cette suite : injecter la fixture par le REGISTRE réel mutable (`TENUE_BY_ID[id] = fixture` + `try/finally delete`) et exercer le vrai chemin — patron `withTenue` de `resolve-membre.test.ts`.
- Garde structurelle `src/vi-mock-isolate-guard.test.ts` : échec si un `vi.mock(` réapparaît tant que `isolate: false`.
- Repro d'un flake d'ordre : `npx vitest run <dossier> --no-file-parallelism --sequence.shuffle --sequence.seed=N` — 5 seeds avant de conclure.
- Diagnostiquer un mock « inefficace » : COMPTER les appels du mock d'abord (`callsAfter`) — 0 appel = liaison manquée, N appels = valeur consommée ailleurs. Deux causes, deux fix différents.
