"use client"

import {
  createContext,
  useCallback,
  useContext,
  useState
} from "react"
import Link from "next/link"
import {
  ToastProvider as ToastPrimitiveProvider,
  ToastViewport,
  Toast,
  ToastTitle,
  ToastDescription,
  ToastAction,
  ToastClose
} from "@/components/ui/toast"

type ToastInput = {
  title: string
  description?: string
  actionLabel?: string
  actionHref?: string
}

type ToastItem = ToastInput & { id: number }

type ToastContextValue = {
  toast: (input: ToastInput) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

let nextToastId = 1

export function AppToastProvider({
  children
}: {
  children: React.ReactNode
}) {
  const [toasts, setToasts] = useState<ToastItem[]>([])

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((item) => item.id !== id))
  }, [])

  const toast = useCallback(
    (input: ToastInput) => {
      const id = nextToastId++
      setToasts((prev) => [...prev, { ...input, id }])
    },
    []
  )

  return (
    <ToastContext.Provider value={{ toast }}>
      <ToastPrimitiveProvider swipeDirection="right" duration={4000}>
        {children}

        {toasts.map((item) => (
          <Toast
            key={item.id}
            onOpenChange={(open) => {
              if (!open) dismiss(item.id)
            }}
          >
            <ToastTitle>{item.title}</ToastTitle>
            {item.description && (
              <ToastDescription>{item.description}</ToastDescription>
            )}
            {item.actionHref && item.actionLabel && (
              <div className="mt-2">
                <ToastAction asChild altText={item.actionLabel}>
                  <Link href={item.actionHref}>{item.actionLabel} →</Link>
                </ToastAction>
              </div>
            )}
            <ToastClose />
          </Toast>
        ))}

        <ToastViewport />
      </ToastPrimitiveProvider>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const context = useContext(ToastContext)

  if (!context) {
    throw new Error("useToast must be used within an AppToastProvider")
  }

  return context
}
