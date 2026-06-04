# Feuille de route — RPG Warhammer Fantasy v4 (web)

Statut au 2026-06-04. La structure **data-driven** (schéma de Scène unique, moteur de
règles pur, base générée depuis les sources) est conçue pour absorber tout ce qui suit
sans refonte. Chaque jalon est livrable indépendamment.

---

## ✅ Jalon 0 — Fondations + tranche jouable (PR1, fait)

- Pipeline de données → base propre `src/data` (LDB + Archives I & II).
- Moteur de règles testé : Tests/DR, Blessures, combat (touche/localisation/dégâts), états.
- Créateur de personnage (aléatoire/manuel) + pré-tirés + groupe de 4.
- Schéma de Scène partagé éditeur ⇄ runtime ⇄ campagne.
- Tome 1 — ouverture (auberge « La Diligence » + embuscade des mutants).
- Éditeur de niveau, coop hotseat, assets procéduraux.

---

## 🎯 Jalon 1 — Profondeur des règles de combat *(prochain)*

Objectif : un combat fidèle au Livre de base, pas seulement « attaquer ».

- Actions complètes : **Charge, Attaque totale, Défense totale, Désengagement**, viser, ramasser.
- **Avantage** complet (gain/perte, effets, réinitialisation à la fuite).
- **Critiques & Maladresses** : tables de Blessures critiques par localisation (LDB p.172+).
- **Distance** : portée réelle, ligne de vue, couvert, rechargement, munitions.
- **Qualités/Défauts d'armes** appliqués (Perçante, Assommante, Défensive, Enroulement…).
- Esquive vs Parade comme choix défensif réel ; armes à deux mains, bouclier.
- États restants pleinement actifs (Empêtré, Aveuglé, En flammes, Empoisonné…).
- Dépense de **Chance / Détermination** en jeu (relancer, ajouter du DR).
- Tests Vitest pour chaque règle ajoutée.

## 🎯 Jalon 2 — Magie & Religion

- **Sorts** en combat : Incantation (Nombre d'Incantation), canalisation, malédiction du Tzeentch.
- **Bénédictions & Miracles** des cultes (Sigmar, Shallya, Ulric…).
- Folie/Corruption liées à la magie ; Vents de Magie.
- UI : grimoire, sélection de cible/zone, animations de sorts (assets procéduraux).
- Données déjà présentes (`spells.json`) — reste l'intégration moteur + UI.

## 🎯 Jalon 3 — Création de personnage complète

- **Compétences/Talents raciaux** (actuellement seulement la carrière) : extraction depuis le
  Livre de base (prose) vers la base de données → 3×+5 et 3×+3, talents fixes + aléatoires.
- Étapes officielles restantes : choix « A ou B », richesse initiale par classe, détails (yeux,
  cheveux, astres), nom (générateurs par espèce).
- **Avancement** : dépense d'XP (caractéristiques/compétences/talents), **changement de carrière**.
- Espèces jouables additionnelles avec leurs particularités.

## 🎯 Jalon 4 — Campagne « L'Ennemi Intérieur » (contenu)

Chaque scène = document au schéma de Scène (donc éditable).

- **Tome 1 — L'Ennemi dans l'Ombre** : 9 chapitres complets (Altdorf, Bögenhafen, la Schaffenfest…).
- **Tome 2 — Mort sur le Reik** : voyage fluvial, château von Wittgenstein.
- **Tome 3 — Le Pouvoir derrière le Trône** : Middenheim, le Carnaval, le traître démasqué.
- Liant de campagne : **transitions entre scènes**, carte de voyage, fil narratif, PNJ récurrents.
- Quêtes, journal structuré, conséquences (flags), récompenses d'XP de fin de chapitre.

## 🎯 Jalon 5 — Méta-jeu & persistance

- **Sauvegarde/chargement** (localStorage + export/import de fichier).
- **Entre deux aventures** : économie, achats/marchandage, fabrication, activités, soins/maladies.
- Gestion du groupe sur la durée (équipement, encombrement, statut social).

## 🎯 Jalon 6 — Éditeur avancé

- Éditeur visuel d'**arbres de dialogue** (actuellement JSON).
- Éditeur visuel de **triggers** et de **combats** (zones, conditions, butin) sans JSON.
- Éditeur de **statblocks** de PNJ/ennemis, bibliothèque réutilisable.
- **Projet multi-scènes** (campagne custom), annuler/refaire, prévisualisation.
- Partage/import de niveaux créés par la communauté.

## 🎯 Jalon 7 — Coop en ligne

- Passage du hotseat au **réseau** : autorité serveur (WebSocket) ou P2P (WebRTC).
- État sérialisable + **RNG seedé déjà en place** → synchronisation déterministe.
- Salons, jusqu'à 4 joueurs, reconnexion, chat.

## 🎯 Jalon 8 — Polish & production

- Assets enrichis (sprites/animations), sons & musique d'ambiance.
- Accessibilité, options, plein écran, mobile/tablette.
- **Découpage du bundle** (Phaser en chunk séparé), perfs.
- CI : lint + tests + build ; hook *SessionStart* pour Claude Code on the web.
- Localisation : interface 100 % français (vérification de couverture).

---

## Dette technique connue (à traiter au fil de l'eau)

- Compétences/talents **raciaux** non appliqués à la création (données en prose, pas dans `all-data.json`).
- Effet `transition` entre scènes encore stub (à brancher au Jalon 4).
- Bundle unique volumineux (~2 Mo) — à code-splitter (Jalon 8).
- IA d'ennemi minimale (approche + attaque) — à enrichir (Jalon 1).
- Couverture de tests à étendre au-delà du cœur de règles.

## Principes directeurs

1. **Rien n'est inventé** : toute règle/contenu provient de `Source/` (LDB + Archives I & II).
2. **Tout est éditable** : le contenu de campagne reste des documents au schéma de Scène.
3. **Le moteur reste pur et testé** ; l'UI (React) et le rendu (Phaser) en dépendent, jamais l'inverse.
4. **Livrer par tranches jouables**, pas de grand chantier monolithique.
