import { z } from 'zod';
import { baseProcedure, createTRPCRouter } from '../init';
import { profileRouter } from '../../modules/students/server/profile';
import { forYouRouter } from '../../modules/students/server/forYou';
import { clubsRouter } from '../../modules/Clubs/server/clubs';

export const appRouter = createTRPCRouter({
  profile: profileRouter,
  forYou: forYouRouter,
  clubs : clubsRouter,
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
// export type definition of API
export type AppRouter = typeof appRouter;