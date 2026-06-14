import careers from '../src/data/careers.json';
import { TENUE_MODELS } from '../src/gameIso/rig/parts/generated/careerTenues';
import { TENUES } from '../src/gameIso/rig/parts/tenues';

const gen = new Set(Object.keys(TENUE_MODELS).filter((k) => Object.keys((TENUE_MODELS as Record<string, object>)[k]).length));
const all = (careers as { label: string; class: string }[]);
const fallback = all.filter((c) => !gen.has(c.label));
const byClass: Record<string, number> = {};
for (const c of fallback) byClass[c.class] = (byClass[c.class] ?? 0) + 1;

console.log('Total carrières          :', all.length);
console.log('Avec tenue DÉDIÉE générée :', gen.size);
console.log('Tombent sur un archétype  :', fallback.length, `(${Math.round((100 * fallback.length) / all.length)}%)`);
console.log('Archétypes (classes) dispo:', Object.keys(TENUES).join(', '));
console.log('Répartition fallback/classe:', JSON.stringify(byClass));
console.log('Exemples fallback         :', fallback.slice(0, 10).map((c) => `${c.label}(${c.class})`).join(', '));
