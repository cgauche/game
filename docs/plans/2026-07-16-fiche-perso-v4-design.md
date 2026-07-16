# Design v4 de la fiche de personnage (#492) — « la fiche qui répond avant qu'on demande »

> **Date** : 2026-07-16 · **Statut** : RATIFIÉ sur les 4 arbitrages structurants (user 2026-07-16,
> choix explicites : fusion Possessions OUI, atterrissage sur alarme OUI, rose sortie OUI,
> Soins → PartyDock/HUD). Fondé sur `2026-07-16-fiche-perso-cadrage.md` (premiers principes) ;
> remplace la STRUCTURE de la planche v3 (`2026-07-14-maquettes-createur/planche-fiche-perso.html`),
> qui reste l'étalon de MATIÈRE (tokens, plaques, cartes — valeurs Atelier). Artefact daté :
> à supprimer une fois #492 exécuté.

## 1. Les défauts de la v3 que la v4 corrige

Dissection complète (mocks 1-9) contre le cadrage :

1. **Elle affiche, elle n'alerte pas** : corruption/maladie/mutation/surcharge ne remontent
   jamais en colonne ; seule « alarme » = badge numérique nu « État 5 », incohérent entre mocks
   (même badge sur corps sain Round 3 et corps ravagé Round 7). Viole l'amendement 1 du cadrage.
2. **Triple affichage sans hiérarchie** : Blessures ×3, PA ×3, Encombrement ×3 ; la séparation
   Harnois/Sac produit deux vérités (Veste de cuir rendue comme DEUX objets au damier, un seul
   au Sac).
3. **Interactions clés absentes** : aucune affordance de décomposition de valeur (amendement 2),
   aucun switch de héros (amendement 3), scroll jamais conçu à 880×730 (État-blessé et
   Avancement débordent), grammaire de carte de sort instable (« Invoquer » vs « Lancer
   (grimoire) » vs rien), rose médaillon 90px illisible doublée de sa légende texte, libellé
   d'onglet variable (« Compétences & Talents » vs « Compétences » selon le héros).

## 2. Ce que la v4 CONSERVE de la v3 (structure validée par le cadrage)

Modale flottante (~880px × 88vh) posée sur le jeu · colonne gauche permanente 240px · onglets =
questions · détail d'entité au popover Codex (`CodexRef`), jamais de master-detail · un onglet
sans objet est ABSENT, jamais grisé · prose verbatim + 1 GameOp = 1 rangée (doctrine #295) ·
dev/commerce sortis de la fiche · valeurs = lecteurs canoniques du moteur (#498).

## 3. Les quatre piliers de la v4

### 3.1 La colonne devient un MONITEUR, plus un catalogue
Haut → bas : **rangée de compagnie** (les 4 héros en `PortraitTile` réduits — clic = switch de
héros SANS refermer, onglet conservé) · portrait (arc PV + pastilles d'états) · nom ·
race/carrière/statut codex-liés · vitals (Blessures / Mouvement / Encombrement) · ressources
(Destin·Chance / Résilience·Détermination) · **BANDE D'ALARMES** · `CharStatsGrid` 10 caracs.
- La bande d'alarmes : chips iconées à tone (Corruption n, maladie nommée, Mutation n, Trauma,
  Psychologie active, Surchargé), présentes SEULEMENT si alarme, chacune = bouton focusable qui
  ancre vers sa rubrique de l'onglet État. Sélecteur UNIQUE `sheetAlarms(hero)` (module UI) —
  la bande, la règle d'atterrissage et tout badge lisent LA même source.
- **La rose des forces SORT de la fiche** (reste créateur/écran de groupe). Les badges
  numériques d'onglet MEURENT (l'alarme vit en colonne, toujours visible).

### 3.2 La fiche s'ouvre sur ce qui cloche
`sheetAlarms.length > 0` → atterrissage sur l'onglet **État** ; sinon dernier onglet consulté.
Nuance anti-harcèlement : la règle ne force État qu'à la PREMIÈRE ouverture depuis l'apparition
d'une alarme nouvelle — ensuite, dernier onglet. Persistance héros + onglet + scroll au store
(champs UI éphémères non sauvegardés, patron `inspectId`), partagée entre les hôtes
(CampaignView / PartyScreen).

### 3.3 La décomposition universelle, dans la langue des jets
Toute valeur calculée (carac, compétence, PA de zone, Mouvement, Enc max) s'explique au
clic/survol avec les chips CANONIQUES des modales de jet (`RollCalc` + `ModChips`,
`src/ui/RollLine.tsx` — à exporter) : « Base 32 · +5 Guerrier-né · −10 Fracture = 27 ».
**Chantier moteur préalable** : étiqueter les sources dans le collecteur de passifs
(`passiveMods`, `src/engine/trauma.ts` — les `PassiveMod` n'ont pas de label ; sans ça le
popover dirait « Intrinsèque +5 » au lieu de nommer la mutation). `volatileCharLines`
(`src/engine/characteristics.ts`) étiquette déjà le pool volatil. Lecteurs à créer :
`charBreakdownLines` / compétence / PA par pièce (net de `damageTaken`) / Mouvement / Enc max.

### 3.4 Six onglets, le scroll conçu
Chaque onglet = zone « réponse d'un regard » FIXE en tête + corps scrollable (patron
`ActivityPane`). Ordre et contenu :
1. **État** — « qu'est-ce qui m'arrive ? » : silhouette organisatrice, critiques épinglés
   (prose verbatim + `GameOpChips`), états, traumas, maladies, mutations, corruption,
   **effets actifs + contrecoups** (`activeEffects` + `castPenalties` — quittent la colonne).
   Vide = silhouette calme, « rien à signaler ».
2. **Possessions** — « que je porte, que je transporte ? » : FUSION Harnois+Sac. En-tête fixe
   compact/repliable = damier 4×3 nommant (acquis `EquipmentPanel`, composable tel quel) +
   bilan Armure/Enc/Surcharge + sets d'armes + mannequin médaillon + récap munitions ; corps
   scrollable = LA liste (groupes Armes/Armures/Consommables/Divers, imbrication contenants),
   l'objet ÉLU déplie sa barre d'actions en place (Évaluer/Détecter/Utiliser/Ranger/Donner/
   Porter/main/skin/silhouette — verrous combat préservés sur chaque action). Un objet = UNE
   vérité, équipé = badge. Arbitrage d'exécution : le HandPicker par-ligne et les sets
   d'en-tête doivent élire UNE affordance de main (jamais deux).
3. **Compétences & Talents** — libellé UNIQUE : chips codex + valeurs `skillBaseValue` +
   décomposition ; « ce que je ne peux pas tenter » (avancées non possédées).
4. **Magie & Foi** — conditionnel, gate CORRIGÉ : `casterTalents(hero).length > 0` OU sorts
   connus (bug Péché du Bienheureux, `castingKind` en donnée — jamais de name-match).
   Grammaire de carte UNIQUE (une action primaire gated par contexte) ; magie mineure ;
   bénédictions/miracles ; **lecture au grimoire (NI doublé) — préservée** ; dissipation ;
   focalisation ; Péché ; composants (compteur ×n + jeter ; l'ACHAT part au marchand, ticket
   séparé) ; badges de support mécanique/partiel/narratif ; sélecteur de cible à replacer
   dans la grammaire de carte.
5. **Avancement** — l'établi : PX collant, `PlaqueRow` par poste, caracs/compétences/talents,
   emplacements au choix (`SlotChoiceRow`/`designateCareerSlot`), **sorts (`buySpell`) + badge
   +1 Corruption chaos**, carrière (monter/redescendre/changer, `CareerPath`), raisons de
   gating ÉCRITES (`GatedAction`, les `reason` existent). **Les achats de prothèses (PX)
   migrent ICI depuis le Sac.**
6. **Histoire** — « qui est-ce ? » : `ParchmentCard` bio + identité éditable +
   motivation/ambitions + **signe astral** (quitte la colonne).

## 4. Ce qui SORT de la fiche (et vers OÙ — chaque sortie a sa maison AVANT suppression)

- **Bouton Soins** → PartyDock/HUD (arbitrage user 2026-07-16 : « PartyDock / HUD ») — geste
  sur le portrait du blessé, action de groupe hors combat. La fiche ne le perd qu'une fois le
  remplaçant LIVRÉ.
- **Skin & silhouette d'arme (FormPicker)** : restent dans la barre d'actions de l'objet élu
  (évaluation d'ingénierie : actions par-objet, un « menu de test » n'a pas ce contexte — le
  ticket #492 les envoyait à tort au menu de test).
- Outils d'atelier sans contexte objet (ColorPalettePickers de héros, etc.) → menu de test ;
  achat de composants → marchand ; scénarios de test hors de `sheet.css`.

## 5. Contraintes d'exécution

- `useModalA11y` préservé ; switch de héros sans perte de focus (rester sur la tuile), annonce
  du changement (titre du dialog/aria-live) ; chips d'alarme focusables.
- Responsive : breakpoints canon 900/700/560, utilisable 360px ; la bande d'alarmes SURVIT au
  mode empilé (cœur du cadrage — jamais sous le fold).
- Cliquet `sheet.css` (garde `ui-ratchets.test.ts`, familles xii/xiii) : décrue exigée — 100 %
  tokens, fusion + suppressions (rose, badges) compensent les ajouts.
- En combat : lecture des copies de bataille (`battle.combatants`) et verrous `inBattle` sur
  chaque action migrée. PosteSheet (véhicules/engins, `CampaignView.tsx:387-391`) inchangé —
  la rangée de compagnie ne liste que `party`.
- Aucun test/garde ne doit asserter les badges d'onglet supprimés (vérifier
  `CharacterSheet.test.tsx`).

## 6. Lots (verdict user par jalon ; preuve navigateur du codeur à chaque lot)

- **Lot 0 — Socle** : coquille v4 (colonne + rangée de compagnie + onglets renommés, contenus
  mappés 1:1 sans fusion), état au store (`sheetHeroId`/`sheetTab`/scroll), switch de héros,
  gate Magie & Foi corrigé, badges d'onglet supprimés.
- **Lot 1 — Colonne moniteur + onglet État** (LE jalon de goût) : `sheetAlarms`, bande
  d'alarmes ancrée, règle d'atterrissage, État rédigé (prose verbatim + GameOpChips), rose
  sortie, signe astral déplacé.
- **Lot 2 — Décomposition universelle** : étiquetage `passiveMods` (goldens sur
  `effectiveChar`), lecteurs de breakdown, export RollCalc/ModChips, popover, branchement
  colonne + Compétences.
- **Lot 3 — Possessions** (fusion) : en-tête fixe + liste unique + barre d'actions de l'élu +
  prothèses migrées + arbitrage main unique.
- **Lot 4 — Magie & Foi** : grammaire de carte unique, tout l'existant OOC préservé.
- **Lot 5 — Avancement + Histoire** : GatedAction, CareerPath, prothèses, ParchmentCard bio.
- **Lot 6 — Sorties & finitions** : Soins re-domicilié PUIS retiré, responsive 900/700/560/360,
  passe a11y, recette complète des 5 moments du cadrage.

Ordre : 2 avant 3 (Possessions consomme les popovers PA/Enc). Chaque lot laisse la fiche
fonctionnelle (jamais d'onglet mort).
