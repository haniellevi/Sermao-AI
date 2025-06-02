import { pgTable, text, serial, integer, boolean, timestamp, jsonb, varchar, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Session storage table for authentication
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)],
);

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),
  name: text("name").notNull(),
  activeDnaProfileId: integer("active_dna_profile_id"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const dnaProfiles = pgTable("dna_profiles", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  type: text("type").notNull(), // "padrao" or "customizado"
  customAttributes: jsonb("custom_attributes"), // JSON string for AI-generated DNA characteristics
  uploadedFiles: jsonb("uploaded_files"), // Array of file metadata
  pastedTexts: jsonb("pasted_texts"), // Array of sermon texts
  youtubeLinks: jsonb("youtube_links"), // Array of YouTube URLs
  content: text("content"), // JSON string with all input data including personal description
  createdAt: timestamp("created_at").defaultNow(),
});

export const sermons = pgTable("sermons", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  dnaProfileId: integer("dna_profile_id").references(() => dnaProfiles.id),
  title: text("title").notNull(),
  content: text("content").notNull(),
  parameters: jsonb("parameters"), // JSON of generation parameters
  qualityScore: integer("quality_score"),
  suggestions: jsonb("suggestions"), // Array of enhancement suggestions
  createdAt: timestamp("created_at").defaultNow(),
});

export const passwordResetTokens = pgTable("password_reset_tokens", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  token: text("token").notNull().unique(),
  expiresAt: timestamp("expires_at").notNull(),
  used: boolean("used").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

// Insert schemas with password validation
export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
  activeDnaProfileId: true,
}).extend({
  password: z.string()
    .min(6, "A senha deve ter pelo menos 6 caracteres")
    .regex(/[0-9]/, "A senha deve conter pelo menos um número")
    .regex(/[^a-zA-Z0-9]/, "A senha deve conter pelo menos um caractere especial"),
  confirmPassword: z.string().min(1, "Confirmação de senha é obrigatória")
}).refine((data) => data.password === data.confirmPassword, {
  message: "As senhas não coincidem",
  path: ["confirmPassword"],
});

export const insertDnaProfileSchema = createInsertSchema(dnaProfiles).omit({
  id: true,
  createdAt: true,
});

export const insertSermonSchema = createInsertSchema(sermons).omit({
  id: true,
  createdAt: true,
});

export const insertPasswordResetTokenSchema = createInsertSchema(passwordResetTokens).omit({
  id: true,
  createdAt: true,
});

// Login schema
export const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});

// Password reset request schema
export const passwordResetRequestSchema = z.object({
  email: z.string().email("Invalid email address"),
});

// Password reset confirm schema
export const passwordResetConfirmSchema = z.object({
  token: z.string().min(1, "Token is required"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

// Sermon generation schema
export const generateSermonSchema = z.object({
  dnaType: z.enum(["padrao", "customizado"]),
  theme: z.string().optional(),
  purpose: z.string().optional(),
  audience: z.string().optional(),
  duration: z.string().optional(),
  style: z.string().optional(),
  context: z.string().optional(),
  referenceUrls: z.string().optional(),
});

// DNA creation schema - no required fields
export const createDnaSchema = z.object({
  uploadedFiles: z.array(z.object({
    name: z.string(),
    content: z.string(),
    type: z.string(),
  })).optional().default([]),
  pastedTexts: z.array(z.string()).optional().default([]),
  youtubeLinks: z.array(z.string()).optional().default([]),
  personalDescription: z.string().optional().default(""),
});

// Types
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type DnaProfile = typeof dnaProfiles.$inferSelect;
export type InsertDnaProfile = z.infer<typeof insertDnaProfileSchema>;
export type Sermon = typeof sermons.$inferSelect;
export type InsertSermon = z.infer<typeof insertSermonSchema>;
export type PasswordResetToken = typeof passwordResetTokens.$inferSelect;
export type InsertPasswordResetToken = z.infer<typeof insertPasswordResetTokenSchema>;

export type LoginRequest = z.infer<typeof loginSchema>;
export type PasswordResetRequest = z.infer<typeof passwordResetRequestSchema>;
export type PasswordResetConfirm = z.infer<typeof passwordResetConfirmSchema>;
export type GenerateSermonRequest = z.infer<typeof generateSermonSchema>;
export type CreateDnaRequest = z.infer<typeof createDnaSchema>;
