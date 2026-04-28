import { z } from 'zod';

export const ClubType = z.enum([
  'ACADEMIC', 'ARTS', 'BUSINESS', 'CAREER', 'CULTURAL', 'GAMING', 'MEDIA',
  'SPORTS', 'SOCIAL', 'TECHNOLOGY', 'COMMUNITY_SERVICE', 'ENVIRONMENTAL',
  'HEALTH_WELLNESS', 'RELIGIOUS', 'BEGINNER_FRIENDLY', 'COMPETITIVE', 'NETWORKING',
]);

export type ClubTypeValue = z.infer<typeof ClubType>;

export function normalizeClubTypeFilters(args: {
  types?: ClubTypeValue[];
  categories?: ClubTypeValue[];
  category?: ClubTypeValue | ClubTypeValue[];
}): ClubTypeValue[] {
  const merged = new Set<ClubTypeValue>();

  for (const type of args.types ?? []) {
    merged.add(type);
  }

  for (const type of args.categories ?? []) {
    merged.add(type);
  }

  if (Array.isArray(args.category)) {
    for (const type of args.category) {
      merged.add(type);
    }
  } else if (args.category) {
    merged.add(args.category);
  }

  return [...merged];
}
