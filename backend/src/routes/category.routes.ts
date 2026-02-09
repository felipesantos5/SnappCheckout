// src/routes/category.routes.ts
import { Router } from "express";
import * as categoryController from "../controllers/category.controller";
import { protectRoute } from "../middleware/auth.middleware";

const router = Router();

router.get("/", protectRoute, categoryController.listCategories);
router.post("/", protectRoute, categoryController.createCategory);
router.put("/:id", protectRoute, categoryController.updateCategory);
router.delete("/:id", protectRoute, categoryController.deleteCategory);
router.post("/reorder", protectRoute, categoryController.reorderCategories);

export default router;
