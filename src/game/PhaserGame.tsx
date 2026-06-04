import { useEffect, useRef } from 'react';
import Phaser from 'phaser';
import { WorldScene } from './WorldScene';
import { useGame } from '../state/store';
import { TILE } from './palette';

/** Monte le moteur Phaser et l'ajuste à la taille de la scène courante. */
export function PhaserGame() {
  const ref = useRef<HTMLDivElement>(null);
  const gameRef = useRef<Phaser.Game | null>(null);
  const scene = useGame((s) => s.scene);

  useEffect(() => {
    if (!ref.current || gameRef.current) return;
    const w = scene ? scene.dimensions.w * TILE + 16 : 720;
    const h = scene ? scene.dimensions.h * TILE + 16 : 540;
    gameRef.current = new Phaser.Game({
      type: Phaser.AUTO,
      width: w,
      height: h,
      parent: ref.current,
      backgroundColor: '#141019',
      scene: [WorldScene],
      pixelArt: false,
      scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_HORIZONTALLY },
    });
    return () => {
      gameRef.current?.destroy(true);
      gameRef.current = null;
    };
  }, []);

  // Adapter la taille du canvas quand on change de scène.
  useEffect(() => {
    if (gameRef.current && scene) {
      gameRef.current.scale.resize(scene.dimensions.w * TILE + 16, scene.dimensions.h * TILE + 16);
    }
  }, [scene?.id]);

  return <div className="phaser-host" ref={ref} />;
}
