import type { EyeDef } from '../types';
import { socle } from '../socle';

// Œil de chat : iris vert, pupille en fente VERTICALE.
export const eye: EyeDef = {
  id: 'chat',
  label: 'Œil de chat',
  catalogOrder: 1,
  art: `<g data-eye-art="chat">${socle('<circle r="1.2" fill="#86a83e"/><ellipse rx="0.32" ry="1.05" fill="#140a06"/><circle cx="0.4" cy="-0.45" r="0.25" fill="#fff" opacity="0.8"/>')}</g>`,
};
