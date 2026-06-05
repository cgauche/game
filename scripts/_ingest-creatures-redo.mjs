/**
 * Ingestion des créatures REDESSINÉES (workflow creatures-redo-recognizable) :
 * art-ref/directional/creatures-redo/<slug>/chosen.json {front,back,profile} →
 * met à jour creatureSprites.json (front) ET creatureViews.json (back/profile).
 *   node scripts/_ingest-creatures-redo.mjs
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const LABELS = ['Chien', 'Basilic', 'Pégase', 'Pieuvre des tourbières', 'Troll', 'Zombie', 'Goule de crypte', 'Manticore', 'Chauve-souris vampire (Varghulf)', 'Démonette de Slaanesh', 'Sanguinaire de Khorne', 'Guerrier des clans', 'Vermine de choc', 'Rat ogre'];

const slug = (k) => k.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
const decode = (s) => String(s || '').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&amp;/g, '&').trim();

const spritesPath = join(root, 'src/gameIso/creatureSprites.json');
const viewsPath = join(root, 'src/gameIso/creatureViews.json');
const sprites = JSON.parse(readFileSync(spritesPath, 'utf8'));
const views = JSON.parse(readFileSync(viewsPath, 'utf8'));

let n = 0;
for (const label of LABELS) {
  const p = join(root, 'art-ref/directional/creatures-redo', slug(label), 'chosen.json');
  if (!existsSync(p)) { console.warn(`! manquant: ${label}`); continue; }
  let d;
  try { d = JSON.parse(readFileSync(p, 'utf8')); } catch (e) { console.warn(`! ${label}: ${e.message}`); continue; }
  const front = decode(d.front), back = decode(d.back), profile = decode(d.profile);
  if (front) sprites[label] = front;
  const v = {};
  if (back) v.back = back;
  if (profile) v.profile = profile;
  if (Object.keys(v).length) views[label] = v;
  if (front || back || profile) n++;
}

writeFileSync(spritesPath, JSON.stringify(sprites) + '\n');
writeFileSync(viewsPath, JSON.stringify(views, null, 0) + '\n');
console.log(`OK: ${n}/${LABELS.length} créatures redessinées ingérées (creatureSprites + creatureViews).`);
