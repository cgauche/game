/**
 * DEMANDE D'IMAGE PONCTUELLE (#1376) : un geste qui n'a besoin que d'être VU (la relève d'une texture
 * de billboard au franchissement d'un cran) demande UNE image, jamais un rendu. La panne en face est
 * mesurée : 63 boards reposés appelaient 63 rendus complets dans la même image (331 ms en
 * exploration).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  battreStageFrames,
  demanderFrames,
  demanderUneImage,
  relacherFrames,
  subscribeStageFrames,
} from './stageFrames';

/** Horloge et rAF PILOTÉS : la cadence du banc est la nôtre, jamais celle de la machine. */
let horloge = 0;
let enAttente: (() => void)[] = [];
/** Les POSES de rAF : une demande coalescée n'en pose qu'une, quel que soit le nombre d'appelants. */
let posesRaf = 0;

/** Sert les rAF posés — comme le navigateur au vsync suivant, une passe et une seule. */
function image(avanceMs = 20): void {
  horloge += avanceMs;
  const àServir = enAttente;
  enAttente = [];
  for (const cb of àServir) cb();
}

beforeEach(() => {
  enAttente = [];
  posesRaf = 0;
  horloge += 1000; // toute image précédente est loin : plus aucune cession de `MEME_IMAGE_MS`
  vi.spyOn(performance, 'now').mockImplementation(() => horloge);
  vi.stubGlobal('requestAnimationFrame', (cb: () => void) => {
    posesRaf++;
    enAttente.push(cb);
    return enAttente.length;
  });
  vi.stubGlobal('cancelAnimationFrame', () => undefined);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('stageFrames — demande d’image PONCTUELLE', () => {
  it('N demandes dans la même image ne valent qu’UN battement', () => {
    const battu = vi.fn();
    const désabonner = subscribeStageFrames(battu);
    for (let i = 0; i < 63; i++) demanderUneImage();
    expect(battu, 'la demande est différée au prochain rAF, jamais servie sur place').not.toHaveBeenCalled();
    // COALESCENCE au point où elle coûte : une seule pose de rAF pour les 63 appelants. Sans ce
    // compte, 63 poses passeraient la garde — les 62 rappels suivants cèdent sur `MEME_IMAGE_MS` et
    // le compte de battements ne dirait rien.
    expect(posesRaf, `${posesRaf} rAF posés pour 63 demandes`).toBe(1);

    image();

    expect(battu).toHaveBeenCalledTimes(1);
    désabonner();
  });

  it('une demande servie n’en garde aucune en réserve : l’image suivante ne bat pas', () => {
    const battu = vi.fn();
    const désabonner = subscribeStageFrames(battu);
    demanderUneImage();
    image();
    image();
    expect(battu).toHaveBeenCalledTimes(1);
    // …et une demande NEUVE bat de nouveau : la porte n'est pas restée fermée.
    demanderUneImage();
    image();
    expect(battu).toHaveBeenCalledTimes(2);
    désabonner();
  });

  it('sous une boucle CONTINUE, la demande ponctuelle n’ajoute aucun battement', () => {
    const battu = vi.fn();
    const désabonner = subscribeStageFrames(battu);
    const source = Symbol('banc');
    demanderFrames(source);
    for (let i = 0; i < 10; i++) demanderUneImage();

    image();

    expect(battu, 'la boucle continue sert déjà l’image : une seule passe').toHaveBeenCalledTimes(1);
    relacherFrames(source);
    désabonner();
  });

  it('elle CÈDE le pas à un battement qui vient d’avoir lieu (même image)', () => {
    const battu = vi.fn();
    const désabonner = subscribeStageFrames(battu);
    demanderUneImage();
    battreStageFrames(); // la marche, le pointeur… quelqu'un d'autre a déjà peint cette image
    expect(battu).toHaveBeenCalledTimes(1);

    image(1); // moins de `MEME_IMAGE_MS` : c'est la MÊME image

    expect(battu).toHaveBeenCalledTimes(1);
    désabonner();
  });
});
