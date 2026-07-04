import type { EyeDef } from '../types';
import { socle } from '../socle';

// Œil caprin : iris ambre, pupille en barre HORIZONTALE (chèvre/démon).
export const eye: EyeDef = {
  id: 'caprin',
  label: 'Œil caprin',
  catalogOrder: 2,
  art: `<g data-eye-art="caprin">${socle('<circle r="1.2" fill="#c8923a"/><rect x="-1" y="-0.38" width="2" height="0.76" rx="0.3" fill="#140a06"/>')}</g>`,
};
