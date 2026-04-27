// src/middleware/upload.middleware.ts
import multer, { FileFilterCallback } from "multer";
import { Request } from "express";

const imageFileFilter = (req: Request, file: Express.Multer.File, cb: FileFilterCallback) => {
  if (file.mimetype === "image/jpeg" || file.mimetype === "image/png" || file.mimetype === "image/webp") {
    cb(null, true);
  } else {
    cb(new Error("Formato de imagem inválido. Use apenas JPEG, PNG ou WebP."));
  }
};

const pdfFileFilter = (req: Request, file: Express.Multer.File, cb: FileFilterCallback) => {
  if (file.mimetype === "application/pdf") {
    cb(null, true);
  } else {
    cb(new Error("Formato inválido. Use apenas PDF."));
  }
};

const upload = multer({
  storage: multer.memoryStorage(),
  fileFilter: imageFileFilter,
  limits: { fileSize: 1024 * 1024 * 5 },
});

export const uploadPdf = multer({
  storage: multer.memoryStorage(),
  fileFilter: pdfFileFilter,
  limits: { fileSize: 1024 * 1024 * 20 }, // 20MB para PDFs
});

export default upload;
