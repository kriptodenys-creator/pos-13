'use client'

import { useCallback, useRef } from 'react'

type UseOrdersVersionGateOptions = {
  versionUrl?: string
}

export function useOrdersVersionGate({ versionUrl = '/api/orders/version' }: UseOrdersVersionGateOptions = {}) {
  const lastVersionRef = useRef<string>('')

  const fetchVersion = useCallback(async () => {
    try {
      const res = await fetch(versionUrl, { cache: 'no-store' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || data?.success === false) return ''
      return String(data.version || '')
    } catch {
      return ''
    }
  }, [versionUrl])

  const checkAndUpdate = useCallback(async () => {
    const v = await fetchVersion()
    if (!v) return false
    if (v === lastVersionRef.current) return false
    lastVersionRef.current = v
    return true
  }, [fetchVersion])

  return {
    lastVersionRef,
    fetchVersion,
    checkAndUpdate,
  }
}
