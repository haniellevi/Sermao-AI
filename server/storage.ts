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
  type InsertPasswordResetToken
} from "@shared/schema";

export interface IStorage {
  // User operations
  getUser(id: number): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: number, updates: Partial<User>): Promise<User | undefined>;

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

  // Password reset operations
  createPasswordResetToken(token: InsertPasswordResetToken): Promise<PasswordResetToken>;
  getPasswordResetToken(token: string): Promise<PasswordResetToken | undefined>;
  markPasswordResetTokenUsed(id: number): Promise<void>;
}

export class MemStorage implements IStorage {
  private users: Map<number, User>;
  private dnaProfiles: Map<number, DnaProfile>;
  private sermons: Map<number, Sermon>;
  private passwordResetTokens: Map<number, PasswordResetToken>;
  private currentUserId: number;
  private currentDnaProfileId: number;
  private currentSermonId: number;
  private currentTokenId: number;

  constructor() {
    this.users = new Map();
    this.dnaProfiles = new Map();
    this.sermons = new Map();
    this.passwordResetTokens = new Map();
    this.currentUserId = 1;
    this.currentDnaProfileId = 1;
    this.currentSermonId = 1;
    this.currentTokenId = 1;
  }

  // User operations
  async getUser(id: number): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(user => user.email === email);
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = this.currentUserId++;
    const user: User = { 
      ...insertUser, 
      id, 
      activeDnaProfileId: null,
      createdAt: new Date()
    };
    this.users.set(id, user);

    // Create default DNA profile
    const defaultDna: DnaProfile = {
      id: this.currentDnaProfileId++,
      userId: id,
      type: "padrao",
      customAttributes: {
        style: "Equilibrado e pastoral",
        tone: "Inspirador e acolhedor", 
        structure: "Introdução, desenvolvimento em 3 pontos, conclusão prática",
        themes: ["Graça", "Amor", "Esperança", "Transformação"]
      },
      uploadedFiles: null,
      pastedTexts: null,
      youtubeLinks: null,
      createdAt: new Date()
    };
    this.dnaProfiles.set(defaultDna.id, defaultDna);

    // Update user's active DNA profile
    user.activeDnaProfileId = defaultDna.id;
    this.users.set(id, user);

    return user;
  }

  async updateUser(id: number, updates: Partial<User>): Promise<User | undefined> {
    const user = this.users.get(id);
    if (!user) return undefined;

    const updatedUser = { ...user, ...updates };
    this.users.set(id, updatedUser);
    return updatedUser;
  }

  // DNA Profile operations
  async getDnaProfile(id: number): Promise<DnaProfile | undefined> {
    return this.dnaProfiles.get(id);
  }

  async getDnaProfilesByUserId(userId: number): Promise<DnaProfile[]> {
    return Array.from(this.dnaProfiles.values()).filter(profile => profile.userId === userId);
  }

  async getActiveDnaProfile(userId: number): Promise<DnaProfile | undefined> {
    const user = this.users.get(userId);
    if (!user || !user.activeDnaProfileId) return undefined;
    return this.dnaProfiles.get(user.activeDnaProfileId);
  }

  async createDnaProfile(insertDnaProfile: InsertDnaProfile): Promise<DnaProfile> {
    const id = this.currentDnaProfileId++;
    const dnaProfile: DnaProfile = { 
      ...insertDnaProfile, 
      id, 
      createdAt: new Date() 
    };
    this.dnaProfiles.set(id, dnaProfile);
    return dnaProfile;
  }

  async updateDnaProfile(id: number, updates: Partial<DnaProfile>): Promise<DnaProfile | undefined> {
    const dnaProfile = this.dnaProfiles.get(id);
    if (!dnaProfile) return undefined;

    const updatedProfile = { ...dnaProfile, ...updates };
    this.dnaProfiles.set(id, updatedProfile);
    return updatedProfile;
  }

  // Sermon operations
  async getSermon(id: number): Promise<Sermon | undefined> {
    return this.sermons.get(id);
  }

  async getSermonsByUserId(userId: number): Promise<Sermon[]> {
    return Array.from(this.sermons.values()).filter(sermon => sermon.userId === userId);
  }

  async createSermon(insertSermon: InsertSermon): Promise<Sermon> {
    const id = this.currentSermonId++;
    const sermon: Sermon = { 
      ...insertSermon, 
      id, 
      createdAt: new Date() 
    };
    this.sermons.set(id, sermon);
    return sermon;
  }

  async updateSermon(id: number, updates: Partial<Sermon>): Promise<Sermon | undefined> {
    const sermon = this.sermons.get(id);
    if (!sermon) return undefined;

    const updatedSermon = { ...sermon, ...updates };
    this.sermons.set(id, updatedSermon);
    return updatedSermon;
  }

  // Password reset operations
  async createPasswordResetToken(insertToken: InsertPasswordResetToken): Promise<PasswordResetToken> {
    const id = this.currentTokenId++;
    const token: PasswordResetToken = { 
      ...insertToken, 
      id, 
      used: false,
      createdAt: new Date() 
    };
    this.passwordResetTokens.set(id, token);
    return token;
  }

  async getPasswordResetToken(token: string): Promise<PasswordResetToken | undefined> {
    return Array.from(this.passwordResetTokens.values()).find(t => t.token === token);
  }

  async markPasswordResetTokenUsed(id: number): Promise<void> {
    const token = this.passwordResetTokens.get(id);
    if (token) {
      token.used = true;
      this.passwordResetTokens.set(id, token);
    }
  }
}

export const storage = new MemStorage();
