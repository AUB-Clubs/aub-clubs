'use client'

import { trpc } from '@/trpc/client'
import { QueryClientProvider } from '@tanstack/react-query'
import { makeQueryClient } from '@/trpc/query-client'
import { httpBatchLink } from '@trpc/client'
import { ReactNode } from 'react'
import superjson from 'superjson';

export function Providers({ children }: { children: ReactNode }) {
  const queryClient = makeQueryClient()

  return (
    <trpc.Provider
      client={trpc.createClient({
        links: [
          httpBatchLink({
              transformer: superjson,
              url: 'http://localhost:3000/api/trpc',
          }),
        ],
      })}
      queryClient={queryClient}
    >
      {children}
    </trpc.Provider>
  )
}
