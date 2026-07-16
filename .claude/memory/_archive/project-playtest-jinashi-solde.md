---
name: project-playtest-jinashi-solde
description: "Backlog playtest Jinashi (#70-80) soldé ; reste"
metadata: 
  node_type: memory
  type: project
  originSessionId: 5b6e3f22-7155-4d2e-bf85-94656ba3d0fa
---

Backlog du retour playtest beta `retours_warhammer_tactic_jinashi.odt` (cf.
`docs/playtest-jinashi-consolidation.md`) **soldé le 2026-06-27**.

**Fait + committé + vérifié (navigateur)** : LOT1 bugs #70-74 · #75 loadout sets · #76 stats-arme ·
#77 hover-highlight · #78 ouverture combat (splash/init/blink) · #79-T1 popover carac (primitive
`CharStatsGrid`) · #79-T2 remplacer-slot · #79-T2 **Background** (onglet fiche + Ambitions/Motivation
éditables, `BackgroundPanel`+`setHeroBackground`+`rosterUpdate`) · #79-T3 armure par zone · #80
(moteur : dégâts non-crit + Déviation à la localisation re-tirée du Coup Critique, LDB 18 l.55).
**+ bugs trouvés en chemin** : 4 `[object Object]` (sorts/manœuvres/inspection/carte) + garde-fou
`registry-no-raw-object.test.ts` ; crash `codexLookup` (libellé undefined → tout le rendu) rendu
défensif ; **cohérence CodexRef** : armes/Blessures/Mouvement/caracs du statbloc d'inspection ET de
la mini-carte sont des entités CodexRef (chips + popover), plus de texte brut.

**Reste OUVERT** :
- **#80 Projectile magique** = ticket RAW DIFFÉRÉ (LDB 46 Incantation Critique : re-tire-t-elle la
  localisation comme un Coup Critique ? adjudication non tranchée + modèle de dégâts magie distinct).
  NE PAS coder à l'aveugle. cf. [[game-no-mj-model-everything]] mais ici le RAW est ambigu.
- **2 échecs de suite NON-MIENS** (committés par la session // « armes ») : `no-json-fields.test.ts`
  (champ `skillBonus` de trapping sans support éditeur Codex) + `weaponForms.test.ts` (Cimeterre/Dague
  ballock + 3 sans forme rig). Domaine de leur chantier weapons, pas du playtest. Suite = **6307/6309**.

Discipline tenue : agents codent, je vérifie (RAW + tests + navigateur), commits mine-only autour des
`git add -A` de la session // (isolation de hunks `store.ts`/`fr.ts`/combatFlow). cf.
[[feedback-orchestrator-verify-delete-redo]] [[git-commits-propres-wip-parallele]].
