# Scénarios de test

Le menu **« 🧪 Tests — scénarios »** (écran `'test'`) liste des scénarios de vérification : chacun
fixe un **groupe** et une **scène adaptée** à ce qu'on veut tester, avec combat direct (`autoCombat`)
quand c'est utile.

## Vérifier une feature au navigateur

1. Lance `npm run dev`, ouvre le menu → **Tests — scénarios**.
2. **Passe par le scénario adapté.** S'il n'en existe pas pour ce que tu vérifies, **crée-en un**.

## Ajouter un scénario = un fichier

Dépose un fichier `src/scenes/test-scenarios/<NN>-<slug>.ts` exportant `scenario` :

```ts
import { arena } from './_shared';
import type { TestScenario } from './_shared';
// (+ createHero / makePregens / itemFromTrapping selon le groupe voulu)

const scene = arena({ id: 'test-xxx', nom: '…', heroStart: { x: 2, y: 4 } });
scene.encounters = [{ id: 'enc-xxx', enemies: [{ ref: 'Gobelin', pos: { x: 9, y: 4 } }] }];

export const scenario: TestScenario = {
  id: 'xxx', order: 7, icon: '🧪', title: '…',
  tests: 'ce que ça vérifie', partyNote: 'le groupe',
  makeParty: () => [/* … */], scene, autoCombat: 'enc-xxx',
};
```

`index.ts` le ramasse via `import.meta.glob` (tri par `order`) — **aucun import manuel**. Les
`*.test.ts` et les fichiers `_*` sont exclus du glob.

## Conventions

- **Équipement à la main** : `createHero(...)` puis réassigner `items` (`itemFromTrapping` +
  `recomputeLoadout`). Ex. arbalétrier = Arbalète + Carreaux équipés (`recomputeLoadout` dérive
  `reload`/`subType`).
- **Ennemis** : vraies créatures du bestiaire via `ref` (`creatures.json`, LDB/ADE) ; fixture
  (`statblock` inline) seulement quand aucun équivalent canon n'existe (ex. le **mannequin** passif
  `M 0`, beaucoup de Blessures).
- Le moteur reste couvert par Vitest ; les scénarios sont des fixtures de vérif manuelle/visuelle.

## Catalogue actuel

| Scénario | Vérifie |
|---|---|
| 🏹 Tir & Rechargement | tir + munition + modale de rechargement (Test étendu de Projectiles) |
| 🩸 L'Embuscade | exploration → dialogue → combat (5 mutants, ch.2) |
| 💀 Critiques & Mort | overkill/double → Critique ; 0 PB → À Terre → Inconscient → mort |
| 🍀 Destin / Résilience | coup létal → sauvetage par le Destin ; réussite garantie |
| ⚔️ Engagé / Charge / Désengagement | charge, Engagement, désengagement |
| ✨ Magie | incantation (NI/DR/Maladresse), Focalisation, Bénédictions |
| 🖼️ Galerie de modèles | tous les modèles : 58 créatures + **toutes les carrières** + **toutes les armes** + mutants (énumérés depuis la data), **exploration sans combat** |
