// src/components/ui/Toaster.tsx
import { Toaster as SonnerToaster } from 'sonner';

/**
 * Componente Toaster para notificações
 * Wrapper do Sonner com configurações padrão
 */
export function Toaster() {
  return (
    <SonnerToaster
      position="top-right"
      toastOptions={{
        style: {
          fontFamily: 'inherit',
        },
      }}
      richColors
      closeButton
    />
  );
}
