import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MountedToken } from './MountedToken';
import { MISSING_TONE } from './rig/viewArt';
import type { Combatant } from '../engine/types';

/**
 * CÂBLAGE du couple monté (#1128 L4) : la monture est rendue PORTÉE — ses opts de gabarit passent par
 * `mountedPlanOpts`, donc son harnachement vient du canal DONNÉE. Mesuré sur le markup RENDU du
 * composant, pas sur la fonction seule : un call-site retombé sur `planOptsForRecord` rendrait la bête
 * à cru sans qu'aucun test de la couture ne bronche.
 *
 * Le témoin est le REFUS VISIBLE (#223) d'un set non cuit pour l'espèce portée (blaireau, ADE I 07
 * l.48) : sa caisse d'alarme est posée sur le `tronc` en clé NUE, donc lisible dans les 3 vues — la
 * seule empreinte du canal observable ici, le markup SSR se rendant de face (l'orientation monde vit
 * dans le store, que le rendu serveur lit à son état INITIAL).
 */
const bete = (over: Partial<Combatant> = {}) => ({
  id: 'm1', label: 'Blaireau', kind: 'enemy', creatureId: 'blaireau', species: 'blaireau',
  size: 'moyenne', conditions: [], wounds: { current: 10, max: 10 }, pos: { x: 1, y: 1 }, ...over,
} as unknown as Combatant);
const rider = {
  id: 'r1', label: 'Cavalier', kind: 'enemy', conditions: [], wounds: { current: 10, max: 10 }, pos: { x: 1, y: 1 },
  appearance: { species: 'Humain', sex: 'M', build: 0.5 },
} as unknown as Combatant;

const rendu = (mount: Combatant) => renderToStaticMarkup(<svg><MountedToken mount={mount} rider={rider} /></svg>);

describe('MountedToken — la monture portée reçoit le set par la DONNÉE', () => {
  afterEach(() => vi.restoreAllMocks());

  it('le set par défaut atteint le gabarit de la monture ; le nu explicite d\'instance le retire', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(rendu(bete()), 'le set n\'atteint pas le rendu monté : la bête porterait le cavalier À CRU').toContain(MISSING_TONE);
    expect(rendu(bete({ appearanceOverride: { harnais: '' } })), 'nu explicite d\'instance').not.toContain(MISSING_TONE);
  });

  // Le gabarit du couple se résout par l'ID STABLE du bestiaire, le `label` n'étant qu'un repli de
  // statbloc d'auteur : une monture nommée librement doit rester un QUADRUPÈDE. Empreinte mesurée :
  // l'os `tronc` (barillet quad) — le gabarit bipède du repli rend `torse` et n'a aucun `tronc`.
  it('le gabarit de la monture vient du `creatureId`, jamais du label libre', () => {
    const roussine = bete({ label: 'Roussine du sergent', creatureId: 'cheval', species: undefined });
    const markup = rendu(roussine);
    expect(markup, 'label libre suivi : la monture est rendue avec le gabarit de repli, pas son quadrupède').toContain('data-bone="tronc"');
  });
});
