'use client'

import { useState } from 'react'
import { trpc } from '@/trpc/client'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Plus, Wallet } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'

export function FinanceSection({ clubId }: { clubId: string }) {
  const utils = trpc.useUtils()
  const financesQuery = trpc.clubs.analytics.getClubFinances.useQuery(
    { clubId },
    { enabled: !!clubId }
  )

  const logMutation = trpc.clubs.analytics.logFinance.useMutation({
    onSuccess: () => {
      toast.success('Entry saved')
      void utils.clubs.analytics.getClubFinances.invalidate({ clubId })
      setOpen(false)
      setAmount('')
      setDescription('')
    },
    onError: (e) => toast.error(e.message || 'Could not save entry'),
  })

  const [open, setOpen] = useState(false)
  const [entryType, setEntryType] = useState<'INCOME' | 'EXPENSE'>('INCOME')
  const [amount, setAmount] = useState('')
  const [description, setDescription] = useState('')

  const data = financesQuery.data

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const n = Number.parseFloat(amount)
    if (!Number.isFinite(n) || n <= 0) {
      toast.error('Enter a positive amount')
      return
    }
    logMutation.mutate({
      clubId,
      amount: n,
      type: entryType,
      description: description.trim() || undefined,
    })
  }

  if (financesQuery.isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-full rounded-xl" />
        <Skeleton className="h-40 w-full rounded-xl" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-bold">Funding</h2>
          <p className="text-sm text-muted-foreground">
            Record funding received and spending for university reporting.
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="size-4" />
              Log entry
            </Button>
          </DialogTrigger>
          <DialogContent>
            <form onSubmit={handleSubmit}>
              <DialogHeader>
                <DialogTitle>Log funding</DialogTitle>
                <DialogDescription>Add a single income or expense line item.</DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-2">
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant={entryType === 'INCOME' ? 'default' : 'outline'}
                    className="flex-1"
                    onClick={() => setEntryType('INCOME')}
                  >
                    Funding received
                  </Button>
                  <Button
                    type="button"
                    variant={entryType === 'EXPENSE' ? 'default' : 'outline'}
                    className="flex-1"
                    onClick={() => setEntryType('EXPENSE')}
                  >
                    Spending
                  </Button>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="amount">Amount</Label>
                  <Input
                    id="amount"
                    type="number"
                    inputMode="decimal"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="desc">Description (optional)</Label>
                  <Textarea
                    id="desc"
                    rows={3}
                    maxLength={500}
                    placeholder="e.g. Department allocation, venue rental…"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button type="submit" disabled={logMutation.isPending}>
                  {logMutation.isPending ? 'Saving…' : 'Save'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center gap-3 space-y-0 pb-2">
          <div className="flex size-10 items-center justify-center rounded-lg bg-emerald-500/10">
            <Wallet className="size-5 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div>
            <CardTitle className="text-base">Running balance</CardTitle>
            <CardDescription>Sum of income minus expenses</CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-3xl font-semibold tabular-nums">
            {(data?.balance ?? 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Ledger</CardTitle>
          <CardDescription>Most recent entries first</CardDescription>
        </CardHeader>
        <CardContent>
          {!data?.records.length ? (
            <p className="text-sm text-muted-foreground">No entries yet.</p>
          ) : (
            <div className="overflow-x-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead>Description</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.records.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="whitespace-nowrap text-muted-foreground">
                        {new Date(r.createdAt).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        <Badge variant={r.type === 'INCOME' ? 'default' : 'secondary'}>
                          {r.type === 'INCOME' ? 'Income' : 'Expense'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right tabular-nums font-medium">
                        {r.type === 'EXPENSE' ? '−' : '+'}
                        {r.amount.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                      </TableCell>
                      <TableCell className="max-w-[220px] truncate text-muted-foreground">
                        {r.description || '—'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
