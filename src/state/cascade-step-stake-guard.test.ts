import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, sep } from 'node:path';
import { stripLiterals } from './cascade-step-difficulty-guard.test';

/**
 * CLIQUET — une étape de cascade INTERACTIVE dit son ENJEU (#1117, arbitrage user : « Louvoyage… ça
 * se mange ? » / « Faudrait globaliser ça, histoire qu'on sache pourquoi on fait un jet »). Une étape
 * qui LANCE et qu'un joueur peut influencer doit ÉNONCER ce qu'elle met en jeu (`CascadeStep.stake`,
 * gabarit mécanique de `voyage-stakes.json`) : sans lui, la modale demande un jet sans dire pourquoi.
 *
 * Jumeau exact de `cascade-step-difficulty-guard` (même parseur : commentaires et contenus de
 * chaînes/gabarits neutralisés avant le parcours d'accolades) — un invariant par fichier. Baseline
 * NOMINATIVE et DÉCROISSANTE : un site doté ABAISSE sa ligne.
 */

const STATE = join(process.cwd(), 'src', 'state');

function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) { out.push(...sourceFiles(p)); continue; }
    if (e.endsWith('.ts') && !e.includes('.test.')) out.push(p);
  }
  return out;
}

/** Étapes INTERACTIVES qui lancent, sans `stake` — renvoie leurs numéros de ligne (1-based). */
export function stepsWithoutStake(src: string): number[] {
  const s = stripLiterals(src);
  // POSE DIFFÉRÉE : un flux qui dote ses étapes APRÈS construction (`st.stake = nightStake(st.kind)`,
  // cascade de nuit) couvre ses littéraux hors de leur portée lexicale — le scan ne peut pas les lire
  // comme muets. La dotation reste vérifiée par le catalogue d'enjeux de CE flux.
  if (/\.stake\s*=\s*/.test(s)) return [];
  const lines: number[] = [];
  for (const m of s.matchAll(/result\s*:\s*null/g)) {
    const i = m.index!;
    let depth = 0;
    let start = -1;
    for (let j = i; j >= 0; j--) {
      if (s[j] === '}') depth++;
      else if (s[j] === '{') { if (depth === 0) { start = j; break; } depth--; }
    }
    depth = 0;
    let end = -1;
    for (let j = i; j < s.length; j++) {
      if (s[j] === '{') depth++;
      else if (s[j] === '}') { if (depth === 0) { end = j; break; } depth--; }
    }
    if (start < 0 || end < 0) continue;
    const lit = s.slice(start, end);
    if (!/\btarget\s*[:,}]/.test(lit)) continue; // étape sans jet : rien à mettre en jeu
    if (!/\binteractive\s*:\s*true/.test(lit)) continue; // témoin/auto-résolue : aucune décision offerte
    if (!/\bkind\s*[:,}]/.test(lit)) continue; // CONTRIBUTEUR d'une étape batch : l'enjeu est porté par l'ÉTAPE
    if (/\bstake\s*[,:]/.test(lit)) continue;
    lines.push(src.slice(0, start).split('\n').length);
  }
  return lines;
}

/** Baseline NOMINATIVE (fichier → étapes interactives encore sans enjeu). ZÉRO ailleurs. */
const BASELINE: Record<string, number> = {
  // VOYAGE (fluvial + maritime) = 0 : le périmètre soldé par #1117.
  // Une ACTIVITÉ en mer (MDG 15 l.266-306) est un CHOIX du joueur : ce qu'elle met en jeu EST
  // l'activité choisie, énoncée par son panneau de sélection — l'étape ne redit pas le choix.
  'seaActivities.ts': 2,
  // HORS périmètre #1117 (voyage) — stock MESURÉ le 2026-08-05, gelé et décroissant : chaque famille
  // dotera ses enjeux avec le lot qui la traite (le catalogue `voyage-stakes.json` est déjà le
  // gabarit à suivre ; rien n'y est propre au voyage sauf ses entrées).
  'travelFlow.ts': 4, // voyage TERRESTRE : périls de route (Survie/Perception), attelage forcé ×2
  'travelPostes.ts': 1, // Exposition de fin d'Étape terrestre
  'pursuitFlow.ts': 1, // manche de poursuite terrestre
  'combatEffects.ts': 1, // Exposition posée par un effet de scène
  'combatFlow.ts': 1, // Contraction de maladie (fin de combat / chirurgie)
  'rollSeam.ts': 1, // PORTE générique du seam (`buildMonoStep`) : l'enjeu vient du flux appelant
};

describe('cliquet — une étape de cascade interactive dit son ENJEU (#1117)', () => {
  it('aucun site NEUF sans enjeu, et toute baseline assainie est ABAISSÉE', () => {
    const counts: Record<string, number[]> = {};
    for (const f of sourceFiles(STATE)) {
      const found = stepsWithoutStake(readFileSync(f, 'utf8'));
      if (found.length) counts[f.slice(STATE.length + 1).split(sep).join('/')] = found;
    }
    const over: string[] = [];
    for (const [f, l] of Object.entries(counts)) {
      const b = BASELINE[f] ?? 0;
      if (l.length > b) over.push(`${f} : ${l.length} (baseline ${b}) — lignes ${l.join(', ')}`);
    }
    expect(over, ['Étape de cascade INTERACTIVE sans enjeu — le joueur doit savoir ce que le jet met en jeu (`stake`, voyage-stakes.json) :', ...over].join('\n')).toEqual([]);
    const stale: string[] = [];
    for (const [f, b] of Object.entries(BASELINE)) {
      const n = counts[f]?.length ?? 0;
      if (n < b) stale.push(`${f} : baseline ${b}, réel ${n} — ABAISSER`);
    }
    expect(stale, ['Baseline(s) PÉRIMÉE(s) :', ...stale].join('\n')).toEqual([]);
  });

  it('FAIL-CLOSED : une étape interactive synthétique sans enjeu est DÉTECTÉE, avec enjeu elle ne l’est pas', () => {
    const sans = `const s = { id: \`x-\${a}\`, kind: 'k', base: 40, target: 40, result: null, interactive: true };`;
    // Forme RÉELLE d'un enjeu depuis #1117 : une RÉFÉRENCE de donnée produite par la porte unique —
    // un texte au call-site ne compile plus (`stake?: StakeRef`), le scanner voit l'appel.
    const avec = `const s = { id: 'x', kind: 'k', base: 40, target: 40, stake: voyageStakeRef('k'), result: null, interactive: true };`;
    const raccourci = `const s = { id: 'x', kind: 'k', base: 40, target: 40, stake, result: null, interactive: true };`;
    const temoin = `const s = { id: 'x', kind: 'k', base: 40, target: 40, result: null, interactive: false };`;
    const sansJet = `const s = { id: 'x', kind: 'reveal', result: null, interactive: true };`;
    expect(stepsWithoutStake(sans)).toHaveLength(1);
    expect(stepsWithoutStake(avec)).toHaveLength(0);
    expect(stepsWithoutStake(raccourci)).toHaveLength(0);
    expect(stepsWithoutStake(temoin), 'une rangée témoin n’offre aucune décision').toHaveLength(0);
    expect(stepsWithoutStake(sansJet), 'une étape d’affichage ne met rien en jeu').toHaveLength(0);
  });
});

/**
 * #1117 (arbitrage user, recette 4 : « Échec : vitesse ×0.8 » côté enjeu vs « vitesse −20 % » côté
 * conséquence — MÊME fait, DEUX notations). La langue du JOUEUR est celle de la Source : MSRC 7 l.17
 * dit « la vitesse … est réduite ce jour-là de 20% » et « divisée par deux ». Le FACTEUR multiplicatif
 * (×0.8, ×0.5) est la langue du MOTEUR : il ne sort jamais à l'écran.
 */
describe('« un signe, un sens » — les enjeux et leurs conséquences parlent la même langue (#1117)', () => {
  const FACTEUR = /×\s*0[.,]\d/; // ×0.8 / ×0,5 — jamais côté joueur

  it('aucun gabarit d’enjeu n’exprime une réduction en FACTEUR', () => {
    const stakes = JSON.parse(readFileSync(join(process.cwd(), 'src', 'data', 'voyage-stakes.json'), 'utf8')) as { kind: string; template: string }[];
    const fautifs = stakes.filter((e) => FACTEUR.test(e.template)).map((e) => `${e.kind} — ${e.template}`);
    expect(fautifs, ['Enjeu exprimé en facteur (langue du moteur) — dire le % ou la division, comme la Source :', ...fautifs].join('\n')).toEqual([]);
  });

  it('aucune ligne de conséquence des flux de voyage n’en exprime non plus', () => {
    const fautifs: string[] = [];
    for (const f of ['riverVoyageFlow.ts', 'seaVoyageFlow.ts']) {
      const src = stripLiterals(readFileSync(join(STATE, f), 'utf8'));
      // On lit le fichier ENTIER hors commentaires : une ligne de journal est du texte de gabarit.
      if (FACTEUR.test(src)) fautifs.push(f);
    }
    expect(fautifs, ['Ligne de voyage exprimée en facteur :', ...fautifs].join('\n')).toEqual([]);
  });

  it('FAIL-CLOSED : le motif reconnaît bien un facteur, et laisse passer % et ÷', () => {
    expect(FACTEUR.test('vitesse ×0.8 aujourd’hui')).toBe(true);
    expect(FACTEUR.test('vitesse −20 % aujourd’hui')).toBe(false);
    expect(FACTEUR.test('vitesse ÷2 aujourd’hui')).toBe(false);
    expect(FACTEUR.test('Survitesse M+5 — 2 Dégât(s)')).toBe(false); // un multiplicateur ENTIER n'est pas visé
  });
});
