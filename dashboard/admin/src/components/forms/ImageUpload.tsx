// src/components/forms/ImageUpload.tsx
import { useState } from "react";
import axios from "axios";
import { useAuth } from "@/context/AuthContext";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Upload, X, Loader2 } from "lucide-react";
import { API_URL } from "@/config/BackendUrl";

// Props que o FormField (shadcn) espera: value e onChange
interface ImageUploadProps {
  value?: string;
  onChange: (value: string) => void;
}

export function ImageUpload({ value, onChange }: ImageUploadProps) {
  const [isUploading, setIsUploading] = useState(false);
  const { token } = useAuth(); // Pega o token para autenticar o upload

  const handleUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsUploading(true);

    const formData = new FormData();
    formData.append("image", file); // 'image' é o nome do campo que o multer espera

    try {
      const response = await axios.post(`${API_URL}/upload`, formData, {
        headers: {
          "Content-Type": "multipart/form-data",
          // O Axios (configurado no AuthContext) já deve enviar o token,
          // mas podemos garantir:
          Authorization: `Bearer ${token}`,
        },
      });

      // Sucesso! Chama o onChange do formulário com a nova URL
      onChange(response.data.imageUrl);
      toast.success("Imagem enviada com sucesso!");
    } catch (error) {
      toast.error("Falha no upload da imagem.", {
        description: (error as any).response?.data?.error?.message || (error as Error).message,
      });
    } finally {
      setIsUploading(false);
    }
  };

  // Limpa a imagem (apenas limpa a URL no formulário)
  const handleRemove = () => {
    onChange("");
  };

  return (
    <div className="w-full">
      {value ? (
        // --- 1. Estado "Com Imagem" (Preview) ---
        <div className="relative w-full h-40 rounded-md border-dashed border-2 p-2">
          <img src={value} alt="Preview" className="w-full h-full object-contain rounded-md" />
          <Button type="button" variant="destructive" size="icon" className="absolute top-2 right-2 h-6 w-6" onClick={handleRemove}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      ) : (
        // --- 2. Estado "Sem Imagem" (Upload) ---
        <div className="w-full h-40 rounded-md border-dashed border-2 flex items-center justify-center p-4">
          {isUploading ? (
            <div className="flex flex-col items-center gap-2">
              <Loader2 className="h-8 w-8 animate-spin" />
              <p className="text-sm text-muted-foreground">Enviando...</p>
            </div>
          ) : (
            <label htmlFor="file-upload" className="flex flex-col items-center gap-2 cursor-pointer">
              <Upload className="h-8 w-8 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Clique ou arraste para enviar</p>
              <Input id="file-upload" type="file" className="sr-only" onChange={handleUpload} accept="image/png, image/jpeg, image/webp" />
            </label>
          )}
        </div>
      )}
    </div>
  );
}
