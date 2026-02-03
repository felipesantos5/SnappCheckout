import { useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { CheckCircle } from "lucide-react";

const SuccessPage = () => {
  const [searchParams] = useSearchParams();
  const upsellLink = searchParams.get("upsellLink");

  // Se houver um link de upsell, redirecionar após 3 segundos
  useEffect(() => {
    if (upsellLink && (upsellLink.startsWith("http://") || upsellLink.startsWith("https://"))) {
      const timer = setTimeout(() => {
        window.location.href = upsellLink;
      }, 3000);

      return () => clearTimeout(timer);
    }
  }, [upsellLink]);

  return (
    <div className="min-h-screen bg-white flex items-center justify-center">
      <div className="bg-green-500 rounded-full p-6">
        <CheckCircle className="w-16 h-16 text-white" strokeWidth={2.5} />
      </div>
    </div>
  );
};

export default SuccessPage;
