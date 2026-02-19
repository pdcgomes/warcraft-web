import { Assets, Texture } from 'pixi.js';
import { getAllAssetPaths } from './AssetManifest.js';

/**
 * Preloads all game sprite textures via the PixiJS Assets API.
 * Provides getTexture() which returns null for missing assets
 * so renderers can fall back to Graphics primitives.
 */
export class AssetLoader {
  private textures = new Map<string, Texture>();
  private _loaded = false;

  get loaded(): boolean {
    return this._loaded;
  }

  async loadAll(): Promise<void> {
    const paths = getAllAssetPaths();

    for (const path of paths) {
      Assets.add({ alias: path, src: path });
    }

    const results = await Assets.load<Texture>(paths, (progress) => {
      console.log(`[AssetLoader] Loading assets: ${Math.round(progress * 100)}%`);
    });

    for (const path of paths) {
      const texture = results[path];
      if (texture && texture !== Texture.EMPTY) {
        this.textures.set(path, texture);
      } else {
        console.warn(`[AssetLoader] Failed to load: ${path}`);
      }
    }

    this._loaded = true;
    console.log(`[AssetLoader] Loaded ${this.textures.size}/${paths.length} textures`);
  }

  /** Returns the texture for a given asset path, or null if not loaded. */
  getTexture(path: string): Texture | null {
    return this.textures.get(path) ?? null;
  }
}
