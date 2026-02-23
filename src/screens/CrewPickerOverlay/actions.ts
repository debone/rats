import { ASSETS } from '@/assets';
import { changeScraps, getRunState } from '@/data/game-state';
import { CREW_DEFS, CrewMemberInstance, type CrewMemberDef, type CrewMemberDefKey } from '@/entities/crew/Crew';
import { Assets, type Texture } from 'pixi.js';

export function buyCrewMember(def: CrewMemberDef): boolean {
  const runState = getRunState();
  if (runState.scrapsCounter.get() < def.hiringCost) return false;

  changeScraps(-def.hiringCost);
  runState.crewMembers.push(
    new CrewMemberInstance(def.type, `crew-${def.type}-${Math.random().toString(36).substring(2, 6)}`),
  );
  return true;
}

export function addScraps(amount: number): void {
  changeScraps(amount);
}

export function getCrewTexture(defKey: CrewMemberDefKey): Texture {
  return Assets.get(ASSETS.prototype).textures[CREW_DEFS[defKey].textureName];
}

export function getScrapsTexture(): Texture {
  return Assets.get(ASSETS.prototype).textures['scraps#0'];
}

export function getSlotTexture(variant: 'empty' | 'hover' = 'empty'): Texture {
  const frame = variant === 'hover' ? 'avatars_tile_2#0' : 'avatars_tile_1#0';
  return Assets.get(ASSETS.prototype).textures[frame];
}
