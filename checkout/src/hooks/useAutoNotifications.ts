// src/hooks/useAutoNotifications.ts
import { useEffect, useRef } from 'react';

interface AutoNotificationsConfig {
  enabled: boolean;
  genderFilter: 'all' | 'male' | 'female';
  region: 'pt' | 'en' | 'es' | 'fr';
  intervalSeconds?: number;
  soundEnabled?: boolean;
}

interface UseAutoNotificationsProps {
  config?: AutoNotificationsConfig;
  productName: string;
}

// Função segura para tocar som - nunca lança exceção
const playNotificationSound = (): void => {
  try {
    if (typeof window === 'undefined') return;
    
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    
    const audioContext = new AudioContextClass();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    oscillator.frequency.value = 880;
    oscillator.type = 'sine';
    
    gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);

    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.3);
  } catch {
    // Silenciosamente ignora qualquer erro de áudio
  }
};

// Nomes fallback caso o import dinâmico falhe
const FALLBACK_NAMES = ['João', 'Maria', 'Pedro', 'Ana', 'Lucas', 'Julia', 'Gabriel', 'Beatriz'];

/**
 * Hook que gerencia notificações automáticas de prova social
 * IMPORTANTE: Este hook NUNCA deve quebrar a aplicação principal
 */
export function useAutoNotifications({ config, productName }: UseAutoNotificationsProps): void {
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const usedNamesRef = useRef<Set<string>>(new Set());
  const namesRef = useRef<string[] | null>(null);

  useEffect(() => {
    // Guard clauses - validação rigorosa antes de fazer qualquer coisa
    try {
      // Verifica se está no browser
      if (typeof window === 'undefined') return;
      
      // Verifica se config existe e está habilitado
      if (!config || config.enabled !== true) return;
      
      // Verifica se temos um productName válido
      if (!productName || typeof productName !== 'string') return;

      // Carrega os nomes de forma assíncrona e segura
      const loadNames = async (): Promise<string[]> => {
        try {
          const { notificationNames } = await import('../data/notificationNames');
          
          if (!notificationNames) return FALLBACK_NAMES;
          
          const region = config.region || 'pt';
          const regionData = notificationNames[region];
          
          if (!regionData) return FALLBACK_NAMES;
          
          const genderFilter = config.genderFilter || 'all';
          let names: string[] = [];
          
          if (genderFilter === 'all') {
            names = [
              ...(regionData.male || []),
              ...(regionData.female || [])
            ];
          } else if (genderFilter === 'male') {
            names = regionData.male || [];
          } else {
            names = regionData.female || [];
          }
          
          return names.length > 0 ? names : FALLBACK_NAMES;
        } catch {
          return FALLBACK_NAMES;
        }
      };

      // Função segura para obter nome aleatório
      const getRandomName = (): string => {
        try {
          const names = namesRef.current || FALLBACK_NAMES;
          if (!names || names.length === 0) return 'Cliente';
          
          const unusedNames = names.filter(name => !usedNamesRef.current.has(name));
          
          if (unusedNames.length === 0) {
            usedNamesRef.current.clear();
            return names[Math.floor(Math.random() * names.length)] || 'Cliente';
          }

          const randomName = unusedNames[Math.floor(Math.random() * unusedNames.length)];
          usedNamesRef.current.add(randomName);
          
          if (usedNamesRef.current.size > 20) {
            const firstValue = usedNamesRef.current.values().next().value;
            if (firstValue) usedNamesRef.current.delete(firstValue);
          }

          return randomName || 'Cliente';
        } catch {
          return 'Cliente';
        }
      };

      // Função segura para mostrar notificação
      const showNotification = async (): Promise<void> => {
        try {
          // Import dinâmico do toast para evitar problemas de inicialização
          const { toast } = await import('sonner');
          
          if (!toast || typeof toast.success !== 'function') return;
          
          const name = getRandomName();
          const safeName = typeof name === 'string' ? name : 'Cliente';
          const safeProduct = typeof productName === 'string' ? productName : 'produto';
          const message = `${safeName} acabou de garantir o ${safeProduct}`;
          
          // Toca som se habilitado
          if (config.soundEnabled === true) {
            playNotificationSound();
          }

          // Detecta desktop de forma segura
          let isDesktop = false;
          try {
            isDesktop = window.innerWidth >= 768;
          } catch {
            isDesktop = false;
          }

          toast.success(message, {
            duration: 3000,
            position: isDesktop ? 'bottom-right' : 'top-right',
            style: {
              background: '#10B981',
              color: '#FFFFFF',
              border: 'none',
            },
            icon: '🎉',
          });
        } catch {
          // Silenciosamente ignora erros de notificação
        }
      };

      // Configura o intervalo de forma segura
      const intervalSeconds = config.intervalSeconds;
      const intervalMs = (typeof intervalSeconds === 'number' && intervalSeconds > 0) 
        ? intervalSeconds * 1000 
        : 10000;

      // Inicializa os nomes e começa as notificações
      let initialTimeout: ReturnType<typeof setTimeout> | null = null;
      
      loadNames().then(names => {
        namesRef.current = names;
        
        initialTimeout = setTimeout(() => {
          showNotification();
          intervalRef.current = setInterval(showNotification, intervalMs);
        }, 5000);
      }).catch(() => {
        // Se falhar ao carregar nomes, usa fallback
        namesRef.current = FALLBACK_NAMES;
      });

      // Cleanup
      return () => {
        try {
          if (initialTimeout) clearTimeout(initialTimeout);
          if (intervalRef.current) clearInterval(intervalRef.current);
        } catch {
          // Ignora erros de cleanup
        }
      };
    } catch {
      // Se qualquer coisa falhar, retorna sem fazer nada
      return;
    }
  }, [config?.enabled, config?.genderFilter, config?.region, config?.intervalSeconds, config?.soundEnabled, productName]);
}

