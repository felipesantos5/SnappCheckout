import { useState } from "react";

interface BannerProps {
  imageUrl?: string;
}

// Otimiza URL do Cloudinary para carregar imagem menor e otimizada
const optimizeCloudinaryUrl = (url: string): string => {
  if (!url.includes("cloudinary.com")) return url;

  // Insere transformações antes do upload path
  const parts = url.split("/upload/");
  if (parts.length === 2) {
    // f_auto: formato automático (webp quando suportado)
    // q_auto: qualidade automática
    // w_800: largura máxima 800px (suficiente para mobile/tablet)
    // c_limit: não aumenta imagem menor
    return `${parts[0]}/upload/f_auto,q_auto,w_800,c_limit/${parts[1]}`;
  }
  return url;
};

export const Banner: React.FC<BannerProps> = ({ imageUrl }) => {
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);

  if (!imageUrl || hasError) {
    return null;
  }

  const optimizedUrl = optimizeCloudinaryUrl(imageUrl);

  return (
    <div className="relative w-full max-w-lg mx-auto overflow-hidden rounded-t-xl" style={{ aspectRatio: "16/9" }}>
      {/* Skeleton placeholder enquanto carrega */}
      {!isLoaded && (
        <div className="absolute inset-0 bg-gradient-to-r from-gray-200 via-gray-300 to-gray-200 animate-pulse" />
      )}

      <img
        src={optimizedUrl}
        alt="Banner da oferta"
        className={`w-full h-full object-cover transition-opacity duration-300 ${
          isLoaded ? "opacity-100" : "opacity-0"
        }`}
        loading="lazy"
        decoding="async"
        onLoad={() => setIsLoaded(true)}
        onError={() => setHasError(true)}
      />
    </div>
  );
};
