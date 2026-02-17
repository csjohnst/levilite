'use client'

import { useSearchParams, useRouter, usePathname } from 'next/navigation'
import { useCallback, useEffect, useState } from 'react'

const STORAGE_KEY = 'levylite-current-scheme'

export function useCurrentScheme() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()
  const [schemeId, setSchemeIdState] = useState<string | null>(null)

  useEffect(() => {
    const urlScheme = searchParams.get('scheme')
    if (urlScheme) {
      setSchemeIdState(urlScheme)
      localStorage.setItem(STORAGE_KEY, urlScheme)
    } else {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) setSchemeIdState(stored)
    }
  }, [searchParams])

  const setSchemeId = useCallback((id: string | null) => {
    setSchemeIdState(id)
    if (id) {
      localStorage.setItem(STORAGE_KEY, id)
      const params = new URLSearchParams(searchParams.toString())
      params.set('scheme', id)
      router.replace(`${pathname}?${params.toString()}`)
    } else {
      localStorage.removeItem(STORAGE_KEY)
      const params = new URLSearchParams(searchParams.toString())
      params.delete('scheme')
      router.replace(`${pathname}?${params.toString()}`)
    }
  }, [searchParams, router, pathname])

  return { schemeId, setSchemeId }
}
