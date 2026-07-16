---
name: game-exhaustive-guard-vs-per-domain
description: Une garde DONNÉE par-domaine rate les domaines OUBLIÉS ; garde EXHAUSTIVE dérivée du catalogue + vérif navigateur = filet réel.
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 68de8032-a27c-49b5-aed9-06d772773c1f
---

Lors d'une migration multi-domaines de données (label→id des specs, 2026-07-05), écrire une garde
d'intégrité DONNÉE **par domaine migré** (« toutes les instances de `langue` = id connu ») est un piège :
elle ne vérifie QUE ce qu'on a pensé à migrer, donc laisse passer **les domaines qu'on a oubliés**
(`musicien`/`divertissement`/`sens-aiguise`/… non migrés + `pregens.ts` non balayé). La suite (8685 tests
VERTS) n'a rien vu — les fixtures des domaines oubliés étaient cohérentes avec elles-mêmes.

**Why :** un garde-fou qui énumère les cas connus prouve seulement que les cas connus vont ; il ne peut pas
détecter un cas INCONNU. Le filet doit dériver la vérité du CATALOGUE, pas d'une liste tenue à la main.

**How to apply :**
- Garde EXHAUSTIVE générique : itère CHAQUE def (skills.json/talents.json) qui est fermée à specs
  (`specs`={id,label}[], pas `specsOpen`), et vérifie que TOUTE instance dans TOUTES les données
  (`creatures`/`careerLevels`/`species`/`stars`/`traits`/`trappings` + **`makePregens()` runtime** +
  self-refs) a un spec = id connu. Aucune allowlist silencieuse. Elle rattrape aussi les trous des domaines
  DÉJÀ migrés (elle a trouvé des manques dans magie-des-arcanes/focalisation/projectiles/metier).
- **La vérif NAVIGATEUR est un filet indépendant** : c'est elle (scénario `bestiaire` via `__wfrp`, lecture
  des `groups`/`spec` sur les combattants réels) qui a d'abord montré `musicien:"Tambour"`, `sens-aiguise:
  "Ouïe"`, `corps-a-corps:"Base"` (pregen) — un TROU que 8685 tests avaient manqué. Toujours dérouler un
  scénario réel et inspecter la DONNÉE en jeu, pas seulement lancer la suite. Cf. [[game-groups-specs-i18n-complete]].
- Corollaire : après une migration « déclarée finie », se méfier — un audit adversarial (garde exhaustive +
  navigateur) trouve les oublis. Cf. [[feedback-fidelite-raw-et-editabilite-non-negociables]].
