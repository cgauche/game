# Lot 1 — Lisibilité du champ de bataille & HUD de combat

**Date :** 2026-06-08
**Origine :** retours de playtest (un joueur) sur le combat. Tri en lots :

- **Lot 0** (livré, commit `4a2d749`) : barre de vie rouge si blessée, anneaux alliés non-confondables avec le rouge ennemi, bonne arme dans la modale.
- **Lot 1** (ce document) : lisibilité du champ + refonte du HUD de combat.
- **Lot 2** (à venir) : flux de tour & bug KO (« 38 tours à vide »), déplacement après attaque, fin de tour auto, scène d'ouverture « Vous êtes attaqué », zones de déplacement vert/orange.
- **Lot 3** (à venir) : modales de jet (résumé d'attaque, infos sorts, animation de dé, Résilience avant le jet).

## Problème (verbatim playtest)

« Je suis complètement perdu / je m'y retrouve pas » : on ne voit pas qui est allié/ennemi/actif, ni qui on cible, ni qui est blessé (« jeu du petit pois avec trois gobelets » quand un blessé bouge), les états sont peu visibles, l'initiative n'est vue qu'une fois, les tours ennemis sont illisibles, et un tireur lointain « centré sur lui » ne révèle pas sa cible. Les buffs (bénédictions) ne sont pas affichés. Un allié avait « un rond rouge ».

## Objectif

Rendre l'état du combat **lisible d'un coup d'œil** sans alourdir, en gardant le **moteur pur intact** (affichage seulement). UI 100 % française.

## Décisions de design (maquettes validées via compagnon visuel — réf. `combat-redesign-v3`)

### Disposition générale (3 colonnes, centre dégagé)
- **GAUCHE** — « À toi de jouer » : **rappel du perso actif** + **actions**. (Pas de colonne « Groupe » séparée — supprimée car elle doublonnait avec l'ordre de bataille.)
- **CENTRE** — le **champ uniquement**, aucun panneau dessus (lisibilité max). Les actions ne sont **pas** au centre.
- **DROITE** — **ordre de bataille unifié** (tout le monde) + **journal de combat**.

### Champ de bataille — « pions parlants »
1. **Identification équipe/actif (choix C)** : la **case** (tuile) sous le pion est teintée par équipe — **allié = vert**, **ennemi = rouge**, **actif = jaune** (translucide) ; **voile léger « à peine visible »** sur le modèle (même teinte, opacité basse) ; **halo doux jaune** sur l'unité active. La **couleur d'identité par héros** (4 teintes froides du Lot 0 : bleu/vert/cyan/indigo) reste comme **indice secondaire** (anneau/bordure de portrait). Intensité plafonnée pour ne pas salir les couleurs dessinées (à calibrer).
2. **Mini-barre de PV au-dessus de la tête** de **chaque** combattant (couleur `hpColor`, Lot 0 : rouge/orange/vert).
3. **Icônes d'états/buffs au-dessus** de la barre (max ~3 visibles + **« +N »** en débordement). Malus vs buffs distingués. L'info **suit le pion** quand il bouge → fin du « bonneteau ».
4. **Survol (hover)** de n'importe quel pion → **fiche express** (nom + PB cur/max + Avantage + états + équipe). Marche en mêlée et en jeu normal (pas seulement en visée à distance).

### Colonne GAUCHE
- **Panneau Perso (héros actif)** : portrait (vignette du rig, anneau = couleur d'identité), nom + carrière, **PB** en barre colorée **+ chiffres** + **Avantage**, **états combinés** (icônes visibles **+ « +N »**), **buffs** en chips verts **avec durée** (`roundsLeft`), **ressources** (🍀 Chance / 🔥 Résilience / ✊ Détermination / ✨ Destin), badge **Focalisé ×N**.
- **Actions** (libellés **en toutes lettres**, liste verticale) : **Attaquer · Déplacer · Incantation · Défense · Spécial · Fin du tour**. « Spécial » regroupe les actions rares (Charge, Course, objets, Se relever…). Indicateur **Action ● / Mouvement ●** restants.

### Colonne DROITE
- **Bannière de tour** : « 🎮 À toi, X » / « ⚔️ Tour de l'ennemi — X ».
- **Ordre de bataille** = **liste unique** de **tous** les combattants (alliés + ennemis), ordre = Initiative décroissante. Chaque ligne : **portrait** + nom + **PV chiffrés** (ex. « 4/13 ») + mini-barre + **un état important** (💫 Sonné, 🔻 KO, 🩸…). Bordure équipe (vert/rouge), **actif surligné jaune**, **KO grisé**. Remplace l'« init-track » texte actuel (et la colonne Groupe).
- **Journal de combat** lisible : marqueur de Round, actions ennemies en clair (« Le Mutant charge… », « tire sur… »), dégâts, « Tour de X ».

### Tir/sort à distance (choix A)
Quand un tir, un sort à distance ou une charge part de **loin** : la caméra **cadre les deux** (tireur + cible), on trace une **ligne de tir** pointillée tireur→cible, un **réticule** sur la cible, et le journal annonce « **X tire sur Y** ». Vaut aussi pour **les tirs du joueur** (ligne de visée avant de tirer).

### Portraits
Partout (Perso, ordre, fiche express) = **vignettes du rig** (buste du héros / tête de la créature), **jamais d'initiales**.

## Architecture (affichage seul — aucune règle modifiée)

Le moteur pur (`src/engine`) n'est **pas** touché. Tout vit dans le rendu (`src/gameIso`) et l'UI (`src/ui`). Les données nécessaires existent déjà sur `Combatant` : `wounds {current,max}`, `advantage`, `conditions[]`, `activeEffects[]` (buffs Bénédiction/Sort, **déjà** appliqués/décrémentés/testés — il suffit de les **afficher**), `fate/fortune/resilience/resolve`, `kind`.

### Fichiers / symboles concernés
- `src/gameIso/teamColors.ts` (Lot 0) — **étendre** : teintes sémantiques d'équipe (allié vert / ennemi rouge / actif jaune) pour case+voile+halo ; `hpColor` déjà présent ; source unique.
- `src/gameIso/BodyToken.tsx` — ajouter, au-dessus de la tête : **barre de PV** + **rangée d'icônes d'états** (débordement) ; **teinte/voile** d'équipe sur le modèle + **halo** actif. Nouvelles props (`team`, `active`, `wounds`, `effects`).
- `src/gameIso/IsoStage.tsx` — calculer `team`/`active` (depuis `c.kind` + `battle.order[turn]`) ; passer wounds/conditions/activeEffects à `BodyToken` ; **teinter la case** sous le pion (en plus de l'anneau d'identité) ; **généraliser le hover** (`onPointerMove`, aujourd'hui limité à la visée) → résoudre n'importe quel pion → fiche express ; **overlay de visée** (ligne + réticule) + **caméra cadre-les-deux** pour un tir lointain.
- `src/ui/CampaignView.tsx` — **re-layout** combat : GAUCHE (Perso + Actions) / CENTRE (`IsoStage`) / DROITE (Ordre + Journal). Retirer la colonne « Groupe » (`PartyHudCard`) en combat.
- `src/ui/ActionBar.tsx` — refonte en **colonne d'actions** à libellés complets (catégories ; « Spécial » regroupe le rare).
- `src/ui/BattlePanel.tsx` — l'`initiative-track` texte devient l'**OrderList** (portraits + PV chiffrés + état clé) ; le `battle.log` devient le **CombatLog** lisible + bannière de tour.

### Composants (isolés, testables)
- `EffectIcons` (partagé) — entrée : `conditions[]` + `activeEffects[]` + `maxVisible` ; sortie : chips d'icônes (compteur d'empilement, durée pour les buffs, style malus/buff, débordement « +N »). Utilisé par BodyToken (pion), PersoPanel, OrderList, fiche express.
- `summarizeEffects(conditions, activeEffects, maxVisible)` — **helper pur** : tri par importance, sépare buffs/malus, calcule `{visible, moreCount}`. **Testé**.
- `conditionMeta` — table `nom → { icône, sévérité, important? }` (l'« état important » de l'ordre de bataille). Dérivée du modèle `conditions.ts`.
- `RigPortrait` — vignette du rig (buste) cadrée, anneau = couleur d'identité ; fallback si rendu indispo.
- `TokenTooltip` — fiche express au survol.
- `OrderList` — liste unifiée d'initiative (remplace init-track).
- `PersoPanel` — héros actif.
- `ActionColumn` — actions verticales.
- `CombatLog` — journal + bannière de tour.
- `RangedTargeting` (overlay IsoStage) — ligne + réticule ; + logique caméra cadre-les-deux.

## Tests
- `summarizeEffects` : tri/importance, séparation buff/malus, débordement « +N », durée.
- `conditionMeta` : chaque État du modèle a une icône + sévérité ; les « importants » couvrent au moins Sonné/À Terre(KO)/Aveuglé/Hémorragie.
- `hpColor` (déjà testé, Lot 0).
- Sélecteurs `teamOf(c)` / `isActive(c, battle)`.
- `frameBounds(shooter, target)` (caméra cadre-les-deux) — pur.
- Smoke render : `BodyToken` avec PV+icônes, `OrderList`, `PersoPanel`, `RigPortrait`.

## Découpage en tranches (chaque tranche est jouable/« testable » en jeu)
1. **Champ lisible** (le plus visible, réutilise `teamColors`) : case teintée (choix C) + voile + halo, **PV + icônes au-dessus des pions** (`BodyToken`), `EffectIcons`/`summarizeEffects`/`conditionMeta`, **survol** (`TokenTooltip`). → vérifiable immédiatement en combat.
2. **Colonnes HUD** : `PersoPanel` + `ActionColumn` (gauche) ; `OrderList` (droite, unifié, **PV chiffrés** + état clé) + `CombatLog` + **bannière de tour** ; `RigPortrait` ; re-layout `CampaignView` ; **retrait de la colonne Groupe**. Les **buffs** (`activeEffects`) apparaissent ici aussi.
3. **Tir lointain** : overlay ligne + réticule, **caméra cadre-les-deux**, ligne de journal « X tire sur Y » (vaut aussi pour les tirs joueur).

## Hors périmètre (autres lots)
- Auto-fin-de-tour, bug KO « 38 tours », déplacement après attaque, ouverture de combat, zones de déplacement vert/orange → **Lot 2**.
- Animation de dé, résumé d'attaque, infos sorts, Résilience avant le jet → **Lot 3**.

## Calibrations ouvertes (non bloquantes — à régler à l'implémentation)
- Opacité plafond du voile/teinte d'équipe (« à peine visible »).
- Barre de PV : toujours affichée vs seulement si entamé (proposé : toujours, discrète ; icônes seulement si présentes).
- Jeu d'icônes : emojis (rapide) vs glyphes dessinés (cohérence visuelle) — démarrer en emojis, raffiner si besoin.
- Côté des colonnes (gauche/droite) — réglage cosmétique.
