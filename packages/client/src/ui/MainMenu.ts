/**
 * Main menu screen: Single Player or Multiplayer.
 */
export class MainMenu {
  private readonly el: HTMLElement;

  onSinglePlayer: (() => void) | null = null;
  onMultiplayer: (() => void) | null = null;

  constructor() {
    this.el = document.getElementById('main-menu')!;

    document.getElementById('btn-singleplayer')!.addEventListener('click', () => {
      this.onSinglePlayer?.();
    });

    document.getElementById('btn-multiplayer')!.addEventListener('click', () => {
      this.onMultiplayer?.();
    });
  }

  show(): void {
    this.el.style.display = 'flex';
  }

  hide(): void {
    this.el.style.display = 'none';
  }
}
