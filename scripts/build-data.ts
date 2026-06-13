/**
 * Pipeline de données — génère NOTRE base de jeu depuis les sources WFRP4.
 *
 * Lit Source/all-data.json, filtre aux livres autorisés (Livre de base +
 * Archives de l'Empire I & II + EDO / Middenheim / EDOC), normalise et
 * réécrit dans src/data/*.json.
 *
 * IMPORTANT : on ne livre jamais all-data.json tel quel ; ce script produit
 * notre propre format. Lancer avec `npm run build:data`.
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync, unlinkSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const SRC = resolve(ROOT, 'Source/all-data.json');
const OUT = resolve(ROOT, 'src/data');

/** Livres autorisés (contenu complet) : Livre de base + Archives de l'Empire I & II + suppléments
 *  retenus par le GM — EDO (L'Ennemi dans l'Ombre : sorts de Tzeentch, créatures du Chaos),
 *  Middenheim (3 origines humaines + carrière Frère Loup), EDOC (véhicules du Compagnon),
 *  NADJ (Nuits Agitées & Dures Journées : espèce Gnomes + dieux gnomes Evawn/Mabyn/Ringil). */
const ALLOWED = new Set(['LDB', 'ADE1', 'ADE2', 'EDO', 'Middenheim', 'EDOC', 'NADJ']);
/** Livres de CAMPAGNE (règle 2 : le contenu de campagne est éditable/posable) — admis pour le
 *  BESTIAIRE SEULEMENT : les statblocs de PNJ nommés (Eusapia Balacañon…) sont du contenu de
 *  scénario, pas des règles génériques (règle 1 reste LDB/ADE pour tout le reste). */
const CAMPAIGN = new Set(['MSR', 'PDT']);
/** Entrées EXCLUES même si leur livre est autorisé : la classe « Chaos » d'EDO et ses carrières
 *  (Magus du culte de Tzeentch) restent du contenu PNJ/ennemi — pas jouables à la création. Les
 *  sorts de Tzeentch, eux, restent inclus (le grimoire les verrouille au joueur via le Talent requis). */
const DENY_CLASS = new Set(['Chaos']);

type Any = Record<string, any>;

function norm(v: any): any {
  // Normalise les tirets « pas de valeur » en null, garde les nombres.
  if (v === '–' || v === '-' || v === '' || v === undefined) return null;
  return v;
}

function splitList(s: any): string[] {
  if (!s || typeof s !== 'string') return [];
  // Sépare sur les virgules de premier niveau (en respectant les parenthèses).
  const out: string[] = [];
  let depth = 0;
  let cur = '';
  for (const ch of s) {
    if (ch === '(') depth++;
    if (ch === ')') depth--;
    if (ch === ',' && depth === 0) {
      if (cur.trim()) out.push(cur.trim());
      cur = '';
    } else cur += ch;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}

function allowed(x: Any): boolean {
  // Certaines entrées n'ont pas de champ book (ex. talent aléatoire) : on garde.
  if (!x.book) return true;
  return ALLOWED.has(x.book);
}

function write(name: string, data: unknown, count: number) {
  writeFileSync(resolve(OUT, name), JSON.stringify(data, null, 2), 'utf8');
  console.log(`  ✓ ${name.padEnd(22)} ${count} entrées`);
}

function main() {
  if (!existsSync(SRC)) {
    console.error(`Source introuvable : ${SRC}`);
    process.exit(1);
  }
  if (!existsSync(OUT)) mkdirSync(OUT, { recursive: true });
  const raw: Any = JSON.parse(readFileSync(SRC, 'utf8'));
  const skipped: Record<string, number> = {};
  const keep = (arr: Any[]) =>
    arr.filter((x) => {
      const ok = allowed(x);
      if (!ok) skipped[x.book] = (skipped[x.book] ?? 0) + 1;
      return ok;
    });

  console.log(`Génération de la base de jeu (${[...ALLOWED].join(' + ')})…`);

  // --- Caractéristiques -----------------------------------------------------
  const characteristics = raw.characteristic.map((c: Any) => ({
    abr: c.abr,
    label: c.label,
    type: c.type,
    desc: c.desc,
    base: c.rand ?? {}, // base par espèce (ex. Humain: 20)
    source: { book: c.book, page: c.page },
  }));
  write('characteristics.json', characteristics, characteristics.length);

  // --- Espèces (avec profil de base reconstruit) ---------------------------
  // TOUT le Tableau des Attributs (LDB 05 l.396-413) vient de raw.characteristic, qui porte
  // une colonne par refChar : les 10 Caractéristiques (abr), puis les lignes Blessure (formule),
  // Destin, Résilience, Extra Points et Mouvement — rien n'est codé en dur, les suppléments
  // (Gnome, Ogre…) sont couverts par leurs colonnes.
  const attrRow = (label: string): Record<string, any> =>
    raw.characteristic.find((c: Any) => c.label === label)?.rand ?? {};
  const ROW_MOVE = attrRow('Mouvement');
  const ROW_FATE = attrRow('Destin');
  const ROW_RESILIENCE = attrRow('Résilience');
  const ROW_EXTRA = attrRow('Extra Points');
  const ROW_WOUNDS = attrRow('Blessure'); // formule : « (2 × BE)+BFM » (sans BF) ⇒ talent Petit
  const species = raw.specie.map((s: Any) => {
    const baseChar: Record<string, number> = {};
    for (const c of raw.characteristic) {
      if (!c.rand || !c.abr || c.abr === 'B' || c.abr === 'M') continue;
      const v = c.rand[s.refChar];
      if (typeof v === 'number') baseChar[c.abr] = v;
    }
    const woundsFormula = String(ROW_WOUNDS[s.refChar] ?? 'BF+(2 × BE)+BFM');
    return {
      label: s.label,
      refChar: s.refChar,
      refCareer: s.refCareer,
      rand: s.rand,
      desc: s.desc,
      movement: Number(ROW_MOVE[s.refChar]) || 4,
      fate: {
        fate: Number(ROW_FATE[s.refChar]) || 0,
        resilience: Number(ROW_RESILIENCE[s.refChar]) || 0,
        extra: Number(ROW_EXTRA[s.refChar]) || 0,
      },
      // Blessures SANS le Bonus de Force (BF seul, pas le BFM de « +BFM ») = talent Petit
      // (Halfling/Gnome : « (2 × BE)+BFM ») ; l'Ogre « (BF+(2×BE)+BFM)×2 » en a un.
      small: !/BF(?!M)/.test(woundsFormula),
      baseChar, // ex. { CC: 20, CT: 20, ... } — on ajoute 2d10 à la création
      // Compétences/Talents raciaux (Livre de base, étape 4 de création) :
      // liste de Compétences d'espèce (3 reçoivent +5, 3 reçoivent +3) et
      // Talents (« A ou B » = choix, fixes, « N Talent aléatoire » = table d100).
      skills: splitList(s.skills),
      talents: splitList(s.talents),
      source: { book: s.book, page: s.page },
    };
  });
  write('species.json', species, species.length);

  // --- Cultes (dieux : six Bénédictions + Miracles, LDB 41-42) → cults/defs/ GÉNÉRÉS ----------
  // Les cultes sont du DATA de livre (type `god`) : build-data écrit un fichier `defs/` par dieu
  // AUTORISÉ (le registre gen-registry les assemble). Le dossier `defs/` est 100 % généré : ajouter
  // un dieu = autoriser son livre. Bénédictions = libellés complets ; Miracles = séparés par « ; ».
  const deburr = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '');
  const CULTS_DIR = resolve(ROOT, 'src/engine/cults/defs');
  if (existsSync(CULTS_DIR)) {
    for (const f of readdirSync(CULTS_DIR)) if (f.endsWith('.ts') && !f.startsWith('_')) unlinkSync(join(CULTS_DIR, f));
  } else {
    mkdirSync(CULTS_DIR, { recursive: true });
  }
  const cultDefs = keep(raw.god as Any[]).map((g: Any) => {
    const slug = deburr(String(g.label)).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    // Miracles d'un culte = colonne `god` (suppléments, ex. dieux gnomes NADJ ; séparés par « ; »)
    // ∪ les sorts d'Invocation du culte (type Invocation, subType = nom du culte). Cette 2ᵉ source
    // est celle des cultes LDB (dont la colonne `god` miracles est vide).
    const godMiracles = String(g.miracles ?? '').split(';').map((x: string) => x.trim()).filter(Boolean);
    const invocationMiracles = (raw.spell as Any[])
      .filter((s) => s.type === 'Invocation' && s.subType === g.label && allowed(s))
      .map((s) => String(s.label));
    const def = {
      key: g.label,
      title: norm(g.title) ?? undefined,
      blessings: splitList(g.blessings),
      miracles: [...new Set([...godMiracles, ...invocationMiracles])],
    };
    const body = `import type { CultDef } from '../types';\n\n// ⚠️ GÉNÉRÉ par build-data depuis all-data.json (god) — NE PAS éditer à la main.\nexport const cult: CultDef = ${JSON.stringify(def, null, 2)};\n`;
    writeFileSync(join(CULTS_DIR, `${slug}.ts`), body, 'utf8');
    return def;
  });
  console.log(`  ✓ cults/defs/ (généré)   ${cultDefs.length} dieux`);

  // --- Classes --------------------------------------------------------------
  const classes = keep(raw.class).filter((c: Any) => !DENY_CLASS.has(c.label)).map((c: Any) => ({
    label: c.label,
    trappings: splitList(c.trappings),
    desc: c.desc,
    source: { book: c.book, page: c.page },
  }));
  write('classes.json', classes, classes.length);

  // --- Carrières ------------------------------------------------------------
  // `rand` : borne haute d100 par colonne d'espèce (refCareer) du Tableau des Classes et
  // Carrières aléatoires (LDB 05 l.197+). '' = carrière INDISPONIBLE pour cette espèce
  // (restriction de Race, l.360) → null.
  const careers = keep(raw.career).filter((c: Any) => !DENY_CLASS.has(c.class)).map((c: Any) => {
    const rand: Record<string, number | null> = {};
    for (const [k, v] of Object.entries(c.rand ?? {})) rand[k] = typeof v === 'number' ? v : null;
    return {
      label: c.label,
      class: c.class,
      rand,
      desc: c.desc,
      source: { book: c.book, page: c.page },
    };
  });
  write('careers.json', careers, careers.length);

  // --- Niveaux de carrière --------------------------------------------------
  // Les niveaux n'ont pas de champ `book` : on les rattache aux carrières gardées.
  const keptCareerNames = new Set(careers.map((c: Any) => c.label));
  const careerLevels = raw.careerLevel
    .filter((c: Any) => keptCareerNames.has(c.career))
    .map((c: Any) => ({
    label: c.label,
    career: c.career,
    level: c.careerLevel,
    skills: splitList(c.skills),
    talents: splitList(c.talents),
    trappings: splitList(c.trappings),
    characteristics: splitList(c.characteristics), // attributs avancés du niveau
    status: c.status,
  }));
  write('careerLevels.json', careerLevels, careerLevels.length);

  // --- Compétences ----------------------------------------------------------
  const skills = keep(raw.skill).map((s: Any) => ({
    label: s.label,
    characteristic: s.characteristic,
    type: s.type, // base | avancée
    specs: splitList(s.specs),
    desc: s.desc,
    source: { book: s.book, page: s.page },
  }));
  write('skills.json', skills, skills.length);

  // --- Talents --------------------------------------------------------------
  const talents = keep(raw.talent).map((t: Any) => ({
    label: t.label,
    max: norm(t.max),
    test: norm(t.test),
    desc: t.desc,
    addSkill: norm(t.addSkill),
    addTalent: norm(t.addTalent),
    addCharacteristic: norm(t.addCharacteristic),
    specs: splitList(t.specs),
    // Borne haute de la plage d100 sur le Tableau des Talents aléatoires
    // (Livre de base) : ex. Affable=3 → 01-03. null = hors table.
    rand: norm(t.rand),
    source: { book: t.book, page: t.page },
  }));
  write('talents.json', talents, talents.length);

  // --- États ----------------------------------------------------------------
  const etats = keep(raw.etat).map((e: Any) => ({
    label: e.label,
    desc: e.desc,
    source: { book: e.book, page: e.page },
  }));
  write('etats.json', etats, etats.length);

  // --- Traits de créature ---------------------------------------------------
  const traits = keep(raw.trait).map((t: Any) => ({
    label: t.label,
    prefix: norm(t.prefix),
    suffix: norm(t.suffix),
    desc: t.desc,
    source: { book: t.book, page: t.page },
  }));
  write('traits.json', traits, traits.length);

  // --- Qualités & défauts ---------------------------------------------------
  const qualities = keep(raw.quality).map((q: Any) => ({
    label: q.label,
    type: q.type, // Atout | Défaut
    subType: norm(q.subType),
    desc: q.desc,
    source: { book: q.book, page: q.page },
  }));
  write('qualities.json', qualities, qualities.length);

  // --- Équipement (armes, armures, objets) ----------------------------------
  const trappings = keep(raw.trapping).map((t: Any) => ({
    label: t.label,
    prefix: norm(t.prefix),
    type: t.type, // melee | ranged | armour | ...
    subType: norm(t.subType),
    enc: norm(t.enc),
    availability: norm(t.availability),
    reach: norm(t.reach),
    loc: norm(t.loc),
    pa: norm(t.pa),
    damage: norm(t.damage),
    qualities: splitList(t.qualities),
    desc: norm(t.desc),
    price: { gold: t.gold ?? 0, silver: t.silver ?? 0, bronze: t.bronze ?? 0 },
    source: { book: t.book, page: t.page },
  }));
  write('trappings.json', trappings, trappings.length);

  // --- Bestiaire ------------------------------------------------------------
  // Règles (livres autorisés, EDO inclus) + PNJ de CAMPAGNE (MSR/PDT — statblocs de scénario, cf. CAMPAIGN).
  const creatures = (raw.creature as Any[]).filter((c) => allowed(c) || CAMPAIGN.has(c.book)).map((c: Any) => {
    const ch: Record<string, number | null> = {};
    for (const [k, v] of Object.entries(c.char ?? {})) ch[k] = norm(v);
    return {
      label: c.label,
      title: norm(c.title),
      folder: norm(c.folder),
      char: ch,
      traits: splitList(c.traits),
      optionals: splitList(c.optionals),
      skills: splitList(c.skills),
      talents: splitList(c.talents),
      trappings: splitList(c.trappings),
      spells: splitList(c.spells),
      desc: norm(c.desc),
      source: { book: c.book, page: c.page },
    };
  });
  write('creatures.json', creatures, creatures.length);

  // --- Yeux / Cheveux (Détails supplémentaires, LDB 05 l.698-744) -----------
  // `rand` = borne haute 2d10 ; `color` = libellé par colonne d'espèce (refChar).
  const detailTable = (arr: Any[]) =>
    arr.map((e: Any) => ({ label: e.label, rand: e.rand, color: e.color ?? {} }));
  const eyes = detailTable(raw.eye ?? []);
  write('eyes.json', eyes, eyes.length);
  const hairs = detailTable(raw.hair ?? []);
  write('hairs.json', hairs, hairs.length);

  // --- Âge / Taille (Détails supplémentaires, LDB 05 l.691-707) -------------
  // Formules « base + N d10 » par colonne d'espèce (raw.detail). CORRECTION citée : all-data
  // porte Height Roll Halfling = 5, mais le LDB (05 l.707) écrit « 90 + 2d10cm » → 2.
  const detailRow = (label: string): Record<string, number> => {
    const row = (raw.detail ?? []).find((x: Any) => x.label === label)?.desc ?? {};
    const out: Record<string, number> = {};
    for (const [k, v] of Object.entries(row)) if (typeof v === 'number') out[k] = v;
    return out;
  };
  const heightRoll = detailRow('Height Roll');
  if (heightRoll['Halfling'] === 5) heightRoll['Halfling'] = 2; // LDB 05 l.707
  // Textes d'aide par espèce (LDB 05 « Détails supplémentaires ») : noms (conventions +
  // exemples), espérance de vie, tailles moyennes, et le mode d'emploi des Ambitions.
  const detailText = (label: string): { all: string; bySpecies: Record<string, string> } => {
    const row = (raw.detail ?? []).find((x: Any) => x.label === label) ?? {};
    const bySpecies: Record<string, string> = {};
    for (const [k, v] of Object.entries(row.desc ?? {})) if (typeof v === 'string' && v.trim()) bySpecies[k] = v;
    return { all: row.allDesc ?? '', bySpecies };
  };
  const details = {
    ageBase: detailRow('Age Base'),
    ageRoll: detailRow('Age Roll'),
    heightBase: detailRow('Height Base'),
    heightRoll,
    texts: {
      nom: detailText('Nom'),
      age: detailText('Age'),
      taille: detailText('Taille'),
      ambitionShort: detailText('Ambitions à court terme'),
      ambitionLong: detailText('Ambitions à long terme'),
    },
  };
  write('details.json', details, Object.keys(details).length);

  // --- Sorts ----------------------------------------------------------------
  const spells = keep(raw.spell).map((s: Any) => ({
    label: s.label,
    type: s.type,
    subType: norm(s.subType),
    cn: norm(s.cn),
    range: s.range,
    target: s.target,
    duration: s.duration,
    desc: s.desc,
    source: { book: s.book, page: s.page },
  }));
  write('spells.json', spells, spells.length);

  // --- Index récapitulatif --------------------------------------------------
  const index = {
    generatedAt: new Date().toISOString(),
    allowedBooks: [...ALLOWED],
    skippedByBook: skipped,
    counts: {
      characteristics: characteristics.length,
      species: species.length,
      classes: classes.length,
      careers: careers.length,
      careerLevels: careerLevels.length,
      skills: skills.length,
      talents: talents.length,
      etats: etats.length,
      traits: traits.length,
      qualities: qualities.length,
      trappings: trappings.length,
      creatures: creatures.length,
      spells: spells.length,
      eyes: eyes.length,
      hairs: hairs.length,
      details: Object.keys(details).length,
    },
  };
  write('_index.json', index, 1);

  console.log('\nEntrées ignorées (hors livres autorisés) par livre :');
  console.log('  ' + JSON.stringify(skipped));
  console.log('\nBase générée dans src/data/.');
}

main();
