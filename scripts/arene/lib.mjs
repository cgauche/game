/**
 * Outillage d'AUTHORING de l'Arène — helpers purs pour composer le projet (cartes ASCII → tiles,
 * fabriques d'entités/rencontres/triggers). Le JSON commité (`src/scenes/arene/arene-projet.json`)
 * reste la SOURCE CANONIQUE, 100 % éditable dans l'éditeur : ce script n'est qu'un outil d'auteur
 * (itération de layout), PAS un build — ne pas le brancher dans package.json.
 */

/** Légende ASCII commune (complétée/surchargée par scène via `legend`). `.` = sol de base. */
const BASE_LEGEND = {
  '#': 'mur',
  '~': 'eau',
  D: 'porte',
  _: 'fosse',
  '=': 'planches',
};

/** Parse une carte ASCII (1 char = 1 tuile) → { w, h, tiles }. `base` = terrain du '.' (et de l'espace). */
export function parseRows(rows, base, legend = {}) {
  const w = rows[0].length;
  const lg = { ...BASE_LEGEND, ...legend };
  const tiles = [];
  for (const [y, row] of rows.entries()) {
    if (row.length !== w) throw new Error(`ligne ${y} : largeur ${row.length} ≠ ${w}`);
    for (const ch of row) {
      if (ch === '.' || ch === ' ') tiles.push(base);
      else if (lg[ch]) tiles.push(lg[ch]);
      else throw new Error(`char inconnu « ${ch} » (ligne ${y})`);
    }
  }
  return { w, h: rows.length, tiles };
}

/** Fabrique de scène : carte ASCII + le reste, avec défauts sûrs et ids vérifiés uniques. */
export function scene({ id, nom, description = '', ambiance = 'exterieur', weather, music, startMessage, rows, base, legend, entities = [], buildings = [], dialogues = [], triggers = [], encounters = [], entryPoints, flags = {} }) {
  const { w, h, tiles } = parseRows(rows, base, legend);
  for (const list of [entities, buildings, triggers, dialogues, encounters]) {
    const seen = new Set();
    for (const it of list) {
      if (seen.has(it.id)) throw new Error(`${id} : id dupliqué « ${it.id} »`);
      seen.add(it.id);
    }
  }
  const sc = { id, nom, description, dimensions: { w, h }, ambiance, tiles, entities, buildings, dialogues, triggers, encounters, flags };
  if (weather) sc.weather = weather;
  if (music) sc.music = music;
  if (startMessage) sc.startMessage = startMessage;
  if (entryPoints) sc.entryPoints = entryPoints;
  return sc;
}

let propSeq = 0;
/** Décor. `extra` : foot / interact / anim / label… L'id est auto (réinitialisé par scène via resetIds). */
export function P(x, y, ref, extra = {}) {
  return { id: `p${propSeq++}`, kind: 'prop', pos: { x, y }, ref, ...extra };
}
export function resetIds() {
  propSeq = 0;
}

/** Personnage (PNJ) : apparence/dialogue/marchand via opts. */
export function NPC(id, x, y, label, opts = {}) {
  return { id, kind: 'personnage', pos: { x, y }, label, ...opts };
}

export function hero(x, y) {
  return { id: 'start', kind: 'heroStart', pos: { x, y } };
}

/** Trigger de combat standard (une fois) : entrer dans le rect lance la rencontre. */
export function fightTrigger(encounter, rect, extra = {}) {
  return { id: `fight-${encounter}`, rect, once: true, effects: [{ type: 'startCombat', encounter }], ...extra };
}

/** onVictory standard d'une zone de l'échelle : bourse + PX + flag de porte + retour au Bourg.
 *  ÉCONOMIE : la vie coûte des PISTOLES (repas 1 pa, nuit 10 sb/tête, ration 2 pa) et la plate
 *  complète ~31 CO ; les bourses montent donc de quelques pa (échauffement) à ~10 co (dragon) —
 *  l'équipement lourd se GAGNE sur toute l'échelle, pas au premier combat. XP : ~100 → 450 par
 *  zone (progression de carrière sentie à CHAQUE victoire, pas tous les 3 combats). */
export function zoneVictory(n, { money, xp, journal, extra = [] }) {
  return [
    { type: 'giveMoney', ...money },
    { type: 'giveXp', amount: xp },
    { type: 'setFlag', flag: `zone${n}_clear` },
    { type: 'journal', text: journal },
    ...extra,
    { type: 'transition', scene: 'arene-hub', entry: 'porte-arene' },
  ];
}

/** Fouille à effets (décor interactif). `consume` retire le décor une fois pris. */
export function fouille(effects, consume = false) {
  return { interact: { effects, ...(consume ? { consume: true } : {}) } };
}

/** Statblocks d'AUTEUR conservés VERBATIM du projet v1 (sourcés à leur création). */
export const NUEE_DE_RATS = {
  name: 'Nuée de rats',
  char: { M: 4, CC: 30, F: 25, E: 30, Ag: 40, B: 5 },
  traits: ['Nuée', 'Taille (Petite)'],
};
export const DRAGON_DES_TENEBRES = {
  name: 'Dragon des ténèbres',
  char: { M: 6, CC: 55, CT: 45, F: 55, E: 55, I: 50, Ag: 35, Dex: 30, Int: 40, FM: 60, Soc: 40, B: 104 },
  traits: ['Taille (Monstrueuse)', 'Souffle +15 (Ténèbres)', 'Terreur 2', 'Armure 5', 'Arme +10', 'Morsure +10', 'Vol'],
  size: 'monstrueuse',
};
