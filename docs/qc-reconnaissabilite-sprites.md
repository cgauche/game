# QC sprites — audit de reconnaissabilité (runbook)

> **Barème** : chaque élément (arme, monstre, tête, tenue…) doit se **reconnaître au
> premier coup d'œil, sans connaître son nom**. Reconnaître ≠ parfait — c'est le socle ;
> le vernis esthétique est une passe ultérieure.

Méthode **headless** (pas besoin de naviguer le jeu) : on rend chaque élément en PNG, des
**agents aveugles** devinent ce que c'est, on corrige ce qui n'est pas reconnu, on re-vérifie.
Rasterisation SVG→PNG via `@resvg/resvg-js` (déjà installé) ; inspection directe par `Read`.

## Pipeline en 5 étapes

### 1. Rendre les éléments en PNG
```bash
npx tsx scripts/_qc-render.mts        # → public/qc/w*.png (armes) + c*.png (créatures) + manifest.json
```
Le manifest mappe `id → {kind, intended}` (gardé pour la comparaison ; jamais montré aux juges).

### 2. Audit aveugle (workflow)
```
Workflow({ scriptPath: "scripts/qc/qc-recognizability.workflow.js" })
```
2 juges/élément lisent le PNG **sans le nom**, devinent + notent 1–5. Sortie : `fails` (avg<3 ou
hypothèse fausse) + `ranking` complet. *(Nécessite l'opt-in workflow ; voir Workflow tool.)*

### 3. Interpréter — écarter les FAUX problèmes
Le total brut de « douteux » trompe. Avant de corriger, retirer :
- **Créatures rendues par le rig** (F1) : Humain, Nain, Halfling, Elfe, Ogre, Bella, Pol, Cultiste,
  Mutant, Guerrier du Chaos → leur sprite monolithique est **du code mort**, l'audit le note mais
  le jeu affiche le rig. Ne PAS perdre de temps dessus.
- **Bonnes lectures ratées par le matcher** (orthographe/synonyme/langue) : ex. hippogriffe vs
  « hyppogriffe », orque vs orc, homme-bête, fantôme… → lire le `guess` réel, pas le flag `match`.
- **PNJ nommés** (Bella la Noire, Pol Dankels…) : se lisent comme leur archétype, c'est normal.

### 4. Corriger
- **Armes** (peu nombreuses, dessinées à la main) → `src/gameIso/rig/parts/equipment.ts`, map
  `WEAPONS`. Convention : **manche relié à la tête, d'un seul tenant** ; tête/lame vers `-y` (en
  jeu l'os `arme` est tourné ~165° → l'arme pend, poignée dans la main). Réutiliser les gradients
  `DEFS` (g_steel, g_axe, g_glow…), pas de `<defs>` inventés. Les familles générées (poudre/fronde/
  fouet/explosif) sont surchargeables APRÈS `Object.assign(WEAPONS, GENERATED_WEAPONS)`.
- **Créatures** → workflow `scripts/qc/creatures-redo.workflow.js`. Éditer le tableau `C` :
  `[label, "lecture erronée actuelle", "cible WFRP fidèle (silhouette-first)"]`. Le workflow
  redessine front+dos+profil (best-of-2) et un **juge aveugle** valide la reconnaissabilité avant
  d'accepter. Sort dans `art-ref/directional/creatures-redo/<slug>/chosen.json` (gitignoré).

### 5. Ingérer + re-vérifier
```bash
node scripts/_ingest-creatures-redo.mjs     # chosen.json → creatureSprites.json (front) + creatureViews.json (dos/profil)
npx tsx scripts/_qc-montage-creatures.mts    # → public/qc/creatures-redo-montage.png (relecture à l'œil)
npx tsx scripts/_qc-montage.mts              # → public/qc/weapons-montage.png (13 armes)
```
Puis **re-lancer l'étape 2** sur les éléments corrigés pour confirmer qu'ils passent. Commiter
`creatureSprites.json` / `creatureViews.json` / `equipment.ts` (l'art `art-ref/` reste gitignoré).

## Scripts
| Script | Rôle |
|---|---|
| `scripts/_qc-render.mts` | rend chaque arme (silhouette seule) + créature (front) en PNG + manifest |
| `scripts/_qc-montage.mts` | planche des 13 armes |
| `scripts/_qc-montage-creatures.mts` | planche des créatures redessinées |
| `scripts/qc/qc-recognizability.workflow.js` | audit aveugle (Workflow) |
| `scripts/qc/creatures-redo.workflow.js` | régénération créatures + juge aveugle (Workflow) |
| `scripts/_ingest-creatures-redo.mjs` | ingère front+dos/profil des créatures redessinées |
| `scripts/_ingest-creature-views.mjs` | ingère les vues dos/profil (F2) |

## Conventions & pièges
- **Le rig est un pantin 2D de face** (rotations dans le plan, pas de profondeur) : voir
  `src/gameIso/rig/PART-CONTRACT.md`. `torse+` bascule LATÉRALEMENT — pas d'accroupi réel.
- **Anti-blob** : silhouette reconnaissable d'abord ; `g_mut` (vert mutant) réservé orcs/gobs/
  bestiaux/Chaos, sinon ça lit « blob vert » (cf. Troll). Réutiliser des anchors connus.
- **Headless QC** : `@resvg/resvg-js` rastérise sans navigateur ; un agent peut `Read` le PNG et
  juger. Plus fiable que piloter le jeu.

## Étendre (passes futures)
- **Têtes / tenues / carrières** : même pipeline — rendre par espèce/carrière, audit aveugle
  « devine l'espèce / le métier », corriger. Têtes : `_ingest-hero-head-views.mjs` ; tenues :
  `_ingest-hero-tenue-views.mjs`.
- Régler le **vernis** des éléments « reconnus mais perfectibles » (Troll trop trapu, Géant ≈ ogre,
  obscurs Jabberslythe/Squig…) une fois le socle de reconnaissabilité validé.
