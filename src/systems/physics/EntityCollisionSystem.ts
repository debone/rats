import type { System } from '@/core/game/System';
import type { b2BodyId } from 'phaser-box2d';

export interface EntityCollisionConfig {
  tag: string;
  handlers: Record<string, (self: any, other: any) => void>;
  entity: any;
}

export class EntityCollisionSystem implements System {
  static SYSTEM_ID = 'entity-collision';

  private registry = new Map<number, EntityCollisionConfig>();

  add(bodyId: b2BodyId, config: EntityCollisionConfig): void {
    this.registry.set(bodyId.index1, config);
  }

  remove(bodyId: b2BodyId): void {
    this.registry.delete(bodyId.index1);
  }

  get(bodyId: b2BodyId): EntityCollisionConfig | undefined {
    return this.registry.get(bodyId.index1);
  }

  clear(): void {
    this.registry.clear();
  }

  destroy(): void {
    this.registry.clear();
  }
}
