import { z } from "zod";

export const recipeSchema = z.object({
  title: z.string().trim().min(1, "Title is required").max(300),
  description: z.string().trim().max(5000).optional().or(z.literal("")),
  imageUrl: z.string().trim().url().optional().or(z.literal("")),
  sourceImageUrl: z.string().trim().url().optional().or(z.literal("")),
  sourceUrl: z.string().trim().url().optional().or(z.literal("")),
  servings: z.string().trim().max(100).optional().or(z.literal("")),
  prepTime: z.string().trim().max(100).optional().or(z.literal("")),
  cookTime: z.string().trim().max(100).optional().or(z.literal("")),
  ingredients: z.array(z.string().trim().min(1)).default([]),
  instructions: z.array(z.string().trim().min(1)).default([]),
  tags: z.array(z.string().trim().min(1)).default([]),
  categories: z.array(z.string().trim().min(1)).default([]),
});

export type RecipeInput = z.infer<typeof recipeSchema>;

export const importSchema = z.object({
  url: z.string().trim().url("Enter a valid URL"),
});

// Crop rectangle (natural image pixels) posted by the scan importer when the
// user marks an "Image" region to store as the recipe photo.
export const scanCropSchema = z
  .object({
    x: z.coerce.number().int().nonnegative(),
    y: z.coerce.number().int().nonnegative(),
    w: z.coerce.number().int(),
    h: z.coerce.number().int(),
  })
  .refine((d) => d.w > 0 && d.h > 0, { message: "Crop region must have a positive size." });

export const loginSchema = z.object({
  email: z.string().trim().email("Enter a valid email"),
  password: z.string().min(1, "Password is required"),
});

export const registerSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(100),
  email: z.string().trim().email("Enter a valid email"),
  password: z.string().min(8, "Password must be at least 8 characters").max(200),
});

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().optional().or(z.literal("")),
    newPassword: z.string().min(8, "New password must be at least 8 characters").max(200),
    confirmPassword: z.string(),
  })
  .refine((d) => d.newPassword === d.confirmPassword, {
    message: "New passwords don't match",
    path: ["confirmPassword"],
  });
