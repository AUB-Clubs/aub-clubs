import { z } from 'zod';
import { baseProcedure, createTRPCRouter } from '../init';
import { profileRouter } from '../../modules/students/server/profile';
import { forYouRouter } from '../../modules/students/server/forYou';

export const appRouter = createTRPCRouter({
  profile: profileRouter,
  forYou: forYouRouter,
});
// export type definition of API
export type AppRouter = typeof appRouter;