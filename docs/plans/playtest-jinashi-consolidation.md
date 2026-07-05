# Retours playtest Jinashi — consolidation & confrontation au code/RAW

> ⚠️ **ARCHIVE (2026-07-05)** — document DATÉ : constat/plan d'époque, ne décrit PAS l'état courant du code.
> Conservé pour l'historique du raisonnement. Ne JAMAIS s'appuyer dessus pour juger l'architecture ou l'état actuel.

> Source : `retours_warhammer_tactic_jinashi.odt` (beta-test du combat + flux pré-combat).
> Méthode : chaque point investigué (code réel + RAW relu dans `Source/`) puis **re-vérifié de façon adverse**.
> Statut décisionnel : 3 bifurcations d'archi **tranchées** (voir ci-dessous) ; les autres `🗳` sont sur la **reco par défaut** sauf veto.

## Décodage du document source
Boucle itérative, surlignage = statut : 🟢 *Fait et ok* · 🟡 *Ok, mais…* (relance `=>`) · 🔴 *Pas fait* · ⚪ non trié.
**~17 points déjà au vert** (RAS) ; **~16 ouverts** + **5 bugs**.

## 3 constats transversaux
1. **Le testeur se trompe sur 2 « bugs ».** Re-tirage de localisation des critiques = **RAW** (LDB 18 l.53, exemple canon Ibrit/Hugo). « Portée sur vêtements » = **non-problème**.
2. **3 retours anodins cachent de vrais bugs shippés.** « Portée manquante » → **4 bugs `[object Object]`**. « Tooltip déborde » → **metaLine non borné** (51 spécialisations « Savoir »). « Clic Talent coupe la musique » → fiche **fermée** au retour + casse l'**undo éditeur**.
3. **Code mort/dupliqué trouvé en chemin** (cf. § dédié).

## Décisions d'architecture (tranchées 2026-06-27)
- **BUG-4 Codex** → **modale focalisée** au clic (pas de changement d'écran). Le survol (popover) reste ; seul le clic `openCodex→screen:'compendium'` devient une `Modal` réutilisant `CompendiumScreen(onClose)`. Browse complet depuis le menu = reste un écran.
- **T3 Loadout** → **weapon sets commutables, auto-étiquetés** (modèle Dragon Age / Pillars of Eternity). Surface primaire = Main principale/secondaire du set actif, éditable directement via l'unique writer par-id `setLoadoutSlot` (Sac + Combat). Les sets = bande de bascule compacte **auto-étiquetée par contenu** (« Épée + Bouclier », « Arc long », « Mains nues ») au lieu de « Set I/II » → règle la confusion à la racine. **Ajouter/retirer un set** via `+`/`×` discret (cap ~3) → `createLoadout`/`removeLoadout` deviennent de **vraies features**. **Supprimer** `setWeaponSetSlot` (double-writer par-index) et **`renameLoadout`** (libellés dérivés, pas de nommage manuel). Pas d'UI « sauvegarder un preset nommé ».
- **T2 Background** → **le RAW gagne** : lecture seule de la donnée canon + **Ambitions/Motivation éditables** (LDB 05 l.736), persistées par le save existant. Pas de « hauts-faits » canon.

---

## Les 5 bugs

### BUG-1 — Localisation des Coups Critiques (créatures) — *libellé, pas mécanique*
- **Réalité** : re-tirage **conforme RAW** (LDB 18 l.53). Bug = libellé **humanoïde** (`HIT_LOCATION_LABELS`) au lieu de `locationLabel(loc, shape)` sur 7 sites (`critical.ts:124,141` ; `combatFlow.ts:1018,1053,1101,1114,1169`) + pickers (`ForcedRollPicker.tsx:23`, `useAttackJetProps.tsx:139`).
- **Reco** : option B (libellé **découplé** — ne plus baker la localisation, dériver à l'affichage via `locationLabel` ; supprimer le garde `t.label.includes()`) + pickers shape-aware. **S.** Golden critique-quadrupède.
- **🗳 → décidé** : garder le re-tirage RAW ; **écart RAW distinct** LDB 18 l.55 (dégâts non-critiques + PA déviation à la localisation fraîche) = **ticket séparé** (risque combat).

### BUG-2 — « 55 = 55 » — *primitive*
- **Réalité** : `RollLine.tsx:30-35` + `PendingRollLine:75-80` rendent `= total` inconditionnellement (résolu ET pré-jet).
- **Reco** : extraire `RollCalc({base,modifier,target})`, omettre `= target` si `modifier===0`, gater le `title=`, **garder les chips** quand des mods s'annulent. **S, risque nul.** Tests 0-mod + cancel-out à ajouter.

### BUG-3 — Tooltip CodexRef qui déborde — *cause = metaLine non borné*
- **Réalité** : flip basé sur `POP_H=220` **deviné** ; vraie cause = `metaLine` non borné (« Savoir » 51 specs → ~400px).
- **Reco** : borner le metaLine via `truncate` existant + remplacer `POP_H` par la place réelle (clamp top/bottom + `maxHeight` inline) + supprimer la constante morte. **S.**
- **🗳 → reco** : placement « côté avec le plus de place + contenu borné ».

### BUG-4 — Clic Talent : musique coupée + fiche perdue — *systémique* → **modale (décidé)**
- **Réalité** : la fiche est **fermée** au retour (`sheetId` = useState local détruit) ; touche tout `CodexRef` en jeu (combat) + détruit l'**undo éditeur**.
- **Reco (décidée)** : détail Codex en **modale** (pas de `setScreen`). `screen` reste `campaign` → musique continue (idempotence `playMusic` `engine.ts:138`), fiche+onglet préservés. Paramétrer `CompendiumScreen(onClose)`, scinder la double sémantique d'`openCodex`, supprimer la dette `compendiumReturn` pour le drill-in. **M.**

### BUG-5 — « Encombrement » déborde — *primitive*
- **Réalité** : `.sc-label` sans césure ; idem Détermination (13 car.), Résilience, ShipSheet, **CharCard**.
- **Reco** : `overflow-wrap:anywhere` sur `.sc-label` (`components.css:114`). **S.** 🗳 → reco : enroulement 2 lignes.

---

## Thèmes features

### T1 — Popover sur les caractéristiques (fiche)
- **Réalité** : pattern existant (`CharCard`, `CharacterCreator`) manquant à `CharacterSheet:426` + `CreatorSummary:55`. **Piège** : `title=` natif sur le `<div>` parent → le déplacer sur la valeur (sinon double-tooltip).
- **Reco** : option B + supprimer 2 maps `SHORT` identité. Idéal : primitive `<CharStatsGrid>`. **S/M.**

### T2 — Background → **Ambitions éditables (RAW, décidé)**
- **Réalité** : portrait→fiche déjà fait ; **save/autosave existe** (`saves.ts`) → Ambitions éditables persistent. Donnée bio collectée mais jamais rendue. Affordance morte `interludeEvents.json:102`.
- **Reco** : onglet `HeroBackground` (mutualise le récap créateur) lecture seule + Ambitions/Motivation éditables gaté hors-combat + write-back roster bonus. **M.** Enrichir `pregens.json` (détails en dur, zéro RNG/golden).

### T2 — Cartes prétirés iso-hauteur
- **Réalité** : cible = écran **groupe** (`.party-grid`), pas le picker (hint faux). Le slot est étiré, la carte ne remplit pas.
- **Reco** : `.party-slot > .char-card, .empty-slot { flex:1 }`. **S.** 🗳 → reco : cadres égaux (pas d'alignement colonne interne).

### T2 — Changer l'occupant d'un slot
- **Réalité** : bloqué à 4/4 (faut Retirer). Le créateur **duplique** déjà remove+add.
- **Reco** : primitive `partyReplaceHero` atomique réutilisée par créateur + bouton « Remplacer » (picker ciblé index). **M.** 🗳 → reco : « Remplacer » (3 boutons), coop via intent dédié.

### T3 — Loadout / sets → **weapon sets auto-étiquetés (décidé)**
- **Réalité** : modèle déjà main/off ; switch 1/tour RAW (LDB 13 l.106, **commentaire de code faux**). Code mort : `createLoadout`/`renameLoadout`, branche 🗑, double-writer `setWeaponSetSlot`.
- **Décision de design** : NE PAS réduire à un seul main/off (tue le swap mêlée↔distance, cœur tactique + RAW action gratuite) ; NE PAS faire de bibliothèque de presets nommés (friction CRPG, ×4 héros, 360px). → **weapon sets commutables à la Dragon Age / PoE.**
- **Reco (décidée)** :
  1. Surface primaire (Sac + Combat) = **Main principale / Main secondaire du set actif, éditable directement** via `setLoadoutSlot` par-id (verrouillé en combat — seul le switch gratuit 1/tour est RAW).
  2. Sets = bascule compacte **auto-étiquetée par contenu** (dérive le libellé des armes : « Épée + Bouclier » / « Arc long » / « Mains nues ») → remplace « Set I/II ».
  3. `+`/`×` discret pour ajouter/retirer un set (cap ~3) → **`createLoadout`/`removeLoadout` deviennent réels**.
  4. **Supprimer** : `setWeaponSetSlot` (par-index), **`renameLoadout`** (libellés dérivés).
  5. Afficher coût **−20** main secondaire ; corriger picker « 2nde » (mêlée 1-main OU pistolet, LDB 14 l.138) ; corriger commentaire « autorisé même Engagé » (= choix design, pas RAW). **M.**

### T3 — Portée encart Combat + `[object Object]` — *bien plus gros*
- **Réalité** : 4 rendus de stats d'arme copiés-collés ; **2 cassés** → « Dégâts [object Object] » + qualités « [object Object] » dans Sac, Créateur (`:1002`), Compendium (`registry.ts:380,384`).
- **Reco** : composeur `weaponStatParts` au-dessus de `damageString`/`qualityRefLabel` → ajoute Allonge/Portée à l'encart Combat ET tue les 4 `[object Object]`. **M.** 🗳 → reco : ligne unique, munitions en suffixe.

### T3 — Portée vêtements — *à écarter + normaliser*
- **Réalité** : non-problème, MAIS `reach`/`range` conflatés (arc `reach=50 ET range=50`) ; `TrappingData.reach:string|null` = **type menteur** (nombres en base).
- **Reco** : écarter la plainte + **normaliser** (`range` séparé + retype + `reach:null` pour ranged à `items.ts:173`). 🗳 → reco : normaliser maintenant.

### T3 — Catégorie « Équipement » carte de sélection
- **Réalité** : info déjà présente (icônes) ; vrai défaut = armure réduite à `corps`.
- **Reco** : option B scopée `!compact` — section titrée, armure **par zone** (ZONES d'`EquipmentPanel`), router par `EntityRef`/`ItemIcon`. **M.** 🗳 → reco : B.

### T4+T5 — Highlight de survol unifié
- **Réalité** : 3 traitements divergents (props OK, portes halo constant, **PNJ aucun halo**) ; halo combat conditionné visée valide + mon tour.
- **Reco** : option 2 — un chemin survol→halo **kind/turn-agnostique** réutilisant l'ellipse-pieds de `BodyToken`, réciprocité piste↔carte, PNJ hover-only. **M.** 🗳 → reco : PNJ hover-only, réciprocité complète, coexister avec la visée (pas fusionner).

### T4 — Clic sur case bloquée + divergence survol↔clic
- **Réalité** : bug bonus — le survol dessine un chemin **dans** l'obstacle alors que le clic ne fait rien.
- **Reco** : option A (rayon 1) via `adjacentWalkable` dans `exploreMoveDest` → corrige clic + divergence. **S.** 🗳 → reco : rayon 1 + micro-feedback si non-routable. Nettoyage : mutualiser les 3 `chebyshev`.

### T5 — Splash « COMBAT »
- **Réalité** : asymétrie (la fin a un plein-écran, pas le début).
- **Reco** : composant `pointer-events:none` keyé `pendingRoundStart.round`, auto-dismiss **CSS-only**, z-index ~50, `prefers-reduced-motion`, `var(--font-display)`. **S.** 🗳 → reco : décider entrée-seule vs beat par-round + wording + audio.

### T5 — Scores d'initiative
- **Réalité** : `c.initiative` calculé mais jamais affiché ; props mortes `round`/`pendingRound` + CSS mort `.is-round`/`.is-pause` + docstring fausse.
- **Reco** : chip score permanent dans `.is-cell` (pas dans `PortraitTile`) + purge dette. **S.** 🗳 → reco : permanent ; score ennemi (micro-fuite carac I) ; indice « Lente ».

### T5 — Clignotement barre de mouvement
- **Réalité** : crans keyés par index, `af-pulse` sans delay → phases décalées (persiste souris arrêtée).
- **Reco** : option 1 — `@property --af-pulse` sur le parent, crans lisent `opacity:var()` → une horloge, couvre Mouvement/Action/Avantage. **S.** 🗳 → reco : `@property`.

---

## Code mort / duplication trouvés en chemin
- `store.createLoadout` / `renameLoadout` + branche 🗑 `EquipmentPanel` = inatteignables ; double-writer `setWeaponSetSlot` (→ supprimés par T3-loadout).
- `InitiativeStrip` : 2 props mortes + 2 CSS mortes + docstring fausse (→ T5-init).
- 2 maps `SHORT` identité `{k}===SHORT[k]` (→ T1 / T3-equip).
- 3 copies de `chebyshev` (`path.ts` l'exporte) (→ T4-click).
- 4 rendus de stats d'arme copiés-collés + `TrappingData.reach` type menteur (→ T3).

---

## Issues (cgauche/game) — créées 2026-06-27
**Bugs (LOT 1, en cours) :** [#70](https://github.com/cgauche/game/issues/70) crit localisation · [#71](https://github.com/cgauche/game/issues/71) « 55=55 » · [#72](https://github.com/cgauche/game/issues/72) tooltip · [#73](https://github.com/cgauche/game/issues/73) codex-modale · [#74](https://github.com/cgauche/game/issues/74) encombrement.
**Lots-thèmes :** [#75](https://github.com/cgauche/game/issues/75) loadout sets auto-étiquetés · [#76](https://github.com/cgauche/game/issues/76) stats-arme (`weaponStatParts` + `[object Object]` + reach/range) · [#77](https://github.com/cgauche/game/issues/77) hover-highlight unifié · [#78](https://github.com/cgauche/game/issues/78) combat-ouverture · [#79](https://github.com/cgauche/game/issues/79) fiche/sélection.
**Ticket RAW séparé :** [#80](https://github.com/cgauche/game/issues/80) dégâts non-critiques + PA déviation à la localisation fraîche (LDB 18 l.55 / 63).
