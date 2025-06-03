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
      console.log(`Storing document: ${documentId} for user: ${userId}`);
      
      // Clean and validate text
      const cleanText = text.trim();
      if (!cleanText || cleanText.length < 50) {
        throw new Error('Documento muito pequeno ou vazio para indexação');
      }

      const chunks = this.chunkText(cleanText, 800, 100); // Smaller chunks for better retrieval
      console.log(`Created ${chunks.length} chunks for document: ${documentId}`);

      // Remove existing chunks for this document to avoid duplicates
      await db.delete(ragChunks).where(eq(ragChunks.documentId, documentId));

      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        
        try {
          const embedding = await this.generateEmbedding(chunk);
          
          await db.insert(ragChunks).values({
            documentId: `${documentId}_chunk_${i}`,
            chunkText: chunk,
            embeddingVector: JSON.stringify(embedding),
            sourceUrl: sourceUrl || null,
            pageNumber: i + 1,
            userId: userId
          });
          
          console.log(`Stored chunk ${i + 1}/${chunks.length} for document: ${documentId}`);
        } catch (chunkError) {
          console.error(`Error storing chunk ${i} for document ${documentId}:`, chunkError);
          // Continue with other chunks even if one fails
        }
      }
      
      console.log(`Successfully stored document: ${documentId} with ${chunks.length} chunks`);
    } catch (error) {
      console.error('Error storing document:', error);
      throw error;
    }
  }

  async searchSimilarChunks(query: string, limit: number = 5): Promise<SearchResult[]> {
    try {
      console.log(`Searching for: "${query}" with limit: ${limit}`);
      const queryEmbedding = await this.generateEmbedding(query);

      // Get more chunks for better search results
      const allChunks = await db.select().from(ragChunks).limit(500);
      console.log(`Found ${allChunks.length} chunks in database`);

      const results: SearchResult[] = [];

      for (const chunk of allChunks) {
        try {
          const chunkEmbedding = JSON.parse(chunk.embeddingVector);
          const similarity = this.cosineSimilarity(queryEmbedding, chunkEmbedding);

          // Only include chunks with reasonable similarity
          if (similarity > 0.3) {
            results.push({
              chunkText: chunk.chunkText,
              similarity: similarity,
              sourceUrl: chunk.sourceUrl || undefined
            });
          }
        } catch (error) {
          console.error('Error processing chunk:', error);
        }
      }

      const sortedResults = results
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, limit);
      
      console.log(`Returning ${sortedResults.length} similar chunks with similarities:`, 
        sortedResults.map(r => r.similarity.toFixed(3)));
      
      return sortedResults;
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
      console.log(`Getting enhanced context for theme: "${theme}", additional: "${additionalContext}"`);
      
      // Create multiple search queries for better coverage
      const searchQueries = [
        `${theme} ${additionalContext}`.trim(),
        theme,
        additionalContext
      ].filter(q => q.length > 0);

      let allChunks: SearchResult[] = [];
      
      // Search with each query and combine results
      for (const query of searchQueries) {
        if (query.length > 3) {
          const chunks = await this.searchSimilarChunks(query, 5);
          allChunks = allChunks.concat(chunks);
        }
      }

      // Remove duplicates and keep highest similarity
      const uniqueChunks = allChunks.reduce((acc, chunk) => {
        const existing = acc.find(c => c.chunkText === chunk.chunkText);
        if (!existing || existing.similarity < chunk.similarity) {
          acc = acc.filter(c => c.chunkText !== chunk.chunkText);
          acc.push(chunk);
        }
        return acc;
      }, [] as SearchResult[]);

      const topChunks = uniqueChunks
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, 4);

      if (topChunks.length === 0) {
        console.log('No relevant chunks found for enhanced context');
        return '';
      }

      console.log(`Found ${topChunks.length} relevant chunks for enhanced context`);

      return topChunks
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