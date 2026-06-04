/**
 * Ingestion des vues directionnelles de créatures générées par le workflow
 * `creatures-directional-art` (art-ref/directional/creatures/<slug>/chosen.json,
 * art-ref/ étant gitignoré) → src/gameIso/creatureViews.json (clé bestiaire →
 * {back, profile}). Le front reste dans creatureSprites.json.
 *
 *   node scripts/_ingest-creature-views.mjs
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const sprites = JSON.parse(readFileSync(join(root, 'src/gameIso/creatureSprites.json'), 'utf8'));

const slug = (k) =>
  k.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

const decode = (s) =>
  String(s)
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'").replace(/&amp;/g, '&');

const out = {};
let n = 0;
for (const key of Object.keys(sprites)) {
  const p = join(root, 'art-ref/directional/creatures', slug(key), 'chosen.json');
  if (!existsSync(p)) continue;
  let data;
  try {
    data = JSON.parse(readFileSync(p, 'utf8'));
  } catch (e) {
    console.warn(`! JSON invalide pour ${key} (${slug(key)}): ${e.message}`);
    continue;
  }
  const back = decode(data.back ?? '').trim();
  const profile = decode(data.profile ?? '').trim();
  if (!back && !profile) continue;
  const entry = {};
  if (back) entry.back = back;
  if (profile) entry.profile = profile;
  out[key] = entry;
  n++;
}

writeFileSync(join(root, 'src/gameIso/creatureViews.json'), JSON.stringify(out, null, 0) + '\n');
console.log(`OK: src/gameIso/creatureViews.json — ${n}/${Object.keys(sprites).length} créatures avec vues directionnelles`);
