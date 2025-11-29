import { useState } from "react";
import { useImagePreload } from "../../hooks/useImagePreload";

interface BannerProps {
  imageUrl?: string;
  secondaryBannerImageUrl?: string;
}

// Otimiza URL do Cloudinary para carregar imagem menor e otimizada
const optimizeCloudinaryUrl = (url: string, width?: number): string => {
  if (!url.includes("cloudinary.com")) return url;

  // Insere transformações antes do upload path
  const parts = url.split("/upload/");
  if (parts.length === 2) {
    const w = width || 1200;
    // f_auto: formato automático (webp quando suportado)
    // q_auto:good: qualidade automática otimizada
    // w_xxx: largura responsiva
    // c_limit: não aumenta imagem menor
    // dpr_auto: pixel ratio automático para retina
    return `${parts[0]}/upload/f_auto,q_auto:good,w_${w},c_limit,dpr_auto/${parts[1]}`;
  }
  return url;
};

// Gera srcset para diferentes tamanhos de tela
const generateSrcSet = (url: string): string => {
  if (!url.includes("cloudinary.com")) return "";

  const sizes = [640, 768, 1024, 1280];
  return sizes.map((size) => `${optimizeCloudinaryUrl(url, size)} ${size}w`).join(", ");
};

export const Banner: React.FC<BannerProps> = ({ imageUrl, secondaryBannerImageUrl }) => {
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);

  // Preload da imagem do banner (crítico para LCP)
  const optimizedUrl = imageUrl ? optimizeCloudinaryUrl(imageUrl) : undefined;
  useImagePreload(optimizedUrl, true);

  const optimizedUrlSecondary = secondaryBannerImageUrl ? optimizeCloudinaryUrl(secondaryBannerImageUrl) : undefined;
  useImagePreload(optimizedUrlSecondary, true);

  if (!imageUrl || hasError) {
    return null;
  }

  const srcSet = generateSrcSet(imageUrl);
  const srcSetSecondary = secondaryBannerImageUrl ? generateSrcSet(secondaryBannerImageUrl) : "";

  return (
    <div className="lg:flex max-w-6xl mx-auto">
      <div className="relative w-full max-w-lg mx-auto overflow-hidden" style={{ aspectRatio: "16/9" }}>
        {/* Skeleton placeholder enquanto carrega */}
        {!isLoaded && <div className="absolute inset-0 bg-linear-to-r from-gray-200 via-gray-300 to-gray-200 animate-pulse" />}
        <img
          src={optimizedUrl}
          srcSet={srcSet || undefined}
          sizes="(max-width: 640px) 640px, (max-width: 768px) 768px, (max-width: 1024px) 1024px, 1280px"
          alt="Banner da oferta"
          className={`w-full h-full object-cover transition-opacity duration-150 ${isLoaded ? "opacity-100" : "opacity-0"}`}
          fetchPriority="high"
          loading="eager"
          decoding="async"
          onLoad={() => setIsLoaded(true)}
          onError={() => setHasError(true)}
        />
      </div>
      {secondaryBannerImageUrl && (
        <div className="relative w-full max-w-lg mx-auto overflow-hidden" style={{ aspectRatio: "16/9" }}>
          {/* Skeleton placeholder enquanto carrega */}
          {!isLoaded && <div className="absolute inset-0 bg-linear-to-r from-gray-200 via-gray-300 to-gray-200 animate-pulse" />}

          <img
            src={optimizedUrl}
            srcSet={srcSetSecondary || undefined}
            sizes="(max-width: 640px) 640px, (max-width: 768px) 768px, (max-width: 1024px) 1024px, 1280px"
            alt="Banner da oferta"
            className={`w-full h-full object-cover transition-opacity duration-150 ${isLoaded ? "opacity-100" : "opacity-0"}`}
            fetchPriority="high"
            loading="eager"
            decoding="async"
            onLoad={() => setIsLoaded(true)}
            onError={() => setHasError(true)}
          />
        </div>
      )}
    </div>
  );
};
