import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET!;

export const protectSuperAdmin = (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Não autorizado." });
  }

  try {
    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, JWT_SECRET) as { role: string };

    if (decoded.role !== "superadmin") {
      return res.status(403).json({ error: "Acesso negado." });
    }

    next();
  } catch {
    return res.status(401).json({ error: "Token inválido." });
  }
};
