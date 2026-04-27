// src/controllers/upload.controller.ts
import { Request, Response } from "express";
import cloudinary from "../lib/cloudinary"; // Importe o SDK configurado
import streamifier from "streamifier"; // Para converter o buffer em stream

/**
 * Função auxiliar para fazer upload de um buffer (arquivo na memória)
 * para o Cloudinary.
 */
const uploadFromBuffer = (fileBuffer: Buffer, options: object): Promise<any> => {
  return new Promise((resolve, reject) => {
    // 1. Cria um stream de upload para o Cloudinary
    const uploadStream = cloudinary.uploader.upload_stream(options, (error, result) => {
      if (error) {
        return reject(error); // Rejeita a promise se houver erro
      }
      resolve(result); // Resolve com os dados do upload (incluindo a URL)
    });

    // 2. Converte o buffer do arquivo (da memória) em um stream legível
    // 3. 'Pipa' (envia) o stream do arquivo para o stream do Cloudinary
    streamifier.createReadStream(fileBuffer).pipe(uploadStream);
  });
};

export const handleUploadPdf = async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: { message: "Nenhum arquivo enviado." } });
    }

    const uploadOptions = {
      folder: "checkout_plataforma/pdfs",
      public_id: `${Date.now()}-${req.file.originalname.replace(/\.pdf$/i, "")}`,
      resource_type: "raw" as const,
    };

    const uploadResult = await uploadFromBuffer(req.file.buffer, uploadOptions);

    if (!uploadResult?.secure_url) {
      throw new Error("Falha ao obter a URL segura do Cloudinary.");
    }

    // Força download ao inserir fl_attachment na URL
    const downloadUrl = uploadResult.secure_url.replace("/upload/", "/upload/fl_attachment/");

    res.status(201).json({ pdfUrl: downloadUrl });
  } catch (error) {
    console.error("Erro no upload de PDF para Cloudinary:", error);
    res.status(500).json({ error: { message: "Falha no upload do PDF." } });
  }
};

/**
 * Controller para lidar com o upload de uma única imagem
 */
export const handleUploadImage = async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: { message: "Nenhum arquivo enviado." } });
    }

    // 1. Defina as opções de upload para o Cloudinary
    const uploadOptions = {
      folder: "checkout_plataforma", // Nome da pasta no Cloudinary
      // Gera um ID público único
      public_id: `${Date.now()}-${req.file.originalname.split(".")[0]}`,
      resource_type: "image" as const, // Garante que é uma imagem
    };

    // 2. Chame nossa função de upload com o buffer do arquivo
    const uploadResult = await uploadFromBuffer(req.file.buffer, uploadOptions);

    if (!uploadResult?.secure_url) {
      throw new Error("Falha ao obter a URL segura do Cloudinary.");
    }

    // 3. Retorne a URL segura (https) para o frontend
    res.status(201).json({ imageUrl: uploadResult.secure_url });
  } catch (error) {
    console.error("Erro no upload para Cloudinary:", error);
    res.status(500).json({ error: { message: "Falha no upload da imagem." } });
  }
};
