# Warhammer Fantasy v4 — RPG tactique au tour par tour (web)

Jeu de rôle vidéoludique **100 % web, en français**, type *Neverwinter Nights*, basé sur les
règles de **Warhammer Fantasy Roleplay 4ᵉ édition**. On contrôle un groupe de 4 aventuriers
(créés un par un ou pré-tirés) à travers la campagne impériale **L'Ennemi Intérieur**.

> Toutes les règles et le contenu proviennent des fichiers sources (`Source/`). La base de
> jeu (`src/data/*.json`) est **générée** depuis ces sources — limitée au Livre de base et aux
> Archives de l'Empire I & II — et n'est jamais le fichier source brut.

## Fonctionnalités (PR1 — fondations + tranche jouable)

- **Moteur de règles WFRP4** (`src/engine`) : Tests & Degrés de Réussite, Caractéristiques,
  Blessures, combat (touche/localisation/dégâts), états, création de personnage. Testé avec Vitest.
- **Créateur de personnage** : aléatoire complet ou manuel, espèces et carrières du Livre de base.
- **Groupe de 4** : créés ou choisis parmi des pré-tirés.
- **Mode campagne** : ouverture du Tome 1 (*L'Ennemi dans l'Ombre*) — l'auberge « La Diligence »
  et l'embuscade des mutants, en combat tactique sur grille.
- **Éditeur de niveau** : peinture de tuiles, placement d'entités, dialogues/triggers/combats.
  La scène de campagne est un document au même format → **entièrement ré-éditable dans l'éditeur**.
- **Coop hotseat** : les héros jouent tour à tour, le joueur actif est mis en avant.
- **Assets procéduraux** : tokens, tuiles et animations générés au runtime (Phaser).

## Pile technique

- **Phaser 3** — moteur de jeu (rendu de la grille, animations, caméra, input).
- **React + TypeScript** — interface (menus, créateur, fiches, dialogues, HUD, éditeur).
- **Zustand** — état partagé reliant React et Phaser.
- **Vite** — bundler · **Vitest** — tests du moteur de règles.

## Démarrage

```bash
npm install
npm run build:data   # (re)génère src/data/*.json depuis Source/all-data.json
npm run dev          # serveur de développement
```

Autres scripts : `npm test` (tests du moteur), `npm run build` (build de production),
`npm run typecheck`.

## Architecture

```
scripts/build-data.ts   Pipeline : Source/ -> src/data (filtré LDB/ADE1/ADE2)
src/engine/             Règles WFRP4 (pur TS, testé)
src/data/               Notre base générée (ne pas éditer à la main)
src/state/              Schéma de Scène, store Zustand, pathfinding, bus
src/game/               Scène Phaser (exploration + combat tactique)
src/ui/                 Interface React (menus, créateur, HUD, éditeur)
src/scenes/             Documents de scène de campagne (Tome 1)
```

Le **schéma de Scène** (`src/state/scene.ts`) est l'unique contrat partagé par l'éditeur, le
runtime et la campagne : aucune scène n'est codée « en dur ».

## Périmètre & suite

PR1 pose les fondations et une tranche jouable. Les itérations suivantes ajouteront les Tomes
1-3 complets, la coop en ligne, la magie/les prières en combat, l'économie entre aventures et un
bestiaire étendu — la structure data-driven est prévue pour les accueillir sans refonte.
