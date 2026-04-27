// src/routes/upload.routes.ts
import { Router } from "express";
import * as uploadController from "../controllers/upload.controller";
import { protectRoute } from "../middleware/auth.middleware";
import { uploadLimiter } from "../middleware/rate-limit.middleware";
import upload, { uploadPdf } from "../middleware/upload.middleware";

const router = Router();

router.post(
  "/",
  protectRoute,
  uploadLimiter,
  upload.single("image"),
  uploadController.handleUploadImage
);

router.post(
  "/pdf",
  protectRoute,
  uploadLimiter,
  uploadPdf.single("pdf"),
  uploadController.handleUploadPdf
);

export default router;
