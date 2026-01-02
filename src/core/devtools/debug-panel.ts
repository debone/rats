import type { b2Vec2 } from 'phaser-box2d';
import { FolderApi, Pane } from 'tweakpane';

// Export FolderApi for external use
export { FolderApi };

export type DebugInputType =
  | { type: 'slider'; min?: number; max?: number; step?: number }
  | { type: 'vector2' | 'point2d'; min?: number; max?: number; step?: number }
  | { type: 'text' }
  | { type: 'color' }
  | { type: 'boolean' }
  | { type: 'button'; label: string; onClick: () => void }
  | {
      type: 'monitor';
      interval?: number;
      bufferSize?: number;
      graph?: boolean;
    };

export interface DebugOptions {
  label?: string;
  view?: DebugInputType;
  disabled?: boolean;
  hidden?: boolean;
  format?: (value: any) => string;
}

export interface FolderOptions {
  title: string;
  expanded?: boolean;
  parent?: FolderApi | null;
}

export const DebugParameters: any = {
  fps: 0,
  frameBudget: 0,
  jsxCounts: '',
  jsxTree: '',
};

export class DebugPanel {
  private static readonly EXPANDED_STATE_KEY = 'debug_panel_expanded';

  static pane: Pane | null = null;
  static tabApi: any;
  static jsxTab: any;
  static i = 0;
  static signalsFolder: FolderApi | null = null;

  static async initPane() {
    // Load expanded state from localStorage
    const savedExpanded = localStorage.getItem(this.EXPANDED_STATE_KEY)!!;
    const isExpanded = savedExpanded !== null ? savedExpanded : true;

    this.pane = new Pane({
      expanded: isExpanded === 'true',
      title: 'Debug',
    });

    // Listen for expanded state changes and save them
    this.pane.on('fold', (ev) => localStorage.setItem(this.EXPANDED_STATE_KEY, ev.expanded.toString()));
  }

  static async init() {
    if (!import.meta.env.DEV) return;

    // Initialize pane first
    await this.initPane();

    if (!DebugPanel.pane) return;

    DebugPanel.tabApi = DebugPanel.pane.addTab({
      pages: [{ title: 'General' }],
    });

    DebugParameters.fps = 0;
    DebugPanel.tabApi.pages[0].addBinding(DebugParameters, 'frameBudget', {
      readonly: true,
      format: (v: number) => v.toFixed(6),
    });

    DebugPanel.tabApi.pages[0].addBinding(DebugParameters, 'fps', {
      readonly: true,
      format: (v: number) => v.toFixed(0),
    });

    DebugPanel.tabApi.pages[0].addBinding(DebugParameters, 'fps', {
      label: '',
      readonly: true,
      view: 'graph',
      min: 55,
      max: 65,
    });

    DebugPanel.signalsFolder = DebugPanel.tabApi.pages[0].addFolder({
      title: 'Signals',
      expanded: true,
    });
  }

  static add(key: string) {
    if (!DebugPanel.pane) return;

    DebugPanel.pane.addBinding(DebugParameters, key, {
      readonly: true,
      format: (v: number) => v.toFixed(0),
    });
  }

  static addSlider(key: string, value: any, step: number = 0.01, min: number = 0, max: number = 1) {
    if (!DebugPanel.pane) return;
    DebugPanel.pane.addBinding(DebugParameters, key, {
      min: min,
      max: max,
      step: step,
    });

    DebugParameters[key] = value;
  }

  static update() {
    DebugPanel.i++;
    if (DebugPanel.i > 10) {
      DebugPanel.i = 0;
      // Only update FPS here
      DebugPanel.pane!.refresh();
    }
  }

  private static collapseAllFolders(folder: any) {
    folder.children.forEach((child: any) => {
      if (child.title === 'Controls') return;
      if (child.children) {
        child.expanded = false;
        this.collapseAllFolders(child);
      }
    });
  }

  static folder(options: FolderOptions): FolderApi | null {
    if (!DebugPanel.pane) return null;

    const parent = options.parent || DebugPanel.pane;
    return parent.addFolder({
      title: options.title,
      expanded: options.expanded ?? true,
    });
  }

  static debug<T>(target: any, key: string, value: T, options: DebugOptions = {}): T {
    if (!this.pane) return value;

    const { view, ...bindingOptions } = options;

    if (!view) {
      this.pane.addBinding(target, key, bindingOptions);
      return value;
    }

    switch (view.type) {
      case 'slider':
        target[key] = 0;
        this.pane.addBinding(target, key, {
          ...bindingOptions,
          min: view.min ?? 0,
          max: view.max ?? 1,
          step: view.step ?? 0.1,
        });
        break;

      case 'vector2':
      case 'point2d':
        target[key] = { x: 0, y: 0 };
        this.pane.addBinding(target, key, {
          ...bindingOptions,
          view: 'point2d',
          min: view.min ?? -1,
          max: view.max ?? 1,
          step: view.step ?? 0.01,
        });
        break;

      case 'text':
        target[key] = '';
        this.pane.addBinding(target, key, {
          ...bindingOptions,
          view: view.type,
        });
        break;

      case 'color':
        target[key] = { r: 0, g: 0, b: 0, a: 1 };
        this.pane.addBinding(target, key, {
          ...bindingOptions,
          view: view.type,
        });
        break;

      case 'boolean':
        target[key] = false;
        this.pane.addBinding(target, key, {
          ...bindingOptions,
          view: view.type,
        });
        break;

      case 'button':
        target[key] = null;
        this.pane
          .addButton({
            title: view.label,
            label: options.label,
          })
          .on('click', view.onClick);
        break;

      case 'monitor':
        target[key] = 0;
        this.pane.addBinding(target, key, {
          ...bindingOptions,
          readonly: true,
          interval: view.interval ?? 100,
          view: view.graph ? 'graph' : 'text',
        });
        break;

      default:
        target[key] = null;
        this.pane.addBinding(target, key, {
          ...bindingOptions,
        });
    }

    return value;
  }

  static debugVector2(target: any, key: string, value: b2Vec2, options: Partial<DebugOptions> = {}) {
    return this.debug(target, key, value, {
      ...options,
      view: { type: 'vector2' },
    });
  }

  static debugSlider(target: any, key: string, value: number, min = 0, max = 1, step = 0.1) {
    return this.debug(target, key, value, {
      view: { type: 'slider', min, max, step },
    });
  }

  static debugMonitor(target: any, key: string, graph = false) {
    return this.debug(target, key, target[key], {
      view: { type: 'monitor', graph },
    });
  }

  static debugButton(label: string, onClick: () => void) {
    return this.debug(null, '', null, {
      view: { type: 'button', label, onClick },
    });
  }
}
