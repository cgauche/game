---
name: game-arbitrage-hud-console-rt-2026-08-16
description: Arbitrages HUD combat 2026-08-16 — console RT deux travées simultanées, jamais de bouton-liste (sorts en alvéoles), géométrie immuable, clavier sans modificateur, remèdes d'État sur pastille
metadata:
  type: project
---

Chantier HUD de combat (plan `docs/plans/2026-08-16-hud-combat.md` §3bis, verbatims complets).
Chronologie : Spec dix-zones = ébauche jetable → `Invariant HUD Combat.dc.html` (4 lois, jugé
hors dépôt SANS shell) → session 2026-08-16 = cérémonie complète (5 sondes + juge avec shell).
Le design 2026-07-31 (`docs/superpowers/specs/…`) « a énormément de défauts, et a empiré
l'interface » (2026-08-16) → à REMPLACER, réfs code soldées au fil du chantier.

Arbitrages utilisateur (2026-08-16, verbatims au plan §3bis) :
- **Anatomie = console Rogue Trader** (`docs/plans/Analyse HUD Rogue Trader.dc.html`) : DEUX
  TRAVÉES SIMULTANÉES — gauche = consommables + sets d'armes + gestes liés à l'arme (Charge
  mêlée, Recharger, tir sans bouger, tir dans le tas, Soin près des consommables) ; droite =
  le reste (Mouvement, Avantage, Course avec jet de distance, sorts/miracles). Les onglets de
  la loi 2 se dissolvent ; la règle « survit les mains nues » est remplacée.
- **Boutons = sélection volontaire d'intention** (« Ca ne change pas les actions par défaut
  sur le grid ») — leur valeur est la PRÉVISUALISATION (cliquer Charge → voir la portée réelle).
- **« je ne veux pas que la taille de l'interface ou les boutons bougent »** — géométrie immuable.
- **« les sorts dans une liste c'est un NON »** — jamais de bouton qui ouvre une liste
  d'actions ; chaque capacité = une alvéole (RT : 2 rangées de 7, touche dans la case, coût en
  crans, cases vides dessinées, conduit d'Avantage branché sur la grille). Le patron
  `.ab-spells` disparaît.
- Clavier SANS modificateur (AZERTY : Maj+1 = « 1 ») · Empreinte = POSITION fixe + touche par
  ID d'action (pas compte de cases — 5 max à 360px) · Réactions d'État sur la PASTILLE
  (`StateChips`+`GatedAction`, −4 ids).
- **Sorts = GRIMOIRE + barre PLACÉE PAR LE JOUEUR** (pire cas mesuré : 211 sorts, Haute
  Sorcière du scénario de magie — « Le pire il est dans le scénario de magie ») : « on
  "Epingle pas", on place nous mêmes nos sorts et capacités », défaut fourni, placement
  libre ; l'exhaustif au grimoire (colonne d'outils, GroupedPickGrid/MasterDetail).
- **L'état de chargement vit sur l'ARME** (verbatim 2026-08-16 : « si j ai 2 armes à
  distance elles gèrent chacune leur propre rechargement et munition ») : migration des
  champs `Combatant.ammoUid/loaded/reloadProgress/chambered/loadedAmmoUid` vers l'instance
  d'arme, DANS le lot 2 — le modèle une-arme-à-distance (`types.ts:1588-1590`) meurt ; le
  changement de set ne téléporte plus l'état.
- **Munitions FACILES depuis la barre** (« on doit pouvoir choisir ses munitions avec nos
  armes de tir facilement depuis sa barre d'action ») MAIS **la munition se FIXE AU
  CHARGEMENT** (AskUserQuestion 2026-08-16) : le modèle actuel (choix au tir, bascule
  gratuite) est un contournement à migrer — changer sur arme chargée = re-recharger.
- **Bascule de console / médaillons hors tour : REFUSÉE** (« C'est quoi cette merde ? Je
  l'ai deja refusé cette interface qui n'a pas lieu d'etre ») — hors tour = LECTURE, la
  défense vit dans la fenêtre de jet. ⚠ Les propositions « Chez nous » de l'analyse RT ne
  sont PAS des acquis : la spec dix-zones qui en découlait a été REFUSÉE (« cette spec a été
  refusé et ca a amené a l'invariant ») — chaque point se re-valide.
- **Le ban des listes vise LA BARRE D'ACTION seulement** (« ca ne me dérange pas de pouvoir
  faire des actions depuis l'inventaire ou le grimoire ») — le grimoire LANCE et place.
- **Travée gauche : compte de cases FIXE aussi** (une seule loi de géométrie).
- Bug vivant corrigé en cérémonie : gate Détermination (`ActionBar.tsx:444` → `resolve > 0`,
  3 usages RAW LDB 17 l.59-61 atteignables sans État) + même classe `turnEconomy.ts:34` ;
  frontière `ignoreCritMods` vs maladie = #1336.
- **Spec finale** (`docs/plans/2026-08-16-spec-hud-combat.md`, Révision 2 jugée + 4
  arbitrages AskUserQuestion) : travée gauche DÉDUITE du set (placement joueur = grille +
  objets) · **la touche suit la CASE** (révision explicite de « touche par ID ») · interlude
  et pause de Round cessent de remplacer la barre (console lecture + BANDEAU) · le grimoire
  devient l'ÉCRAN DE CAPACITÉS (sorts + manœuvres + talents à activation — l'exhaustif de
  tout ce qui n'est pas posé). Ordre des lots : réfs → munitions (moteur) → console (gros
  lot : travées+grille+clavier+grimoire+phases) → intentions → pastilles → frise #1332 →
  solde. G5 postures = NOUVEAU champ `battle.stances` (les `attackSet*` sont no-op sans
  `pendingAttack`) ; persistance barre = `(partyKey, actorId)` (`saveId` n'existe pas).
- **G6 tranché sur matrice mesurée** (max 5 gestes simultanés prouvé) : les gestes ouverts
  par une ENTITÉ adjacente sortent de la barre → pastilles sur l'entité (Monter sur la
  monture, Servir/Pousser sur la pièce — même patron que ramasser) ; la barre garde 2 cases
  (geste d'ARME + geste d'ÉTAT du héros). Maquette = DANS le code en worktree (demande
  user), jamais du HTML jetable.
- **Ébauche de maquettes récupérée** (artefact claude.ai auto-contenu, purgé depuis) — ⚠ « cette maquette a été faite avant
  l'invariant » (verbatim) : MATIÈRE visuelle (plaques acier/laiton, gouttières, conduit,
  plaquettes), JAMAIS cible de conformité — la structure vient de la spec, l'invariant
  gagne toute divergence. Leçon : une planche de design se REGARDE rendue (l'artefact/les
  .dc.html se servent en HTTP local + Playwright), jamais parsée en texte.
- **Vague 2 RETOUR VISUEL validée** (5 éléments, spec Vague 2) : réparer #1327 (flottants
  muets en volumique confirmé, SFX infirmé — commenté au ticket) → plaquette de conséquence
  (flottants enrichis : réaction+localisation+Blessures) → infobulle-contrat (+attaque
  gratuite annoncée ; « Réaction restante » RT abandonnée, sans objet RAW) → curseur
  porteur du coût → prévision de zone par créature. Silhouettes déjà livrées (#1297).
- **PLANCHE USER 2026-08-17 = cible de conformité BORNÉE** (écran assemblé 1920×1080, planche purgée depuis) : elle fait foi sur la COMPOSITION (zones,
  géométrie, hiérarchie) — PAS sur le contenu réglé. Verbatims (2026-08-17) : « Certains
  textes sont juste des explications de fonctionnement plutôt que des informations à
  afficher » et « Les icônes proposées n ont pas valeur de règle, cette spec n a pas toute
  notre historique » — icônes/listes d'actions/libellés/touches de la planche = spécimens
  illustratifs, le contenu réel vient des §1a/§1b + arbitrages + registres du dépôt.

**Why:** Ces arbitrages ferment des réfutations mesurées du juge (AZERTY, 360px, alvéoles
mortes) et [[user-doctrine-etat-de-lart-avant-invention]] — RT est la référence assumée.
**How to apply:** Toute spec/codeur HUD cite le §1 du plan (verbatims) ; jamais de slot-menu
dans la barre ; dette Chance libre = #1332. Voir [[game-arbitrage-vue-top-tactique-tabletop]]
pour le champ.
