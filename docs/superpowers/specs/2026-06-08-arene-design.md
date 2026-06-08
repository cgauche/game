# Arène (#3) — Design

**But** : banc d'essai de tout ce qu'on a construit. Une scène d'**arène** enchaîne des **vagues
croissantes** ; entre les vagues, un **maître d'arène** (= marchand) permet d'acheter/vendre/réparer/se
soigner avec le butin, puis de lancer la vague suivante. Rejoue combat + Taille + Psychologie + monture
+ marchand + temps.

## Décisions (validées utilisateur 2026-06-08)
- **Maître d'arène explicite** : entre chaque vague, on parle à un PNJ « maître d'arène » → sa boutique
  (marchander/réparer/soigner) puis un choix **« Vague suivante »** relance le combat.
- **Blessures persistantes** : les Blessures RESTENT entre les vagues (attrition = le cœur du défi, RAW).
  Récup via l'**action Guérison** (1/rencontre → re-dispo à chaque vague) + potions/herbes **achetées au
  maître**. Pas de soin automatique.

## Principe — **100 % DONNÉES, zéro mécanique dédiée**
*(Pivot après revue : la 1ʳᵉ version ajoutait `Scene.arena` + Effets `arenaNextWave`/`arenaWaveCleared`
+ état store `arena`. **Abandonné** — l'éditeur a déjà tout ce qu'il faut. On compose à partir des
briques existantes.)*

- **Vagues** = des **`encounters`** de la scène (ennemis du bestiaire) ; le **butin** (`giveMoney`/
  `giveXp`/`giveTrapping`) **et un flag de progression** (`setFlag arene_vN`) sont posés dans leur
  **`onVictory`** (déjà supporté — les effets de victoire tournent dans `checkBattleOver`).
- **Maître d'arène** = une `SceneEntity` `personnage` avec **`dialogueId`** ET **`merchant`** (archétype).
  On réutilise le marchand (#2) ; `interactEntity` priorise le dialogue, dont un choix **« Marchander »**
  fait `openMerchant` (Effet existant #2).
- **Séquençage des vagues** = **choix de dialogue gated par flags COMPOSÉS** : « Lancer la vague 2 » a
  pour condition `arene_v1,!arene_v2` (ET). Chaque choix fait `startCombat 'wave-N'` (Effet existant).

## Seule généralisation (générale, pas arène-spécifique)
Les conditions de flag (triggers ET choix de dialogue) ne supportaient qu'**un** flag. Généralisé à
**plusieurs en ET** (« v1,!v2 ») dans **`condMet`** — et au passage **dé-dupliqué** : `condMet` était
copié dans `combatFlow.ts` ET `DialogueBox.tsx` → désormais **source unique exportée par `scene.ts`**
(là où `Trigger.condition`/`DialogueChoice.condition` sont définis), importée par les deux.

## Flux
1. Parler au maître → dialogue. « Lancer la vague 1 » (`!arene_v1`) → `startCombat 'wave-1'`.
2. Victoire → `onVictory` : butin crédité + `setFlag arene_v1`. Bouton **« Continuer »** (BattlePanel) →
   retour exploration dans l'arène.
3. Re-parler au maître : marchander/soigner, puis « Lancer la vague 2 » (`arene_v1,!arene_v2`)… jusqu'à
   la finale → `arene_v3` → choix « Savourer ta victoire » (arène vaincue).
4. **Défaite** (groupe à terre) : « Reprendre » → exploration ; le flag de la vague échouée n'est PAS
   posé → le choix de cette vague reste dispo → **retry naturel**.

## MVP livré
Scénario de test **« 🏟️ Arène »** (`src/scenes/test-scenarios/12-arene.ts`) : `makePregens().slice(0,4)`
+ scène arène + **3 vagues croissantes** (Rat géant/Gobelin → Loup/Orc → Ogre/Gobelin, `findCreature`
par `label`) + maître d'arène (armurier) + butin (or+PX) par vague + trigger bourse de départ.
Test d'intégration `12-arene.test.ts` : prouve que les flags séquencent correctement les vagues.

## Hors RAW (assumé)
Le concept **vagues/butin/arène** n'est pas RAW (banc d'essai) — contenu **paramétrable** (données de
scène, éditables). Tout le **dedans** reste RAW : combat (LDB 13/14), Taille (85), Psychologie (21),
Disponibilité (59), Marchandage (60). Pas de loot-table inventée : le butin est authored par vague.
