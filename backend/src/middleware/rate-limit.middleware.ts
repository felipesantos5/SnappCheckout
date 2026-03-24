import rateLimit from "express-rate-limit";

// Rate limiter mais restritivo para endpoints de autenticação
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 10, // Limite de 5 tentativas de login
  message: "Too many login attempts, please try again after 15 minutes.",
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true, // Não conta requisições bem-sucedidas
});

// Rate limiter para criação de pagamentos
export const paymentLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minuto
  max: 10, // 10 tentativas de pagamento por minuto
  message: "Too many payment requests, please try again later.",
  standardHeaders: true,
  legacyHeaders: false,
});

// Rate limiter para upload de arquivos
export const uploadLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minuto
  max: 10, // 10 uploads por minuto
  message: "Too many upload requests, please try again later.",
  standardHeaders: true,
  legacyHeaders: false,
});

// Rate limiter para criação de recursos (offers, products, etc)
export const createResourceLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minuto
  max: 20, // 20 criações por minuto
  message: "Too many resource creation requests, please slow down.",
  standardHeaders: true,
  legacyHeaders: false,
});
