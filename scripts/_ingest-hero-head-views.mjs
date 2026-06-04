/**
 * Ingestion des vues dos+profil des TÊTES héros générées par le workflow
 * `hero-heads-directional-art` (art-ref/directional/hero/heads/<slug>/chosen.json,
 * art-ref/ gitignoré) → src/gameIso/rig/parts/generated/headViews.json.
 *
 * STAGING : ce fichier n'est PAS branché sur le rendu live tant qu'on n'a pas QC.
 * Pour l'activer après relecture : dans cosmetic.ts, composer le PartArt
 *   { front: GENERATED_HEADS[k].visage, ...HEAD_VIEWS[k]?.visage }
 * (idem cheveux) — pickView fera le reste.
 *
 *   node scripts/_ingest-hero-head-views.mjs
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const KEYS = ['Humain:M', 'Humain:F', 'Nain:M', 'Nain:F', 'Halfling:M', 'Halfling:F', 'Haut-Elfe:M', 'Haut-Elfe:F', 'Elfe sylvain:M', 'Elfe sylvain:F'];

const slug = (k) => k.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
const decode = (s) => String(s).replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&amp;/g, '&').trim();
const view = (o) => (o && (o.back || o.profile) ? { ...(o.back ? { back: decode(o.back) } : {}), ...(o.profile ? { profile: decode(o.profile) } : {}) } : null);

const out = {};
let n = 0;
for (const key of KEYS) {
  const p = join(root, 'art-ref/directional/hero/heads', slug(key), 'chosen.json');
  if (!existsSync(p)) continue;
  let data;
  try { data = JSON.parse(readFileSync(p, 'utf8')); } catch (e) { console.warn(`! ${key}: ${e.message}`); continue; }
  const entry = {};
  const vis = view(data.visage);
  const che = view(data.cheveux);
  if (vis) entry.visage = vis;
  if (che) entry.cheveux = che;
  if (Object.keys(entry).length) { out[key] = entry; n++; }
}

writeFileSync(join(root, 'src/gameIso/rig/parts/generated/headViews.json'), JSON.stringify(out, null, 0) + '\n');
console.log(`OK: headViews.json (STAGING) — ${n}/${KEYS.length} têtes avec vues dos/profil`);
