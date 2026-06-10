/**
 * Pipeline de données — génère NOTRE base de jeu depuis les sources WFRP4.
 *
 * Lit Source/all-data.json, filtre aux livres autorisés (Livre de base +
 * Archives de l'Empire I & II), normalise et réécrit dans src/data/*.json.
 *
 * IMPORTANT : on ne livre jamais all-data.json tel quel ; ce script produit
 * notre propre format. Lancer avec `npm run build:data`.
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const SRC = resolve(ROOT, 'Source/all-data.json');
const OUT = resolve(ROOT, 'src/data');

/** Livres autorisés : Livre de base + Archives de l'Empire I & II. */
const ALLOWED = new Set(['LDB', 'ADE1', 'ADE2']);

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

  console.log('Génération de la base de jeu (LDB + ADE1 + ADE2)…');

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
  // Mouvement par espèce (Livre de base : « Mouvement 4 3 3 » p.5 pour
  // Humain/Nain/Halfling ; bestiaire « Les peuples du Reikland » pour Elfe M5,
  // Ogre M6). Indexé par refChar.
  const SPECIES_MOVEMENT: Record<string, number> = {
    Humain: 4,
    Nain: 3,
    Halfling: 3,
    'Haut Elfe': 5,
    'Elfe Sylvain': 5,
    Gnome: 3,
    Ogre: 6,
  };
  // Destin / Résilience / Points supplémentaires (Tableau des Attributs LDB).
  // Elfe : 0 / 0 / 2. Gnome & Ogre (Archives) : valeurs de repli.
  const SPECIES_FATE: Record<string, { fate: number; resilience: number; extra: number }> = {
    Humain: { fate: 2, resilience: 1, extra: 3 },
    Nain: { fate: 0, resilience: 2, extra: 2 },
    Halfling: { fate: 0, resilience: 2, extra: 3 },
    'Haut Elfe': { fate: 0, resilience: 0, extra: 2 },
    'Elfe Sylvain': { fate: 0, resilience: 0, extra: 2 },
    Gnome: { fate: 0, resilience: 2, extra: 2 },
    Ogre: { fate: 0, resilience: 0, extra: 3 },
  };
  const PETIT = new Set(['Halfling', 'Gnome']); // talent Petit ⇒ Blessures sans BF
  const species = raw.specie.map((s: Any) => {
    const baseChar: Record<string, number> = {};
    for (const c of raw.characteristic) {
      if (!c.rand || !c.abr) continue;
      const v = c.rand[s.refChar];
      if (typeof v === 'number') baseChar[c.abr] = v;
    }
    return {
      label: s.label,
      refChar: s.refChar,
      refCareer: s.refCareer,
      rand: s.rand,
      desc: s.desc,
      movement: SPECIES_MOVEMENT[s.refChar] ?? 4,
      fate: SPECIES_FATE[s.refChar] ?? { fate: 0, resilience: 0, extra: 2 },
      small: PETIT.has(s.refChar),
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

  // --- Classes --------------------------------------------------------------
  const classes = keep(raw.class).map((c: Any) => ({
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
  const careers = keep(raw.career).map((c: Any) => {
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
  const creatures = keep(raw.creature).map((c: Any) => {
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
    },
  };
  write('_index.json', index, 1);

  console.log('\nEntrées ignorées (hors LDB/ADE1/ADE2) par livre :');
  console.log('  ' + JSON.stringify(skipped));
  console.log('\nBase générée dans src/data/.');
}

main();
