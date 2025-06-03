import { GoogleGenerativeAI } from '@google/generative-ai';
import { db } from './db';
import { ragChunks } from '@shared/schema';
import { eq } from 'drizzle-orm';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

interface SearchResult {
  chunkText: string;
  similarity: number;
  sourceUrl?: string;
}

class RagService {
  private async generateEmbedding(text: string): Promise<number[]> {
    try {
      console.log(`[RAG] Generating embedding for text of length: ${text.length}`);
      
      // Clean and truncate text if too long
      const cleanText = text.replace(/\s+/g, ' ').trim();
      const maxLength = 8000; // Gemini embedding limit
      const truncatedText = cleanText.length > maxLength ? cleanText.substring(0, maxLength) : cleanText;
      
      if (truncatedText.length < 10) {
        throw new Error('Texto muito curto para gerar embedding');
      }

      const model = genAI.getGenerativeModel({ model: "text-embedding-004" });
      const result = await model.embedContent(truncatedText);
      
      console.log(`[RAG] Embedding generated successfully: ${result.embedding.values.length} dimensions`);
      return result.embedding.values;
    } catch (error: any) {
      console.error('[RAG] Error generating embedding:', error);
      throw new Error(`Falha ao gerar embedding: ${error.message}`);
    }
  }

  private chunkText(text: string, chunkSize: number = 600, overlap: number = 50): string[] {
    console.log(`[RAG] Chunking text of length: ${text.length} with chunk size: ${chunkSize}, overlap: ${overlap}`);
    
    // Clean text first
    const cleanText = text
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .replace(/\s+/g, ' ')
      .trim();

    if (cleanText.length < 100) {
      return [cleanText];
    }

    const chunks = [];
    let start = 0;

    // Try to break on sentence boundaries when possible
    while (start < cleanText.length) {
      let end = Math.min(start + chunkSize, cleanText.length);
      
      // If not at the end of text, try to find a good break point
      if (end < cleanText.length) {
        // Look for sentence endings within the last 200 characters
        const searchStart = Math.max(end - 200, start);
        const searchText = cleanText.slice(searchStart, end);
        const sentenceEnd = searchText.lastIndexOf('. ');
        
        if (sentenceEnd > 0) {
          end = searchStart + sentenceEnd + 1;
        } else {
          // Fallback to word boundary
          const wordBoundary = cleanText.lastIndexOf(' ', end);
          if (wordBoundary > start + chunkSize * 0.7) {
            end = wordBoundary;
          }
        }
      }
      
      const chunk = cleanText.slice(start, end).trim();
      if (chunk.length > 50) { // Only include meaningful chunks
        chunks.push(chunk);
      }
      
      start = end - overlap;
      if (start >= cleanText.length) break;
    }

    console.log(`[RAG] Text chunked into ${chunks.length} chunks`);
    return chunks;
  }

  async storeDocument(userId: number, documentId: string, text: string, sourceUrl?: string): Promise<void> {
    const startTime = Date.now();
    const maxProcessingTime = 60000; // 60 seconds max
    
    try {
      console.log(`[RAG] Starting document storage: ${documentId} for user: ${userId}`);
      
      // Clean and validate text
      const cleanText = text
        .replace(/\0/g, '') // Remove null bytes
        .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '') // Remove control characters
        .trim();
        
      console.log(`[RAG] Text length after cleaning: ${cleanText.length}`);
      
      if (!cleanText || cleanText.length < 100) {
        throw new Error('Documento muito pequeno ou vazio para indexação (mínimo 100 caracteres)');
      }

      // Check if document already exists
      const existingChunks = await db.select().from(ragChunks).where(eq(ragChunks.documentId, documentId));
      if (existingChunks.length > 0) {
        console.log(`[RAG] Removing ${existingChunks.length} existing chunks for document: ${documentId}`);
        await db.delete(ragChunks).where(eq(ragChunks.documentId, documentId));
      }

      const chunks = this.chunkText(cleanText, 500, 30); // Smaller chunks for faster processing
      console.log(`[RAG] Created ${chunks.length} chunks for document: ${documentId}`);

      let successfulChunks = 0;
      const errors: string[] = [];

      // Process chunks with timeout protection
      for (let i = 0; i < chunks.length; i++) {
        const currentTime = Date.now();
        if (currentTime - startTime > maxProcessingTime) {
          console.log(`[RAG] Processing timeout reached, stopping at chunk ${i + 1}/${chunks.length}`);
          break;
        }

        const chunk = chunks[i];
        try {
          console.log(`[RAG] Processing chunk ${i + 1}/${chunks.length} (${chunk.length} chars)`);
          
          const embedding = await this.generateEmbedding(chunk);
          
          await db.insert(ragChunks).values({
            documentId: `${documentId}_chunk_${i}`,
            chunkText: chunk,
            embeddingVector: JSON.stringify(embedding),
            sourceUrl: sourceUrl || null,
            pageNumber: i + 1,
            userId: userId
          });
          
          console.log(`[RAG] ✓ Stored chunk ${i + 1}/${chunks.length}`);
          successfulChunks++;
          
          // Small delay to prevent overwhelming the API
          if (i % 3 === 0 && i > 0) {
            await new Promise(resolve => setTimeout(resolve, 100));
          }
          
        } catch (chunkError: any) {
          console.error(`[RAG] ✗ Error storing chunk ${i + 1}:`, chunkError.message);
          errors.push(`Chunk ${i + 1}: ${chunkError.message}`);
          
          // If too many consecutive errors, stop processing
          if (errors.length > 5 && successfulChunks === 0) {
            throw new Error('Muitos erros consecutivos no processamento');
          }
        }
      }
      
      const elapsed = Date.now() - startTime;
      console.log(`[RAG] Document storage completed in ${elapsed}ms`);
      console.log(`[RAG] Successfully stored ${successfulChunks}/${chunks.length} chunks for document: ${documentId}`);
      
      if (successfulChunks === 0) {
        throw new Error('Nenhum chunk foi processado com sucesso');
      }
      
      if (errors.length > 0 && successfulChunks < Math.max(1, chunks.length * 0.5)) {
        throw new Error(`Muitos erros durante o processamento: ${errors.slice(0, 3).join('; ')}`);
      }
      
    } catch (error: any) {
      const elapsed = Date.now() - startTime;
      console.error(`[RAG] Error storing document after ${elapsed}ms:`, error);
      
      if (elapsed > maxProcessingTime) {
        throw new Error('Processamento demorou muito. Tente um arquivo menor.');
      }
      
      throw error;
    }
  }

  async searchSimilarChunks(query: string, limit: number = 5): Promise<SearchResult[]> {
    try {
      console.log(`[RAG] Searching for: "${query}" with limit: ${limit}`);
      const queryEmbedding = await this.generateEmbedding(query);

      // Get more chunks for better search results
      const allChunks = await db.select().from(ragChunks).limit(500);
      console.log(`[RAG] Found ${allChunks.length} chunks in database`);

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
          console.error('[RAG] Error processing chunk:', error);
        }
      }

      const sortedResults = results
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, limit);
      
      console.log(`[RAG] Found ${sortedResults.length} relevant chunks`);
      return sortedResults;
    } catch (error: any) {
      console.error('[RAG] Error searching chunks:', error);
      throw error;
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
      console.log(`[RAG] Getting enhanced context for user ${userId}, theme: ${theme}`);
      
      // Search for relevant content using the theme and additional context
      const searchQuery = `${theme} ${additionalContext}`.trim();
      const relevantChunks = await this.searchSimilarChunks(searchQuery, 8);
      
      if (relevantChunks.length === 0) {
        console.log('[RAG] No relevant chunks found');
        return '';
      }
      
      // Format the context with the most relevant chunks
      const contextParts = relevantChunks.map((chunk, index) => {
        return `[Referência ${index + 1}] ${chunk.chunkText}`;
      });
      
      const enhancedContext = contextParts.join('\n\n');
      console.log(`[RAG] Enhanced context generated with ${relevantChunks.length} references`);
      
      return enhancedContext;
    } catch (error: any) {
      console.error('[RAG] Error getting enhanced context:', error);
      return '';
    }
  }

  async getUserDocumentStats(userId: number): Promise<{ documentCount: number; chunkCount: number }> {
    try {
      const chunks = await db.select().from(ragChunks).where(eq(ragChunks.userId, userId));
      
      // Count unique documents
      const uniqueDocuments = new Set();
      chunks.forEach(chunk => {
        const baseDocId = chunk.documentId.split('_chunk_')[0];
        uniqueDocuments.add(baseDocId);
      });
      
      return {
        documentCount: uniqueDocuments.size,
        chunkCount: chunks.length
      };
    } catch (error: any) {
      console.error('[RAG] Error getting user document stats:', error);
      return { documentCount: 0, chunkCount: 0 };
    }
  }

  async clearUserDocuments(userId: number): Promise<void> {
    try {
      console.log(`[RAG] Clearing documents for user: ${userId}`);
      await db.delete(ragChunks).where(eq(ragChunks.userId, userId));
      console.log(`[RAG] Cleared documents for user: ${userId}`);
    } catch (error: any) {
      console.error('[RAG] Error clearing user documents:', error);
      throw error;
    }
  }
}

export const ragService = new RagService();