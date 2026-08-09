/**
 * `StakeNote` — PRIMITIVE de la zone Z3b (l'ENJEU d'un jet, #1117) : la PHRASE, et elle seule.
 *
 * Elle ne reçoit QU'UNE `StakeRef` (clé de donnée + valeurs calculées) : le texte est RÉSOLU ici par
 * la porte unique `resolveStake` — aucun appelant ne peut écrire l'enjeu. Classe PROPRIÉTAIRE
 * `.rm-stake` : Z3b a besoin d'un propriétaire distinguable (`.rm-note` est la note générique de
 * 6 sites, `.rm-threat` porte un AUTRE sens — la menace SUBIE, fond rouge). Ton NEUTRE : un enjeu
 * ANNONCE, il ne menace pas.
 *
 * Le RENVOI vers la fiche de règle n'est PAS ici (arbitrage user 2026-08-06 : « "la régle" ? C'est
 * moche. Je pensais que tu allais mettre un "i" a coté de "Cauchemars" ») : il vit en affordance
 * compacte sur la LIGNE DE TITRE de la fenêtre (`CascadeBody.titleNode`, `CascadeModal`), qui porte le
 * libellé du pas COURANT ; dérivé de la MÊME entrée d'enjeu.
 */
import { isValidElement, type ReactNode } from 'react';
import { resolveStake, type StakeRef } from '../data';
import { CodexRef } from './compendium/CodexRef';
import { Icon } from './Icon';
import { Prose } from './Prose';
import { GameOpChips } from './GameOpChips';
import type { GameOp } from '../engine/ops';

export function StakeNote({ stake }: { stake: StakeRef }) {
  // Entrée d'enjeu SANS gabarit (#1117) : la donnée ne porte plus que son foyer de règle — le jet dit
  // ce qu'il met en jeu par ses CHIPS d'ops (`OutcomeNote`), et le verbatim reste au ⓘ du titre.
  const { text } = resolveStake(stake);
  if (!text) return null;
  return (
    <div className="rm-stake">
      <Icon id="nav/dice" size="sm" />
      <div>
        <Prose md={text} />
      </div>
    </div>
  );
}

/**
 * `OutcomeNote` — l'encadré « Réussite / Échec » d'un jet, en régime CALCULÉ (#1117, arbitrage user
 * verbatim au ticket : « l'encadré "Réussite/Echec" se calcule plutot qu'écrit a la main, surtout
 * qu'avec les régles optionnelles qui veulent rentrer en jeu et modifier le comportement »).
 *
 * Il ne reçoit AUCUN texte : uniquement les `GameOp` CERTAINES de chaque branche (`certainFlowOps`),
 * humanisées par la source unique `GameOpChips`/`opRows` — donc une règle optionnelle qui change les
 * ops change l'encadré, par construction. Une branche INCERTAINE (`undefined` : second jet, choix,
 * `if` non repliable) n'est PAS rendue : promettre ce qui dépend d'une Condition serait pire que se
 * taire. Une branche vide se dit (« rien »), c'est une réponse.
 *
 * `realized` — la branche que le jet A TRANCHÉE : l'encadré se FILTRE alors à elle seule et devient le
 * VERDICT (mêmes ops, même rendu, aucune seconde surface à synchroniser). Absent = avant le jet, les
 * deux issues sont annoncées.
 */
export function OutcomeNote({ onSuccess, onFail, realized }: { onSuccess?: GameOp[]; onFail?: GameOp[]; realized?: 'success' | 'fail' }) {
  const succ = realized === 'fail' ? undefined : onSuccess;
  const fail = realized === 'success' ? undefined : onFail;
  if (!succ && !fail) return null;
  return (
    <div className="rm-stake">
      <Icon id="journal/info" size="sm" />
      <div>
        {succ ? <p><b>Réussite :</b> {succ.length ? <GameOpChips ops={succ} /> : 'rien.'}</p> : null}
        {fail ? <p><b>Échec :</b> {fail.length ? <GameOpChips ops={fail} /> : 'rien.'}</p> : null}
      </div>
    </div>
  );
}

/**
 * `StakeRule` — la PORTE du renvoi de règle, en affordance COMPACTE accolée au titre de l'étape ou
 * de la fenêtre (arbitrage user 2026-08-06). SOURCE UNIQUE du déclencheur : `CascadeBody.titleNode`
 * la compose pour les cascades, `RollShell` l'accole LUI-MÊME au titre de toute modale de jet qui pose
 * un `stake` (Z3b′ tenue par le SOCLE, plus par discipline au site). Rien quand aucun foyer n'est
 * déclaré, ou quand la fiche est inconnue du Codex (`hideIfUnknown`).
 * `label` VIDE : le nom accessible n'est plus imposé — `CodexRef` le dérive du libellé de la fiche
 * (un titre sans texte, purement icônique, n'a rien à prêter).
 */
export function StakeRule({ rule, label }: { rule?: { category: string; id: string }; label: string }) {
  if (!rule) return null;
  return (
    <CodexRef
      category={rule.category}
      id={rule.id}
      label={label}
      {...(label ? { ariaLabel: `Règle : ${label}` } : null)}
      className="ab-codex-info"
      hideIfUnknown
    >
      <Icon id="journal/info" size="sm" />
    </CodexRef>
  );
}

/** Le nœud porte-t-il DÉJÀ un `StakeRule` ? Reconnaissance par IDENTITÉ de composant (pas une
 *  heuristique de classe ou de texte) : `RollShell` s'en sert pour ne pas doubler le renvoi quand un
 *  site l'a composé lui-même dans son titre. */
export function hasStakeRule(node: ReactNode): boolean {
  if (Array.isArray(node)) return node.some(hasStakeRule);
  if (!isValidElement(node)) return false;
  if (node.type === StakeRule) return true;
  return hasStakeRule((node.props as { children?: ReactNode }).children);
}

/** Foyer de règle DÉRIVÉ d'une référence d'enjeu — le producteur ne nomme jamais la fiche. */
export function stakeRuleOf(stake: StakeRef) {
  return resolveStake(stake).rule;
}

/** Égalité STRUCTURELLE de deux valeurs pur-donnée (op, formule imbriquée, tableau) — comparaison par
 *  CLÉS (ordre des propriétés indifférent) et par POSITION dans un tableau (l'ordre des ops d'une
 *  branche est celui de sa lecture, il porte du sens). Aucune sérialisation : un `JSON.stringify`
 *  rendrait le verdict dépendant de l'ordre d'écriture des clés. PURE. */
function sameData(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (Array.isArray(a) || Array.isArray(b)) {
    return Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((x, i) => sameData(x, b[i]));
  }
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false;
  const ka = Object.keys(a as object);
  const kb = Object.keys(b as object);
  return ka.length === kb.length
    && ka.every((k) => k in (b as object) && sameData((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k]));
}

/** Deux rangées ANNONCENT-elles la même chose ? Compare les ops CERTAINES d'une branche par leur
 *  STRUCTURE (refs et valeurs), jamais par leur rendu : c'est ce qui autorise une fenêtre MULTI à
 *  n'énoncer qu'UNE fois une promesse commune (« à la table, le MJ l'annonce une fois »). Une branche
 *  INDÉCIDABLE (`undefined` — un second jet décide) n'est PAS la même chose qu'une branche vide
 *  (`[]` = « rien ») : la divergence par SILENCE reste une divergence. PURE. */
export function sameCertainOps(a: GameOp[] | undefined, b: GameOp[] | undefined): boolean {
  if (a === undefined || b === undefined) return a === b;
  return sameData(a, b);
}
