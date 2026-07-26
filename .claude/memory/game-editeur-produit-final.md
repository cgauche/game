---
name: game-editeur-produit-final
description: "L'éditeur est un vrai éditeur — Ouvrir scénarios/projets/campagnes, Enregistrer en bibliothèque persistée, Publier une campagne jouable au menu ; édition DOCKÉE dans l'inspecteur"
metadata: 
  node_type: memory
  type: project
  originSessionId: df22e358-4438-4cca-b8e3-ad83ea327a2e
---

Réponse à « c'est un vrai éditeur ? on crée/sauvegarde/joue une campagne de bout en bout ? » — OUI, livré 2026-06-11 (commits 79487d0 édition, 73de4c6 Ouvrir/Enregistrer, ab21e79 menu-publish ; suite 2897 verte, poussé).

**Architecture** (à connaître pour ne pas la rebâtir/casser) :
- `src/state/projectLibrary.ts` (pur, testé) : **IndexedDB** source de vérité + miroir localStorage `wfrp4.editor-projects.v1` (borné PAR PROJET) et registre de pierres tombales `…tombstones.v1` anti-résurrection (#766/#776) ; `SavedProject {id,label,startSceneId,savedAt,published,project:StoredProject}` ; `initLibrary` (réconcilie par id à chaque boot) · `projectsLoad` · `projectSave`/`projectRemove` → `Promise<LibraryWriteOutcome>` (`{ok:true} | {ok:false,message}`, ne rejettent JAMAIS) · `publishedProjects`. Le paquet est en schema 3 (`ProjectDoc`, `src/state/worldMap.ts`).
- `src/ui/editor/ProjectModals.tsx` : `OpenProjectModal` — trois sources : Mes projets (si non-vide), les campagnes du jeu (`allBuiltinCampaigns` ; #367 : ouverture = COPIE de travail, `projectId` reste `null`, les `src/scenes/**-projet.json` commités ne sont JAMAIS écrasés depuis l'éditeur) et les scénarios de test du registre `src/scenes/test-scenarios/_registry.generated.ts` (34) — + `SaveProjectModal` (nom + scène de départ si >1 + case Publier) ; `<Modal variant=plain>` + primitives (`.listrow`/`.chip`/`.field`/`.modal-actions`).
- `Editor.tsx` : SHELL d'orchestration — toolbar `EditorToolbar` (menu **Fichier → Ouvrir…/Enregistrer…**, scènes, Tester) ; handlers `loadScenario`/`loadSaved`/`saveProject` (état `projectId/projectName/published`). **Édition DOCKÉE** : `Inspector.tsx` = volet droit, la sélection s'édite EN PLACE en sections repliables `.fold` pendant que la carte reste visible ; rien de sélectionné → propriétés de la SCÈNE. Aucune modale d'édition — garde `src/ui/editor/Editor.test.tsx` : « ne rend AUCUNE modale d'édition (l'édition est dockée) » (ni `editor-edit-modal`, ni `modal-overlay`).
- Store `pendingCampaign` (+ `setPendingCampaign`) : campagne publiée choisie au menu → `MainMenu` « Mes campagnes » (CTA sang) → `PartyScreen` (titre = nom) → `loadProject(scenes, startSceneId, worldMap)`. « Nouvelle partie » efface `pendingCampaign`. Réinitialisé par le reset zéro-maintenance de `startScene` [[game-newgame-reset-pattern]].

Conforme 360px (cap 94vw). Prolonge [[game-roster-personnages]] (même patron localStorage) et la charte/refonte [[game-refonte-ui-jeu-video-2026-07]].
