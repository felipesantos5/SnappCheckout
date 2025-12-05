import { Router } from "express";
import * as paypalController from "../controllers/paypal.controller";

const router = Router();

router.post("/create-order", paypalController.createOrder);
router.post("/capture-order", paypalController.captureOrder);

export default router;
