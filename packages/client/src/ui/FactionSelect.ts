import type { FactionId } from '@warcraft-web/shared';
import type { AssetLoader } from '../assets/AssetLoader.js';

const FACTION_IMAGES: Record<FactionId, string> = {
  humans: 'assets/units/footman.png',
  orcs:   'assets/units/grunt.png',
};

/**
 * Faction selection screen shown before starting a single-player game.
 * Uses chroma-keyed textures from the AssetLoader for the button images.
 */
export class FactionSelect {
  private readonly el: HTMLElement;

  onSelect: ((faction: FactionId) => void) | null = null;
  onBack: (() => void) | null = null;

  constructor(assetLoader: AssetLoader) {
    this.el = document.getElementById('faction-select')!;

    for (const faction of ['humans', 'orcs'] as FactionId[]) {
      const img = document.getElementById(`img-faction-${faction}`) as HTMLImageElement;
      const dataUrl = assetLoader.toDataUrl(FACTION_IMAGES[faction], 160);
      if (dataUrl) img.src = dataUrl;
    }

    document.getElementById('btn-faction-humans')!.addEventListener('click', () => {
      this.onSelect?.('humans');
    });

    document.getElementById('btn-faction-orcs')!.addEventListener('click', () => {
      this.onSelect?.('orcs');
    });

    document.getElementById('btn-faction-back')!.addEventListener('click', (e) => {
      e.preventDefault();
      this.onBack?.();
    });
  }

  show(): void {
    this.el.style.display = 'flex';
  }

  hide(): void {
    this.el.style.display = 'none';
  }
}
