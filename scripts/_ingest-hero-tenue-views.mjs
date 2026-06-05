/**
 * Ingestion des vues dos+profil des TENUES (torse + coiffe) générées par le workflow
 * `hero-tenues-directional-art` (art-ref/directional/hero/tenues/<slug>/chosen.json,
 * gitignoré) → src/gameIso/rig/parts/generated/tenueViews.json (clé carrière →
 * {torse:{back,profile}, tete?:{back,profile}}). Branché live via career.ts.
 *
 *   node scripts/_ingest-hero-tenue-views.mjs
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const CAREERS = ['Agitateur', 'Artisan', 'Bourgeois', 'Enquêteur', 'Marchand', 'Mendiant', 'Milicien', 'Ratier', 'Artiste', 'Conseiller', 'Duelliste', 'Émissaire', 'Espion', 'Intendant', 'Noble', 'Serviteur', 'Cavalier', 'Chevalier', 'Garde', 'Gladiateur', 'Prêtre guerrier', 'Soldat', 'Spadassin', 'Tueur', 'Chasseur de primes', 'Cocher', 'Colporteur', 'Flagellant', 'Messager', 'Patrouilleur routier', 'Répurgateur', 'Saltimbanque', 'Apothicaire', 'Érudit', 'Ingénieur', 'Juriste', 'Médecin', 'Nonne', 'Prêtre', 'Sorcier', 'Batelier', 'Contrebandier', 'Débardeur', 'Femme du fleuve', 'Marin', 'Naufrageur', 'Nautonier', 'Patrouilleur fluvial', 'Charlatan', 'Entremetteur', 'Hors-la-loi', 'Pilleur de tombes', 'Rançonneur', 'Receleur', 'Sorcier dissident', 'Voleur', 'Bailli', 'Chasseur', 'Éclaireur', 'Herboriste', 'Mineur', 'Mystique', 'Sorcier de village', 'Villageois'];

const slug = (k) => k.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
const decode = (s) => String(s).replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&amp;/g, '&').trim();
const view = (o) => (o && (o.back || o.profile) ? { ...(o.back ? { back: decode(o.back) } : {}), ...(o.profile ? { profile: decode(o.profile) } : {}) } : null);

const out = {};
let n = 0;
for (const career of CAREERS) {
  const p = join(root, 'art-ref/directional/hero/tenues', slug(career), 'chosen.json');
  if (!existsSync(p)) continue;
  let data;
  try { data = JSON.parse(readFileSync(p, 'utf8')); } catch (e) { console.warn(`! ${career}: ${e.message}`); continue; }
  const entry = {};
  const torse = view(data.torse);
  const tete = view(data.tete);
  if (torse) entry.torse = torse;
  if (tete) entry.tete = tete;
  if (Object.keys(entry).length) { out[career] = entry; n++; }
}

writeFileSync(join(root, 'src/gameIso/rig/parts/generated/tenueViews.json'), JSON.stringify(out, null, 0) + '\n');
console.log(`OK: tenueViews.json — ${n}/${CAREERS.length} tenues avec vues dos/profil`);
