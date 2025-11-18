"use client"

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useAgent, useUpdateAgent, type UpdateAgentInput } from '@/lib/api/agents'
import { Button } from '@/components/ui/button'
import { Form } from '@/components/ui/form'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ArrowLeft, Loader2 } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { use, useEffect } from 'react'
import { agentSchema, type AgentFormValues } from '@/lib/schemas/agent'
import { AGENT_DEFAULTS } from '@/lib/constants/config'
import { AgentBasicInfoForm } from '@/components/agents/agent-basic-info-form'
import { AgentPersonalityForm } from '@/components/agents/agent-personality-form'
import { AgentVoiceSettingsForm } from '@/components/agents/agent-voice-settings-form'
import { AgentModelSettingsForm } from '@/components/agents/agent-model-settings-form'


export default function EditAgentPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter()
  const { id } = use(params)
  const { data: agent, isLoading, error } = useAgent(id)
  const updateAgent = useUpdateAgent()
  const [isSubmitting, setIsSubmitting] = useState(false)

  const form = useForm<AgentFormValues>({
    resolver: zodResolver(agentSchema),
    defaultValues: {
      name: '',
      description: '',
      system_prompt: '',
      personality_tone: AGENT_DEFAULTS.PERSONALITY_TONE,
      communication_style: AGENT_DEFAULTS.COMMUNICATION_STYLE,
      voice: AGENT_DEFAULTS.VOICE,
      language: AGENT_DEFAULTS.LANGUAGE,
      speed: AGENT_DEFAULTS.SPEED,
      pitch: AGENT_DEFAULTS.PITCH,
      video_enabled: AGENT_DEFAULTS.VIDEO_ENABLED,
      model: AGENT_DEFAULTS.MODEL,
      temperature: AGENT_DEFAULTS.TEMPERATURE,
      max_tokens: AGENT_DEFAULTS.MAX_TOKENS,
      enabled: AGENT_DEFAULTS.ENABLED,
    },
  })


  // Update form when agent data loads
  useEffect(() => {
    if (agent) {
      const voiceSettings = agent.voice_settings || {}
      form.reset({
        name: agent.name,
        description: agent.description || '',
        system_prompt: agent.system_prompt,
        personality_tone: 'professional', // Default, can be extracted from prompt if needed
        communication_style: 'balanced', // Default, can be extracted from prompt if needed
        voice: voiceSettings?.voice || 'alloy',
        language: voiceSettings?.language || 'en-US',
        speed: voiceSettings?.speed ?? 1.0,
        pitch: voiceSettings?.pitch ?? 1.0,
        video_enabled: voiceSettings?.video_enabled ?? false,
        model: agent.model,
        temperature: agent.temperature,
        max_tokens: agent.max_tokens,
        enabled: agent.enabled,
      })
    }
  }, [agent, form])

  async function onSubmit(values: AgentFormValues) {
    setIsSubmitting(true)
    try {
      const input: UpdateAgentInput = {
        name: values.name,
        description: values.description || undefined,
        system_prompt: values.system_prompt,
        model: values.model,
        temperature: values.temperature,
        max_tokens: values.max_tokens,
        enabled: values.enabled,
        voice_settings: {
          voice: values.voice,
          language: values.language,
          speed: values.speed,
          pitch: values.pitch,
          video_enabled: values.video_enabled,
        },
      }

      await updateAgent.mutateAsync({ id, data: input })
      router.push('/dashboard/agents')
    } catch (error) {
      // Error handled by mutation
    } finally {
      setIsSubmitting(false)
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-8">
        <div className="flex items-center gap-4">
          <Skeleton className="h-10 w-10" />
          <div className="space-y-2">
            <Skeleton className="h-10 w-64" />
            <Skeleton className="h-6 w-96" />
          </div>
        </div>
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-32" />
            <Skeleton className="h-4 w-48" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-64 w-full" />
          </CardContent>
        </Card>
      </div>
    )
  }

  if (error || !agent) {
    return (
      <div className="space-y-8">
        <Card className="border-destructive/50">
          <CardContent className="pt-6">
            <p className="text-destructive">
              {error?.message || 'Failed to load agent. Please try again.'}
            </p>
            <Button asChild className="mt-4">
              <Link href="/dashboard/agents">Back to Agents</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="flex items-center gap-4"
      >
        <Button variant="ghost" size="icon" asChild>
          <Link href="/dashboard/agents">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-4xl font-bold tracking-tight">Edit Agent</h1>
          <p className="text-muted-foreground text-lg mt-1">
            Update your AI agent settings
          </p>
        </div>
      </motion.div>

      {/* Form */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.1 }}
      >
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <AgentBasicInfoForm form={form} />
            <AgentPersonalityForm form={form} />
            <AgentVoiceSettingsForm form={form} />
            <AgentModelSettingsForm form={form} />

            <div className="flex items-center justify-end gap-4 pt-4 border-t">
              <Button type="button" variant="outline" asChild>
                <Link href="/dashboard/agents">Cancel</Link>
              </Button>
              <Button type="submit" disabled={isSubmitting} size="lg">
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save Changes
              </Button>
            </div>
          </form>
        </Form>
      </motion.div>
    </div>
  )
}
