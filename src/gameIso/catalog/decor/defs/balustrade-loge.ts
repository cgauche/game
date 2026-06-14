import type { PropViz } from '../../types';

// Balustrade de loge (3×1) : main courante dorée, balustres en pommeau, et tenture de velours
// rouge festonnée à clous dorés tendue sur le devant — le garde-corps d'une loge en surplomb.
export const prop: PropViz = {
  id: 'balustrade-loge',
  foot: { w: 3, h: 1 },
  label: 'Balustrade de loge',
  render: () =>
    `<g><ellipse cx="60" cy="147" rx="54" ry="8" fill="#000" opacity="0.2"/>` +
    `<path d="M8 104 Q23 130 38 108 Q53 130 68 108 Q83 130 98 108 Q108 122 112 110 L112 140 L8 140 Z" fill="#7a2222"/>` +
    `<path d="M8 104 Q23 130 38 108 Q53 130 68 108 Q83 130 98 108 Q108 122 112 110" stroke="#caa14a" stroke-width="2.5" fill="none"/>` +
    `<g fill="#d8b24e"><circle cx="23" cy="123" r="2.6"/><circle cx="53" cy="123" r="2.6"/><circle cx="83" cy="123" r="2.6"/></g>` +
    [16, 33, 50, 67, 84, 101]
      .map((x) => `<rect x="${x - 2.5}" y="92" width="5" height="16" rx="2" fill="#caa14a"/><circle cx="${x}" cy="92" r="4" fill="#d8b24e"/>`)
      .join('') +
    `<rect x="6" y="84" width="108" height="9" rx="4" fill="#d8b24e"/><rect x="6" y="84" width="108" height="3" rx="1" fill="#efdca0"/></g>`,
};
