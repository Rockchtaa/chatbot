import rateLimit from "express-rate-limit";

export const chatLimiter = rateLimit({
  windowMs: 1000, // 1 minute
  max: 5,
  message: { error: "Zu viele Anfragen. Bitte warte kurz." },
  standardHeaders: true,
  legacyHeaders: false,
});
