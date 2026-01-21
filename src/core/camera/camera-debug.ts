import type { FolderApi } from 'tweakpane';
import { DebugPanel } from '../devtools/debug-panel';
import type { Camera } from './camera';
import { shake } from './effects/shake';
import { punch } from './effects/punch';

export class CameraDebug {
  private debugFolder: FolderApi | null = null;
  // FIXME:
  // private boundsGraphics: Graphics | null = null;
  private isSyncingDebug = false; // Flag to prevent onChange during sync
  private debugState = {
    paused: false,
    showBounds: false,
    position: { x: 0, y: 0 },
    scale: 1,
    rotation: 0,
    trauma: 0,
    boundsMin: { x: 0, y: 0 },
    boundsMax: { x: 0, y: 0 },
    followLerp: 0.1,
    followDeadZone: 0,
  };

  constructor(private camera: Camera) {}

  // FIXME:
  private manualOverride = false;

  /**
   * Initialize debug panel for camera controls
   */
  public initDebugPanel(): void {
    if (!DebugPanel.pane) return;

    this.debugFolder = DebugPanel.folder({ title: 'Camera', expanded: true });
    if (!this.debugFolder) return;

    // Pause Follow toggle - when paused, can control camera manually
    this.debugFolder.addBinding(this.debugState, 'paused', { label: 'Pause Follow' }).on('change', (ev) => {
      if (this.isSyncingDebug) return;
      // FIXME:
      this.manualOverride = ev.value;
    });

    // Position as point2d (editable) - only responds to user input
    this.debugFolder
      .addBinding(this.camera, 'debugPosition', {
        label: 'Position',
        x: { min: -2000, max: 2000, step: 10 },
        y: { min: -2000, max: 2000, step: 10 },
      })
      .on('change', (ev) => {
        if (ev.last) return; // internal state update

        this.manualOverride = true;
        this.camera.setPosition(ev.value.x, ev.value.y);
      });

    this.debugFolder
      .addBinding(this.camera, 'debugOffset', {
        label: 'Offset',
        x: { min: -1000, max: 1000, step: 5 },
        y: { min: -1000, max: 1000, step: 5 },
      })
      .on('change', (ev) => {
        if (ev.last) return; // internal state update

        this.manualOverride = true;
        this.camera.setOffset(ev.value.x, ev.value.y);
      });

    // Scale and rotation as simple numbers
    this.debugFolder
      .addBinding(this.debugState, 'scale', { label: 'Scale', min: 0.25, max: 3, step: 0.05 })
      .on('change', (ev) => {
        if (ev.last) return; // internal state update

        this.manualOverride = true;
        this.camera.scale = ev.value;
      });

    this.debugFolder
      .addBinding(this.debugState, 'rotation', { label: 'Rotation°', min: -180, max: 180, step: 1 })
      .on('change', (ev) => {
        if (ev.last) return; // internal state update

        this.manualOverride = true;
        this.camera.rotation = (ev.value * Math.PI) / 180;
      });

    // Trauma (read-only)
    this.debugFolder.addBinding(this.debugState, 'trauma', {
      label: 'Trauma',
      readonly: true,
      format: (v) => v.toFixed(2),
    });

    /*
    FIXME:

    // Show bounds toggle
    this.debugFolder.addBinding(this.debugState, 'showBounds', { label: 'Show Bounds' }).on('change', (ev) => {
      if (ev.value) {
        this.showBoundsVisualization();
      } else {
        this.hideBoundsVisualization();
      }
    });

    // Bounds as point2d
    
    const boundsFolder = DebugPanel.folder({ title: 'Bounds', expanded: false, parent: this.debugFolder });
    if (boundsFolder) {
      boundsFolder.addBinding(this.debugState, 'boundsMin', {
        label: 'Min',
        x: { min: -1000, max: 1000, step: 10 },
        y: { min: -1000, max: 1000, step: 10 },
      }).on('change', (ev) => {
        this.followOptions.bounds.minX = ev.value.x;
        this.followOptions.bounds.minY = ev.value.y;
        this.updateBoundsVisualization();
      });

      boundsFolder.addBinding(this.debugState, 'boundsMax', {
        label: 'Max',
        x: { min: -1000, max: 2000, step: 10 },
        y: { min: -1000, max: 2000, step: 10 },
      }).on('change', (ev) => {
        this.followOptions.bounds.maxX = ev.value.x;
        this.followOptions.bounds.maxY = ev.value.y;
        this.updateBoundsVisualization();
      });
    }


    // Follow settings
    const followFolder = DebugPanel.folder({ title: 'Follow Settings', expanded: false, parent: this.debugFolder });
    if (followFolder) {
      followFolder.addBinding(this.debugState, 'followLerp', { label: 'Lerp', min: 0.01, max: 1, step: 0.01 }).on('change', (ev) => {
        this.followOptions.lerp = ev.value;
      });
      followFolder.addBinding(this.debugState, 'followDeadZone', { label: 'Dead Zone', min: 0, max: 100, step: 1 }).on('change', (ev) => {
        this.followOptions.deadZone = ev.value;
      });
    }



    */
    // Action buttons
    this.debugFolder.addButton({ title: 'Reset Camera' }).on('click', () => {
      this.camera.reset();
      this.syncDebugState();
    });
    this.debugFolder.addButton({ title: 'Shake' }).on('click', () => {
      shake(this.camera, { intensity: 10, duration: 400 });
    });
    this.debugFolder.addButton({ title: 'Punch' }).on('click', () => {
      punch(this.camera, 10, 200);
    });
    /*
    this.debugFolder.addButton({ title: 'Add Trauma' }).on('click', () => {
      this.addTrauma(0.4);
    });
    */

    // Sync initial values
    this.isSyncingDebug = true;
    this.syncDebugState();
    this.isSyncingDebug = false;
  }

  /**
   * Sync debug panel state with camera state (call periodically or on change)
   * Note: Caller must set isSyncingDebug = true before calling, and call refresh() after
   */
  private syncDebugState(): void {
    this.debugState.paused = this.manualOverride;
    this.debugState.position.x = this.camera.x;
    this.debugState.position.y = this.camera.y;
    this.debugState.scale = this.camera.scale;
    this.debugState.rotation = (this.camera.rotation * 180) / Math.PI; // Convert to degrees for display

    // FIXME:
    // this.debugState.trauma = this.camera.trauma;

    // Sync bounds (handle Infinity)
    /*
    FIXME:
    const bounds = this.followOptions.bounds;
    this.debugState.boundsMin.x = isFinite(bounds.minX) ? bounds.minX : -500;
    this.debugState.boundsMin.y = isFinite(bounds.minY) ? bounds.minY : -500;
    this.debugState.boundsMax.x = isFinite(bounds.maxX) ? bounds.maxX : 500;
    this.debugState.boundsMax.y = isFinite(bounds.maxY) ? bounds.maxY : 500;

    this.debugState.followLerp = this.followOptions.lerp;
    this.debugState.followDeadZone = this.followOptions.deadZone;
    */
  }

  /**
   * Show bounds visualization overlay on the debug layer
   * Bounds are drawn in WORLD coordinates as a rectangle showing where the camera CAN look
   * 
   FIXME:
  private showBoundsVisualization(): void {
    if (this.boundsGraphics) return;

    this.boundsGraphics = new Graphics();
    this.layers.debug.addChild(this.boundsGraphics);
    this.updateBoundsVisualization();
  }
   */

  /**
   * Hide bounds visualization
   * 
   FIXME:
  private hideBoundsVisualization(): void {
    if (this.boundsGraphics) {
      this.boundsGraphics.destroy();
      this.boundsGraphics = null;
    }
  }
*/

  /**
   * Update bounds visualization graphics
   * Draws the allowed camera viewing area in world coordinates

  FIXME:
  private updateBoundsVisualization(): void {
    if (!this.boundsGraphics) return;

    const g = this.boundsGraphics;
    g.clear();

    const bounds = this.followOptions.bounds;
    const minX = isFinite(bounds.minX) ? bounds.minX : -500;
    const maxX = isFinite(bounds.maxX) ? bounds.maxX : 500;
    const minY = isFinite(bounds.minY) ? bounds.minY : -500;
    const maxY = isFinite(bounds.maxY) ? bounds.maxY : 500;

    // The bounds define WHERE THE CAMERA CAN LOOK (world coordinates)
    // So we draw a rectangle at those world coordinates
    const width = maxX - minX;
    const height = maxY - minY;

    // Bounds area in WORLD coordinates (semi-transparent fill)
    g.rect(minX, minY, width, height);
    g.fill({ color: 0x00ff00, alpha: 0.15 });
    g.stroke({ color: 0x00ff00, width: 2, alpha: 0.8 });

    // Bounds center crosshair
    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;
    g.moveTo(cx - 15, cy);
    g.lineTo(cx + 15, cy);
    g.moveTo(cx, cy - 15);
    g.lineTo(cx, cy + 15);
    g.stroke({ color: 0x00ff00, width: 1, alpha: 0.5 });

    // World origin marker (0,0)
    g.circle(0, 0, 8);
    g.stroke({ color: 0xffff00, width: 2 });
    g.moveTo(-12, 0);
    g.lineTo(12, 0);
    g.moveTo(0, -12);
    g.lineTo(0, 12);
    g.stroke({ color: 0xffff00, width: 1 });

    // Current camera target position (where camera is looking)
    g.circle(this.state.x, this.state.y, 6);
    g.fill({ color: 0xff0000, alpha: 0.9 });

    // Viewport rectangle (what the camera sees)
    const halfW = (this.viewport.width / 2) / this.state.scale;
    const halfH = (this.viewport.height / 2) / this.state.scale;
    g.rect(this.state.x - halfW, this.state.y - halfH, halfW * 2, halfH * 2);
    g.stroke({ color: 0xff6600, width: 2, alpha: 0.8 });
  }
   */

  /**
   * Update debug panel values (call in your update loop if you want live updates)
   */
  public updateDebug(): void {
    if (!this.debugFolder) return;

    this.isSyncingDebug = true;
    this.syncDebugState();
    this.debugFolder.refresh();
    this.isSyncingDebug = false;

    // FIXME:
    // this.updateBoundsVisualization();
  }

  /**
   * Clean up debug panel
   */
  public disposeDebugPanel(): void {
    /*
   FIXME:
   this.hideBoundsVisualization();
   */
    if (this.debugFolder) {
      this.debugFolder.dispose();
      this.debugFolder = null;
    }
  }
}
