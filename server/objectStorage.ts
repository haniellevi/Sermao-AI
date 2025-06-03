
import { Client } from '@replit/object-storage';

export class ObjectStorageService {
  public client: Client;

  constructor() {
    this.client = new Client();
  }

  // Upload de arquivo de DNA do pregador
  async uploadDnaFile(userId: number, fileName: string, buffer: Buffer): Promise<string> {
    const key = `dna/${userId}/${Date.now()}-${fileName}`;
    await this.client.uploadFromBytes(key, buffer);
    return key;
  }

  // Upload de arquivo de sermão
  async uploadSermonFile(userId: number, sermonId: number, fileName: string, buffer: Buffer): Promise<string> {
    const key = `sermons/${userId}/${sermonId}/${Date.now()}-${fileName}`;
    await this.client.uploadFromBytes(key, buffer);
    return key;
  }

  // Download de arquivo
  async downloadFile(key: string): Promise<Buffer> {
    return await this.client.downloadAsBytes(key);
  }

  // Salvar texto de sermão gerado
  async saveSermonText(userId: number, sermonId: number, content: string): Promise<string> {
    const key = `sermons/${userId}/${sermonId}/sermon.txt`;
    await this.client.uploadFromText(key, content);
    return key;
  }

  // Recuperar texto de sermão
  async getSermonText(key: string): Promise<string> {
    return await this.client.downloadAsText(key);
  }

  // Salvar DNA personalizado como JSON
  async saveDnaProfile(userId: number, profileId: number, dnaData: any): Promise<string> {
    const key = `dna/${userId}/profile-${profileId}.json`;
    await this.client.uploadFromText(key, JSON.stringify(dnaData, null, 2));
    return key;
  }

  // Recuperar DNA personalizado
  async getDnaProfile(key: string): Promise<any> {
    const jsonText = await this.client.downloadAsText(key);
    return JSON.parse(jsonText);
  }

  // Deletar arquivo
  async deleteFile(key: string): Promise<void> {
    await this.client.delete(key);
  }

  // Listar arquivos por prefixo
  async listFiles(prefix: string): Promise<string[]> {
    return await this.client.list(prefix);
  }

  // Upload de múltiplos arquivos
  async uploadMultipleFiles(userId: number, files: Array<{name: string, buffer: Buffer}>, type: 'dna' | 'sermon'): Promise<string[]> {
    const keys: string[] = [];
    
    for (const file of files) {
      const key = `${type}/${userId}/${Date.now()}-${file.name}`;
      await this.client.uploadFromBytes(key, file.buffer);
      keys.push(key);
    }
    
    return keys;
  }

  // Backup de documento RAG
  async backupRagDocument(userId: number, documentId: string, content: string, originalName: string): Promise<string> {
    const key = `rag-backup/${userId}/${Date.now()}-${documentId}-${originalName}`;
    await this.client.uploadFromText(key, content);
    return key;
  }

  // Recuperar backup de documento RAG
  async getRagDocumentBackup(key: string): Promise<string> {
    return await this.client.downloadAsText(key);
  }

  // Listar backups RAG de um usuário
  async listUserRagBackups(userId: number): Promise<string[]> {
    return await this.client.list(`rag-backup/${userId}/`);
  }

  // Salvar metadados de indexação
  async saveIndexingMetadata(userId: number, metadata: any): Promise<string> {
    const key = `rag-metadata/${userId}/indexing-${Date.now()}.json`;
    await this.client.uploadFromText(key, JSON.stringify(metadata, null, 2));
    return key;
  }
}

export const objectStorage = new ObjectStorageService();
