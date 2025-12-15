// src/hooks/useAutoNotifications.ts
import { useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { notificationNames, type Region } from '../data/notificationNames';

interface AutoNotificationsConfig {
  enabled: boolean;
  genderFilter: 'all' | 'male' | 'female';
  region: Region;
  intervalSeconds?: number;
  soundEnabled?: boolean;
}

interface UseAutoNotificationsProps {
  config?: AutoNotificationsConfig;
  productName: string;
}

// Função para tocar um som de notificação usando Web Audio API
const playNotificationSound = () => {
  try {
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    oscillator.frequency.value = 880; // Frequência em Hz (nota A5)
    oscillator.type = 'sine';
    
    gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);

    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.3);
  } catch (error) {
    // Ignora erros de áudio (ex: usuário não interagiu ainda)
    console.log('Áudio não disponível:', error);
  }
};

/**
 * Hook que gerencia notificações automáticas de prova social
 * Exibe toasts com intervalos personalizáveis e som opcional
 */
export function useAutoNotifications({ config, productName }: UseAutoNotificationsProps) {
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const usedNamesRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    // Se não está habilitado, não faz nada
    if (!config?.enabled) {
      return;
    }

    // Usa o intervalo configurado ou 10 segundos como padrão
    const intervalMs = (config.intervalSeconds || 10) * 1000;
    const soundEnabled = config.soundEnabled === true; // Só toca som se explicitamente true

    // Função para obter um nome aleatório
    const getRandomName = (): string => {
      const { genderFilter, region } = config;
      
      let availableNames: string[] = [];
      
      if (genderFilter === 'all') {
        availableNames = [
          ...notificationNames[region].male,
          ...notificationNames[region].female
        ];
      } else if (genderFilter === 'male') {
        availableNames = notificationNames[region].male;
      } else {
        availableNames = notificationNames[region].female;
      }

      // Filtra nomes já usados para evitar repetições seguidas
      const unusedNames = availableNames.filter(name => !usedNamesRef.current.has(name));
      
      // Se todos os nomes foram usados, limpa o set
      if (unusedNames.length === 0) {
        usedNamesRef.current.clear();
        return availableNames[Math.floor(Math.random() * availableNames.length)];
      }

      const randomName = unusedNames[Math.floor(Math.random() * unusedNames.length)];
      usedNamesRef.current.add(randomName);
      
      // Mantém apenas os últimos 20 nomes usados
      if (usedNamesRef.current.size > 20) {
        const firstValue = usedNamesRef.current.values().next().value;
        if (firstValue) {
          usedNamesRef.current.delete(firstValue);
        }
      }

      return randomName;
    };

    // Função para mostrar o toast
    const showNotification = () => {
      const name = getRandomName();
      const message = `${name} acabou de garantir o ${productName}`;
      
      // Toca som se habilitado
      if (soundEnabled) {
        playNotificationSound();
      }

      // Detecta se é desktop (largura > 768px)
      const isDesktop = window.innerWidth >= 768;

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
    };

    // Mostra a primeira notificação após 5 segundos
    const initialTimeout = setTimeout(() => {
      showNotification();
      
      // Depois continua com o intervalo configurado
      intervalRef.current = setInterval(showNotification, intervalMs);
    }, 5000);

    // Cleanup
    return () => {
      clearTimeout(initialTimeout);
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [config?.enabled, config?.genderFilter, config?.region, config?.intervalSeconds, config?.soundEnabled, productName]);
}
