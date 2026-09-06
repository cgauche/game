---
name: feedback-cas-canonique-par-concept-raw-pas-par-mecanisme
description: "Vécu #1599 (2026-09-05) : j'ai briefé un « cas canonique » (suppressSymptom) trouvé par le MÉCANISME que j'avais sous la main, alors que le CONCEPT RAW (« un État qu'on ne peut retirer que sous condition ») avait déjà son vocabulaire (ConditionLocks lockedUntil/unlockBy des Critiques, LDB 18) — le codeur a inventé lockedUntilCured, le juge l'a validé, l'utilisateur a dû réorienter"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: e72180bd-85a9-4fe1-915b-20e4f3d7932a
  modified: 2026-09-05T19:53:33.153Z
---

**Fait (2026-09-05, train #1599)** : LDB 20 l.188 « un État *Exténué* dont vous ne pourrez vous défaire qu'une fois votre maladie guérie » a reçu une capacité de symptôme neuve (`lockedUntilCured`) — alors que l'op `condition` porte DÉJÀ deux verrous de retrait (`lockedUntil` prédicat, `unlockBy` acte de soin, `ConditionInstance`/`ConditionLocks`, Critiques LDB 18, utilisés par le train A #1653). Le brief nommait comme cas canonique `suppressSymptom` (le mécanisme voisin de ma fenêtre de Détermination), pas le concept. Trois passes de juge n'ont rien vu. Verbatim utilisateur : « J'ai souvenir d'autres éléments qui posait un état que tu ne pouvais retirer que sous certaine condition » puis « C'est inquietant que je dois etre la pour te réorienté dans la bonne direction ».

**Why** : la porte « cas canonique » d'un brief de socle ne vaut que si la recherche part du CONCEPT tel que le RAW le formule (« ne peut être retiré que… », « pendant une journée », « ne se cumule pas ») et non du mécanisme que je viens de manipuler. Un cas trouvé par voisinage est un cas trouvé par imitation — le même piège que RELOAD_BY_LABEL (credo).

**How to apply** :
1. Avant tout brief de socle : formuler chaque phrase RAW en CONCEPT (verbe + condition), puis chercher ce concept dans `docs/vocabulaire-mecanique.md` (ops ET leurs CHAMPS — `lockedUntil`, `unlockBy`, `perRound`, `unlessCondition`, `durationRounds`…), `docs/index-moteur.md`, et la table des primitives ; ne nommer un cas canonique qu'après avoir lu la LISTE DES CHAMPS de l'op concernée (`src/engine/ops.ts` type de l'op).
2. Une capacité/un drapeau NEUF sur une entité (`capabilities.x`) est suspect par défaut : demander « quel champ d'op existant dit déjà cela ? » avant d'accepter.
3. Le brief du juge porte la lentille explicite : « existe-t-il un CHAMP d'op ou un verrou existant qui exprime ce concept ? » — un juge qui valide un drapeau neuf sans avoir listé les champs de l'op n'a pas jugé.
4. Ce qui est spécifique à un porteur (symptôme) alors que le concept est général (tout porteur passif) = trou de socle à remonter, pas une garde de donnée à poser.

Lié : [[feedback-chercher-le-canonique-top-down-avant-custom]], [[feedback-socle-resout-specs-adressent]], [[feedback-verifier-les-claims-architecturaux-des-agents]], [[project-1653-chantier-regles-raw-etat-2026-09-05]].
