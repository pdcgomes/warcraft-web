import { Assets, Texture } from 'pixi.js';
import { getAllAssetPaths } from './AssetManifest.js';

export type LoadProgressCallback = (progress: number) => void;

/**
 * Preloads all game sprite textures via the PixiJS Assets API.
 * Applies magenta chroma-key removal to non-terrain assets.
 * Provides getTexture() which returns null for missing assets
 * so renderers can fall back to Graphics primitives.
 */
export class AssetLoader {
  private textures = new Map<string, Texture>();
  private _loaded = false;

  get loaded(): boolean {
    return this._loaded;
  }

  async loadAll(onProgress?: LoadProgressCallback): Promise<void> {
    const paths = getAllAssetPaths();
    const total = paths.length;

    for (const path of paths) {
      Assets.add({ alias: path, src: path });
    }

    // Phase 1: network fetch (0% – 50%)
    const results = await Assets.load<Texture>(paths, (p) => {
      onProgress?.(p * 0.5);
    });

    const rawTextures: { path: string; texture: Texture }[] = [];
    for (const path of paths) {
      const texture = results[path];
      if (texture && texture !== Texture.EMPTY) {
        rawTextures.push({ path, texture });
      } else {
        console.warn(`[AssetLoader] Failed to load: ${path}`);
      }
    }

    // Phase 2: chroma-key processing (50% – 100%)
    const processCount = rawTextures.length;
    for (let i = 0; i < processCount; i++) {
      const { path, texture } = rawTextures[i];

      if (this.needsChromaKey(path)) {
        this.textures.set(path, this.chromaKey(texture));
      } else {
        this.textures.set(path, texture);
      }

      onProgress?.(0.5 + ((i + 1) / processCount) * 0.5);

      // Yield to the browser every 8 textures so the UI can repaint
      if ((i + 1) % 8 === 0) {
        await new Promise<void>((r) => setTimeout(r, 0));
      }
    }

    this._loaded = true;
    console.log(`[AssetLoader] Loaded ${this.textures.size}/${total} textures`);
  }

  /** Returns the texture for a given asset path, or null if not loaded. */
  getTexture(path: string): Texture | null {
    return this.textures.get(path) ?? null;
  }

  /**
   * Renders a loaded (chroma-keyed) texture to a data URL at the given size.
   * Useful for populating DOM `<img>` elements with processed sprites.
   */
  toDataUrl(path: string, size: number = 80): string | null {
    const texture = this.textures.get(path);
    if (!texture) return null;

    const source = texture.source.resource as HTMLCanvasElement | HTMLImageElement;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d')!;

    const sw = source instanceof HTMLCanvasElement ? source.width : source.naturalWidth;
    const sh = source instanceof HTMLCanvasElement ? source.height : source.naturalHeight;
    const scale = Math.min(size / sw, size / sh);
    const dw = Math.round(sw * scale);
    const dh = Math.round(sh * scale);
    const dx = Math.round((size - dw) / 2);
    const dy = Math.round((size - dh) / 2);

    ctx.drawImage(source, 0, 0, sw, sh, dx, dy, dw, dh);
    return canvas.toDataURL();
  }

  private needsChromaKey(path: string): boolean {
    return !path.startsWith('assets/terrain/');
  }

  /**
   * Strips magenta (#FF00FF) background from a texture.
   * Pure magenta pixels are made fully transparent. Semi-magenta fringe
   * pixels (from anti-aliasing) are faded proportionally so no pink halo
   * remains around the sprite.
   */
  private chromaKey(source: Texture): Texture {
    const { width, height } = source.source;
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d')!;

    const img = source.source.resource as HTMLImageElement;
    ctx.drawImage(img, 0, 0, width, height);

    const imageData = ctx.getImageData(0, 0, width, height);
    const data = imageData.data;

    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];

      // How "magenta" is this pixel? Magenta = high R, low G, high B.
      // Compute a 0-1 score where 1 = pure magenta.
      const rScore = r / 255;
      const gScore = 1 - g / 255;
      const bScore = b / 255;
      const magenta = rScore * gScore * bScore;

      if (magenta > 0.6) {
        // Strong magenta — fully transparent
        data[i + 3] = 0;
      } else if (magenta > 0.3) {
        // Fringe — fade alpha proportionally
        const fade = (magenta - 0.3) / 0.3;
        data[i + 3] = Math.round(data[i + 3] * (1 - fade));
      }
    }

    ctx.putImageData(imageData, 0, 0);
    return Texture.from(canvas);
  }
}
