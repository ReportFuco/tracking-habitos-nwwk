"use client"

import { Toaster } from "sonner"

const TOAST_TOP = "calc(var(--app-header-h) + 0.5rem)"

export function AppToaster() {
  return (
    <Toaster
      position="top-center"
      closeButton
      // Debajo del header, nunca bajo la barra de estado: iOS 26 difumina lo que pasa por
      // esa franja y el aviso se leia borroso.
      offset={{ top: TOAST_TOP }}
      mobileOffset={{ top: TOAST_TOP }}
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
