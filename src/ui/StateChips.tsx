import { summarizeEffects, combatantFlags, chipCodex, type EffectChip } from '../gameIso/effectIcons';
import type { Combatant } from '../engine/types';
import { CodexRef } from './compendium/CodexRef';
import { Icon } from './Icon';

/**
 * Pastilles d'États / effets actifs d'un combattant (la colonne `.ptile-states`) — EXTRAITE de
 * PortraitTile pour être posable hors de la tuile : dans le cadre actif (ActiveFrame) elles vivent
 * À DROITE de la barre de Mouvement (et non plus en débordement DERRIÈRE elle, retour 2026-06-11 :
 * le buff +10 CC d'une Bénédiction passait sous la jauge). `max` = pastilles avant le « ▾ » de débord.
 * Pure (testable en SSR).
 *
 * Elles informent par le MÊME mécanisme que `EffectChips` : `CodexRef` (routage `chipCodex`), jamais
 * une infobulle native — et une pastille sans règle résolue reste nue (aucun popover de consolation,
 * arbitrage user 2026-07-18).
 *
 * Chaque pastille porte SON CHIFFRE quand elle en a un (`EffectChip.indice` : pions de l'État, DR de
 * Focalisation, Indice de Peur) — l'icône seule ne disait pas « combien ».
 *
 * `reserve` : rack d'alvéoles RÉSERVÉES — `max` cellules TOUJOURS DESSINÉES, les vides comprises
 * (arbitrage user 2026-07-11 « empreinte stable », rappel 2026-08-17 verbatim : « une zone pour
 * mettre les états icônes et leur indice »). Un État de plus ne redimensionne donc aucune carte, et
 * une liste de rangées-personnages garde ses colonnes alignées. Sans `reserve`, rien n'est rendu
 * quand il n'y a aucun effet (défaut HUD).
 *
 * `extra` : pastilles d'ÉTAT que le Combatant ne porte pas lui-même — elles dépendent de la SITUATION
 * de combat (`battle`) et non de `conditions`/`activeEffects` : Assailli ×N, Cloué, Renfort de pièce.
 * Elles entrent dans le MÊME rack, après les effets portés — une seule niche d'États, jamais deux.
 */
export function StateChips({ c, max = 4, reserve = false, extra }: { c: Combatant; max?: number; reserve?: boolean; extra?: EffectChip[] }) {
  const all = [...summarizeEffects(c.conditions, c.activeEffects, Infinity, combatantFlags(c)).visible, ...(extra ?? [])];
  // En rack réservé, le débord occupe la DERNIÈRE alvéole : le compte de cellules dessinées ne bouge
  // pas d'un cran, quel que soit le nombre d'États portés.
  const room = reserve && all.length > max ? max - 1 : max;
  const shown = all.slice(0, room);
  const more = all.slice(room);
  if (!reserve && shown.length === 0 && more.length === 0) return null;
  const vides = reserve ? Math.max(0, max - shown.length - (more.length > 0 ? 1 : 0)) : 0;
  return (
    <span className="ptile-states" data-reserve={reserve ? '' : undefined}>
      {shown.map((v) => {
        const ref = chipCodex(v);
        const inner = (
          <>
            <Icon id={v.icon} size="sm" />
            {v.indice != null && <b className="pt-n">{v.indice}</b>}
          </>
        );
        if (!ref) return <span key={v.key} className="pt-state">{inner}</span>;
        return (
          <CodexRef
            key={v.key}
            category={ref.category}
            id={ref.id}
            label={ref.label}
            instance={ref.instance}
            className="pt-state"
          >
            {inner}
          </CodexRef>
        );
      })}
      {more.length > 0 && (
        <CodexRef
          category="etats"
          label={`${more.length} effet${more.length > 1 ? 's' : ''} de plus`}
          fallback={{ body: more.map((m) => m.label).join(' · ') }}
          className="pt-state ptile-more"
        >
          ▾
        </CodexRef>
      )}
      {Array.from({ length: vides }, (_, i) => (
        <span key={`vide-${i}`} className="pt-void" aria-hidden="true" />
      ))}
    </span>
  );
}
