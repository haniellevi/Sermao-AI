import { GoogleGenerativeAI } from "@google/generative-ai";
import { db } from "./db";
import { eq, sql } from "drizzle-orm";
import { ragChunks } from "@shared/schema";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

export interface RagChunk {
  id: number;
  documentId: string;
  chunkText: string;
  embeddingVector: string;
  sourceUrl?: string;
  pageNumber?: number;
  userId: number;
}

export class RagService {

  // Generate embeddings using Gemini AI
  async generateEmbedding(text: string): Promise<number[]> {
    try {
      const model = genAI.getGenerativeModel({ model: "embedding-001" });
      const result = await model.embedContent(text);
      return result.embedding.values;
    } catch (error) {
      console.error('Error generating embedding:', error);
      // Fallback: generate a simple hash-based embedding
      return this.generateSimpleEmbedding(text);
    }
  }

  // Simple fallback embedding based on text content
  private generateSimpleEmbedding(text: string): number[] {
    const words = text.toLowerCase().split(/\s+/);
    const embedding = new Array(384).fill(0);
    
    words.forEach((word, index) => {
      const hash = this.simpleHash(word);
      embedding[hash % 384] += 1;
    });
    
    // Normalize
    const norm = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
    return embedding.map(val => norm > 0 ? val / norm : 0);
  }

  private simpleHash(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash);
  }

  // Split text into chunks
  splitIntoChunks(text: string, chunkSize: number = 500): string[] {
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
    const chunks: string[] = [];
    let currentChunk = '';

    for (const sentence of sentences) {
      if (currentChunk.length + sentence.length > chunkSize && currentChunk.length > 0) {
        chunks.push(currentChunk.trim());
        currentChunk = sentence.trim();
      } else {
        currentChunk += (currentChunk ? '. ' : '') + sentence.trim();
      }
    }

    if (currentChunk.trim()) {
      chunks.push(currentChunk.trim());
    }

    return chunks;
  }

  // Store document chunks with embeddings in PostgreSQL
  async storeDocument(
    userId: number,
    documentId: string,
    text: string,
    sourceUrl?: string
  ): Promise<void> {
    const textChunks = this.splitIntoChunks(text);

    // Remove existing chunks for this document
    await db.delete(ragChunks).where(
      sql`${ragChunks.documentId} = ${documentId} AND ${ragChunks.userId} = ${userId}`
    );

    for (let i = 0; i < textChunks.length; i++) {
      const chunk = textChunks[i];
      const embedding = await this.generateEmbedding(chunk);
      
      await db.insert(ragChunks).values({
        documentId,
        chunkText: chunk,
        embeddingVector: JSON.stringify(embedding),
        sourceUrl,
        pageNumber: i + 1,
        userId
      });
    }
  }

  // Calculate cosine similarity between two vectors
  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) return 0;
    
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    
    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }
    
    if (normA === 0 || normB === 0) return 0;
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  // Search for relevant chunks based on query using PostgreSQL
  async searchRelevantChunks(
    userId: number,
    query: string,
    topK: number = 5
  ): Promise<RagChunk[]> {
    try {
      const queryEmbedding = await this.generateEmbedding(query);
      
      // Get all chunks for user from database
      const userChunks = await db
        .select()
        .from(ragChunks)
        .where(eq(ragChunks.userId, userId));
      
      if (userChunks.length === 0) {
        return [];
      }

      // Calculate similarities and rank
      const rankedChunks = userChunks
        .map(chunk => {
          const chunkEmbedding = JSON.parse(chunk.embeddingVector);
          return {
            chunk: {
              id: chunk.id,
              documentId: chunk.documentId,
              chunkText: chunk.chunkText,
              embeddingVector: chunk.embeddingVector,
              sourceUrl: chunk.sourceUrl || undefined,
              pageNumber: chunk.pageNumber || undefined,
              userId: chunk.userId
            } as RagChunk,
            similarity: this.cosineSimilarity(queryEmbedding, chunkEmbedding)
          };
        })
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, topK)
        .map(item => item.chunk);

      return rankedChunks;
    } catch (error) {
      console.error('Erro ao buscar chunks relevantes:', error);
      return [];
    }
  }

  // Get enhanced context for sermon generation
  async getEnhancedContext(
    userId: number,
    theme: string,
    additionalContext?: string
  ): Promise<string> {
    const searchQuery = `${theme} ${additionalContext || ''}`.trim();
    const relevantChunks = await this.searchRelevantChunks(userId, searchQuery, 3);
    
    if (relevantChunks.length === 0) {
      return '';
    }

    let context = '\n\nCONTEXTO ADICIONAL BASEADO EM DOCUMENTOS:\n';
    relevantChunks.forEach((chunk, index) => {
      context += `\n${index + 1}. ${chunk.chunkText}`;
      if (chunk.sourceUrl) {
        context += ` (Fonte: ${chunk.sourceUrl})`;
      }
    });
    context += '\n';

    return context;
  }

  // Remove all chunks for a user
  async clearUserDocuments(userId: number): Promise<void> {
    try {
      await db.delete(ragChunks).where(eq(ragChunks.userId, userId));
    } catch (error) {
      console.error('Erro ao remover documentos do usuário:', error);
      throw error;
    }
  }

  // Get document statistics for a user
  async getUserDocumentStats(userId: number): Promise<{ documentCount: number; chunkCount: number }> {
    try {
      const userChunks = await db
        .select()
        .from(ragChunks)
        .where(eq(ragChunks.userId, userId));
      
      const uniqueDocuments = new Set(userChunks.map(c => c.documentId));
      
      return {
        documentCount: uniqueDocuments.size,
        chunkCount: userChunks.length
      };
    } catch (error) {
      console.error('Erro ao buscar estatísticas do usuário:', error);
      return { documentCount: 0, chunkCount: 0 };
    }
  }
}

export const ragService = new RagService();