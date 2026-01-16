/**
 * Save System
 *
 * Handles saving and loading game state.
 * This is a core system that is always active.
 */

import type { System } from '@/core/game/System';
import { storage } from '@/core/storage/storage';
import { GameEvent } from '@/data/events';
import type { GameContext } from '@/data/game-context';
import { getMetaState, getRunState, type MetaGameState, type RunState } from '@/data/game-state';
import { META_SAVE_KEY, RUN_SAVE_KEY } from '@/data/storage';

export class SaveSystem implements System {
  static SYSTEM_ID = 'save';

  private context!: GameContext;
  private autoSaveInterval?: number;

  init(context: GameContext) {
    this.context = context;
    console.log('[SaveSystem] Initializing...');

    // Auto-save every 30 seconds
    this.autoSaveInterval = window.setInterval(() => {
      this.autoSave();
    }, 30000);

    // Save on important events (notifications)
    context.events.on(GameEvent.LEVEL_WON, () => this.save());
    context.events.on(GameEvent.BOON_ACQUIRED, () => this.save());
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
    const meta = getMetaState();
    await storage.set(META_SAVE_KEY, meta);
  }

  /**
   * Save current run state
   */
  async saveRun() {
    const run = getRunState();
    await storage.set(RUN_SAVE_KEY, run);
  }

  /**
   * Load meta state
   */
  async loadMeta(): Promise<MetaGameState | null> {
    return (await storage.get(META_SAVE_KEY)) as MetaGameState;
  }

  /**
   * Load run state
   */
  async loadRun(): Promise<RunState | null> {
    return (await storage.get(RUN_SAVE_KEY)) as RunState;
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
    const { phase } = this.context;

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
