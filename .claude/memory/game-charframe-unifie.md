---
name: game-charframe-unifie
description: Frame personnage unifié LIVRÉ (6 lots, 33a5e9b→34c3e4b) — reste recette navigateur (Playwright pris par session //)
metadata: 
  node_type: memory
  type: project
  originSessionId: 2f265bd5-1a77-44c8-8e11-cfad57e904d5
---

Chantier LIVRÉ 2026-06-12 (6 commits 33a5e9b/2de31a8/fd53d04/3ad79ab/dfcc780/34c3e4b, suite 3011 verte) : UN seul affichage de personnage partout, `PortraitTile` refondu. **Reste : recette navigateur** (Playwright verrouillé par la session //, extension Chrome absente) — vérifier HUD/soin/marchand/interlude. Écarts au plan assumés : ModalSubject a une prop `variant` (full pour les soins — suivre l'Hémorragie) ; InspectPanel GARDE le nom (= fiche de l'adversaire) ; CreatorSummary non touché (silhouette plein-corps > tuile) ; `TeamPortrait` (portrait nu inline, `src/ui/TeamPortrait.tsx`) survit pour lignes de jet/ready-checks/marchand dense ; sizes = xs28/sm44/md56/lg72/xl112.

**API verrouillée** : `variant: 'full'|'vital'|'identity'` + `size: 'sm'|'md'|'lg'|'xl'` + `selected` (picker radio) — **AUCUN booléen visuel** (showPv/showGauge/hideStates supprimés ; c'est la soupe de booléens qui a produit la divergence). `aria-label`/`title` = nom partout (a11y mobile).

- `full` = portrait + jauge + états (HUD, médecin, inspection, interlude)
- `vital` = portrait + jauge sans états (sujets de modale, VsHeader, cibles)
- `identity` = portrait seul (butin, ready-check, lignes de jet, marchand)

**Arbitrages utilisateur (AskUserQuestion, tous = ma recommandation)** :
1. PB ennemis = jauge seule (PB exacts réservés à l'Inspection — tension de table)
2. Nom : JAMAIS dans le jeu courant ; autorisé écrans MÉTA seulement (roster, créateur, fiche, lobby coop). La PROSE narrative (sous-titres, journal) garde le nom ; tuer les doublons nom-dans-titre (FateSaveModal).
3. PV chiffrés coupés en sm (≤44 px, frise) — jauge seule
4. CharCard (roster/prégénérés) = `identity` + stats texte (pas de jauge hors partie)

**Lots** : 0 API+replier ModalSubject/CombatantBadge (tests PortraitTile/ActiveFrame verts AVANT migration) → 1 combat (modales, ActionBar soin, CastModal, MountTarget) → 2 HealModal médecin (états/Hémorragie visibles dans le picker) → 3 mort aux `<select>` de héros (CharacterSheet consommable, MerchantPanel répartition → tuiles radio) → 4 écrans sans portrait (CharCard, CreatorSummary, Interlude, CoopPanels) → 5 dédoublonnage (InspectPanel/CharacterSheet en-têtes maison, CSS morts cb-*/ms-*/insp-pv/heal-pick).

Hors scope : BodyToken (jauge carte 26px), DialogueBox (portrait PNJ narratif). États = toujours via StateChips/`summarizeEffects` (source unique). Inventaire complet des sites dans la conversation du 2026-06-12.

Prolonge `docs/charte-ui.md` (densité des contrôles, zéro texte tuto).
