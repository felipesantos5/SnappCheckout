// src/components/forms/ImageUpload.tsx
import { useState, useId } from "react"; // 1. Importe o useId
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
  const [isDragging, setIsDragging] = useState(false);
  const { token } = useAuth();

  // 2. Gere um ID único para esta instância do componente
  const uniqueId = useId();

  const uploadFile = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast.error("Por favor, envie apenas imagens.");
      return;
    }

    setIsUploading(true);

    const formData = new FormData();
    formData.append("image", file);

    try {
      const response = await axios.post(`${API_URL}/upload`, formData, {
        headers: {
          "Content-Type": "multipart/form-data",
          Authorization: `Bearer ${token}`,
        },
      });

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

  const handleUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    await uploadFile(file);
  };

  // Drag and Drop handlers
  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDragEnter = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const file = e.dataTransfer.files?.[0];
    if (!file) return;

    await uploadFile(file);
  };

  const handleRemove = () => {
    onChange("");
  };

  return (
    <div className="w-full">
      {value ? (
        <div className="relative w-full h-40 rounded-md border-dashed border-2 p-2">
          <img src={value} alt="Preview" className="w-full h-full object-contain rounded-md" />
          <Button type="button" variant="destructive" size="icon" className="absolute top-2 right-2 h-6 w-6" onClick={handleRemove}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      ) : (
        <div
          className={`w-full h-40 rounded-md border-dashed border-2 flex items-center justify-center p-4 transition-colors ${
            isDragging ? "border-primary bg-primary/5" : "border-muted-foreground/25"
          }`}
          onDragOver={handleDragOver}
          onDragEnter={handleDragEnter}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          {isUploading ? (
            <div className="flex flex-col items-center gap-2">
              <Loader2 className="h-8 w-8 animate-spin" />
              <p className="text-sm text-muted-foreground">Enviando...</p>
            </div>
          ) : (
            // 3. Use o ID único aqui no htmlFor
            <label htmlFor={uniqueId} className="flex flex-col items-center gap-2 cursor-pointer w-full h-full justify-center">
              <Upload className={`h-8 w-8 ${isDragging ? "text-primary" : "text-muted-foreground"}`} />
              <p className={`text-sm ${isDragging ? "text-primary font-medium" : "text-muted-foreground"}`}>
                {isDragging ? "Solte a imagem aqui" : "Clique ou arraste para enviar"}
              </p>
              {/* 4. Use o ID único aqui no id do input */}
              <Input id={uniqueId} type="file" className="sr-only" onChange={handleUpload} accept="image/png, image/jpeg, image/webp" />
            </label>
          )}
        </div>
      )}
    </div>
  );
}
