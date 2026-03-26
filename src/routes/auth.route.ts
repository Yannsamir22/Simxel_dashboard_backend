import { Router } from "express";
import { AuthController } from "../controllers/auth.controller.js";
import { requireOwner } from "../middlewares/auth.middleware.js";

const router = Router();

router.post("/register",  AuthController.register);
router.post("/login",     AuthController.login);
router.get ("/me",        requireOwner, AuthController.getMe as any);
router.put ("/password",  requireOwner, AuthController.changePassword as any);

export default router;
