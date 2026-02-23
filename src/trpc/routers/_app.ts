import { createTRPCRouter } from '../init';
import { profileRouter } from '../../modules/Students/server/profile';
import { forYouRouter } from '../../modules/Students/server/forYou';
import { clubsRouter } from '../../modules/Clubs/server/clubs';
import { commitmentLevelRouter } from '../../modules/Clubs/server/commitmentLevel';

export const appRouter = createTRPCRouter({
  profile: profileRouter,
  forYou: forYouRouter,
  clubs: clubsRouter,
  commitmentLevel: commitmentLevelRouter,
});

export type AppRouter = typeof appRouter;