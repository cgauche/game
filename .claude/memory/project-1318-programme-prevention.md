---
name: project-1318-programme-prevention
description: "#1318 programme de prévention (audit vision 2026-08-14) : 8 classes P1-P8, V3 LIVRÉE / V4-V10 à faire — l'état de reprise est AU TICKET"
metadata:
  type: project
---

Audit de conformité à la vision (#1318, né de la directive utilisateur 2026-08-14 : « J'ai l'impression de ne faire que de la guérison au lieu de la prévention, on subit ! »). Vagues 1+2 (4 juges d'axe + synthèse) RENDUES — le programme complet est posté au ticket #1318 (commentaire « VAGUES 1+2 RENDUES ») : 8 classes P1-P8, un verrou par classe (mort au type > cliquet AST > baseline décroissante DATÉE, baselines opaques interdites), vagues V3-V10 chiffrées (~18,5 j-codeur).

**LIVRÉES** : V3 (d47f1cce — 3 fenêtres RAW), V4 (5b2e9d5e — mort au type des 4 props d'influence, invariant success⇔outcome), V5 (c7d583cf — knip/cliquets/hook bloquant), V6 (1c23197a — resolver fermé + RESOLVER_OWNER, harvest par id, trou for…of corrigé), V7 (98d72164 — ~150 réfs re-ancrées, garde raw-ref-integrity stock 108 double-sens). Tickets nés en route : #1329 (battleRally jamais résolu), #1330 (journal re-parsé par label → meurt en V8).

**TOUS LES VERROUS POSÉS** (2026-08-16) : + V10 (954fef25 — garde OWNERS baseline VIDE, 12 recopies éteintes dans la vague), V8d-0/A (77bfe15b — canal onCondition au moteur, voie A′ du juge après réfutation du diff-d'état ; B/C/D différés au ticket #1330, evLines = chantier caché), V8a₀ (b106832d — murage PlayerText : marque exigée AUX PORTES du seam après un 1er murage pris en défaut à ~12 % de couverture ; fossile rawText 193 nominatif cible 0 = E7). Directive verbatim (2026-08-16, 4e de la série demi-migration) : « Pas de demi-migration ou de guard qui valident l'existent » — lots d'extinction E1-E7 nommés au ticket, chaque baseline a sa cible zéro.

**Reprise** : vagues de CONTENU — V8a₁ (gabarits + 193 rawText→0 + scission refLabel + options[].label), V8b (séquence), V8c (dénouements + #1333 trou d'accent du garde i18n), V8d-B/C/D (#1330), V9 (policy.ts→JSON, table VDM, verbatim générique), E1-E7, gatedByRule, design S4-c. ⚠ 3 sessions actives sur l'arbre à la reprise (anim/manœuvres, caméra/lacet stageYaw, rendu #1176). Le ticket fait foi.

#1279 (socle de séquence + 15 jeux de taverne #578) est CLOS le même jour — solde `.claude/soldes/1279.md`, S4-c (roster d'habitués à fiche) transféré en design doc à commissionner.
