import { initTRPC } from '@trpc/server';
import { cache } from 'react';
import superjson from 'superjson'
import { createClient } from '@/modules/auth/server/utils/supabase-server';

export const createTRPCContext = cache(async () => {
  /**
   * @see: https://trpc.io/docs/server/context
   */
  const supabase = await createClient();
  const { data: { session } } = await supabase.auth.getSession();
  
  return { 
    userId: session?.user?.id ?? null,
    session,
  };
});

export type Context = Awaited<ReturnType<typeof createTRPCContext>>

const t = initTRPC.context<Context>().create({
  /**
   * @see https://trpc.io/docs/server/data-transformers
   */
  transformer: superjson,
});

// Base router and procedure helpers
export const createTRPCRouter = t.router;
export const createCallerFactory = t.createCallerFactory;
export const baseProcedure = t.procedure;