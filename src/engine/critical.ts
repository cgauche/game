/**
 * Résolution des Blessures critiques — Livre de base, « Traumatisme » (18-Traumatisme.md).
 * Jet 1d100 sur la table de la localisation ; -20 si l'overkill dépasse le Bonus d'Endurance
 * (l.30, min 01) ; PB perdus en ignorant BE+PA ; États appliqués + Test de Résistance auto-résolu.
 */
import { d100, d10, RNG, defaultRNG } from './dice';
import { rollTest } from './tests';
import { bonus, effectiveChar } from './characteristics';
import { hitLocationByShape } from './combat';
import { BodyShape, Combatant, Difficulty, HitLocation, Trauma, HIT_LOCATION_LABELS } from './types';
import { CRITICAL_TABLES, CritEntry } from '../data/criticals';
import { traumaFromKind } from './trauma';

/** Difficulté de l'« Amputation (X) » d'une note de critique → palier de Difficulté (LDB 18 l.331). */
const AMPUTATION_DIFFICULTY: Record<string, Difficulty> = {
  Facile: 'facile',
  Accessible: 'accessible',
  Complexe: 'complexe',
  Difficile: 'difficile',
  'Très Difficile': 'tresDifficile',
};

/** Extrait « Amputation (Difficulté) » du texte d'un critique (verbatim LDB 18), ou `null`. L'ordre des
 *  alternatives place « Très Difficile » avant « Difficile » (sinon le sous-mot capturerait à tort). */
export function parseAmputation(note: string): Difficulty | null {
  const m = note.match(/Amputation \((Très Difficile|Difficile|Complexe|Accessible|Facile)\)/);
  return m ? AMPUTATION_DIFFICULTY[m[1]] : null;
}

// Prothèses qui ANNULENT TOTALEMENT une séquelle (LDB 73) — par partie remplacée.
const MERVEILLE = { name: "Merveille d'ingénierie", cancels: 'all' as const }; // oreille/main/bras/jambe (l.28)

/**
 * Séquelles PERMANENTES d'une amputation (LDB 18 l.335-370) — distinctes de la plaie chirurgicale : elles
 * survivent à la Chirurgie (le membre reste absent). La latéralité de membre (brasG/brasD, jambeG/jambeD) et
 * la partie de tête (lues dans `name`+`note` : œil/oreille/nez/langue/dents) SONT connues, donc on mécanise —
 * hypothèse de jeu : **tout le monde est DROITIER** (main principale = brasD). Une tête peut perdre PLUSIEURS
 * parties d'un coup (Coup défigurant = œil+nez ; Mâchoire mutilée = langue+dents) → on renvoie un tableau.
 * Non modélisé (comptage cumulatif) : DEUX yeux/oreilles (−30 vue / −20 ouïe), plusieurs doigts/dents — on
 * pose l'effet d'UNE perte (chaque critique en ajoute une).
 */
export function permanentAmputations(name: string, note: string, location: HitLocation, rng: RNG = defaultRNG): Trauma[] {
  const t = `${name} ${note}`.toLowerCase();
  const out: Trauma[] = [];
  if (location === 'jambeG' || location === 'jambeD') {
    if (/orteil/.test(t)) {
      out.push({ label: `Orteil(s) amputé(s) (${HIT_LOCATION_LABELS[location]})`, location, charPenalty: { Ag: -1, CC: -1 },
        note: '−1 Agilité et −1 CC par orteil perdu (séquelle permanente ; cumul non suivi).' });
    } else {
      out.push({ label: `Membre inférieur amputé (${HIT_LOCATION_LABELS[location]})`, location, movementHalved: true, dodgePenalty: -20,
        prosthesis: [MERVEILLE, { name: 'Fausse jambe', cancels: 'movement' }],
        note: 'Mouvement ÷2 + −20 mobilité (Esquive) — à pied seulement, une monture rétablit le déplacement. Prothèse : Fausse jambe / Merveille.' });
    }
    return out;
  }
  if (location === 'brasG' || location === 'brasD') {
    const dominant = location === 'brasD'; // droitier
    if (/doigt/.test(t)) {
      // 1 doigt par critique (« Doigt sectionné » / « Main ouverte : perdez 1 doigt »). Cumulé par consolidateAmputations.
      out.push({ label: `Doigts amputés (${HIT_LOCATION_LABELS[location]})`, location, count: 1, ...(dominant ? { charPenalty: { CC: -5, CT: -5 } } : {}),
        prosthesis: [MERVEILLE],
        note: `−5 aux Tests d'Arme par doigt perdu (main principale)${dominant ? '' : ' — main secondaire'}. Prothèse : Merveille.` });
    } else if (/\bmain\b|bras inutilisable/.test(t)) {
      out.push({ label: `Main/bras amputé (${HIT_LOCATION_LABELS[location]})`, location, noTwoHanded: true, ...(dominant ? { charPenalty: { CC: -20, CT: -20 } } : {}),
        prosthesis: [MERVEILLE],
        note: `pas d'arme à deux mains${dominant ? ' ; main PRINCIPALE perdue → −20 aux Tests d’Arme (main secondaire)' : ' (main secondaire)'}. Prothèse : Crochet (rachat PX) / Merveille.` });
    }
    return out;
  }
  if (location === 'tete') {
    if (/langue/.test(t)) {
      out.push({ label: 'Langue amputée', location, skillPenalty: { langue: -100 }, // « auto-échec » de la parole
        note: 'sans langue, tout Test de Langue impliquant la parole échoue automatiquement.' });
    }
    if (/\bnez\b/.test(t)) {
      out.push({ label: 'Nez amputé', location, charPenalty: { Soc: -20 }, prosthesis: [{ name: 'Nez doré', cancels: 'all' }],
        note: '−20 Sociabilité permanent (perte du nez). Prothèse : Nez doré.' });
    }
    if (/œil|oeil/.test(t)) {
      out.push({ label: 'Œil perdu', location, charPenalty: { Soc: -5 },
        prosthesis: [{ name: 'Cache-œil', cancels: 'all' }, { name: 'Œil de verre', cancels: 'all' }],
        note: '−5 Sociabilité (orbite vide visible) ; perte des DEUX yeux (−30 vue) non modélisée. Prothèse : Cache-œil / Œil de verre.' });
    }
    if (/oreille/.test(t)) {
      out.push({ label: 'Oreille perdue', location, charPenalty: { Soc: -5 }, prosthesis: [MERVEILLE],
        note: '−5 Sociabilité par oreille perdue ; perte des DEUX oreilles (−20 ouïe) non modélisée. Prothèse : Merveille.' });
    }
    if (/dents?\b/.test(t)) {
      const n = /1d10/.test(t) ? d10(rng) : 1; // « 1d10 dents » (Bouche explosée/Mâchoire) ou 1 dent. Cumulé.
      const soc = -Math.floor(n / 2); // −1 Sociabilité par PAIRE (l.338) : 1 dent = 0, 3 dents = −1, 4 = −2…
      out.push({ label: 'Dents perdues', location, count: n, ...(soc < 0 ? { charPenalty: { Soc: soc } } : {}), prosthesis: [{ name: 'Dents en bois', cancels: 'all' }],
        note: `${n} dents perdues → −1 Sociabilité par paire (${soc} Soc). Prothèse : Dents en bois.` });
    }
    return out;
  }
  return out; // corps : pas d'amputation
}

export interface CriticalResolved {
  location: HitLocation;
  name: string;
  /** PB perdus (ignore BE+PA) ; le plancher (0) est géré par l'appelant. */
  woundsLoss: number;
  lethal: boolean;
  /** États à appliquer (immédiats + échec du Test de Résistance). */
  conditions: { name: string; value: number }[];
  /** Traumatismes posés (LDB 18), à la localisation du critique. */
  traumas: Trauma[];
  note: string;
  /** Jet d100 effectif (après -20 éventuel). */
  roll: number;
  log: string;
}

/** Localisation d'un Coup Critique : 1d100 lu directement sur le Tableau de Localisation de la forme
 *  du corps (humanoïde p.159 / Localisations Alternatives p.312). */
export function critLocationRoll(rng: RNG = defaultRNG, shape: BodyShape = 'humanoide'): HitLocation {
  return hitLocationByShape(d100(rng), shape);
}

function findEntry(table: CritEntry[], roll: number): CritEntry {
  return table.find((e) => roll >= e.min && roll <= e.max) ?? table[table.length - 1];
}

/**
 * Résout une Blessure critique sur `target` à la `location`. `overkill` = PB perdus au-delà des
 * PB courants (0 pour un Coup Critique sans overkill). Le Test de Résistance d'une entrée est
 * auto-résolu (RNG seedé) : sur un échec, les États `onFail` sont ajoutés à `conditions`.
 */
export function rollCritical(
  target: Combatant,
  location: HitLocation,
  rng: RNG = defaultRNG,
  overkill = 0,
  twice = false, // Bénédiction de Sauvagerie (LDB 41) : « deux lancers, choisissez le meilleur » (l'attaquant veut le plus sévère)
): CriticalResolved {
  const be = bonus(effectiveChar(target, 'E'));
  const reduction = overkill > be ? 20 : 0; // l.30 : overkill > BE → -20 (résultat moins sévère)
  const raw = twice ? Math.max(d100(rng), d100(rng)) : d100(rng);
  const roll = Math.max(1, raw - reduction);
  const entry = findEntry(CRITICAL_TABLES[location], roll);
  const resistVal =
    effectiveChar(target, 'E') +
    (target.skills.find((s) => s.name.toLowerCase().startsWith('résistance'))?.advances ?? 0);
  const conditions = [...(entry.conditions ?? [])];
  if (entry.resist) {
    const res = rollTest(resistVal, entry.resist.difficulty, rng);
    if (!res.success) conditions.push(...entry.resist.onFail);
  }
  // Durée de convalescence (Jalon 5) : BE déjà calculé ; 1d10 tiré seulement pour les fractures (RAW 30+1d10)
  // afin de ne pas décaler le flux RNG des critiques sans fracture.
  const traumas = (entry.traumas ?? []).map((t) =>
    traumaFromKind(t.kind, t.severity, location, { be, d10: t.kind === 'fracture' ? d10(rng) : undefined }));
  // Amputation (LDB 18 l.328-333) : « à chaque fois qu'un critique indique Amputation (Difficulté) »,
  // Test de Résistance ou À Terre ; échec −2 DR → +Sonné ; échec −4 DR → +Inconscient. Le membre perdu
  // exige la Chirurgie (l.333/401) : trauma `needsSurgery` (opérable via le Talent Chirurgie). Roll placé
  // en DERNIER (rien ne tire après) pour ne décaler le flux RNG que des critiques d'amputation.
  const ampDiff = entry.lethal ? null : parseAmputation(entry.note);
  if (ampDiff) {
    const res = rollTest(resistVal, ampDiff, rng);
    if (!res.success) {
      conditions.push({ name: 'À Terre', value: 1 });
      if (res.sl <= -2) conditions.push({ name: 'Sonné', value: 1 });
      if (res.sl <= -4) conditions.push({ name: 'Inconscient', value: 1 });
    }
    // Plaie chirurgicale (l.333/401) : retirée par la Chirurgie ; bloque la guérison jusqu'à l'opération.
    traumas.push({
      label: `Amputation (${HIT_LOCATION_LABELS[location]})`,
      location,
      needsSurgery: true,
      note: `${entry.note} La Blessure ne guérit pas tant qu'un chirurgien n'a pas opéré (Talent Chirurgie).`,
    });
    // Séquelle(s) PERMANENTE(S) (membre absent) : survivent à la Chirurgie (l.335-370). Une tête peut en cumuler
    // (la perte de dents tire 1d10 — placé après le Test de Résistance d'amputation pour ne pas décaler le reste).
    traumas.push(...permanentAmputations(entry.name, entry.note, location, rng));
  }
  return {
    location,
    name: entry.name,
    woundsLoss: entry.wounds,
    lethal: !!entry.lethal,
    conditions,
    traumas,
    note: entry.note,
    roll,
    log: `Blessure critique (${HIT_LOCATION_LABELS[location]}) — ${entry.name}${entry.lethal ? ' — MORT !' : ''}.`,
  };
}
