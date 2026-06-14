import { useGame } from '../state/store';
import { canReroll } from '../engine/fortune';
import { freeRerollOf } from '../engine/activeFlags';
import { RollFlowShell } from './RollFlowShell';
import { RollPanel, type RollRowData } from './RollPanel';
import { JournalLine } from './NarratedLine';
import { ev, type CombatEventKind } from '../state/combatLog';
import { cascadeAppliers } from '../state/cascade';
import type { CascadeStep, CascadeRoll } from '../state/pendings';
import type { Combatant } from '../engine/types';

/**
 * CASCADE de jets SÉQUENTIELS (nuit / voyage) — c'est LA coquille de jet partagée `RollFlowShell`,
 * paramétrée comme `DefenseModal` : plusieurs LIGNES de jet avec portraits (`RollPanel rows`), les
 * étapes déjà validées FIGÉES, l'étape COURANTE active (pending → résultat) avec son cycle Chance/
 * +1 DR/Pacte/Résilience. « Continuer » enchaîne sur le jet suivant. Aucun affichage différent d'une
 * autre modale. Nuit SUBIE → pas d'« Annuler » (comme TestModal/CorruptionModal).
 */
export function CascadeModal() {
  const battle = useGame((s) => s.battle);
  const party = useGame((s) => s.party);
  const p = useGame((s) => s.pendingCascade);
  const roll = useGame((s) => s.cascadeRoll);
  const reroll = useGame((s) => s.cascadeReroll);
  const bonusSL = useGame((s) => s.cascadeBonusSL);
  const darkPact = useGame((s) => s.cascadeDarkPact);
  const force = useGame((s) => s.cascadeForceSuccess);
  const next = useGame((s) => s.cascadeNext);
  const resolveAll = useGame((s) => s.cascadeCancel); // « Tout lancer » : résout d'un coup les jets restants

  if (!p) return null;
  const cur = p.participants[p.cursor];
  if (!cur) return null;
  const pool: Combatant[] = battle?.combatants ?? party;
  const actorOf = (s: CascadeStep) => (s.actorId ? pool.find((c) => c.id === s.actorId) : undefined);
  const actor = actorOf(cur);
  if (!actor) return null;
  const res = cur.result;
  const rolled = cur.target == null ? true : !!res;
  const failed = !!res && !res.success;
  const isLast = p.cursor + 1 >= p.participants.length;

  // Libellé de rangée = la COMPÉTENCE lancée (« Résistance », « Calme »…), comme Défense affiche
  // « Attaque »/« Parade » — pas le texte de l'étape (le but vit dans le sous-titre). L'icône
  // distingue deux « Résistance » dans la pile figée (Exposition 🥶 vs Marche forcée 🥾 vs Contagion 🤒).
  const rowLabel = (s: CascadeStep) => `${s.icon ?? ''} ${s.rollLabel ?? 'Jet'}`.trim();
  const breakdown = (s: CascadeStep, r: CascadeRoll) => {
    const b = s.base ?? s.target ?? 0;
    return { label: rowLabel(s), base: b, modifier: (s.target ?? b) - b, target: s.target ?? b, roll: r.roll, success: r.success, sl: r.sl };
  };
  const pendingOf = (s: CascadeStep) => {
    const b = s.base ?? s.target ?? 0;
    return { label: rowLabel(s), base: b, mods: s.base != null && s.target != null && s.target !== s.base ? [{ label: 'difficulté', value: s.target - s.base }] : [] };
  };
  // Lignes des étapes DÉJÀ validées (figées), avec portrait — comme la ligne attaquant de Défense.
  const doneRows: RollRowData[] = p.participants.slice(0, p.cursor)
    .map((s): RollRowData | null => { const a = actorOf(s); return a && s.result ? { combatant: a, d: breakdown(s, s.result) } : null; })
    .filter((r): r is RollRowData => r !== null);
  const curPending: RollRowData = { combatant: actor, pending: pendingOf(cur) };
  // Issue = la CONSÉQUENCE (« contracte la maladie », « récupère des Blessures »), pas « X réussit » :
  // comme Défense écrit « Touché — Tête · 3 Blessures ». Fournie par le registre du `kind` (co-localisée
  // avec l'applier) — PAS un switch dans l'UI : ajouter un kind ne touche pas cette modale. Le détail
  // chiffré part au journal à « Continuer ». Repli générique si le kind ne décrit pas son issue.
  const ocText = res ? (cascadeAppliers[cur.kind]?.describe?.(res.success, actor.name) ?? (res.success ? `${actor.name} réussit.` : `${actor.name} échoue.`)) : null;
  const ocEv: CombatEventKind = res?.success ? 'heal' : 'condition';

  return (
    <RollFlowShell
      title={`${p.icon ?? '🎲'} ${p.title}`}
      subtitle={<><strong>{cur.icon ?? '🎲'} {cur.label}</strong>{p.participants.length > 1 ? ` · jet ${p.cursor + 1}/${p.participants.length}` : ''}</>}
      rolled={rolled}
      onRoll={() => roll(cur.id)}
      /* Pré-jet : panneau multi-lignes (validées figées + courante en attente) — comme Défense. */
      setup={<RollPanel rows={[...doneRows, curPending]} />}
      /* Post-jet : mêmes lignes, la courante désormais lancée (vainqueur non pertinent ici). */
      rows={res ? [...doneRows, { combatant: actor, d: breakdown(cur, res) }] : undefined}
      outcome={ocText ? <JournalLine className="rm-journal" event={ev(ocEv, ocText, actor.id)} combatants={pool} /> : undefined}
      fortune={actor.fortune ?? 0}
      freeReroll={freeRerollOf(actor)}
      rerollable={!!res && canReroll(failed, !!cur.rerolled)}
      onReroll={() => reroll(cur.id)}
      onBonusSL={() => bonusSL(cur.id)}
      darkPactable={!!res && failed && actor.kind === 'hero'}
      onDarkPact={() => darkPact(cur.id)}
      resilience={actor.resilience ?? 0}
      onForce={() => force(cur.id)}
      forceShow={rolled && !res?.success}
      confirmLabel={isLast ? 'Terminer' : 'Continuer'}
      onConfirm={() => next()}
      /* « Tout lancer » : tant qu'il reste >1 jet, résout d'un coup les étapes restantes (RNG, sans
         influence) — slot secondaire partagé du shell (comme « Subir » de Défense). Pas d'Échap : la
         cascade est SUBIE, on ne ferme pas — le bouton est une action explicite, pas une sortie. */
      onCancel={!isLast ? () => resolveAll() : undefined}
      cancelLabel="🎲 Tout lancer"
      cancelTitle="Résoudre d'un coup tous les jets restants (sans influence)"
      cancelAfterRoll
      disableEscClose
    />
  );
}
