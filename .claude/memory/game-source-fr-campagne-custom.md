---
name: game-source-fr-campagne-custom
description: "Game/Source/ contient aussi les livres de campagne FR (au-delà du Livre de base + Archives) ; ALLOWED/DENY_CLASS filtrent la génération ; les créatures d'aventure hors bestiaire vont en CustomStatblock."
metadata: 
  node_type: memory
  type: project
  originSessionId: 5b5e1576-6e66-4371-b038-61f34984d882
---

`Game/Source/` ne contient pas que le Livre de base + Archives de l'Empire : aussi les **livres de campagne en français** (`Warhammer v4 - 1.0 L'ennemi dans l'Ombre` + Compagnon, `2.0 Mort sur le Reik` + Compagnon extrait 19 chapitres, Boîte d'Initiation, etc.). **La liste des livres à périmètre documenté vit au `CLAUDE.md` § Sources VF + `docs/sources-vf.md` — c'est là qu'on la lit, jamais ici : elle grandit** (à ce jour LDB, ADE I/II, EDO/EDOC, Middenheim, AA, ZI, MDG, ACE, T2C, NADAJ, VDM).

**ARBITRAGE USER 2026-07-10 (verbatim) : « Tous les livres contiennent des règles. Parfois c'est plus 90% scénario, mais souvent il y a quelques règles. »** — la dichotomie livre-de-règles/livre-de-contenu tombe au niveau LIVRE : le périmètre s'établit par PASSAGE, documenté dans `docs/sources-vf.md`, au MÊME standard que partout (verbatim citable, réf chap/ligne, extraction FR dans `Source/` requise — un livre sans extraction ne peut pas fournir de mécanique vérifiable). Premier cas : 8 traits navals de personnalisation sourcés `mort-sur-le-reik-compagnon` (#277, vérification verbatim lancée).

**Autorisation user 2026-07-10** : « Si la source .md est mal formatée, vous pouvez corriger le formatage du fichier » — un `.md` de `Source/` défectueux (coupe au saut de page Marker, artefact d'extraction) se RÉPARE par restauration fidèle depuis le PDF (outil Read pages) ; jamais d'invention ni de réécriture du contenu.

**`src/data/*.json` est la source unique app-owned, éditée DIRECTEMENT** (Compendium, cf. [[game-data-driven-architecture]]) : **RIEN ne la régénère.** Aucun script npm de re-seed depuis une extraction brute — c'est exactement ce que faisait `build:data`, qui écrasait les données curées à chaque passage. Ne jamais en recâbler un : une extraction alimente une curation À LA MAIN, pas un générateur.

**Livres intégrés hors pipeline `all-data`** (extraction CURÉE à la main directement dans `src/data/*.json`, taguée `source.book`, jamais via re-seed) : **AA** (Aux Armes) — 15 carrières+60 niveaux, 9 miracles Myrmidia, talent Commandant d'équipe, 6 qualités (Salve/Arme d'équipe/Déstabilisante/Taillade/Tir de zone/Déséquilibrée, toutes câblées moteur), trait Dressé (Cavalerie de choc), 2 montures, 51 armes/munitions/armes de siège — **intégralement modélisé** (artillerie câblée : `crewedTeam`/`salvo`/`areaFire` ; Déstabilisante = choix héros via modale ; Salve = multi-tir/Round à malus cumulatif ; Infecté = exposition post-combat interprétée fidèlement, qualité non définie par le livre gardée verbatim). **ZI** (Zoo Impérial) — trait Redoutable. **MDG** (Mer des Griffes) et **ACE** (Altdorf, Annexe I seule) — extraction curée, même principe.

**Anciennes décisions `ALLOWED`/`DENY_CLASS`** (historique, désormais figées) : `ALLOWED` élargi de `{LDB,ADE1,ADE2}` à `{LDB,ADE1,ADE2,EDO,Middenheim,EDOC}` (`species` n'est jamais filtré → les 3 origines humaines Middenheim étaient déjà incluses). **`DENY_CLASS={Chaos}`** retire la classe « Chaos » et ses carrières (contenu ennemi hors création joueur) — les SORTS de Tzeentch restent inclus (le grimoire les verrouille par Talent requis).

**Les créatures spécifiques à une aventure hors livres inclus** (ex. Knud Cratinx, Rolf Hurtsis, Brigands Mutants — MSR/EDO ch.2 sans statbloc générique) se montent toujours en **`CustomStatblock`** (éditeur de spawn → « Profil personnalisé »), jamais dans `creatures.json`.

**Modèle de créature bandit/mutant** (vérifié `02 - Chapitre 2 - Erreur sur la personne.md`) : profil de **base** + **Mutation (variable)** à personnaliser ; l'**arme est dans un Trait** avec le TYPE entre parenthèses (« Arme (Épée) +7 », « À distance (Arbalète) +9 (60) », « Morsure +9 ») ; l'apparence (mutation) est séparable des stats. Voir [[game-francais-jamais-anglais]]. **`weaponsFromTraits` (`engine/creatureEquip.ts`) parse déjà ces formes typées** (Arme/À distance/Morsure/Cornes/Tentacules… avec ou sans type entre parenthèses) — gap comblé, plus une dette.

Exemples de référence (Knud Cratinx, Terenz/Mikael/Johann/Erik, Rolf Hurtsis) : profils complets dans l'historique de commit si besoin de re-dériver un statbloc similaire.
