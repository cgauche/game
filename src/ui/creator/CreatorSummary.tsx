/**
 * « Fiche vivante » du créateur — colonne persistante façon RPG vidéo (BG3/Pathfinder) :
 * figurine du personnage (primitive CharacterPreview : rig réel, tenue de carrière, ÉQUIPEMENT
 * porté dérivé du héros prévisualisé), Caractéristiques EN DIRECT (talents +5 et Augmentations
 * gratuites inclus via buildHero), attributs dérivés (Blessures, Mouvement, Destin/Chance,
 * Résilience/Détermination), PX bonus accumulés et bourse de départ.
 */
import { useMemo } from 'react';
import { Combatant } from '../../engine/types';
import { Coins } from '../Coins';
import type { Appearance } from '../../gameIso/rig/appearance';
import { CharacterPreview } from '../CharacterPreview';
import { Icon } from '../Icon';
import { CharStatsGrid } from '../CharStatsGrid';
import { SkillChip, TalentChip } from '../EntityChip';
import { findCareerById, rigSpeciesId } from '../../data';
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
  const careerLabel = findCareerById(d.careerId)?.label ?? d.careerId;
  // Repli si le brouillon ne construit pas encore un héros : apparence du brouillon, sans équipement.
  const appearance: Appearance = { species: rigSpeciesId(d.speciesId), sex: d.sex, build: d.build, seed: d.appSeed, colors: d.colors, parts: d.parts };
  const wealth = draftWealth(d);

  return (
    <aside className="creator-summary">
      {hero ? (
        <CharacterPreview hero={hero} size="fill" ambiance="panel" className="creator-fig" />
      ) : (
        <CharacterPreview appearance={appearance} career={careerLabel} size="fill" ambiance="panel" className="creator-fig" />
      )}
      <div className="creator-id">
        <strong>{d.name.trim() || 'Aventurier'}</strong>
        <span className="char-sub">{sp.label}</span>
        <span className="char-sub">
          {level ? `${level.label} (${careerLabel})` : careerLabel} · {level?.status ?? ''}
        </span>
      </div>

      <CharStatsGrid
        value={(k) => hero?.characteristics[k] ?? baseChars[k]}
        valClass={(k) => { const v = hero?.characteristics[k] ?? baseChars[k]; return hero != null && v > baseChars[k] ? 'boost' : ''; }}
        note={(k) => { const v = hero?.characteristics[k] ?? baseChars[k]; return hero != null && v > baseChars[k] ? `${baseChars[k]} + Augmentations/talents` : undefined; }}
      />

      <div className="creator-derived">
        <span>
          <Icon id="resource/wounds" size="sm" /> Blessures <b>{hero?.wounds.max ?? '—'}</b>
        </span>
        <span>
          <Icon id="resource/movement" size="sm" /> Mouvement <b>{hero?.movement ?? sp.movement}</b>
        </span>
        <span>
          <Icon id="resource/fate" size="sm" /> Destin <b>{hero?.fate ?? sp.fate.fate}</b> · Chance <b>{hero?.fortune ?? '—'}</b>
        </span>
        <span>
          <Icon id="resource/resilience" size="sm" /> Résilience <b>{hero?.resilience ?? sp.fate.resilience}</b> · Déterm. <b>{hero?.resolve ?? '—'}</b>
        </span>
        <span>
          <Icon id="resource/gold-purse" size="sm" /> Bourse <b><Coins money={wealth} /></b>
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
              <TalentChip key={`${t.talentId}|${t.spec ?? ''}`} talent={t} />
            ))}
          </div>
          <div className="mini-title">Compétences formées</div>
          <div className="skill-tags">
            {hero.skills
              .filter((s) => s.advances > 0)
              .slice(0, 14)
              .map((s) => (
                <SkillChip key={`${s.skillId}|${s.spec ?? ''}`} skill={s} />
              ))}
          </div>
        </div>
      )}
    </aside>
  );
}
