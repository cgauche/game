# Spec — Facing directionnel (sous-projet E)

*Date : 2026-06-05 · Projet : RPG WFRP4 web (`Foundry/Game`) · Branche : `feat/wfrp4-rpg-foundation`*

## 1. Contexte & objectif

Le sous-projet C a livré un facing par **miroir horizontal** (le sprite se retourne G/D selon la
direction). Constat à l'usage : le rig est dessiné **de face**, donc le miroir ne change quasi
rien visuellement (seul le côté de l'arme bascule) — il ne « tourne » pas. (La logique du miroir
fonctionne et est conservée ; c'est l'art mono-vue qui limite.)

**Objectif (E) :** un vrai facing **8 directions** pour les **héros riggés**, en s'appuyant sur
**3 vues d'art** — `front` (existante), `back` (dos, nouvelle), `profile` (profil, nouvelle) — et
le **miroir** G/D. Les 8 directions iso se rabattent sur la vue la plus proche : déplacements/
attaques vers le bas-écran → `front`, vers le haut → `back`, latéraux → `profile` ; `mirror`
selon gauche/droite. Le personnage **reste tourné** entre deux actions.

Acquis réutilisés : rig (`composeRig`, parts par slot), parts générées (têtes, tenues de carrière,
armures, armes), moteur d'anim (`useRigClip`, clips), et le wrapper miroir d'`AnimatedRigToken`.

## 2. Décision de socle

**Une « vue » = une pose de base + un jeu de variantes de parts.** Ce n'est pas qu'un échange de
parts : le `profile` demande aussi une **pose de base** distincte (jambes/bras alignés en
profondeur, corps de côté) ; `front` et `back` partagent ~la même stance (seules les parts
diffèrent : visage vs arrière de tête). Le **miroir** (scale(-1,1) autour de x=60) couvre la
moitié gauche/droite.

**Approche de livraison : tranche verticale d'abord.** Le gros coût est l'art (back + profil pour
TOUTES les parts). On construit donc d'abord le **système 8-dir complet** + **un seul archétype
arté** (front/back/profil), on valide en jeu qu'il tourne correctement en marchant/attaquant,
PUIS on génère l'art de masse par workflows. Évite d'investir l'art à l'aveugle.

## 3. Modèle de facing

```ts
// src/gameIso/rig/facing.ts (PUR)
export type View = 'front' | 'back' | 'profile';

/** Direction écran (dx,dy en pixels iso) → vue + miroir. PUR.
 *  Latéral net → profile ; vers le bas → front ; vers le haut → back ; mirror = regarde à gauche. */
export function facingView(dx: number, dy: number): { view: View; mirror: boolean } {
  const ax = Math.abs(dx), ay = Math.abs(dy);
  const view: View = ax > ay * 1.5 ? 'profile' : dy >= 0 ? 'front' : 'back';
  return { view, mirror: dx < 0 };
}

/** Vecteur direction ÉCRAN entre deux tuiles (iso : screenX ∝ x−y, screenY ∝ x+y). */
export function screenDir(from: { x: number; y: number }, to: { x: number; y: number }) {
  return { dx: to.x - to.y - (from.x - from.y), dy: to.x + to.y - (from.x + from.y) };
}
```

## 4. Vue = pose de base + variantes de parts

- **Poses de base par vue** : `VIEW_POSE: Record<View, Pose>` — `front`/`back` = repos (`{}`),
  `profile` = stance de profil (épaules/hanches resserrées, un bras/jambe en avant). Composée
  **additivement** avec la pose d'animation courante (les poses sont déjà des deltas, cf. C).
- **Parts par vue** : chaque part résolue gagne une dimension de vue. Le résolveur renvoie le SVG
  de la vue demandée, avec **fallback `front`** si `back`/`profile` n'existe pas encore (le rig
  rend donc toujours quelque chose, même avant la génération d'art).
  - Concrètement, les maps générées gagnent des variantes par vue (ex. `GENERATED_HEADS[key]` →
    `{ visage: {front, back?, profile?}, cheveux: {…} }`), idem tenues/armures/armes. Tant que
    `back`/`profile` sont absents → `front`. L'ingestion (`_ingest-rig-art.mjs`) écrit les vues.

## 5. Rendu — `view` ajouté à `resolveRig`/`RigSprite`

```ts
resolveRig(appearance, equip, pose, career?, view: View = 'front'): ResolvedBone[]
RigSprite({ appearance, equip, pose?, career?, view? })
```
- `resolveRig` compose `VIEW_POSE[view]` avec `pose` (somme des deltas), et sélectionne la
  variante de part par `view` (fallback `front`).
- Le **miroir** reste le wrapper `scale(-1,1)` d'`AnimatedRigToken` (inchangé).
- Donc : face/dos/profil ⇐ (pose de vue + parts) ; gauche/droite ⇐ miroir.

## 6. Câblage (AnimatedRigToken)

- État `facing: { view: View; mirror: boolean }` (persistant ; défaut `front`, non miroité).
- `ANIM_MOVE {id, path}` → `facingView(screenDir(path[0], path[last]))` → met à jour `facing`.
- `ANIM_ATTACK from===me` → `facingView(screenDir(myPos, targetPos))` → met à jour `facing`.
- Rendu : `<g transform={facing.mirror ? 'translate(120,0) scale(-1,1)' : undefined}><RigSprite … view={facing.view} /></g>`.
- La vue persiste tant qu'aucune nouvelle action ne la change.

## 7. Génération d'art (workflows)

1. **Slice (manuel/1 agent)** : art `back` + `profile` pour **un archétype** (Soldat humain :
   tête, tenue, arme) → branché dans le modèle de parts → **recette navigateur** : le perso
   tourne en marchant dans les 8 directions, 0 erreur.
2. **Masse (workflows, après validation du slice)** : générer `back` + `profile` pour le reste
   (têtes espèce×sexe, 64 tenues de carrière, armures matériau×emplacement, familles d'armes),
   **inférés des illustrations de face** du Livre de base, par lots best-of-2, ingérés dans les
   maps par vue. Réutilise `PART-CONTRACT.md` (étendu avec les conventions back/profil).

## 8. Périmètre — ce que E fait / ne fait PAS

**Dans E** : facing 8 directions des **héros riggés** (3 vues + miroir), `facing.ts`, `VIEW_POSE`,
`view` dans `composeRig`, parts par vue + fallback, câblage `AnimatedRigToken`, slice arté + art
de masse.

**Hors E** :
- **Créatures monolithiques** : gardent le **miroir simple** de C (pas d'art par-direction du
  bestiaire — démesuré).
- Pas de changement des règles ni du moteur de combat.
- Pas de rotation 3D réelle (snap des 8 directions sur 3 vues + miroir).

## 9. Tests & recette

- `facing.test.ts` (PUR) : `facingView` (bas→front, haut→back, latéral→profile ; `mirror` selon
  le signe de dx ; bandes/seuils) ; `screenDir` (deltas iso corrects).
- `composeRig` : `view='profile'` change la pose de base et sélectionne la variante profil quand
  elle existe ; **fallback `front`** quand `back`/`profile` absents (jamais vide).
- `npm run typecheck` + `npm test` verts.
- Recette navigateur (slice) : déplacer un héros dans les 8 directions → vérifier face (bas),
  dos (haut), profil (côtés), miroir G/D ; attaquer dans une direction → orientation vers la
  cible ; 0 erreur console ; screenshots des 8 orientations.

## 10. Fichiers ajoutés / modifiés

**Ajoutés :**
- `src/gameIso/rig/facing.ts` (`View`, `facingView`, `screenDir`) + `facing.test.ts`.
- `src/gameIso/rig/viewPose.ts` (`VIEW_POSE`).
- Parts `back`/`profile` du slice (archétype Soldat humain).

**Modifiés :**
- `src/gameIso/rig/composeRig.tsx` — `resolveRig`/`RigSprite` prennent `view` (pose de vue +
  variantes de parts, fallback front).
- `src/gameIso/rig/parts/*` (resolve/cosmetic/career/equipment) + `generated/*` — dimension de
  vue (fallback front) ; `_ingest-rig-art.mjs` écrit les vues.
- `src/gameIso/AnimatedRigToken.tsx` — état `facing`, calcul depuis move/attack, passe `view`.
- `src/gameIso/rig/PART-CONTRACT.md` — conventions back/profil.

## 11. Risques & mitigations

| Risque | Mitigation |
|---|---|
| Volume d'art (×2 vues pour toutes les parts) | Slice d'abord (1 archétype) pour valider ; fallback `front` partout → jamais cassé ; workflows best-of-2 par lots |
| Vues dos/profil inférées d'un réf de face (fidélité) | Contrat de part étendu (silhouettes claires) ; QC galerie 8-dir ; re-run best-of-2 sur les faibles |
| Profil = pose de base différente (chevauchement membres) | `VIEW_POSE.profile` réglé à la recette ; tests sur la composition de pose, pas les pixels |
| Snap 8→3 vues parfois ambigu (diagonales) | Seuil `profile` (ax > 1.5·ay) réglable ; la persistance évite le papillotement |
| Couplage parts↔vue casse l'existant | Fallback `front` = comportement actuel tant que back/profile vides ; tests de non-régression |

## 12. Ce que E débloque

- Facing lisible (le perso regarde où il va / qui il vise), prérequis ressenti d'un RPG tactique
  iso type NWN/BG.
- Les vues back/profile servent aussi aux futures animations orientées (C+) et aux postures (D).
