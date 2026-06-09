# HUD de jeu « façon BG3 » — tuiles-portraits, plein-champ, mobile-first (combat ET exploration)

**Date :** 2026-06-09
**Origine :** retour utilisateur sur l'interface actuelle — les blocs « Portrait — 11/11 » (lignes
portrait + nom + PV) sont jugés lourds. Référence visuelle : Baldur's Gate 3 (initiative en haut,
équipe à gauche, barre d'action en bas, rien d'autre).
**Portée :** **remplace la disposition « 3 colonnes » du Lot 1** (`2026-06-08-lot1-lisibilite-combat-hud-design.md`)
et la colonne de gauche de l'exploration : la vue campagne entière passe en plein-champ à overlays.
Les acquis du Lot 1 sur le CHAMP (pions parlants : PV + icônes au-dessus des pions, teinte de case,
halo actif) et la barre d'action du bas restent tels quels.

## Objectif

**But directeur : que le jeu fonctionne sur MOBILE.** Les colonnes fixes de 280/320 px mangeaient
l'écran. La vue campagne devient **plein-champ avec overlays flottants**, en combat comme en
exploration. En combat : **frise d'initiative en haut** (+ fil des derniers événements dessous),
**équipe à gauche**, **barre d'action en bas**. En exploration : **équipe à gauche**, **menu ☰** et
**date** en haut. Conséquences mobiles : **interactions au TAP** (aucune information indispensable
cachée derrière un survol), **cibles tactiles** (~40 px min), overlays compacts et adaptatifs.
Affichage seul — moteur et store de règles intacts. UI 100 % française.

```
COMBAT                                          EXPLORATION
┌─────────────────────────────────────────┐    ┌─────────────────────────────────────────┐
│ ☰    [👤][👹][👤][👹][👤] Round 2 🔍    │    │ ☰                              🌙 32 Jah.│
│       ⚔️ Le Mutant charge Grunni…       │    │ ┌──┐                                    │
│ ┌──┐💫                                  │    │ │👤│                                    │
│ │👤│🩸                                  │    │ └──┘                                    │
│ └──┘                                    │    │ ┌──┐            CHAMP                   │
│ ┌──┐            CHAMP                   │    │ │👤│                                    │
│ │👤│                                    │    │ └──┘                                    │
│ └──┘                              [📜]  │    │                                   [📜]  │
│   [══════ barre d'action ══════]        │    │   (dialogues / marchand inchangés)      │
└─────────────────────────────────────────┘    └─────────────────────────────────────────┘
```

## Décisions validées (dialogue 2026-06-09)

### 1. `PortraitTile` — la brique partagée

Tuile-portrait compacte, remplace les lignes « Portrait — 11/11 » :

- **Portrait** : `RigPortrait` (visage de face, jamais d'initiales), agrandi.
- **Cadre** : couleur passée en prop (équipe ou identité) ; convention daltonisme R9 conservée
  (héros = trait plein, ennemi = tirets). **Actif** : surbrillance or. **KO** : tuile grisée + ✕.
- **Jauge de PV VERTICALE, À L'INTÉRIEUR du portrait** (bord interne gauche de la vignette) :
  hauteur = ratio PB current/max, couleur = `hpColor(ratio)` existant (Lot 0) — **commence vert,
  passe orange, finit rouge en descendant**. Source unique, aucun nouveau code couleur.
- **PV chiffrés DANS le portrait** (bas de la vignette, texte ombré pour lisibilité) — sur le
  dock d'équipe seulement ; la frise d'initiative reste épurée (jauge sans chiffres).
- **États : colonne d'icônes À DROITE du portrait, max 4 visibles**, puis un chevron **« ▾ »** si
  débordement. Réutilise `summarizeEffects`/`combatantFlags` (mêmes icônes que les pions et la
  barre d'action). Le ▾ est un simple indicateur ; le détail complet se lit au TAP sur la tuile
  (fiche perso / inspection) — pas de dépendance au survol (mobile).

### 2. `InitiativeStrip` — la frise d'initiative (haut, centrée, flottante)

- Tuiles dans l'ordre de `battle.order` ; cadre **équipe** (vert allié / rouge ennemi) ; actif
  marqué (or + ▼) ; KO grisé ✕ ; jauge verticale sans chiffres ; états à droite (max 4 + ▾).
- Chip **« Round N »** au bout de la frise + **toggle 🔍** d'inspection (migré de l'ancien titre
  « Ordre de bataille »). Clic sur une tuile = `InspectPanel` (si l'option est activée).
- **Pause de début de Round** (`pendingRoundStart`) : badge **« ⏫ 🍀 »** sous les tuiles des héros
  éligibles (`canActFirst`) — migration du bouton « Agir en premier » ; un chip « ⏳ choisis ton
  initiative » s'affiche près de la frise. Le bouton « ▶️ Commencer le round » reste dans la barre
  du bas (inchangé).

### 3. `PartyDock` — l'équipe (gauche, centrée verticalement, flottante, COMBAT et EXPLORATION)

- Les héros du groupe, une tuile chacun ; en combat, version « vivante » (`battle.combatants`).
- Cadre = **couleur d'identité** du héros (`HERO_RING`, les 4 teintes froides du Lot 0) — cohérent
  avec les anneaux du champ et de la barre d'action. PV chiffrés dans le portrait.
- Clic = ouvre la **fiche perso** (`CharacterSheet`), comme l'actuel panneau Groupe.
- **Remplace le panneau Groupe dans les DEUX modes** (le détail carrière/arme/Avantage/effets se
  lit au tap dans la fiche).

### 4. Fil d'événements — SOUS la frise (CombatBanner conservé, repositionné)

- Le fil des 3 derniers événements (`CombatBanner`, `combatFeed`) est **conservé**, mais déplacé
  **sous la frise d'initiative** (il ne doit jamais chevaucher les portraits). Même rendu
  (icône + noms colorés par camp, le plus récent en tête).

### 5. `LogDrawer` — le journal en tiroir (bas-droite, COMBAT et EXPLORATION)

- Bouton **📜** en bas à droite du champ ; tiroir **replié par défaut** ; état UI-local.
- En combat : `battle.log` (événements structurés) rendu via `narrateEvent` (icône par kind +
  noms colorés par camp). En exploration : le **journal du groupe** (`journal`, lignes texte).
  Un seul composant, deux contenus. Aucune perte de la couche narration.

### 6. `GameMenu` — menu ☰ (haut-gauche, COMBAT et EXPLORATION)

- Bouton **☰** en haut à gauche, **disponible dans les DEUX modes** → tiroir : **nom de la scène**
  (en titre), **Bourse** (`formatMoney`), **Inventaire du groupe** (handouts/butin), **date
  complète** (jour de semaine + Calendrier Impérial), **« Quitter la partie »** (l'actuel retour
  à l'écran de groupe — déjà accessible en plein combat aujourd'hui, parité conservée).
- Le bouton « ← Quitter », la bourse et l'inventaire toujours visibles disparaissent de l'écran.
- En combat, la frise reste centrée : le ☰ occupe le coin haut-gauche sans la chevaucher (sur
  écran étroit, la frise se compacte/décale — cf. calibrations).

### 7. Exploration — date + mêmes tuiles

- **Date** : chip discret en **haut à droite** — icône de phase + date courte (ex. « 🌙 32
  Jahrdrung ») ; exploration seulement (en combat, le haut appartient à la frise ; la date
  complète reste lisible via le menu ☰).
- **Dialogues, marchand, hint de déplacement** : inchangés (déjà des overlays).

### 8. Ce qui disparaît ou migre

- **Colonne gauche** (`hud-left`) : **supprimée dans les DEUX modes** — Quitter/bourse/inventaire
  → menu ☰ ; horloge → chip date ; groupe → PartyDock ; journal → tiroir 📜.
- **Colonne droite** (`BattlePanel`) : supprimée — l'ordre devient la frise, le journal devient le
  tiroir, « Agir en premier » migre sur la frise, le toggle 🔍 aussi.
- **Bannière « 🎮 À toi, X / ⚔️ Tour de l'ennemi »** : supprimée — l'actif est surligné dans la
  frise et la barre du bas affiche déjà l'acteur (ou « Tour de l'ennemi… »).
- **Écran Défaite** (vivait dans BattlePanel) : devient un **overlay centré** sur le champ
  (même contenu : titre + bouton Reprendre).
- **`LegendPanel`** : **SUPPRIMÉE** (composant retiré, fichier supprimé). La convention daltonisme
  (héros = trait plein / ennemi = tirets) reste portée par les anneaux et cadres eux-mêmes.
- **`GroupPanel`** : **SUPPRIMÉ** (remplacé par PartyDock dans les deux modes).

## Architecture (affichage seul)

- **Nouveaux** : `src/ui/PortraitTile.tsx` · `src/ui/InitiativeStrip.tsx` · `src/ui/PartyDock.tsx`
  · `src/ui/LogDrawer.tsx` · `src/ui/GameMenu.tsx`.
- **Modifiés** : `src/ui/CampaignView.tsx` (suppression de la colonne `hud-left` dans les DEUX
  modes ; montage des overlays : PartyDock + LogDrawer + GameMenu + chip date, et en combat
  InitiativeStrip + fil + overlay défaite), `src/ui/CombatBanner.tsx` (repositionné sous la
  frise), `src/ui/styles.css` (dont media queries petits écrans pour les overlays).
- **Supprimés** (suppression franche, pas de shadow) : `src/ui/BattlePanel.tsx`,
  `src/ui/LegendPanel.tsx`, `src/ui/GroupPanel.tsx`. `CharCard` reste (écran de groupe).
  Mettre à jour les commentaires « frise BattlePanel » → « frise d'initiative » dans
  `store.ts`, `combatFlow.ts`, `turnEconomy.ts`, `ActiveModal.tsx`, `ActionBar.tsx`,
  `roll-modal-invariant.test.ts`, `upkeep-reveal.test.ts` (cosmétique).
- **Données** : tout existe déjà — `Combatant` (`wounds`, `conditions`, `activeEffects`, `kind`),
  `battle.order/turn/round/log`, `pendingRoundStart` + `canActFirst`, `inspectEnabled`,
  `journal`, `money` + `formatMoney`, `inventory`, `gameTime` + `toDate`/`dayPhase`/
  `formatImperial`. Aucun nouveau champ de store ; seuls états UI-locaux : tiroir ouvert,
  menu ouvert.

## Tests

- `PortraitTile` : jauge verticale (hauteur = ratio, couleur = `hpColor`), PV chiffrés optionnels,
  ≤ 4 états rendus + « ▾ » au 5ᵉ, croix KO, marqueur actif.
- `InitiativeStrip` : tuiles rendues dans l'ordre `battle.order`, actif marqué, badge ⏫ présent
  pendant la pause si `canActFirst`, clic tuile → `onInspect`.
- `LogDrawer` : replié par défaut, s'ouvre au clic ; contenu combat (narré) vs exploration
  (journal du groupe).
- `GameMenu` : fermé par défaut ; rendu dans les DEUX modes ; ouvert, contient nom de scène,
  bourse formatée, inventaire, date complète, bouton Quitter (retour à l'écran de groupe).
- Suite existante : aucun test ne monte `BattlePanel`/`CombatBanner`/`GroupPanel`/`LegendPanel`
  (vérifié) ; seuls deux commentaires de tests les citent (mise à jour cosmétique).

## Recette navigateur (Playwright)

Scénario 🧪 adapté ; vérifier : frise (ordre, actif, états, KO), fil d'événements SOUS la frise
(aucun chevauchement), dock (jauge, chiffres, clic fiche), pause de début de Round (⏫ sur la
frise), tiroir journal (2 contenus), défaite en overlay, menu ☰ accessible aussi en combat ;
en exploration : menu ☰ (bourse, inventaire, quitter), chip date, dialogue/marchand intacts ;
console 0 erreur.
**Passe mobile** : viewport étroit (~390×844), combat ET exploration — frise + fil + dock + barre
+ menu tiennent sans chevauchement, tout se pilote au tap.

## Hors périmètre

- Fiche express riche au tap long / survol des tuiles (le tap ouvre déjà fiche/inspection).
- Passe responsive COMPLÈTE du reste du jeu (modales de jet, barre d'action, fiche perso, écrans
  de menu/création, éditeur) : ce lot rend le HUD de jeu (combat + exploration) viable sur
  mobile ; le reste = chantiers séparés.
- Tout le reste du diagnostic lisibilité (`2026-06-09-lisibilite-combat-diagnostic.md`) : prévision
  de menace, ciblage, flottants typés, etc. — lots séparés.

## Calibrations ouvertes (non bloquantes — à régler à l'implémentation)

- Tailles exactes des tuiles (dock ~56-64 px, frise ~40-48 px, cibles tactiles ≥ ~40 px) ; icônes
  d'État plus petites sur la frise si besoin.
- Frise sur écran étroit avec beaucoup de combattants : compaction puis défilement horizontal.
- Côté de la jauge interne (bord gauche proposé ; droite si conflit visuel avec la colonne d'états).
- Placement précis du tiroir 📜, du chip date et du menu ☰ vs `ViewControls` (éviter les
  collisions, à caler au navigateur).
