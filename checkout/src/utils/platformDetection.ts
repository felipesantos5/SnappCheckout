/**
 * Utilitários simplificados para detecção de plataforma
 * A estratégia é deixar o Stripe decidir se Apple/Google Pay está disponível
 */

export type Platform = 'ios' | 'android' | 'desktop';

/**
 * Detecta o sistema operacional do usuário de forma simples
 */
export function detectPlatform(): Platform {
  const userAgent = navigator.userAgent || navigator.vendor || (window as any).opera;

  // Detecta iOS (iPhone, iPad, iPod)
  if (/iPad|iPhone|iPod/.test(userAgent) && !(window as any).MSStream) {
    return 'ios';
  }

  // Detecta Android
  if (/android/i.test(userAgent)) {
    return 'android';
  }

  // Tudo mais é desktop
  return 'desktop';
}

/**
 * Detecta se é um dispositivo móvel (iOS ou Android)
 * NÃO verifica se suporta carteiras - isso é responsabilidade do Stripe
 */
export function isMobile(): boolean {
  const platform = detectPlatform();
  return platform === 'ios' || platform === 'android';
}
