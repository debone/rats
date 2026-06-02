import type { Container } from 'pixi.js';

export interface DemoEntry {
  id: string;
  category: string;
  name: string;
  /** Render demo into container. Return cleanup to call before next demo. */
  setup(container: Container, w: number, h: number): () => void;
}
