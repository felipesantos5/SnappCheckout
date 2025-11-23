import { useEffect } from "react";

/**
 * Hook para fazer preload de imagens críticas
 * Isso ajuda a reduzir o LCP (Largest Contentful Paint)
 */
export const useImagePreload = (imageUrl: string | undefined, priority: boolean = false) => {
  useEffect(() => {
    if (!imageUrl || !priority) return;

    // Cria um link tag para preload
    const link = document.createElement("link");
    link.rel = "preload";
    link.as = "image";
    link.href = imageUrl;

    // Para Cloudinary, sugere o formato WebP
    if (imageUrl.includes("cloudinary.com")) {
      link.type = "image/webp";
    }

    document.head.appendChild(link);

    // Cleanup
    return () => {
      document.head.removeChild(link);
    };
  }, [imageUrl, priority]);
};
