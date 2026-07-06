# Pérennité à 10 ans — design du programme (2026-07-06)

> Artefact DATÉ (politique docs/) : à supprimer une fois les lots exécutés, git porte l'historique.
> Mandat : « proposer et mettre en place outils + bonnes pratiques pour que le projet continue à
> fonctionner dans 10 ans avec des nouvelles données/implémentations de système tous les jours » —
> reformulé après immersion : **déplacer la qualité de l'audit vers la porte, pour rendre la
> capacité à la production de contenu**.

## 1. Contexte — le métier mesuré

Immersion 2026-07-06 : 6 axes audités en parallèle (données, persistance, environnement, gardes,
connaissance, rythme), chaque lacune contre-vérifiée adversarialement ; analyse des 2 dernières
semaines de git (744 commits) et des 160 issues.

Le métier réel : un humain seul orchestre des sessions IA parallèles sur un arbre git partagé,
~55 commits/jour (0 à 229), aucun jour à zéro sauf un en quinze jours. Boucle quotidienne :
extraction RAW → donnée → mécanisation → gardes → docs → issues. Rituel hebdomadaire
d'**audit-purge** (26-27/06 : 62 issues ; 05-06/07 : 164 trouvailles, ~30 issues) qui consomme
~25-30 % de la capacité. L'usine de gouvernance (Atlas RAW, credo, hooks, skills, gabarit
d'issues) a deux semaines d'âge et s'itère elle-même chaque semaine.

Le projet est déjà exceptionnellement gardé (CI push/PR, ~750 fichiers de tests, gardes
mécaniques originales, Source/ versionné en .md, credo/skills commités). Les risques 10 ans ne
sont PAS l'absence de rigueur : ce sont les endroits précis où le système **fait confiance au
lieu de vérifier**, et le **coût de la détection tardive** (l'audit-purge).

## 2. Diagnostic — les 5 risques confirmés

1. **La donnée n'a aucun contrat de forme.** Casts effacés au runtime (`as CareerData[]`,
   `as any[]` pour characteristics — src/data/index.ts:1140-1173). La validation réelle
   (data-wellformed) est bornée au vocabulaire GameOp + FORMULA_FIELDS ; les fichiers hors
   vocabulaire (ambiance, decorPalette, characteristics, crew-morale, advancementCosts,
   encumbranceTiers…) n'ont qu'un filet syntaxique. id-collisions ne couvre que 7 catalogues
   sur ~20 (src/data/id-collisions.test.ts:30).
2. **La persistance joueur n'a pas de chemin de migration éprouvé.** MIGRATIONS de saves.ts
   vide et jamais exercé (patch ad hoc dans applyLoadedSave à la place) ; SCHEMA_VERSION de
   Scene déclaré et jamais lu (src/state/scene.ts:588, unique occurrence) ; parseProject lève
   sans migrer si schema ≠ 2 (src/state/worldMap.ts:217) ; l'éditeur contourne parseProject
   (src/ui/editor/Editor.tsx:236-245) ; rosterImport ignore EXPORT_VERSION.
3. **Des gardes n'existent qu'à moitié.** coverage/reconcile RAW jamais automatisés (ni npm
   script ni CI) ; docs:check hors CI ; volet « commentaire-excuse » désactivé
   (EXCUSE_GUARD_ACTIVE=false) ; combat-hardcode-guard borné à 3 fichiers ; engine-purity ne
   couvre que engine→state ; aucun hook pre-commit (le « suite complète avant commit » du credo
   repose sur la discipline des sessions).
4. **L'environnement n'est contractualisé nulle part.** Pas d'`engines`/.nvmrc (Node 22
   seulement en CI) ; server/ jamais typecheck/build en CI ; 24 `_registry.generated.ts` sans
   contrôle de dérive ; rien ne détecte le pourrissement de `npm ci` pendant une pause.
5. **Une partie de la matière est hors du clone.** art-ref/ ET ses scripts d'extraction
   gitignorés ; PDFs hors git (assumé) ; chemin absolu machine dans reextract-all.sh ;
   raisonnement d'arbitrage d'une partie des issues uniquement sur GitHub.

Réfuté par la contre-vérification (ne PAS re-traiter) : Source/ est versionné (996 .md
trackés) ; le déploiement et le WIP multi-sessions sont documentés ; engine→state est gardé
(engine-purity.test.ts) ; le protocole coop est versionné avec rejet au handshake ; saves.ts a
un vrai mécanisme de migration (non exercé) ; la charge merge/parallélisme est un choix assumé.

## 3. Principe directeur — la qualité à la porte

Chaque classe de poison observée doit mourir **au plus près du stylo**, l'audit hebdo ne
servant plus qu'à découvrir des classes NOUVELLES. Trois portes :

1. **Au stylo** — hook PostToolUse : rejoue les gardes diff-scopées sur le fichier qu'une
   session vient d'écrire (<1 s) et renvoie l'échec dans le contexte de la session fautive.
2. **Au commit** — hook pre-commit (hooksPath déjà configuré) : gardes scopées aux fichiers
   stagés + contrat de donnée sur les JSON touchés + docs:check si docs/ touché. Budget <5 s
   (à ~90 commits/jour, la suite complète serait impayable). Jamais contourné (credo).
3. **Au push** — CI complète, tout l'existant branché.

**Règle de clôture d'audit** (mécanise le credo) : un audit qui trouve une classe de poison
n'est clos que quand le garde-de-porte de cette classe existe. Indicateur de convergence : le
nombre de trouvailles par audit doit décroître (rapports datés dans docs/plans/ portent le
compte).

Irréductible (l'audit ne descend pas à zéro) : fidélité comportementale (seule la recette
navigateur révèle certains bugs), arbitrages RAW (décision humaine), réinvention subtile
(revue adversariale dans les workflows de production). Cible réaliste : audit hebdo
« ennuyeux » — <10 trouvailles, uniquement des classes nouvelles, une demi-journée.

## 4. Le programme — 5 lots

### Lot 0 — brancher l'existant (1 session)

- CI : ajouter `docs:check`, `npm --prefix server run typecheck`, contrôle de dérive des
  registres (`npm run gen` puis `git diff --exit-code -- '*_registry.generated.ts'`).
- `raw:coverage` / `raw:reconcile` en scripts npm + exécution CI (Source/*.md est commité,
  donc CI-runnable).
- `engines: { node: ">=22" }` dans les deux package.json + `.nvmrc`.
- **Canari hebdomadaire** : workflow GitHub Actions `schedule` (+ `workflow_dispatch`) qui
  rejoue npm ci + typecheck + lint + test + build sur runner neuf, même sans commit ; en échec
  → `gh issue create` automatique. C'est le drill de reprise permanent.
- `validateScene` sur TOUS les scénarios commités (étendre scenarios.test.ts — aujourd'hui
  seuls arene-projet/opera/piege-caveau y passent).

DoD : CI verte avec les nouvelles étapes ; canari déclenché une fois à la main ; un JSON de
scénario sciemment cassé fait échouer la suite.

### Lot 0bis — les portes (2-3 sessions, cœur du programme)

- **Extraire la logique des gardes en modules partagés** (`scripts/guards/lib/`) consommés à la
  fois par les tests Vitest existants et par les hooks — zéro duplication de regex (source
  unique). Gardes concernées : comment-poison (tombstones + excuses), label-logic,
  no-emoji-affordance, hardcode combat.
- **Hook PostToolUse** (`scripts/hooks/poison-postcheck.mjs`) : sur Write/Edit d'un fichier
  src/, rejoue les gardes partagées sur CE fichier, échecs renvoyés en additionalContext.
  (Ne s'applique qu'aux sessions harnais — la porte universelle est le pre-commit.)
- **Hook pre-commit** (`scripts/git-hooks/pre-commit`) : gardes partagées sur les fichiers
  stagés + validation de schéma des src/data/*.json stagés (Lot 1) + docs:check si docs/
  stagé. <5 s.
- **Activer le volet excuses** : trier les excuses existantes (décision utilisateur : vrai
  vocabulaire RAW vs dette), puis EXCUSE_GUARD_ACTIVE=true.
- **Étendre les gardes bornées** : combat-hardcode-guard en cliquet généralisé engine/state
  (baselines par fichier) ; garde de pureté state→ui et engine→ui/gameIso (patron
  engine-purity, allowlist documentée si exception légitime).
- **Règle de clôture d'audit** : ajoutée au credo + au skill audit-poison (« trouvaille de
  classe → garde à la porte dans le même geste ») ; le rapport d'audit daté porte le compte de
  trouvailles (indicateur de convergence).

DoD : écrire une pierre tombale dans un fichier → la session la voit refusée immédiatement ET
le commit échoue ; les tests Vitest des gardes passent toujours (mêmes modules).

### Lot 1 — le contrat de donnée (~1 semaine de sessions parallèles, par famille)

Décision d'outillage : **zod** (v4), schémas = source unique, types TS dérivés par `z.infer`
(remplace progressivement les `as XData[]`). Justification : zéro dépendance transitive,
maintenance 10 ans crédible, un seul vocabulaire pour valider ET typer. Schémas **stricts**
(clés inconnues rejetées = attrape les champs mal orthographiés), enums pour les unions
connues, exceptions `.passthrough()` explicites et commentées.

Points de branchement (le même schéma partout) :
1. **Test CI exhaustif** : chaque src/data/*.json validé contre son schéma ; méta-test
   d'exhaustivité (tout fichier JSON sans schéma enregistré = échec, patron
   data-atlas-complete).
2. **Chargement dev** : validation dure en `import.meta.env.DEV` (le prod charge les mêmes
   JSON que la CI vient de valider — pas de coût runtime).
3. **Sauvegarde éditeur/Compendium** : validation avant écriture (le round-trip byte-fidèle de
   serialize.test.ts reste ; le schéma s'ajoute).
4. **Pre-commit** : validation des JSON stagés (cf. Lot 0bis).

Extension dans le même geste : id-collisions généralisé à TOUS les catalogues à id (careers,
creatures, vehicles, structures, locations…), doublons intra-catégorie compris.

Migration par famille (délégable) : 1 session = N fichiers apparentés ; l'ordre suit le risque
(fichiers hors vocabulaire GameOp d'abord — ils n'ont aujourd'hui AUCUN filet de forme).

DoD : 94/94 fichiers couverts (méta-test) ; un champ mal orthographié ou un type faux dans
n'importe quel JSON fait échouer pre-commit ET CI ; l'éditeur refuse de sauver une donnée
invalide avec un message actionnable.

### Lot 2 — la persistance éprouvée (2-3 sessions)

- **Une primitive de migration unique** (`migrateDoc(doc, MIGRATIONS)` générique) réutilisée
  par les saves (existe), les projets (parseProject migre au lieu de lever) et l'export roster
  (rosterImport vérifie kind/v). Le patch ad hoc worldMap d'applyLoadedSave (store.ts:44-49)
  re-exprimé comme migration officielle — la voie officielle enfin exercée.
- **Golden saves** : fixtures de vraies sauvegardes par version (`__fixtures__/saves/v1-*.json`)
  ; test : chaque fixture migre puis charge ; méta-test cliquet : bump de SAVE_VERSION /
  schema de projet sans (migration + fixture de la version précédente) = échec.
- **SCHEMA_VERSION (scene.ts:588) supprimé** : symbole mort — le versionnage vit au niveau de
  l'enveloppe (save doc, project doc), pas de la scène.
- L'éditeur charge via parseProject (fin du contournement Editor.tsx:236-245).
- Mismatch de protocole coop : message UI distinct (« versions incompatibles ») au lieu de la
  déconnexion générique.

DoD : une save v1 réelle se charge après un bump v2 factice ; bump sans migration = suite
rouge ; import d'un roster d'une autre version = message clair, jamais silencieux.

### Lot 3 — l'usine dans le clone (1-2 sessions)

- Committer les scripts d'extraction art-ref (`art-ref/*/_extract.py`, `_map.py` →
  `scripts/art-ref/`, dé-gitignorés) ; binaires restent hors git ; doc de régénération.
- Politique d'archivage des non-versionnés (PDFs + art-ref binaires) : un zip périodique vers
  stockage externe, documenté ; script optionnel `scripts/ops/archive-non-git.mjs`.
- **Export des issues dans le repo** : `scripts/ops/export-issues.mjs` (gh → 
  `docs/decisions/issues.json` + index .md), exécuté par le canari hebdo — le raisonnement
  d'arbitrage devient greppable hors-ligne.
- reextract-all.sh : chemin absolu machine → chemin relatif au script.
- `docs/reprise-apres-pause.md` : ce qu'un clone nu contient / ne contient pas (PDFs, art-ref
  binaires, compte Cloudflare, repo sibling prod), et le chemin de redémarrage. Garde
  docs:check applicable.

DoD : depuis un clone nu (le canari le prouve chaque semaine pour le chemin code) ; les issues
du mois sont lisibles dans le repo sans réseau.

## 5. Indicateurs de succès (à 4-6 semaines)

- Trouvailles par audit hebdo : décroissantes, cible <10, uniquement des classes nouvelles.
- Temps d'audit-purge : ~½ journée/semaine (contre ~2 jours mesurés) — capacité rendue au contenu.
- Canari hebdo vert ; toute rupture d'environnement détectée en ≤7 jours, même sans activité.
- 94/94 fichiers de données sous contrat ; zéro `as XData[]` restant dans src/data/index.ts.
- Zéro bump de version de persistance sans migration + fixture (cliquet).
- Zéro garde « à la main seulement » : tout ce qui existe tourne au stylo, au commit ou en CI.

## 6. Exécution

Séquence : Lot 0 → Lot 0bis → Lot 1 (parallélisable par familles) → Lot 2 → Lot 3.
Les lots 0/0bis d'abord : ils réduisent immédiatement le flux de poison entrant pendant que le
Lot 1 se déroule. Mode : sessions/agents implémentent, chaque lot vérifié (suite complète +
scénario réel : poison injecté → refusé aux trois portes). Décisions restant à l'utilisateur :
tri des excuses existantes (activation du volet b), arbitrages house-rule rencontrés en route.
