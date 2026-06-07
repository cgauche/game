import type { MonsterPartDef } from '../types';

export const part: MonsterPartDef = {
  slot: 'tete',
  key: 'minuscule',
  label: "Tête minuscule (crétin)",
  order: 4,
  art: {
    front: `<g>
  <circle cx="0" cy="9" r="5" fill="@peau"/>
  <ellipse cx="-1.8" cy="8" rx="1" ry="1.4" fill="url(#g_eye)"/><circle cx="-1.8" cy="8" r="0.5" fill="#140a06"/>
  <ellipse cx="1.8" cy="8" rx="1" ry="1.4" fill="url(#g_eye)"/><circle cx="1.8" cy="8" r="0.5" fill="#140a06"/>
  <path d="M-1.5 11 q1.5 1.5 3 0" stroke="#7a5a3a" stroke-width="0.8" fill="none"/>
</g>`,
    back: `<g><circle cx="0" cy="9" r="5" fill="@peauO"/></g>`,
    profile: `<g><circle cx="0" cy="9" r="5" fill="@peau"/><ellipse cx="2" cy="8" rx="1" ry="1.4" fill="url(#g_eye)"/><circle cx="2" cy="8" r="0.5" fill="#140a06"/></g>`,
  },
};
