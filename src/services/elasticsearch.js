const { Client } = require('@elastic/elasticsearch');

class ElasticsearchService {
  constructor() {
    const config = {
      node: process.env.ELASTICSEARCH_NODE,
      tls: {
        rejectUnauthorized: false
      }
    };

    if (process.env.ELASTICSEARCH_API_KEY) {
      config.auth = {
        apiKey: process.env.ELASTICSEARCH_API_KEY
      };
    }

    this.client = new Client(config);
    this.huggingfaceService = null;
  }

  async getHuggingFaceService() {
    if (!this.huggingfaceService) {
      this.huggingfaceService = require('./huggingface');
    }
    return this.huggingfaceService;
  }

  async createIndex(indexName = 'documents') {
    try {
      const indexExists = await this.client.indices.exists({ index: indexName });
      
      if (!indexExists) {
        await this.client.indices.create({
          index: indexName,
          body: {
            mappings: {
              properties: {
                title: { 
                  type: 'text',
                  fields: {
                    keyword: { type: 'keyword' }
                  }
                },
                content: { type: 'text' },
                keywords: { type: 'keyword' },
                category: { type: 'keyword' },
                embedding: { 
                  type: 'dense_vector',
                  dims: 384,
                  index: true,
                  similarity: 'cosine'
                },
                timestamp: { type: 'date' }
              }
            },
            settings: {
              number_of_shards: 1,
              number_of_replicas: 1
            }
          }
        });
        console.log(`✅ Index ${indexName} created with vector support`);
      }
    } catch (error) {
      console.error('❌ Error creating index:', error.message);
    }
  }

  async indexDocument(document, index = 'documents', generateEmbedding = true) {
    try {
      const docWithTimestamp = {
        ...document,
        timestamp: new Date().toISOString()
      };

      if (generateEmbedding && document.content) {
        const huggingfaceService = await this.getHuggingFaceService();
        const embedding = await huggingfaceService.generateEmbedding(document.content);
        docWithTimestamp.embedding = embedding;
      }

      const response = await this.client.index({
        index: index,
        document: docWithTimestamp,
        refresh: true
      });
      
      return response;
    } catch (error) {
      console.error('❌ Elasticsearch index error:', error.message);
      throw new Error(`Failed to index document: ${error.message}`);
    }
  }

  async retrieveRelevantDocuments(query, index = 'documents', k = 10) {
    try {
      console.log(`🔍 Retrieving ${k} relevant documents for: "${query}"`);
      
      const searchResults = await this.hybridSearch(query, index, k);
      const relevantDocs = searchResults.filter(doc => doc.score > 0.3);
      
      console.log(`✅ Found ${relevantDocs.length} relevant documents`);
      return relevantDocs;
      
    } catch (error) {
      console.error('❌ Document retrieval error:', error);
      return [];
    }
  }

  async hybridSearch(query, index = 'documents', size = 5) {
    try {
      size=1
      const huggingfaceService = await this.getHuggingFaceService();
      const queryEmbedding = await huggingfaceService.generateEmbedding(query);
      console.log("the index is "+index)
      const response = await this.client.search({
        index: index,
        size: size,
        query: {
          bool: {
            must: [
              {
                nested: {
                  path: "body_v2",
                  query: {
                    exists: { field: "body_v2.body_text" }
                  }
                }
              },
              {
                nested: {
                  path: "body_v2",
                  query: {
                    multi_match: {
                      query: query,
                      fields: ["body_v2.body_text^2"],
                      fuzziness: "AUTO"
                    }
                  }
                }
              },
              {
                multi_match: {
                  query: query,
                  fields: ["title^3"],
                  fuzziness: "AUTO"
                }
              }
            ]
          }
        },
        _source: ["title", "body_v2.body_text"]
      });
      

      return response.hits.hits.map(hit => ({
        id: hit._id,
        score: hit._score,
        ...hit._source
      }));
    } catch (error) {
      console.error('❌ Hybrid search error:', error);
      throw new Error(`Hybrid search failed: ${error.message}`);
    }
  }

  formatDocumentsForContext(documents) {
    return documents.map((doc, index) => 
      `[Document ${index + 1}] Title: ${doc.title}\nContent: ${JSON.stringify(doc.body_v2)}`
    ).join('\n\n');
  }

  async checkConnection() {
    try {
      await this.client.info();
      return true;
    } catch (error) {
      console.error('❌ Elasticsearch connection failed:', error.message);
      return false;
    }
  }
}

module.exports = new ElasticsearchService();