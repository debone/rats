import type { System } from './System';
import type { Game } from '../core/Game';
import type { MetaGameState, RunState } from '@/data/game-state';
import { storage } from '@/core/storage/storage';
import { META_SAVE_KEY, RUN_SAVE_KEY } from '@/data/storage';

/**
 * SaveSystem handles saving and loading game state
 */
export class SaveSystem implements System {
  static SYSTEM_ID = 'save';

  game?: Game;

  private autoSaveInterval?: number;

  init() {
    console.log('[SaveSystem] Initializing...');

    // Auto-save every 30 seconds
    this.autoSaveInterval = window.setInterval(() => {
      this.autoSave();
    }, 30000);

    // Save on important events
    this.game!.context.events.on('level:complete', () => this.save());
    this.game!.context.events.on('boon:acquired', () => this.save());
  }

  /**
   * Save both meta state and current run
   */
  async save() {
    await Promise.all([this.saveMeta(), this.saveRun()]);
    console.log('[SaveSystem] Game saved');
  }

  /**
   * Save meta state
   */
  async saveMeta() {
    const { meta } = this.game!.context;
    await storage.set(META_SAVE_KEY, meta);
  }

  /**
   * Save current run state
   */
  async saveRun() {
    const { run } = this.game!.context;
    if (run) {
      await storage.set(RUN_SAVE_KEY, run);
    }
  }

  /**
   * Load meta state
   */
  async loadMeta(): Promise<MetaGameState> {
    return await storage.get(META_SAVE_KEY);
  }

  /**
   * Load run state
   */
  async loadRun(): Promise<RunState> {
    return await storage.get(RUN_SAVE_KEY);
  }

  /**
   * Clear saved run (e.g., after game over)
   */
  async clearRun() {
    await storage.remove(RUN_SAVE_KEY);
  }

  /**
   * Auto-save during gameplay
   */
  private async autoSave() {
    const { phase } = this.game!.context;

    // Only auto-save during level gameplay
    if (phase === 'level') {
      await this.save();
      console.log('[SaveSystem] Auto-saved');
    }
  }

  destroy() {
    if (this.autoSaveInterval) {
      clearInterval(this.autoSaveInterval);
    }
  }
}
