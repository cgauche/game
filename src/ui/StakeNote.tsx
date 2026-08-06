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
  return (
    <div className="rm-stake">
      <Icon id="nav/dice" size="sm" />
      <div>
        <Prose md={resolveStake(stake).text} />
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
 * ops change l'encadré, par construction. Une branche INCERTAINE (`undefined` : `if`, second jet,
 * choix) n'est PAS rendue : promettre ce qui dépend d'une Condition serait pire que se taire. Une
 * branche vide se dit (« rien »), c'est une réponse.
 */
export function OutcomeNote({ onSuccess, onFail }: { onSuccess?: GameOp[]; onFail?: GameOp[] }) {
  if (!onSuccess && !onFail) return null;
  return (
    <div className="rm-stake">
      <Icon id="journal/info" size="sm" />
      <div>
        {onSuccess ? <p><b>Réussite :</b> {onSuccess.length ? <GameOpChips ops={onSuccess} /> : 'rien.'}</p> : null}
        {onFail ? <p><b>Échec :</b> {onFail.length ? <GameOpChips ops={onFail} /> : 'rien.'}</p> : null}
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
