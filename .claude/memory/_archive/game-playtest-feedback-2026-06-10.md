---
name: game-playtest-feedback-2026-06-10
description: "File des retours playtest 2026-06-09/10 (HUD BG3 livré, puis ~21 retours UX) — DONE vs QUEUE"
metadata: 
  node_type: memory
  type: project
  originSessionId: 9a11e89d-0497-4b0f-9249-26b8c86eb6bd
---

Après livraison du plan **HUD BG3** (`2026-06-09-hud-bg3-tuiles-mobile.md`, 8 tasks), session de playtest live : l'utilisateur a enchaîné ~21 retours UX. Prolonge [[game-playtest-feedback-lots]] et [[feedback-playtest-themes-not-points]].

## LIVRÉ + committé (branche feat/wfrp4-rpg-foundation)
- Plan HUD BG3 complet (PortraitTile, InitiativeStrip, PartyDock, LogDrawer, GameMenu ; CampaignView plein-champ ; suppression BattlePanel/LegendPanel/GroupPanel + CSS mort ; recette desktop+mobile).
- Calibrations : fil **décollé de la frise** (top 84/78, mesuré bottom frise=73), journal **transparent + opaque au survol** (`.log-drawer:hover .ld-panel`), fil mobile sur 2 lignes.
- ActionBar gauche **compacte via PortraitTile** ; **Mouvement = barre à crans** (`.ab-move-track .mp`), nom du héros **en title** (plus affiché) ; cadres frise **+épais** (3px, allié vert/ennemi rouge).
- Modale d'attaque : **localisation visée = menu déroulant** (`.rm-loc-select`) ; bouton de jet **unifié « 🎲 Lancer »** (Défense alignée sur Attaque).
- **Portraits dans les modales subies** : `RevealEntry.subjectId` (critical/miscast/assommante/calme/backstab → portrait+nom) + Fumble + Déviation. Classe `.modal-subject`.
- **Run autonome 2026-06-10** (« traite l'ensemble ») : **#17** monnaie colorée (`Coins.tsx`, or/argent/cuivre) ; **#18** vente en onglets par PJ ; **#19** tag « ✓ équipé » ; **#22a** panier sticky ; **#25a** portrait ActionBar +grand (64) ; **#26** ActionBar actions sur moins de rangées (`justify-content:center`, max-width 760) ; **#5** Peur/Terreur combat-only (`encounterPsych` ne garde que les traits sociaux ; tests réécrits) ; **#12c** frise sans chip Round N ni hint de pause.

## QUEUE (à faire, ordre indicatif)
- **#5** Peur/Terreur **JAMAIS hors combat** (choix utilisateur confirmé). `engine/encounterPsych.ts` : retirer la boucle `fearSourceFor`, GARDER les Traits sociaux (Animosité/Haine/Préjugé/Phobie — RAW taverne). MAJ `encounter-psych-flow.test.ts` (4 tests Terreur → null/social). Cause : galerie inonde (58 modèles non hostiles).
- **#6** Pouvoir dépenser **Détermination** sur les popins de Calme (encounter psych modal `EncounterPsychModal.tsx`, et vérifier modal psych de combat).
- **#9** Arène : écran de **victoire pas vu** (téléport simultané) → faire le téléport **au clic « Continuer »** ; afficher le **message journal de l'arène dans l'écran de victoire**.
- **#12a** Début du **1er Round** : impossible de dépenser Chance pour agir en premier (pré-emption manquante au round 1).
- **#12b** Mécanique « agir en premier » pas claire (petit texte au-dessus du journal).
- **#12c** En HAUT : RIEN d'autre que le **fil d'événements** (retirer chip « Round N » + hint `.is-pause` texte) ; en bas, juste le bouton.
- **#12d** **Intentions des PNJ** (archer/ennemi qui décide d'attaquer) affichées dans le journal **dès la décision** (pas après résolution).
- **#15/#20** Portraits dans **TOUTES** les modales (Soigner, Chirurgie, Frappe Mortelle, psych…). Sélection de cible = **clic sur le PORTRAIT**, pas un bouton nommé (CombatantBadge/TeamPortrait partout).
- **#16** Chirurgie : pouvoir **bander (soin PB) + arrêter hémorragies** pendant l'opération **sans l'interrompre**.
- **#17** Prix : pièces **OR en couleur or, argent en argent, cuivre en cuivre** (formatMoney → rendu coloré par dénomination ; `.purse .co/.sc/.pa` existent déjà).
- **#18** Interface de **vente : un onglet par PJ** (au lieu d'une liste avec le nom du PJ devant chaque item).
- **#19** + **indiquer l'équipement équipé** dans la vente.
- **#21** Viser une capacité = pouvoir **cliquer les portraits init/dock** (vérifier la portée).
- **#22** Marchand : **panier sticky** (toujours visible au scroll des items) ; la **vente n'a pas de panier** — doit marcher comme l'achat.
- **#23** Test ÉTENDU (DR cumulé vers une cible) : afficher une **barre qui se remplit** (Focalisation/Rechargement/Chirurgie/Calme étendu).
- **#25b** Frénésie + Mouvement non utilisé → pouvoir **Charger** (attaque gratuite dispo) : bouton Charger disabled `battle.acted && !freeFrenzy`.
- **#26** (FAIT) ActionBar moins de vide.
- **#27a** PC **mort** soigné par le médecin → reste mort MAIS avec PB (bug) : empêcher de soigner un mort.
- **#27b** Si le PC principal d'exploration est mort, **basculer sur le suivant vivant**.

## BILAN run autonome (« traite l'ensemble ») — 2026-06-10
**FAIT + committé + suite verte (1980 tests) + smoke-test navigateur 0 erreur** : #5, #6, #7, #8, #9, #10, #11, #12a, #12b, #12c, #12d (ranged ; mêlée = modale de défense), #13/#14/#15/#20 (portraits modales : Critique/Maladresse/Colère/Déviation/Assommante/Calme/Soin/Psych/Rencontre + sélection de cible par portrait), #17, #18, #19, #21, #22a, #23 (chirurgie+Peur), #25a, #25b, #26, #27a, #27b. Composants neufs : `Coins.tsx`, `DrBar.tsx`. Action store neuve : `encounterPsychResolve`. `PendingVictory.onContinue/messages`.

**#16 FAIT** : `surgeryBandage`/`surgeryStopBleed` (boutons « 🩹 Bander » / « 🩸 Hémorragie » dans la modale de Chirurgie ; jets de Guérison appliqués sans avancer le DR ni interrompre ; allowlist du garde-fou « un jet = une modale »).

**Refonte MODALES (anti-duplication, demande forte utilisateur) FAIT** : cadre partagé **`Modal`** (voile+boîte+titre+sujet) + **`ModalSubject`** (portrait+nom) → TOUTES les modales de combat dessus (Attaque/Défense/Reveal/Maladresse/Déviation/Rencontre + RollFlowShell→Heal/Psych). Résolveurs de soin partagés **`resolveWoundsHeal`/`resolveBleedHeal`** (healConfirm + chirurgie). **Modale de Coup Critique COMPLÈTE** : qui→arme→victime (CombatantBadge), dé, localisation **FR** (jambeD→Jambe droite, plus de double), **Blessures** (ignore BE+PA), **États**, et chaque **effet avec son explication RAW** (`RevealEntry.actorId/weapon/details/crit`). **Déviation** s'ouvre même sans armure (informe ; bouton grisé + PA de la zone).

**DÉFÉRÉ (1)** : **#22b** Marchand — VRAI panier de VENTE (parité achat). Nécessite un nouvel état store `merchant.sellCart` + actions (add/remove/confirmSell). #22a (panier sticky) FAIT.

Restes mineurs : ~~picker de soin ActionBar~~ (FAIT — déjà en portraits, `ab-heal-pick`) ; ~~titres frise « inspecter » en mode ciblage~~ (FAIT commit fe002bc — prop `targeting` → « cibler » sur frise ET dock).

Méthode : commits par lots, typecheck+`npm test` verts, vérif navigateur légère (l'utilisateur teste lui-même sur :5174). PowerShell pour git/tests (Bash lent ici).
