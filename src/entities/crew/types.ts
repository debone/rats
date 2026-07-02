export const CREW_RARITIES = {
  common: 'common',
  uncommon: 'uncommon',
  rare: 'rare',
} as const;

export type CrewRarity = (typeof CREW_RARITIES)[keyof typeof CREW_RARITIES];

export const RARITY_WEIGHTS: Record<CrewRarity, number> = {
  common: 4,
  uncommon: 2,
  rare: 1,
};

export const RARITY_COST: Record<CrewRarity, number> = {
  common: 1,
  uncommon: 2,
  rare: 3,
};
