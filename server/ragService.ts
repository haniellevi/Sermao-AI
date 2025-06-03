import { GoogleGenerativeAI } from "@google/generative-ai";
import { db } from "./db";
import { ragChunks, type RagChunk } from "../shared/schema";
import { eq, sql } from "drizzle-orm";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

interface SearchResult {
  chunkText: string;
  similarity: number;
  sourceUrl?: string;
}

class RagService {
  private async generateEmbedding(text: string): Promise<number[]> {
    try {
      const model = genAI.getGenerativeModel({ model: "text-embedding-004" });
      const result = await model.embedContent(text);
      return result.embedding.values;
    } catch (error) {
      console.error('Error generating embedding:', error);
      throw error;
    }
  }

  private chunkText(text: string, chunkSize: number = 1000, overlap: number = 200): string[] {
    const chunks: string[] = [];
    let start = 0;

    while (start < text.length) {
      const end = Math.min(start + chunkSize, text.length);
      chunks.push(text.slice(start, end));
      start = end - overlap;
    }

    return chunks;
  }

  async storeDocument(userId: number, documentId: string, text: string, sourceUrl?: string): Promise<void> {
    try {
      const chunks = this.chunkText(text);

      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        const embedding = await this.generateEmbedding(chunk);

        await db.insert(ragChunks).values({
          documentId: `${documentId}_chunk_${i}`,
          chunkText: chunk,
          embeddingVector: JSON.stringify(embedding),
          sourceUrl: sourceUrl || null,
          pageNumber: i + 1,
          userId: userId
        });
      }
    } catch (error) {
      console.error('Error storing document:', error);
      throw error;
    }
  }

  async searchSimilarChunks(query: string, limit: number = 5): Promise<SearchResult[]> {
    try {
      const queryEmbedding = await this.generateEmbedding(query);

      // For now, return all chunks and calculate similarity in memory
      // In production, you might want to use a vector database
      const allChunks = await db.select().from(ragChunks).limit(100);

      const results: SearchResult[] = [];

      for (const chunk of allChunks) {
        try {
          const chunkEmbedding = JSON.parse(chunk.embeddingVector);
          const similarity = this.cosineSimilarity(queryEmbedding, chunkEmbedding);

          results.push({
            chunkText: chunk.chunkText,
            similarity: similarity,
            sourceUrl: chunk.sourceUrl || undefined
          });
        } catch (error) {
          console.error('Error processing chunk:', error);
        }
      }

      return results
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, limit);
    } catch (error) {
      console.error('Error searching chunks:', error);
      return [];
    }
  }

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

    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  async getEnhancedContext(userId: number, theme: string, additionalContext: string): Promise<string> {
    try {
      const searchQuery = `${theme} ${additionalContext}`.trim();
      const similarChunks = await this.searchSimilarChunks(searchQuery, 3);

      if (similarChunks.length === 0) {
        return '';
      }

      return similarChunks
        .map(chunk => chunk.chunkText)
        .join('\n\n---\n\n');
    } catch (error) {
      console.error('Error getting enhanced context:', error);
      return '';
    }
  }

  async getUserDocumentStats(userId: number): Promise<{ documentCount: number; chunkCount: number }> {
    try {
      const result = await db.select({
        chunkCount: sql<number>`count(*)`,
        documentCount: sql<number>`count(distinct ${ragChunks.documentId})`
      })
      .from(ragChunks)
      .where(userId === 0 ? sql`1=1` : eq(ragChunks.userId, userId));

      return {
        documentCount: result[0]?.documentCount || 0,
        chunkCount: result[0]?.chunkCount || 0
      };
    } catch (error) {
      console.error('Error getting document stats:', error);
      return { documentCount: 0, chunkCount: 0 };
    }
  }

  async clearUserDocuments(userId: number): Promise<void> {
    try {
      await db.delete(ragChunks).where(eq(ragChunks.userId, userId));
    } catch (error) {
      console.error('Error clearing user documents:', error);
      throw error;
    }
  }
}

export const ragService = new RagService();