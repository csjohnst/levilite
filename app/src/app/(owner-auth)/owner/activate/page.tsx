'use client'

import { Suspense, useState, useEffect } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'

type ActivationState = 'loading' | 'ready' | 'activating' | 'success' | 'error'

export default function OwnerActivatePage() {
  return (
    <Suspense
      fallback={
        <Card>
          <CardContent className="flex items-center justify-center py-12">
            <p className="text-muted-foreground">Loading...</p>
          </CardContent>
        </Card>
      }
    >
      <OwnerActivateContent />
    </Suspense>
  )
}

function OwnerActivateContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const token = searchParams.get('token')
  const [state, setState] = useState<ActivationState>('loading')
  const [error, setError] = useState<string | null>(null)
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordError, setPasswordError] = useState<string | null>(null)

  const supabase = createClient()

  useEffect(() => {
    if (!token) {
      setError('Invalid activation link. Please contact your strata manager.')
      setState('error')
      return
    }

    try {
      const base64 = token.replace(/-/g, '+').replace(/_/g, '/')
      const decoded = JSON.parse(atob(base64))
      if (!decoded.ownerId || !decoded.portalUserId) {
        throw new Error('Invalid token')
      }
      if (decoded.ts && Date.now() - decoded.ts > 7 * 24 * 60 * 60 * 1000) {
        setError(
          'This activation link has expired. Please contact your strata manager to request a new one.'
        )
        setState('error')
        return
      }
      setState('ready')
    } catch {
      setError('Invalid activation link. Please contact your strata manager.')
      setState('error')
    }
  }, [token])

  async function handleActivate(e: React.FormEvent) {
    e.preventDefault()
    if (!token) return

    setPasswordError(null)

    if (password.length < 8) {
      setPasswordError('Password must be at least 8 characters.')
      return
    }

    if (password !== confirmPassword) {
      setPasswordError('Passwords do not match.')
      return
    }

    setState('activating')

    try {
      const response = await fetch('/api/owner/activate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      })

      const result = await response.json()

      if (!response.ok || result.error) {
        throw new Error(result.error || 'Activation failed')
      }

      // Sign in immediately with the password they just set
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: result.email,
        password,
      })

      if (signInError) {
        // Activation succeeded but auto-login failed — send them to login page
        setState('success')
        return
      }

      // Redirect to owner portal
      router.push('/owner')
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Activation failed. Please contact your strata manager.'
      )
      setState('error')
    }
  }

  if (state === 'loading') {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <p className="text-muted-foreground">Validating activation link...</p>
        </CardContent>
      </Card>
    )
  }

  if (state === 'error') {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Activation Failed</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </div>
        </CardContent>
        <CardFooter>
          <Button asChild variant="outline" className="w-full">
            <Link href="/owner/login">Go to Login</Link>
          </Button>
        </CardFooter>
      </Card>
    )
  }

  if (state === 'success') {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Account Activated</CardTitle>
          <CardDescription>
            Your owner portal account has been activated successfully.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            You can now sign in with your email and password.
          </p>
        </CardContent>
        <CardFooter>
          <Button asChild className="w-full">
            <Link href="/owner/login">Go to Login</Link>
          </Button>
        </CardFooter>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Activate Your Account</CardTitle>
        <CardDescription>
          Create a password to activate your owner portal account.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleActivate} className="space-y-4">
          {passwordError && (
            <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
              {passwordError}
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              placeholder="At least 8 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              autoFocus
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirm-password">Confirm password</Label>
            <Input
              id="confirm-password"
              type="password"
              placeholder="Confirm your password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              minLength={8}
            />
          </div>
          <Button
            type="submit"
            className="w-full"
            disabled={state === 'activating'}
          >
            {state === 'activating' ? 'Activating...' : 'Activate Account'}
          </Button>
        </form>
      </CardContent>
      <CardFooter className="justify-center">
        <p className="text-sm text-muted-foreground">
          Once activated, you can view your levy statements, documents,
          maintenance requests, and more.
        </p>
      </CardFooter>
    </Card>
  )
}
