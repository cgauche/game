import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Combatant } from './types';
import { applyOps } from './ops';

/**
 * GARDE DE CLASSE — tout `ActiveEffect` posé doit porter un ANCRAGE DE RÈGLE.
 *
 * Une pastille d'effet n'informe le joueur que si elle est reliée à une règle (arbitrage user
 * 2026-07-18) : `chipCodex` (`src/gameIso/effectIcons.ts`) résout par id STABLE — `sourceSpellId`
 * (sort/prière source) ou `effectId` (identité de l'effet) — et ne fabrique AUCUN repli. Un effet
 * posé sans l'un des deux s'affiche donc NU : icône + libellé, sans fiche ni popover.
 *
 * L'ancrage est stampé par `applyOps` sur TOUT effet qu'il pose (`src/engine/ops.ts`, post-passe
 * `ctx.sourceSpell`/`ctx.sourceSpellId`/`ctx.effectId`) : c'est donc l'`OpsCtx` du CALLSITE qui
 * décide. Cette garde énumère les callsites `applyOps` dont les ops peuvent poser un effet actif et
 * dont le ctx n'apporte aucun ancrage.
 *
 * BASELINE : 29 callsites résiduels, listés NOMMÉMENT ci-dessous avec leur déclencheur (43 au relevé
 * initial du 2026-07-18 : les sorts, les activités de mer/voyage et TOUS les effets déclenchés — traits,
 * talents, qualités, symptômes, États, psychologie, via `effectSourcesOf` — sont désormais ancrés). La
 * garde échoue sur toute NOUVELLE source non ancrée, et AUSSI quand un callsite listé a été ancré sans
 * être ôté de la liste : la baseline ne peut que DÉCROÎTRE.
 */
const SRC = fileURLToPath(new URL('..', import.meta.url));

/** Les seuls porteurs d'ancrage reconnus par la post-passe d'`applyOps` (ops.ts). `source` est l'ancrage
 *  GÉNÉRAL (toute entité) ; `sourceSpellId`/`effectId` restent les canaux spécifiques préexistants. */
const ANCHOR = /\bsource\b|sourceSpellId|effectId|sourceSpell\b/;

/** Un `OpsCtx` RELAYÉ depuis l'appelant — le site n'est pas l'origine de l'effet, il ne peut pas l'ancrer. */
const FORWARDED = /\bctx\b|Ctx\b|\binner\b/;

function tsFiles(dir: string): string[] {
  const out: string[] = [];
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) out.push(...tsFiles(p));
    else if (/\.tsx?$/.test(e.name) && !/\.test\.tsx?$/.test(e.name)) out.push(p);
  }
  return out;
}

/** Arguments de premier niveau d'un appel dont `(` commence à `open` — chaînes et imbrications sautées. */
function callArgs(src: string, open: number): string[] {
  const out: string[] = [];
  let depth = 0;
  let cur = open + 1;
  for (let j = open; j < src.length; j++) {
    const ch = src[j];
    if (ch === '(' || ch === '[' || ch === '{') depth++;
    else if (ch === ')' || ch === ']' || ch === '}') {
      depth--;
      if (depth === 0) { out.push(src.slice(cur, j)); return out; }
    } else if (ch === ',' && depth === 1) { out.push(src.slice(cur, j)); cur = j + 1; }
    else if (ch === '"' || ch === "'" || ch === '`') {
      const q = ch;
      j++;
      while (j < src.length && src[j] !== q) { if (src[j] === '\\') j++; j++; }
    }
  }
  return out;
}

/** Kinds de `GameOp` dont le corps pose un `ActiveEffect` — LU dans le switch d'`applyOps`, jamais
 *  recopié à la main (une op posante ajoutée demain entre d'elle-même dans le périmètre). */
function postingKinds(): Set<string> {
  const lines = readFileSync(join(SRC, 'engine/ops.ts'), 'utf8').split('\n');
  const posts = new Set<string>();
  let pending: string[] = [];
  let body: string[] = [];
  const flush = () => {
    if (pending.length && body.some((l) => /activeEffects\.push|applyActiveEffect\(|pushPerRound\(/.test(l))) {
      for (const k of pending) posts.add(k);
    }
  };
  for (const l of lines) {
    const m = l.match(/^\s*case '([a-zA-Z0-9_-]+)':\s*\{?\s*$/);
    if (m) {
      if (body.length) { flush(); pending = []; body = []; }
      pending.push(m[1]);
      continue;
    }
    if (pending.length) body.push(l);
  }
  flush();
  return posts;
}

interface Callsite { at: string; ops: string; ctx: string; }

function unanchoredCallsites(): Callsite[] {
  const posts = postingKinds();
  const found: Callsite[] = [];
  for (const file of tsFiles(SRC)) {
    const src = readFileSync(file, 'utf8');
    const rel = file.slice(SRC.length).replace(/\\/g, '/').replace(/^\/?/, '');
    let idx = 0;
    while ((idx = src.indexOf('applyOps(', idx)) >= 0) {
      const open = idx + 'applyOps'.length;
      // La DÉCLARATION d'`applyOps` n'est pas un appel.
      if (/\b(function|const|export)\s*$/.test(src.slice(Math.max(0, idx - 20), idx))) { idx = open; continue; }
      const [, opsArg = '', ctxArg = ''] = callArgs(src, open);
      const ops = opsArg.trim();
      const ctx = ctxArg.trim();
      idx = open;
      if (ANCHOR.test(ctx)) continue;
      // Ctx TRANSMIS par l'appelant (`ctx`, `{...ctx}`, `leafOpsCtx(ctx, …)`, `inner`) : l'ancrage est
      // celui du site D'ORIGINE — imputer le trou ici désignerait le facteur, pas l'expéditeur.
      if (FORWARDED.test(ctx)) continue;
      // Ops LITTÉRALES : on décide sur leurs kinds ; ops opaques (`e.ops`, variable) : conservateur.
      const kinds = [...ops.matchAll(/\bop:\s*'([a-zA-Z0-9_-]+)'/g)].map((m) => m[1]);
      if (/^\[/.test(ops) && kinds.length) {
        // `condition` ne pose un effet actif que sous `perRound` — sinon c'est un État, déjà ancré
        // par son propre catalogue (`chipCodex` route un malus par `condId`).
        const posting = kinds.some((k) => (k === 'condition' ? /perRound/.test(ops) : posts.has(k)));
        if (!posting) continue;
      }
      const line = src.slice(0, idx).split('\n').length;
      found.push({ at: `src/${rel}:${line}`, ops: ops.replace(/\s+/g, ' ').slice(0, 60), ctx: ctx.replace(/\s+/g, ' ').slice(0, 60) });
    }
  }
  return found;
}

/**
 * Stock connu au 2026-07-18 — chaque entrée est un effet actif potentiellement affiché NU au joueur.
 * Le déclencheur est nommé pour que le trou se comble, pas qu'il se compte. Cette liste ne peut que
 * décroître : ancrer un callsite (poser `effectId`/`sourceSpellId` sur son `OpsCtx`) impose de l'ôter d'ici.
 */
const BASELINE: string[] = [
  'src/engine/conditions.ts:453', // re-jeu des `opsPerRound` d'un effet en fin de Round (source de l'effet d'origine perdue)
  'src/engine/critical.ts:109', // ops d'une Blessure critique tirée sur sa table de localisation
  'src/engine/domainAttributes.ts:113', // ops d'un Attribut de domaine de magie
  'src/engine/shipCritical.ts:153', // échec du Test d'équipage d'un critique de navire
  'src/engine/shipCritical.ts:184', // ops d'un critique de navire
  'src/engine/shipCritical.ts:195', // ops d'un critique de navire (équipage)
  'src/engine/shipCritical.ts:214', // éclats d'un critique de navire
  'src/engine/shipCritical.ts:226', // ops d'un critique de navire supplémentaire
  'src/state/aiSpellValue.ts:184', // simulation d'IA sur un CLONE — jamais affichée au joueur
  'src/state/combatEffects.ts:873', // ops d'un Souffle de zone (effet de scène)
  'src/state/combatFlow.ts:1057', // gains d'une Empoignade remportée
  'src/state/combatFlow.ts:1408', // ops d'une Blessure critique en combat
  'src/state/combatFlow.ts:1487', // ops de l'issue d'une manœuvre
  'src/state/combatFlow.ts:1795', // ops d'entrée en Empoignade
  'src/state/innFlow.ts:60', // op d'une activité d'auberge
  'src/state/interludeFlow.ts:727', // jeton de renversement gagné en interlude
  'src/state/interludeFlow.ts:737', // jeton de renversement gagné en interlude
  'src/state/interludeFlow.ts:747', // variation de Statut en interlude
  'src/state/interludeFlow.ts:956', // ops immédiates d'un événement d'interlude
  'src/state/interludeFlow.ts:1127', // issues DIFFÉRÉES à la clôture d'un interlude
  'src/state/medicFlow.ts:222', // pénalité posée par un soin raté
  'src/state/restFlow.ts:404', // ops d'échec d'une étape de repos
  'src/state/seaVoyageFlow.ts:1844', // brûlure de vapeur (scaldOps) d'une pièce de machine
  'src/state/seaVoyageFlow.ts:2230', // Talent Chanceux octroyé par un événement de bord
  'src/state/seaVoyageFlow.ts:2239', // bonus de DR octroyés par un événement de bord
  'src/state/travelFlow.ts:1013', // ops subies par l'occupant d'une rencontre de voyage
  'src/state/travelPostes.ts:290', // Exténué du Test de résistance de traversée (État : ancré par son condId)
  'src/state/zones.ts:156', // ops de franchissement d'une zone d'effet
  'src/state/zones.ts:176', // ops récurrentes d'une zone d'effet
];

describe('ancrage de règle des ActiveEffect posés', () => {
  it('les kinds posants sont LUS dans le switch d’applyOps (le périmètre suit le moteur)', () => {
    const posts = postingKinds();
    // Témoins : `charMod` pose un effet actif temporisé, `wounds` non (dégâts immédiats).
    expect(posts.has('charMod')).toBe(true);
    expect(posts.has('perRound')).toBe(true);
    expect(posts.has('wounds')).toBe(false);
  });

  it('applyOps stampe l’ENTITÉ SOURCE du ctx sur les effets qu’il pose (ancrage général)', () => {
    const target = { id: 'c', name: 'C', characteristics: {}, conditions: [], activeEffects: [], wounds: { current: 10, max: 10, base: 10 } } as unknown as Combatant;
    applyOps(target, [{ op: 'charMod', char: 'force', mod: 10 }], {
      label: 'Force du taureau', source: { kind: 'spell', id: 'benediction-de-puissance' },
    });
    expect(target.activeEffects?.[0].source).toEqual({ kind: 'spell', id: 'benediction-de-puissance' });
  });

  it('aucune NOUVELLE source d’effet actif sans ancrage de règle (source / sourceSpellId / effectId)', () => {
    const nouveaux = unanchoredCallsites().filter((c) => !BASELINE.includes(c.at));
    expect(
      nouveaux.map((c) => `${c.at}  ops=${c.ops}  ctx=${c.ctx}`),
      'un effet actif posé sans ancrage s’affiche NU (ni fiche, ni popover) : passer `effectId` (ou '
        + '`sourceSpellId`) dans l’OpsCtx de ces callsites, et relier l’id à une entrée de catalogue',
    ).toEqual([]);
  });

  it('la baseline DÉCROÎT : aucun callsite listé n’a été ancré sans être ôté de la liste', () => {
    const restants = new Set(unanchoredCallsites().map((c) => c.at));
    const perimes = BASELINE.filter((at) => !restants.has(at));
    expect(perimes, 'ces callsites ne sont plus (ou ne sont plus au même endroit) : ôter de BASELINE').toEqual([]);
  });
});
