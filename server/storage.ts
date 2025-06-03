import {
  users,
  dnaProfiles,
  sermons,
  passwordResetTokens,
  type User,
  type InsertUser,
  type DnaProfile,
  type InsertDnaProfile,
  type Sermon,
  type InsertSermon,
  type PasswordResetToken,
  type InsertPasswordResetToken,
} from "@shared/schema";
import { db } from "./db";
import { eq, desc } from "drizzle-orm";

export interface IStorage {
  // User operations
  getUser(id: number): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: number, updates: Partial<User>): Promise<User | undefined>;
  upsertUser(user: any): Promise<User>;

  // DNA Profile operations
  getDnaProfile(id: number): Promise<DnaProfile | undefined>;
  getDnaProfilesByUserId(userId: number): Promise<DnaProfile[]>;
  getActiveDnaProfile(userId: number): Promise<DnaProfile | undefined>;
  createDnaProfile(dnaProfile: InsertDnaProfile): Promise<DnaProfile>;
  updateDnaProfile(id: number, updates: Partial<DnaProfile>): Promise<DnaProfile | undefined>;

  // Sermon operations
  getSermon(id: number): Promise<Sermon | undefined>;
  getSermonsByUserId(userId: number): Promise<Sermon[]>;
  createSermon(sermon: InsertSermon): Promise<Sermon>;
  updateSermon(id: number, updates: Partial<Sermon>): Promise<Sermon | undefined>;
  deleteSermon(id: number): Promise<void>;

  // Password reset operations
  createPasswordResetToken(token: InsertPasswordResetToken): Promise<PasswordResetToken>;
  getPasswordResetToken(token: string): Promise<PasswordResetToken | undefined>;
  markPasswordResetTokenUsed(id: number): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  // User operations
  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(insertUser)
      .returning();
    
    // Create a default DNA profile for the new user
    await this.createDnaProfile({
      userId: user.id,
      type: "padrao",
      customAttributes: {
        estilo_pregacao: "Equilibrado e pastoral",
        tom_predominante: "Inspirador e acolhedor",
        estrutura_preferida: "Introdução, desenvolvimento em 3 pontos, conclusão prática",
        temas_recorrentes: ["Graça", "Amor", "Esperança", "Transformação"]
      },
      uploadedFiles: [],
      pastedTexts: [],
      youtubeLinks: []
    });

    return user;
  }

  async updateUser(id: number, updates: Partial<User>): Promise<User | undefined> {
    const [user] = await db
      .update(users)
      .set(updates)
      .where(eq(users.id, id))
      .returning();
    return user;
  }

  // DNA Profile operations
  async getDnaProfile(id: number): Promise<DnaProfile | undefined> {
    const [profile] = await db.select().from(dnaProfiles).where(eq(dnaProfiles.id, id));
    return profile;
  }

  async getDnaProfilesByUserId(userId: number): Promise<DnaProfile[]> {
    return await db.select().from(dnaProfiles).where(eq(dnaProfiles.userId, userId)).orderBy(desc(dnaProfiles.createdAt));
  }

  async getActiveDnaProfile(userId: number): Promise<DnaProfile | undefined> {
    // Get the user's active DNA profile ID
    const [user] = await db.select().from(users).where(eq(users.id, userId));
    if (!user?.activeDnaProfileId) {
      // If no active profile, get the most recent one
      const [profile] = await db.select().from(dnaProfiles).where(eq(dnaProfiles.userId, userId)).orderBy(desc(dnaProfiles.createdAt)).limit(1);
      return profile;
    }
    
    const [profile] = await db.select().from(dnaProfiles).where(eq(dnaProfiles.id, user.activeDnaProfileId));
    return profile;
  }

  async createDnaProfile(insertDnaProfile: InsertDnaProfile): Promise<DnaProfile> {
    const [profile] = await db
      .insert(dnaProfiles)
      .values(insertDnaProfile)
      .returning();
    return profile;
  }

  async updateDnaProfile(id: number, updates: Partial<DnaProfile>): Promise<DnaProfile | undefined> {
    const [profile] = await db
      .update(dnaProfiles)
      .set(updates)
      .where(eq(dnaProfiles.id, id))
      .returning();
    return profile;
  }

  // Sermon operations
  async getSermon(id: number): Promise<Sermon | undefined> {
    const [sermon] = await db.select().from(sermons).where(eq(sermons.id, id));
    return sermon;
  }

  async getSermonsByUserId(userId: number): Promise<Sermon[]> {
    return await db.select().from(sermons).where(eq(sermons.userId, userId)).orderBy(desc(sermons.createdAt));
  }

  async createSermon(insertSermon: InsertSermon): Promise<Sermon> {
    const [sermon] = await db
      .insert(sermons)
      .values(insertSermon)
      .returning();
    return sermon;
  }

  async updateSermon(id: number, updates: Partial<Sermon>): Promise<Sermon | undefined> {
    const [sermon] = await db
      .update(sermons)
      .set(updates)
      .where(eq(sermons.id, id))
      .returning();
    return sermon;
  }

  async deleteSermon(id: number): Promise<void> {
    await db.delete(sermons).where(eq(sermons.id, id));
  }

  // Password reset operations
  async createPasswordResetToken(insertToken: InsertPasswordResetToken): Promise<PasswordResetToken> {
    const [token] = await db
      .insert(passwordResetTokens)
      .values(insertToken)
      .returning();
    return token;
  }

  async getPasswordResetToken(token: string): Promise<PasswordResetToken | undefined> {
    const [resetToken] = await db.select().from(passwordResetTokens).where(eq(passwordResetTokens.token, token));
    return resetToken;
  }

  async markPasswordResetTokenUsed(id: number): Promise<void> {
    await db
      .update(passwordResetTokens)
      .set({ used: true })
      .where(eq(passwordResetTokens.id, id));
  }

  async upsertUser(userData: any): Promise<User> {
    const [user] = await db
      .insert(users)
      .values({
        id: parseInt(userData.id),
        email: userData.email,
        name: userData.firstName || userData.lastName ? `${userData.firstName || ''} ${userData.lastName || ''}`.trim() : userData.email,
      })
      .onConflictDoUpdate({
        target: users.id,
        set: {
          email: userData.email,
          name: userData.firstName || userData.lastName ? `${userData.firstName || ''} ${userData.lastName || ''}`.trim() : userData.email,
        },
      })
      .returning();
    return user;
  }
}

export const storage = new DatabaseStorage();