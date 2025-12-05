import { Router } from "express";
import { getSettings, updateSettings } from "../controllers/settings.controller";
import { protectRoute } from "../middleware/auth.middleware";

const router = Router();

router.get("/", protectRoute, getSettings);
router.put("/", protectRoute, updateSettings);

export default router;
