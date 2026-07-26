---
name: game-frenchy-bzh-creatures
description: "Source fan « frenchy.bzh » (Habitants & Créatures du Vieux-Monde, v4.5) — conversion .md, table de correspondance frenchy→notre VF, intégration créatures"
metadata: 
  node_type: memory
  type: project
  originSessionId: c558bab7-9b0b-4027-ad11-39413de802cf
---

Nouvelle source demandée par l'utilisateur (2026-06-14) : guide fan **« Warhammer v4.5 — Habitants & Créatures du Vieux-Monde »** (Discord), à **tagger `source.book = 'frenchy-bzh'`** (l'ID de `books.json` ; `frenchy.bzh` en est l'`abbr` d'affichage) ; fan-made mais **complète** le bestiaire (ne remplace rien).

- **PDF 630 p. converti** en .md (84 chap.) via `_convert_pdfs.py --root Game/Source --only "*Habitants*"` → `Game/Source/Warhammer - Habitants & Créatures  du Vieux-Monde (Discord) PDF/`.
- **Appendices A-D** = table d'équivalence 3 colonnes **frenchy perso | Khaos-officiel (= NOTRE VF/LDB) | VO Cubicle 7** (Talents/Traits donnés dans les 2 sens). C'est le doc lui-même qui fournit `frenchy → VF`.
- **Correspondance `frenchy → notre label EXACT`** (officiel normalisé : casse/accents/œ/params `(…)` retirés ; bascule sur la **VO** pour les dérives d'édition) : ce sont les **false-friends** qui piquent — frenchy *Déterminé* = notre **Obstiné**, *Navigation* = **Voile**, *Tireur d'Élite* = **Tir mortel**. Couverture obtenue au mappage : skills 45/48, talents 166/188, traits 85/139.
- **Trous** classés : `gap-no-official` (homebrew v4.5 / livres non traduits ou hors périmètre : Lustria, Sea of Claws, Winds of Magic, Imperial Zoo, companions VO…) vs `gap-missing-in-ours` (officiel existe mais non extrait — **surtout des traits EdO AUTORISÉS** : Amorphe, Métamorphe, Voleur de Chair, Contagieux, Décérébré, Absorption).

**Pièges intégration (à respecter) :**
1. ⚠️ Règle « v4.5 » : **PA ×2 + ignore le BE**. Notre moteur est RAW (BE rendu auto) → **diviser leurs PA par 2 à l'import** (trait *Armure (X)* + armures portées). Houserule boucliers-vs-tirs : ignorer.
2. Structure **« Niveau 1-4 »** = homebrew (le v4 = 1 statbloc + traits) → décider variantes vs palier unique.
3. `src/data/*.json` est la SOURCE **app-owned** (commitée, curée à la main) → la maison durable d'une créature frenchy est `creatures.json` elle-même, entrée taguée à sa `source`, **PAS** un all-data.json ni un dataset parallèle.

**Décisions (prises 2026-06-14)** : Niveau 1-4 → **4 variantes distinctes** ; traits EdO manquants → à ajouter à `traits.json` (mais AUCUN créature Part II ne les utilise → reporté, orthogonal) ; trous sans-VF → **custom hors-moteur** (libellé officiel sinon VO conservé).

**Bestiaire frenchy INTÉGRÉ (Partie II complète, ch.32-78)** : les créatures vivent dans `src/data/creatures.json`, chacune taguée `source.book='frenchy-bzh'`, curées à la main comme le reste de la base app-owned. Règles d'intégration tenues : détection ancrée sur la **table de caracs** (Niveau 1-4 ET créatures nommées) ; PA÷2 ; Peur/Terreur lues des titres ; `Traits Optionnels`→`optionals[]` ; sorts→`spells[]` ; dédup vs officiel ; nom = en-tête non-label le plus proche (skip statut Cuivre/Argent/Or + footnotes). Résiduel custom (intentionnel) : qq abilities daemon homebrew (`Distraction/Attrayante/Sens de la Magie/Aura de Dhar`).

**EdO traits manquants : VÉRIFIÉ INUTILE** — aucune des 165 créatures ne les référence → item abandonné.

**PARTIE I (Habitants) IMPORTÉE** (user a confirmé « oui ») → scan élargi à **ch.11-78**, **280 créatures** au total. Collisions de rangs (« Sergent/Capitaine/Jeune Recrue » entre groupes) résolues par **qualification du label avec le groupe** quand >1 occurrence (`Sergent (Patrouilleurs Ruraux)`) ; les noms déjà uniques (`Sergent du Guet`, `Apothicaire`) intacts. char 100% parsé, 0 doublon. Résiduel custom inchangé (Redoutable + qq homebrew daemon/undead).

**APPARENCES = AUTRE SESSION** (2026-06-14). Elle édite le MÊME importeur : `appearanceFor(group,name)` (≈l.259, folder→species : Skaven/Homme-bête/Démon/Démonette/Guerrier du Chaos…) + injection trait `Nuée`/gabarit swarm. Défensif (undefined sinon → Humain, OK pour PNJ Part I). J'ai **RETIRÉ ma couche de préservation** d'appearance (elle figeait leur itération). Édits surgicaux hors de leurs régions (scan + dédup/qualif en main). Edit échoue si conflit → sûr.

**Recette navigateur OK** (data chargée dans le bundle : 342 créatures dont 280 frenchy, 0 erreur console).

**Corrections de parsing (2026-06-14, demandées par user)** :
- **BUG majeur** : en-tête `|Compétences Utiles|Compétences Utiles|` (2 cellules) ignoré par le détecteur de section → **69 créatures avaient 0 skill** (tous les démons). Fix `headerName` : table dont TOUTES les cellules matchent `/comp[ée]tences/` → section Compétences. Résultat 69→6 (les 6 = nuées/essaims, légitimes).
- `Distraction` : **trait**→`Perturbant` (alias TRAIT-only, `TRAIT_ALIASES`) MAIS **compétence**→`Divertissement` (intact). Piège : terme ambigu entre catégories → alias par catégorie, jamais global.
- Shaman Orc : table malformée `|shaman 3|Leader|…` → `traitName()` saute le marqueur de palier en cellule 1 → capture `Meneur`/`Intelligent`.
- **Talents renommés par le fan** (mis en « Traits & Talents ») : `Attrayante`=Attractive→`Attirant`, `Blablater`=Blather→`Baratiner`, `Sens de la Magie`=Magical Sense→`Perception de la magie` (`TALENT_ALIASES`, cat=talents) → routés en `talents[]`, PAS traits. (User a flaggé : ce ne sont pas des homebrew.)

**Traits homebrew VRAIS** (sans équivalent WFRP4) : 3 entrées de `src/data/traits.json` — `Aura de Dhar`, `Aura de Mort`, `Charnier` — descriptions sourcées, `source.book='frenchy-bzh'`.

**SORTS tagués frenchy** (user 2026-06-14) : 138 sorts `frenchy-bzh` (full data) dans `src/data/spells.json`, issus des tables `|Sort VF|VO|NI|Portée|Cible|Durée|Effet|`. Résolution des sorts de créatures **15%→87%**. ⚠️ PIÈGE découvert (user surpris « il a inventé des bénédictions ? ») : les **Bénédictions/Miracles OFFICIELS ne sont PAS dans `spells.json`** mais dans les **cultes** (`src/engine/cults/defs`, champ `blessings`/`miracles`) — tout rapprochement avec le fan passe par un `stripDivine` (retirer « Bénédiction de »/l'article, car le fan nomme par l'adjectif nu : `Courage`=`Bénédiction de Courage`). 2e piège : noms longs tronqués (ils s'enroulent sur `<br>` : `Marteau<br>de Justice`) → joindre les segments, ne couper qu'au ref-source (`AotE`/`WoM`/`DSLF`=Deft Steps/`p.N`…). Restant frenchy = surtout miracles de suppléments hors nos livres (DSLF). **`curation-lot8.test.ts` : sorts `frenchy.bzh` EXEMPTÉS de l'invariant « tous curés »** (repli regex assumé). Format canonique `JSON.stringify(_,null,2)` SANS newline final (sinon `serialize.test.ts`).

**OÙ vit la donnée frenchy** (mesuré 2026-07-26) : dans les JSON app-owned communs, chaque entrée portant sa `source.book='frenchy-bzh'` — `src/data/creatures.json` **490 entrées dont 276 frenchy**, `src/data/traits.json` **130 dont 3**, `src/data/spells.json` **576 dont 138**. Un seul dataset par domaine, jamais un fichier frenchy séparé à merger : `src/data/index.ts` exporte directement `creatures`/`traits`/`spells`.

**Reste** : ~31% des sorts (miracles de suppléments hors nos livres) non mappés. Le `Redoutable` du fan (20×, =Menace/Grim) se résout sur le trait officiel `redoutable` de `traits.json` (source MDG 140).

**How to apply :** une entrée frenchy se cure à la MAIN dans le JSON de son domaine (Compendium ou édition directe, cf. `docs/donnees.md`), taguée `source.book='frenchy-bzh'` ; le .md converti sous `Source/Warhammer - Habitants & Créatures  du Vieux-Monde (Discord) PDF/` reste la référence à citer, et les Appendices A-D la table de correspondance.

Liens : [[game-source-fr-campagne-custom]] · [[credo-exemples-calibrants]] · [[game-francais-jamais-anglais]] · [[game-encounter-members-purge]]
