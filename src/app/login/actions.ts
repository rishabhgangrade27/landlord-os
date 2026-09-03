'use server'

import bcrypt from 'bcryptjs'
import { redirect } from 'next/navigation'
import { createSession, deleteSession } from '@/lib/session'

export type LoginState = { error?: string } | undefined

export async function login(_prevState: LoginState, formData: FormData): Promise<LoginState> {
  const password = formData.get('password') as string
  const hash = process.env.ADMIN_PASSWORD_HASH

  if (!hash) {
    return { error: 'Admin password is not configured. Run scripts/set-password.js first.' }
  }

  if (!password) {
    return { error: 'Enter the password.' }
  }

  const valid = await bcrypt.compare(password, hash)
  if (!valid) {
    return { error: 'Wrong password.' }
  }

  await createSession()
  redirect('/dashboard')
}

export async function logout() {
  await deleteSession()
  redirect('/login')
}
