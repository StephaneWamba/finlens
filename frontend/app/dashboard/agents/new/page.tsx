"use client"

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useCreateAgent, type CreateAgentInput } from '@/lib/api/agents'
import { Button } from '@/components/ui/button'
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Slider } from '@/components/ui/slider'
import { Switch } from '@/components/ui/switch'
import { ArrowLeft, Loader2 } from 'lucide-react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import { agentSchema, type AgentFormValues } from '@/lib/schemas/agent'
import { VOICE_OPTIONS, AGENT_DEFAULTS } from '@/lib/constants/config'

const VOICE_OPTIONS_LOCAL = [
  { value: 'alloy', label: 'Alloy (Neutral)' },
  { value: 'echo', label: 'Echo (Male)' },
  { value: 'fable', label: 'Fable (British)' },
  { value: 'onyx', label: 'Onyx (Deep Male)' },
  { value: 'nova', label: 'Nova (Female)' },
  { value: 'shimmer', label: 'Shimmer (Soft Female)' },
]

const PERSONALITY_TONES = {
  professional: {
    label: 'Professional',
    description: 'Formal, business-like, and respectful',
    prompt: 'You are a professional assistant. Maintain a formal, business-like tone. Be respectful and courteous at all times.',
  },
  friendly: {
    label: 'Friendly',
    description: 'Warm, approachable, and personable',
    prompt: 'You are a friendly assistant. Use a warm, approachable tone. Be personable and make customers feel welcome.',
  },
  casual: {
    label: 'Casual',
    description: 'Relaxed, conversational, and informal',
    prompt: 'You are a casual assistant. Use a relaxed, conversational tone. Be informal but still helpful and respectful.',
  },
  formal: {
    label: 'Formal',
    description: 'Very formal, traditional, and structured',
    prompt: 'You are a formal assistant. Use a very formal, traditional tone. Maintain structure and professionalism in all interactions.',
  },
  enthusiastic: {
    label: 'Enthusiastic',
    description: 'Energetic, positive, and engaging',
    prompt: 'You are an enthusiastic assistant. Use an energetic, positive tone. Be engaging and show excitement when appropriate.',
  },
}

const SYSTEM_PROMPT_TEMPLATES = {
  sales: `You are {name}, a professional sales assistant for {company}. Your role is to:
- Answer product questions accurately and enthusiastically
- Qualify leads based on budget, timeline, and needs
- Schedule demos when appropriate
- Overcome objections with facts and benefits
- Be friendly but professional
- Always ask for the sale when appropriate`,
  support: `You are {name}, a customer support specialist for {company}. Your role is to:
- Help customers resolve issues quickly and efficiently
- Provide clear, step-by-step instructions
- Escalate complex issues when needed
- Show empathy and understanding
- Follow up to ensure satisfaction`,
  general: `You are {name}, an AI assistant for {company}. Your role is to:
- Answer questions accurately and helpfully
- Provide information about products and services
- Assist with common tasks and inquiries
- Be friendly, professional, and efficient
- Escalate to human agents when necessary`,
}


export default function NewAgentPage() {
  const router = useRouter()
  const createAgent = useCreateAgent()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null)

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

  const watchedValues = form.watch()

  // Generate system prompt from personality and template
  const generateSystemPrompt = (template: string, name: string, tone: string, style: string) => {
    const tonePrompt = PERSONALITY_TONES[tone as keyof typeof PERSONALITY_TONES]?.prompt || ''
    const communicationStyle = style === 'concise' 
      ? 'Keep responses concise and to the point.'
      : style === 'detailed'
      ? 'Provide detailed, thorough responses.'
      : 'Provide balanced responses with appropriate detail.'
    
    return `${tonePrompt}\n\n${communicationStyle}\n\n${template.replace('{name}', name).replace('{company}', 'your company')}`
  }

  const handleTemplateSelect = (template: string) => {
    setSelectedTemplate(template)
    const name = form.getValues('name') || 'Assistant'
    const tone = form.getValues('personality_tone')
    const style = form.getValues('communication_style')
    const prompt = generateSystemPrompt(
      SYSTEM_PROMPT_TEMPLATES[template as keyof typeof SYSTEM_PROMPT_TEMPLATES],
      name,
      tone,
      style
    )
    form.setValue('system_prompt', prompt)
  }

  async function onSubmit(values: AgentFormValues) {
    setIsSubmitting(true)
    try {
      const input: CreateAgentInput = {
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

      await createAgent.mutateAsync(input)
      router.push('/dashboard/agents')
    } catch (error) {
      // Error handled by mutation
    } finally {
      setIsSubmitting(false)
    }
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
          <h1 className="text-4xl font-bold tracking-tight">Create New Agent</h1>
          <p className="text-muted-foreground text-lg mt-1">
            Configure your AI agent settings
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
            <Card>
              <CardHeader>
                <CardTitle>Basic Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Agent Name *</FormLabel>
                      <FormControl>
                        <Input placeholder="Sales Assistant Sarah" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Handles product inquiries and lead qualification"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Personality & Behavior</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <FormField
                  control={form.control}
                  name="personality_tone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Personality Tone *</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select a tone" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {Object.entries(PERSONALITY_TONES).map(([key, value]) => (
                            <SelectItem key={key} value={key}>
                              <div>
                                <div className="font-medium">{value.label}</div>
                                <div className="text-xs text-muted-foreground">{value.description}</div>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="communication_style"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Communication Style *</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select a style" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="concise">
                            <div>
                              <div className="font-medium">Concise</div>
                              <div className="text-xs text-muted-foreground">Short, to-the-point responses</div>
                            </div>
                          </SelectItem>
                          <SelectItem value="balanced">
                            <div>
                              <div className="font-medium">Balanced</div>
                              <div className="text-xs text-muted-foreground">Appropriate level of detail</div>
                            </div>
                          </SelectItem>
                          <SelectItem value="detailed">
                            <div>
                              <div className="font-medium">Detailed</div>
                              <div className="text-xs text-muted-foreground">Comprehensive, thorough responses</div>
                            </div>
                          </SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="space-y-2">
                  <Label>Quick Templates</Label>
                  <div className="grid grid-cols-3 gap-2">
                    {Object.entries(SYSTEM_PROMPT_TEMPLATES).map(([key, template]) => (
                      <Button
                        key={key}
                        type="button"
                        variant="outline"
                        className={cn(
                          "h-auto flex-col items-start p-3 transition-all",
                          selectedTemplate === key
                            ? "border-primary bg-primary/20 dark:bg-primary/30 text-primary hover:bg-primary/30 dark:hover:bg-primary/40 hover:text-primary"
                            : "hover:bg-accent"
                        )}
                        onClick={() => handleTemplateSelect(key)}
                      >
                        <span className="font-medium capitalize">{key}</span>
                        <span className={cn(
                          "text-xs mt-1",
                          selectedTemplate === key ? "text-primary/80" : "text-muted-foreground"
                        )}>
                          {key === 'sales' && 'Sales & Lead Qualification'}
                          {key === 'support' && 'Customer Support'}
                          {key === 'general' && 'General Assistant'}
                        </span>
                      </Button>
                    ))}
                  </div>
                </div>

                <FormField
                  control={form.control}
                  name="system_prompt"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>System Prompt *</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="You are Sarah, a professional sales assistant..."
                          className="min-h-[200px] font-mono text-sm"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Voice Settings</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <FormField
                  control={form.control}
                  name="voice"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Voice Selection</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select a voice" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {VOICE_OPTIONS.map(voice => (
                            <SelectItem key={voice.value} value={voice.value}>
                              {voice.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="language"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Language</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select a language" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="en-US">English (US)</SelectItem>
                          <SelectItem value="en-GB">English (UK)</SelectItem>
                          <SelectItem value="es-ES">Spanish (Spain)</SelectItem>
                          <SelectItem value="es-MX">Spanish (Mexico)</SelectItem>
                          <SelectItem value="fr-FR">French</SelectItem>
                          <SelectItem value="de-DE">German</SelectItem>
                          <SelectItem value="it-IT">Italian</SelectItem>
                          <SelectItem value="pt-BR">Portuguese (Brazil)</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-2 gap-6">
                  <FormField
                    control={form.control}
                    name="speed"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Speech Speed: {field.value.toFixed(1)}x</FormLabel>
                        <FormControl>
                          <div className="space-y-2">
                            <Slider
                              value={[field.value]}
                              onValueChange={(value) => field.onChange(value[0])}
                              min={0.5}
                              max={2.0}
                              step={0.1}
                            />
                            <div className="flex justify-between text-xs text-muted-foreground px-1">
                              <span>Slow (0.5x)</span>
                              <span>Normal (1.0x)</span>
                              <span>Fast (2.0x)</span>
                            </div>
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="pitch"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Voice Pitch: {field.value.toFixed(1)}x</FormLabel>
                        <FormControl>
                          <div className="space-y-2">
                            <Slider
                              value={[field.value]}
                              onValueChange={(value) => field.onChange(value[0])}
                              min={0.5}
                              max={2.0}
                              step={0.1}
                            />
                            <div className="flex justify-between text-xs text-muted-foreground px-1">
                              <span>Low (0.5x)</span>
                              <span>Normal (1.0x)</span>
                              <span>High (2.0x)</span>
                            </div>
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="video_enabled"
                  render={({ field }) => (
                    <FormItem className="flex items-center justify-between rounded-lg border p-4">
                      <div className="space-y-0.5">
                        <FormLabel>Enable Video Avatar</FormLabel>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>AI Model Settings</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <FormField
                  control={form.control}
                  name="model"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Model</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select a model" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="gpt-4-turbo">GPT-4 Turbo (Recommended)</SelectItem>
                          <SelectItem value="gpt-4">GPT-4</SelectItem>
                          <SelectItem value="gpt-3.5-turbo">GPT-3.5 Turbo (Faster, Lower Cost)</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="temperature"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Temperature: {field.value.toFixed(1)}</FormLabel>
                      <FormControl>
                        <div className="space-y-2">
                          <Slider
                            value={[field.value]}
                            onValueChange={(value) => field.onChange(value[0])}
                            min={0}
                            max={2}
                            step={0.1}
                          />
                          <div className="flex justify-between text-xs text-muted-foreground px-1">
                            <span>Precise (0.0)</span>
                            <span>Balanced (1.0)</span>
                            <span>Creative (2.0)</span>
                          </div>
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="max_tokens"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Max Tokens: {field.value}</FormLabel>
                      <FormControl>
                        <div className="space-y-2">
                          <Slider
                            value={[field.value]}
                            onValueChange={(value) => field.onChange(value[0])}
                            min={100}
                            max={4000}
                            step={100}
                          />
                          <div className="flex justify-between text-xs text-muted-foreground px-1">
                            <span>Short (100)</span>
                            <span>Medium (2000)</span>
                            <span>Long (4000)</span>
                          </div>
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="enabled"
                  render={({ field }) => (
                    <FormItem className="flex items-center justify-between rounded-lg border p-4">
                      <div className="space-y-0.5">
                        <FormLabel>Enable Agent</FormLabel>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>

            <div className="flex items-center justify-end gap-4 pt-4 border-t">
              <Button type="button" variant="outline" asChild>
                <Link href="/dashboard/agents">Cancel</Link>
              </Button>
              <Button type="submit" disabled={isSubmitting} size="lg">
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Create Agent
              </Button>
            </div>
          </form>
        </Form>
      </motion.div>
    </div>
  )
}

