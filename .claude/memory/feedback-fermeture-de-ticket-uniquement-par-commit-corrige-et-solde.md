---
name: feedback-fermeture-de-ticket-uniquement-par-commit-corrige-et-solde
description: "2026-09-02 — la revue de palier (0139bd89c, verdict PARTIEL) a relevé que #1659 et #1673 ont été fermés À LA MAIN sur GitHub (`gh issue close`) SANS solde : une fuite. Depuis 9aee19448 l'outil REFUSE `gh issue close`/`edit --state closed`/`api PATCH state=closed` : une fermeture passe par un commit `corrige #N` + `.claude/soldes/N.md` (VERIFIE / Restes / Réfutation / Recette visuelle si écran)"
metadata:
  type: feedback
---

**Fait** : le 2026-09-02 j'ai fermé #1659 (vague tuples) et #1673 (inventaire des fusions) par `gh issue close --comment …` avec un solde en prose dans le commentaire. La revue de palier committée par la session voisine (`.claude/soldes/revue-palier.md`, 0139bd89c) les classe « fermés à la main sans solde » — la preuve n'est pas dans git, le compteur de palier ne les a pas vus, le canari ne peut pas les relire.

**Why :** [[feedback-solde-de-ticket-obligatoire-au-commit]] — la preuve citée par le message de commit vit dans git, pas dans un commentaire GitHub ; une fermeture hors commit est invisible aux gardes (palier, dette `#N` dans les commentaires de code, recette visuelle).

**How to apply :**
1. JAMAIS `gh issue close` (l'outil le refuse désormais). Un ticket se ferme par le commit qui le solde : `corrige #N` dans le message + `.claude/soldes/N.md` stagé (`VERIFIE:` ≥ 40 c., `## Restes` avec dispositions `-> #N` seul / `-> corrigé dans ce commit` avec `fichier:ligne` stagé / `-> corrigé par <sha> <fichier:ligne>` / `-> inventaire #<épic> : <état>` / `-> RAS : …`, `## Réfutation` avec `verdict:`), plus `## Recette visuelle` avec `capture: public/qc/<nom>.png` (≥ 1 KiB, ≥ 200 px, plus récente que les fichiers stagés) dès qu'un `.tsx` d'écran ou un `.css` de `src/ui/styles` est dans le diff.
2. Un ticket d'INVENTAIRE ou de VAGUE (sans code propre) se ferme par le commit qui pose son dernier lot, avec son solde — pas par un commentaire.
3. Le compteur de palier est PARTAGÉ entre sessions (`.git/wfrp-palier.compteur`) : avant une fermeture, vérifier qu'une revue de palier n'est pas due ; le prochain commit de substance après la revue archive celle-ci et remet le compteur à 0.
