# Complétion des apparences (monstres / armes) + nettoyage du sous-système rig

Date : 2026-06-27 · Auteur : session autonome (lead délégué pour la nuit).
Objectif énoncé : « On a ajouté plein de monstres/armes sans travailler leur apparence. »
Bar qualité (consigne user) : zéro code mort / deprecated / rétro-compat / dette / dupe.
Orchestrateur = moi ; des agents codent ; je vérifie TOUT contre le RAW ; ne faire confiance
ni au ticket, ni aux commentaires, ni aux agents, ni au user. Supprimer & refaire si sous-bar
(tests inclus). Workflows seulement si réellement nécessaire (ici : agents ciblés, pas de fan-out).

## Constat vérifié (2 audits + lecture RAW)

Le titre surévalue le gap. Mesures réelles :

### Armes — `src/data/trappings.json` (116 armes)
- 84 ont déjà une silhouette dédiée (`WeaponDef` + 1 synonyme).
- 27 « génériques » sont **hors-contrat** : 12 engins de siège + 12 munitions (jamais tenus) + 3 boucliers (rendus par `shieldPart`, 3 formes).
- **Vrai gap = 5 armes tenues** : Cimeterre, Dague ballock, Pique d'armes (groupe Base, AA), Massue (AA), Griffes de Tigre (Bagarre, NADJ homebrew).
- Garde-fou `src/gameIso/rig/parts/weaponForms.test.ts` **actuellement ROUGE** : `missing = [Cimeterre, Dague ballock, Pique d'armes, Massue, Griffes de Tigre]`. Le test de comptage attend `WEAPON_FORMS.length === 83`.

### Créatures — `src/data/creatures.json` (412)
- 272 ont une def dédiée ; 140 « génériques ».
- Sur ces 140 : **127 humains rendent déjà des silhouettes DISTINCTES** via `appearance.tenue` (38 rôles, 100 % couverts par le catalogue `TENUE_MODELS`). → **rien à faire** (verdict audit : « DÉJÀ BON »).
- **3 monstres mistypés** (pas de `appearance` → repli bipède Humain, FAUX) : Sirène (ZI p94), Choses du Bois Mort (ZI p40), Prédateur sanglant (Middenheim p115).
- **8 nuées** rendues en amas brun identique : `swarm/composeSwarm.ts` **ignore l'espèce** (`_species` jamais lu). Cas le plus criant : « Volée de Noctecorbes » (oiseaux volants) rendue en tas terrestre.

### Bugs de câblage (correctness, creatures.json)
- « Horreur des Profondeurs » (rat, folder Rats Géants) → `horreur-rose` (démon rose). FAUX → `rat-geant`.
- « Horreur du Clan Moulder » (rat-ogre F105) → `horreur-rose`. FAUX → `rat-ogre`.
- « Esclave » + « Esclave Faible » → `skaven` ; def dédiée `esclave-skaven` existe inutilisée → la brancher.
- « Jeune Ungor » + « Ungor Adulte » → `homme-bete` ; def `ungor` existe (le standalone l'utilise déjà) → la brancher.

### Code mort non-ambigu (à retirer)
- `parts/equipment.ts` : `SYNONYMS['sabre']='epee'` mort (écrasé par la boucle WEAPON_FORMS) ; 14 synonymes d'attaque naturelle redondants avec la regex `NATURAL_ATTACK` (garder `crochet`).
- `creatures/defs/Homme-bete.ts` : commentaire périmé « variantes testées AVANT » (ère name-matcher révolue).

## Décisions

1. **Armes (5)** : créer 4 vraies formes (Cimeterre lame courbe, Dague ballock, Pique d'armes hast, Massue masse à tête — distincte du Gourdin, donc PAS une dupe) + Griffes de Tigre (forme griffe/katar pour arme de Bagarre tenue). Retirer les synonymes morts. Mettre le compteur du test à jour (83 → 88). Test vert **par le vrai contenu**, pas en travestissant l'assertion.
2. **3 monstres** : 3 vraies defs (gabarit adapté) + `appearance.species` sur le record. **Pas d'art-ref** (seul `art-ref/ldb/` existe) → viser la **silhouette reconnaissable** d'après la description source (barre `game-bestiary-sprite-bar`), QC par PNG rendu.
3. **8 nuées** : étendre `composeSwarm.ts` pour varier la forme du `critter()` + palette par défaut selon l'espèce/type (rat, araignée 8 pattes, snotling/nurgling humanoïde vert, squig rond, zombie humanoïde, marcassin, **oiseau volant** pour Noctecorbes), puis poser `appearance.species` (+`colors`) sur les 8 records.
4. **Câblage** : corriger les 4 mis-câblages (active au passage `esclave-skaven` + `ungor` → 2 defs « mortes » de moins, SANS suppression).
5. **Mort non-ambigu** : retirer synonyme `sabre` + 14 synonymes redondants (garder `crochet`) ; supprimer le commentaire périmé.

### DÉFÉRÉ (décision user, je NE supprime PAS pendant le sommeil)
- 8 defs « forward-prepared » pour le *Carnaval du Pandémonium* (Compagnon T1 ch.12) inexistant : Urzo, Rassarak, Bête Impériale, Jumeaux, tête-poulet, tête-vache, Khorne, Happeur. = vrai travail d'art pour une scène future → **garder + signaler**.
- `Gnome.ts`/`Elfe-sylvain.ts` (defs nues inertes : rendent à l'identique sans la def), `Crapaud.ts`/`Liche.ts` (référencées par tests unitaires), convergence `Gor.ts`≈`Homme-bete.ts`. → signaler, ne pas trancher seul.

## Plan d'exécution (pipeline SÉRIALISÉ — anti-course)

Invariants anti-course : **seul MOI édite `creatures.json`** (les agents d'art créent leurs fichiers de def + rendent un QC + me renvoient le bloc `appearance` à poser) ; `npm run gen` régénère TOUS les registres → **jamais 2 `gen` concurrents** → agents d'art en série. L'agent armes est indépendant (ne touche ni creatures.json ni les registres créature au-delà d'un gen ponctuel).

- **P0** (moi) : ce spec + bugs de câblage (creatures.json) + commentaire périmé. Commit (chemins explicites uniquement, jamais `git add -A`, jamais `--amend` — arbre partagé avec une autre session).
- **P1** Armes (agent, bg) → je vérifie : `vitest run …/weaponForms` vert + lecture des PNG QC. Commit.
- **P2** Nuées (agent, bg ; `composeSwarm.ts` seul) → je lis les PNG QC, je pose les 8 `appearance` dans creatures.json, je relance les tests. Commit.
- **P3** Monstres (agent, bg ; defs seules) → je lis les PNG QC, je pose les 3 `appearance`, `npm run gen`, golden `-u` APRÈS inspection visuelle. Commit.
- **P4** Vérif globale : `npx vitest run`, `npm run typecheck`, `npm run galleries`. Rapport final + liste des points DÉFÉRÉS pour décision.

## Vérification (preuve avant affirmation)
Chaque phase : runner via Bash (RTK) + lecture des PNG rendus (resvg, zoom ~700px, cf. `docs/creer-une-creature.md`). Aucun « c'est bon » sans sortie verte citée + PNG inspecté. Golden mis à jour seulement après inspection visuelle, jamais pour faire taire un échec.
