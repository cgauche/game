# F1 — Ennemis humanoïdes via le rig — Design

**Statut :** auto-approuvé (session autonome, l'utilisateur a délégué les décisions le 2026-06-05).

**Goal du brin :** rendre les ennemis humanoïdes via le rig squelettique (au lieu du sprite
monolithique `enemySprite`) pour qu'ils héritent : (1) de l'**arme équipée visible**, (2) du
**facing 8 directions**, (3) de la base pour les animations par-arme (G) et par-sort (H).

## Contexte (constaté)

- `IsoStage.tsx` : héros → `<AnimatedRigToken combatant={c}/>` ; ennemis → `enemySprite(c.name)`
  (monolithique). Donc un ennemi n'affiche pas son arme équipée, pas de facing, pas d'anim.
- `Combatant` ennemi (cf. `spawn.ts`) : `{ kind:'enemy', name:<label bestiaire>, weapons:[…],
  armour: ArmourPoints }`. **Pas** de `species`/`career`/`items`/`appearance`.
- `AnimatedRigToken` lit `combatant.appearance ?? defaultAppearance(c)`, `equipFromCombatant(c)`,
  `combatant.career`. Réagit au bus (ANIM_ATTACK/MOVE/IMPACT) par `combatant.id`.
- Bestiaire : 57 labels. Humanoïdes peau-humaine : Humain/Nain/Halfling/Elfe/Ogre (espèces joueur),
  Cultiste, Mutant, Guerrier du Chaos, Bella la Noire, Pol Dankels. Le reste (Orc/Gobelin/Snotling,
  Skavens « Guerrier des clans / Vermine de choc / Rat ogre », hommes-bêtes Gor/Ungor/Minotaure/
  Chamane-Brey, morts-vivants, bêtes, démons) = sprite dédié conservé.

## Décisions

1. **L'engine `Combatant` reste pur.** On ne pollue pas le combattant avec des champs cosmétiques.
   La dérivation vit dans la couche rendu (`src/gameIso/rig/enemyProfile.ts`), fonction PURE et testée.
2. **Classifieur cosmétique** (≠ règle) `classifyEnemy(name): 'rig' | 'creature'` :
   - `rig` si le nom matche un humanoïde à peau humaine dont l'équipement varie.
   - `creature` sinon (peaux-vertes, skavens, hommes-bêtes, morts-vivants, bêtes, démons) → leur
     sprite dédié reste (bon art, arme déjà dessinée) ; leur facing 8-dir est traité par **F2**.
   - Patterns `rig` (nom normalisé sans accents) :
     `bandit|brigand|pillard|racaille|spadassin|sbire|homme de main|deserteur|deserteur` ·
     `soldat|garde|milicien|mercenaire|sergent|capitaine|guerrier(?! du chaos)?` ·
     `cultiste|sectateur|fanatique|adepte` · `flagellant|zelote|zealot|penitent` ·
     `sorcier|magister|necromancien|hierophante` · `repurgateur|chasseur de sorcier` ·
     `noble|courtisan|aristocrate` · `pretre|prelat|nonne|sceur|moine` · `voleur|coupe-jarret|larron` ·
     `batelier|marin` · `mendiant|gueux|paysan|rustre` · `mutant` · `guerrier du chaos|champion du chaos` ·
     espèces joueur `humain|nain|halfling|elfe|ogre|gnome` · nommés `bella la noire|pol dankels`.
3. **Dérivation `enemyRigProfile(c): EnemyRigProfile | null`** (null ⇒ garder `enemySprite`) :
   - `species` : détecté du nom (nain→Nain, elfe→Haut-Elfe, halfling→Halfling, ogre→Ogre) sinon Humain.
   - `sex` : `M`/`F` pseudo-aléatoire par `hashSeed(id)` (variété ; majorité M biaisée).
   - `build` : `0.35..0.75` dérivé du seed.
   - `career` : nom → libellé de carrière existant (`Voleur`/`Garde`/`Flagellant`/`Sorcier`/`Noble`/
     `Répurgateur`/`Mendiant`/`Nonne`…) ; `careerTenueFor` résout (tenue générée sinon archétype de classe).
   - `equip: EquipCtx` : `weapons` = `c.weapons` ; `armour` = `synthArmourItems(c.armour, material)`
     (1 `ItemInstance` par localisation à PA>0, matériau inféré par `armourMaterial` via le palier de PA) ;
     `shield` détecté si une arme/qualité « bouclier ».
   - `overlays?: RigOverlay[]` : pour Mutant / Guerrier du Chaos, 1-2 excroissances cosmétiques
     (corne sur `tete`, griffe sur `mainD`, œil sur `torse`) choisies par seed + teinte de peau.
4. **`RigSprite` gagne une prop `overlays?: {bone: BoneId; svg: string}[]`** rendue par-dessus les
   parts (calque mutation, réutilisable plus tard). Sans `overlays` ⇒ aucun changement (héros intacts).
5. **`AnimatedRigToken` gagne une prop optionnelle `profile?: EnemyRigProfile`.** Si fournie (ennemi),
   utilise `profile.appearance/career/equip/overlays` ; sinon chemin héros inchangé
   (`combatant.appearance ?? defaultAppearance`). Les abonnements bus (attaque/déplacement/coup)
   restent indexés par `combatant.id` ⇒ les ennemis riggés s'animent aussi.
6. **`IsoStage`** : pour un ennemi, `const prof = enemyRigProfile(c)` ; `prof` ⇒
   `tokenNode(... <AnimatedRigToken combatant={c} profile={prof}/>)` ; sinon `enemySprite` (inchangé).

## Unités & interfaces

```ts
// src/gameIso/rig/enemyProfile.ts
export interface RigOverlay { bone: BoneId; svg: string }
export interface EnemyRigProfile {
  appearance: Appearance;
  career: string;
  equip: EquipCtx;
  overlays?: RigOverlay[];
}
export function classifyEnemy(name: string): 'rig' | 'creature';
export function enemyRigProfile(c: Combatant): EnemyRigProfile | null;
```

- **Quoi** : transforme un combattant ennemi en entrées de rig cosmétiques (ou null).
- **Usage** : `IsoStage` (choix sprite vs rig) ; `AnimatedRigToken` (props).
- **Dépend de** : `Appearance`, `EquipCtx`, `armourMaterial`, `hashSeed`, `careers.json` (via careerTenueFor indirect). PURE (pas d'effets).

## Tests (TDD)

`src/gameIso/rig/enemyProfile.test.ts` :
- `classifyEnemy` : 'Bandit'→rig, 'Cultiste'→rig, 'Mutant'→rig, 'Soldat'→rig, 'Guerrier du Chaos'→rig,
  'Rat géant'→creature, 'Orc'→creature, 'Squelette'→creature, 'Zombie'→creature, 'Skaven/Guerrier des clans'→creature.
- `enemyRigProfile` : null pour 'Rat géant' ; non-null pour 'Bandit' avec `equip.weapons` repris du combattant.
- déterminisme : même `id` ⇒ même `appearance` (seed stable).
- armure : un ennemi avec `armour.corps=4` ⇒ `equip.armour` contient un item torse matériau 'plaque'.
- mutation : 'Mutant' ⇒ `overlays?.length ≥ 1`.
- rendu headless : `RigSprite` avec `overlays` produit un markup contenant le svg d'overlay (smoke).

## Hors scope (F1)

- Têtes/peaux non-humaines (Orc vert, Skaven) : restent en sprite (F2 pour le facing).
- Art back/profile des nouvelles parts ennemies : hérite de E·7 (fallback front en attendant).
- Anims spécifiques par-arme / par-sort : brins G / H.
