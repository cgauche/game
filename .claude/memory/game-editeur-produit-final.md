---
name: game-editeur-produit-final
description: "L'éditeur est un vrai éditeur — Ouvrir scénarios/projets, Enregistrer en bibliothèque persistée, Publier une campagne jouable au menu ; édition en modale"
metadata: 
  node_type: memory
  type: project
  originSessionId: df22e358-4438-4cca-b8e3-ad83ea327a2e
---

Réponse à « c'est un vrai éditeur ? on crée/sauvegarde/joue une campagne de bout en bout ? » — OUI, livré 2026-06-11 (commits 79487d0 édition-modale, 73de4c6 Ouvrir/Enregistrer, ab21e79 menu-publish ; suite 2897 verte, poussé).

**Architecture** (à connaître pour ne pas la rebâtir/casser) :
- `src/state/projectLibrary.ts` (pur, testé, miroir de `roster.ts`) : localStorage `wfrp4.editor-projects.v1`, `SavedProject {id,name,startSceneId,savedAt,published,project:{schema:2,scenes,worldMap?}}` ; `projectsLoad/projectSave(upsert id)/projectRemove/publishedProjects`.
- `src/ui/editor/ProjectModals.tsx` : `OpenProjectModal` (Mes projets si non-vide + 19 scénarios de test) + `SaveProjectModal` (nom + scène de départ si >1 + case Publier) — `<Modal variant=plain>` + primitives (`.listrow`/`.chip`/`.field`/`.modal-actions`).
- `Editor.tsx` : boutons **Ouvrir/Enregistrer** (remplacent « Charger La Diligence » codé en dur) ; handlers `loadScenario`/`loadSaved`/`saveProject` (état `projectId/projectName/published`). **Édition en modale** : `Inspector.tsx` colonne = navigation seule, branches d'édition enveloppées dans `<Modal className="wide editor-edit-modal">` (prop `onDeselectEntity`).
- Store `pendingCampaign` (+ `setPendingCampaign`) : campagne publiée choisie au menu → `MainMenu` « Mes campagnes » (CTA sang) → `PartyScreen` (titre = nom) → `loadProject(scenes, startSceneId, worldMap)`. « Nouvelle partie » efface `pendingCampaign`. Réinitialisé par le reset zéro-maintenance de `startScene` [[game-newgame-reset-pattern]].

Conforme 360px (cap 94vw). Prolonge [[game-roster-personnages]] (même patron localStorage) et la charte/refonte [[game-jalon9-ui-ux-charte]].
