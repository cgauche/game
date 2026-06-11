/**
 * Moteur audio minimal (Jalon 8 — arbitrage « assets libres CC0 », packs Kenney.nl dans
 * `public/audio/`). Lecture par `HTMLAudioElement` jetable (SFX courts, pas de pool nécessaire),
 * variante tirée au hasard par son (registre `defs/`), volume global + sourdine PERSISTANTS.
 * Les erreurs de lecture (politique d'autoplay avant la première interaction) sont silencieuses.
 */
import { SOUND_DEFS } from './_registry.generated';
import type { SoundDef } from './types';

const LS_KEY = 'wfrp4.audio.v1';
const byId = new Map<string, SoundDef>(SOUND_DEFS.map((d) => [d.id, d]));

interface AudioPrefs {
  volume: number; // 0..1
  muted: boolean;
}

function loadPrefs(): AudioPrefs {
  try {
    const raw = globalThis.localStorage?.getItem(LS_KEY);
    if (raw) {
      const p = JSON.parse(raw) as Partial<AudioPrefs>;
      return { volume: typeof p.volume === 'number' ? Math.min(1, Math.max(0, p.volume)) : 0.8, muted: !!p.muted };
    }
  } catch {
    // stockage indisponible → défauts
  }
  return { volume: 0.8, muted: false };
}

let prefs = loadPrefs();

function savePrefs(): void {
  try {
    globalThis.localStorage?.setItem(LS_KEY, JSON.stringify(prefs));
  } catch {
    // stockage indisponible : préférences de session seulement
  }
}

export const getVolume = (): number => prefs.volume;
export const isMuted = (): boolean => prefs.muted;
export function setVolume(v: number): void {
  prefs = { ...prefs, volume: Math.min(1, Math.max(0, v)) };
  savePrefs();
}
export function setMuted(m: boolean): void {
  prefs = { ...prefs, muted: m };
  savePrefs();
}

/** Joue un son du registre (variante au hasard). No-op : sourdine, id inconnu, hors navigateur. */
export function playSfx(id: string): void {
  if (prefs.muted || prefs.volume <= 0 || typeof Audio === 'undefined') return;
  const def = byId.get(id);
  if (!def || !def.files.length) return;
  const file = def.files[Math.floor(Math.random() * def.files.length)];
  const a = new Audio(`${import.meta.env.BASE_URL}audio/${file}`);
  a.volume = Math.min(1, prefs.volume * (def.volume ?? 1));
  void a.play().catch(() => {}); // autoplay refusé avant la 1ʳᵉ interaction : silencieux
}
