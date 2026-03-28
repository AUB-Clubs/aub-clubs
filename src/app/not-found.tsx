import Link from 'next/link'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Home, ArrowLeft } from 'lucide-react'

export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-background to-muted/40 p-6">
      <Card className="max-w-md w-full rounded-2xl border-0 shadow-lg ring-1 ring-border/50 text-center">
        <CardHeader className="pb-4 pt-10">
          <div className="mx-auto mb-4 flex size-20 items-center justify-center rounded-full bg-muted">
            <span className="text-4xl font-bold text-muted-foreground">404</span>
          </div>
          <CardTitle className="text-2xl">Page not found</CardTitle>
          <CardDescription className="text-base">
            The page you&apos;re looking for doesn&apos;t exist or has been moved.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col items-center gap-3 pb-10">
          <Button asChild className="gap-2">
            <Link href="/">
              <Home className="size-4" />
              Go home
            </Link>
          </Button>
          <Button variant="ghost" asChild className="gap-2 text-muted-foreground">
            <Link href="javascript:history.back()">
              <ArrowLeft className="size-4" />
              Go back
            </Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
