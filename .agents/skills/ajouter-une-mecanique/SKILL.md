---
name: ajouter-une-mecanique
description: À utiliser quand on implémente l'effet d'un trait, talent, qualité, mutation, maladie, atout ou consommable — ou dès qu'on est tenté d'ajouter un champ ad hoc, un type dédié ou un dispatch par nom d'entité pour un effet mécanique.
---
<!-- GENERATED: agents:sync; source=.claude/skills/ajouter-une-mecanique/SKILL.md -->

# Ajouter une mécanique d'entité

Lire **`docs/ajouter-une-mecanique.md`** — d'abord CHOISIR LE CANAL : `passive: GameOp[]` (continu,
collecteur `passiveMods`), `effects: TriggeredEffect[]` (déclenché, dispatcher UNIQUE `fireTriggers`),
`capabilities` (lu par le moteur). Tout effet s'exprime en `GameOp[]` édité au Codex (`GameOpEditor`).
« Difficile à exprimer » n'autorise JAMAIS la machinerie : on étend le vocabulaire
(`GameOp`/`Formula`/`Condition`) — frontière détaillée dans `docs/combat-events-coherence.md`.
