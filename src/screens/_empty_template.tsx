import type { AppScreen } from '@/core/window/types';
import { Container } from 'pixi.js';

export class HomeScreen extends Container implements AppScreen {
  static readonly SCREEN_ID = 'home-screen';
  static readonly assetBundles = ['default'];
}
