import { useState, memo } from "react";

interface OptimizedImageProps {
  src: string;
  alt: string;
  className?: string;
  width?: number;
  aspectRatio?: string;
  priority?: boolean; // Se true, não usa lazy loading
}

// Otimiza URL do Cloudinary
const optimizeCloudinaryUrl = (url: string, width?: number): string => {
  if (!url.includes("cloudinary.com")) return url;

  const parts = url.split("/upload/");
  if (parts.length === 2) {
    const transformations = [
      "f_auto", // Formato automático (webp quando suportado)
      "q_auto:good", // Qualidade automática otimizada
      width ? `w_${width}` : "w_400", // Largura padrão 400px
      "c_limit", // Não aumenta imagem menor
      "dpr_auto", // Device pixel ratio automático
    ].join(",");

    return `${parts[0]}/upload/${transformations}/${parts[1]}`;
  }
  return url;
};

export const OptimizedImage = memo<OptimizedImageProps>(({
  src,
  alt,
  className = "",
  width,
  aspectRatio,
  priority = false,
}) => {
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);

  if (!src || hasError) {
    return (
      <div
        className={`bg-gray-200 flex items-center justify-center ${className}`}
        style={aspectRatio ? { aspectRatio } : undefined}
      >
        <span className="text-gray-400 text-xs">Sem imagem</span>
      </div>
    );
  }

  const optimizedUrl = optimizeCloudinaryUrl(src, width);

  return (
    <div className={`relative ${className}`} style={aspectRatio ? { aspectRatio } : undefined}>
      {/* Skeleton placeholder enquanto carrega */}
      {!isLoaded && (
        <div className="absolute inset-0 bg-gradient-to-r from-gray-200 via-gray-300 to-gray-200 animate-pulse rounded" />
      )}

      <img
        src={optimizedUrl}
        alt={alt}
        className={`w-full h-full object-cover transition-opacity duration-300 rounded ${
          isLoaded ? "opacity-100" : "opacity-0"
        }`}
        loading={priority ? "eager" : "lazy"}
        decoding="async"
        onLoad={() => setIsLoaded(true)}
        onError={() => setHasError(true)}
      />
    </div>
  );
});

OptimizedImage.displayName = "OptimizedImage";
