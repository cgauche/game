# Modèles d'armes 1-par-1 (52) + QC aveugle + vérif sur modèle — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Donner à chacune des 52 armes de la donnée une silhouette propre, fidèle et reconnaissable (au lieu de ~13 formes partagées), via un workflow d'art multi-agent best-of-N + juge aveugle, validée par un audit aveugle PNG (silhouette isolée) ET un audit sur modèle (rig tenant l'arme).

**Architecture:** Une source de vérité `weaponForms.ts` (48 armes-arts + 3 boucliers) pilote le routage `equipment.ts` (forme par libellé), des scripts de rendu data-driven, et — via `args` — deux workflows : génération+juge (`weapons-redo`) et audit qualité+sur-modèle (`weapons-qc`). L'art généré est ingéré dans `generated/weaponsArmour.ts`. L'animation reste pilotée par le *groupe* canonique (inchangée) ; seule la *forme* change.

**Tech Stack:** TypeScript, React (SVG iso), `@resvg/resvg-js` (raster headless), Vitest, tsx, Workflow tool (agents Opus/Sonnet).

**Spec:** `docs/superpowers/specs/2026-06-06-modeles-armes-52-design.md`

---

## File Structure

| Fichier | Responsabilité |
|---|---|
| `src/gameIso/rig/parts/weaponForms.ts` *(neuf)* | SOURCE DE VÉRITÉ : `WEAPON_FORMS` (48) + `SHIELD_FORMS` (3) + `norm`, `formSlug`. |
| `src/gameIso/rig/parts/weaponForms.test.ts` *(neuf)* | Complétude vs `trappings` + routage `weaponFamily` → slug. |
| `src/gameIso/rig/parts/equipment.ts` *(modif)* | `ART_BY_LABEL` dérivé de `WEAPON_FORMS` + `SYNONYMS` ; `shieldPart` 3 variantes. |
| `src/gameIso/rig/parts/generated/weaponsArmour.ts` *(régénéré)* | `GENERATED_WEAPONS` (48 arts) ; `GENERATED_ARMOUR` préservé. |
| `scripts/_qc-render-weapon-cand.mts` *(neuf)* | Rend UN cand JSON `{front}` → PNG (frame os `arme`). Helper agent. |
| `scripts/_qc-render-weapons.mts` *(neuf)* | Rend les 51 (48 armes + 3 boucliers) en silhouette isolée → `public/qc/w-*.png` + manifest. |
| `scripts/_qc-weapons-held.mts` *(réécrit)* | Rig tenant chaque arme/bouclier (51) → `public/qc/held-*.png` + montage. |
| `scripts/_ingest-weapons-redo.mts` *(neuf)* | `chosen.json` → fusionne dans `GENERATED_WEAPONS` (préserve `GENERATED_ARMOUR`). |
| `scripts/qc/weapons-redo.workflow.js` *(neuf)* | Génération (N artistes) + juge aveugle. Lit `args`. |
| `scripts/qc/weapons-qc.workflow.js` *(neuf)* | Audit qualité (isolé) + sur-modèle. Lit `args`. |

**Conventions clés à respecter (rappel) :**
- Os `arme` : origine (0,0) = poignée, lame/tête vers **−y**, étendue `x ±15, y −50..+10`, échelle uniforme. (`PART-CONTRACT.md`)
- Gradients partagés (`DEFS`) : `g_steel, g_steelD, g_axe, g_glow, g_eye, g_flesh, g_blood, g_cloak, g_coat, g_crest`. Aucun `<defs>` inventé.
- Frame de rendu isolé (identique à l'audit existant) : `viewBox="-20 -56 40 72"`.
- Workflow scripts = JS pur, **pas d'import / pas de fs** ; ils reçoivent la work-list via `args`. Les **agents** spawné par le workflow ont, eux, Read/Write/Bash.

---

## Task 1: Source de vérité `weaponForms.ts` + test de complétude

**Files:**
- Create: `src/gameIso/rig/parts/weaponForms.ts`
- Test: `src/gameIso/rig/parts/weaponForms.test.ts`

- [ ] **Step 1: Écrire le test de complétude (échoue)**

`src/gameIso/rig/parts/weaponForms.test.ts` :
```ts
import { describe, it, expect } from 'vitest';
import { WEAPON_FORMS, SHIELD_FORMS, norm } from './weaponForms';
import { trappings } from '../../../data';

const isShieldName = (l: string) => /bouclier/i.test(l);

describe('weaponForms — contrat des 52 armes', () => {
  it('couvre toutes les armes melee/ranged de la donnée', () => {
    const known = new Set<string>([
      ...WEAPON_FORMS.map((f) => norm(f.label)),
      ...SHIELD_FORMS.map((s) => norm(s.label)),
      norm('Mains nues'),
    ]);
    const missing = (trappings as { label: string; type: string }[])
      .filter((t) => (t.type === 'melee' || t.type === 'ranged') && !known.has(norm(t.label)))
      .map((t) => t.label);
    expect(missing).toEqual([]);
  });

  it('slugs uniques et non vides', () => {
    const slugs = WEAPON_FORMS.map((f) => f.slug);
    expect(slugs.every((s) => /^[a-z0-9_]+$/.test(s))).toBe(true);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it('48 armes-arts + 3 boucliers', () => {
    expect(WEAPON_FORMS).toHaveLength(48);
    expect(SHIELD_FORMS).toHaveLength(3);
  });
});
```

- [ ] **Step 2: Lancer le test → échoue (module absent)**

Run: `npm test -- weaponForms`
Expected: FAIL (`Cannot find module './weaponForms'`).

- [ ] **Step 3: Créer `weaponForms.ts`**

`src/gameIso/rig/parts/weaponForms.ts` :
```ts
/**
 * SOURCE DE VÉRITÉ des FORMES d'arme : 1 silhouette par arme de la donnée (52).
 * `slug` = clé d'art dans le registre WEAPONS (equipment.ts). `target` = cible
 * silhouette-first (FR) consommée par les workflows d'art via `args`. L'ANIMATION
 * reste pilotée par le groupe canonique (weaponGroup.ts) — ceci ne touche QUE la forme.
 */
export interface WeaponForm { label: string; slug: string; type: 'melee' | 'ranged'; group: string; target: string; }
export interface ShieldForm { label: string; slug: string; target: string; }

export const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();

export const WEAPON_FORMS: WeaponForm[] = [
  { label: 'Bâton de combat', slug: 'baton', type: 'melee', group: "Armes d'hast", target: 'long bâton/quarterstaff en bois, deux bouts' },
  { label: 'Hallebarde', slug: 'hallebarde', type: 'melee', group: "Armes d'hast", target: 'hampe + tête combinée : large fer de hache + pointe + croc' },
  { label: 'Lance', slug: 'lance', type: 'melee', group: "Armes d'hast", target: 'hampe + fer de lance foliacé' },
  { label: 'Pique', slug: 'pique', type: 'melee', group: "Armes d'hast", target: 'hampe TRÈS longue, petite pointe d’infanterie' },
  { label: 'Coup-de-poing', slug: 'poing', type: 'melee', group: 'Bagarre', target: 'coup-de-poing/cestes sur le poing fermé' },
  { label: 'Arme improvisée', slug: 'improvisee', type: 'melee', group: 'Base', target: 'objet de fortune (planche/tabouret/bouteille cassée)' },
  { label: 'Arme simple', slug: 'gourdin', type: 'melee', group: 'Base', target: 'gourdin/trique de bois simple' },
  { label: 'Couteau', slug: 'couteau', type: 'melee', group: 'Base', target: 'couteau à lame courte, rustique, sans vraie garde' },
  { label: 'Dague', slug: 'dague', type: 'melee', group: 'Base', target: 'dague à garde croisée' },
  { label: 'Lance de cavalerie', slug: 'lance_cavalerie', type: 'melee', group: 'Cavalerie', target: 'longue lance de charge, parfois fanion' },
  { label: 'Marteau à bec-de-corbin', slug: 'bec_de_corbin', type: 'melee', group: 'Cavalerie', target: 'bec-de-corbin : pic recourbé + contre-marteau sur manche' },
  { label: 'Épée bâtarde', slug: 'epee_batarde', type: 'melee', group: 'Deux-mains', target: 'épée longue à une main et demie, longue poignée' },
  { label: 'Grande hache', slug: 'grande_hache', type: 'melee', group: 'Deux-mains', target: 'grande hache à deux mains, fer large' },
  { label: 'Marteau de guerre', slug: 'marteau_guerre', type: 'melee', group: 'Deux-mains', target: 'marteau de guerre 2 mains : tête massive + pic au dos' },
  { label: 'Pioche à deux mains', slug: 'pioche_2m', type: 'melee', group: 'Deux-mains', target: 'pic/pioche de guerre à deux mains, longue pointe courbe' },
  { label: 'Zweihänder', slug: 'zweihander', type: 'melee', group: 'Deux-mains', target: 'espadon géant, très longue lame, parierhaken (ergots)' },
  { label: 'Fleuret', slug: 'fleuret', type: 'melee', group: 'Escrime', target: 'lame très fine et droite, garde simple en croix' },
  { label: 'Rapière', slug: 'rapiere', type: 'melee', group: 'Escrime', target: 'rapière à garde en coquille/panier ouvragé, lame fine' },
  { label: 'Fléau', slug: 'fleau', type: 'melee', group: 'Fléau', target: 'manche + chaîne courte + tête/boule au bout' },
  { label: 'Fléau à grain', slug: 'fleau_grain', type: 'melee', group: 'Fléau', target: 'fléau agricole : battant de bois relié au manche par une lanière' },
  { label: "Fléau d'armes", slug: 'fleau_armes', type: 'melee', group: 'Fléau', target: 'fléau militaire : manche + chaîne + boule à pointes' },
  { label: 'Brise-épée', slug: 'brise_epee', type: 'melee', group: 'Parade', target: 'lame courte large à crans/dents (sword-breaker), forte garde' },
  { label: 'Main Gauche', slug: 'main_gauche', type: 'melee', group: 'Parade', target: 'dague de main-gauche : longs quillons droits, anneau de garde' },
  { label: 'Arbalète', slug: 'arbalete', type: 'ranged', group: 'Arbalète', target: 'arbalète : arc transversal + fût + étrier' },
  { label: 'Arbalète de poing', slug: 'arbalete_poing', type: 'ranged', group: 'Arbalète', target: 'petite arbalète tenue à une main' },
  { label: 'Arbalète lourde', slug: 'arbalete_lourde', type: 'ranged', group: 'Arbalète', target: 'grosse arbalète de siège à treuil/cranequin' },
  { label: 'Arc', slug: 'arc', type: 'ranged', group: 'Arc', target: 'arc simple en D, corde tendue' },
  { label: 'Arc court', slug: 'arc_court', type: 'ranged', group: 'Arc', target: 'arc court compact (plus petit que l’avant-bras du tireur)' },
  { label: 'Arc elfique', slug: 'arc_elfique', type: 'ranged', group: 'Arc', target: 'arc elfique gracile à double courbure, embouts ornés' },
  { label: 'Arc long', slug: 'arc_long', type: 'ranged', group: 'Arc', target: 'grand arc long (≈ hauteur de l’archer)' },
  { label: 'Fouet', slug: 'fouet', type: 'ranged', group: 'Entraves', target: 'manche court + longue lanière de cuir qui ondule' },
  { label: 'Lasso', slug: 'lasso', type: 'ranged', group: 'Entraves', target: 'grande boucle de corde ouverte (nœud coulant)' },
  { label: 'Bombe', slug: 'bombe', type: 'ranged', group: 'Explosifs', target: 'sphère noire de fonte + mèche allumée (étincelle)' },
  { label: 'Bombe incendiaire', slug: 'bombe_incendiaire', type: 'ranged', group: 'Explosifs', target: 'pot/bombe à feu, flamme et huile qui dégoulinent' },
  { label: 'Fronde', slug: 'fronde', type: 'ranged', group: 'Fronde', target: '2 lanières + poche de cuir + galet' },
  { label: 'Fustibale', slug: 'fustibale', type: 'ranged', group: 'Fronde', target: 'fronde à bâton : poche au bout d’une lanière fixée à un manche' },
  { label: 'Bolas', slug: 'bolas', type: 'ranged', group: 'Lancer', target: '3 lanières reliées, lestées de boules aux extrémités' },
  { label: 'Couteau de lancer', slug: 'couteau_lancer', type: 'ranged', group: 'Lancer', target: 'couteau de jet fin et équilibré, sans garde' },
  { label: 'Fléchette', slug: 'flechette', type: 'ranged', group: 'Lancer', target: 'dard/fléchette empennée à lancer, petite' },
  { label: 'Hache de lancer', slug: 'hache_lancer', type: 'ranged', group: 'Lancer', target: 'hachette de jet (francisque), manche court' },
  { label: 'Javelot', slug: 'javelot', type: 'ranged', group: 'Lancer', target: 'javelot : lance légère et fine de jet' },
  { label: 'Rocher', slug: 'rocher', type: 'ranged', group: 'Lancer', target: 'grosse pierre / rocher irrégulier à jeter' },
  { label: 'Arquebus à répétition', slug: 'arquebus_rep', type: 'ranged', group: 'Ingénierie', target: 'long canon + magasin/mécanisme à répétition au-dessus' },
  { label: 'Pistolet à répétition', slug: 'pistolet_rep', type: 'ranged', group: 'Ingénierie', target: 'pistolet court + barillet/magasin de répétition' },
  { label: 'Arquebuse', slug: 'arquebuse', type: 'ranged', group: 'Poudre noire', target: 'arquebuse : long canon + crosse en bois + platine à mèche' },
  { label: "Long fusil d'Hochland", slug: 'hochland', type: 'ranged', group: 'Poudre noire', target: 'très long canon de précision + lunette de visée + crosse' },
  { label: 'Pistolet', slug: 'pistolet', type: 'ranged', group: 'Poudre noire', target: 'pistolet à poudre court, crosse recourbée, chien/platine' },
  { label: 'Tromblon', slug: 'tromblon', type: 'ranged', group: 'Poudre noire', target: 'tromblon : canon court évasé en pavillon (blunderbuss)' },
];

export const SHIELD_FORMS: ShieldForm[] = [
  { label: 'Bouclier', slug: 'rond', target: 'rondache ronde à umbo central + rivets' },
  { label: 'Bouclier (Grand)', slug: 'grand', target: 'grand écu haut (kite/pavois), pointe vers le bas' },
  { label: 'Bouclier (Targe)', slug: 'targe', target: 'petite targe ronde bombée à umbo' },
];

const BY_LABEL = new Map(WEAPON_FORMS.map((f) => [norm(f.label), f.slug]));
/** slug de forme pour un libellé d'arme catalogué (sinon undefined). */
export const formSlug = (label: string): string | undefined => BY_LABEL.get(norm(label));
```

- [ ] **Step 4: Lancer le test → passe**

Run: `npm test -- weaponForms`
Expected: PASS (3 tests). Si « couvre toutes les armes » échoue, lire les `missing` affichés et corriger un libellé/slug (orthographe exacte de la donnée).

- [ ] **Step 5: Commit**

```bash
git add src/gameIso/rig/parts/weaponForms.ts src/gameIso/rig/parts/weaponForms.test.ts
git commit -m "feat(rig): weaponForms — source de vérité 1 forme par arme (48+3 boucliers)"
```

---

## Task 2: Routage `ART_BY_LABEL` dérivé + test de résolution

**Files:**
- Modify: `src/gameIso/rig/parts/equipment.ts` (bloc `ART_BY_LABEL`, fonction `weaponFamily`)
- Test: `src/gameIso/rig/parts/weaponForms.test.ts` (ajout d'un describe)

- [ ] **Step 1: Ajouter le test de résolution (échoue)**

Ajouter à `weaponForms.test.ts` :
```ts
import { weaponFamily } from './equipment';
import type { Weapon } from '../../../engine/types';
const wep = (label: string, type: 'melee' | 'ranged'): Weapon => ({ name: label, type, damage: '+4', qualities: [] } as Weapon);

describe('routage forme par libellé', () => {
  it('chaque arme catalogue résout vers son slug', () => {
    const bad = WEAPON_FORMS.filter((f) => weaponFamily(wep(f.label, f.type)) !== f.slug)
      .map((f) => `${f.label} → ${weaponFamily(wep(f.label, f.type))} (attendu ${f.slug})`);
    expect(bad).toEqual([]);
  });
  it('les arts morts sont branchés (lasso, bolas, poing)', () => {
    expect(weaponFamily(wep('Lasso', 'ranged'))).toBe('lasso');
    expect(weaponFamily(wep('Bolas', 'ranged'))).toBe('bolas');
    expect(weaponFamily(wep('Coup-de-poing', 'melee'))).toBe('poing');
  });
});
```

- [ ] **Step 2: Lancer → échoue**

Run: `npm test -- weaponForms`
Expected: FAIL (ex. `Rapière → epee (attendu rapiere)`, `Lasso → fouet (attendu lasso)`…).

- [ ] **Step 3: Remplacer le bloc `ART_BY_LABEL` + `ART_BY_GROUP` dans `equipment.ts`**

En tête de `equipment.ts`, ajouter l'import :
```ts
import { WEAPON_FORMS, norm as wnorm } from './weaponForms';
```
Remplacer le `const ART_BY_LABEL: Record<string, string> = { … };` existant par :
```ts
/**
 * FORME d'art par libellé exact. Dérivée de WEAPON_FORMS (1 forme par arme), plus des
 * SYNONYMES pour les libellés génériques joués hors-catalogue. Repli ART_BY_GROUP ensuite.
 */
const SYNONYMS: Record<string, string> = {
  // épée générique & variantes hors-catalogue
  epee: 'epee', 'epee courte': 'couteau', sabre: 'epee', espadon: 'zweihander',
  // contondant hors-catalogue
  masse: 'masse', massue: 'gourdin', marteau: 'masse', maillet: 'masse', canne: 'baton',
  // tranchant hors-catalogue
  hache: 'hache', 'hache de main': 'hache', hachette: 'hache', cognee: 'hache',
  poignard: 'dague', stylet: 'dague', epieu: 'lance',
  // attaques NATURELLES (traits) : aucune arme tenue — la part du corps fait foi
  'mains nues': '', poings: '', morsure: '', griffes: '', griffe: '', tentacule: '', tentacules: '',
  bec: '', dard: '', corne: '', cornes: '', queue: '', pietinement: '', crachat: '',
};
const ART_BY_LABEL: Record<string, string> = { ...SYNONYMS };
for (const f of WEAPON_FORMS) ART_BY_LABEL[wnorm(f.label)] = f.slug;
```
Garder `ART_BY_GROUP` tel quel (filet pour libellés hors-catalogue), mais mettre à jour les défauts vers des slugs réels :
```ts
const ART_BY_GROUP: Record<string, string> = {
  base: 'epee', escrime: 'rapiere', deuxmains: 'epee_batarde',
  cavalerie: 'lance_cavalerie', hast: 'lance', fleau: 'fleau', parade: 'main_gauche', bagarre: '',
  arc: 'arc', arbalete: 'arbalete', poudre: 'pistolet', ingenierie: 'pistolet_rep',
  fronde: 'fronde', lancer: 'javelot', entraves: 'fouet', explosifs: 'bombe',
};
```
`weaponFamily` reste inchangée (elle lit `ART_BY_LABEL` puis `ART_BY_GROUP`). Vérifier que la fonction utilise toujours sa normalisation locale (identique à `wnorm`).

- [ ] **Step 4: Lancer → passe**

Run: `npm test -- weaponForms`
Expected: PASS. Puis `npm run typecheck` → 0 erreur.

> NOTE : à ce stade `WEAPONS[slug]` n'existe pas encore pour les nouveaux slugs ; `weaponPart` repliera sur `WEAPONS.epee`. C'est attendu — l'art arrive en Task 9/10. Le test cible `weaponFamily` (le slug), pas l'art.

- [ ] **Step 5: Commit**

```bash
git add src/gameIso/rig/parts/equipment.ts src/gameIso/rig/parts/weaponForms.test.ts
git commit -m "feat(rig): routage forme par arme (52 libellés → slug) + branche lasso/bolas/poing"
```

---

## Task 3: `shieldPart` — 3 silhouettes de bouclier

**Files:**
- Modify: `src/gameIso/rig/parts/equipment.ts` (`shieldPart`)
- Test: `src/gameIso/rig/parts/weaponForms.test.ts`

- [ ] **Step 1: Test (échoue)**

Ajouter à `weaponForms.test.ts` :
```ts
import { shieldPart } from './equipment';
describe('boucliers', () => {
  it('3 noms → 3 silhouettes distinctes', () => {
    const r = shieldPart({ name: 'Bouclier', qualities: [] } as any);
    const g = shieldPart({ name: 'Bouclier (Grand)', qualities: [] } as any);
    const t = shieldPart({ name: 'Bouclier (Targe)', qualities: [] } as any);
    expect(typeof r === 'string' ? r : r.front).not.toBe(typeof g === 'string' ? g : g.front);
    expect(typeof g === 'string' ? g : g.front).not.toBe(typeof t === 'string' ? t : t.front);
  });
});
```

- [ ] **Step 2: Lancer → échoue**

Run: `npm test -- weaponForms`
Expected: FAIL (les 3 renvoient la même ellipse).

- [ ] **Step 3: Remplacer `shieldPart`**

Dans `equipment.ts`, remplacer la fonction `shieldPart` par :
```ts
/** Silhouette de bouclier par nom (rondache / grand écu / targe). Os `bouclier`, main G. */
const SHIELDS: Record<'rond' | 'grand' | 'targe', string> = {
  rond: `<circle cx="0" cy="6" r="13" fill="url(#g_steelD)" stroke="#3a2a18" stroke-width="1.6"/><circle cx="0" cy="6" r="13" fill="none" stroke="#6a4a2a" stroke-width="0.8"/><circle cx="0" cy="6" r="3.4" fill="#caa64a" stroke="#7a5a18" stroke-width="0.6"/><g fill="#9aa2ac"><circle cx="0" cy="-5" r="0.9"/><circle cx="0" cy="17" r="0.9"/><circle cx="-11" cy="6" r="0.9"/><circle cx="11" cy="6" r="0.9"/></g>`,
  grand: `<path d="M-11 -10 Q0 -13 11 -10 L11 8 Q11 20 0 28 Q-11 20 -11 8 Z" fill="url(#g_steelD)" stroke="#3a2a18" stroke-width="1.6"/><path d="M0 -12 L0 27" stroke="#6a4a2a" stroke-width="1.1"/><path d="M-11 1 Q0 4 11 1" fill="none" stroke="#6a4a2a" stroke-width="1.1"/><circle cx="0" cy="3" r="2.4" fill="#caa64a" stroke="#7a5a18" stroke-width="0.5"/>`,
  targe: `<circle cx="0" cy="6" r="9.5" fill="url(#g_steel)" stroke="#3a2a18" stroke-width="1.4"/><circle cx="0" cy="6" r="9.5" fill="none" stroke="#cfd8e6" stroke-width="0.5" opacity="0.7"/><circle cx="0" cy="6" r="3.2" fill="url(#g_steelD)" stroke="#2a3038" stroke-width="0.6"/>`,
};
export function shieldPart(x: Weapon | ItemInstance): PartArt {
  const n = (x.name ?? '').toLowerCase();
  const key = /grand/.test(n) ? 'grand' : /targe/.test(n) ? 'targe' : 'rond';
  return SHIELDS[key];
}
```

- [ ] **Step 4: Lancer → passe**

Run: `npm test -- weaponForms`
Expected: PASS. `npm run typecheck` → 0 erreur.

- [ ] **Step 5: Commit**

```bash
git add src/gameIso/rig/parts/equipment.ts src/gameIso/rig/parts/weaponForms.test.ts
git commit -m "feat(rig): shieldPart — rondache / grand écu / targe distincts"
```

---

## Task 4: Helper de rendu d'un candidat `_qc-render-weapon-cand.mts`

**Files:**
- Create: `scripts/_qc-render-weapon-cand.mts`

- [ ] **Step 1: Écrire le helper**

`scripts/_qc-render-weapon-cand.mts` :
```ts
/**
 * Rend UN candidat d'arme : lit un JSON {front:"<svg-fragment>"} et écrit un PNG sibling
 * (même nom, .png) dans le repère de l'os `arme` (lame vers -y), frame identique à l'audit.
 * Usage : npx tsx scripts/_qc-render-weapon-cand.mts art-ref/.../cand1.json
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { Resvg } from '@resvg/resvg-js';
import { DEFS } from '../src/gameIso/sprites';

const inPath = process.argv[2];
if (!inPath) { console.error('usage: _qc-render-weapon-cand.mts <cand.json>'); process.exit(1); }
const j = JSON.parse(readFileSync(inPath, 'utf8'));
const frag: string = j.front ?? j.svg ?? '';
const out = inPath.replace(/\.json$/, '.png');
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-20 -56 40 72"><defs>${DEFS}</defs><rect x="-20" y="-56" width="40" height="72" fill="#222831"/>${frag}</svg>`;
writeFileSync(out, new Resvg(svg, { background: '#222831', fitTo: { mode: 'width', value: 180 } }).render().asPng());
console.log(`OK → ${out}`);
```

- [ ] **Step 2: Smoke test**

```bash
mkdir -p art-ref/directional/weapons-redo/_smoke
printf '{"front":"<rect x=\"-2\" y=\"-30\" width=\"4\" height=\"34\" fill=\"url(#g_steel)\"/>"}' > art-ref/directional/weapons-redo/_smoke/cand1.json
npx tsx scripts/_qc-render-weapon-cand.mts art-ref/directional/weapons-redo/_smoke/cand1.json
```
Expected: `OK → art-ref/directional/weapons-redo/_smoke/cand1.png` et le fichier PNG existe (taille > 0). Vérifier : `ls -l art-ref/directional/weapons-redo/_smoke/cand1.png`.

- [ ] **Step 3: Commit**

```bash
git add scripts/_qc-render-weapon-cand.mts
git commit -m "feat(qc): helper render d'un candidat d'arme (cand JSON → PNG, frame os arme)"
```

---

## Task 5: Rendu isolé data-driven `_qc-render-weapons.mts` + émetteur d'`args`

**Files:**
- Create: `scripts/_qc-render-weapons.mts`
- Create: `scripts/qc/_weapon-args.mts` (émet le JSON d'`args` pour les workflows — évite `tsx -e`/`node -e`)

- [ ] **Step 1: Écrire le script**

`scripts/_qc-render-weapons.mts` :
```ts
/**
 * Rend chaque arme (48) + bouclier (3) en SILHOUETTE ISOLÉE → public/qc/w-<slug>.png
 * + public/qc/weapons-manifest.json, pour l'audit aveugle de reconnaissabilité.
 * Usage : npx tsx scripts/_qc-render-weapons.mts
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { Resvg } from '@resvg/resvg-js';
import { DEFS } from '../src/gameIso/sprites';
import { weaponPart, shieldPart } from '../src/gameIso/rig/parts/equipment';
import { pickView } from '../src/gameIso/rig/parts/types';
import { WEAPON_FORMS, SHIELD_FORMS } from '../src/gameIso/rig/parts/weaponForms';
import type { Weapon } from '../src/engine/types';

mkdirSync('public/qc', { recursive: true });
const manifest: { id: string; slug: string; label: string; kind: string; path: string }[] = [];
const raster = (frag: string, path: string) => {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-20 -56 40 72"><defs>${DEFS}</defs><rect x="-20" y="-56" width="40" height="72" fill="#222831"/>${frag}</svg>`;
  writeFileSync(path, new Resvg(svg, { background: '#222831', fitTo: { mode: 'width', value: 180 } }).render().asPng());
};

for (const f of WEAPON_FORMS) {
  const w: Weapon = { name: f.label, type: f.type, damage: '+4', qualities: [] } as Weapon;
  const path = `public/qc/w-${f.slug}.png`;
  raster(pickView(weaponPart(w), 'front'), path);
  manifest.push({ id: `w-${f.slug}`, slug: f.slug, label: f.label, kind: 'weapon', path });
}
for (const s of SHIELD_FORMS) {
  const path = `public/qc/w-shield_${s.slug}.png`;
  raster(pickView(shieldPart({ name: s.label, qualities: [] } as Weapon), 'front'), path);
  manifest.push({ id: `w-shield_${s.slug}`, slug: `shield_${s.slug}`, label: s.label, kind: 'shield', path });
}
writeFileSync('public/qc/weapons-manifest.json', JSON.stringify(manifest, null, 2));
console.log(`OK: ${manifest.length} PNG → public/qc/  (manifest weapons-manifest.json)`);
```

- [ ] **Step 2: Lancer**

Run: `npx tsx scripts/_qc-render-weapons.mts`
Expected: `OK: 51 PNG → public/qc/`. Vérifier : `ls public/qc/w-*.png | wc -l` ⇒ 51, et `public/qc/weapons-manifest.json` existe.

> Beaucoup de PNG se ressembleront encore (art pas généré → repli épée) — c'est le point de départ pour l'audit. Normal.

- [ ] **Step 3: Écrire l'émetteur d'`args` `scripts/qc/_weapon-args.mts`**

`scripts/qc/_weapon-args.mts` :
```ts
/**
 * Émet le JSON d'`args` pour les workflows (évite `tsx -e`/`node -e`, bloqués).
 *   npx tsx scripts/qc/_weapon-args.mts          → args génération (weapons-redo)
 *   npx tsx scripts/qc/_weapon-args.mts --qc      → args audit (weapons-qc, chemins PNG)
 */
import { WEAPON_FORMS, SHIELD_FORMS } from '../../src/gameIso/rig/parts/weaponForms';

if (process.argv.includes('--qc')) {
  const w = [
    ...WEAPON_FORMS.map((f) => ({ slug: f.slug, label: f.label, target: f.target, isolated: `public/qc/w-${f.slug}.png`, held: `public/qc/held-${f.slug}.png` })),
    ...SHIELD_FORMS.map((s) => ({ slug: `shield_${s.slug}`, label: s.label, target: s.target, isolated: `public/qc/w-shield_${s.slug}.png`, held: `public/qc/held-shield_${s.slug}.png` })),
  ];
  console.log(JSON.stringify(w));
} else {
  console.log(JSON.stringify(WEAPON_FORMS.map((f) => ({ label: f.label, slug: f.slug, type: f.type, target: f.target }))));
}
```
Vérifier : `npx tsx scripts/qc/_weapon-args.mts | head -c 120` affiche un JSON `[{"label":"Bâton de combat",…`.

- [ ] **Step 4: Commit**

```bash
git add scripts/_qc-render-weapons.mts scripts/qc/_weapon-args.mts
git commit -m "feat(qc): rendu isolé data-driven (51) + émetteur d'args des workflows"
```

---

## Task 6: Rendu sur modèle `_qc-weapons-held.mts` (réécriture data-driven)

**Files:**
- Modify (réécriture): `scripts/_qc-weapons-held.mts`

- [ ] **Step 1: Réécrire le script (51, data-driven, + PNG individuels)**

Remplacer tout le contenu de `scripts/_qc-weapons-held.mts` par :
```ts
/**
 * QC « sur modèle » : le rig (Soldat humain M) tient CHAQUE arme/bouclier.
 * → public/qc/held-<slug>.png (individuel, pour audit) + public/qc/weapons-held.png (montage).
 * Usage : npx tsx scripts/_qc-weapons-held.mts
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { Resvg } from '@resvg/resvg-js';
import { renderToStaticMarkup } from 'react-dom/server';
import React from 'react';
import { RigSprite } from '../src/gameIso/rig/composeRig';
import { DEFS } from '../src/gameIso/sprites';
import { WEAPON_FORMS, SHIELD_FORMS } from '../src/gameIso/rig/parts/weaponForms';
import type { Weapon } from '../src/engine/types';

mkdirSync('public/qc', { recursive: true });
const APP = { species: 'Humain', sex: 'M', build: 0.5, seed: 4 } as const;
type Cell = { slug: string; label: string; svg: string };

const rig = (equip: { weapons: Weapon[]; armour: never[]; shield?: Weapon }) =>
  renderToStaticMarkup(React.createElement(RigSprite, { appearance: APP, equip, career: 'Soldat' }));

const cells: Cell[] = [
  ...WEAPON_FORMS.map((f) => ({ slug: f.slug, label: f.label, svg: rig({ weapons: [{ name: f.label, type: f.type, damage: '+4', qualities: [] } as Weapon], armour: [] }) })),
  ...SHIELD_FORMS.map((s) => ({ slug: `shield_${s.slug}`, label: s.label, svg: rig({ weapons: [{ name: s.label, type: 'melee', damage: '+0', qualities: ['Bouclier'] } as Weapon], armour: [], shield: { name: s.label, type: 'melee', damage: '+0', qualities: ['Bouclier'] } as Weapon }) })),
];

// PNG individuels (pour l'audit sur-modèle)
for (const c of cells) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 150"><defs>${DEFS}</defs><rect width="120" height="150" fill="#1d2230"/>${c.svg}</svg>`;
  writeFileSync(`public/qc/held-${c.slug}.png`, new Resvg(svg, { background: '#11141c', fitTo: { mode: 'width', value: 240 } }).render().asPng());
}

// Montage (relecture à l'œil)
const COLS = 8;
const tiles = cells.map((c, i) => {
  const col = i % COLS, row = Math.floor(i / COLS);
  return `<g transform="translate(${col * 124},${row * 168})"><rect width="120" height="150" fill="#1d2230"/>${c.svg}<text x="60" y="164" text-anchor="middle" font-size="10" fill="#cdd">${c.label}</text></g>`;
});
const rows = Math.ceil(cells.length / COLS);
const full = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${COLS * 124} ${rows * 168}"><defs>${DEFS}</defs>${tiles.join('')}</svg>`;
writeFileSync('public/qc/weapons-held.png', new Resvg(full, { background: '#11141c', fitTo: { mode: 'width', value: COLS * 248 } }).render().asPng());
console.log(`OK → ${cells.length} held-*.png + public/qc/weapons-held.png`);
```

- [ ] **Step 2: Lancer**

Run: `npx tsx scripts/_qc-weapons-held.mts`
Expected: `OK → 51 held-*.png + public/qc/weapons-held.png`. Vérifier `ls public/qc/held-*.png | wc -l` ⇒ 51.

- [ ] **Step 3: Commit**

```bash
git add scripts/_qc-weapons-held.mts
git commit -m "feat(qc): rendu sur modèle data-driven des 51 armes/boucliers (held-*.png + montage)"
```

---

## Task 7: Ingest `_ingest-weapons-redo.mts` (préserve l'armure)

**Files:**
- Create: `scripts/_ingest-weapons-redo.mts`

- [ ] **Step 1: Écrire l'ingest**

`scripts/_ingest-weapons-redo.mts` :
```ts
/**
 * Ingère l'art retenu par le workflow weapons-redo : pour chaque slug ayant un
 * art-ref/directional/weapons-redo/<slug>/chosen.json ({front}), fusionne dans
 * GENERATED_WEAPONS en PRÉSERVANT GENERATED_ARMOUR et les arts non régénérés.
 * Usage : npx tsx scripts/_ingest-weapons-redo.mts
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { GENERATED_WEAPONS, GENERATED_ARMOUR } from '../src/gameIso/rig/parts/generated/weaponsArmour';
import { WEAPON_FORMS } from '../src/gameIso/rig/parts/weaponForms';

const decode = (s: string) => String(s)
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
  .replace(/&#0?39;/g, "'").replace(/&apos;/g, "'").replace(/&amp;/g, '&');

const weapons: Record<string, string> = { ...GENERATED_WEAPONS };
let n = 0;
for (const f of WEAPON_FORMS) {
  const p = `art-ref/directional/weapons-redo/${f.slug}/chosen.json`;
  if (!existsSync(p)) continue;
  const j = JSON.parse(readFileSync(p, 'utf8'));
  const frag = j.front ?? j.svg;
  if (frag && String(frag).trim()) { weapons[f.slug] = decode(String(frag).trim()); n++; }
}

const banner = '// Généré par scripts/_ingest-weapons-redo.mts depuis le workflow weapons-redo — NE PAS éditer à la main.\n';
writeFileSync(
  'src/gameIso/rig/parts/generated/weaponsArmour.ts',
  banner +
    'export const GENERATED_WEAPONS: Record<string, string> = ' + JSON.stringify(weapons, null, 2) + ';\n\n' +
    "export const GENERATED_ARMOUR: Record<string, Partial<Record<'tete' | 'torse' | 'bras' | 'jambes', string>>> = " +
    JSON.stringify(GENERATED_ARMOUR, null, 2) + ';\n',
);
console.log(`ingéré ${n} armes ; total GENERATED_WEAPONS=${Object.keys(weapons).length} ; armour préservé=${Object.keys(GENERATED_ARMOUR).length}`);
```

- [ ] **Step 2: Test de préservation (manuel, sans chosen)**

```bash
npx tsx scripts/_ingest-weapons-redo.mts
```
Expected (aucun `chosen.json` encore) : `ingéré 0 armes ; total GENERATED_WEAPONS=… ; armour préservé=4`. Le fichier `weaponsArmour.ts` est réécrit À L'IDENTIQUE pour le contenu (armour préservé, 4 matériaux). Vérifier : `npm run typecheck` → 0 erreur, et `git diff --stat src/gameIso/rig/parts/generated/weaponsArmour.ts` ne montre que le bandeau/formatting (le contenu d'armour intact).

> Si le diff montre une PERTE de clés d'armour → bug d'ingest, corriger avant de continuer.

- [ ] **Step 3: Restaurer le fichier généré (on ne committe pas le re-formatting à vide)**

```bash
git checkout -- src/gameIso/rig/parts/generated/weaponsArmour.ts
```

- [ ] **Step 4: Commit (l'ingest seul)**

```bash
git add scripts/_ingest-weapons-redo.mts
git commit -m "feat(qc): ingest weapons-redo (chosen.json → GENERATED_WEAPONS, préserve armour)"
```

---

## Task 8: Workflow de génération `weapons-redo.workflow.js`

**Files:**
- Create: `scripts/qc/weapons-redo.workflow.js`

- [ ] **Step 1: Écrire le workflow**

`scripts/qc/weapons-redo.workflow.js` :
```js
/**
 * Génère l'art des armes (best-of-N) + juge aveugle sur PNG. Mirroir de creatures-redo.
 * args = [{ label, slug, type, target, wrong? }]  (sous-ensemble à (re)générer).
 * Chaque artiste écrit art-ref/directional/weapons-redo/<slug>/cand<N>.json ET rend son PNG.
 * Le juge lit les PNG (repli SVG-texte) et écrit chosen.json.
 */
export const meta = {
  name: 'weapons-redo',
  description: 'Dessine 1 silhouette fidèle par arme (best-of-N) + juge aveugle de reconnaissabilité. STAGING art-ref/directional/weapons-redo/.',
  whenToUse: 'Générer/corriger l’art des armes pour qu’elles se reconnaissent sans leur nom.',
  phases: [{ title: 'Candidats' }, { title: 'Juge aveugle' }],
}

const N = 3 // candidats par arme
const V = { type: 'object', additionalProperties: false, required: ['front'], properties: { front: { type: 'string' } } }
const JUDGE = { type: 'object', additionalProperties: false, required: ['chosenFrom', 'guess', 'recognizable'], properties: { chosenFrom: { type: 'string' }, guess: { type: 'string' }, recognizable: { type: 'boolean' }, note: { type: 'string' } } }

function candPrompt(w, n) {
  const wrong = w.wrong ? `\nPROBLÈME ACTUEL : se lit comme « ${w.wrong} » — à corriger.` : ''
  return `Tu dessines la silhouette d'UNE ARME pour un jeu SVG isométrique (Warhammer Fantasy 4e), vue de face.

CIBLE : « ${w.label} » doit se reconnaître AU PREMIER COUP D'ŒIL comme : ${w.target}.${wrong}

REPÈRE (os « arme », cf. src/gameIso/rig/PART-CONTRACT.md) : origine (0,0) = la POIGNÉE dans la main ; la lame/tête/pointe pointe vers le HAUT (-y) ; pommeau vers +y. Étendue x ∈ [-15,15], y ∈ [-50,10]. Échelle uniforme (gabarit humain). Une arme longue (pique, arc long, fusil) peut aller jusqu'à y=-50, pas plus haut.

STYLE : réutilise UNIQUEMENT les gradients déjà définis (g_steel, g_steelD, g_axe, g_glow, g_eye, g_flesh, g_blood) — n'invente AUCUN <defs>. Inspire-toi du style des armes existantes : lis src/gameIso/rig/parts/equipment.ts (map WEAPONS : epee/hache/masse/lance…). Manche relié à la tête d'un seul tenant. Silhouette LISIBLE avant le détail ; PAS de blob.

PRODUIS un fragment SVG (sans <svg>, sans <defs>, sans transform racine).
1) Écris-le dans art-ref/directional/weapons-redo/${w.slug}/cand${n}.json = {"front":"<...fragment...>"} (crée les dossiers).
2) Rends son PNG : \`npx tsx scripts/_qc-render-weapon-cand.mts art-ref/directional/weapons-redo/${w.slug}/cand${n}.json\` (doit afficher OK → …png).
Variante ${n} : ${n === 1 ? 'la lecture la plus claire et fidèle' : 'pousse encore la lisibilité / varie la composition'}.
Ne lance NI serveur NI tests. Renvoie aussi le fragment via l'outil structuré (front).`
}

function judgePrompt(w) {
  const list = Array.from({ length: N }, (_, i) => `cand${i + 1}`).join(', ')
  return `Juge AVEUGLE de reconnaissabilité d'arme (jeu SVG iso WFRP4).
Pour chaque candidat de art-ref/directional/weapons-redo/${w.slug}/ : LIS l'image cand<N>.png avec l'outil Read et REGARDE-la (repli : lis cand<N>.json et raisonne sur le SVG si le PNG manque). Candidats : ${list}.
Sans connaître le nom, demande-toi « qu'est-ce que je vois ? ». Choisis le candidat dont la silhouette se lit le plus clairement comme : ${w.target}.
Écris l'art retenu dans art-ref/directional/weapons-redo/${w.slug}/chosen.json = {"front": <le fragment SVG du candidat retenu, copié tel quel depuis son cand<N>.json>}.
Renvoie { chosenFrom:"cand1"|"cand2"|"cand3", guess:<ce que TU vois, sans présumer>, recognizable:<true si ton guess correspond à « ${w.label} »>, note }.`
}

const work = (Array.isArray(args) ? args : []).filter((w) => w && w.slug)
if (!work.length) { log('aucune arme en entrée (args vide).'); return { done: 0, items: [] } }
log(`Génération de ${work.length} arme(s), ${N} candidats chacune.`)

phase('Candidats')
const results = await pipeline(
  work,
  async (w) => {
    const cands = await parallel(
      Array.from({ length: N }, (_, i) => () => agent(candPrompt(w, i + 1), { label: `c${i + 1}:${w.slug}`, phase: 'Candidats', schema: V })),
    )
    return { w, ok: cands.filter(Boolean).length }
  },
  async (r) => {
    if (!r || !r.ok) return { slug: r && r.w && r.w.slug, done: false }
    const v = await agent(judgePrompt(r.w), { label: `juge:${r.w.slug}`, phase: 'Juge aveugle', schema: JUDGE })
    return { slug: r.w.slug, label: r.w.label, done: !!v, recognizable: v && v.recognizable, guess: v && v.guess }
  },
)
const done = results.filter((x) => x && x.done)
const stillBad = done.filter((x) => !x.recognizable)
log(`weapons-redo : ${done.length}/${work.length} jugées ; douteuses selon le juge : ${stillBad.map((x) => x.label).join(', ') || 'aucune'}`)
return { total: work.length, done: done.length, items: results.map((r) => r && ({ slug: r.slug, label: r.label, recognizable: r.recognizable, guess: r.guess })) }
```

- [ ] **Step 2: Validation syntaxique (sans dépenser d'agents)**

Run: `node --check scripts/qc/weapons-redo.workflow.js`
Expected: aucune sortie (exit 0 = JS valide). (Le `await`/`return` top-level est injecté par le harnais Workflow ; `node --check` valide la syntaxe hors top-level await — si erreur « await is only valid », l'ignorer et valider plutôt via un dry-run 1-arme au Step 3.)

> Si `node --check` rejette le top-level await/return, c'est NORMAL (le harnais Workflow enveloppe le script). La vraie validation est le dry-run 1-arme en exécution opérationnelle (Task 10, Step 1).

- [ ] **Step 3: Commit**

```bash
git add scripts/qc/weapons-redo.workflow.js
git commit -m "feat(qc): workflow weapons-redo (best-of-N artistes + juge aveugle PNG)"
```

---

## Task 9: Workflow d'audit `weapons-qc.workflow.js`

**Files:**
- Create: `scripts/qc/weapons-qc.workflow.js`

- [ ] **Step 1: Écrire le workflow**

`scripts/qc/weapons-qc.workflow.js` :
```js
/**
 * Audit des armes : (a) QUALITÉ = reconnaissabilité aveugle de la silhouette ISOLÉE
 * (2 juges/arme), (b) SUR MODÈLE = le rig tient l'arme (orientation/prise/échelle).
 * args = [{ slug, label, target, isolated, held }] (chemins PNG). Sort la liste des fails.
 */
export const meta = {
  name: 'weapons-qc',
  description: 'Audit aveugle des armes : silhouette isolée (devine sans le nom, 1–5) + tenue sur le rig (orientation/prise/échelle). Sort les échecs.',
  whenToUse: 'Vérifier que chaque arme se reconnaît seule ET tient correctement sur le personnage.',
  phases: [{ title: 'Qualité (isolé)' }, { title: 'Sur modèle' }],
}

const ISO = { type: 'object', additionalProperties: false, required: ['guess', 'score', 'sees'], properties: { guess: { type: 'string' }, score: { type: 'integer', minimum: 1, maximum: 5 }, sees: { type: 'string' } } }
const HELD = { type: 'object', additionalProperties: false, required: ['readable', 'orientation_ok', 'grip_ok', 'scale_ok'], properties: { readable: { type: 'boolean' }, orientation_ok: { type: 'boolean' }, grip_ok: { type: 'boolean' }, scale_ok: { type: 'boolean' }, note: { type: 'string' } } }

function isoPrompt(w) {
  return `Audit de lisibilité d'art de jeu (Warhammer Fantasy, sprite SVG iso, vu de face).
Lis l'image \`${w.isolated}\` avec l'outil Read et REGARDE-la. C'est censé représenter UNE ARME, mais ne présume RIEN — dis ce que TU vois.
- guess : la famille d'arme la plus précise (ex. « hache », « arbalète », « fléau », « pistolet »…) ; « indéterminé » si illisible.
- score : 1 (blob) à 5 (évident au 1er coup d'œil).
- sees : une phrase sur la silhouette perçue. Sois honnête et sévère.`
}
function heldPrompt(w) {
  return `Vérif « sur modèle » (jeu SVG iso WFRP4). Lis l'image \`${w.held}\` avec l'outil Read : un soldat humain TIENT une arme censée être : ${w.target}.
Réponds factuellement :
- readable : l'arme est-elle lisible/identifiable une fois tenue ?
- orientation_ok : tenue dans le bon sens (lame/tête vers l'extérieur/haut, pas à l'envers ni dans le corps) ?
- grip_ok : la poignée est-elle DANS la main (pas flottante, pas décalée) ?
- scale_ok : taille crédible (ni minuscule ni démesurée par rapport au personnage) ?
- note : le défaut principal si un critère est false.`
}

const work = (Array.isArray(args) ? args : []).filter((w) => w && w.slug)
if (!work.length) { log('aucune arme en entrée (args vide).'); return { fails: [], ranking: [] } }
log(`Audit de ${work.length} arme(s) : isolé (2 juges) + sur modèle (1 juge).`)

phase('Qualité (isolé)')
const results = await pipeline(
  work,
  async (w) => {
    const gs = (await parallel([
      () => agent(isoPrompt(w), { label: `iso1:${w.slug}`, phase: 'Qualité (isolé)', schema: ISO }),
      () => agent(isoPrompt(w), { label: `iso2:${w.slug}`, phase: 'Qualité (isolé)', schema: ISO }),
    ])).filter(Boolean)
    const avg = gs.length ? +(gs.reduce((a, g) => a + g.score, 0) / gs.length).toFixed(1) : 0
    return { w, avg, guesses: gs.map((g) => `${g.guess}(${g.score})`) }
  },
  async (r) => {
    const h = await agent(heldPrompt(r.w), { label: `held:${r.w.slug}`, phase: 'Sur modèle', schema: HELD })
    const heldOk = !!h && h.readable && h.orientation_ok && h.grip_ok && h.scale_ok
    const isoOk = r.avg >= 3
    return { slug: r.w.slug, label: r.w.label, avg: r.avg, guesses: r.guesses, isoOk, heldOk, held: h, fail: !(isoOk && heldOk) }
  },
)
const ok = results.filter(Boolean)
const fails = ok.filter((r) => r.fail)
log(`Audit terminé : ${fails.length}/${ok.length} échecs (isolé avg<3 ou tenue incorrecte).`)
return {
  count: ok.length,
  fails: fails.map((r) => ({ slug: r.slug, label: r.label, avg: r.avg, isoOk: r.isoOk, heldOk: r.heldOk, guesses: r.guesses, note: r.held && r.held.note })),
  ranking: ok.sort((a, b) => a.avg - b.avg).map((r) => `${r.avg} ${r.label} [iso ${r.isoOk ? 'ok' : 'X'} | tenue ${r.heldOk ? 'ok' : 'X'}]`),
}
```

- [ ] **Step 2: Validation syntaxique**

Run: `node --check scripts/qc/weapons-qc.workflow.js`
Expected: exit 0 (ou erreur top-level await à ignorer, cf. Task 8 Step 2).

- [ ] **Step 3: Commit**

```bash
git add scripts/qc/weapons-qc.workflow.js
git commit -m "feat(qc): workflow weapons-qc (reconnaissabilité isolée + tenue sur modèle)"
```

---

## Task 10: Exécution opérationnelle — génération de l'art (le « processus »)

> Cette phase est pilotée par l'orchestrateur (boucle principale) qui appelle l'outil **Workflow**. Les sous-agents d'un plan ne peuvent pas lancer de Workflow ; ces étapes sont exécutées par l'agent principal.

**Files:** (produits) `art-ref/directional/weapons-redo/<slug>/chosen.json` (gitignoré)

- [ ] **Step 1: Dry-run 1 arme (valide le workflow en réel)**

Lancer l'outil Workflow sur `scripts/qc/weapons-redo.workflow.js` avec `args` réduit à UNE arme représentative, p.ex. le fléau :
```
args: [{ "label": "Fléau d'armes", "slug": "fleau_armes", "type": "melee", "target": "fléau militaire : manche + chaîne + boule à pointes", "wrong": "masse" }]
```
Attendu : le workflow finit ; `art-ref/directional/weapons-redo/fleau_armes/chosen.json` existe avec un `front` non vide ; les `cand*.png` existent. Inspecter `chosen.json` + lire le PNG `held` après ingest (Step 3) pour juger.
Si le workflow plante (syntaxe/args), corriger `weapons-redo.workflow.js` et relancer.

- [ ] **Step 2: Run complet — les 48 armes**

Produire l'`args` complet depuis la source de vérité :
```bash
npx tsx scripts/qc/_weapon-args.mts
```
Copier ce JSON comme `args` (passer la valeur comme **tableau JSON réel**, pas une chaîne) et lancer l'outil Workflow sur `scripts/qc/weapons-redo.workflow.js`. (Resume possible via `resumeFromRunId` si interrompu.)
Attendu : `art-ref/directional/weapons-redo/<slug>/chosen.json` pour ~48 slugs. Vérifier : `ls art-ref/directional/weapons-redo/*/chosen.json | wc -l`.

- [ ] **Step 3: (pas de commit ici — l'art est ingéré en Task 11)**

---

## Task 11: Intégration de l'art + vérification du build

**Files:**
- Modify (régénéré): `src/gameIso/rig/parts/generated/weaponsArmour.ts`

- [ ] **Step 1: Ingest**

Run: `npx tsx scripts/_ingest-weapons-redo.mts`
Expected: `ingéré ~48 armes ; total GENERATED_WEAPONS=… ; armour préservé=4`.

- [ ] **Step 2: Typecheck + tests**

Run: `npm run typecheck && npm test`
Expected: typecheck 0 erreur ; tests verts (dont `weaponForms`). Si une clé d'art casse le typage (caractère non échappé), corriger l'ingest/décodage et relancer.

- [ ] **Step 3: Re-render isolé + sur modèle**

```bash
npx tsx scripts/_qc-render-weapons.mts && npx tsx scripts/_qc-weapons-held.mts
```
Expected: 51 `w-*.png`, 51 `held-*.png`, montage `weapons-held.png`. Ouvrir le montage à l'œil : les fléaux ≠ masses, Zweihänder ≠ épée, les 6 armes à feu se distinguent, lasso/bolas/poing apparaissent.

- [ ] **Step 4: Commit (art + génération)**

```bash
git add src/gameIso/rig/parts/generated/weaponsArmour.ts
git commit -m "feat(rig): art généré — 1 silhouette par arme (48) via workflow weapons-redo"
```

---

## Task 12: Audit qualité + sur modèle

**Files:** (lecture) `public/qc/weapons-manifest.json`, `public/qc/w-*.png`, `public/qc/held-*.png`

- [ ] **Step 1: Produire l'args d'audit**

```bash
npx tsx scripts/qc/_weapon-args.mts --qc
```

- [ ] **Step 2: Lancer l'audit**

Lancer l'outil Workflow sur `scripts/qc/weapons-qc.workflow.js` avec l'`args` ci-dessus (51 éléments).
Attendu : retour `{ fails, ranking }`. Noter la liste `fails` (slug, raison `isoOk`/`heldOk`, `guesses`, `note`).

- [ ] **Step 3: Consigner les fails**

Écrire les fails dans le résumé (slug + raison). S'il y a 0 fail → aller Task 14. Sinon → Task 13.

---

## Task 13: Boucle de reprise sur les échecs

- [ ] **Step 1: Construire l'args de reprise**

Pour chaque fail, reprendre l'entrée `WEAPON_FORMS` correspondante et y ajouter `wrong` = ce que le juge a vu (`guesses`/`note`). Construire un `args` réduit aux seuls fails (mêmes champs que Task 10 Step 2 + `wrong`).

- [ ] **Step 2: Re-générer les fails**

Lancer l'outil Workflow sur `scripts/qc/weapons-redo.workflow.js` avec l'`args` réduit. (Écrase les `chosen.json` des slugs concernés.)

- [ ] **Step 3: Ré-ingérer + re-render**

```bash
npx tsx scripts/_ingest-weapons-redo.mts && npm run typecheck && npx tsx scripts/_qc-render-weapons.mts && npx tsx scripts/_qc-weapons-held.mts
```

- [ ] **Step 4: Ré-auditer les fails**

Relancer `weapons-qc.workflow.js` avec l'`args` réduit aux fails (Task 12 Step 1, filtré).

- [ ] **Step 5: Itérer**

Répéter Steps 1–4 jusqu'à 0 fail OU 3 tours sans progrès. `log`/consigner explicitement toute arme laissée non-conforme (pas de troncage silencieux). Commit de l'art corrigé :
```bash
git add src/gameIso/rig/parts/generated/weaponsArmour.ts && git commit -m "fix(rig): reprise art armes après audit (tour N)"
```

---

## Task 14: Clôture — vérif finale, montage, mémoire

- [ ] **Step 1: Vérification finale**

```bash
npm run typecheck && npm test
```
Expected: verts.

- [ ] **Step 2: Vérif navigateur (optionnelle mais recommandée)**

`npm run dev`, ouvrir le scénario de test « galerie armes » (cf. `docs/test-scenarios.md`), vérifier console 0 erreur et que les armes s'affichent tenues correctement sur les héros. Screenshot.

- [ ] **Step 3: Mettre à jour la mémoire projet**

Mettre à jour `MEMORY.md` + créer/màj un mémo « modèles d'armes 1-par-1 » (pipeline weapons-redo/weapons-qc, source de vérité `weaponForms.ts`, gates iso+sur-modèle) — lié à [[game-qc-reconnaissabilite]] et [[game-goal-sprites-anims-complets]].

- [ ] **Step 4: Commit final / récap**

```bash
git add scripts/_qc-render-weapons.mts scripts/_qc-weapons-held.mts scripts/_qc-render-weapon-cand.mts scripts/_ingest-weapons-redo.mts scripts/qc/weapons-redo.workflow.js scripts/qc/weapons-qc.workflow.js
git commit -m "feat(qc): pipeline modèles d'armes 1-par-1 (render + ingest + workflows)"
git log --oneline -12
```
Donner à l'utilisateur le récap : nb d'armes générées, score moyen iso, fails résiduels (le cas échéant), planche `public/qc/weapons-held.png`.

---

## Self-Review (à faire après écriture — déjà intégré)

- **Couverture spec** : 52 armes (Task 1) ; routage + arts morts (Task 2) ; 3 boucliers (Task 3) ; render isolé (Task 5) + sur modèle (Task 6) ; génération best-of-N + juge (Task 8/10) ; ingest préservant l'armure (Task 7/11) ; audit qualité + sur-modèle (Task 9/12) ; boucle (Task 13) ; gates typecheck/test (Task 11/14). ✓
- **Invariant animation** : aucune modif de `weaponGroup.ts` ; seules les formes changent. ✓
- **Cohérence des types** : `WEAPON_FORMS`/`SHIELD_FORMS`/`formSlug`/`norm` (Task 1) réutilisés tels quels en Task 5/6/7/10/12. `weaponFamily`/`shieldPart`/`weaponPart` signatures inchangées. ✓
- **Pas de placeholder** : tout le code est fourni ; les `args` opérationnels sont générés par commande exacte. ✓
- **Risque fs-dans-workflow** : les workflows lisent `args` (pas de fs) ; seuls les agents écrivent/rendent. ✓
