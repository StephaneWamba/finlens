'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { PasswordForm } from '@/components/settings/password-form'
import { NotificationsForm } from '@/components/settings/notifications-form'
import { Key, Bell, Shield } from 'lucide-react'
import { motion } from 'framer-motion'

export function SettingsContent() {
  return (
    <div className="space-y-8">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <h1 className="text-4xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground text-lg mt-1">
          Manage your account settings and preferences
        </p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.1 }}
      >
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              <CardTitle>Security</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <PasswordForm />
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
            <div className="flex items-center gap-2">
              <Bell className="h-5 w-5" />
              <CardTitle>Notifications</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <NotificationsForm />
          </CardContent>
        </Card>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.3 }}
      >
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Key className="h-5 w-5" />
              <CardTitle>API Keys</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              API key management will be available soon. This will allow you to:
            </p>
            <ul className="mt-2 list-disc list-inside space-y-1 text-sm text-muted-foreground">
              <li>Generate and manage API keys</li>
              <li>Set permissions and rate limits</li>
              <li>View usage statistics</li>
              <li>Revoke keys when needed</li>
            </ul>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  )
}


