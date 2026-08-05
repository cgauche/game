import type { QuadTailDef } from '../types';
import { quadHeadDef } from '../../heads';
import { QUEUE_BACK_REPTILE } from '../kit';

export const quadTail: QuadTailDef = {
  key: 'reptile',
  label: 'Reptilienne (traînante)',
  params: ['head', 'ridge'],
  art: {
    // longue queue écailleuse qui TRAÎNE derrière au ras du sol — l'os `queue` penche à 42° (queues
    // pendantes) : on compense dans l'art (miroir + rotate -34 ⇒ ~8° de chute vers l'arrière).
    // Avant, elle pendait sous le ventre vers l'avant (!).
    profile: (p) => {
      // Tête qui DÉCLARE `tailCrest` (hydre) / dorsale 'epines-continues' (basilic) : la crête
      // @cheveux se PROLONGE sur la queue jusqu'à la pointe (artwork).
      const crest = quadHeadDef(p.head).tailCrest || p.ridge === 'epines-continues'
        ? `<path d="M4 0 Q2.6 -5 0.8 -6.8 Q3.6 -5.2 6.6 -0.6 Z M12 0.4 Q10.6 -5.4 8.6 -7.2 Q11.6 -5.4 14.6 -0.2 Z M20 0.8 Q18.8 -4.6 16.8 -6.4 Q19.8 -4.8 22.6 0.4 Z M28 1.4 Q27 -3.8 25 -5.4 Q28 -4 30.6 1 Z M36 2.4 Q35.2 -2.4 33.4 -4 Q36.2 -2.6 38.6 2 Z M44 4.6 Q44 -0.8 42.6 -2.8 Q45.4 -0.6 47.2 5 Z" fill="@cheveux" stroke="@cheveuxO" stroke-width="0.4"/>`
        : '';
      return `<g transform="rotate(-34) scale(-1,1)"><path d="M0 -2 Q16 4 28 2 Q40 0 50 9 Q41 5 30 7 Q16 11 0 6 Z" fill="@corps" stroke="@corpsO" stroke-width="0.6"/><path d="M6 1 l1.5 -3 M14 1 l1.5 -3 M22 0.6 l1.5 -3 M30 1 l1.4 -2.6 M38 2.4 l1.2 -2.4" stroke="@corpsO" stroke-width="1" stroke-linecap="round"/>${crest}</g>`;
    },
    back: QUEUE_BACK_REPTILE,
  },
};
