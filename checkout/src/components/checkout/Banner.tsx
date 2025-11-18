interface BannerProps {
  imageUrl?: string;
}

export const Banner: React.FC<BannerProps> = ({ imageUrl }) => {
  if (!imageUrl) {
    return null;
  }
  return <img src={imageUrl} alt="Banner da oferta" className="w-full rounded-t-xl max-w-lg mx-auto" />;
};
