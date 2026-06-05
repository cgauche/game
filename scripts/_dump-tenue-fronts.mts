/**
 * Dumpe le front (torse + tête) de chaque tenue de carrière vers
 * art-ref/directional/hero/tenues-front.json (gitignoré) — source pour le workflow
 * de génération des vues dos/profil des tenues. Lancer : npx tsx scripts/_dump-tenue-fronts.mts
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { GENERATED_CAREER_TENUES } from '../src/gameIso/rig/parts/generated/careerTenues';

const out: Record<string, { torse?: string; tete?: string }> = {};
for (const [career, set] of Object.entries(GENERATED_CAREER_TENUES)) {
  const e: { torse?: string; tete?: string } = {};
  const torse = (set as Record<string, unknown>).torse;
  const tete = (set as Record<string, unknown>).tete;
  if (typeof torse === 'string') e.torse = torse;
  else if (torse && typeof torse === 'object' && 'front' in torse) e.torse = (torse as { front: string }).front;
  if (typeof tete === 'string') e.tete = tete;
  else if (tete && typeof tete === 'object' && 'front' in tete) e.tete = (tete as { front: string }).front;
  if (e.torse || e.tete) out[career] = e;
}

mkdirSync('art-ref/directional/hero', { recursive: true });
writeFileSync('art-ref/directional/hero/tenues-front.json', JSON.stringify(out));
console.log(`OK: tenues-front.json — ${Object.keys(out).length} tenues (torse/tête)`);
