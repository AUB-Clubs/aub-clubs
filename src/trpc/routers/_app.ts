import { z } from 'zod';
import { baseProcedure, createTRPCRouter } from '../init';
import { profileRouter } from '../../modules/Students/server/profile';
import { forYouRouter } from '../../modules/Students/server/forYou';
import { clubsRouter } from '../../modules/Clubs/server/clubs';
import { commitmentLevelRouter } from '../../modules/Clubs/server/commitmentLevel';
import { scheduleRouter } from '../../modules/Clubs/server/schedule';
import { forumRouter }           from '@/modules/Forums/server/forums';

export const appRouter = createTRPCRouter({
  profile:         profileRouter,
  forYou:          forYouRouter,
  clubs:           clubsRouter,
  commitmentLevel: commitmentLevelRouter,
  schedule: scheduleRouter,
  forum:           forumRouter,
  createUser: baseProcedure
    .input(
      z.object({
        text: z.string(),
      }),
    )
    .query((opts) => {
      return {
        greeting: `hello ${opts.input.text}`,
      };
    }),
});

export type AppRouter = typeof appRouter;