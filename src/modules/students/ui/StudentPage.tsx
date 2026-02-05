'use client'

import { useEffect, useState } from 'react'
import { trpc } from '@/trpc/client'
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Label } from '@/components/ui/label'
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty'
import { CalendarDays, GraduationCap, Mail, UserCircle2, Users } from 'lucide-react'

type ProfileFormState = {
  bio: string
  avatar_url: string
  major: string
  year: string
}

function formatDate(d: string | Date | null | undefined) {
  if (!d) return '—'
  const date = typeof d === 'string' ? new Date(d) : d
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function getInitials(firstName?: string | null, lastName?: string | null) {
  return [firstName?.[0], lastName?.[0]].filter(Boolean).join('').toUpperCase() || '?'
}

export default function StudentPage() {
  const profileQuery = trpc.profile.get.useQuery()
  const updateMutation = trpc.profile.update.useMutation()

  const profile = profileQuery.data

  const [form, setForm] = useState<ProfileFormState>({
    bio: '',
    avatar_url: '',
    major: '',
    year: '',
  })

  useEffect(() => {
    if (!profile) return
    setForm({
      bio: profile.bio ?? '',
      avatar_url: profile.avatar_url ?? '',
      major: profile.major ?? '',
      year: profile.year ? String(profile.year) : '',
    })
  }, [profile])

  const isSaving = updateMutation.isPending

  const handleChange = (
    field: keyof ProfileFormState,
    value: string,
  ) => {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!profile) return

    await updateMutation.mutateAsync({
      bio: form.bio || undefined,
      avatar_url: form.avatar_url || null,
      major: form.major || null,
      year: form.year ? Number(form.year) : null,
    })

    // Refetch to keep UI in sync
    profileQuery.refetch()
  }

  const isLoading = profileQuery.isLoading

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/10 via-secondary/10 to-accent/10">
      <div className="mx-auto flex max-w-5xl flex-col gap-8 px-4 py-10 sm:px-6 lg:px-8">
        {/* Hero / header */}
        <Card className="overflow-hidden border-none bg-gradient-to-r from-primary via-primary/90 to-secondary text-primary-foreground shadow-xl">
          <CardHeader className="flex flex-col gap-6 pb-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-5">
              <Avatar size="lg" className="border-2 border-primary-foreground/40 shadow-lg">
                {profile?.avatar_url ? (
                  <AvatarImage src={profile.avatar_url} alt={`${profile.first_name} ${profile.last_name}`} />
                ) : null}
                <AvatarFallback className="bg-primary-foreground/10 text-primary-foreground text-xl font-semibold">
                  {getInitials(profile?.first_name, profile?.last_name)}
                </AvatarFallback>
              </Avatar>
              <div className="space-y-2">
                {isLoading ? (
                  <>
                    <Skeleton className="h-6 w-40 bg-primary-foreground/20" />
                    <Skeleton className="h-4 w-32 bg-primary-foreground/15" />
                  </>
                ) : profile ? (
                  <>
                    <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
                      {profile.first_name} {profile.last_name}
                    </h1>
                    <div className="flex flex-wrap items-center gap-2 text-sm text-primary-foreground/90">
                      <Badge className="bg-primary-foreground/15 text-primary-foreground border-primary-foreground/20">
                        <UserCircle2 className="mr-1.5 size-4" />
                        AUBnet ID: {profile.aubnet_id}
                      </Badge>
                      <Badge variant="secondary" className="bg-primary-foreground/10 text-primary-foreground">
                        <Mail className="mr-1.5 size-4" />
                        {profile.email}
                      </Badge>
                    </div>
                  </>
                ) : (
                  <p className="text-sm opacity-90">No student profile found.</p>
                )}
              </div>
            </div>
            {!isLoading && profile ? (
              <div className="flex flex-wrap gap-2">
                {profile.major && (
                  <Badge className="bg-secondary/80 text-secondary-foreground border-secondary-foreground/20">
                    <GraduationCap className="mr-1.5 size-4" />
                    {profile.major}
                  </Badge>
                )}
                {profile.year && (
                  <Badge variant="outline" className="border-primary-foreground/40 bg-primary-foreground/10 text-primary-foreground">
                    Year {profile.year}
                  </Badge>
                )}
                {profile.DOB && (
                  <Badge variant="outline" className="border-primary-foreground/30 bg-transparent text-primary-foreground/90">
                    <CalendarDays className="mr-1.5 size-4" />
                    Born {formatDate(profile.DOB)}
                  </Badge>
                )}
              </div>
            ) : null}
          </CardHeader>
        </Card>

        {/* Main content */}
        <div className="grid gap-6 md:grid-cols-[minmax(0,2fr)_minmax(0,1.4fr)]">
          {/* Profile details & edit form */}
          <Card className="border-primary/10 bg-card/80 shadow-sm backdrop-blur">
            <CardHeader>
              <CardTitle>Profile details</CardTitle>
              <CardDescription>
                Customize how your profile appears to clubs and other students.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="space-y-4">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-20 w-full" />
                  <Skeleton className="h-4 w-36" />
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Skeleton className="h-16 w-full" />
                    <Skeleton className="h-16 w-full" />
                  </div>
                </div>
              ) : !profile ? (
                <Empty className="py-8">
                  <EmptyMedia variant="icon">
                    <UserCircle2 className="size-8 text-muted-foreground" />
                  </EmptyMedia>
                  <EmptyHeader>
                    <EmptyTitle>No profile yet</EmptyTitle>
                    <EmptyDescription>
                      Once your student account is created, your basic details will appear here.
                    </EmptyDescription>
                  </EmptyHeader>
                </Empty>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-6">
                  <div className="space-y-3">
                    <Label htmlFor="bio">About you</Label>
                    <Textarea
                      id="bio"
                      placeholder="Tell clubs a little about yourself, your interests, and what you’re looking for..."
                      value={form.bio}
                      onChange={(e) => handleChange('bio', e.target.value)}
                      rows={4}
                    />
                    <p className="text-xs text-muted-foreground">
                      This appears on your profile for club leaders and members.
                    </p>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="major">Major</Label>
                      <Input
                        id="major"
                        placeholder="e.g. Computer Science"
                        value={form.major}
                        onChange={(e) => handleChange('major', e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="year">Year</Label>
                      <Input
                        id="year"
                        type="number"
                        min={1}
                        max={10}
                        placeholder="e.g. 2"
                        value={form.year}
                        onChange={(e) => handleChange('year', e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="avatar_url">Profile picture URL</Label>
                    <Input
                      id="avatar_url"
                      type="url"
                      placeholder="https://example.com/your-photo.jpg"
                      value={form.avatar_url}
                      onChange={(e) => handleChange('avatar_url', e.target.value)}
                    />
                    <p className="text-xs text-muted-foreground">
                      Use a square image for the best result. You can host it on any public image service.
                    </p>
                  </div>

                  <CardFooter className="px-0 pt-2">
                    <Button type="submit" disabled={isSaving}>
                      {isSaving ? 'Saving changes…' : 'Save profile'}
                    </Button>
                  </CardFooter>
                </form>
              )}
            </CardContent>
          </Card>

          {/* Clubs & meta info */}
          <Card className="border-secondary/20 bg-card/80 shadow-sm backdrop-blur">
            <Tabs defaultValue="clubs" className="flex h-full flex-col">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <CardTitle>Your activity</CardTitle>
                    <CardDescription>
                      Clubs you’re part of and key profile info.
                    </CardDescription>
                  </div>
                </div>
                <TabsList className="mt-4">
                  <TabsTrigger value="clubs">Clubs</TabsTrigger>
                  <TabsTrigger value="info">Account</TabsTrigger>
                </TabsList>
              </CardHeader>
              <TabsContent value="clubs" className="flex-1">
                <CardContent className="space-y-4">
                  {isLoading ? (
                    <div className="space-y-3">
                      <Skeleton className="h-5 w-36" />
                      {[1, 2].map((i) => (
                        <div key={i} className="flex items-center gap-3 rounded-lg border bg-secondary/20 px-3 py-2">
                          <Skeleton className="size-9 rounded-full" />
                          <div className="flex-1 space-y-2">
                            <Skeleton className="h-4 w-32" />
                            <Skeleton className="h-3 w-20" />
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : profile && profile.registered_clubs.length > 0 ? (
                    <div className="space-y-3">
                      {profile.registered_clubs.map((rc) => (
                        <div
                          key={rc.club.id}
                          className="flex items-center gap-3 rounded-xl border border-secondary/40 bg-secondary/20 px-3 py-2"
                        >
                          <Avatar className="size-9 border border-secondary/40 bg-background shadow-sm">
                            {rc.club.image ? (
                              <AvatarImage src={rc.club.image} alt={rc.club.Title} />
                            ) : null}
                            <AvatarFallback className="bg-secondary text-secondary-foreground text-xs font-semibold">
                              {rc.club.Title.slice(0, 2).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-semibold">
                              {rc.club.Title}
                            </p>
                            <p className="truncate text-xs text-muted-foreground">
                              {rc.club.CRN}
                            </p>
                          </div>
                          <Badge
                            variant="outline"
                            className="border-primary/40 bg-primary/5 text-xs font-medium uppercase tracking-wide"
                          >
                            {rc.role}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <Empty className="py-6">
                      <EmptyMedia variant="icon">
                        <Users className="size-7 text-muted-foreground" />
                      </EmptyMedia>
                      <EmptyHeader>
                        <EmptyTitle>No club memberships yet</EmptyTitle>
                        <EmptyDescription>
                          Once you join clubs, they will appear here along with your role.
                        </EmptyDescription>
                      </EmptyHeader>
                    </Empty>
                  )}
                </CardContent>
              </TabsContent>

              <TabsContent value="info" className="flex-1">
                <CardContent className="space-y-4">
                  {isLoading ? (
                    <div className="space-y-3">
                      <Skeleton className="h-4 w-24" />
                      <Skeleton className="h-4 w-40" />
                      <Skeleton className="h-4 w-32" />
                    </div>
                  ) : profile ? (
                    <div className="space-y-3 text-sm">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-muted-foreground">Email</span>
                        <span className="font-medium">{profile.email}</span>
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-muted-foreground">AUBnet ID</span>
                        <span className="font-medium">{profile.aubnet_id}</span>
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-muted-foreground">Joined</span>
                        <span className="font-medium">
                          {formatDate(profile.created_at)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-muted-foreground">Last updated</span>
                        <span className="font-medium">
                          {formatDate(profile.updated_at)}
                        </span>
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      Profile information is not available yet.
                    </p>
                  )}
                </CardContent>
              </TabsContent>
            </Tabs>
          </Card>
        </div>
      </div>
    </div>
  )
}

