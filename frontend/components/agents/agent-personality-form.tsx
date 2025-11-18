/**
 * Agent Personality & Behavior Form Section
 */

'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import type { UseFormReturn } from 'react-hook-form'
import type { AgentFormValues } from '@/lib/schemas/agent'

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

interface AgentPersonalityFormProps {
  form: UseFormReturn<AgentFormValues>
}

export function AgentPersonalityForm({ form }: AgentPersonalityFormProps) {
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null)

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

  return (
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
              <Select onValueChange={field.onChange} value={field.value}>
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
              <Select onValueChange={field.onChange} value={field.value}>
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
  )
}
