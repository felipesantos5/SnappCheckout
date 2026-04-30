import { Router } from "express";
import { protectRoute } from "../middleware/auth.middleware";
import {
  getIntegrationEventLogs,
  getIntegrationEventLogDetail,
} from "../controllers/integration-event-log.controller";

const router = Router();

router.get("/", protectRoute, getIntegrationEventLogs);
router.get("/:id", protectRoute, getIntegrationEventLogDetail);

export default router;
