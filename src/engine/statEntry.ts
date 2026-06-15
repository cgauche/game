/**
 * Parseur CANONIQUE et UNIQUE des chaînes de statbloc WFRP (traits, compétences, talents…).
 *
 * Le format des données est hétérogène (héritage des livres) : un même token peut être un
 * compte en tête (« 8 Tentacules »), un bonus signé (« +7 »), un Indice/valeur de fin
 * (« Vol 100 », « Démoniaque 8+ », « Chevaucher 58 »), une parenthèse de spécialisation/type/
 * cible (« (Cheval) », « (Feu) », « (Tiléens) ») ou de portée (« (50) »). Cette fonction les
 * démêle UNE fois pour TOUT le code (combat ET Codex) — fini les regex recopiées par consommateur.
 */
export interface StatEntry {
  /** Nom canonique (base), sans compte/bonus/indice/parenthèse : « Tentacules », « Arme »,
   *  « À distance », « Chevaucher », « Magie des Arcanes ». Clé de lookup registre/données. */
  name: string;
  /** Parenthèse NON numérique : spécialisation (« Cheval »), type (« Feu »), cible (« Tiléens »). */
  arg?: string;
  /** Compte en tête : « 8 Tentacules +9 » → 8 (nombre d'attaques). */
  count?: number;
  /** Bonus SIGNÉ : « Arme +7 » → 7, « Vomissement -2 » → -2 (Dégâts d'une attaque). */
  bonus?: number;
  /** Indice/valeur NON signé de fin : « Vol 100 » → 100, « Démoniaque 8+ » → 8, compétence « 58 ». */
  indice?: number;
  /** Parenthèse NUMÉRIQUE : « À distance +8 (50) » → 50 (portée en mètres). */
  range?: number;
  /** Chaîne d'origine, telle qu'affichée. */
  raw: string;
}

/** Démêle une chaîne de statbloc en ses composantes canoniques. */
export function parseStatEntry(raw: string): StatEntry {
  const out: StatEntry = { name: '', raw: raw.trim() };
  let s = out.raw;

  // 1) Compte en tête (« 8 Tentacules ») — seulement si suivi d'un mot (pas « 8 » seul/valeur).
  const cm = s.match(/^(\d+)\s+(\D.*)$/);
  if (cm) {
    out.count = parseInt(cm[1], 10);
    s = cm[2];
  }

  // 2) Parenthèses : purement numérique → portée, sinon spec/type/cible. Les deux PEUVENT coexister
  //    (« À distance (Arbalète) +9 (60) ») ; la 1re de chaque sorte l'emporte.
  for (const pm of s.matchAll(/\(([^)]*)\)/g)) {
    const inside = pm[1].trim();
    if (/^\d+$/.test(inside)) { if (out.range == null) out.range = parseInt(inside, 10); }
    else if (inside && out.arg == null) out.arg = inside;
  }
  s = s.replace(/\s*\([^)]*\)\s*/g, ' ').trim();

  // 3) Bonus SIGNÉ (« +7 », « -2 ») n'importe où.
  const bm = s.match(/([+-]\d+)/);
  if (bm) {
    out.bonus = parseInt(bm[1], 10);
    s = s.replace(/\s*[+-]\d+\s*/, ' ').trim();
  }

  // 4) Indice/valeur NON signé en fin (« 100 », « 8+ », « 58 ») — précédé d'un espace.
  const im = s.match(/\s(\d+)\s*\+?\s*$/);
  if (im) {
    out.indice = parseInt(im[1], 10);
    s = s.replace(/\s\d+\s*\+?\s*$/, '').trim();
  }

  out.name = s.replace(/\s+/g, ' ').trim();
  return out;
}

/**
 * Trait STRUCTURÉ (de-POC : fin du parsing de chaînes au runtime). Le bestiaire stocke des
 * `TraitInstance`, plus des chaînes re-parsées partout. `key` = clé canonique du registre (sinon le
 * nom brut : « Arme », « À distance », étiquette naturelle « Griffes ») ; `value` = numérique
 * (Indice ou bonus signé) ; `arg` = parenthèse non-numérique ; `count` = compte en tête ; `range` = portée.
 */
export interface TraitInstance {
  key: string;
  value?: number;
  arg?: string;
  count?: number;
  range?: number;
}

/**
 * Liste de traits portée par une créature/combattant. Union TRANSITOIRE pendant la migration de-POC :
 * la donnée et les statblocs migrent vers `TraitInstance` (structuré, plus de parsing au runtime),
 * mais les littéraux de test (« 'Morsure +9' ») restent des chaînes — `asTrait` les normalise une
 * fois. Cible finale : `TraitInstance[]` partout dans la donnée ; les chaînes ne survivent qu'en test.
 */
export type TraitList = (string | TraitInstance)[];

/** Nom canonique seul (raccourci pour les lookups Codex/registre). */
export const statName = (raw: string): string => parseStatEntry(raw).name;

/** Décompose un libellé concret « Nom (Spec) » → { name, spec } via le parseur unifié (compte/
 *  bonus/indice/portée éventuels écartés). Source UNIQUE du split nom↔spécialisation (carrières,
 *  compétences/talents de statbloc) — remplace les anciens `splitLabel`/`parseSkillRef` recopiés. */
export function splitLabel(raw: string): { name: string; spec?: string } {
  const p = parseStatEntry(raw);
  return p.arg ? { name: p.name, spec: p.arg } : { name: p.name };
}
