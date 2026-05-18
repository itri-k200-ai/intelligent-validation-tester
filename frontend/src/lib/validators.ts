import { z } from "zod";

export const loginSchema = z.object({
  identifier: z.string().min(1, "請輸入帳號或 Email"),
  password: z.string().min(1, "請輸入密碼"),
});

export type LoginInput = z.infer<typeof loginSchema>;

export const dutInputSchema = z.object({
  site: z.string().uuid(),
  name: z.string().min(1),
  type: z.enum(["SMO", "Near-RT RIC", "Non-RT RIC", "xApp", "rApp"]),
  endpoint: z.string().url(),
  category: z.enum(["underground", "ground-floor", "high-floor"]),
  interfaces: z.array(z.enum(["O1", "A1", "E2"])),
});

export type DutInput = z.infer<typeof dutInputSchema>;
