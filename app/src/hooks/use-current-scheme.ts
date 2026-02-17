'use client'

import { useSearchParams, useRouter, usePathname } from 'next/navigation'
import { useCallback, useEffect, useState } from 'react'

const STORAGE_KEY = 'levylite-current-scheme'

function getStorage(key: string): string | null {
  if (typeof window === 'undefined') return null
  try {
    return window.localStorage.getItem(key)
  } catch {
    return null
  }
}

function setStorage(key: string, value: string): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(key, value)
  } catch {
    // ignore
  }
}

function removeStorage(key: string): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.removeItem(key)
  } catch {
    // ignore
  }
}

export function useCurrentScheme() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()
  const [schemeId, setSchemeIdState] = useState<string | null>(null)

  useEffect(() => {
    const urlScheme = searchParams.get('scheme')
    if (urlScheme) {
      setSchemeIdState(urlScheme)
      setStorage(STORAGE_KEY, urlScheme)
    } else {
      const stored = getStorage(STORAGE_KEY)
      if (stored) setSchemeIdState(stored)
    }
  }, [searchParams])

  const setSchemeId = useCallback((id: string | null) => {
    setSchemeIdState(id)
    if (id) {
      setStorage(STORAGE_KEY, id)
      const params = new URLSearchParams(searchParams.toString())
      params.set('scheme', id)
      router.replace(`${pathname}?${params.toString()}`)
    } else {
      removeStorage(STORAGE_KEY)
      const params = new URLSearchParams(searchParams.toString())
      params.delete('scheme')
      router.replace(`${pathname}?${params.toString()}`)
    }
  }, [searchParams, router, pathname])

  return { schemeId, setSchemeId }
}
