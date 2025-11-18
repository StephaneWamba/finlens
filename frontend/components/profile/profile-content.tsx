'use client'

import { ProfileForm } from '@/components/profile/profile-form'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { CheckCircle2, XCircle, Mail } from 'lucide-react'
import { motion } from 'framer-motion'

interface ProfileContentProps {
  user: {
    id: string
    email: string | null
    email_confirmed_at: string | null
    user_metadata?: {
      name?: string
      avatar_url?: string
    }
  }
  profile: {
    name?: string | null
    avatar_url?: string | null
    company_id?: string | null
    companies?: {
      id: string
      name: string
      subscription_tier: string
      created_at: string
    } | null
  } | null
}

export function ProfileContent({ user, profile }: ProfileContentProps) {
  const company = profile?.companies || null

  return (
    <div className="space-y-8">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <h1 className="text-4xl font-bold tracking-tight">Profile Settings</h1>
        <p className="text-muted-foreground text-lg mt-1">
          Manage your account information and preferences
        </p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.1 }}
      >
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5" />
              Email Verification
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium">{user.email}</span>
                {user.email_confirmed_at ? (
                  <Badge variant="default" className="bg-green-500">
                    <CheckCircle2 className="mr-1 h-3 w-3" />
                    Verified
                  </Badge>
                ) : (
                  <Badge variant="destructive">
                    <XCircle className="mr-1 h-3 w-3" />
                    Not Verified
                  </Badge>
                )}
              </div>
              {!user.email_confirmed_at && (
                <p className="text-xs text-muted-foreground">
                  Check your email for a verification link
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.2 }}
      >
        <Card>
          <CardHeader>
            <CardTitle>Profile Information</CardTitle>
          </CardHeader>
          <CardContent>
            <ProfileForm
              user={{
                id: user.id,
                email: user.email || '',
                name: profile?.name || user.user_metadata?.name || '',
                avatar_url: profile?.avatar_url || user.user_metadata?.avatar_url || '',
                company_id: profile?.company_id || null,
              }}
              company={company}
            />
          </CardContent>
        </Card>
      </motion.div>

      {company && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
        >
          <Card>
            <CardHeader>
              <CardTitle>Company Information</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium">Company Name</label>
                  <p className="text-sm text-muted-foreground">{company.name}</p>
                </div>
                <div>
                  <label className="text-sm font-medium">Subscription Tier</label>
                  <Badge variant="outline" className="mt-1">
                    {company.subscription_tier || 'starter'}
                  </Badge>
                </div>
                <div>
                  <label className="text-sm font-medium">Member Since</label>
                  <p className="text-sm text-muted-foreground">
                    {new Date(company.created_at).toLocaleDateString()}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}
    </div>
  )
}


