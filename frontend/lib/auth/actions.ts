'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

export async function signUp(formData: FormData) {
  const supabase = await createClient()

  const email = formData.get('email') as string
  const password = formData.get('password') as string
  const name = formData.get('name') as string | null
  const companyName = formData.get('companyName') as string | null

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        name: name || undefined,
        company_name: companyName || undefined,
      },
      emailRedirectTo: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/auth/callback`,
    },
  })

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/', 'layout')
  return { data, error: null }
}

export async function signIn(formData: FormData) {
  const supabase = await createClient()

  const email = formData.get('email') as string
  const password = formData.get('password') as string

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })

  if (error) {
    return { error: error.message, success: false }
  }

  revalidatePath('/', 'layout')
  return { success: true, data }
}

export async function signOut() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  revalidatePath('/', 'layout')
  redirect('/login')
}

export async function signInWithOAuth(provider: 'google' | 'github') {
  const supabase = await createClient()

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/auth/callback`,
    },
  })

  if (error) {
    return { error: error.message, url: null }
  }

  return { error: null, url: data.url }
}

export async function updateProfile(formData: FormData) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'Not authenticated' }
  }

  const name = formData.get('name') as string | null
  const avatar_url = formData.get('avatar_url') as string | null

  const { error: authError } = await supabase.auth.updateUser({
    data: {
      name: name || undefined,
      avatar_url: avatar_url || undefined,
    },
  })

  if (authError) {
    return { error: authError.message }
  }

  const { error: dbError } = await supabase
    .from('users')
    .upsert({
      id: user.id,
      email: user.email,
      name: name || null,
      avatar_url: avatar_url || null,
      updated_at: new Date().toISOString(),
    })

  if (dbError) {
    return { error: dbError.message }
  }

  revalidatePath('/dashboard/profile')
  return { success: true, error: null }
}

