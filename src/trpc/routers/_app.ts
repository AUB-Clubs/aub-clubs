import { z } from 'zod';
import { baseProcedure, createTRPCRouter } from '../init';
import { clubsListRouter } from '../../modules/Clubs/server/clubslist';
import { clubsRouter } from '@/modules/Clubs/server/clubs';

export const appRouter = createTRPCRouter({
  clubs : clubsRouter,
  clubsList: clubsListRouter,
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