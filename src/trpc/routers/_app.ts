import { createTRPCRouter } from '../init';
import { profileRouter } from '../../modules/Students/server/profile';
import { forYouRouter } from '../../modules/Students/server/forYou';
import { discoverRouter } from '../../modules/Students/server/discover';
import { clubsRouter } from '../../modules/Clubs/server/clubs';
import { commitmentLevelRouter } from '../../modules/Clubs/server/commitmentLevel';
import { scheduleRouter } from '../../modules/Clubs/server/schedule';
import { recommendationsRouter } from '../../modules/Recommendations/server/router';
import { authRouter } from '../../modules/auth/server/router';
import { onboardingRouter } from '../../modules/onboarding/server/router';
import { moderationRouter } from '../../modules/moderation/server/router';
import { postsRouter } from '../../modules/posts/server/router';
import { calendarRouter } from '../../modules/calendar/server/router';
import { scheduleInferenceRouter } from '../../modules/schedule-inference/server/router';
import { universityAdminRouter } from '../../modules/university-admin/server/router';

export const appRouter = createTRPCRouter({
  auth: authRouter,
  onboarding: onboardingRouter,
  profile: profileRouter,
  forYou: forYouRouter,
  discover: discoverRouter,
  clubs: clubsRouter,
  commitmentLevel: commitmentLevelRouter,
  schedule: scheduleRouter,
  recommendations: recommendationsRouter,
  moderation: moderationRouter,
  posts: postsRouter,
  calendar: calendarRouter,
  scheduleInference: scheduleInferenceRouter,
  universityAdmin: universityAdminRouter,
});

export type AppRouter = typeof appRouter;
