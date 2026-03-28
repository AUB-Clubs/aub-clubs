import { createTRPCRouter } from '../init';
import { profileRouter } from '../../modules/Students/server/profile';
import { forYouRouter } from '../../modules/Students/server/forYou';
import { discoverRouter } from '../../modules/Students/server/discover';
import { clubsRouter } from '../../modules/Clubs/server/clubs';
import { commitmentLevelRouter } from '../../modules/Clubs/server/commitmentLevel';
import { scheduleRouter } from '../../modules/Clubs/server/schedule';
import { recommendationsRouter } from '../../modules/Recommendations/server/router';

export const appRouter = createTRPCRouter({
  profile: profileRouter,
  forYou: forYouRouter,
  discover: discoverRouter,
  clubs: clubsRouter,
  commitmentLevel: commitmentLevelRouter,
  schedule: scheduleRouter,
  recommendations: recommendationsRouter,
});

export type AppRouter = typeof appRouter;