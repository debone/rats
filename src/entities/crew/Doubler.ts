import { CrewMember } from './Crew';

export class DoublerCrewMember extends CrewMember {
  constructor(key: string) {
    super({ key, name: 'Doubler', description: 'double the balls', type: 'doubler', textureName: 'avatars_tile_3#0' });
  }
}
