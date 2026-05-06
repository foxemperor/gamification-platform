import { useState, useCallback } from 'react'
import type { ToastItem, ToastVariant } from '../components/ui/Toast'

let _nextId = 0

export function useToast(autoClose = 4000) {
  const [toasts, setToasts] = useState<ToastItem[]>([])

  const show = useCallback((message: string, variant: ToastVariant = 'info') => {
    const id = ++_nextId
    setToasts(prev => [...prev, { id, message, variant }])

    if (autoClose > 0) {
      setTimeout(() => {
        setToasts(prev => prev.filter(t => t.id !== id))
      }, autoClose)
    }

    return id
  }, [autoClose])

  const close = useCallback((id: number) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  return { toasts, show, close }
}
