"use client"

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import Link from 'next/link'
import { ArrowRight, Sparkles, MessageSquare, BarChart3, TrendingUp, Users, Zap } from 'lucide-react'
import { motion } from 'framer-motion'
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'

export default function DashboardPage() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [profile, setProfile] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadUser() {
      try {
        const supabase = createClient()
        const { data: { user: currentUser }, error: authError } = await supabase.auth.getUser()
        
        if (authError || !currentUser) {
          router.push('/login')
          return
        }

        // Try to get user profile, but don't fail if table doesn't exist yet
        const { data: userProfile, error: profileError } = await supabase
          .from('users')
          .select('*, companies(*)')
          .eq('id', currentUser.id)
          .single()

        // If profile doesn't exist, that's okay - we'll use auth user data
        // Profile error is non-critical, silently continue

        setUser(currentUser)
        setProfile(userProfile || null)
        setLoading(false)
      } catch (error) {
        // Error loading user - redirect handled by auth check above
        setLoading(false)
      }
    }
    loadUser()
  }, [router])

  const displayName = profile?.name || user?.user_metadata?.name || user?.email?.split('@')[0] || 'User'

  if (loading) {
    return (
      <div className="space-y-8">
        <div className="space-y-2">
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-6 w-96" />
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-6 w-32" />
                <Skeleton className="h-4 w-48" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-20 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    )
  }

  const quickActions = [
    {
      icon: Sparkles,
      title: "Getting Started",
      description: "Set up your first AI agent",
      content: "Create your first agent to get started with Syntera.",
      href: "/dashboard/agents/new",
      buttonText: "Create Agent",
      variant: "default" as const,
    },
    {
      icon: MessageSquare,
      title: "Your Agents",
      description: "Manage your AI agents",
      content: "View and manage all your AI agents in one place.",
      href: "/dashboard/agents",
      buttonText: "View Agents",
      variant: "outline" as const,
    },
    {
      icon: BarChart3,
      title: "Analytics",
      description: "Track your usage",
      content: "Monitor your agent performance and usage metrics.",
      href: "/dashboard/analytics",
      buttonText: "View Analytics",
      variant: "outline" as const,
    },
  ]

  const stats = [
    { label: "Total Agents", value: "0", icon: Sparkles, trend: "+0" },
    { label: "Active Conversations", value: "0", icon: MessageSquare, trend: "+0" },
    { label: "Knowledge Base Docs", value: "0", icon: Zap, trend: "+0" },
    { label: "Team Members", value: "1", icon: Users, trend: "+0" },
  ]

  return (
    <div className="space-y-8 pb-8">
      {/* Welcome Section */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className="space-y-2"
      >
        <h1 className="text-4xl font-bold tracking-tight bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
          Welcome back, {displayName.split(' ')[0]}! 👋
        </h1>
        <p className="text-muted-foreground text-lg">
          Here&apos;s an overview of your Syntera account
        </p>
      </motion.div>

      {/* Stats Grid */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.1, ease: "easeOut" }}
        className="grid gap-4 md:grid-cols-2 lg:grid-cols-4"
      >
        {stats.map((stat, index) => {
          const Icon = stat.icon
          return (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ 
                duration: 0.5, 
                delay: 0.15 + index * 0.05,
                ease: [0.16, 1, 0.3, 1]
              }}
              whileHover={{ y: -6, scale: 1.02 }}
              className="group"
            >
              <Card className="relative overflow-hidden border-border/50 bg-card/50 backdrop-blur-sm transition-all duration-300 hover:border-primary/50 hover:shadow-lg hover:shadow-primary/5">
                <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3 relative z-10">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    {stat.label}
                  </CardTitle>
                  <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                    <Icon className="h-4 w-4 text-primary" />
                  </div>
                </CardHeader>
                <CardContent className="relative z-10">
                  <div className="text-3xl font-bold tracking-tight mb-1">
                    {stat.value}
                  </div>
                  <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                    <TrendingUp className="h-3.5 w-3.5 text-green-500" />
                    <span className="text-green-600 dark:text-green-400 font-medium">
                      {stat.trend}
                    </span>
                    <span>from last month</span>
                  </p>
                </CardContent>
              </Card>
            </motion.div>
          )
        })}
      </motion.div>

      {/* Quick Actions */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.3, ease: "easeOut" }}
        className="space-y-4"
      >
        <div>
          <h2 className="text-2xl font-semibold tracking-tight mb-1">Quick Actions</h2>
          <p className="text-sm text-muted-foreground">
            Get started with these essential features
          </p>
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {quickActions.map((action, index) => {
            const Icon = action.icon
            return (
              <motion.div
                key={action.title}
                initial={{ opacity: 0, y: 20, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ 
                  duration: 0.5, 
                  delay: 0.35 + index * 0.08,
                  ease: [0.16, 1, 0.3, 1]
                }}
                whileHover={{ y: -6, scale: 1.02 }}
                className="group"
              >
                <Card className={cn(
                  "relative overflow-hidden h-full transition-all duration-300",
                  action.variant === "default" 
                    ? "border-primary/50 bg-gradient-to-br from-primary/5 via-card to-card hover:border-primary hover:shadow-lg hover:shadow-primary/10" 
                    : "border-border/50 bg-card/50 backdrop-blur-sm hover:border-primary/30 hover:shadow-md"
                )}>
                  <div className={cn(
                    "absolute inset-0 bg-gradient-to-br opacity-0 group-hover:opacity-100 transition-opacity duration-300",
                    action.variant === "default"
                      ? "from-primary/10 via-primary/5 to-transparent"
                      : "from-primary/5 via-transparent to-transparent"
                  )} />
                  <CardHeader className="relative z-10 pb-3">
                    <div className="flex items-center gap-3 mb-1">
                      <div className={cn(
                        "h-10 w-10 rounded-lg flex items-center justify-center transition-all duration-300",
                        action.variant === "default"
                          ? "bg-primary/20 text-primary group-hover:bg-primary/30 group-hover:scale-110"
                          : "bg-muted text-primary group-hover:bg-primary/10 group-hover:scale-110"
                      )}>
                        <Icon className="h-5 w-5" />
                      </div>
                      <CardTitle className="text-lg">{action.title}</CardTitle>
                    </div>
                    <CardDescription className="text-sm">
                      {action.description}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="relative z-10 space-y-4">
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      {action.content}
                    </p>
                    <Button 
                      asChild 
                      size="sm" 
                      variant={action.variant}
                      className="w-full group/button"
                    >
                      <Link href={action.href} className="flex items-center justify-center">
                        <span>{action.buttonText}</span>
                        <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover/button:translate-x-1" />
                      </Link>
                    </Button>
                  </CardContent>
                </Card>
              </motion.div>
            )
          })}
        </div>
      </motion.div>
    </div>
  )
}

