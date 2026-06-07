# Design — Action Guérison + désencombrement de l'ActionBar

*Date : 2026-06-07 — Branche : `feat/wfrp4-rpg-foundation`*

## 1. Contexte & objectif

La barre d'action (`src/ui/ActionBar.tsx`) s'encombre : ~5 slots permanents (Déplacer,
Attaquer, Incanter, Défensive, Fin) + jusqu'à ~13 slots situationnels (Charger, Courir,
Se relever, Piétiner, Frénésie, Se désengager, Détermination, Ramasser, Utiliser, Viser,
Recharger, Munition). On veut :

1. **Ajouter l'action Guérison** (compétence du même nom) — soigner les Blessures et arrêter
   les hémorragies, en combat **et** hors combat.
2. **Désencombrer l'ActionBar** dans la foulée (un seul lot / une seule spec).

Contraintes projet : aucune invention de règles (tout cité depuis `Source/`), moteur
(`src/engine`) pur et testé, UI en français qui scale, invariant « un jet = une modale ».

## 2. Règles canon (citées — rien d'inventé)

Source : `Source/Warhammer v4 - Livre de base version corrigée/09 - Compétences.md`,
`16 - États.md`, `18 - Traumatisme.md`. Reflété dans `src/data/skills.json` (Guérison, p.123)
et `src/data/etats.json` (Hémorragique).

- **Guérison est une Compétence AVANCÉE (Int)** — `LDB 09-Compétences l.51, l.226` ; l'exemple
  Adhémar (`l.31`) : sans Augmentation on « n'a aucune idée de la façon de soigner ».
  ⇒ **action réservée aux combattants possédant *Guérison* dans `c.skills`.**
- Un Test réussi fait **l'une** des choses suivantes (`LDB 09-Compétences l.226-243`) :
  - **Soigner les Blessures** : rend **Bonus d'Intelligence + DR** PB. *Remarque : « un patient
    ne peut bénéficier que d'un jet de Guérison après chaque rencontre »* (`l.233`).
  - **Arrêter l'Hémorragie** : retire un État *Hémorragique*, **+1 par DR** (`l.235` ;
    `16-États l.107`). Quand **tous** les États Hémorragique sont retirés → la cible gagne
    *Exténué* (`16-États l.109`).
- **En combat, le Test est Intermédiaire (+0)** (`l.243`).
- **Échec** : si **BI + DR < 0**, le patient *perd* `|BI + DR|` PB (`l.237`).
- **Échec Stupéfiant** → Infection Mineure (`l.237`) — **hors scope** (aucun système de
  maladie/infection dans le moteur ; on ne l'invente pas, cf. §8).
- Hors-combat / récupération naturelle (contexte, non re-modélisé ici) : repos = 1 Test de
  Résistance Accessible/jour, DR+BE (`18-Traumatisme l.380`) ; pour soigner plus, il faut la
  compétence Guérison ou des bandages (`l.382`).

L'État **Hémorragique est déjà pleinement modélisé** : `etats.json:67`, dégâts périodiques +
mort par saignement (`engine/conditions.ts l.96-100, l.155-166`), généré par les tables de
critiques (`data/criticals.ts`), persistant (`PERSISTENT_CONDITIONS`).

## 3. Mécanique Guérison — en combat

Coûte l'**Action** (comme Attaquer/Incanter ; bloquée si `Sonné` / `battle.acted`).

**Cibles** : le soigneur (debout, non Sonné) peut cibler **lui-même ou un allié adjacent**
(portée 1, distance de Chebyshev ≤ 1). Les alliés **Inconscients / À Terre sont des cibles
valides** — c'est l'usage tactique central (1 PB rendu lève l'inconscience, `18-Trauma l.28`).
Une cible est « soignable » si elle est blessée (`wounds.current < wounds.max`) **ou** porte
≥1 État Hémorragique.

**Flux** (réutilise l'idiome `ab-spells` + `pendingTest`) :

1. `battleSelectAction('heal')` → sous-panneau listant les cibles valides (soi + alliés
   adjacents soignables), chacune avec son état (PB, pions Hémorragique).
2. Choix de la cible → si la cible est **à la fois** blessée *et* hémorragique, proposer le
   **mode** (« Soigner les Blessures » / « Arrêter l'Hémorragie ») ; sinon le seul applicable.
   - *Soigner les Blessures* est **désactivé** si la cible a déjà `soinRencontreUtilise`
     (déjà bénéficié d'un soin cette rencontre) — *Arrêter l'Hémorragie* reste dispo.
3. **Modale de jet** `pendingTest` : Test de **Guérison Intermédiaire (+0)**, valeur via
   `testValue(soigneur, 'Guérison')`. Chance/Détermination possibles (invariant modale).
4. **Résolution** (utilise `sl` = DR exposé par la modale) :
   - *Soigner les Blessures* — succès : `applyHeal(cible, biBonus + dr)`, plafonné à
     `wounds.max` ; pose `cible.soinRencontreUtilise = true`. Échec : si `biBonus + dr < 0`,
     `applyDamage(cible, |biBonus + dr|)` (peut ré-infliger États si 0 PB — réutiliser le
     pipeline de dégâts existant). Lève l'Inconscient/À Terre selon les règles existantes
     quand `wounds.current` repasse > 0.
   - *Arrêter l'Hémorragie* — succès : retire `1 + dr` États Hémorragique (`removeCondition`) ;
     si plus aucun Hémorragique → ajoute *Exténué*. Pas de limite par rencontre. **Échec : aucun
     pion retiré, aucun dégât** — la pénalité « BI + DR < 0 → Blessures » est, dans le canon,
     attachée au seul usage *Soigner les Blessures* (`LDB 09-Compétences l.237`), pas à l'arrêt
     d'hémorragie.

## 4. Mécanique Guérison — hors combat

Même moteur, même modale, même limite par rencontre. Entrée : bouton **« Soigner »** sur la
fiche d'un héros (`CharacterSheet.tsx`) blessé ou hémorragique, **soigné par le meilleur
*Guérison* du groupe** (`partyBest(party, 'Guérison')`). Difficulté par défaut **+0**
(Intermédiaire) — le canon laisse le MJ moduler, ici pas de MJ donc +0 fidèle au cas combat.
Le mode (Blessures / Hémorragie) suit la même logique qu'en combat.

> Placement exact du bouton à confirmer au plan (CharacterSheet le plus naturel : il affiche
> déjà les PB). Pas de nouveau panneau « utiliser une compétence libre » — scope contenu.

## 5. Limite « 1 soin / patient / rencontre »

Nouveau champ optionnel `Combatant.soinRencontreUtilise?: boolean` (porte **uniquement** sur
*Soigner les Blessures*) :

- passe à `true` quand un soin de Blessures **réussi et bénéfique** est appliqué (on consomme
  le « bénéfice », pas la simple tentative ratée — fidèle à « ne peut bénéficier que d'un
  jet ») ;
- **remis à `false` au début de chaque combat** (`startCombat`) — soit « après chaque
  rencontre » ;
- doit être réinitialisé par le **pattern reset nouvelle-partie zéro-maintenance**
  (`getInitialState`) comme les autres champs d'état ;
- *Arrêter l'Hémorragie* l'ignore (urgence vitale, pas de limite canon).

## 6. Architecture

Respecte la règle #3 (moteur pur ; store/UI en dépendent).

### 6.1 Moteur — `src/engine/healing.ts` (pur, testé)
- `healableTargets(actor, party, opts) → Combatant[]` : soi + alliés adjacents soignables
  (blessés ou hémorragiques). (En combat : adjacence ; hors combat : tout le groupe.)
- `healWoundsOutcome(intBonus, dr, success) → { woundsDelta }` : succès ⇒ `+ (intBonus+dr)`
  (plancher 0) ; échec ⇒ `intBonus+dr < 0 ? (intBonus+dr) : 0`.
- `stopBleedOutcome(dr, stacks, success) → { removed, gainExtenue }` : succès ⇒
  `removed = min(stacks, 1+dr)`, `gainExtenue = removed === stacks`.
- `healMode(target) → 'wounds' | 'bleed' | 'both' | null` : modes disponibles selon l'état.

Le module ne dépend que de `types`/`characteristics`/`conditions` (déjà purs).

### 6.2 State — `src/state/store.ts` (+ `combatFlow.ts`)
- `battleSelectAction('heal')` : nouveau mode d'action ; sous-panneau cibles dans l'ActionBar.
- `battleHeal(targetId, mode)` : prépare le `pendingTest` Guérison +0 (cible + mode mémorisés).
- Résolution du `pendingTest` Guérison : applique l'outcome (réutilise `applyHeal`/pipeline de
  dégâts/`removeCondition` existants), journalise, pose le flag, met fin à l'Action.
- `healAlly(targetId, mode)` : variante hors-combat (healer = `partyBest`).
- `startCombat` : reset `soinRencontreUtilise` sur tous les combattants.

### 6.3 UI — `src/ui/ActionBar.tsx` + `CharacterSheet.tsx`
Voir §7 pour la nouvelle structure de barre. Sous-panneau cibles = idiome `ab-spells`.

## 7. Désencombrement de l'ActionBar

**Principe** (issu du retour utilisateur) : les **primaires** restent des slots directs ; les
**variantes découvertes par intention** sont repliées en sous-panneaux (idiome `ab-spells`,
n'apparaissent que si ≥1 enfant est disponible) ; les **alertes orphelines** (ni mouvement ni
action, surgissent et faciles à rater) **restent visibles**.

```
Directs (chaque slot si applicable) :
  🦶 Déplacer   ⚔️ Attaquer   ✨ Incanter   🩹 Soigner   🛡️ Défensive
  + contextuels rares (apparaissent seulement si dispo) : 🐗 Frénésie · 🐾 Piétiner

Catégories repliées (sous-panneau au clic, masquées si vides) :
  🏃 Mouvement ▾   →  Charger · Courir · Se relever · Se désengager
  🏹 Tir ▾         →  Viser · Recharger · Munition
  🧪 Objets ▾      →  Utiliser · Ramasser

Alerte orpheline — VISIBLE & surlignée (hors catégorie) :
  ✊ Détermination (N)

  ⏭️ Fin du tour
```

- **Déplacer / Attaquer restent directs** (chaque tour, zéro clic en plus). Déplacer convertit
  déjà en Désengagement quand Engagé (logique existante conservée) ; *Se désengager* est aussi
  listé explicitement dans **Mouvement** (« je veux bouger » → j'ouvre Mouvement → je vois que
  je dois me dégager — l'exemple utilisateur).
- **Détermination = seule alerte surlignée**, hors catégorie : elle retire des États qui
  *viennent d'apparaître*, à ne pas rater (retour utilisateur explicite) et peut sauver la vie.
- **Piétiner / Frénésie = simples slots contextuels** (pas d'alerte) : *Piétiner* est une
  action gratuite du sous-système Taille (`LDB 85 l.320-321`), qui n'apparaît pour un héros
  qu'avec ≥1 Avantage face à un adversaire adjacent plus petit — très rare, et gratuite donc
  sans enjeu si manquée ; *Frénésie* est un choix délibéré rare. Ils s'affichent quand
  disponibles, sans surbrillance.
- **Soigner** est un slot direct visible quand le héros a la compétence ET qu'une cible est
  soignable — important, donc pas enterré.
- Réduction : Mouvement (≤4→1), Tir (≤3→1), Objets (≤2→1).

Implémentation : nouveaux modes conteneurs (`battle.action` = `'mvt' | 'tir' | 'objets' |
'heal'`) ouvrant un sous-panneau ; les actions-feuilles réutilisent les handlers existants
(`battleRun`, `battleStandUp`, `disengage`, `aim`, `reload`, `selectAmmo`, `useItem`, `pickup`,
`selectAction('charge')`). Aucune logique de règle dupliquée.

## 8. Hors scope (signalé, non inventé)

- **Infection Mineure sur Échec Stupéfiant** : aucun système de maladie/infection — non
  modélisé (à reprendre si un sous-système Maladies arrive).
- **Diagnostiquer / Traiter une maladie**, **Chirurgie** (talent), **bandages/cataplasmes**
  (objets `trappings`) : autres usages de Guérison, hors de ce lot.
- **Guérir les Blessures Critiques** (états/modificateurs des tables de critiques) :
  inchangé ; Guérison ici ne touche que PB et États Hémorragique.

## 9. Tests (Vitest, moteur)

- `healing.test.ts` : `healWoundsOutcome` (succès BI+DR, plafond max, échec BI+DR<0 → dégâts,
  échec BI+DR≥0 → rien) ; `stopBleedOutcome` (1+DR retirés, plancher/plafond stacks, Exténué
  quand tout retiré) ; `healableTargets` (adjacence, soi, blessé/hémorragique, inconscient OK).
- `store.test.ts` : flux combat (sélection cible → modale → application + flag) ; limite 1/
  rencontre (2e Soigner Blessures bloqué, Arrêter Hémorragie non) ; reset au `startCombat` ;
  soigner un allié Inconscient le relève ; garde-fou « un jet = une modale » couvre `heal`.
- Garde-fou reset nouvelle-partie : `soinRencontreUtilise` repart de `getInitialState`.

## 10. Points à confirmer au plan (implémentation)

- Câblage exact du `pendingTest` pour transporter `{targetId, mode}` jusqu'à la résolution et
  lire `sl`/`success` (vérifier la forme de `PendingTest` dans `store.ts`).
- Réutilisation du pipeline de dégâts existant pour l'échec BI+DR<0 (ré-infliger États à 0 PB).
- Emplacement du bouton hors-combat (`CharacterSheet` recommandé).
- Icônes finales (🩹 Soigner ; 🐾 Piétiner pour ne pas dupliquer 🦶).
