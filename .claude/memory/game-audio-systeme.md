---
name: game-audio-systeme
description: "Jalon 8 sons+musique LIVRÉ — registre SOUND_DEFS (SFX Kenney + musique RandomMind CC0), musique PARAMÉTRÉE PAR SCÈNE dans l'éditeur, canal fondu enchaîné, wiring bus+store"
metadata: 
  node_type: memory
  type: project
  originSessionId: df22e358-4438-4cca-b8e3-ad83ea327a2e
---

Jalon 8 audio LIVRÉ (2026-06-11, commits `f21a3f2` SFX + `8a8acff` musique).

- **Une seule famille de registre** `SOUND_DEFS` (`src/audio/defs/`, gen-registry, export `sound`) : SFX (19 .ogg Kenney CC0 — dés/impacts/parade/critique/sort/pas/gong/pièces/portes) ET musiques (4 .mp3 RandomMind CC0 OpenGameArt — exploration/ville/taverne/combat). Une def musique = champ `music.contexts: ('menu'|'exploration'|'interieur'|'combat')[]`. **Ajouter un son/piste = 1 fichier + 1 def + `npm run gen`.**
- **Musique par SCÈNE (demande utilisateur explicite : rien en dur)** : `Scene.music { ambient?, combat? }` — `undefined`=Automatique, `null`=Aucune, sinon id de def. Selects dans l'éditeur (Palette onglet Scène) alimentés par `allMusicDefs()` ; ids inconnus signalés par `validateScene`. Repli contexte : `audio/music.ts` PUR testé (`musicSelectionOf` : editor→silence, hors campagne→menu, battle→combat, sinon `isIndoor`→interieur/exploration).
- **Canal** (`audio/engine.ts`) : boucle + fondu 800ms, no-op si même sélection (clé `def:`/`ctx:`), volume musique séparé persistant (`wfrp4.audio.v1` : volume/musicVolume/muted), autoplay refusé → retente au premier `pointerdown`. DEV : `window.__music` pour les recettes (sel/def/el).
- **Wiring** (`audio/wiring.ts`) : SFX par le bus (DICE_ROLL/ANIM_IMPACT/ANIM_MOVE/BATTLE_OVER), musique par `useGame.subscribe`.
- Piège recette : chaque édition de fichier audio = full-reload HMR qui RÉINITIALISE l'état du jeu en cours de recette (re-séquencer après la dernière édition).

Prolonge [[game-creature-registry]]. UI : [[game-hud-mobile-actionbar]] (AudioControls dans le menu ☰, 2 sliders).
