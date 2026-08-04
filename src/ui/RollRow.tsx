import type { ReactNode } from 'react';
import type { Combatant } from '../engine/types';
import { RollPanel, type PanelRowData } from './RollPanel';
import { InfluenceRow } from './InfluenceRow';
import { OptionChooser, type RollOption } from './OptionChooser';
import { GatedAction } from './GatedAction';
import { ResilienceButton } from './ResilienceButton';
import { ResistButton } from './ResistButton';
import { ReverseButton } from './ReverseButton';
import { ForcedRollPicker } from './ForcedRollPicker';
import { useRollFrisson } from './useRollFrisson';
import { DiceRoll } from './DiceRoll';
import { d100Faces } from './Dice';
import { DrBar } from './DrBar';
import { Icon } from './Icon';
import { CodexRef } from './compendium/CodexRef';
import type { FLOW_VERBS } from '../state/rollFlowSpecs';

/** Libellé par défaut du bouton « Lancer » (rangée seule ET coquille `RollShell` hissée). */
export const DEFAULT_ROLL_LABEL = <><Icon id="nav/dice" size="sm" /> Lancer</>;

/**
 * Une RANGÉE de jet (mono OU participant d'un flux MULTI), pendant UI de la fabrique `makeRollFlow`
 * côté slot : la ligne de jet (en attente puis résultat via `RollPanel`) + son PROPRE cycle
 * d'influence (`InfluenceRow` : Chance/relance gratuite/+1 DR/Pacte/Résilience) une fois lancé,
 * sinon un bouton « Lancer ». `interactive=false` → rangée TÉMOIN (lecture seule, subsume
 * `MultiRollList`). L'acteur, quand fourni, est passé à `InfluenceRow` qui en dérive
 * Chance/relance gratuite/Résilience ; sinon les primitives `fortune`/`freeReroll`/`resilience`
 * (prioritaires) permettent une rangée sans objet `Combatant` (vues pures testables).
 */
export function RollRow({
  actor,
  fortune,
  freeReroll,
  resilience,
  row,
  rolled,
  interactive = true,
  rollLabel = DEFAULT_ROLL_LABEL,
  onRoll,
  rerollable = false,
  onReroll,
  onBonusSL,
  darkPactable,
  onDarkPact,
  onForce,
  preRollForce,
  forceShow = false,
  forcedRoll,
  fixedMark = false,
  determination,
  resist,
  reverse,
  declare,
  rollBlocked,
  rollFrisson = true,
  rollInBar = false,
  winner,
  extendedDr,
}: RollRowProps) {
  // Frisson du jet (helper partagé avec le bouton « Lancer » hissé dans la barre du RollShell).
  const { rolling, landed, trigger: doRoll, skip } = useRollFrisson(onRoll, { frisson: rollFrisson });
  // Frisson de la RELANCE (Chance/Sombre Pacte, #396) — même geste que le jet initial : les deux
  // verbes appellent `reresolveOf` (nouveau jet RNG) dans `rollFlowFactory`, à la différence de
  // « +1 DR »/Résilience/Résistance/Détermination qui AJUSTENT le jet existant sans le relancer.
  const { rolling: rerolling, landed: rerollLanded, trigger: doReroll, skip: skipReroll } = useRollFrisson(undefined, { frisson: rollFrisson });
  const resil = resilience ?? actor?.resilience ?? 0;
  // Vraies faces (#396 v3) : `row.d.roll` n'est FRAIS qu'une fois le résolveur commis (React 18 batch
  // la transition `landed` et le re-rendu du store dans le MÊME rendu) — jamais pendant le tumble.
  const rowFaces = (landed || rerollLanded) && row.d ? d100Faces(row.d.roll) : null;
  const determineBtn = determination && determination.resolve > 0 && (
    <>
      <button className="btn btn-resource" onClick={determination.onResolve}>
        <Icon id="resource/resolve" size="sm" /> Détermination ×{determination.resolve}
      </button>
      <CodexRef category="characteristics" id="determination" label="Détermination" className="ab-codex-info"><Icon id="journal/info" size="sm" /></CodexRef>
    </>
  );
  return (
    <div className="prow">
      {/* Accent gagnant/perdant du Test opposé porté PAR la rangée (le panneau est mono → indice 0 = cette ligne :
          `winnerIndex=0` → `rr-win`, `≠0` → `rr-lose`). Le badge « DR net » reste au niveau RollShell (source unique). */}
      {/* MARQUE de provenance : ce jet n'a pas été obtenu au dé mais SAISI par le joueur (option « Dés
          fixés »). Elle reste visible tant que la rangée vit — le journal porte la même mention. UNE seule
          surface à l'écran : quand le sélecteur est rendu, c'est SON étiquette qui porte la marque
          (`marked`) ; cette pastille sert les rangées SANS sélecteur (témoins, bilan, siège voisin).
          RATTACHÉE À SA LIGNE (même conteneur que le panneau, suffixe) : détachée, elle flottait au
          milieu d'un récap et ne disait plus DE QUELLE ligne elle parlait. */}
      <div className="prow-line">
        <RollPanel rows={[row]} winnerIndex={winner === 'win' ? 0 : winner === 'lose' ? 1 : null} />
        {fixedMark && !forcedRoll?.fixed && <span className="hint prow-fixed-mark"><Icon id="nav/dice" size="sm" /> Dé fixé</span>}
      </div>
      {/* Progression d'un Test ÉTENDU (LDB 12) — SITE UNIQUE de rendu de la barre de DR de rangée
          (arbitrage user 2026-07-11) : les émetteurs (cartographie, Peur de combat, périls…) ne posent
          QUE la donnée `extendedDr` ; elle vit SUR la rangée et persiste (rangées témoins/batch/bilan). */}
      {extendedDr && <DrBar cum={extendedDr.cum} target={extendedDr.target} />}
      {/* Roulis du jet INITIAL — inline (`scene={false}`) : une scène centrale par participant serait
          absurde en multi. `rollInBar` : la coquille (RollShell) porte la scène CENTRALE à sa place
          (cas mono, une seule rangée à lancer). Découplé de `rolled` (`rolled` bascule DÈS le
          résolveur commis, en plein `landed`) : sinon les vraies faces n'auraient pas le temps de
          s'afficher avant que ce bloc ne cède la place à `InfluenceRow`. */}
      {interactive && (rolling || landed) && !rollInBar && (
        <DiceRoll onSkip={skip} landed={landed} faces={rowFaces} scene={false} />
      )}
      {interactive && !rolled && !rolling && !landed && (
        <div className="prow-act">
          {/* DÉCLARATION de la rangée (phase 1 d'une fenêtre à composition : contrer seul / s'unir /
              passer) — elle précède les choix de règle : elle décide QUI lance. Rendue par la
              primitive de choix d'options (segmented control), jamais par un markup de modale.
              `hint` porte le libellé de situation fourni par le site. */}
          {declare && (
            <OptionChooser
              layout="seg"
              groupLabel={declare.groupLabel ?? 'Déclarer'}
              options={declare.options.map((o) => ({ ...o, selected: o.key === declare.value, onSelect: () => declare.onChoose(o.key) }))}
            />
          )}
          {declare?.hint && <span className="hint">{declare.hint}</span>}
          {/* Résilience PRÉ-jet (LDB 17 l.68 « au lieu de lancer les dés ») — disponible AVANT de lancer, pas
              seulement après un échec, comme la coquille `RollShell`. */}
          {onForce && <ResilienceButton resilience={resil} show onForce={preRollForce ?? onForce} />}
          {/* Résistance (Menace) PRÉ-jet (LDB 10 : « réussir automatiquement le premier Test »). */}
          {resist && <ResistButton menace={resist.menace} show onResist={resist.onResist} />}
          {determineBtn}
          {/* Sélecteur PRÉ-jet du dé FIXÉ : la saisie lance le jet puis y substitue la valeur (`onSet` du
              site appelant). Option de CONFORT — elle passe APRÈS les choix de règle, avant le CTA. */}
          {forcedRoll?.fixed && <ForcedRollPicker {...forcedRoll} marked={fixedMark} />}
          {/* CTA de jet. `rollBlocked` = le résolveur REFUSERA (le site fournit la raison, dérivée de
              SES propres gardes) : le bouton se désactive AVEC sa raison visible (`GatedAction`), au
              lieu de rester cliquable pour rien. */}
          {onRoll && !rollInBar && (rollBlocked
            ? <GatedAction id={`prow-roll-${actor?.id ?? 'row'}`} label={rollLabel} enabled={false} reason={rollBlocked} onClick={() => {}} btnClassName="small" />
            : <button className="btn small btn-primary" onClick={() => doRoll()}>{rollLabel}</button>)}
        </div>
      )}
      {/* Roulis de la RELANCE (Chance/Sombre Pacte) — même primitive inline, même règle de découplage. */}
      {interactive && (rerolling || rerollLanded) && (
        <DiceRoll onSkip={skipReroll} landed={rerollLanded} faces={rowFaces} scene={false} />
      )}
      {interactive && rolled && !rolling && !landed && !rerolling && !rerollLanded && (
        <>
          {forcedRoll && <ForcedRollPicker {...forcedRoll} marked={fixedMark} />}
          <InfluenceRow
            actor={actor}
            fortune={fortune}
            freeReroll={freeReroll}
            resilience={resilience}
            rerollable={rerollable}
            onReroll={() => doReroll(onReroll ?? (() => {}))}
            onBonusSL={onBonusSL}
            darkPactable={darkPactable}
            onDarkPact={onDarkPact && (() => doReroll(onDarkPact))}
            onForce={onForce}
            forceShow={forceShow}
          >
            {resist && <ResistButton menace={resist.menace} show onResist={resist.onResist} />}
            {reverse && <ReverseButton show onReverse={reverse.onReverse} preview={reverse.preview} />}
            {forceShow && determineBtn}
          </InfluenceRow>
        </>
      )}
    </div>
  );
}

export interface RollRowProps {
  /** L'acteur du jet : Chance/relance gratuite/Résilience en sont DÉRIVÉES (passé une fois). Optionnel :
   *  une vue pure fournit plutôt les primitives `fortune`/`freeReroll`/`resilience`. */
  actor?: Combatant;
  /** Primitives — PRIORITAIRES sur `actor` quand fournies (rangée sans `Combatant`, testable). */
  fortune?: number;
  freeReroll?: boolean;
  resilience?: number;
  row: PanelRowData;
  rolled: boolean;
  interactive?: boolean;
  rollLabel?: ReactNode;
  onRoll?: () => void;
  rerollable?: boolean;
  onReroll?: () => void;
  onBonusSL?: () => void;
  darkPactable?: boolean;
  onDarkPact?: () => void;
  /** Absent → pas de Résilience sur ce flux. */
  onForce?: () => void;
  /** Action Résilience PRÉ-jet spécifique (défaut : `onForce`). */
  preRollForce?: () => void;
  forceShow?: boolean;
  /** « vous choisissez le résultat » (LDB 17 l.68) : sélecteur du dé. DEUX provenances, un seul contrôle —
   *  `fixed` absent = dé CHOISI de la Résilience (post-jet, doit rester une réussite) ; `fixed` = dé FIXÉ
   *  par l'option de confort (avant OU après le jet, tout le d100). Absent → pas de sélecteur.
   *  `roll: null` = offre PRÉ-jet (champ vide : rien n'est fixé tant que le joueur n'a pas saisi).
   *  Site UNIQUE de dérivation : `ui/forcedDieRow.ts`. */
  forcedRoll?: { roll: number | null; target: number; onSet: (roll: number) => void; critable?: boolean; fixed?: boolean; max?: number; mod?: number; effective?: number | null; commitOnBlur?: boolean };
  /** Ce jet a été SAISI par le joueur (option « Dés fixés ») → mention « dé fixé » sur la rangée. */
  fixedMark?: boolean;
  /** Flux PROPRE à cette rangée quand il DIFFÈRE de celui de la coquille (`RollShell.flowKey`) :
   *  « Se désengager » héberge les rangées du flux `flee` (coup dans le dos + Calme), la cascade
   *  héberge l'étape courante. Sans lui, le sélecteur de dé serait dérivé du mauvais pending.
   *  `key` sert alors d'id de slot (participant) — c'est déjà sa valeur en multi. */
  flowKey?: keyof typeof FLOW_VERBS;
  /** OPT-OUT du sélecteur de dé dérivé par `RollShell` : le SITE interdit tout choix (cible
   *  Inconsciente — le moteur a déjà choisi le meilleur dé, seule la Localisation reste un choix). */
  noForcedDie?: boolean;
  /** Détermination (LDB 17 l.62) : immunité Psychologie. */
  determination?: { resolve: number; onResolve: () => void };
  /** Résistance (Menace) (LDB 10) : auto-succès du talent — fourni quand disponible ET issue encore
   *  défavorable (le parent décide). Affiché AVANT le jet et après un échec. */
  resist?: { menace: string; onResist: () => void };
  /** Inversion de Test (LDB 23/LDB 10) : fourni SEULEMENT quand une voie (Talent/jeton) est OFFERTE
   *  (le parent décide via `FLOWS.<flux>.reverseAvailable`). `preview` (`FLOWS.<flux>.reversePreview`) —
   *  dé renversé + DR/succès — rend l'issue LISIBLE avant le clic. */
  reverse?: { onReverse: () => void; preview?: { roll: number; sl: number; success: boolean } | null };
  /** DÉCLARATION de CETTE rangée (phase 1 d'une fenêtre à composition — Contre-sort : contrer seul /
   *  s'unir au Test Soutenu, LDB 46 l.162 / LDB 12 l.189 / passer). Les options sont des `RollOption`
   *  de la primitive de choix (`OptionChooser`) : le site fournit clés, libellés et indisponibilités.
   *  `hint` dit la situation résultante (« soutient X (+10) ») ; une rangée qui ne lance pas ne reçoit
   *  PAS de `onRoll` — le site décide, la primitive rend. */
  declare?: {
    value?: string;
    options: RollOption[];
    onChoose: (key: string) => void;
    groupLabel?: ReactNode;
    hint?: ReactNode;
  };
  /** Le résolveur du flux REFUSERA ce jet (garde de règle du SITE) : le CTA se rend désactivé avec
   *  CETTE raison en texte visible (`GatedAction`) au lieu d'un bouton mort. La raison se DÉRIVE des
   *  mêmes prédicats que la garde d'effet — jamais une seconde condition recopiée. */
  rollBlocked?: string;
  /** Anime le jet (dés qui roulent puis se figent sur les vraies faces) avant de résoudre — DÉFAUT
   *  `true` (#396 : tout jet roule). Honore `prefers-reduced-motion`. Skippable au clic sur le roulis. */
  rollFrisson?: boolean;
  /** La coquille (`RollShell`, cas mono) rend « Lancer » + son spinner dans `.modal-actions` :
   *  la rangée n'affiche alors NI le bouton inline NI le spinner (le reste — influence, Résilience
   *  pré-jet, résistance — inchangé). Le shell le pose lui-même ; les hooks/modales n'y touchent pas. */
  rollInBar?: boolean;
  /** Test opposé : accent de CETTE rangée (`'win'` = gagnante accentuée, `'lose'` = perdante atténuée).
   *  Traduit en `winnerIndex` du panneau mono. Absent/`null` → pas d'accent (jet non opposé). */
  winner?: 'win' | 'lose' | null;
  /** Test ÉTENDU (LDB 12) : progression cumulée (`cum`) vers la cible (`target`) — rendue en `DrBar`
   *  SUR la rangée (site UNIQUE, arbitrage user 2026-07-11). Les call-sites posent la DONNÉE, jamais le composant. */
  extendedDr?: { cum: number; target: number };
}
