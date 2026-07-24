/**
 * Câblage audio ← BUS d'événements (SFX) + STORE (musique de fond) :
 *  - DICE_ROLL → dés ;
 *  - ANIM_ATTACK (mémorise le contexte) + ANIM_IMPACT → impact/tranche/sort, parade, critique ;
 *  - ANIM_MOVE → pas espacés le long du chemin ; MOVE_BLOCKED → heurt sourd (#792) ;
 *  - BATTLE_OVER (victoire) → gong ;
 *  - écran/mode/scène (store) → contexte musical (`music.ts`) → canal musique (`engine.ts`).
 * Ajouter un son = 1 def dans `defs/` + (si nouvel événement) une ligne ici.
 */
import { bus, EVT } from '../state/bus';
import { useGame } from '../state/store';
import { playSfx, playMusic } from './engine';
import { musicSelectionOf } from './music';

let lastAttackKind: 'melee' | 'ranged' | 'spell' = 'melee';

export function initAudioWiring(): void {
  // Musique de fond pilotée par l'état : la scène (éditeur) a la main, sinon contexte
  // automatique (menu / exploration / intérieur / combat ; éditeur = silence).
  playMusic(musicSelectionOf(useGame.getState()));
  useGame.subscribe((s) => playMusic(musicSelectionOf(s)));
  bus.on(EVT.DICE_ROLL, () => playSfx('des'));
  bus.on(EVT.ANIM_ATTACK, (p: { kind?: 'melee' | 'ranged' | 'spell' }) => {
    lastAttackKind = p?.kind ?? 'melee';
  });
  bus.on(EVT.ANIM_IMPACT, (p: { result?: { hit?: boolean; critical?: boolean; parried?: boolean } }) => {
    const r = p?.result;
    if (!r) return;
    if (r.critical) return playSfx('critique');
    if (r.hit) return playSfx(lastAttackKind === 'spell' ? 'sort' : lastAttackKind === 'ranged' ? 'tranche' : 'impact');
    playSfx('parade'); // déjoué : parade/esquive — le métal claque
  });
  bus.on(EVT.ANIM_MOVE, (p: { path?: unknown[] }) => {
    const steps = Math.min(4, Math.max(1, Math.floor((p?.path?.length ?? 1) / 2)));
    for (let i = 0; i < steps; i++) setTimeout(() => playSfx('pas'), i * 220);
  });
  bus.on(EVT.MOVE_BLOCKED, () => playSfx('heurt'));
  bus.on(EVT.BATTLE_OVER, (p: { victory?: boolean }) => {
    if (p?.victory) playSfx('gong-victoire');
  });
}
