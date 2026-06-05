import { GENERATED_HEADS } from '../src/gameIso/rig/parts/generated/heads';
for (const [k, v] of Object.entries(GENERATED_HEADS)) {
  for (const slot of ['visage', 'cheveux'] as const) {
    const s = (v as Record<string, string>)[slot];
    if (!s) continue;
    const open = (s.match(/<g[ >]/g) || []).length;
    const close = (s.match(/<\/g>/g) || []).length;
    if (open !== close) console.log(`${k} ${slot}: <g> open=${open} close=${close}  (surplus close = ${close - open})`);
  }
}
console.log('audit done');
