import { useEffect, useRef } from "react";

// Declaração global do fbq para TypeScript
declare global {
  interface Window {
    fbq: any;
    _fbq: any;
  }
}

/**
 * Gera um ID único para a sessão de checkout
 * Usado para deduplicação de eventos entre Pixel e CAPI
 */
const generateEventId = (): string => {
  return `${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
};

/**
 * Hook para carregar múltiplos Facebook Pixels dinamicamente
 * Carrega o script SOMENTE se houver pelo menos um pixelId
 *
 * @param pixelIds - Array de IDs dos pixels do Facebook ou um único ID (opcional)
 * @returns Funções para disparar eventos manualmente com event_id
 */
export const useFacebookPixel = (pixelIds?: string | string[]) => {
  const isInitialized = useRef(false);
  const initializedPixels = useRef<Set<string>>(new Set());

  useEffect(() => {
    // Normaliza para array
    const pixels = pixelIds
      ? (Array.isArray(pixelIds) ? pixelIds : [pixelIds]).filter(id => id && id.trim() !== "")
      : [];

    // Se não tiver pixels, não faz nada
    if (pixels.length === 0) {
      return;
    }

    // Injeta o script base do Facebook Pixel (uma única vez)
    if (!isInitialized.current) {
      console.log(`🔵 Inicializando Facebook Pixel Base Script`);

      (function (f: any, b: any, e: any, v: any, n?: any, t?: any, s?: any) {
        if (f.fbq) return;
        n = f.fbq = function () {
          n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments);
        };
        if (!f._fbq) f._fbq = n;
        n.push = n;
        n.loaded = !0;
        n.version = "2.0";
        n.queue = [];
        t = b.createElement(e);
        t.async = !0;
        t.src = v;
        s = b.getElementsByTagName(e)[0];
        s.parentNode.insertBefore(t, s);
      })(window, document, "script", "https://connect.facebook.net/en_US/fbevents.js");

      isInitialized.current = true;
    }

    // Inicializa cada pixel que ainda não foi inicializado
    pixels.forEach((pixelId) => {
      if (!initializedPixels.current.has(pixelId)) {
        console.log(`🔵 Inicializando Facebook Pixel: ${pixelId}`);
        window.fbq("init", pixelId);
        initializedPixels.current.add(pixelId);
      }
    });

    // Dispara o PageView automaticamente (será enviado para todos os pixels)
    window.fbq("track", "PageView");
    console.log(`✅ Facebook Pixel(s) carregado(s): ${pixels.join(", ")} - PageView disparado`);
  }, [pixelIds]);

  // Retorna funções helper para disparar eventos manualmente com event_id
  // IMPORTANTE: Quando múltiplos pixels estão inicializados, os eventos são enviados para TODOS
  return {
    trackEvent: (eventName: string, data?: any, eventId?: string) => {
      if (window.fbq && initializedPixels.current.size > 0) {
        const finalEventId = eventId || generateEventId();
        window.fbq("track", eventName, data, { eventID: finalEventId });
        console.log(`🔵 Facebook Event: ${eventName} [eventID: ${finalEventId}] para ${initializedPixels.current.size} pixel(s)`, data);
        return finalEventId;
      }
      return null;
    },
    trackCustomEvent: (eventName: string, data?: any, eventId?: string) => {
      if (window.fbq && initializedPixels.current.size > 0) {
        const finalEventId = eventId || generateEventId();
        window.fbq("trackCustom", eventName, data, { eventID: finalEventId });
        console.log(`🔵 Facebook Custom Event: ${eventName} [eventID: ${finalEventId}] para ${initializedPixels.current.size} pixel(s)`, data);
        return finalEventId;
      }
      return null;
    },
    generateEventId, // Expõe a função para uso externo
  };
};
