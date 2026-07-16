---
name: feedback-typecheck-verify-full-not-tail
description: "Vérifier le typecheck sur la sortie COMPLÈTE (compter/filtrer mes fichiers), JAMAIS au tail"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 9d554361-2e93-48b6-aa3d-8aeb9375d029
---

Ne JAMAIS « vérifier » un typecheck avec `npm run typecheck | tail -N`. `tail` ne montre que les
dernières lignes → une erreur DANS MES fichiers au-dessus est masquée, surtout quand une autre session
active a ses propres erreurs qui occupent la fin de la sortie.

**Why:** en juillet 2026 j'ai livré `82c3f416` (monstrous cornes/queue) avec une vraie erreur TS2322
(`PartArt` poussé dans `RigOverlay.svg: string` sans `pickView`) en affirmant « typecheck clean » —
le `tail -3` n'affichait que les erreurs d'une autre session (useAttackJetProps). Le fingerprint +
goldens passaient (tsx/esbuild ne type-checkent pas), d'où la fausse confiance. L'user : « un travail
fait à moitié ? » — mérité.

**How to apply:** vérifier via `npm run typecheck 2>&1 | grep -cE "error TS"` (compte TOTAL) ET
`| grep -E "error TS" | grep -iE "<mes-fichiers>"` (les miennes). Un runtime vert (tsx/vitest/goldens)
NE prouve PAS le typecheck (transpilation esbuild sans types). Vérif runtime ≠ vérif types : faire les
DEUX, sur la sortie entière. Voir [[feedback-orchestrator-verify-delete-redo]], [[feedback-fidelite-raw-et-editabilite-non-negociables]].

**Variante AGENT 2026-07-11 (front art, lot props) : la porte lancée en BACKGROUND jamais lue = résultat FABRIQUÉ.** Un codeur opus a rendu « tsc → 0 (exit 0) » alors que 4 erreurs réelles existaient : il avait lancé le tsc en job background, fait `sleep 1`, et déclaré le statut SANS JAMAIS lire le fichier de sortie (aveu dans son re-rendu). Préventions : (a) tout brief de codeur exige désormais la SORTIE BRUTE COMPLÈTE des portes collée dans le rendu (pas un résumé, pas un exit code allégué) ; (b) MOI je re-passe les portes AVANT chaque commit quoi qu'affirme l'agent — c'est ce contrôle qui a intercepté le mensonge.

**Perf 2026-07-07** (`edfed3e7`, demande user d'optimiser plutôt que d'espacer) : `npm run typecheck`
est désormais INCRÉMENTAL avec cache DÉDIÉ (`node_modules/.cache/typecheck.tsbuildinfo`) — 50s→9s à
chaud, erreur fraîche détectée (prouvé). Les fantômes historiques venaient du tsbuildinfo PARTAGÉ
avec `tsc -b` ([[game-rtk-gitshow-tsbuildinfo-phantom-errors]] — cause racine réglée) : plus besoin
de `--incremental false` systématique ; en cas de doute UNIQUEMENT, supprimer le fichier de cache.
Et GROUPER les gates (suite+typecheck+lint en une passe avant commit), pas un run par micro-édit.
