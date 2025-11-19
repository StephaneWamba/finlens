"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  LayoutDashboard,
  User,
  Settings,
  Sparkles,
  MessageSquare,
  BarChart3,
  Users,
  Workflow,
  BookOpen,
  Phone,
} from "lucide-react"
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar"
import { cn } from "@/lib/utils"
import Image from "next/image"
import { motion } from "framer-motion"

const navigation = [
  {
    name: "Dashboard",
    href: "/dashboard",
    icon: LayoutDashboard,
  },
  {
    name: "Agents",
    href: "/dashboard/agents",
    icon: Sparkles,
  },
  {
    name: "Chat",
    href: "/dashboard/chat",
    icon: MessageSquare,
  },
  {
    name: "Analytics",
    href: "/dashboard/analytics",
    icon: BarChart3,
  },
  {
    name: "CRM",
    href: "/dashboard/crm",
    icon: Users,
  },
  {
    name: "Workflows",
    href: "/dashboard/workflows",
    icon: Workflow,
  },
  {
    name: "Knowledge Base",
    href: "/dashboard/knowledge-base",
    icon: BookOpen,
  },
  {
    name: "Calls",
    href: "/dashboard/calls",
    icon: Phone,
  },
]

const bottomNavigation = [
  {
    name: "Profile",
    href: "/dashboard/profile",
    icon: User,
  },
  {
    name: "Settings",
    href: "/dashboard/settings",
    icon: Settings,
  },
]

export function DashboardSidebar() {
  const pathname = usePathname()

  return (
    <Sidebar className="border-r border-border/50">
      <SidebarHeader className="border-b border-border/50 p-4">
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.3 }}
        >
          <Link 
            href="/dashboard" 
            className="flex items-center gap-2.5 group/logo transition-opacity hover:opacity-80"
          >
            <div className="relative">
              <Image 
                src="/logo.svg" 
                alt="Syntera" 
                width={120} 
                height={32}
                className="h-8 w-auto transition-transform group-hover/logo:scale-105"
                priority
              />
            </div>
          </Link>
        </motion.div>
      </SidebarHeader>
      <SidebarContent className="gap-2">
        <SidebarGroup>
          <SidebarGroupLabel className="px-3 text-xs font-semibold text-muted-foreground/70 uppercase tracking-wider mb-2">
            Navigation
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="space-y-1">
              {navigation.map((item, index) => {
                const isActive = pathname === item.href || pathname?.startsWith(`${item.href}/`)
                return (
                  <motion.div
                    key={item.name}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.3, delay: index * 0.03 }}
                  >
                    <SidebarMenuItem>
                      <SidebarMenuButton 
                        asChild 
                        isActive={isActive}
                        className={cn(
                          "group relative mx-2 rounded-lg transition-all duration-200",
                          isActive 
                            ? "bg-primary/10 text-primary font-medium shadow-sm" 
                            : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                        )}
                      >
                        <Link href={item.href} className="flex items-center gap-3">
                          <div className={cn(
                            "flex items-center justify-center h-8 w-8 rounded-md transition-all duration-200",
                            isActive
                              ? "bg-primary/20 text-primary"
                              : "bg-muted/50 text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary"
                          )}>
                            <item.icon className="h-4 w-4" />
                          </div>
                          <span className="flex-1">{item.name}</span>
                          {isActive && (
                            <motion.div
                              layoutId="activeIndicator"
                              className="absolute right-2 h-1.5 w-1.5 rounded-full bg-primary"
                              initial={false}
                              transition={{ type: "spring", stiffness: 500, damping: 30 }}
                            />
                          )}
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  </motion.div>
                )
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        <SidebarGroup className="mt-auto border-t border-border/50 pt-4">
          <SidebarGroupContent>
            <SidebarMenu className="space-y-1">
              {bottomNavigation.map((item, index) => {
                const isActive = pathname === item.href || pathname?.startsWith(`${item.href}/`)
                return (
                  <motion.div
                    key={item.name}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.3, delay: (navigation.length + index) * 0.03 }}
                  >
                    <SidebarMenuItem>
                      <SidebarMenuButton 
                        asChild 
                        isActive={isActive}
                        className={cn(
                          "group relative mx-2 rounded-lg transition-all duration-200",
                          isActive 
                            ? "bg-primary/10 text-primary font-medium shadow-sm" 
                            : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                        )}
                      >
                        <Link href={item.href} className="flex items-center gap-3">
                          <div className={cn(
                            "flex items-center justify-center h-8 w-8 rounded-md transition-all duration-200",
                            isActive
                              ? "bg-primary/20 text-primary"
                              : "bg-muted/50 text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary"
                          )}>
                            <item.icon className="h-4 w-4" />
                          </div>
                          <span className="flex-1">{item.name}</span>
                          {isActive && (
                            <motion.div
                              layoutId="activeIndicatorBottom"
                              className="absolute right-2 h-1.5 w-1.5 rounded-full bg-primary"
                              initial={false}
                              transition={{ type: "spring", stiffness: 500, damping: 30 }}
                            />
                          )}
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  </motion.div>
                )
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarRail />
    </Sidebar>
  )
}

