/**
 * FX de combat pilotés par le bus (extraits d'IsoStage pour le garder navigable) :
 * flottants typés, projectiles volants, halos d'incantation, flashes de zone d'effet.
 * Chaque système = un état local + un abonnement bus à durée de vie bornée (setTimeout).
 * Le RENDU vit dans `FxLayer.tsx` ; la marche animée dans `useWalkAnim.ts`.
 */
import { useEffect, useRef, useState } from 'react';
import { useGame } from '../../state/store';
import { bus, EVT } from '../../state/bus';
import { isSupportiveCast, spellFxForLabel } from '../rig/anim/spellClips';

/** Couleur du flash de zone d'effet selon l'élément (feu/froid/poison/foudre), défaut rouge. */
const aoeColor = (type?: string): string => {
  const t = (type ?? '').toLowerCase();
  if (/feu/.test(t)) return '#ff7a3c';
  if (/froid|glace/.test(t)) return '#7fd0ff';
  if (/poison|corros/.test(t)) return '#8fce5a';
  if (/électric|electric|foudre/.test(t)) return '#ffe066';
  return '#ff5a4d';
};

// Flottants TYPÉS (R8) — chaque échange se lit d'un coup d'œil : touche/raté/parade/soin/mort, pas
// seulement les Blessures. Déclenchés sur ANIM_IMPACT (timing du clip) + canal ANIM_FLOAT (soin/État).
export type FloatKind = 'damage' | 'soak' | 'miss' | 'defend' | 'death' | 'heal' | 'condition';
export type Float = { key: number; x: number; y: number; text: string; kind: FloatKind; crit?: boolean };
export const FLOAT_COLOR: Record<FloatKind, string> = {
  damage: '#ff5a5a', soak: '#b8b8c0', miss: '#b8b8c0', defend: '#6fb6ff', death: '#ff3030', heal: '#6fce8e', condition: '#e0b050',
};

// Projectiles volants (distance + sort-missile) : vol from→to synchronisé à l'impact.
// `gradient` = tintage à l'école pour un sort (cf. spellFxForLabel) ; absent pour une flèche.
export type Proj = { key: number; from: { x: number; y: number }; to: { x: number; y: number }; kind: string; gradient?: string };

// Halos d'incantation, tintés à l'école (arcane/divin). Deux usages :
//  - `channel` : canalisation sur le LANCEUR (toute incantation, brève pulsation serrée) ;
//  - sinon (bloom) : bénédiction/miracle reçu sur la CIBLE (expansion soutenue).
export type Aura = { key: number; x: number; y: number; gradient: string; core: string; channel?: boolean };

// Flash de zone d'effet (R7) : on peint les cases touchées ~1,1 s à la résolution (souffle/cri/sort de
// zone), ennemi comme joueur → on voit l'empreinte et pourquoi plusieurs combattants sont affectés.
export type AoeFlash = { key: number; tiles: { x: number; y: number }[]; color: string };

export function useCombatFx() {
  const [floats, setFloats] = useState<Float[]>([]);
  const floatId = useRef(0);
  useEffect(() => {
    const push = (x: number, y: number, text: string, kind: FloatKind, crit = false) => {
      const key = ++floatId.current;
      setFloats((f) => [...f, { key, x, y, text, kind, crit }]);
      setTimeout(() => setFloats((f) => f.filter((z) => z.key !== key)), kind === 'death' ? 1300 : 900);
    };
    const offImpact = bus.on(EVT.ANIM_IMPACT, (d: any) => {
      const b = useGame.getState().battle;
      const r = d?.result;
      if (!b || !r) return;
      const target = b.combatants.find((c) => c.id === d.to);
      if (!target?.pos) return;
      const { x, y } = target.pos;
      if (r.hit) {
        if (r.woundsLost > 0) push(x, y, `-${r.woundsLost}`, 'damage', !!r.critical);
        else push(x, y, 'Encaissé', 'soak');
        if (r.defenderDefeated) push(x, y, '✦ hors de combat', 'death');
      } else if (r.defenderDetail) {
        push(x, y, 'Paré / Esquivé', 'defend');
      } else {
        push(x, y, 'Raté', 'miss');
      }
    });
    const offFloat = bus.on(EVT.ANIM_FLOAT, (d: any) => {
      const b = useGame.getState().battle;
      const pos = b?.combatants.find((c) => c.id === d?.to)?.pos ?? d?.pos;
      if (!pos || !d?.text) return;
      push(pos.x, pos.y, d.text, (d.kind as FloatKind) ?? 'condition');
    });
    return () => { offImpact(); offFloat(); };
  }, []);

  const [projs, setProjs] = useState<Proj[]>([]);
  const projId = useRef(0);
  const [auras, setAuras] = useState<Aura[]>([]);
  const auraId = useRef(0);
  const [aoes, setAoes] = useState<AoeFlash[]>([]);
  const aoeId = useRef(0);
  useEffect(() => {
    const off = bus.on(EVT.ANIM_AOE, (d: { tiles?: { x: number; y: number }[]; type?: string }) => {
      if (!d?.tiles?.length) return;
      const key = ++aoeId.current;
      setAoes((a) => [...a, { key, tiles: d.tiles!, color: aoeColor(d.type) }]);
      setTimeout(() => setAoes((a) => a.filter((x) => x.key !== key)), 1150);
    });
    return off;
  }, []);
  useEffect(() => {
    const off = bus.on(EVT.ANIM_ATTACK, (d: any) => {
      if (d.kind !== 'ranged' && d.kind !== 'spell') return;
      const b = useGame.getState().battle;
      const from = b?.combatants.find((c) => c.id === d.from)?.pos;
      const to = b?.combatants.find((c) => c.id === d.to)?.pos;
      if (!from || !to) return;
      if (d.kind === 'spell') {
        const fx = spellFxForLabel(d.spell);
        // Canalisation à l'école sur le lanceur (toute incantation : offensive ou soutien).
        const ck = ++auraId.current;
        setAuras((a) => [...a, { key: ck, x: from.x, y: from.y, gradient: fx.gradient, core: fx.core, channel: true }]);
        setTimeout(() => setAuras((a) => a.filter((x) => x.key !== ck)), 480);
        const caster = b?.combatants.find((c) => c.id === d.from);
        const tgt = b?.combatants.find((c) => c.id === d.to);
        if (isSupportiveCast(caster?.kind, tgt?.kind, d.from === d.to)) {
          const key = ++auraId.current; // soutien : halo sur la cible, pas de projectile
          setAuras((a) => [...a, { key, x: to.x, y: to.y, gradient: fx.gradient, core: fx.core }]);
          setTimeout(() => setAuras((a) => a.filter((x) => x.key !== key)), 620);
          return;
        }
        const key = ++projId.current; // offensif : projectile magique tinté
        setProjs((p) => [...p, { key, from, to, kind: d.kind, gradient: fx.gradient }]);
        setTimeout(() => setProjs((p) => p.filter((x) => x.key !== key)), 340);
        return;
      }
      const key = ++projId.current;
      setProjs((p) => [...p, { key, from, to, kind: d.kind }]);
      setTimeout(() => setProjs((p) => p.filter((x) => x.key !== key)), 340);
    });
    return off;
  }, []);

  return { floats, projs, auras, aoes };
}
