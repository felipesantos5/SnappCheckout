/**
 * Detecta a plataforma do usuário para mostrar carteiras digitais apropriadas
 */

export type Platform = 'ios' | 'android' | 'desktop';
export type WalletType = 'applePay' | 'googlePay' | 'none';

/**
 * Detecta o sistema operacional do usuário
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

  // Detecta macOS (para Safari Desktop que pode ter Apple Pay)
  if (/Macintosh|Mac OS X/i.test(userAgent)) {
    // Safari no Mac pode ter Apple Pay se tiver Touch ID ou iPhone próximo
    return 'ios'; // Tratamos Mac como iOS para Apple Pay
  }

  // Desktop (Windows, Linux, etc.)
  return 'desktop';
}

/**
 * Determina qual carteira digital deve ser mostrada baseado na plataforma
 */
export function getPreferredWallet(): WalletType {
  const platform = detectPlatform();

  switch (platform) {
    case 'ios':
      return 'applePay';
    case 'android':
      return 'googlePay';
    case 'desktop':
      return 'none'; // Desktop geralmente não tem carteiras digitais
    default:
      return 'none';
  }
}

/**
 * Verifica se a plataforma suporta carteiras digitais
 */
export function shouldShowWallet(): boolean {
  const platform = detectPlatform();
  return platform === 'ios' || platform === 'android';
}

/**
 * Retorna o nome amigável da carteira para a plataforma
 */
export function getWalletLabel(platform?: Platform): string {
  const detectedPlatform = platform || detectPlatform();

  switch (detectedPlatform) {
    case 'ios':
      return 'Apple Pay';
    case 'android':
      return 'Google Pay';
    default:
      return 'Carteira Digital';
  }
}

/**
 * Detecta se é um dispositivo móvel
 */
export function isMobile(): boolean {
  return detectPlatform() !== 'desktop';
}

/**
 * Detecta se o navegador suporta Payment Request API
 */
export function supportsPaymentRequest(): boolean {
  return 'PaymentRequest' in window;
}
