export type CrewMemberType = 'faster' | 'doubler' | 'captain' | 'empty';

export abstract class CrewMember {
  public readonly key: string;
  public readonly name: string;
  public readonly description: string;
  public readonly type: CrewMemberType;
  public readonly textureName: string;

  constructor({
    key,
    name,
    description,
    type,
    textureName,
  }: {
    key: string;
    name: string;
    description: string;
    type: CrewMemberType;
    textureName: string;
  }) {
    this.key = key;
    this.name = name;
    this.textureName = textureName;
    this.description = description;
    this.type = type;
  }
}
