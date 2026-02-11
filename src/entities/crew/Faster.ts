import { CrewMember } from './Crew';

export class FasterCrewMember extends CrewMember {
  constructor(key: string) {
    super({ key, name: 'Faster', description: 'balls go brrr', type: 'faster', textureName: 'avatars_tile_2#0' });
  }
}
