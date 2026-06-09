# HUD de combat « façon BG3 » — frise d'initiative + dock d'équipe en tuiles-portraits

**Date :** 2026-06-09
**Origine :** retour utilisateur sur l'interface actuelle — les blocs « Portrait — 11/11 » (lignes
portrait + nom + PV) sont jugés lourds. Référence visuelle : Baldur's Gate 3 (initiative en haut,
équipe à gauche, barre d'action en bas, rien d'autre).
**Portée :** **remplace la disposition « 3 colonnes » du Lot 1** (`2026-06-08-lot1-lisibilite-combat-hud-design.md`)
**en combat uniquement**. Les acquis du Lot 1 sur le CHAMP (pions parlants : PV + icônes au-dessus
des pions, teinte de case, halo actif) et la barre d'action du bas restent tels quels.

## Objectif

En combat, ne garder à l'écran que trois éléments : **la frise d'initiative en haut**, **l'équipe à
gauche**, **la barre d'action en bas**. Tout le reste disparaît ou se replie ; le champ prend toute
la largeur (les deux colonnes fixes de 280/320 px sont retirées, tout flotte par-dessus le champ).
Affichage seul — moteur et store de règles intacts. UI 100 % française. Hors combat : rien ne change.

```
┌─────────────────────────────────────────────┐
│        [👤][👹][👤][👹][👤] Round 2 🔍      │ ← InitiativeStrip (haut, centré)
│ ┌──┐💫                                      │
│ │👤│🩸                                      │
│ └──┘                                        │
│ ┌──┐               CHAMP                    │ ← PartyDock (gauche, centré vertical)
│ │👤│                                        │
│ └──┘                                  [📜]  │ ← CombatLogDrawer (replié par défaut)
│ ❓ [═══════ barre d'action ═══════]         │ ← ActionBar inchangée + Légende repliable
└─────────────────────────────────────────────┘
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
  débordement (title natif = liste complète). Réutilise `summarizeEffects`/`combatantFlags`
  (mêmes icônes que les pions et la barre d'action).

### 2. `InitiativeStrip` — la frise d'initiative (haut, centrée, flottante)

- Tuiles dans l'ordre de `battle.order` ; cadre **équipe** (vert allié / rouge ennemi) ; actif
  marqué (or + ▼) ; KO grisé ✕ ; jauge verticale sans chiffres ; états à droite (max 4 + ▾).
- Chip **« Round N »** au bout de la frise + **toggle 🔍** d'inspection (migré de l'ancien titre
  « Ordre de bataille »). Clic sur une tuile = `InspectPanel` (si l'option est activée).
- **Pause de début de Round** (`pendingRoundStart`) : badge **« ⏫ 🍀 »** sous les tuiles des héros
  éligibles (`canActFirst`) — migration du bouton « Agir en premier » ; un chip « ⏳ choisis ton
  initiative » s'affiche près de la frise. Le bouton « ▶️ Commencer le round » reste dans la barre
  du bas (inchangé).

### 3. `PartyDock` — l'équipe (gauche, centrée verticalement, flottante)

- Les héros du groupe (version « vivante » en combat : `battle.combatants`), une tuile chacun.
- Cadre = **couleur d'identité** du héros (`HERO_RING`, les 4 teintes froides du Lot 0) — cohérent
  avec les anneaux du champ et de la barre d'action. PV chiffrés dans le portrait.
- Clic = ouvre la **fiche perso** (`CharacterSheet`), comme l'actuel panneau Groupe.

### 4. `CombatLogDrawer` — le journal en tiroir (bas-droite)

- Bouton **📜** en bas à droite du champ ; tiroir **replié par défaut** ; état UI-local.
- Contenu = le journal actuel : `battle.log` (événements structurés) rendu via `narrateEvent`
  (icône par kind + noms colorés par camp). Aucune perte de la couche narration.

### 5. Ce qui disparaît ou migre (en combat)

- **Colonne gauche** (`hud-left` : Quitter, nom de scène, panneau Groupe) : masquée en combat.
- **Colonne droite** (`BattlePanel`) : supprimée — l'ordre devient la frise, le journal devient le
  tiroir, « Agir en premier » migre sur la frise, le toggle 🔍 aussi.
- **`CombatBanner`** (fil des 3 derniers événements en haut du champ) : supprimé — la place revient
  à la frise ; la lecture passe par les flottants, les modales et le tiroir.
- **Bannière « 🎮 À toi, X / ⚔️ Tour de l'ennemi »** : supprimée — l'actif est surligné dans la
  frise et la barre du bas affiche déjà l'acteur (ou « Tour de l'ennemi… »).
- **Écran Défaite** (vivait dans BattlePanel) : devient un **overlay centré** sur le champ
  (même contenu : titre + bouton Reprendre).
- **`LegendPanel`** : devient **repliable** (bouton ❓ en bas à gauche, replié par défaut).
- **Hors combat** : strictement rien ne change (GroupPanel, bourse, horloge, inventaire, journal).

## Architecture (affichage seul)

- **Nouveaux** : `src/ui/PortraitTile.tsx` · `src/ui/InitiativeStrip.tsx` · `src/ui/PartyDock.tsx`
  · `src/ui/CombatLogDrawer.tsx`.
- **Modifiés** : `src/ui/CampaignView.tsx` (en combat : masquer `hud-left`, monter
  InitiativeStrip/PartyDock/CombatLogDrawer/overlay défaite ; hors combat : inchangé),
  `src/ui/LegendPanel.tsx` (repliable), `src/ui/styles.css`.
- **Supprimés** (suppression franche, pas de shadow) : `src/ui/BattlePanel.tsx`,
  `src/ui/CombatBanner.tsx`. `GroupPanel`/`CharCard` restent (exploration / écran de groupe).
  Mettre à jour les commentaires « frise BattlePanel » → « frise d'initiative » dans
  `store.ts`, `combatFlow.ts`, `turnEconomy.ts`, `ActiveModal.tsx`, `ActionBar.tsx`,
  `roll-modal-invariant.test.ts`, `upkeep-reveal.test.ts` (cosmétique).
- **Données** : tout existe déjà — `Combatant` (`wounds`, `conditions`, `activeEffects`, `kind`),
  `battle.order/turn/round/log`, `pendingRoundStart` + `canActFirst`, `inspectEnabled`. Aucun
  nouveau champ de store ; seuls états UI-locaux : tiroir ouvert, légende ouverte.

## Tests

- `PortraitTile` : jauge verticale (hauteur = ratio, couleur = `hpColor`), PV chiffrés optionnels,
  ≤ 4 états rendus + « ▾ » au 5ᵉ (title complet), croix KO, marqueur actif.
- `InitiativeStrip` : tuiles rendues dans l'ordre `battle.order`, actif marqué, badge ⏫ présent
  pendant la pause si `canActFirst`, clic tuile → `onInspect`.
- `CombatLogDrawer` : replié par défaut, s'ouvre au clic, rend les lignes narrées.
- Suite existante : aucun test ne monte `BattlePanel`/`CombatBanner`/`GroupPanel` (vérifié) ;
  seuls deux commentaires de tests les citent (mise à jour cosmétique).

## Recette navigateur (Playwright)

Scénario 🧪 adapté ; vérifier : frise (ordre, actif, états, KO), dock (jauge, chiffres, clic fiche),
pause de début de Round (⏫ sur la frise), tiroir journal, légende repliable, défaite en overlay,
retour hors-combat intact, console 0 erreur.

## Hors périmètre

- Fiche express riche au survol des tuiles (title natif suffit pour l'instant).
- Tout le reste du diagnostic lisibilité (`2026-06-09-lisibilite-combat-diagnostic.md`) : prévision
  de menace, ciblage, flottants typés, etc. — lots séparés.

## Calibrations ouvertes (non bloquantes — à régler à l'implémentation)

- Tailles exactes des tuiles (dock ~56-64 px, frise ~40-48 px) ; icônes d'État plus petites sur la
  frise si besoin.
- Côté de la jauge interne (bord gauche proposé ; droite si conflit visuel avec la colonne d'états).
- Placement précis du tiroir 📜 vs `ViewControls` (éviter la collision, à caler au navigateur).
