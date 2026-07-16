---
name: game-creature-registry
description: "Registre générique « dépose un fichier → intégré » (codegen gen-registry.mjs) — 4 familles : créatures, scénarios, tenues, parts monstrueuses ; defs/ → index dérivé, pas d'import.meta.glob."
metadata: 
  node_type: memory
  type: project
  originSessionId: 5b5e1576-6e66-4371-b038-61f34984d882
---

But utilisateur (énoncé 2026-06-06) : « il suffit de mettre une créature dans un dossier et POUF, il est intégré au jeu » — comme l'auto-chargement des scénarios. Réalisé pour les créatures (Jalons 1→3).

**Où** : `src/gameIso/rig/creatures/` — `defs/<Nom>.ts` (UN `CreatureDef` par créature) → `scripts/gen-registry.mjs` (codegen) écrit `_registry.generated.ts` (imports EXPLICITES) → `creatures/index.ts` DÉRIVE tout.

**CreatureDef** (`creatures/types.ts`) : `{ name, plan: biped|quadruped|winged|monolithic, aliases?, match?(regex source), matchPriority?, quad?(QuadProps pour quad/ailé), biped?(BipedConfig: career/monster/sex/parts/colors/scale) }`.

**Ce que `index.ts` dérive** (plus AUCUNE table SPECIES_* centrale) : `QUAD_SPECIES`/`WINGED_SPECIES` (props par espèce), `quadSpeciesMatch`/`wingSpeciesMatch` (nom→espèce, limite de mot sur name+aliases), `bipedSpeciesMatch` (regex `match` triée par `matchPriority` — remplace l'if-chain `detectSpecies` ; l'ordre désambiguïse « rat ogre »→Skaven avant Ogre), `bipedConfig(species)` (ex tables SPECIES_*), `quad/wing/bipedSpeciesScale` (token-scale : rat petit, dragon/géant énormes). `quadSkeleton`/`composeWing` RE-EXPORTENT QUAD_SPECIES/WINGED_SPECIES → consommateurs inchangés.

**Décision d'archi clé** : codegen, PAS `import.meta.glob` (le pattern scénario) — glob est Vite-only et **`undefined` sous tsx** (les scripts QC cassent). Le codegen marche partout (Vite+Vitest+tsx), inspectable, zéro runtime. Plugin Vite `registry-gen` (dans vite.config) régénère au démarrage + à chaque ajout/suppression dans `defs/` (POUF en dev) ; `npm run gen` + intégré au `build`. **Générateur GÉNÉRIQUE** (`REGISTRIES` config).

**Plans corporels AUTO-ENREGISTRÉS (2026-06-07)** : 6e famille du registre — `rig/plans/defs/<id>.ts` (1 ligne, ré-exporte le `BodyPlan` du module compose) → `PLAN_LIST` → `bodyPlan.ts` dérive `PLANS = Object.fromEntries(PLAN_LIST)`. Plus de table `PLANS` centrale ni d'union `BodyPlanId` (→ `string`). **Ajouter un gabarit = module compose + 1 ligne `plans/defs/<id>.ts` + defs créatures** ; zéro edit bodyPlan/IsoStage/routage. (familles du registre : créatures, scénarios, parts monstrueuses, tenues, armes, **plans**.)

**Étendu à 4 familles (2026-06-07)** via le même `gen-registry.mjs` (+ champ `importDir` pour dossiers à plat ; `readdirSync` tolérant si dossier absent) : (1) **créatures** `creatures/defs/` ; (2) **scénarios** `scenes/test-scenarios/` — migrés de `import.meta.glob` vers l'index généré (mécanisme unique) ; (3) **tenues** `parts/tenues/defs/` — 8 archétypes de classe + Nu sortis de la table de `career.ts` (`TENUES`/`TENUE_NUE` dérivés) ; (4) **parts monstrueuses** `parts/monster/defs/` — 16 têtes (front/dos/profil)+2 bras+1 jambe sortis de la triple-saisie de `monstrous.ts` (union `MonsterHead/Arm/Leg`+`Record HEADS/ARMS/LEGS`+tableaux `_OPTIONS`, tout dérivé), `monstrous.ts` 557→132 l. (garde `MonsterParts`+overlays+`monsterInjection`, re-exporte OPTIONS), yeux DRY en `monster/eyes.ts`, code mort viré (`undeadEye`, `OV_COL_CAPE`). **Méthode refacto à gros SVG = golden master** (`monstrous.golden.test.ts` snapshot du SVG résolu) + scripts d'extraction one-shot (`_extract`/`_rewrite`, jetés après). Pattern réutilisable pour toute famille « table éparpillée → 1 fichier ». Non retenu ce cycle : formes d'armes ; palettes/cheveux ont déjà leur pipeline d'ingestion d'art.

**Ajouter une créature = UN fichier** `defs/X.ts` (+ `npm run gen` si pas en dev). Si aucun gabarit ne colle (serpent, araignée, pieuvre, hydre, squig…) → `plan:'monolithic'`/EXOTIC_RE (sprite legacy). `bodyPlanOf` est piloté par les fichiers.

**Recatégorisations faites** (sorties du monolithique) : Liche→bipède (squelette), Manticore/Varghulf→ailé (réutilisent feline/canine+membrane), Démonette→bipède (cornes+griffe+peau mauve), Fimir→bipède (tête `cyclope` ajoutée à monstrous.ts), Géant→bipède (token-scale ×2.4, sinon il clippe la boîte 120×150). « Charognard » SUPPRIMÉ (inventé, non canon, indistinct du loup).

**Pièges** : `Palette` n'a que les tokens de BASE (`peau`…) — les ombres/reflets (`peauO`/`peauH`) sont dérivés auto par `buildTokenMap` (ne pas les mettre dans `colors`). Fichiers `defs/` en noms ASCII (`Rat-geant.ts`), le `name` interne garde l'accent. Cf. [[game-gabarits-corporels]].
