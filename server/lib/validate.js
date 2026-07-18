import { z } from "zod";

const DEFAULT_EXPIRY_HOURS = Number(process.env.DEFAULT_EXPIRY_HOURS ?? 24);
const MAX_EXPIRY_DAYS = Number(process.env.MAX_EXPIRY_DAYS ?? 30);

export function resolveExpiresAt(raw, now = new Date()) {
  if (raw == null || raw === "") {
    return new Date(now.getTime() + DEFAULT_EXPIRY_HOURS * 3600_000);
  }
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) throw new Error("Invalid expiry date");
  if (d <= now) throw new Error("Expiry must be in the future");
  const max = new Date(now.getTime() + MAX_EXPIRY_DAYS * 86_400_000);
  if (d > max) throw new Error(`Expiry cannot be more than ${MAX_EXPIRY_DAYS} days away`);
  return d;
}

export const sendSchema = z.object({
  slug: z.string().min(1),
  emailTo: z.string().email(),
  emailFrom: z.string().email(),
});
