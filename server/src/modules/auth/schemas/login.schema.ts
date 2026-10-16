import { z } from "zod";

export const loginSchema = z
  .object({
    identifier: z.string().min(1, "Email, Employee ID, or Phone is required").optional(),
    email: z.string().min(1, "Email, Employee ID, or Phone is required").optional(),
    password: z.string().min(1, "Password is required"),
  })
  .refine((data) => Boolean(data.identifier?.trim() || data.email?.trim()), {
    message: "Email, Employee ID, or Phone is required",
    path: ["identifier"],
  });

export type LoginInput = {
  identifier?: string;
  email?: string;
  password: string;
};

export default loginSchema;
