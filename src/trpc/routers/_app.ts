import { createTRPCRouter } from '../init';
import { profileRouter } from '../../modules/Students/server/profile';
import { forYouRouter } from '../../modules/Students/server/forYou';
import { discoverRouter } from '../../modules/Students/server/discover';
import { clubsRouter } from '../../modules/Clubs/server/clubs';
import { commitmentLevelRouter } from '../../modules/Clubs/server/commitmentLevel';
import { recommendationsRouter } from '../../modules/Recommendations/server/router';
import { authRouter } from '../../modules/auth/server/router';
import { onboardingRouter } from '../../modules/onboarding/server/router';
import { moderationRouter } from '../../modules/moderation/server/router';
import { postsRouter } from '../../modules/posts/server/router';

export const appRouter = createTRPCRouter({
  auth: authRouter,
  onboarding: onboardingRouter,
  profile: profileRouter,
  forYou: forYouRouter,
  discover: discoverRouter,
  clubs: clubsRouter,
  commitmentLevel: commitmentLevelRouter,
  recommendations: recommendationsRouter,
  moderation: moderationRouter,
  posts: postsRouter,
});

export type AppRouter = typeof appRouter;