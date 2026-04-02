'use client'

import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import { trpc } from '@/trpc/client'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { ExpandableImage } from '@/components/ui/expandable-image'
import { CommentThread } from '@/modules/posts/ui/components'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  Users,
  UserPlus,
  Megaphone,
  ChevronLeft,
  ChevronRight,
  Shield,
  UserX,
  Check,
  X,
  Plus,
  ArrowLeft,
  Calendar,
  BarChart,
  Settings2,
  ImageIcon,
  Upload,
  Loader2,
  Save,
  Sparkles,
} from 'lucide-react'
import { toast } from 'sonner'
import { MAX_UPLOAD_FILE_BYTES, prepareImageDataUrlForUpload } from '@/lib/client-image-upload'

// ── Helpers ──────────────────────────────────────────────────────────

const ROLE_LABELS: Record<string, string> = {
  MEMBER: 'Member',
  BOARD: 'Board',
  VICE_PRESIDENT: 'Vice President',
  PRESIDENT: 'President',
}

const ROLE_COLORS: Record<string, string> = {
  MEMBER: 'bg-muted text-muted-foreground',
  BOARD: 'bg-blue-500/10 text-blue-700 dark:text-blue-400',
  VICE_PRESIDENT: 'bg-amber-500/10 text-amber-700 dark:text-amber-400',
  PRESIDENT: 'bg-purple-500/10 text-purple-700 dark:text-purple-400',
}

const ROLE_ORDER = ['MEMBER', 'BOARD', 'VICE_PRESIDENT', 'PRESIDENT'] as const

const AUDIENCE_LABELS: Record<string, string> = {
  PUBLIC: 'Public',
  MEMBERS_ONLY: 'Members Only',
  BOARD_ONLY: 'Board Only',
}

const ANNOUNCEMENT_PRIORITY_LABELS: Record<string, string> = {
  GENERAL: 'Normal',
  IMPORTANT: 'Important',
  URGENT: 'Urgent',
}

function getInitials(firstName?: string | null, lastName?: string | null) {
  return [firstName?.[0], lastName?.[0]].filter(Boolean).join('').toUpperCase() || '?'
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

// ── Main Component ───────────────────────────────────────────────────

import { EventsSection } from '../components/AdminEventsSection'
import { AnalyticsSection } from '../components/AdminAnalyticsSection'
import { EventGeneratorSection } from '../components/AdminEventGeneratorSection'

export interface AdminPanelProps {
  clubId: string
  initialSection?: 'members' | 'requests' | 'announcements' | 'events' | 'analytics' | 'profile' | 'event-generator' | null
}

export default function AdminPanel({ clubId, initialSection = null }: AdminPanelProps) {
  const [activeSection, setActiveSection] = useState<'members' | 'requests' | 'announcements' | 'events' | 'analytics' | 'profile' | 'event-generator' | null>(initialSection)

  // Auth check: only president / vice can access
  const membershipQuery = trpc.clubs.getMembership.useQuery(
    { clubId },
    { enabled: !!clubId }
  )

  const actorRole = membershipQuery.data?.role ?? null
  const isAdmin = actorRole === 'PRESIDENT' || actorRole === 'VICE_PRESIDENT'

  // Not admin → redirect
  if (membershipQuery.isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-background to-muted/40 flex items-center justify-center p-6">
        <Card className="max-w-md w-full">
          <CardHeader>
            <Skeleton className="h-6 w-48 mb-2" />
            <Skeleton className="h-4 w-full" />
          </CardHeader>
        </Card>
      </div>
    )
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-background to-muted/40 flex items-center justify-center p-6">
        <Card className="max-w-md w-full">
          <CardHeader>
            <CardTitle>Access Denied</CardTitle>
            <CardDescription>
              Only club Presidents and Vice Presidents can access the admin panel.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" asChild>
              <Link href={`/clubs/${clubId}`}>Back to club</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

function ClubProfileSection({ clubId }: { clubId: string }) {
  const { data } = trpc.clubs.getOverview.useQuery({ clubId })
  const club = data?.club
  const utils = trpc.useUtils()
  
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null)
  const [bannerFile, setBannerFile] = useState<File | null>(null)
  const [bannerPreview, setBannerPreview] = useState<string | null>(null)
  const [description, setDescription] = useState('')
  const [mission, setMission] = useState('')
  const [instagramUrl, setInstagramUrl] = useState('')
  const [websiteUrl, setWebsiteUrl] = useState('')

  const avatarInputRef = useRef<HTMLInputElement>(null)
  const bannerInputRef = useRef<HTMLInputElement>(null)

  // Initialize form with club data
  useEffect(() => {
    if (club) {
      setDescription(club.description || '')
      setMission(club.mission || '')
      setInstagramUrl(club.instagramUrl || '')
      setWebsiteUrl(club.websiteUrl || '')
      setAvatarPreview(club.imageUrl || null)
      setBannerPreview(club.bannerUrl || null)
    }
  }, [club])

  const uploadAvatarMutation = trpc.clubs.uploadClubImage.useMutation()
  const uploadBannerMutation = trpc.clubs.uploadClubBanner.useMutation()
  const updateProfileMutation = trpc.clubs.updateClubProfile.useMutation({
    onSuccess: () => {
      utils.clubs.getOverview.invalidate({ clubId })
      toast.success('Club profile updated successfully!')
    },
    onError: (error) => {
      toast.error('Failed to update profile', {
        description: error.message,
      })
    },
  })

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Validate file type
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      toast.error('Invalid file type', {
        description: 'Please upload a JPG, PNG, or WebP image',
      })
      return
    }

    // Validate file size (5MB)
    if (file.size > MAX_UPLOAD_FILE_BYTES) {
      toast.error('File too large', {
        description: 'Please upload an image smaller than 5MB',
      })
      return
    }

    setAvatarFile(file)
    setAvatarPreview(URL.createObjectURL(file))
  }

  const handleBannerChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Validate file type
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      toast.error('Invalid file type', {
        description: 'Please upload a JPG, PNG, or WebP image',
      })
      return
    }

    // Validate file size (5MB)
    if (file.size > MAX_UPLOAD_FILE_BYTES) {
      toast.error('File too large', {
        description: 'Please upload an image smaller than 5MB',
      })
      return
    }

    setBannerFile(file)
    setBannerPreview(URL.createObjectURL(file))
  }

  const handleSave = async () => {
    try {
      // Upload avatar if changed
      if (avatarFile) {
        const preparedAvatar = await prepareImageDataUrlForUpload(avatarFile)
        await uploadAvatarMutation.mutateAsync({
          clubId,
          base64Image: preparedAvatar.dataUrl,
          fileName: avatarFile.name,
        })
      }

      // Upload banner if changed
      if (bannerFile) {
        const preparedBanner = await prepareImageDataUrlForUpload(bannerFile)
        await uploadBannerMutation.mutateAsync({
          clubId,
          base64Image: preparedBanner.dataUrl,
          fileName: bannerFile.name,
        })
      }

      // Update profile with text fields (images are updated directly by the upload mutations)
      await updateProfileMutation.mutateAsync({
        clubId,
        description: description || undefined,
        mission: mission || undefined,
        instagramUrl: instagramUrl || null,
        websiteUrl: websiteUrl || null,
      })

      // Reset file states
      setAvatarFile(null)
      setBannerFile(null)
    } catch (error) {
      // Error handling is done in mutation callbacks
      console.error('Profile update error:', error)
    }
  }

  const isLoading = uploadAvatarMutation.isPending || uploadBannerMutation.isPending || updateProfileMutation.isPending
  const hasChanges = avatarFile || bannerFile || 
    description !== (club?.description || '') ||
    mission !== (club?.mission || '') ||
    instagramUrl !== (club?.instagramUrl || '') ||
    websiteUrl !== (club?.websiteUrl || '')

  if (!club) {
    return <div className="text-muted-foreground">Loading club data...</div>
  }

  return (
    <>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold">Club Profile</h2>
          <p className="text-muted-foreground">
            Update your club&apos;s avatar, banner, and information
          </p>
        </div>
      </div>

      <div className="space-y-6">
        {/* Avatar Upload */}
        <Card>
          <CardHeader>
            <CardTitle>Club Avatar</CardTitle>
            <CardDescription>
              Upload a square image (recommended: 400x400px)
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-6">
              <div className="relative size-24 rounded-full overflow-hidden bg-muted flex items-center justify-center">
                {avatarPreview ? (
                  <img
                    src={avatarPreview}
                    alt="Avatar preview"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <ImageIcon className="size-8 text-muted-foreground" />
                )}
              </div>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => avatarInputRef.current?.click()}
                  disabled={isLoading}
                >
                  <Upload className="size-4 mr-2" />
                  Choose Image
                </Button>
                {avatarPreview && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setAvatarFile(null)
                      setAvatarPreview(club.imageUrl || null)
                    }}
                    disabled={isLoading}
                  >
                    Reset
                  </Button>
                )}
              </div>
              <input
                ref={avatarInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={handleAvatarChange}
              />
            </div>
          </CardContent>
        </Card>

        {/* Banner Upload */}
        <Card>
          <CardHeader>
            <CardTitle>Club Banner</CardTitle>
            <CardDescription>
              Upload a wide image (recommended: 1200x300px)
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-4">
              <div className="relative w-full h-32 rounded-lg overflow-hidden bg-muted flex items-center justify-center">
                {bannerPreview ? (
                  <img
                    src={bannerPreview}
                    alt="Banner preview"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <ImageIcon className="size-8 text-muted-foreground" />
                )}
              </div>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => bannerInputRef.current?.click()}
                  disabled={isLoading}
                >
                  <Upload className="size-4 mr-2" />
                  Choose Image
                </Button>
                {bannerPreview && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setBannerFile(null)
                      setBannerPreview(club.bannerUrl || null)
                    }}
                    disabled={isLoading}
                  >
                    Reset
                  </Button>
                )}
              </div>
              <input
                ref={bannerInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={handleBannerChange}
              />
            </div>
          </CardContent>
        </Card>

        {/* Description */}
        <Card>
          <CardHeader>
            <CardTitle>Description</CardTitle>
            <CardDescription>
              Brief overview of your club (max 500 characters)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value.slice(0, 500))}
              placeholder="Enter club description..."
              rows={4}
              disabled={isLoading}
              className="resize-none"
            />
            <p className="text-xs text-muted-foreground mt-2">
              {description.length}/500 characters
            </p>
          </CardContent>
        </Card>

        {/* Mission */}
        <Card>
          <CardHeader>
            <CardTitle>Mission Statement</CardTitle>
            <CardDescription>
              Your club&apos;s mission and goals (max 500 characters)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Textarea
              value={mission}
              onChange={(e) => setMission(e.target.value.slice(0, 500))}
              placeholder="Enter mission statement..."
              rows={4}
              disabled={isLoading}
              className="resize-none"
            />
            <p className="text-xs text-muted-foreground mt-2">
              {mission.length}/500 characters
            </p>
          </CardContent>
        </Card>

        {/* Social Links */}
        <Card>
          <CardHeader>
            <CardTitle>Social Links</CardTitle>
            <CardDescription>
              Add your club&apos;s social media and website
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="instagram">Instagram URL</Label>
              <Input
                id="instagram"
                type="url"
                value={instagramUrl}
                onChange={(e) => setInstagramUrl(e.target.value)}
                placeholder="https://instagram.com/yourclub"
                disabled={isLoading}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="website">Website URL</Label>
              <Input
                id="website"
                type="url"
                value={websiteUrl}
                onChange={(e) => setWebsiteUrl(e.target.value)}
                placeholder="https://yourclub.com"
                disabled={isLoading}
              />
            </div>
          </CardContent>
        </Card>

        {/* Save Button */}
        <div className="flex justify-end">
          <Button
            onClick={handleSave}
            disabled={isLoading || !hasChanges}
            size="lg"
          >
            {isLoading ? (
              <>
                <Loader2 className="size-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="size-4 mr-2" />
                Save Changes
              </>
            )}
          </Button>
        </div>
      </div>
    </>
  )
}

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/40">
      <div className="mx-auto max-w-4xl p-6 space-y-8">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            {activeSection && (
              <Button
                variant="ghost"
                size="icon"
                className="rounded-xl"
                onClick={() => setActiveSection(null)}
              >
                <ArrowLeft className="size-5" />
              </Button>
            )}
            <div>
              <h1 className="text-2xl font-bold tracking-tight">
                {activeSection === 'members'
                  ? 'Members'
                  : activeSection === 'requests'
                    ? 'Join Requests'
                    : activeSection === 'announcements'
                      ? 'Announcements'
                      : activeSection === 'events'
                        ? 'Events'
                        : activeSection === 'analytics'
                          ? 'Analytics'
                          : activeSection === 'profile'
                            ? 'Club Profile'
                            : activeSection === 'event-generator'
                              ? 'Event Generator'
                              : 'Admin Panel'}
              </h1>
              <p className="text-sm text-muted-foreground">
                {activeSection
                  ? 'Manage club settings'
                  : 'Choose a section to manage'}
              </p>
            </div>
          </div>
          <div className="flex w-full items-center gap-2 sm:w-auto sm:justify-end">
            <Button variant="outline" size="sm" className="w-fit rounded-lg" asChild>
              <Link href={`/clubs/${clubId}/admin/calendar`}>Calendar workspace</Link>
            </Button>
            <Button variant="default" size="sm" className="w-fit rounded-lg" asChild>
              <Link href={`/clubs/${clubId}`}>Back to club</Link>
            </Button>
          </div>
        </div>

        {/* Section Cards (home) */}
        {!activeSection && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <button
              onClick={() => setActiveSection('members')}
              className="group text-left"
            >
              <Card className="h-full rounded-2xl border-0 bg-card/80 shadow-sm ring-1 ring-border/50 transition-all hover:shadow-md hover:ring-primary/30 cursor-pointer">
                <CardContent className="flex flex-col items-start gap-3 pt-6">
                  <div className="flex size-12 items-center justify-center rounded-xl bg-primary/10 transition-colors group-hover:bg-primary/20">
                    <Users className="size-6 text-primary" />
                  </div>
                  <div>
                    <p className="text-lg font-semibold">Members</p>
                    <p className="text-sm text-muted-foreground">
                      View, manage roles, and remove members
                    </p>
                  </div>
                </CardContent>
              </Card>
            </button>

            <button
              onClick={() => setActiveSection('requests')}
              className="group text-left"
            >
              <Card className="h-full rounded-2xl border-0 bg-card/80 shadow-sm ring-1 ring-border/50 transition-all hover:shadow-md hover:ring-amber-500/30 cursor-pointer">
                <CardContent className="flex flex-col items-start gap-3 pt-6">
                  <div className="flex size-12 items-center justify-center rounded-xl bg-amber-500/10 transition-colors group-hover:bg-amber-500/20">
                    <UserPlus className="size-6 text-amber-600 dark:text-amber-400" />
                  </div>
                  <div>
                    <p className="text-lg font-semibold">Requests</p>
                    <p className="text-sm text-muted-foreground">
                      Accept or reject join requests
                    </p>
                  </div>
                </CardContent>
              </Card>
            </button>

            <button
              onClick={() => setActiveSection('announcements')}
              className="group text-left"
            >
              <Card className="h-full rounded-2xl border-0 bg-card/80 shadow-sm ring-1 ring-border/50 transition-all hover:shadow-md hover:ring-green-500/30 cursor-pointer">
                <CardContent className="flex flex-col items-start gap-3 pt-6">
                  <div className="flex size-12 items-center justify-center rounded-xl bg-green-500/10 transition-colors group-hover:bg-green-500/20">
                    <Megaphone className="size-6 text-green-600 dark:text-green-400" />
                  </div>
                  <div>
                    <p className="text-lg font-semibold">Announcements</p>
                    <p className="text-sm text-muted-foreground">
                      Create and review announcements
                    </p>
                  </div>
                </CardContent>
              </Card>
            </button>

            <button
              onClick={() => setActiveSection('events')}
              className="group text-left"
            >
              <Card className="h-full rounded-2xl border-0 bg-card/80 shadow-sm ring-1 ring-border/50 transition-all hover:shadow-md hover:ring-indigo-500/30 cursor-pointer">
                <CardContent className="flex flex-col items-start gap-3 pt-6">
                  <div className="flex size-12 items-center justify-center rounded-xl bg-indigo-500/10 transition-colors group-hover:bg-indigo-500/20">
                    <Calendar className="size-6 text-indigo-600 dark:text-indigo-400" />
                  </div>
                  <div>
                    <p className="text-lg font-semibold">Events</p>
                    <p className="text-sm text-muted-foreground">
                      Manage events and attendance
                    </p>
                  </div>
                </CardContent>
              </Card>
            </button>

            <button
              onClick={() => setActiveSection('event-generator')}
              className="group text-left"
            >
              <Card className="h-full rounded-2xl border-0 bg-card/80 shadow-sm ring-1 ring-border/50 transition-all hover:shadow-md hover:ring-red-500/30 cursor-pointer">
                <CardContent className="flex flex-col items-start gap-3 pt-6">
                  <div className="flex size-12 items-center justify-center rounded-xl bg-red-500/10 transition-colors group-hover:bg-red-500/20">
                    <Sparkles className="size-6 text-red-600 dark:text-red-400" />
                  </div>
                  <div>
                    <p className="text-lg font-semibold">Event Generator</p>
                    <p className="text-sm text-muted-foreground">
                      AI-powered event planning assistant
                    </p>
                  </div>
                </CardContent>
              </Card>
            </button>

            <button
              onClick={() => setActiveSection('analytics')}
              className="group text-left"
            >
              <Card className="h-full rounded-2xl border-0 bg-card/80 shadow-sm ring-1 ring-border/50 transition-all hover:shadow-md hover:ring-rose-500/30 cursor-pointer">
                <CardContent className="flex flex-col items-start gap-3 pt-6">
                  <div className="flex size-12 items-center justify-center rounded-xl bg-rose-500/10 transition-colors group-hover:bg-rose-500/20">
                    <BarChart className="size-6 text-rose-600 dark:text-rose-400" />
                  </div>
                  <div>
                    <p className="text-lg font-semibold">Analytics</p>
                    <p className="text-sm text-muted-foreground">
                      View and export club reports
                    </p>
                  </div>
                </CardContent>
              </Card>
            </button>

            <button
              onClick={() => setActiveSection('profile')}
              className="group text-left"
            >
              <Card className="h-full rounded-2xl border-0 bg-card/80 shadow-sm ring-1 ring-border/50 transition-all hover:shadow-md hover:ring-violet-500/30 cursor-pointer">
                <CardContent className="flex flex-col items-start gap-3 pt-6">
                  <div className="flex size-12 items-center justify-center rounded-xl bg-violet-500/10 transition-colors group-hover:bg-violet-500/20">
                    <Settings2 className="size-6 text-violet-600 dark:text-violet-400" />
                  </div>
                  <div>
                    <p className="text-lg font-semibold">Club Profile</p>
                    <p className="text-sm text-muted-foreground">
                      Edit club info, images, and links
                    </p>
                  </div>
                </CardContent>
              </Card>
            </button>
          </div>
        )}

        {/* Section content */}
        {activeSection === 'members' && (
          <MembersSection clubId={clubId} actorRole={actorRole!} />
        )}
        {activeSection === 'requests' && (
          <RequestsSection clubId={clubId} />
        )}
        {activeSection === 'announcements' && (
          <AnnouncementsSection clubId={clubId} />
        )}
        {activeSection === 'events' && (
          <EventsSection clubId={clubId} />
        )}
        {activeSection === 'event-generator' && (
          <EventGeneratorSection clubId={clubId} />
        )}
        {activeSection === 'analytics' && (
          <AnalyticsSection clubId={clubId} />
        )}
        {activeSection === 'profile' && (
          <ClubProfileSection clubId={clubId} />
        )}
      </div>
    </div>
  )
}

// ── Members Section ──────────────────────────────────────────────────

function MembersSection({ clubId, actorRole }: { clubId: string; actorRole: string }) {
  const [page, setPage] = useState(1)
  const limit = 10
  const [kickTarget, setKickTarget] = useState<{ userId: string; name: string } | null>(null)

  const membersQuery = trpc.clubs.memberManagement.getMembers.useQuery(
    { clubId, page, limit },
    { enabled: !!clubId }
  )

  const utils = trpc.useUtils()

  const changeRoleMutation = trpc.clubs.memberManagement.changeRole.useMutation({
    onSuccess: () => utils.clubs.memberManagement.getMembers.invalidate({ clubId }),
  })

  const kickMutation = trpc.clubs.memberManagement.kickMember.useMutation({
    onSuccess: () => {
      utils.clubs.memberManagement.getMembers.invalidate({ clubId })
      setKickTarget(null)
    },
  })

  const data = membersQuery.data

  if (membersQuery.isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="flex items-center gap-3 rounded-xl border bg-muted/30 px-4 py-3">
            <Skeleton className="size-11 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-36" />
              <Skeleton className="h-3 w-24" />
            </div>
            <Skeleton className="h-8 w-24 rounded-lg" />
          </div>
        ))}
      </div>
    )
  }

  if (!data || data.members.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center py-12">
          <Users className="size-8 text-muted-foreground mb-3" />
          <p className="text-muted-foreground">No members found.</p>
        </CardContent>
      </Card>
    )
  }

  const canKick = (targetRole: string) => {
    if (actorRole === 'PRESIDENT') return targetRole !== 'PRESIDENT'
    if (actorRole === 'VICE_PRESIDENT') return targetRole !== 'PRESIDENT' && targetRole !== 'VICE_PRESIDENT'
    return false
  }

  const canChangeRole = actorRole === 'PRESIDENT'

  const cycleRole = (currentRole: string) => {
    const idx = ROLE_ORDER.indexOf(currentRole as typeof ROLE_ORDER[number])
    return ROLE_ORDER[(idx + 1) % ROLE_ORDER.length]
  }

  return (
    <>
      <Card className="overflow-hidden rounded-2xl border-0 bg-card/80 shadow-sm ring-1 ring-border/50">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">
              {data.totalCount} member{data.totalCount !== 1 ? 's' : ''}
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2">
            {data.members.map((m) => (
              <li
                key={m.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-muted/30 px-4 py-3 transition-colors hover:bg-muted/50"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <Avatar className="size-10 border-2 border-background shadow-sm">
                    {m.avatarUrl ? (
                      <AvatarImage src={m.avatarUrl} alt={`${m.firstName} ${m.lastName}`} />
                    ) : null}
                    <AvatarFallback className="bg-primary/10 text-primary text-sm font-medium">
                      {getInitials(m.firstName, m.lastName)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <p className="font-medium truncate">
                      {m.firstName} {m.lastName}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">{m.email}</p>
                    <p className="text-xs text-muted-foreground">
                      Joined {formatDate(m.joinedAt)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  {canChangeRole ? (
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={changeRoleMutation.isPending || m.role === 'PRESIDENT'}
                      className={`rounded-lg text-xs font-medium min-w-[110px] ${ROLE_COLORS[m.role] || ''}`}
                      onClick={() =>
                        changeRoleMutation.mutate({
                          clubId,
                          userId: m.userId,
                          newRole: cycleRole(m.role),
                        })
                      }
                    >
                      <Shield className="size-3 mr-1" />
                      {ROLE_LABELS[m.role] ?? m.role}
                    </Button>
                  ) : (
                    <Badge
                      variant="outline"
                      className={`rounded-lg text-xs font-medium ${ROLE_COLORS[m.role] || ''}`}
                    >
                      {ROLE_LABELS[m.role] ?? m.role}
                    </Badge>
                  )}
                  {canKick(m.role) && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="rounded-lg text-destructive hover:bg-destructive/10 hover:text-destructive"
                      onClick={() =>
                        setKickTarget({ userId: m.userId, name: `${m.firstName} ${m.lastName}` })
                      }
                    >
                      <UserX className="size-4" />
                    </Button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      {/* Pagination */}
      {data.totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
            className="rounded-lg"
          >
            <ChevronLeft className="size-4" />
          </Button>
          <span className="text-sm text-muted-foreground">
            Page {page} of {data.totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= data.totalPages}
            onClick={() => setPage((p) => p + 1)}
            className="rounded-lg"
          >
            <ChevronRight className="size-4" />
          </Button>
        </div>
      )}

      {/* Kick Confirmation */}
      <AlertDialog open={!!kickTarget} onOpenChange={() => setKickTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Kick member?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove <strong>{kickTarget?.name}</strong> from
              this club? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={kickMutation.isPending}
              onClick={() => {
                if (kickTarget) {
                  kickMutation.mutate({ clubId, userId: kickTarget.userId })
                }
              }}
            >
              {kickMutation.isPending ? 'Removing…' : 'Yes, kick'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

// ── Requests Section ─────────────────────────────────────────────────

function RequestsSection({ clubId }: { clubId: string }) {
  const requestsQuery = trpc.clubs.memberManagement.getPendingRequests.useQuery(
    { clubId },
    { enabled: !!clubId }
  )

  const utils = trpc.useUtils()

  const respondMutation = trpc.clubs.memberManagement.respondToRequest.useMutation({
    onSuccess: () => {
      utils.clubs.memberManagement.getPendingRequests.invalidate({ clubId })
      utils.clubs.memberManagement.getMembers.invalidate({ clubId })
    },
  })

  if (requestsQuery.isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex items-center gap-3 rounded-xl border bg-muted/30 px-4 py-3">
            <Skeleton className="size-11 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-36" />
              <Skeleton className="h-3 w-24" />
            </div>
            <Skeleton className="h-8 w-20 rounded-lg" />
          </div>
        ))}
      </div>
    )
  }

  const requests = requestsQuery.data ?? []

  if (requests.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center py-12">
          <UserPlus className="size-8 text-muted-foreground mb-3" />
          <p className="font-medium">No pending requests</p>
          <p className="text-sm text-muted-foreground">
            New join requests will appear here.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="overflow-hidden rounded-2xl border-0 bg-card/80 shadow-sm ring-1 ring-border/50">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg">
          {requests.length} pending request{requests.length !== 1 ? 's' : ''}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="space-y-2">
          {requests.map((req) => (
            <li
              key={req.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-muted/30 px-4 py-3 transition-colors hover:bg-muted/50"
            >
              <div className="flex items-center gap-3 min-w-0">
                <Avatar className="size-10 border-2 border-background shadow-sm">
                  {req.avatarUrl ? (
                    <AvatarImage src={req.avatarUrl} alt={`${req.firstName} ${req.lastName}`} />
                  ) : null}
                  <AvatarFallback className="bg-amber-500/10 text-amber-700 dark:text-amber-400 text-sm font-medium">
                    {getInitials(req.firstName, req.lastName)}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <p className="font-medium truncate">
                    {req.firstName} {req.lastName}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">{req.email}</p>
                  <p className="text-xs text-muted-foreground">
                    Requested {formatDate(req.requestedAt)}
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  className="rounded-lg gap-1"
                  disabled={respondMutation.isPending}
                  onClick={() =>
                    respondMutation.mutate({
                      clubId,
                      membershipId: req.id,
                      action: 'accept',
                    })
                  }
                >
                  <Check className="size-3.5" />
                  Accept
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="rounded-lg gap-1"
                  disabled={respondMutation.isPending}
                  onClick={() =>
                    respondMutation.mutate({
                      clubId,
                      membershipId: req.id,
                      action: 'reject',
                    })
                  }
                >
                  <X className="size-3.5" />
                  Reject
                </Button>
              </div>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  )
}

// ── Announcements Section ────────────────────────────────────────────

function AnnouncementsSection({ clubId }: { clubId: string }) {
  const [createOpen, setCreateOpen] = useState(false)
  const [form, setForm] = useState({
    title: '',
    content: '',
    audience: 'PUBLIC' as 'PUBLIC' | 'MEMBERS_ONLY' | 'BOARD_ONLY',
    priority: 'GENERAL' as 'GENERAL' | 'IMPORTANT' | 'URGENT',
  })
  const [announcementImages, setAnnouncementImages] = useState<
    { key: string; fileName: string; preview: string; url?: string }[]
  >([])
  const [uploadingCount, setUploadingCount] = useState(0)
  const announcementImageInputRef = useRef<HTMLInputElement>(null)

  const uploadAnnouncementImageMutation = trpc.clubs.uploadPostImage.useMutation()

  const announcementsQuery = trpc.clubs.memberManagement.getAdminAnnouncements.useQuery(
    { clubId },
    { enabled: !!clubId }
  )
  const currentUserQuery = trpc.profile.get.useQuery(undefined, { staleTime: 5 * 60 * 1000 })

  const utils = trpc.useUtils()

  const createMutation = trpc.clubs.memberManagement.createAnnouncement.useMutation({
    onSuccess: () => {
      utils.clubs.memberManagement.getAdminAnnouncements.invalidate({ clubId })
      setCreateOpen(false)
      setForm({ title: '', content: '', audience: 'PUBLIC', priority: 'GENERAL' })
      setAnnouncementImages([])
    },
  })

  const reviewMutation = trpc.clubs.memberManagement.reviewAnnouncement.useMutation({
    onSuccess: () => {
      utils.clubs.memberManagement.getAdminAnnouncements.invalidate({ clubId })
      utils.clubs.getAnnouncements.invalidate({ clubId })
    },
  })

  const handleAnnouncementImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    if (files.length === 0) return

    if (announcementImages.length + files.length > 4) {
      toast.error('You can only upload up to 4 images per announcement')
      if (announcementImageInputRef.current) {
        announcementImageInputRef.current.value = ''
      }
      return
    }

    for (const file of files) {
      if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
        toast.error(`${file.name}: Only JPG, PNG, and WebP images are allowed`)
        continue
      }

      if (file.size > MAX_UPLOAD_FILE_BYTES) {
        toast.error(`${file.name}: Image must be smaller than 5MB`)
        continue
      }

      const key = `${file.name}-${file.lastModified}`

      try {
        const preparedImage = await prepareImageDataUrlForUpload(file)
        setAnnouncementImages((prev) => [...prev, { key, fileName: file.name, preview: preparedImage.dataUrl }])

        setUploadingCount((count) => count + 1)
        const result = await uploadAnnouncementImageMutation.mutateAsync({
          base64Image: preparedImage.dataUrl,
          fileName: file.name,
        })

        setAnnouncementImages((prev) =>
          prev.map((img) =>
            img.key === key ? { ...img, url: result.imageUrl } : img
          )
        )
      } catch {
        setAnnouncementImages((prev) => prev.filter((img) => img.key !== key))
      } finally {
        setUploadingCount((count) => Math.max(0, count - 1))
      }
    }

    if (announcementImageInputRef.current) {
      announcementImageInputRef.current.value = ''
    }
  }

  const handleRemoveAnnouncementImage = (key: string) => {
    setAnnouncementImages((prev) => prev.filter((img) => img.key !== key))
  }

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.title.trim() || !form.content.trim()) return
    if (announcementImages.some((img) => !img.url)) {
      toast.error('Please wait for images to finish uploading')
      return
    }

    createMutation.mutate({
      clubId,
      title: form.title.trim(),
      content: form.content.trim(),
      audience: form.audience,
      priority: form.priority,
      imageUrls: announcementImages.map((img) => img.url!).filter(Boolean),
    })
  }

  if (announcementsQuery.isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="rounded-xl border bg-muted/30 px-4 py-4 space-y-2">
            <Skeleton className="h-5 w-48" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
          </div>
        ))}
      </div>
    )
  }

  const announcements = announcementsQuery.data ?? []
  const currentUserId = currentUserQuery.data?.id

  return (
    <>
      {/* Create button */}
      <div className="flex justify-end">
        <Dialog
          open={createOpen}
          onOpenChange={(open) => {
            setCreateOpen(open)
            if (!open) {
              setForm({ title: '', content: '', audience: 'PUBLIC', priority: 'GENERAL' })
              setAnnouncementImages([])
            }
          }}
        >
          <DialogTrigger asChild>
            <Button className="gap-1.5 rounded-lg">
              <Plus className="size-4" />
              Create Announcement
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>New Announcement</DialogTitle>
              <DialogDescription>
                Announcements are created as drafts. A President or Vice President must approve before publishing.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="ann-title">Title</Label>
                <Input
                  id="ann-title"
                  placeholder="Announcement title"
                  value={form.title}
                  onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                  maxLength={500}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ann-content">Content</Label>
                <Textarea
                  id="ann-content"
                  placeholder="Announcement content…"
                  value={form.content}
                  onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))}
                  rows={4}
                  maxLength={10000}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Target Audience</Label>
                <Select
                  value={form.audience}
                  onValueChange={(val) =>
                    setForm((f) => ({
                      ...f,
                      audience: val as 'PUBLIC' | 'MEMBERS_ONLY' | 'BOARD_ONLY',
                    }))
                  }
                >
                  <SelectTrigger className="rounded-lg">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PUBLIC">Public — visible to everyone</SelectItem>
                    <SelectItem value="MEMBERS_ONLY">Members Only</SelectItem>
                    <SelectItem value="BOARD_ONLY">Board Only</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Priority</Label>
                <Select
                  value={form.priority}
                  onValueChange={(val) =>
                    setForm((f) => ({
                      ...f,
                      priority: val as 'GENERAL' | 'IMPORTANT' | 'URGENT',
                    }))
                  }
                >
                  <SelectTrigger className="rounded-lg">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="GENERAL">Normal</SelectItem>
                    <SelectItem value="IMPORTANT">Important</SelectItem>
                    <SelectItem value="URGENT">Urgent</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Images (optional)</Label>
                  <span className="text-xs text-muted-foreground">
                    {announcementImages.length}/4
                  </span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {announcementImages.map((img) => (
                    <div key={img.key} className="relative">
                      <img
                        src={img.preview}
                        alt={img.fileName}
                        className="h-20 w-20 rounded-md object-cover"
                      />
                      <button
                        type="button"
                        className="absolute -right-1 -top-1 rounded-full bg-background p-1 shadow"
                        onClick={() => handleRemoveAnnouncementImage(img.key)}
                        disabled={createMutation.isPending}
                        aria-label="Remove image"
                      >
                        <X className="size-3" />
                      </button>
                      {!img.url && (
                        <div className="absolute inset-0 flex items-center justify-center rounded-md bg-black/50">
                          <Loader2 className="size-4 animate-spin text-white" />
                        </div>
                      )}
                    </div>
                  ))}
                  {announcementImages.length < 4 && (
                    <button
                      type="button"
                      className="flex h-20 w-20 items-center justify-center rounded-md border border-dashed text-muted-foreground hover:bg-muted/50"
                      onClick={() => announcementImageInputRef.current?.click()}
                    >
                      <Upload className="size-4" />
                    </button>
                  )}
                </div>
                <input
                  ref={announcementImageInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  multiple
                  className="hidden"
                  onChange={handleAnnouncementImageSelect}
                />
              </div>
              <DialogFooter className="gap-2 sm:gap-0">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setCreateOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={
                    createMutation.isPending ||
                    uploadingCount > 0 ||
                    !form.title.trim() ||
                    !form.content.trim()
                  }
                >
                  {createMutation.isPending ? 'Creating…' : 'Save as Draft'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Announcements list */}
      {announcements.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Megaphone className="size-8 text-muted-foreground mb-3" />
            <p className="font-medium">No announcements yet</p>
            <p className="text-sm text-muted-foreground">
              Create your first announcement using the button above.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {announcements.map((a) => (
            <Card
              key={a.id}
              className="overflow-hidden rounded-2xl border-0 bg-card/80 shadow-sm ring-1 ring-border/50"
            >
              <CardHeader className="pb-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Badge
                      variant={a.status === 'PUBLISHED' ? 'default' : 'secondary'}
                      className={`text-xs ${a.status === 'DRAFT'
                        ? 'bg-amber-500/10 text-amber-700 dark:text-amber-400'
                        : 'bg-green-500/10 text-green-700 dark:text-green-400'
                        }`}
                    >
                      {a.status === 'DRAFT' ? '● Draft' : '✓ Published'}
                    </Badge>
                    <Badge variant="outline" className="text-xs">
                      {AUDIENCE_LABELS[a.audience] ?? a.audience}
                    </Badge>
                    <Badge
                      variant={
                        a.priority === 'URGENT'
                          ? 'destructive'
                          : a.priority === 'IMPORTANT'
                          ? 'default'
                          : 'secondary'
                      }
                      className="text-xs"
                    >
                      {ANNOUNCEMENT_PRIORITY_LABELS[a.priority] ?? a.priority}
                    </Badge>
                  </div>
                  {a.status === 'DRAFT' && (
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        className="rounded-lg gap-1"
                        disabled={reviewMutation.isPending}
                        onClick={() =>
                          reviewMutation.mutate({
                            clubId,
                            postId: a.id,
                            action: 'approve',
                          })
                        }
                      >
                        <Check className="size-3.5" />
                        Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="rounded-lg gap-1 text-destructive hover:bg-destructive/10"
                        disabled={reviewMutation.isPending}
                        onClick={() =>
                          reviewMutation.mutate({
                            clubId,
                            postId: a.id,
                            action: 'reject',
                          })
                        }
                      >
                        <X className="size-3.5" />
                        Reject
                      </Button>
                    </div>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-1">
                <h3 className="font-semibold text-foreground">{a.title}</h3>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap line-clamp-3">
                  {a.content}
                </p>
                {a.imageUrls && a.imageUrls.length > 0 && (
                  <div className="flex flex-wrap gap-2 pt-2">
                    {a.imageUrls.map((url: string, i: number) => (
                      <ExpandableImage
                        key={`${a.id}-${i}`}
                        src={url}
                        alt={`${a.title} image ${i + 1}`}
                        className="h-20 w-20 rounded-md"
                      />
                    ))}
                  </div>
                )}
                <p className="text-xs text-muted-foreground pt-1">
                  By {a.author} · {formatDate(a.createdAt)}
                </p>
              </CardContent>
              {currentUserId && (
                <div className="border-t px-6 pb-4">
                  <CommentThread postId={a.id} currentUserId={currentUserId} />
                </div>
              )}
            </Card>
          ))}
        </div>
      )}
    </>
  )
}
