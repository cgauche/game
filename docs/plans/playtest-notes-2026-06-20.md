> ⚠️ **ARCHIVE (2026-07-05)** — document DATÉ : constat/plan d'époque, ne décrit PAS l'état courant du code.
> Conservé pour l'historique du raisonnement. Ne JAMAIS s'appuyer dessus pour juger l'architecture ou l'état actuel.

# Playtest — Warhammer v4 RPG (2026-06-20)

> **Méthode** : jeu en boîte noire via le navigateur (Playwright), comme un vrai joueur —
> je clique l'UI, **sans `window.__wfrp` ni hack d'interface**. Notes prises au fil de l'eau
> (journal en annexe), puis relues et organisées (cette synthèse).
>
> **Couverture demandée, toute atteinte** : création de perso bout-en-bout · exploration ·
> ≥1 combat · parler à des PNJ · voyager.
>
> NB : un **bug bloquant** de création (augmentations indépensables) a été rencontré, signalé,
> **corrigé en cours de session par l'utilisateur**, puis le playtest a repris et tout a été couvert.

---

## 1. Verdict

C'est un **vrai jeu**, déjà étonnamment riche et **très fidèle au LDB** (WFRP4). Plusieurs systèmes
sont de qualité « produit » : la **création de personnage** (8 étapes, d100, signes, apparence),
la **résolution de combat** (Test opposé complet et lisible), le **marchand**, et surtout le
**voyage + nuit** (carte du monde, rations, bilan multi-jets) — un des plus aboutis vus aujourd'hui.

Points de friction :
1. **Interaction de combat** : les **portraits d'initiative sont inertes** (cliquables mais sans effet —
   devraient permettre de cibler/attaquer), la **tuile cliquable d'une entité est étroite** (à côté = on
   se déplace au lieu d'attaquer), et **aucun feedback « hors de portée »** quand la cible est trop loin. [§3]
2. **Bugs de flux** : incantation qui n'aboutit pas, allocation de compétences effacée, `[object Object]`. [§2]

| Objectif | État | Comment |
|---|---|---|
| Création de perso bout-en-bout | ✅ | Frederik Volkwass (Reiklander Soldat), étapes 1→8, ajouté au groupe |
| Exploration | ✅ | Arène — La Cour : déplacement, caméra, fouille, triggers |
| Combat (≥1) | ✅ | Initiative, manœuvres, **résolution opposée complète** (Rat géant vs Parade) |
| Parler à des PNJ | ✅ | Armurier (double-clic) → boutique → achat d'un Sabre (Bourse 50→48) |
| Voyager | ✅ | Carte → Weiler→Steinbruck à pied → halte/nuit/bilan → arrivée |

---

## 2. Bugs (par gravité)

### 🛑 B1 — Augmentations de caractéristiques indépensables (étape 3) — *corrigé*
- Aucun contrôle ne permettait de répartir les **5 augmentations** sur les caracs de carrière ;
  « Suivant » restait gaté → **création impossible**. Le seul élément cliquable de la ligne était
  l'**abréviation = lien Codex** (cf. B2). Corrigé : un **+/- par carac** sous « Augmentations gratuites ».

### 🐞 B2 — Ouvrir le Codex depuis le créateur RÉINITIALISE la création (perte de données)
- Cliquer une abréviation de carac (CC/CT/F…) **quittait** le créateur pour le **Compendium** plein
  écran ; au **« ← Retour »**, le créateur **repartait de l'étape 1** avec un perso re-tiré
  (race/carrière/bonus de tirage perdus).
- **Mitigé** par le fix B1 sur l'étape 3 (abréviations plus cliquables là). **À re-vérifier ailleurs**
  dans le créateur (d'autres écrans peuvent encore router un lien Codex vers une navigation plein écran).
- Reco : ouvrir les refs Codex en **popover** (comme `CodexRef` partout dans l'app), ou au minimum
  **préserver le brouillon** au retour.

### 🐞 B3 — Allocation des compétences de carrière effacée par celle des compétences de race (étape 5)
- Répro : (1) « Répartition simple : +5 » → carrière **40/40** ✓ ; (2) « Répartition par défaut »
  (compétences de **race**) → la **carrière retombe à 0/40** ; (3) « Répartition simple » ne re-remplit
  plus (toggle dont le booléen « on » reste désynchronisé des valeurs remises à 0) → on doit **tout
  refaire à la main** (40 clics). Le +/- manuel, lui, fonctionne.
- Cause probable : l'action « compétences de race » réinitialise le sous-état carrière ; le raccourci
  est un toggle non resynchronisé.

### 🐞 B4 — L'incantation ne se résout jamais (combat, sorcier)
- Wilhelmina · **✨ Incanter** → liste de sorts OK (Fléchette/Choc, NI/portée/cible) → clic sort →
  clic cible (passe [active]) → **rien** : pas de modale de jet d'Incantation, pas de dégâts, pas de
  message. Re-cliquer sort↔cible ne fait que **basculer** la sélection ; cliquer la cible sur la carte
  ne lance pas non plus.
- **Aucun feedback** « hors de portée / cible invalide » (si c'est un souci de portée Fléchette = FM
  mètres, rien ne le dit). **Glitch d'état** : à force de (dé)cliquer Incanter, le bouton reste [active]
  mais la liste de sorts disparaît.
- Anomalie nette : le **tir** (Aelindra) et la **mêlée** passent par des modales de jet ; l'incantation, non.

### 🐞 B5 — `[object Object]` visible (étape Carrière)
- « Possessions & Statut » affiche `[object Object], [object Object], … · Statut X` au lieu des noms
  d'objets ; idem dans les **tooltips de l'« Évolution de carrière »**. Sur toutes les carrières testées.
- (Note : à l'étape 6 « Possessions », ces mêmes objets sont rendus correctement avec nom+stats → le
  défaut est localisé au **résumé de l'étape Carrière**.)
- Reco : afficher `trapping.label`/le nom plutôt que sérialiser l'objet.

---

## 3. Frictions UX (pas des bugs, mais ça coince)

### 🔸 Incohérence simple-clic / double-clic
- En **combat**, attaquer un ennemi = **simple clic** (sur sa tuile). En **exploration**, ouvrir un PNJ
  marchand = **double-clic** (le 1ᵉʳ clic, même au pixel près, ne fait que sélectionner). Reco :
  **uniformiser au simple clic** pour interpeller/ouvrir un PNJ.

### 🔧 Les portraits d'initiative sont inertes — devraient permettre d'agir
- Cliquer le portrait d'un ennemi dans la frise ne fait que le **sélectionner** (`[active]`) : aucune
  attaque, et **aucun bouton « Attaquer »** n'apparaît dans la barre, même une fois adjacent. Un portrait
  a l'air cliquable → le joueur l'essaie. **Reco : cliquer un combattant dans la frise = cibler/attaquer
  l'ennemi** (pour l'actif) ou **sélectionner/centrer un allié**, avec **feedback si impossible** (hors
  d'allonge). Bonus : un **chemin de ciblage fiable par boutons** (zéro pixel), comme la carte de voyage.

### 🔸 Tuile cliquable des entités trop étroite
- Pour attaquer, il faut **tomber pile sur la tuile de l'ennemi** ; à côté, on **se déplace** (« Aller (N)
  » / « Courir »). Reco : **hitbox de tuile entière / snap au token le plus proche** du curseur.

### 🔸 Pas de feedback « hors de portée »
- Quand l'ennemi est **trop loin**, survoler ne montre **pas** « hors de portée » : ça affiche un
  **chemin de déplacement** (pour se rapprocher), sans dire que le tir/coup n'est pas possible d'ici.
  Reco : indiquer explicitement le hors-portée / hors-LdV (rejoint l'incantation B4).

### 🔸 « Viser » vs « Tirer » (combat à distance)
- Cliquer un ennemi avec une arme à distance propose **🎯 Viser** = la manœuvre *Aim* (RAW : consomme
  l'Action, +20 au prochain tir). Correct, mais l'enchaînement surprend (« je voulais tirer, ça a
  visé »). Reco : distinguer clairement **Viser** (préparer) de **Tirer** (l'attaque).

### 🔸 Divers (mineur)
- Modale « Recruter » : le bouton **« Choisir »** et le **« Choisir un personnage »** des slots derrière
  se ressemblent ; clic mal ciblé possible (overlay). Cosmétique.

---

## 4. Ce qui est très bon (à garder)

- **Première impression « produit »** : écran-titre soigné, charte cohérente (parchemin/charbon,
  gothique), **0 erreur console**.
- **Créateur de personnage** : 35 races/variantes, 78 carrières en 8 classes, **fiche live** qui
  recalcule tout en temps réel ; **fidélité LDB** exemplaire (d100 race/carrière/signe avec barèmes
  de PX exacts, 3 méthodes de caracs 2d10/réassigner/100 Points, bonus de dizaine B2/B3, spécialisation
  forcée « Musicien (Tambour/Fifre) », possessions de classe+carrière, richesse initiale, identité
  Motivation/Ambitions, apparence + rig live). Garde-fous d'avancement clairs.
- **Résolution de combat** : Test **opposé** complet et **très lisible** — Rat géant (trait **Peur**
  affiché) attaque (CC 25+10=35, 🎲 03 ✓+3, détail +10 Avantage/−10 Peur/+10 Taille) vs **Parade 41
  🎲 04 ✓+4** → **DR net +1** → « rate son attaque ; +1 Avantage ». Réactions **Parade/Esquive/Subir**,
  influence **🔥 Garantie ×2** (Résilience) / **➕ +1 DR** (Détermination). Initiative, **action economy**
  (Action/Mouvement séparés), switch d'arme gratuit 1/tour, **« Finir quand même ? »** (garde-fou),
  **Annuler dépl.**, IA ennemie qui charge : solide.
- **Marchand** : Bourse, onglets Acheter/Vendre/Réparer, catégories (26 mêlée + 31 distance + munitions/
  boucliers/armures), stats d'armes exactes (LDB 62), panier, **Marchander** (Test opposé), achat validé.
- **Voyage + nuit** (le plus abouti) : **carte du monde** parchemin cliquable (UI à boutons = **fiable**,
  contrairement aux tokens iso), **prép RAW** (à pied/diligence, 4 km/h, 6 h/j, rations/nuit, marche
  forcée → Résistance/Exténué), **halte de nuit** (gîte/repas par héros, coût vs Bourse), **bilan
  multi-jets** (contagion vérole, récupération de PB, cauchemars/Calme) → récupération appliquée
  (Erik 6/14→14/14, Greta 9/15→15/15) → **arrivée** à destination. Bel onboarding non-tuto (intros en modale).
- **Scénarios de test** (~26, très bien décrits) : excellente base de QA pour cibler un système.

---

## 5. Recommandations (priorisées)

1. **Rendre l'interaction entité au simple clic** (ou indice fort de double-clic) + **élargir la zone
   de clic des tokens** — c'est le frein n°1 au plaisir de jeu (combat & PNJ). [§3]
2. **Réparer l'incantation** (B4) ou, si c'est la portée, **ajouter le feedback « hors de portée »**.
3. **B3** : ne plus effacer l'allocation des compétences de carrière quand on alloue celles de race ;
   resynchroniser le raccourci « Répartition simple ».
4. **B5** : afficher les noms d'objets (`[object Object]`) au résumé de l'étape Carrière.
5. **B2** : audit complet des liens Codex du créateur → popover, et préserver le brouillon.
6. Vérifier la **fidélité des signes astraux** (ils portent des effets de carac +2/−3 ; le LDB de base
   ne chiffre pas les signes — possible ajout maison à sourcer).

---

## 6. Améliorations proposées (au-delà des bugs)

> Classées par impact ressenti en jouant. Chaque point est **ancré sur une observation** du playtest.
> « (?) » = à vérifier si ce n'est pas déjà partiellement présent.

### A. Interaction & contrôles — *le chantier à plus fort impact*
0. **Rendre les portraits d'initiative actionnables** (aujourd'hui ils ne font que sélectionner).
   Cliquer un combattant dans la frise devrait **cibler/attaquer l'ennemi** (pour l'actif) ou
   **sélectionner/centrer un allié**, avec **feedback si impossible**. Bonus : un chemin de ciblage
   **fiable par boutons** (zéro chasse au pixel), comme la carte de voyage.
1. **Élargir la tuile cliquable de l'entité** (hitbox de tuile entière / snap au token le plus proche).
   Il faut aujourd'hui tomber *pile* sur la tuile de l'ennemi pour attaquer ; à côté = déplacement.
2. **Zone de clic des tokens élargie + snap.** Le sprite iso est petit ; un **hitbox de tile entière**
   ou un **aimant vers le token le plus proche** du curseur supprimerait la « chasse au pixel ».
3. **Surligner les entités interactives.** Un liseré/icone discret (💬 sur un PNJ abordable, ⚔️ sur un
   ennemi à portée) règle d'un coup la **découvrabilité** — on sait *qui* cliquer sans tâtonner.
4. **Menu contextuel (clic droit) sur une entité** : Attaquer / Parler / Examiner (fiche Codex) /
   Cibler — utile quand plusieurs actions sont possibles.
5. **Raccourcis clavier** : `Espace`/`Entrée` = Fin du tour, `Tab` = héros suivant non joué,
   `1-9` = capacités de la barre, `Échap` = annuler/fermer. (Le combat tour-par-tour gagne énormément
   au clavier.)
6. **Aperçu d'attaque avant de committer** : au survol d'une cible valide, tooltip **% de toucher
   estimé + dégâts + réaction adverse probable** (Parade/Esquive de la cible). On voit aujourd'hui les
   modificateurs *après* coup dans la modale ; les montrer *avant* aide la décision tactique.

### B. Lisibilité du combat
7. **Feed de combat persistant** (panneau latéral repliable) plutôt que des notifications fugaces (?) —
   on rate facilement « X rate son attaque ». Le 📜 existe ; le rendre toujours visible en combat.
8. **Overlays de menace** : au survol d'un ennemi, montrer **sa portée de déplacement + d'attaque**
   (zones colorées), pour positionner le groupe en connaissance de cause.
9. **« Viser » vs « Tirer »** : séparer clairement *préparer* (Aim, +20) de *tirer maintenant*, ou
   proposer les deux (« Tirer » / « Viser puis tirer »). L'enchaînement actuel surprend.
10. **Indicateur « à qui le tour » plus fort** + bouton **« centrer sur l'actif »** ; et exposer la
    vitesse de l'IA (le bouton **1×** (?) — un ×2/×4 accélèrerait les tours ennemis nombreux comme mes 6 peaux-vertes).

### C. Création de personnage
11. **« Aventurier express »** : un bouton qui **tire tout en aléatoire** (race→signe→détails) en un
    clic pour produire un perso jouable instantané — idéal découverte, et capitalise sur tes d100.
12. **« Tout répartir automatiquement »** (caracs/compétences) avec une **suggestion par carrière**
    (surligner CC/E/FM pour un Soldat) ; aujourd'hui « Répartition simple » existe mais est piégée (B3)
    et la répartition optimale n'est pas guidée.
13. **Checklist « ce qu'il reste à faire »** sur l'étape courante (ex. « 5 augmentations à placer,
    1 spécialisation à choisir ») — plus parlant que le seul message de pied de page qui gate « Suivant ».
14. **Badges « points restants »** près de chaque pool (Augmentations, Destin/Résilience, Compétences)
    pour voir d'un coup d'œil où il reste à dépenser.

### D. Onboarding (sans tuto envahissant — cohérent avec ta charte)
15. **Coach-marks one-shot** à la 1ʳᵉ scène / 1ᵉʳ combat : 2-3 bulles dismissibles (« double-clic pour
    parler/attaquer », « clic-case pour se déplacer », « glisse pour la caméra »). Réglerait la friction A
    sans casser le « zéro texte tuto ».
16. **Tooltips sur TOUS les boutons de la barre d'action** (Défensive, Incanter, Viser…) — au survol,
    une ligne d'explication. (?)
17. **Écran/overlay « Commandes »** accessible via `?` ou le menu.

### E. Feedback & « juice »
18. **Nombres de dégâts flottants + flash touché/raté/critique** sur les tokens (des FX existent côté
    code — s'assurer qu'ils sont visibles et lus en jeu). Le combat actuel est *juste* mais un peu sec
    visuellement hors modale.
19. **Toujours dire *pourquoi* une action est grisée/refusée** (hors de portée, pas de LdV, pas de PA) —
    rejoint B4 : l'absence de feedback « hors de portée » fait passer un refus pour un bug.

### F. Marchand / équipement
20. **Comparatif vs équipé** dans la boutique : à côté du prix, un **delta** (« +1 Dégâts vs ton arme »,
    « −2 PA »), et **griser ce qu'on ne peut pas s'offrir**. Aujourd'hui on voit les stats brutes mais
    pas le gain réel.
21. **« Équiper »** directement depuis l'achat / la fiche, sans rouvrir l'inventaire.
22. **Filtre/recherche** dans une boutique de 60+ lignes.

### G. Voyage (déjà excellent — finitions)
23. **« Refaire la même nuit »** sur les longs trajets (Eichenfeld 96 km = 3 nuits) : mémoriser les
    choix gîte/repas pour ne pas re-cliquer chaque nuit ; bilan groupé.
24. **Aperçu de route** : icône météo + **indice de risque** (« route peu sûre ») + **état des
    provisions/blessés** affichés *avant* de partir, pas seulement dans le résumé.

### H. Méta / QoL
25. **Auto-save + slots nommés** (le Sauvegarder/Charger existe en voyage (?) — le généraliser et
    auto-sauver aux transitions de scène).
26. **Écran Options complet** : volumes (déjà là), **remap clavier**, taille du texte, **reduce-motion**,
    vitesse de l'IA.
27. **Tactile/mobile** (ta charte vise 360px) : le **double-clic est pire au doigt** ; prévoir un
    **appui simple = action** + appui long = menu contextuel, et des cibles ≥44px. Priorité haute si le
    mobile est un objectif.

---

## Annexe — Journal chronologique (notes à chaud)

### Écran-titre
- Titre « Warhammer Fantasy », sous-titre « Jeu de Rôle — 4ᵉ édition · Tactique au tour par tour ». Charte cohérente, belle première impression. Menu : ⚔️ Nouvelle partie, 📂 Charger, 🌐 Jouer en ligne, 📜 Règles maison, 📖 Compendium ; Atelier : 🏗️ Éditeur, 🧪 Scénarios de test, 🎨 Galeries. Licence en bas, 0 erreur console.

### Groupe (0/4)
- 4 slots, chacun **Créer un personnage** / **Choisir un personnage**. Sélecteur de scène « 📜 L'Arène » + **Changer**. « Commencer → » gaté. Clair.

### Créateur — étape 1 « Race »
- Barre d'étapes (1→8). Rail gauche = races par famille (Humains/Halflings/Nains/Hauts elfes/Elfes sylvains/Ogres) + sous-variantes. Panneau : portrait rig, lore, onglets, **🎲 Tirer la race (d100) +20 PX**, caracs de base, compétences/talents de race. Rail droit = **fiche live** (caracs, Blessures, Destin/Chance, Résilience/Déterm., Bourse, **PX bonus**). ✅ Tirage d100 → Reiklander, +20 PX appliqués.

### Créateur — étape 2 « Carrière »
- **78 carrières** en 8 classes, case « Ignorer les restrictions de race », icônes + statut. Barème de tirage clair. Panneau : lore, **Évolution de carrière** (4 niveaux), caracs de carrière, compétences/talents du Niveau 1, Possessions & Statut.
- 🐞 **B5** : « Possessions & Statut » = `[object Object], …` (+ tooltips d'évolution). Sur toutes carrières.
- Carrière → **Soldat (Recrue)** (caracs CC/E/FM, Corps à corps/Esquive/Résistance…, talents Guerrier né/Infatigable…). PX recalculé.

### Créateur — étape 3 « Caractéristiques »
- 3 méthodes (2d10 +50 / Réassigner +25 / 100 Points +0), Relancer. Sidebar : Augmentations 0/5, Destin & Résilience 0/3. « Suivant » gaté.
- 🛑 **B1 (initial)** : impossible de dépenser les 5 augmentations (pas de +/-, clic carac inopérant, abréviation = lien Codex → **B2** réinitialise la création). Bloqué ; signalé.
- ✅ **Après fix** : +/- par carac de carrière (CC+2/E+2/FM+1 → 5/5), abréviations plus cliquables ici ; Destin+2/Résilience+1 → 3/3 ; « Suivant » actif.

### Créateur — étape 4 « Signe astral »
- d100 (23 signes, +25 PX). Rollé **Le Trait du Peintre** : **+2 CT / +2 Ag / −3 CC**, dates, dieu. Astrologie (facultatif) = roleplay. 🔸 Les signes portent des effets de carac (à sourcer vs LDB).

### Créateur — étape 5 « Compétences & Talents »
- 40 augmentations de carrière (max 10) + raccourci « Répartition simple » ; compétences de race (3×+5/3×+3 + « Répartition par défaut ») ; talent de carrière (radio) ; talents de race (Perspicace/Affable + tirés). Tooltips = vraie description LDB.
- 🐞 **B3** : « Répartition par défaut » (race) **efface** la carrière (40→0) et le raccourci se désynchronise → 40 compétences refaites **à la main**. Puis spécialisation forcée « Musicien (Tambour/Fifre) » (bon garde-fou) → Tambour.

### Créateur — étapes 6-8
- **6 Possessions** : équipement de classe (Arme simple +BF+4, Dague, Vêtements, Bourse) + carrière (Dague, Plastron de cuir 2 PA, Uniforme), rendus **proprement** (≠ B5). Richesse initiale RAW.
- **7 Détails** : Nom (🎲 « Frederik Volkwass »), Motivation, Ambitions court/long (+50/+500 PX), apparence (sexe/coiffure/morphologie/visage/couleurs) + rig live.
- **8 Récapitulatif** → **⚔️ Créer l'aventurier** → ajouté au groupe (1/4). ✅ **Création bout-en-bout atteinte.**

### Groupe & lancement
- Slots remplis via **Choisir → Pré-tirés** (8 dispo). Groupe 4/4 : Frederik (Soldat), Sigmund Reikhardt, Wilhelmina Faust (Sorcier), Aelindra Feuille-d'Argent (Elfe sylvain Chasseur). **Commencer →**.

### Exploration — « Arène — La Cour »
- Vue **iso** propre, HUD (portraits + PB, menu, journal, caméra rotation/zoom/grille). Intro en **modale skippable**. Déplacement au clic-case, fouille du râtelier, **trigger** d'embuscade en avançant. Caméra qui suit.

### Combat — « Arène — La Cour »
- Initiative (frise gauche) mêlant héros + ennemis (**1 Rat géant, 2 Gobelins, 3 Snotlings**). Barre d'action (Action/Avantage/Mouvement), switch d'arme gratuit, portée verte.
- **T1 Aelindra (fronde)** : switch arme OK ; clic ennemi → **🎯 Viser** (= Aim RAW, consomme l'action, +20 prochain tir). 🔸 confusion Viser/Tirer.
- **T2 Wilhelmina (sorcier)** : ✨ Incanter → liste Petits Sorts (Fléchette/Choc) → 🐞 **B4** l'incantation **n'aboutit pas** (pas de modale de jet, pas de feedback de portée, glitch d'état).
- **T3-4 Frederik (mêlée)** : 🔸 **visée pixel** des tokens difficile (clics → déplacement / **🏃 Course** = vraie modale de jet Athlétisme+20). Clic frise = sélection seule.
- **Résolution (via IA ennemie)** : Rat géant attaque Frederik → **modale Défense** complète (Peur affichée ; attaque 35 🎲 03 ✓+3 avec modificateurs ; **Parade 41 🎲 04 ✓+4** → DR net +1 → « rate ; +1 Avantage ») ; Garantie ×2 / +1 DR ; Appliquer. ✅ **Cœur du combat solide et lisible.**

### PNJ — Armurier (scénario « 🛒 Marchand »)
- Approche → **trigger « Découverte »** (+50 CO, modale). 🔑 **FINDING** : interaction = **double-clic** (simple clic = sélection). Double-clic → boutique : Acheter/Vendre/Réparer, 26+31 armes (stats LDB exactes), panier, Marchander. ✅ Achat Sabre (Bourse 50→48).

### Voyage (scénario « 🧭 Voyage & Nourriture »)
- Weiler + Erik (6/14, cauchemars) & Greta (9/15, Vérole). **🗺️ Carte** parchemin cliquable (fiable) : Federholz 24 / Steinbruck 30 🚌 / Eichenfeld 96. **Prép RAW** (à pied/diligence, 4 km/h, 6 h/j, rations/nuit, marche forcée). **Halte de nuit** (gîte/repas par héros, coût). **Bilan multi-jets** (contagion ✓, récup PB, Calme/cauchemars ✓) → Erik 14/14, Greta 15/15. **Arrivée Steinbruck**. ✅ **Système le plus abouti.**

### Captures
`playtest-01-menu` (titre) · `-02-creator-race` · `-03-career` + `-03b-possessions-bug` (B5) · `-04`/`-05` (blocage B1) · `-06`→`-09` (création réussie après fix) · `-10`→`-14` (entrée/exploration/combat) · `-15`→`-19` (Viser/incantation) · `-20`→`-31` (mêlée/visée/résolution Défense) · `-35`→`-47` (marchand, double-clic) · `-48`→`-54` (voyage/nuit/bilan/arrivée).
