# Gabarits corporels — généraliser le rig (bipède / quadrupède / ailé) — Design

**Statut :** approuvé par l'utilisateur (2026-06-05). Le gabarit quadrupède a été **prouvé** par un
proto headless (`scripts/_qc-quad-proto.mts` → `public/qc/quad-proto.png`) avant rédaction.

**Goal :** pouvoir **ajouter facilement n'importe quel monstre, de toute taille**, en réutilisant
UNE machinerie de rig pour plusieurs plans corporels — humanoïdes (nain/humain/mutant/skaven…),
4-pattes (cheval/loup/sanglier/rat…), ailés (griffon/pégase/hippogriffe, et le dragon = ailé géant).
Chacun avec recolor cohérent, vrai facing 8-dir, pose de mort et animations (démarche/attaque)
**propres au plan** (« pas les mêmes animations que les 2 jambes »).

## Contexte (constaté)

- Le rig (`src/gameIso/rig/`) est entièrement paramétrique SAUF la liste d'os, figée au bipède :
  `bones.ts::BONE_IDS` + `skeletons.ts` (gabarit humain, table `PROPS` d'échelles par espèce).
- La machinerie autour est DÉJÀ générique et réutilisable : FK (`kinematics.worldTransformsG`,
  généralisée 2026-06-05), palette tokenisée (`palette.ts` : `buildTokenMap`/`applyTokenMap`,
  tokens `corps`/`accent` ajoutés), facing (`facing.ts`), pose de mort, recolor.
- `enemyProfile.ts::classifyEnemy` + `CREATURE_RE` route skaven/orc/gobelin/homme-bête/mort-vivant
  **vers le sprite monolithique** (`creatureView`, blob SVG sur dégradés partagés `url(#g_mut)`…,
  NON recoloriable) — alors que ce sont des bipèdes. Le monolithique n'a ni recolor, ni facing
  paramétrique, ni ajout facile.
- 57 sprites monolithiques (`creatureSprites.json`) + 47 vues 8-dir (`creatureViews.json`).

## Décisions

1. **Abstraction « gabarit corporel » (`BodyPlan`).** Un plan = squelette (os + proportions par
   espèce) + pose de repos + clips d'anim propres (démarche/attaque/mort) + modèle de facing +
   slots de parts. La machinerie (FK, palette, facing, rendu) NE dépend PAS du plan.
2. **Le bipède reste canonique et intact.** On NE réécrit PAS `composeRig` (rig héros qui marche).
   On l'enveloppe : `bipedPlan` délègue à l'existant. Zéro régression héros. Le quadrupède et
   l'ailé sont des plans FRÈRES qui réutilisent les primitives génériques (FK/palette/facing).
3. **Dispatch par plan dans le rendu.** `IsoStage` choisit le plan d'une entité/combattant via un
   classifieur cosmétique étendu (`bodyPlanOf(name): 'biped' | 'quadruped' | 'winged' | 'monolithic'`).
   `monolithic` = repli legacy tant qu'aucun plan ne couvre la bête (exotiques).
4. **Le monolithique devient un legacy qui RÉTRÉCIT** phase par phase. Une entrée de
   `creatureSprites.json` couverte par un plan est retirée (supprimée, pas vidée). Restent à terme
   seulement les exotiques sans plan (araignée 8-pattes, serpent, hydre, pieuvre) — décision finale
   en Phase D (plan dédié ou recolor par dégradé tokenisé, cf. proto abandonné).
5. **L'éditeur doit savoir tout faire** (règle utilisateur) : ajouter un monstre = choisir un plan
   + une espèce + taille + parts + couleurs + arme, sans code. Étend `MonsterPartsFields`.
6. **Aucune invention de règles.** 100 % cosmétique : l'engine (`Combatant`) reste pur, jamais
   pollué de champs de rendu. Les silhouettes s'appuient sur l'art officiel (`art-ref/`, sprites
   existants) — barre qualité : silhouette reconnaissable d'abord (cf. mémoire QC).
7. **Mandat qualité (utilisateur 2026-06-05) :** corriger TOUS les défauts, quitte à refaire/affiner
   TOUS les modèles. → une Phase D transverse passe la pipeline QC reconnaissabilité sur l'ensemble
   des modèles riggés (héros + monstres bipèdes + quadrupèdes + ailés) et corrige tout.

## Unités & interfaces (cibles)

```ts
// src/gameIso/rig/bodyPlan.ts  (NOUVEAU — registre)
export type BodyPlanId = 'biped' | 'quadruped' | 'winged';
export interface BodyPlan {
  id: BodyPlanId;
  /** SVG (string, boîte 120×150, pieds au sol) d'une espèce dans une vue + pose + couleurs. */
  compose(species: string, view: View, pose: Record<string, number>, colors?: Palette, opts?: ComposeOpts): string;
  speciesNames(): string[];
  restPose(): Record<string, number>;
  walkPose(phase: number): Record<string, number>;
  attackPose(phase: number): Record<string, number>;
  deathPose(): Record<string, number>;
  /** vrai si l'espèce a une vue dédiée (sinon repli front). */
  hasView(species: string, view: View): boolean;
}
export function bodyPlanOf(name: string): BodyPlanId | 'monolithic';
export function planById(id: BodyPlanId): BodyPlan;
```

- **Quoi** : indirige le rendu d'une créature vers son plan corporel.
- **Usage** : `IsoStage` (dispatch), éditeur (sélecteurs), QC (planches).
- **Dépend de** : FK générique, palette, facing. PURE.

Le `quadrupedPlan` est l'industrialisation du proto `quadruped/quadruped.ts`. Le `bipedPlan` enveloppe
`composeRig`/`RigSprite` (rendu existant). Le `wingedPlan` (Phase C) compose un squelette à ailes.

## Phases (roadmap — chaque phase = son propre plan détaillé au moment de l'exécuter)

### Phase A — Fondation gabarits + quadrupède PRODUCTION  *(plan détaillé écrit en parallèle)*
- A1. `bodyPlan.ts` : registre + `bodyPlanOf` + `planById` (+ tests). Biped wrappé, quad branché.
- A2. Industrialiser le quad : `quadruped/{quadSkeleton,quadParts,quadPose,composeQuad}.ts` (split du proto),
      genoux pliés à la démarche, silhouettes affinées.
- A3. **Vrai art face/dos** du quadrupède (poitrail + tête de face ; croupe + queue de dos) → 8-dir réel
      (remplace le squish horizontal du proto). Paramétrique par `PROPS` ; QC aveugle de reconnaissance.
- A4. Espèces quadrupèdes de base : cheval, loup, chien, sanglier, rat géant, ours, charognard (chien-loup).
- A5. Câblage `IsoStage` : combat + exploration passent par `bodyPlanOf`/`planById` ; pose de mort quad ;
      anim attaque (morsure/charge) via le bus (ANIM_ATTACK/IMPACT) ; facing 8-dir + miroir.
- A6. Reroute : sortir cheval/loup/chien/sanglier/rat(animal)/ours/charognard de `CREATURE_RE` → 'quadruped'.
- A7. Éditeur : `MonsterPartsFields` expose plan='quadruped' → sélecteur d'espèce quad + taille + couleurs.
- A8. Retrait legacy : supprimer les entrées `creatureSprites.json`/`creatureViews.json` désormais couvertes.

### Phase B — Bipèdes monstrueux (P1)  *(plan dédié)*
- B1. Espèces bipèdes monstrueuses dans `skeletons.ts::PROPS` + `baseSpeciesOf` : Skaven (voûté),
      Orc (massif), Gobelin (petit), Homme-bête (jambes chèvre), Troll (très grand), + sizing Ogre/Vampire.
- B2. Têtes neuves `monstrous.ts` : museau de rat (skaven), gueule à défenses verte (orc/gob), tête
      caprine/bélière (homme-bête), crâne (mort-vivant). Vues front/back/profile (8-dir).
- B3. Palettes espèces : peau verte (orc/gob), pelage gris-brun (skaven), chair pourrie / os (mort-vivant).
- B4. Reroute `classifyEnemy`/`detectSpecies` : skaven/orc/gobelin/snotling/gor/ungor/minotaure/
      squelette/zombie/goule/vampire/troll/démon humanoïde → 'biped' (+ espèce/parts/queue auto).
- B5. Éditeur : exposer les espèces monstrueuses bipèdes + queue/cornes/défenses.
- B6. Retrait legacy correspondant.

### Phase C — Ailés (P3)  *(plan dédié)*
- C1. `winged/` : squelette ailes (épaule d'aile + membrane/plumes) sur base quad ou biped ; anims
      battement/vol/piqué/planer ; pose au sol (ailes repliées).
- C2. Espèces : griffon, démigriffon, hippogriffe, pégase, manticore, **dragon (ailé géant** — `PROPS` sl↑).
- C3. Câblage IsoStage (altitude/ombre portée pour le vol), reroute, éditeur, retrait legacy.

### Phase D — Passe qualité « tous les modèles » + fin du legacy  *(plan dédié)*
- D1. Lancer la pipeline QC reconnaissabilité (`scripts/qc/`, `docs/qc-reconnaissabilite-sprites.md`)
      sur TOUS les modèles riggés (héros, bipèdes monstrueux, quadrupèdes, ailés) : rendu PNG → agents
      aveugles → catalogue de défauts → correction → re-vérification, round par round (mandat utilisateur).
- D2. Décider du sort des exotiques restants (araignée 8-pattes, serpent, hydre, pieuvre, crapaud,
      sangsue) : plan corporel dédié OU monolithique conservé + recolor par dégradé tokenisé par instance
      (le proto abandonné `recolorCreature` peut être ressuscité ici si on garde le monolithique).
- D3. Suppression finale des entrées legacy couvertes ; `creatureSprites.json` ne contient plus que
      les exotiques explicitement laissés en monolithique.

## Tests (TDD, transverses)

- `bodyPlan.test.ts` : `bodyPlanOf` classe correctement (cheval→quadruped, skaven→biped après B,
  araignée→monolithic) ; `planById('quadruped').compose('Cheval','profile',{})` rend un markup non vide
  contenant les pieds au sol ; `walkPose(0.25) ≠ restPose()` (la démarche bouge).
- Quad : `composeQuad` déterministe ; recolor (`colors.corps`) change le markup ; `groundQuad` ancre
  le pied le plus bas à y=150 quelle que soit l'espèce.
- Non-régression bipède : snapshots/markup `composeRig` héros INCHANGÉS après l'enveloppe `bipedPlan`.
- Rendus headless de preuve par phase (planches `public/qc/`), JAMAIS via navigateur.

## Hors scope / risques

- **Vrai 8-dir quadrupède = le vrai coût restant** (art face/dos authoré, pas un squish). Risque levé
  côté squelette/démarche (proto), reste l'art — paramétrique donc mutualisé sur cheval/loup/sanglier.
- Pas d'anim réseau/coop ici (le RNG seedable est déjà prêt, hors sujet).
- L'engine de règles n'est jamais touché (rendu cosmétique pur).
- Commits : uniquement mes fichiers (l'autre session partage le working tree) ; trailer
  `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>` ; jamais déployer test rouge.
```
