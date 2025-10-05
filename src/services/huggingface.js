const { pipeline } = require('@xenova/transformers');

class HuggingFaceService {
  constructor() {
    this.embedder = null;
    this.modelName = 'sentence-transformers/all-MiniLM-L6-v2';
  }

  async initializeEmbedder() {
    if (!this.embedder) {
      console.log('🤗 Loading Hugging Face embeddings model...');
      this.embedder = await pipeline(
        'feature-extraction',
        this.modelName,
        { quantized: false }
      );
      console.log('✅ Hugging Face embeddings model loaded');
    }
    return this.embedder;
  }

  async generateEmbedding(text) {
    try {
      const embedder = await this.initializeEmbedder();
      const result = await embedder(text, {
        pooling: 'mean',
        normalize: true
      });
      
      const embedding = Array.from(result.data);
      return embedding;
    } catch (error) {
      console.error('🤗 Hugging Face embedding error:', error);
      throw new Error(`Failed to generate embedding: ${error.message}`);
    }
  }
}

module.exports = new HuggingFaceService();