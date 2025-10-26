const groqService = require('./groqService');
const deepseekService = require('./deepseek');
const elasticsearchService = require('./elasticsearch');

class LLMService {
  constructor() {
    this.useGroq = process.env.USE_GROQ === 'true';
    this.useDeepSeek = 'false';
    this.currentProvider =  'groq' 
  }

  getSystemPrompt() {
    return `You are a helpful assistant with medical knowledge. Use the following context to answer the question.

CONTEXT:
{context}

QUESTION: {input}

Please provide an accurate answer based on the context. If the context doesn't contain relevant information, please say so.`;
  }

  async ragChain(input, sessionId = 'default') {
    try {
      console.log('🔄 Starting RAG chain...');
      
      // 1. Retrieve documents
      const relevantDocs = await elasticsearchService.retrieveRelevantDocuments(input, 'salt', 5);
      
      // 2. If no documents found, provide a friendly response
      if (relevantDocs.length === 0) {
        return {
          answer: "I searched my knowledge base but couldn't find specific information about that. Could you try rephrasing your question or ask about a different topic?",
          sources: [],
          contextUsed: false,
          provider: 'none'
        };
      }
      
      // 3. Format context
      const context = elasticsearchService.formatDocumentsForContext(relevantDocs);
      
      // 4. Build prompt
      const prompt = this.getSystemPrompt()
        .replace('{context}', context)
        .replace('{input}', input);
      
      // 5. Generate answer using selected provider
      let answer;
      let providerUsed = this.currentProvider;

      if (this.useGroq) {
        try {
          console.log('🚀 Using Groq for response...');
          answer = await groqService.generateRAGResponse(input, context);
        } catch (groqError) {
          console.error('❌ Groq failed, falling back:', groqError.message);
          providerUsed = 'fallback';
          answer = this.formatSimpleResponse(relevantDocs, input);
        }
      } else if (this.useDeepSeek) {
        try {
          console.log('🤖 Using DeepSeek for response...');
          answer = await deepseekService.generateCompletion(prompt);
        } catch (deepseekError) {
          console.error('❌ DeepSeek failed, falling back:', deepseekError.message);
          providerUsed = 'fallback';
          answer = this.formatSimpleResponse(relevantDocs, input);
        }
      } else {
        answer = this.formatSimpleResponse(relevantDocs, input);
      }
      
      return {
        answer: answer.trim(),
        sources: relevantDocs,
        contextUsed: true,
        provider: providerUsed
      };
      
    } catch (error) {
      console.error('❌ RAG chain error:', error);
      
      return {
        answer: "I'm here to help! I can search for information in my knowledge base. What would you like to know?",
        sources: [],
        contextUsed: false,
        provider: 'error'
      };
    }
  }

  formatSimpleResponse(documents, question) {
    if (documents.length === 0) {
      return "I couldn't find any relevant information in my knowledge base.";
    }
    
    const topDoc = documents[0];
    const otherDocs = documents.slice(1);
    
    let response = `I found ${documents.length} relevant document(s) about "${question}". Here's the most relevant information:\n\n`;
    response += `**${topDoc.title}**\n`;
    response += `${topDoc.body_v2.substring(0, 100000)}${topDoc.body_v2.length > 400 ? '...' : ''}\n`;
    
    if (otherDocs.length > 0) {
      response += `\nOther relevant documents:\n`;
      otherDocs.forEach((doc, index) => {
        response += `• ${doc.title}\n`;
      });
    }
    
    return response;
  }

  // Switch between providers dynamically
  async switchProvider(provider) {
    if (provider === 'groq') {
      this.useGroq = true;
      this.useDeepSeek = false;
      this.currentProvider = 'groq';
    } else if (provider === 'deepseek') {
      this.useGroq = true;
      this.useDeepSeek = false;
      this.currentProvider = 'deepseek';
    } else {
      this.useGroq = true;
      this.useDeepSeek = false;
      this.currentProvider = 'fallback';
    }
    
    console.log(`🔄 Switched to provider: ${this.currentProvider}`);
    return this.currentProvider;
  }

  async checkHealth() {
    const health = {
      currentProvider: this.currentProvider,
      groq: await groqService.checkHealth(),
      deepseek: await deepseekService.checkHealth().catch(() => false),
      elasticsearch: await elasticsearchService.checkConnection()
    };

    return health;
  }

  getSimpleResponse(input) {
    const lowerInput = input.toLowerCase().trim();
    const simpleResponses = {
      'hi': 'Hello! I can help you search for information in my knowledge base. What would you like to know?',
      'hello': 'Hi there! I\'m ready to help you find information. What topic are you interested in?',
      'hey': 'Hey! How can I assist you today?',
      // ... other simple responses
    };
    
    return simpleResponses[lowerInput];
  }
}

module.exports = new LLMService();