/**
 * « Fiche vivante » du créateur — colonne persistante façon RPG vidéo (BG3/Pathfinder) :
 * silhouette du personnage (rig SVG, tenue de carrière), Caractéristiques EN DIRECT (talents +5
 * et Augmentations gratuites inclus via buildHero), attributs dérivés (Blessures, Mouvement,
 * Destin/Chance, Résilience/Détermination), PX bonus accumulés et bourse de départ.
 */
import { useMemo } from 'react';
import { CHAR_KEYS, Combatant } from '../../engine/types';
import { formatMoney } from '../../engine/money';
import { RigSprite } from '../../gameIso/rig/composeRig';
import { DEFS } from '../../gameIso/sprites';
import type { Appearance } from '../../gameIso/rig/appearance';
import { skillInstanceLabel, talentConcrete } from '../../data';
import { CreatorDraft, buildHero, draftSpecies, draftLevel, draftWealth, draftChars, xpTotal, speciesXp, careerXp, charsXp, starXp, stepIds } from './draft';

export function previewHero(d: CreatorDraft): Combatant | null {
  try {
    return buildHero(d, 'preview');
  } catch {
    return null;
  }
}

export function CreatorSummary({ d, step }: { d: CreatorDraft; step: number }) {
  const hero = useMemo(() => previewHero(d), [d]);
  const sp = draftSpecies(d);
  const level = draftLevel(d);
  const baseChars = draftChars(d);
  const appearance: Appearance = { species: d.speciesLabel, sex: d.sex, build: d.build, seed: d.appSeed, colors: d.colors, parts: d.parts };
  const wealth = draftWealth(d);

  return (
    <aside className="creator-summary">
      <svg viewBox="0 0 120 150" className="creator-figure">
        <defs dangerouslySetInnerHTML={{ __html: DEFS }} />
        <rect x={0} y={0} width={120} height={150} fill="#1d2230" rx={8} />
        <RigSprite appearance={appearance} equip={{ weapons: hero?.weapons ?? [], armour: [] }} career={d.careerLabel} />
      </svg>
      <div className="creator-id">
        <strong>{d.name.trim() || 'Aventurier'}</strong>
        <span className="char-sub">{sp.label}</span>
        <span className="char-sub">
          {level ? `${level.label} (${d.careerLabel})` : d.careerLabel} · {level?.status ?? ''}
        </span>
      </div>

      <div className="char-stats">
        {CHAR_KEYS.map((k) => {
          const v = hero?.characteristics[k] ?? baseChars[k];
          const boosted = hero != null && v > baseChars[k];
          return (
            <div className="stat" key={k} title={boosted ? `${baseChars[k]} + Augmentations/talents` : undefined}>
              <span className="stat-label">{k}</span>
              <span className={`stat-val ${boosted ? 'boost' : ''}`}>{v}</span>
            </div>
          );
        })}
      </div>

      <div className="creator-derived">
        <span>
          ❤️ Blessures <b>{hero?.wounds.max ?? '—'}</b>
        </span>
        <span>
          👣 Mouvement <b>{hero?.movement ?? sp.movement}</b>
        </span>
        <span>
          ☄️ Destin <b>{hero?.fate ?? sp.fate.fate}</b> · Chance <b>{hero?.fortune ?? '—'}</b>
        </span>
        <span>
          🛡️ Résilience <b>{hero?.resilience ?? sp.fate.resilience}</b> · Déterm. <b>{hero?.resolve ?? '—'}</b>
        </span>
        <span>
          💰 Bourse <b>{formatMoney(wealth)}</b>
        </span>
      </div>

      <div className="creator-xp" title={`Espèce +${speciesXp(d)} · Carrière +${careerXp(d)} · Caractéristiques +${charsXp(d)}${stepIds().includes('star') ? ` · Signe +${starXp(d)}` : ''}`}>
        PX bonus de création : <b>+{xpTotal(d)}</b>
      </div>

      {hero && step >= 3 && (
        <div className="char-skills">
          <div className="mini-title">Talents</div>
          <div className="skill-tags">
            {hero.talents.map((t) => (
              <span className="tag talent" key={`${t.talentId}|${t.spec ?? ''}`}>
                {talentConcrete(t)}
                {t.times > 1 ? ` ×${t.times}` : ''}
              </span>
            ))}
          </div>
          <div className="mini-title">Compétences formées</div>
          <div className="skill-tags">
            {hero.skills
              .filter((s) => s.advances > 0)
              .slice(0, 14)
              .map((s) => (
                <span className="tag" key={`${s.skillId}|${s.spec ?? ''}`}>
                  {skillInstanceLabel(s)} +{s.advances}
                </span>
              ))}
          </div>
        </div>
      )}
    </aside>
  );
}
