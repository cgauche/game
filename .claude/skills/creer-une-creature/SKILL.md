---
name: creer-une-creature
description: À utiliser quand on ajoute une créature, un monstre ou un PNJ au bestiaire (rig, apparence, statbloc), quand une créature s'affiche mal (blob, proportions), ou avant de toucher src/gameIso/rig/creatures/. Aussi pour une nouvelle tenue ou race jouable.
---

# Créer une créature

Lire **`docs/creer-une-creature.md`** et le suivre intégralement — registre `defs/`, corps nu ≠ tenue,
illustration `art-ref/` obligatoire, pièges codifiés. Le statbloc vient du Source (FR uniquement,
règle stricte 1) ; l'apparence est de la donnée (registres `defs/`, jamais de regex sur les noms —
`docs/architecture.md` § Direction visuelle). QC : golden tests + reconnaissabilité par agent aveugle.
