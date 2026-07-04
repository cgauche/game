import type { MonsterPartDef } from '../types';
import { OV_QUEUE_RAT, OV_QUEUE_RAT_PROFILE } from '../../monsterOverlays';
import { ratEye } from '../eyes';

export const part: MonsterPartDef = {
  slot: 'tete',
  key: 'rat',
  queue: { front: OV_QUEUE_RAT, back: OV_QUEUE_RAT, profile: OV_QUEUE_RAT_PROFILE },
  label: "Rat / skaven",
  order: 5,
  art: {
    front: `<g>
  <circle cx="-7" cy="-1" r="4.3" fill="@peau" stroke="@peauO" stroke-width="0.6"/><circle cx="-7" cy="-1" r="2.2" fill="#caa597"/>
  <circle cx="7" cy="-1" r="4.3" fill="@peau" stroke="@peauO" stroke-width="0.6"/><circle cx="7" cy="-1" r="2.2" fill="#caa597"/>
  <path d="M-6 3 Q-7 -4 0 -5 Q7 -4 6 3 Q5 12 0 16 Q-5 12 -6 3 Z" fill="@peau" stroke="@peauO" stroke-width="0.6"/>
  <path d="M-6 3 Q0 6 6 3 L5 9 Q0 11 -5 9 Z" fill="@peauO" opacity="0.45"/>
  <path d="M-2 13 q-6 1 -8.5 -1 M2 13 q6 1 8.5 -1 M-2 14.2 q-6 2 -9 1 M2 14.2 q6 2 9 1" stroke="#cfc8b8" stroke-width="0.4" opacity="0.5"/>
  <ellipse cx="0" cy="14.5" rx="2" ry="1.5" fill="#d68a96"/>
  <path d="M-1.3 15.6 l-0.2 2.6 M1.3 15.6 l0.2 2.6" stroke="#efe6cf" stroke-width="1.3" stroke-linecap="round"/>
  ${ratEye(-3.2)}${ratEye(3.2)}
</g>`,
    back: `<g>
  <circle cx="-7" cy="-1" r="4.3" fill="@peauO" stroke="@peauO" stroke-width="0.5"/><circle cx="7" cy="-1" r="4.3" fill="@peauO" stroke="@peauO" stroke-width="0.5"/>
  <path d="M-6 3 Q-7 -4 0 -5 Q7 -4 6 3 Q5 13 0 16 Q-5 13 -6 3 Z" fill="@peauO"/><path d="M0 -4 L0 14" stroke="@peau" stroke-width="0.5" opacity="0.4"/>
</g>`,
    profile: `<g>
  <circle cx="-2" cy="-2" r="4" fill="@peau" stroke="@peauO" stroke-width="0.5"/><circle cx="-2" cy="-2" r="2" fill="#caa597"/>
  <path d="M-6 1 Q-6 -6 0 -6 Q6 -5 9 -1 Q15 1 18 5 Q15 8 9 7 L4 11 Q-2 12 -6 8 Z" fill="@peau" stroke="@peauO" stroke-width="0.6"/>
  <ellipse cx="18" cy="5" rx="1.6" ry="1.3" fill="#d68a96"/>
  <path d="M16 7 q-3 4 -6 2" stroke="#efe6cf" stroke-width="1.2" stroke-linecap="round"/>
  <path d="M13 8 q5 1 7 -1 M12 9 q5 2 8 1" stroke="#cfc8b8" stroke-width="0.4" opacity="0.5"/>
  <ellipse cx="3" cy="2" rx="1.7" ry="1.4" fill="#cc3a1a"/><ellipse cx="3" cy="2" rx="0.55" ry="1.4" fill="#180a04"/><circle cx="3.5" cy="1.4" r="0.35" fill="#ffd9a0" opacity="0.7"/>
</g>`,
  },
};
