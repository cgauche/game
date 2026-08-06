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
 * compacte sur la LIGNE DE TITRE de l'étape (`stepSubtitle`, `CascadeModal`), dérivé de la MÊME
 * entrée d'enjeu.
 */
import { resolveStake, type StakeRef } from '../data';
import { CodexRef } from './compendium/CodexRef';
import { Icon } from './Icon';
import { Prose } from './Prose';

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
 * `StakeRule` — la PORTE du renvoi de règle, en affordance COMPACTE accolée au titre de l'étape ou
 * de la fenêtre (arbitrage user 2026-08-06). SOURCE UNIQUE du déclencheur : `CascadeModal.stepSubtitle`
 * la compose pour les cascades, les modales mono pour leurs titres. Rien quand aucun foyer n'est
 * déclaré, ou quand la fiche est inconnue du Codex (`hideIfUnknown`).
 */
export function StakeRule({ rule, label }: { rule?: { category: string; id: string }; label: string }) {
  if (!rule) return null;
  return (
    <CodexRef
      category={rule.category}
      id={rule.id}
      label={label}
      ariaLabel={`Règle : ${label}`}
      className="ab-codex-info"
      hideIfUnknown
    >
      <Icon id="journal/info" size="sm" />
    </CodexRef>
  );
}

/** Foyer de règle DÉRIVÉ d'une référence d'enjeu — le producteur ne nomme jamais la fiche. */
export function stakeRuleOf(stake: StakeRef) {
  return resolveStake(stake).rule;
}
