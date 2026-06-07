import { z } from "zod";

const optionalText = z.preprocess(
  (value) => (typeof value === "string" && value.trim() ? value.trim() : undefined),
  z.string().max(180).optional(),
);

export const directoryUserSchema = z.object({
  userId: z.string().trim().min(1).max(180).optional(),
  name: z.string().trim().min(2, "Full name is required.").max(180),
  staffNumber: optionalText,
  email: z.email("Enter a valid email address.").transform((email) => email.toLowerCase()),
  phoneNumber: optionalText,
  department: optionalText,
  jobTitle: optionalText,
});

export function formDataObject(formData: FormData) {
  return Object.fromEntries(formData.entries());
}

export function parseFormData<T>(schema: z.ZodType<T>, formData: FormData): T {
  const result = schema.safeParse(formDataObject(formData));

  if (!result.success) {
    throw new Error(result.error.issues[0]?.message ?? "Submitted values are invalid.");
  }

  return result.data;
}
