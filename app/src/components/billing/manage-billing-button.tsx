'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { ExternalLink, Loader2 } from 'lucide-react'

interface ManageBillingButtonProps {
  label?: string
}

export function ManageBillingButton({
  label = 'Manage Billing',
}: ManageBillingButtonProps) {
  const [loading, setLoading] = useState(false)

  async function handleClick() {
    setLoading(true)
    try {
      const res = await fetch('/api/billing/create-portal-session', {
        method: 'POST',
      })
      const data = await res.json()
      if (data.portalUrl) {
        window.location.href = data.portalUrl
      } else {
        console.error('Failed to create portal session:', data.error)
        setLoading(false)
      }
    } catch (err) {
      console.error('Portal session error:', err)
      setLoading(false)
    }
  }

  return (
    <Button onClick={handleClick} disabled={loading} variant="outline">
      {loading ? (
        <Loader2 className="mr-2 size-4 animate-spin" />
      ) : (
        <ExternalLink className="mr-2 size-4" />
      )}
      {label}
    </Button>
  )
}
