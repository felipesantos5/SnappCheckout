import { useState, useId } from "react";
import axios from "axios";
import { useAuth } from "@/context/AuthContext";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { FileText, Upload, X, Loader2 } from "lucide-react";
import { API_URL } from "@/config/BackendUrl";

interface PdfUploadProps {
  value?: string;
  onChange: (value: string) => void;
}

export function PdfUpload({ value, onChange }: PdfUploadProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const { token } = useAuth();
  const uniqueId = useId();

  const uploadFile = async (file: File) => {
    if (file.type !== "application/pdf") {
      toast.error("Por favor, envie apenas arquivos PDF.");
      return;
    }

    setIsUploading(true);

    const formData = new FormData();
    formData.append("pdf", file);

    try {
      const response = await axios.post(`${API_URL}/upload/pdf`, formData, {
        headers: {
          "Content-Type": "multipart/form-data",
          Authorization: `Bearer ${token}`,
        },
      });

      onChange(response.data.pdfUrl);
      toast.success("PDF enviado com sucesso!");
    } catch (error) {
      toast.error("Falha no upload do PDF.", {
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

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => { e.preventDefault(); e.stopPropagation(); };
  const handleDragEnter = (e: React.DragEvent<HTMLDivElement>) => { e.preventDefault(); e.stopPropagation(); setIsDragging(true); };
  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => { e.preventDefault(); e.stopPropagation(); setIsDragging(false); };

  const handleDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    await uploadFile(file);
  };

  const getFileName = (url: string) => {
    try {
      const decoded = decodeURIComponent(url.split("/").pop() || "");
      return decoded.replace(/^\d+-/, "");
    } catch {
      return "arquivo.pdf";
    }
  };

  return (
    <div className="w-full">
      {value ? (
        <div className="flex items-center gap-3 p-3 rounded-md border border-dashed border-2 bg-muted/30">
          <FileText className="h-8 w-8 text-red-500 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{getFileName(value)}</p>
            <a href={value} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-500 hover:underline">
              Visualizar / Baixar
            </a>
          </div>
          <Button type="button" variant="destructive" size="icon" className="h-7 w-7 shrink-0" onClick={() => onChange("")}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      ) : (
        <div
          className={`w-full h-32 rounded-md border-dashed border-2 flex items-center justify-center p-4 transition-colors ${
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
              <p className="text-sm text-muted-foreground">Enviando PDF...</p>
            </div>
          ) : (
            <label htmlFor={uniqueId} className="flex flex-col items-center gap-2 cursor-pointer w-full h-full justify-center">
              <Upload className={`h-8 w-8 ${isDragging ? "text-primary" : "text-muted-foreground"}`} />
              <p className={`text-sm ${isDragging ? "text-primary font-medium" : "text-muted-foreground"}`}>
                {isDragging ? "Solte o PDF aqui" : "Clique ou arraste um PDF para enviar"}
              </p>
              <p className="text-xs text-muted-foreground">Máximo 20MB</p>
              <Input id={uniqueId} type="file" className="sr-only" onChange={handleUpload} accept="application/pdf" />
            </label>
          )}
        </div>
      )}
    </div>
  );
}
