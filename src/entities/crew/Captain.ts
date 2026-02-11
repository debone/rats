import { CrewMember } from './Crew';

export class CaptainCrewMember extends CrewMember {
  constructor(key: string) {
    super({ key, name: 'Captain', description: 'ship is faster', type: 'captain', textureName: 'avatars_tile_4#0' });
  }
}
