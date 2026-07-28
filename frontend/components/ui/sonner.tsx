"use client"

import { Toaster } from "sonner"

export function AppToaster() {
  return (
    <Toaster
      position="top-center"
      closeButton
      offset={16}
      gap={10}
      duration={4200}
      toastOptions={{
        classNames: {
          toast: "app-toast",
          title: "app-toast__title",
          description: "app-toast__description",
          actionButton: "app-toast__action",
          cancelButton: "app-toast__cancel",
          closeButton: "app-toast__close",
          icon: "app-toast__icon",
        },
      }}
    />
  )
}
