import { CrewMember } from './Crew';

export class EmptyCrewMember extends CrewMember {
  constructor(key: string) {
    super({ key, name: '', description: '', type: 'empty', textureName: 'avatars_tile_1#0' });
  }
}
