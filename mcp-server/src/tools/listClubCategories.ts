import { z } from 'zod';

export const listClubCategoriesInput = {};

const Category = z.object({
  value: z.string(),
  label: z.string(),
  description: z.string(),
});

const CATEGORIES: z.infer<typeof Category>[] = [
  { value: 'ACADEMIC', label: 'Academic', description: 'Subject-area study, research, and academic societies.' },
  { value: 'ARTS', label: 'Arts', description: 'Visual arts, music, theater, dance, and creative expression.' },
  { value: 'BUSINESS', label: 'Business', description: 'Entrepreneurship, finance, consulting, and business case clubs.' },
  { value: 'CAREER', label: 'Career', description: 'Professional development, mentorship, and industry-prep clubs.' },
  { value: 'CULTURAL', label: 'Cultural', description: 'Heritage, language, and identity-based community clubs.' },
  { value: 'GAMING', label: 'Gaming', description: 'Video games, board games, esports, and game development.' },
  { value: 'MEDIA', label: 'Media', description: 'Journalism, film, photography, podcasting, and broadcasting.' },
  { value: 'SPORTS', label: 'Sports', description: 'Recreational and competitive sports clubs.' },
  { value: 'SOCIAL', label: 'Social', description: 'Social events, friendship-building, and student life clubs.' },
  { value: 'TECHNOLOGY', label: 'Technology', description: 'Programming, robotics, AI/ML, hackathons, and engineering.' },
  { value: 'COMMUNITY_SERVICE', label: 'Community Service', description: 'Volunteering, charity, and outreach.' },
  { value: 'ENVIRONMENTAL', label: 'Environmental', description: 'Sustainability, conservation, and climate-focused clubs.' },
  { value: 'HEALTH_WELLNESS', label: 'Health & Wellness', description: 'Mental health, fitness, nutrition, and wellbeing.' },
  { value: 'RELIGIOUS', label: 'Religious', description: 'Faith-based and spiritual clubs.' },
  { value: 'BEGINNER_FRIENDLY', label: 'Beginner Friendly', description: 'Clubs that welcome newcomers with no prior experience.' },
  { value: 'COMPETITIVE', label: 'Competitive', description: 'Competition-oriented clubs (case comps, sport leagues, contests).' },
  { value: 'NETWORKING', label: 'Networking', description: 'Career networking, alumni connections, and industry events.' },
];

export async function listClubCategories(_args: Record<string, never>) {
  return CATEGORIES;
}
