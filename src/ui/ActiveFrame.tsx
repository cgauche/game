import { PortraitTile } from './PortraitTile';
import { StateChips } from './StateChips';
import { advantageCapFor } from '../engine/advantage';
import type { Combatant } from '../engine/types';

/** Jauge CRANTÉE à taille fixe : N segments égaux dans une longueur constante (2 ou 150 points →
 *  même encombrement). `vertical` = colonne (remplie du bas vers le haut). `spend`/`gain` = aperçu
 *  de clic : les crans qui VONT être dépensés (`on spend`, clignotent) / gagnés (`gain`, se
 *  remplissent en clignotant) avant le commit du 2ᵉ clic. */
function Notches({ kind, value, max, vertical, title, spend = 0, gain = 0 }: { kind: string; value: number; max: number; vertical?: boolean; title: string; spend?: number; gain?: number }) {
  if (max <= 0) return null;
  const spendFrom = Math.max(0, value - spend); // [spendFrom, value) = crans dépensés (clignotent)
  const gainTo = Math.min(max, value + gain); // [value, gainTo) = crans gagnés (clignotent)
  return (
    <span className={`af-bar af-${kind} ${vertical ? 'af-v' : 'af-h'}`} title={title} aria-label={title}>
      {Array.from({ length: max }, (_, i) => {
        const cls = i < spendFrom ? 'on' : i < value ? 'on spend' : i < gainTo ? 'gain' : 'off';
        return <i key={i} className={cls} />;
      })}
    </span>
  );
}

/** Une ressource du tour NOMMÉE : libellé, valeur RÉELLE (jamais rabotée sur `max` — un Avantage
 *  au-dessus de son plafond effectif se lit tel quel), et l'aperçu du clic en « avant → après »
 *  quand celui-ci change quelque chose. Une ressource CONSOMMABLE (`spentLabel`) tombée à zéro le
 *  dit en TEXTE, jamais par la seule couleur. Un budget nul ne se rend PAS (même règle que la jauge
 *  crantée) : rien à lire, et rien n'a été consommé. L'« après » est du BORNAGE D'AFFICHAGE des
 *  mêmes props que les jauges — aucun calcul d'économie de plus. */
function Resource({ label, value, max, delta, unit, spentLabel }: { label: string; value: number; max: number; delta: number; unit?: string; spentLabel?: string }) {
  if (max <= 0) return null;
  const after = delta > 0 ? Math.max(value, Math.min(max, value + delta)) : Math.max(0, value + delta);
  const text = after !== value ? `${value} → ${after}` : `${value}/${max}`;
  const spent = spentLabel !== undefined && value <= 0;
  return (
    <>
      <dt className="mini-title">{label}</dt>
      <dd data-spent={spent ? 'true' : undefined}>
        <span>{unit ? `${text} ${unit}` : text}</span>
        {spent && <em>{spentLabel}</em>}
      </dd>
    </>
  );
}

/** Cadre du combattant ACTIF (barre d'action seulement) : Action verticale à gauche | portrait |
 *  Mouvement vertical à droite ; sous le portrait : Avantage (10 crans — plafond RAW optionnel
 *  LDB 14 l.198). Le portrait + sa VIE viennent de la tuile-portrait UNIFIÉE (PortraitTile),
 *  identique au dock et à la frise. Les mêmes valeurs se lisent en TEXTE dans le résumé
 *  « Ressources du tour », adossé aux mêmes props. Pur à props (testable en SSR). */
export function ActiveFrame({ c, ring, isHero, actAvail, actMax, moveLeft, moveMax, title, spendAction = 0, spendMove = 0, gainAdv = 0 }: {
  c: Combatant; ring: string; isHero: boolean;
  actAvail: number; actMax: number; moveLeft: number; moveMax: number; title?: string;
  /** Aperçu de clic (tap 1) : Action/Mouvement qui VONT être dépensés, Avantage qui VA être gagné. */
  spendAction?: number; spendMove?: number; gainAdv?: number;
}) {
  const advCap = advantageCapFor(c);
  return (
    <div className="aframe">
      {isHero && <Notches kind="action" vertical value={actAvail} max={actMax} spend={spendAction} title={`Action : ${actAvail}/${actMax}`} />}
      <div className="af-mid">
        <PortraitTile c={c} ring={ring} variant="vital" size="lg" team={isHero ? 'ally' : 'enemy'} title={title} />
        <Notches kind="adv" value={Math.min(c.advantage, advCap)} max={advCap} gain={gainAdv} title={`Avantage : ${c.advantage}/${advCap}`} />
      </div>
      {isHero && <Notches kind="move" vertical value={moveLeft} max={moveMax} spend={spendMove} title={`Mouvement : ${moveLeft}/${moveMax} case${moveMax > 1 ? 's' : ''}`} />}
      {/* États / buffs (TOUS) À DROITE de la jauge de Mouvement. */}
      <StateChips c={c} />
      <dl aria-label="Ressources du tour">
        {isHero && <Resource label="Action" value={actAvail} max={actMax} delta={-spendAction} spentLabel="utilisée" />}
        {isHero && <Resource label="Mouvement" value={moveLeft} max={moveMax} delta={-spendMove} unit={`case${moveMax > 1 ? 's' : ''}`} spentLabel="épuisé" />}
        <Resource label="Avantage" value={c.advantage} max={advCap} delta={gainAdv} />
      </dl>
    </div>
  );
}
