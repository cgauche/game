# Spec — Animations d'action de combat (sous-projet C)

*Date : 2026-06-04 · Projet : RPG WFRP4 web (`Foundry/Game`) · Branche : `feat/wfrp4-rpg-foundation`*

## 1. Contexte & objectif

Le sous-projet A a livré le **rig squelettique** : chaque héros est rendu par `RigSprite`
qui émet un `<g data-bone>` par os, et le type `Pose = Partial<Record<BoneId, number>>`
(angles d'os) est déjà la cible d'animation prévue. Le moteur de combat émet déjà des
**signaux** sur le bus (`src/state/bus.ts`) :

- `ANIM_ATTACK {from, to, result}` — mêlée/distance (`store.ts:538`, via `doAttack`) et
  sort (`store.ts:618`, via `castSpell`). `result` porte `hit`, `woundsLost`, `critical`, etc.
- `ANIM_MOVE {id, path}` — déplacement (`store.ts:345`, `:803`).
- Le mode de défense (`esquive`/`parade`) est calculé (`bestDefenseMode`, `store.ts:518`)
  mais **pas transmis** dans l'événement.

Aujourd'hui le seul retour visuel de combat est le **dégât flottant** (`IsoStage.tsx`,
abonné à `ANIM_ATTACK`) et un translate CSS du token. Pas d'animation d'action.

**Objectif (C) :** animer les actions de combat en interpolant les angles d'os du rig dans
le temps — fente mêlée, tir à distance, canalisation de sort (attaquant) ; esquive, parade,
prise de coup (cible) ; projectile volant ; marche le long du chemin ; chute à 0 PV. Les
créatures monolithiques (bestiaire) reçoivent une anim légère de token entier.

## 2. Décision de socle

**Moteur de tween `requestAnimationFrame` maison** (validé) : un clip = une séquence de
keyframes de `Pose` ; le moteur interpole les angles d'os frame par frame (easing), pilote
`RigSprite`. Aucune dépendance externe (le projet reste React/SVG pur). C'est exactement
l'usage prévu par le rig (interpoler `Pose`).

Alternatives écartées : *transitions CSS* (séquençage windup→strike→retour lourd, easing
limité) ; *framer-motion* (dépendance externe non désirée).

**Principe directeur :** les animations sont **cosmétiques et non bloquantes**. Le moteur de
jeu a déjà muté l'état avant d'émettre l'événement (comme les dégâts flottants actuels) ;
les anims sont des *réactions* aux événements du bus, elles ne gâtent pas le tour par tour.

## 3. Architecture

```
src/gameIso/rig/anim/
  tween.ts        // PUR : easings + lerpPose(from, to, t) → Pose interpolée
  clips.ts        // PUR : poses nommées + Clip[] (séquences) + registre par action
  useRigClip.ts   // hook React : Pose animée (état) + boucle rAF + file de clips
src/gameIso/AnimatedRigToken.tsx   // <RigSprite pose={animée}/> + abonnement bus (1 par combattant)
src/gameIso/Projectile.tsx         // (ou interne IsoStage) overlay projectile volant transient
```

```ts
// tween.ts
export type Easing = 'linear' | 'easeOut' | 'easeInOut' | 'easeOutBack';
export function ease(e: Easing, t: number): number;          // t∈[0,1] → [0,1] (back peut dépasser)
export function lerpPose(from: Pose, to: Pose, t: number): Pose; // interpole chaque os présent dans from∪to

// clips.ts
export interface ClipStep { pose: Pose; ms: number; easing?: Easing; }
export interface Clip { steps: ClipStep[]; onImpact?: number; loop?: boolean; }
export const CLIPS: Record<ClipName, Clip>; // melee, ranged, cast, dodge, parry, hit, fall, walk, idle
export type ClipName = 'melee' | 'ranged' | 'cast' | 'dodge' | 'parry' | 'hit' | 'fall' | 'walk' | 'idle';

// useRigClip.ts
export function useRigClip(): {
  pose: Pose;                       // pose courante (à passer à RigSprite)
  play(name: ClipName, opts?: { onImpact?: () => void; onDone?: () => void }): void;
  hold(name: ClipName): void;       // pose tenue (ex. 'fall') sans retour idle
};
```

- `useRigClip` détient la **Pose animée** dans un `useState`/`ref`, lance une boucle rAF
  qui avance le temps, interpole entre keyframes (`lerpPose` + `ease`), appelle `onImpact`
  au temps `clip.onImpact`, et à la fin revient à `idle` (boucle) — sauf `hold` (tient la pose).
- **Déterminisme** : `tween`/`clips` sont purs (mêmes entrées → même sortie), testables sans
  DOM. Seul le hook touche rAF/DOM (validé au navigateur).
- **Extraction** : le token héros aujourd'hui inline dans `IsoStage` (`tokenNode` + `<RigSprite>`)
  devient `<AnimatedRigToken combatant={c} active={…} ring={…} />` — réduit le monolithe
  `IsoStage`, isole l'animation par combattant.

## 4. Bibliothèque de poses & clips (§C.2)

Poses nommées (jeux d'angles d'os relatifs au repos) et clips, **réglés au navigateur** :

| Clip | Rôle | Forme |
|---|---|---|
| `idle` | respiration subtile (le « bob » perdu au passage au rig) | boucle, faible amplitude torse/tête |
| `walk` | marche pendant `ANIM_MOVE` | boucle, jambes/bras alternés |
| `melee` | fente mêlée | windup (bras arrière) → strike (bras avant) → retour ; `onImpact` ~60 % |
| `ranged` | tir | bande (bras tendu) → relâche ; `onImpact` au relâche |
| `cast` | canalisation de sort | bras levés, légère montée ; `onImpact` au pic |
| `dodge` | esquive | bascule latérale rapide + retour |
| `parry` | parade | arme levée en garde + petit recul |
| `hit` | prise de coup | recul buste + flexion, retour |
| `fall` | chute à 0 PV | bascule vers une pose au sol (tenue par `hold`) |

> Les valeurs d'angles sont **ajustées à la recette navigateur** ; les tests vérifient des
> **propriétés** (déterminisme, durées, `onImpact ≤ durée totale`), pas des angles pixel-précis.

## 5. Câblage des événements + enrichissement minimal

`AnimatedRigToken` s'abonne au bus pour SON combattant :

- `ANIM_ATTACK {from, to, result, kind, defense}` :
  - si `from === c.id` → l'attaquant joue `CLIPS[kind]` (`melee`/`ranged`/`cast`) ;
  - si `to === c.id` → la cible joue `hit` (si `result.hit`) sinon `dodge`/`parry` selon `defense` ;
  - le **dégât flottant** (déjà dans `IsoStage`) se déclenche désormais sur l'`onImpact` du
    clip de l'attaquant (et non instantanément) — déplacement de la logique de float vers
    le timing d'impact.
- `ANIM_MOVE {id, path}` : si `id === c.id` → `walk` en boucle pendant le déplacement,
  arrêt (`idle`) à la fin du chemin.
- Chute : quand `isOutOfAction(c)` devient vrai (déduit de l'état après `ANIM_ATTACK`/
  `SCENE_DIRTY`), jouer `fall` une fois puis `hold('fall')`.

**Enrichissement minimal du store** (PAS de changement de règles — uniquement le payload) :
`store.ts` ajoute `kind` et `defense` au `bus.emit(EVT.ANIM_ATTACK, …)` :
- `doAttack` : `kind = weapon.type === 'ranged' ? 'ranged' : 'melee'`, `defense = bestDefenseMode(target)` (déjà calculé localement).
- `castSpell` : `kind = 'spell'`, `defense = 'none'`.
Le type d'événement (`EVT` / payload) est documenté dans `bus.ts`.

## 6. Projectiles + timing d'impact (§C.4)

- Pour `kind ∈ {ranged, spell}` : un **projectile** (flèche/carreau/trait magique) vole de
  `from` vers `to` — overlay transient dans `IsoStage` (même mécanique que les dégâts
  flottants : état React `projectiles[]`, position interpolée, auto-nettoyage). L'`onImpact`
  coïncide avec l'arrivée du projectile.
- Pour la mêlée : `onImpact` à ~60 % du clip `melee` déclenche recul de la cible + float.

## 7. Créatures monolithiques (§C.5)

Les héros sont riggés (anim par os via `useRigClip`). Les **créatures** (sprites
monolithiques `enemySprite`) ne peuvent pas être animées par os → elles reçoivent une **anim
légère de token entier** : une classe/transform CSS appliquée au `<g>` du token (fente vers
la cible à l'attaque, recul/secousse à la prise de coup, fondu+chute à 0 PV), pilotée par les
**mêmes** événements du bus. Pas de rig du bestiaire (hors périmètre).

## 8. Périmètre — ce que C fait / ne fait PAS

**Dans C** : clips d'action (attaquant/cible) + projectiles + marche + chute + idle ; anim
légère des créatures ; enrichissement du payload `ANIM_ATTACK` ; extraction d'`AnimatedRigToken`.

**Hors C** :
- **Postures d'état tenues = sous-projet D** : « à terre » couché durable, « sonné »,
  « inconscient », auras de condition. C joue la *transition* (`fall`) ; D mappe les
  `Combatant.conditions` vers des poses tenues + FX.
- Pas de modification des règles de combat ni du tour par tour (anims non bloquantes).
- Pas de rig des créatures (anim légère de token seulement).

## 9. Tests & recette

- `src/gameIso/rig/anim/tween.test.ts` : `ease` (bornes 0→0, 1→1, monotonie sauf back),
  `lerpPose` (t=0 → from, t=1 → to, interpolation d'un angle au milieu, os absents gérés).
- `src/gameIso/rig/anim/clips.test.ts` : chaque `ClipName` existe ; `onImpact ≤ Σ ms` ;
  `loop` cohérent (idle/walk en boucle, action non) ; déterminisme.
- `npm run typecheck` + `npm test` verts.
- Recette navigateur (Playwright) : « 🧪 Test rapide » → lancer une attaque mêlée, une à
  distance, un sort → vérifier fente / projectile / canalisation, recul de la cible **au bon
  timing**, esquive/parade sur un raté, chute à la mort ; **0 erreur console** ; screenshots.

## 10. Fichiers ajoutés / modifiés

**Ajoutés :**
- `src/gameIso/rig/anim/tween.ts`, `clips.ts`, `useRigClip.ts` (+ `tween.test.ts`, `clips.test.ts`).
- `src/gameIso/AnimatedRigToken.tsx`.
- (projectile : composant dédié ou état interne `IsoStage`).

**Modifiés :**
- `src/state/bus.ts` — documente le payload enrichi `ANIM_ATTACK`.
- `src/state/store.ts` — `kind` + `defense` dans les 2 `bus.emit(EVT.ANIM_ATTACK)` (doAttack, castSpell).
- `src/gameIso/IsoStage.tsx` — héros via `<AnimatedRigToken>` ; float déclenché sur `onImpact` ;
  projectiles ; anim légère des tokens créatures.

## 11. Risques & mitigations

| Risque | Mitigation |
|---|---|
| Désync anim ↔ état (l'état change avant la fin de l'anim) | Anims cosmétiques non bloquantes ; `onImpact` synchronise float/recul ; l'état reste la source de vérité |
| Perf (rAF par combattant) | 1 boucle rAF mutualisée possible ; clips courts ; idle à faible fréquence ; mesurer à la recette |
| Réglage des angles long | Poses tunées au navigateur ; tests sur propriétés, pas pixels ; itérer clip par clip |
| `IsoStage` déjà monolithe | L'extraction d'`AnimatedRigToken` le réduit (amélioration ciblée, pas refonte) |
| Créatures non riggées | Anim légère de token (transform CSS) — cohérente via le même bus |

## 12. Ce que C débloque / prépare

- **D (postures)** : `fall`/`hold` + le hook `useRigClip` fournissent le mécanisme de pose
  tenue ; D ajoute les poses d'état (`prone`, `stunned`…) mappées depuis `Combatant.conditions`
  (nécessitera un `EVT.CONDITION_CHANGED` ou une lecture sur `SCENE_DIRTY`).
