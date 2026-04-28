import { Router } from "express";
import { protectRoute } from "../middleware/auth.middleware";
import { getEmailLogs, getEmailLogHtml } from "../controllers/email-log.controller";

const router = Router();

router.get("/", protectRoute, getEmailLogs);
router.get("/:id/html", protectRoute, getEmailLogHtml);

export default router;
