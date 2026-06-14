/**
 * Importe les statblocs de créatures du guide fan frenchy.bzh → CreatureData[] (notre schéma),
 * en normalisant Traits/Compétences/Talents via term-map.json, en HALVANT les PA (règle « v4.5 »
 * PA×2 → on revient au RAW), et en taguant source.book = 'frenchy.bzh'.
 *
 * Détection des statblocs ancrée sur la TABLE de caractéristiques (le nom = en-tête le plus proche
 * au-dessus) → gère aussi bien les profils « Niveau 1-4 » (animaux, humanoïdes) que les créatures
 * nommées sans niveau (démons…).
 *
 * Sortie : src/data/frenchy-creatures.json (mergé dans `creatures` via src/data/index.ts).
 *
 * Usage :
 *   node scripts/frenchy/import-creatures.mjs            # pilote (Loups) → stdout
 *   node scripts/frenchy/import-creatures.mjs --write     # tous les chapitres Partie II → écrit le .json
 *   node scripts/frenchy/import-creatures.mjs "48 - Démons de Khorne.md"
 */
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..', '..');
const PDF_DIR = resolve(ROOT, 'Source/Warhammer - Habitants & Créatures  du Vieux-Monde (Discord) PDF');
const TERM_MAP = JSON.parse(readFileSync(resolve(__dirname, 'term-map.json'), 'utf8'));

// Chapitres importés : Partie I « Habitants » (PNJ humains, ch.11-30) + Partie II « bestiaire »
// (ch.32-78 : Animaux, Bêtes Sauvages, Puissances de la Ruine, Skavens, Peaux-Vertes, Morts-Vivants,
// Bêtes Monstrueuses). Auto-scanné. Front-matter 1-10 (avertissement/méthode/pré-tirés) + Annexes 79+ exclus.
const PART_II = readdirSync(PDF_DIR)
  .filter((f) => /\.md$/.test(f) && f !== '00 - Index.md')
  .map((f) => ({ f, n: parseInt(f, 10) }))
  .filter((x) => x.n >= 11 && x.n <= 78)
  .sort((a, b) => a.n - b.n)
  .map((x) => x.f);

const CHAR_ORDER = ['M', 'CC', 'CT', 'F', 'E', 'I', 'Ag', 'Dex', 'Int', 'FM', 'Soc', 'B'];
const PLUS_TRAITS = new Set(['Arme', 'Morsure', 'Cornes', 'Souffle', 'Attaque caudale', 'Tentacules']);

function normKey(s) {
  return (s || '')
    .replace(/\(.*$/s, '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/œ/g, 'oe').replace(/æ/g, 'ae')
    .replace(/[^a-z0-9]+/g, '');
}

const IDX = {};
for (const cat of ['skills', 'talents', 'traits']) {
  IDX[cat] = new Map();
  for (const [frenchy, e] of Object.entries(TERM_MAP[cat])) IDX[cat].set(normKey(frenchy), e);
}
// Nos labels exacts par catégorie — le statbloc emploie parfois NOTRE terme directement
// (ex. « Instable ») alors que l'annexe liste un autre mot frenchy (« Instabilité »).
const OURS = {};
for (const [cat, file] of [['skills', 'skills.json'], ['talents', 'talents.json'], ['traits', 'traits.json']]) {
  const arr = JSON.parse(readFileSync(resolve(ROOT, 'src/data', file), 'utf8'));
  OURS[cat] = new Map(arr.map((x) => [normKey(x.label), x.label]));
}
// + traits homebrew curés du fan (src/data/frenchy-traits.json, taggés frenchy.bzh, mergés runtime
// dans `traits` via index.ts) : le statbloc les emploie → on les reconnaît (libellé propre, pas de warning).
for (const t of JSON.parse(readFileSync(resolve(ROOT, 'src/data/frenchy-traits.json'), 'utf8'))) OURS.traits.set(normKey(t.label), t.label);

const warnings = [];
const cells = (line) => { let c = line.split('|').map((x) => x.trim()); if (c[0] === '') c.shift(); if (c[c.length - 1] === '') c.pop(); return c; };
const isSep = (line) => /^\|[-:\s|]+\|?\s*$/.test(line.trim());
const clean = (s) => s.replace(/[*_]+/g, '').trim();

function splitName(raw) {
  let s = raw.replace(/[*_]+/g, '').replace(/\s+/g, ' ').trim();
  let rating = null, spec = null;
  const mPlus = s.match(/\s*\+\s*(\d+)\s*$/);
  if (mPlus) { rating = '+' + mPlus[1]; s = s.slice(0, mPlus.index).trim(); }
  const mRoll = !rating && s.match(/\s+(\d+)\s*\+\s*$/); // « Démonique 8+ » → spec « 8+ »
  if (mRoll) { spec = mRoll[1] + '+'; s = s.slice(0, mRoll.index).trim(); }
  const mNum = !rating && !spec && s.match(/\s+(\d+)\s*$/);
  if (mNum) { rating = mNum[1]; s = s.slice(0, mNum.index).trim(); }
  const mVs = s.match(/\s+VS\s+(.+)$/i);
  if (mVs && !spec) { spec = mVs[1].trim(); s = s.slice(0, mVs.index).trim(); }
  const mSpec = s.match(/\(([^)]+)\)\s*$/);
  if (mSpec) { spec = mSpec[1].trim(); s = s.slice(0, mSpec.index).trim(); }
  return { base: s, spec, rating };
}

// Termes de statbloc ≠ de l'annexe → alias direct vers notre label.
const STATBLOC_ALIASES = {
  acuitesensorielle: 'Sens aiguisé',
  corruptionmentale: 'Corruption mentale',
  demonique: 'Démoniaque',
  visiondanslenoir: 'Infravision',
  visiondanslobscurite: 'Infravision',
  flammesdetzeentch: 'Feu de Tzeentch', // Tzeentch's Fire
  scission: 'Dédoublement', // Split
};
// Alias TRAIT-ONLY : terme ambigu entre catégories. « Distraction » = Perturbant (Distracting, aura -20)
// en TRAIT, mais = Divertissement en COMPÉTENCE → ne PAS globaliser (casserait la compétence).
const TRAIT_ALIASES = { distraction: 'Perturbant' };
// Alias TALENT-ONLY : talents existants que le fan renomme/reskine et place en « Traits & Talents »
// (Attrayante=Attractive, Blablater=Blather, Sens de la Magie=Magical Sense) → routés en talents[].
const TALENT_ALIASES = { attrayante: 'Attirant', blablater: 'Baratiner', sensdelamagie: 'Perception de la magie' };
const stripParam = (s) =>
  s.replace(/\s*\((?:X|Indice|Type|Cible|Divers|Aspect|Rating|Various|Target|Strength|Difficulty|Group|Lore|Sense|Threat|Terrain|Trade|Range|Portée)\)\s*$/i, '').trim();

function mapTerm(cat, raw) {
  let { base, spec, rating } = splitName(raw);
  const mTaille = base.match(/^Taille\s+(.+)$/i);
  if (mTaille) { base = 'Taille'; spec = mTaille[1].trim(); }
  const mCorr = base.match(/^Corruption\s+(Mineure|Mod[ée]r[ée]e|Majeure|Faible|Moyenne|Forte)$/i);
  if (mCorr) { base = 'Corruption'; spec = mCorr[1].trim(); }
  const ak = normKey(base);
  let label, resolved;
  const e = IDX[cat].get(ak);
  if (cat === 'traits' && TRAIT_ALIASES[ak]) { label = TRAIT_ALIASES[ak]; resolved = true; }
  else if (cat === 'talents' && TALENT_ALIASES[ak]) { label = TALENT_ALIASES[ak]; resolved = true; }
  else if (STATBLOC_ALIASES[ak]) { label = STATBLOC_ALIASES[ak]; resolved = true; }
  else if (e && e.ours) { label = e.ours; resolved = true; }
  else if (OURS[cat].get(ak)) { label = OURS[cat].get(ak); resolved = true; } // statbloc = notre terme exact
  else { label = stripParam((e && e.official) || (e && e.vo) || base); resolved = false; }
  let out = label;
  if (rating) out += PLUS_TRAITS.has(label) || rating.startsWith('+') ? ` +${rating.replace('+', '')}` : ` ${rating}`;
  if (spec && !/^(X|Indice|Type|Cible|Divers|Portée|Rating|Various)$/i.test(spec)) out += ` (${spec})`;
  return { label: out, resolved };
}

const KW = {
  competences: 'Compétences', talents: 'Talents', traits: 'Traits',
  traitstalents: 'TT', traitsettalents: 'TT',
  traitsoptionnels: 'Optionals', // « Traits Optionnels » (GM-facing) → champ optionals[]
};
const SPELL_SEC = /^(sorts?|sortil|magie|b[ée]n[ée]diction|miracle|p[ée]tition|incantation)/i;

function parseTier(block, page, group) {
  const lines = block.split('\n');
  const nom = (s) => clean(s.replace(/<br\s*\/?>/gi, ' ')).replace(/\s+/g, ' ').trim();
  const firstCell = (ln) => nom(cells(ln).find((x) => clean(x)) || '');
  // Nom de trait : si la 1re cellule est un marqueur de palier (« shaman 3 », « grand shaman 4 »…),
  // le vrai nom est en 2e cellule (table d'upgrade malformée : | shaman 3 | Leader | … | → Leader).
  const traitName = (ln) => { const cs = cells(ln).map(nom).filter(Boolean); return cs.length >= 3 && /^\S+\s+\d+$/.test(cs[0]) ? cs[1] : cs[0] || ''; };
  const isHdr = (n) => /^(Nom|Niv|Description|Traits|Talents|Compétences|Trait V[FO]|Traits? Optionnels|shaman)$/i.test(n);

  // -- caractéristiques --
  const char = {};
  for (let i = 0; i < lines.length; i++) {
    const c = cells(lines[i]).map(clean);
    if (c.length >= 12 && c[0] === 'M' && c.includes('CC') && (c.includes('PB') || c.includes('PV'))) {
      for (let j = i + 1; j < lines.length; j++) {
        if (!lines[j].trim().startsWith('|') || isSep(lines[j])) continue;
        const v = cells(lines[j]);
        if (v.length < 12) continue;
        v.forEach((val, k) => { const cl = clean(val); char[CHAR_ORDER[k]] = (cl === '—' || cl === '-' || cl === '') ? null : parseInt(cl, 10); });
        break;
      }
      break;
    }
  }

  const traits = [];
  const pushTrait = (l) => { if (l && !traits.includes(l)) traits.push(l); };

  // -- PA (HALVÉ) + arme (prose) --
  const prose = block.replace(/\n/g, ' ');
  const mPA = prose.match(/Points\s+d['’]Armure[^\n]*?(\d+)\s*PA/i);
  if (mPA) { const h = Math.floor(parseInt(mPA[1], 10) / 2); if (h > 0) pushTrait(`Armure ${h}`); }
  const mDmg = prose.match(/D[ée]g[âa]ts\s*DR\s*\+\s*(\d+)/i);
  if (mDmg) pushTrait(`Arme +${mDmg[1]}`);

  // -- Peur / Terreur annoncées dans un titre/ligne en gras --
  for (const ln of lines) {
    const t = ln.trim();
    if (!(/^#{1,6}\s/.test(t) || /^\*\*/.test(t))) continue;
    const mp = t.match(/\bPeur\s+(\d+)/i); if (mp) pushTrait(`Peur ${mp[1]}`);
    const mt = t.match(/\bTerreur\s+(\d+)/i); if (mt) pushTrait(`Terreur ${mt[1]}`);
  }

  // -- segmentation des sections --
  const headerName = (ln) => {
    const t = ln.trim();
    if (t.startsWith('|')) {
      const c = cells(t).map(clean).filter(Boolean);
      if (!c.length) return null;
      // En-tête de section en TABLE dont TOUTES les cellules sont des variantes de « Compétences »
      // (« |Compétences Utiles|Compétences Utiles| » des démons, « |Compétences de Carrière|Autres
      // Compétences Utiles| ») → démarre la section Compétences (sinon ces statblocs avaient 0 skill).
      if (c.every((x) => /comp[ée]tences/i.test(x))) return 'Compétences';
      if (c.length === 1) return KW[normKey(c[0])] || (SPELL_SEC.test(c[0]) ? 'Sorts' : null);
      return null;
    }
    const isHeading = /^#{1,6}\s/.test(t) || /^\*\*[^|*][^|]*\*\*\s*$/.test(t);
    if (!isHeading) return null;
    const bare = t.replace(/^#+\s*/, '').replace(/[*_]/g, '').trim();
    if (KW[normKey(bare)]) return KW[normKey(bare)];
    if (/^comp[ée]tences/i.test(bare)) return 'Compétences'; // « Compétences Utiles » en titre autonome
    if (SPELL_SEC.test(bare)) return 'Sorts';
    return 'RESET';
  };
  const sections = { Compétences: [], Talents: [], Traits: [], TT: [], Sorts: [], Optionals: [] };
  let curSec = null;
  for (const ln of lines) {
    const h = headerName(ln);
    if (h === 'RESET') { curSec = null; continue; }
    if (h) { curSec = h; continue; }
    if (curSec && ln.trim().startsWith('|')) sections[curSec].push(ln);
  }

  // Traits : table Nom|Desc
  for (const ln of sections.Traits) {
    if (isSep(ln)) continue;
    const name = traitName(ln);
    if (!name || isHdr(name)) continue;
    const m = mapTerm('traits', name);
    if (!m.resolved) warnings.push(`trait non résolu: « ${name} » → « ${m.label} »`);
    pushTrait(m.label);
  }

  // Traits Optionnels (GM-facing) → optionals[] (mappés comme des traits)
  const optionals = [];
  for (const ln of sections.Optionals) {
    if (isSep(ln)) continue;
    const name = firstCell(ln);
    if (!name || isHdr(name)) continue;
    const l = mapTerm('traits', name).label;
    if (l && !optionals.includes(l)) optionals.push(l);
  }

  // Talents
  const talents = [];
  const pushTalent = (l) => { if (l && !talents.includes(l)) talents.push(l); };
  for (const ln of sections.Talents) {
    if (isSep(ln)) continue;
    const name = firstCell(ln);
    if (!name || isHdr(name)) continue;
    pushTalent(mapTerm('talents', name).label);
  }

  // Section combinée « Traits & Talents » : router chaque nom selon ce qui résout.
  for (const ln of sections.TT) {
    if (isSep(ln)) continue;
    const name = firstCell(ln);
    if (!name || isHdr(name)) continue;
    const asTrait = mapTerm('traits', name);
    if (asTrait.resolved) { pushTrait(asTrait.label); continue; }
    const asTalent = mapTerm('talents', name);
    if (asTalent.resolved) { pushTalent(asTalent.label); continue; }
    warnings.push(`trait non résolu: « ${name} » → « ${asTrait.label} »`);
    pushTrait(asTrait.label); // par défaut : trait custom hors-moteur
  }

  // Compétences : « Nom<br>valeur<br>… »
  const skills = [];
  const isValue = (f) => /^\d/.test(f) || /\bDR\b/.test(f) || /^[+\-]?\d+\s*\(/.test(f);
  for (const ln of sections.Compétences) {
    if (isSep(ln)) continue;
    for (const cell of cells(ln)) for (const frag of cell.split(/<br\s*\/?>/i)) {
      const f = clean(frag);
      if (!f || isValue(f) || /comp[ée]tences|carri[èe]re|^utiles$|^nom$|^autres/i.test(f)) continue;
      const l = mapTerm('skills', f).label;
      if (l && !skills.includes(l)) skills.push(l);
    }
  }

  // Sorts : noms fan (pas d'annexe de sorts → non mappés)
  const spells = [];
  for (const ln of sections.Sorts) {
    if (isSep(ln)) continue;
    const name = firstCell(ln);
    if (!name || /^(Nom|Sort|Sortil|Magie|VF|VO|Port[ée]e|Cible|Dur[ée]e|Description|CN|NI|Effet)/i.test(name)) continue;
    if (!spells.includes(name)) spells.push(name);
  }

  return { char, traits, talents, skills, spells, optionals };
}

/**
 * Apparence par défaut (bloc `appearance` du record) dérivée du CHAPITRE — pour que le rig rende ces
 * créatures comme leur espèce et non en Humain par défaut. Donnée, pas regex de rendu : c'est posé
 * sur le record (P2/B1, src/data app-owned). Les chapitres ANIMAUX (Chiens/Chevaux/Loups/Ours/
 * Sangliers/Rats Géants/Araignées) sont des non-bipèdes rendus par leur gabarit (bodyPlanOf) → pas
 * d'`appearance` ici ; les nuées non reconnues par le classifieur restent à traiter à part.
 */
function appearanceFor(group, name) {
  if (/^Nu[eé]e\b/i.test(name)) return undefined; // nuée → gabarit `swarm` (trait), pas d'espèce bipède
  if (/Skaven|Clans Mineurs|Vermines de Choc/i.test(group)) return { species: 'Skaven' };
  if (/Ungors|Gors|Bestigors/i.test(group)) return { species: 'Homme-bête' };
  if (/Guerriers du Chaos/i.test(group)) return { species: 'Guerrier du Chaos' };
  if (/Maraudeurs du Chaos|Sorcier du Chaos/i.test(group)) return { species: 'Humain' };
  if (/Démons de/i.test(group)) return { species: /Daemonette|Démonette/i.test(name) ? 'Démonette' : 'Démon' };
  return undefined; // animaux/nuées : non-bipèdes (gabarit) — pas d'apparence bipède
}

function importChapter(file) {
  const text = readFileSync(join(PDF_DIR, file), 'utf8');
  const group = file.replace(/^\d+ - /, '').replace(/\.md$/, '');
  const lines = text.split('\n');
  const pageAt = []; let pg = 0;
  for (let i = 0; i < lines.length; i++) { const m = lines[i].trim().match(/^(\d+)\s+sur\s+630/); if (m) pg = +m[1]; pageAt[i] = pg; }

  const isCaracHdr = (ln) => { const c = cells(ln).map(clean); return c.length >= 12 && c[0] === 'M' && c.includes('CC') && (c.includes('PB') || c.includes('PV')); };
  const isHeading = (t) => /^#{1,6}\s/.test(t) || /^\*\*[^|*][^|]*\*\*\s*$/.test(t);
  // Lignes-titres à NE PAS prendre pour un nom de créature : sections, footnotes (nombre seul),
  // et niveaux sociaux skavens (Cuivre/Argent/Or N) glissés entre le nom et la table.
  const isLabel = (n) => n === '' || /^\d+$/.test(n) ||
    /^(Caract|Comp[ée]tences|Talents|Traits|Sorts|Sortil|Magie|Peur\b|Terreur\b|Tactique|Remarque|Points|Armes|Mouvement|B[ée]n[ée]diction|Miracle|Description|Rappel|Niveau|Statut|Cuivre|Argent|Or\b|Airain|Bronze|Laiton)\b/i.test(n);
  const cleanName = (t) => t.replace(/^#+\s*/, '').replace(/[*_]/g, '').replace(/\s+/g, ' ').trim()
    .replace(/^Niveau\s+\d+\s*[—–-]\s*/i, '') // préfixe « Niveau N — »
    .replace(/\d+$/, '').trim(); // marqueur de footnote collé (« Chien de Compagnie6 »)

  const heads = [];
  for (let i = 0; i < lines.length; i++) if (isCaracHdr(lines[i])) heads.push(i);
  const names = heads.map((ci) => {
    for (let j = ci - 1; j >= 0 && j >= ci - 12; j--) {
      const t = lines[j].trim();
      if (!t) continue;
      if (isHeading(t)) { const nm = cleanName(t); if (nm && !isLabel(nm)) return { idx: j, name: nm }; }
    }
    return { idx: ci, name: '?' };
  });

  const recs = [];
  heads.forEach((ci, k) => {
    const start = names[k].idx;
    const end = k + 1 < heads.length ? names[k + 1].idx : lines.length;
    const p = parseTier(lines.slice(start, end).join('\n'), pageAt[ci], group);
    if (!p.char || (p.char.CC == null && p.char.F == null)) { warnings.push(`char vide: ${group} / ${names[k].name}`); return; }
    const app = appearanceFor(group, names[k].name);
    // Une « Nuée de … » EST un essaim : on lui garantit le trait « Nuée » (LDB 85) — il pilote le
    // rendu (gabarit `swarm`) ET les mécaniques (×5 PB via swarmFromTraits). ⚠️ vérifier que char.B
    // est PAR créature (le ×5 le multiplie) : certaines nuées frenchy semblent déjà pré-essaimées.
    const traits = /^Nu[eé]e\b/i.test(names[k].name) && !p.traits.some((t) => /^Nu[eé]e\b/i.test(t))
      ? [...p.traits, 'Nuée'] : p.traits;
    recs.push({
      label: names[k].name, title: null, folder: `${group} (frenchy.bzh)`,
      char: p.char, traits, optionals: p.optionals, skills: p.skills, talents: p.talents,
      trappings: [], spells: p.spells, desc: null, source: { book: 'frenchy.bzh', page: pageAt[ci] },
      ...(app ? { appearance: app } : {}),
    });
  });
  return recs;
}

const args = process.argv.slice(2);
const write = args.includes('--write');
const explicit = args.filter((a) => a.endsWith('.md'));
const chapters = explicit.length ? explicit : write ? PART_II : ['36 - Loups.md'];

let all = [];
for (const ch of chapters) all = all.concat(importChapter(ch));

// Partie I (Habitants) : les rangs « Sergent / Capitaine / Jeune Recrue / Soldat… » se répètent
// d'un groupe à l'autre → on QUALIFIE les labels en collision par leur groupe (sinon le dédup les
// supprimerait). Les noms uniques (Apothicaire, Bourgmestre…) restent tels quels.
const labCount = {};
for (const c of all) labCount[c.label] = (labCount[c.label] || 0) + 1;
for (const c of all) {
  if (labCount[c.label] > 1) {
    const grp = c.folder.replace(' (frenchy.bzh)', '').replace(/\s*\([^)]*\)\s*$/, '').trim();
    c.label = `${c.label} (${grp})`;
  }
}

// Dédup : on COMPLÈTE le bestiaire, on ne duplique pas. Skip si le label existe déjà
// dans creatures.json (officiel gardé) ou en double dans le lot frenchy.
const existingLabels = new Set(JSON.parse(readFileSync(resolve(ROOT, 'src/data/creatures.json'), 'utf8')).map((c) => c.label));
const seen = new Set();
all = all.filter((c) => {
  if (c.label === '?' ) { warnings.push(`sans nom (ignoré)`); return false; }
  if (existingLabels.has(c.label)) { warnings.push(`collision officiel (ignoré): ${c.label}`); return false; }
  if (seen.has(c.label)) { warnings.push(`doublon frenchy (ignoré): ${c.label}`); return false; }
  seen.add(c.label); return true;
});

// NB : l'`appearance` des records est AUTHORÉE par appearanceFor() (session apparences, par chapitre) —
// régénérée à chaque run. Pas de couche de préservation ici (elle figerait leur itération).
const OUT_FILE = resolve(ROOT, 'src/data/frenchy-creatures.json');
if (write) {
  writeFileSync(OUT_FILE, JSON.stringify(all, null, 2), 'utf8');
  console.log(`Écrit src/data/frenchy-creatures.json — ${all.length} créatures (${chapters.length} chap.)`);
} else {
  console.log(JSON.stringify(all, null, 2));
}
if (warnings.length) {
  console.log(`\n── ${warnings.length} avertissement(s) (${new Set(warnings).size} uniques) ──`);
  for (const w of [...new Set(warnings)]) console.log('  ' + w);
}
