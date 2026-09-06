import { Response } from "express";

export function notFound(res: Response, message: string) {
  res.status(404).json({ error: message });
}

export function badRequest(res: Response, message: string) {
  res.status(400).json({ error: message });
}
