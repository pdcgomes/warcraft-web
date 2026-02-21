import type { FactionId, MapSize } from '@warcraft-web/shared';
import type { AssetLoader } from '../assets/AssetLoader.js';

const FACTION_IMAGES: Record<FactionId, string> = {
  humans: 'assets/units/footman.png',
  orcs:   'assets/units/grunt.png',
};

/**
 * Faction selection screen shown before starting a single-player game.
 * Uses chroma-keyed textures from the AssetLoader for the button images.
 * Also lets the player pick a map size from a dropdown.
 */
export class FactionSelect {
  private readonly el: HTMLElement;
  private readonly mapSizeSelect: HTMLSelectElement;

  onSelect: ((faction: FactionId, mapSize: MapSize) => void) | null = null;
  onBack: (() => void) | null = null;

  constructor(assetLoader: AssetLoader) {
    this.el = document.getElementById('faction-select')!;
    this.mapSizeSelect = document.getElementById('map-size-select') as HTMLSelectElement;

    for (const faction of ['humans', 'orcs'] as FactionId[]) {
      const img = document.getElementById(`img-faction-${faction}`) as HTMLImageElement;
      const dataUrl = assetLoader.toDataUrl(FACTION_IMAGES[faction], 160);
      if (dataUrl) img.src = dataUrl;
    }

    document.getElementById('btn-faction-humans')!.addEventListener('click', () => {
      this.onSelect?.('humans', this.getMapSize());
    });

    document.getElementById('btn-faction-orcs')!.addEventListener('click', () => {
      this.onSelect?.('orcs', this.getMapSize());
    });

    document.getElementById('btn-faction-back')!.addEventListener('click', (e) => {
      e.preventDefault();
      this.onBack?.();
    });
  }

  getMapSize(): MapSize {
    return this.mapSizeSelect.value as MapSize;
  }

  show(): void {
    this.el.style.display = 'flex';
  }

  hide(): void {
    this.el.style.display = 'none';
  }
}
