# Feuille de route — RPG Warhammer Fantasy v4 (web)

Statut au 2026-06-04. Architecture **data-driven** : moteur de règles pur + testé,
schéma de Scène unique partagé éditeur ⇄ runtime ⇄ campagne, base générée depuis
les sources. Rendu **isométrique SVG** (React), pas de Phaser. Dépôt : `cgauche/game`.

---

## ✅ Jalon 0 — Fondations + tranche jouable

- Pipeline de données → base propre `src/data` (LDB + Archives I & II).
- Moteur de règles testé : Tests/DR, Blessures, combat (touche/localisation/dégâts), états.
- Créateur de personnage (aléatoire/manuel) + pré-tirés + groupe de 4.
- Schéma de Scène partagé ; Tome 1 ouverture ; coop hotseat.

## ✅ Jalon 0.5 — Rendu, fidélité, moteur de campagne, éditeur *(fait, post-PR1)*

- **Rendu isométrique SVG** (`src/gameIso/`) remplaçant Phaser : tuiles en losanges,
  murs/arbres 3D, sprites SVG, **caméra qui suit**, carte **responsive plein écran**,
  ambiance (lumière+vignette), **dégâts flottants**, idle bob.
- **Audit de fidélité** (workflow multi-agents) → 3 bugs de règles corrigés (table de
  Difficulté canon, départage des Tests opposés, déclenchement de la Blessure critique).
- **Moteur de campagne minimal** (3 briques) : **transitions de scènes** (registre +
  conservation groupe/flags/inventaire/argent), **tests de compétence interactifs**
  (effet `test` → modal → branches), **inventaire + argent + handouts/documents**.
- **Système d'inventaire/équipement par personnage** : objets à stats (depuis
  `trappings.json`), armes/armure actives **dérivées de l'équipement**
  (`recomputeLoadout`), **fiche de personnage** (caractéristiques, PA par localisation,
  encombrement, compétences, talents, équiper/déséquiper).
- **Sprites du bestiaire** : 57/58 créatures générées depuis l'**art officiel** du LDB
  (workflow) → `src/gameIso/creatureSprites.json`. Galerie QC `/sprites-gallery.html`.
- **Éditeur remis à niveau** : rendu **iso WYSIWYG**, **triggers + effets** structurés,
  **dialogues** structurés, **rencontres** structurées, **outil Zone** (dessin de trigger
  à la souris), inspecteur enrichi (aperçu sprite, dialogue en menu, butin), **palette à
  onglets** (Carte / Logique / Scène).
- **Workflow d'extraction de campagne** → `src/scenes/tome1-dossiers.json` (9 chapitres
  Tome 1 : scènes, PNJ, dialogues, rencontres, triggers ; matière première pour les scènes).

---

## 🎯 Jalon 1 — Profondeur des règles de combat *(prochain)*

- Actions complètes : **Charge, Attaque totale, Défense totale, Désengagement**, viser, ramasser.
- **Avantage** complet (gain/perte, effets, réinitialisation à la fuite).
- **Critiques & Maladresses** : tables de Blessures critiques par localisation (LDB p.172+).
- **Distance** : portée réelle, ligne de vue, couvert, rechargement, munitions.
- **Qualités/Défauts d'armes** appliqués (Perçante, Assommante, Défensive, Enroulement…).
- Esquive vs Parade comme choix défensif réel ; armes à deux mains, bouclier.
- États restants pleinement actifs (Empêtré, Aveuglé, En flammes, Empoisonné…).
- Dépense de **Chance / Détermination** en jeu (relancer, ajouter du DR).
- IA d'ennemi enrichie (actuellement : approche + attaque).

## 🎯 Jalon 2 — Magie & Religion

- **Sorts** en combat (Incantation, canalisation), **Bénédictions & Miracles**, Corruption.
- Données déjà présentes (`spells.json`) — reste l'intégration moteur + UI (grimoire, ciblage).

## 🎯 Jalon 3 — Création de personnage complète

- **Compétences/Talents raciaux** (prose LDB → base) ; étapes restantes (choix « A ou B »,
  richesse initiale, détails, noms).
- **Avancement** : dépense d'XP, **changement de carrière**.

## 🎯 Jalon 4 — Campagne « L'Ennemi Intérieur » (contenu)

- **Réécrire le vrai Chapitre 1** (soirée à l'auberge : Gustav, Isolde, Phillipe + partie de
  cartes, inspection de la diligence, Document 1, départ) — **0 combat obligatoire**, social.
- **Chapitre 2** = « Du Sang Sur la Route » (l'embuscade des mutants, séparée du Ch.1).
- Puis Tomes 1-3, en s'appuyant sur `tome1-dossiers.json` et **l'éditeur** (tout est éditable).
- ⚠️ Le `tome1-intro` actuel est une **démo** (walk-to-trigger), pas le vrai Ch.1.

## 🎯 Jalon 5 — Méta-jeu & persistance

- **Sauvegarde/chargement** (localStorage + export/import).
- **Entre deux aventures** : achats/marchandage, fabrication, activités, soins/maladies.
- **Encombrement** appliqué (pénalités ; actuellement seulement affiché).

## 🎯 Jalon 6 — Éditeur avancé *(largement entamé en Jalon 0.5)*

- Reste : placer les ennemis d'une rencontre **sur la carte** ; **undo/redo** ; sélectionner/
  éditer une zone existante en cliquant dessus ; éditeur de statblocks ; **projet multi-scènes**.

## 🎯 Jalon 7 — Coop en ligne

- Du hotseat au **réseau** (WebSocket ou WebRTC). RNG seedé + état sérialisable déjà en place.

## 🎯 Jalon 8 — Polish & production

- **Sprites de carrières** (héros) via workflow (réfs prêtes : `mapping.json` 64/71) ;
  **sprites composables** (l'équipement se voit) ; **animations** marche/attaque/mort.
- Reprise des sprites de bestiaire ratés (galerie QC).
- Sons & musique, accessibilité, **code-splitting**, CI (lint+tests+build).

---

## Dette technique connue

- Compétences/talents **raciaux** non appliqués à la création (données en prose).
- **Sprites** par équipement non reflétés (sprites figés par carrière, pas composables).
- Sprites de bestiaire de **qualité hétérogène** (générés par IA depuis réfs) — à trier via la galerie.
- **Encombrement** affiché mais sans pénalités.
- IA d'ennemi minimale ; pas d'undo/redo dans l'éditeur ; rencontres placées via inputs (pas sur carte).
- Bundle volumineux — à code-splitter.

## Principes directeurs

1. **Rien n'est inventé** : toute règle/contenu vient de `Source/` (LDB + Archives I & II).
   La fidélité se vérifie (cf. workflow d'audit) ; ne pas utiliser tes connaissances.
2. **Tout est éditable** : le contenu de campagne reste des documents au schéma de Scène,
   créables dans l'éditeur.
3. **Le moteur reste pur et testé** (`src/engine`) ; le store, l'UI (React) et le rendu (iso SVG)
   en dépendent, jamais l'inverse.
4. **Livrer par tranches jouables**, vérifier dans le navigateur (Playwright), committer souvent.
5. **UI qui scale** : dès qu'un panneau dépasse ~2 sections → onglets / zones contextuelles.
