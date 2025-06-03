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

  private chunkText(text: string, chunkSize: number = 600, overlap: number = 50): string[] {
    const chunks: string[] = [];
    let start = 0;

    // Limit total chunks to prevent memory issues
    const maxChunks = 100;
    let chunkCount = 0;

    while (start < text.length && chunkCount < maxChunks) {
      const end = Math.min(start + chunkSize, text.length);
      const chunk = text.slice(start, end).trim();
      
      // Only add non-empty chunks with meaningful content
      if (chunk.length > 30) {
        chunks.push(chunk);
        chunkCount++;
      }
      
      start = end - overlap;
      
      // Ensure we don't get stuck in infinite loop
      if (start >= end) {
        break;
      }
    }

    return chunks;
  }

  async storeDocument(userId: number, documentId: string, text: string, sourceUrl?: string): Promise<void> {
    try {
      console.log(`Storing document: ${documentId} for user: ${userId}`);
      
      // Clean and validate text - remover caracteres problemáticos
      let cleanText = text.trim();
      
      // Remove caracteres nulos e de controle que causam problemas no PostgreSQL
      cleanText = cleanText
        .replace(/\x00/g, '') // Remove null bytes
        .replace(/[\x01-\x08\x0B\x0C\x0E-\x1F\x7F]/g, ' ') // Remove caracteres de controle
        .replace(/\s+/g, ' ') // Normaliza espaços múltiplos
        .trim();
      
      if (!cleanText || cleanText.length < 50) {
        throw new Error('Documento muito pequeno ou vazio para indexação');
      }

      // Limit document size to prevent memory issues
      const maxDocumentSize = 50000; // 50KB max per document
      const processText = cleanText.length > maxDocumentSize 
        ? cleanText.substring(0, maxDocumentSize) + '...[documento truncado]'
        : cleanText;

      const chunks = this.chunkText(processText, 600, 50); // Smaller chunks with less overlap
      console.log(`Created ${chunks.length} chunks for document: ${documentId} (text size: ${processText.length} chars)`);

      // Remove existing chunks for this document to avoid duplicates
      await db.delete(ragChunks).where(eq(ragChunks.documentId, documentId));

      // Process chunks in smaller batches to prevent memory overflow
      const batchSize = 5;
      for (let batchStart = 0; batchStart < chunks.length; batchStart += batchSize) {
        const batchEnd = Math.min(batchStart + batchSize, chunks.length);
        const batchChunks = chunks.slice(batchStart, batchEnd);
        
        const currentBatch = Math.floor(batchStart / batchSize) + 1;
        const totalBatches = Math.ceil(chunks.length / batchSize);
        console.log(`Processing batch ${currentBatch}/${totalBatches} for ${documentId}`);
        
        for (let i = 0; i < batchChunks.length; i++) {
          const chunkIndex = batchStart + i;
          const chunk = batchChunks[i];
          
          try {
            // Limpar chunk antes de processar
            const cleanChunk = chunk
              .replace(/\x00/g, '')
              .replace(/[\x01-\x08\x0B\x0C\x0E-\x1F\x7F]/g, ' ')
              .replace(/\s+/g, ' ')
              .trim();
            
            if (cleanChunk.length < 30) {
              console.log(`Skipping empty chunk ${chunkIndex + 1}`);
              continue;
            }
            
            // Add delay between embeddings to prevent rate limiting and memory buildup
            if (chunkIndex > 0 && chunkIndex % 3 === 0) {
              await new Promise(resolve => setTimeout(resolve, 1000));
            }
            
            const embedding = await this.generateEmbedding(cleanChunk);
            
            await db.insert(ragChunks).values({
              documentId: `${documentId}_chunk_${chunkIndex}`,
              chunkText: cleanChunk,
              embeddingVector: JSON.stringify(embedding),
              sourceUrl: sourceUrl || null,
              pageNumber: chunkIndex + 1,
              userId: userId
            });
            
            console.log(`✅ Stored chunk ${chunkIndex + 1}/${chunks.length} for ${documentId}`);
          } catch (chunkError) {
            console.error(`❌ Error storing chunk ${chunkIndex} for document ${documentId}:`, chunkError);
            // Continue with other chunks even if one fails
          }
        }
        
        // Force garbage collection hint between batches
        if (global.gc) {
          global.gc();
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