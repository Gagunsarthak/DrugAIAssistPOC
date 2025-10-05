const { ChatOpenAI } = require("@langchain/openai");
const { MemoryVectorStore } = require("langchain/vectorstores/memory");
const { OpenAIEmbeddings } = require("@langchain/openai-embeddings");
const { PromptTemplate } = require("@langchain/core/prompts");
const { StringOutputParser } = require("@langchain/core/output_parsers");
const { RunnableSequence, RunnablePassthrough } = require("@langchain/core/runnables");
const { ChatPromptTemplate } = require("@langchain/core/prompts");

class LangChainService {
  constructor() {
    this.llm = null;
    this.embeddings = null;
    this.vectorStore = null;
    this.conversationMemory = new Map();
  }

  async initialize() {
    if (!this.llm) {
      // Use DeepSeek via OpenRouter
      this.llm = new ChatOpenAI({
        openAIApiKey: process.env.DEEPSEEK_API_KEY,
        configuration: {
          baseURL: "https://openrouter.ai/api/v1",
        },
        modelName: process.env.DEEPSEEK_MODEL || "deepseek/deepseek-r1-distill-llama-8b:free",
        temperature: 0.7,
        maxTokens: 1000,
      });

      // Use Hugging Face embeddings (free)
      this.embeddings = new OpenAIEmbeddings({
        openAIApiKey: "fake-key", // Not needed for local embeddings
        model: "local" // We'll use our Hugging Face embeddings
      });

      console.log("✅ LangChain initialized with DeepSeek LLM");
    }
  }

  // Enhanced RAG chain with proper query understanding
  async createRAGChain() {
    await this.initialize();

    // System prompt for the assistant
    const systemTemplate = `You are a helpful AI assistant. Use the following context to answer the user's question.

Context:
{context}

Conversation History:
{history}

Current Question: {question}

Instructions:
1. Answer based ONLY on the provided context
2. If the context doesn't contain relevant information, say so
3. Be conversational and natural
4. Keep responses concise but informative
5. Maintain conversation flow`;

    const prompt = ChatPromptTemplate.fromMessages([
      ["system", systemTemplate],
      ["human", "{question}"]
    ]);

    // Create the RAG chain
    const chain = RunnableSequence.from([
      {
        context: (input) => this.retrieveRelevantDocuments(input.question, input.sessionId),
        history: (input) => this.getConversationHistory(input.sessionId),
        question: (input) => input.question,
        sessionId: (input) => input.sessionId
      },
      prompt,
      this.llm,
      new StringOutputParser()
    ]);

    return chain;
  }

  async retrieveRelevantDocuments(question, sessionId, k = 5) {
    try {
      // Use your existing Elasticsearch service for retrieval
      const elasticsearchService = require('./elasticsearch');
      
      // Analyze query intent first
      const intent = await this.analyzeQueryIntent(question);
      
      if (intent.type !== 'search') {
        return "No specific context needed for this type of query.";
      }

      // Perform semantic search
      const results = await elasticsearchService.hybridSearch(question, 'documents', k);
      
      if (!results || results.length === 0) {
        return "No relevant documents found.";
      }

      // Format context from results
      return results.map(doc => 
        `Title: ${doc.title}\nContent: ${doc.content}\nRelevance Score: ${doc.score}`
      ).join('\n\n');

    } catch (error) {
      console.error('Document retrieval error:', error);
      return "Error retrieving documents.";
    }
  }

  // Advanced query intent analysis
  async analyzeQueryIntent(query) {
    const lowerQuery = query.toLowerCase().trim();
    
    // Greetings and small talk
    const greetings = ['hi', 'hello', 'hey', 'good morning', 'good afternoon'];
    const farewells = ['bye', 'goodbye', 'see you', 'farewell'];
    const thanks = ['thanks', 'thank you', 'appreciate it'];
    
    if (greetings.some(g => lowerQuery.includes(g))) {
      return { type: 'greeting', confidence: 0.95 };
    }
    
    if (farewells.some(f => lowerQuery.includes(f))) {
      return { type: 'farewell', confidence: 0.95 };
    }
    
    if (thanks.some(t => lowerQuery.includes(t))) {
      return { type: 'thanks', confidence: 0.95 };
    }
    
    // Very short queries that might need clarification
    if (query.split(' ').length <= 2 && query.length < 15) {
      return { type: 'ambiguous', confidence: 0.7 };
    }
    
    return { type: 'search', confidence: 0.9 };
  }

  getConversationHistory(sessionId, maxMessages = 6) {
    const conversationService = require('./conversation');
    const history = conversationService.getConversationHistory(sessionId, maxMessages);
    
    return history.map(msg => 
      `${msg.role}: ${msg.content}`
    ).join('\n');
  }

  // Main query processing method
  async processQuery(question, sessionId = 'default') {
    try {
      // Analyze intent first
      const intent = await this.analyzeQueryIntent(question);
      
      // Handle non-search intents
      switch (intent.type) {
        case 'greeting':
          return {
            answer: this.getGreetingResponse(),
            sources: [],
            searchPerformed: false,
            intent: 'greeting'
          };
        case 'farewell':
          return {
            answer: "Goodbye! Feel free to ask if you have more questions.",
            sources: [],
            searchPerformed: false,
            intent: 'farewell'
          };
        case 'thanks':
          return {
            answer: "You're welcome! Happy to help.",
            sources: [],
            searchPerformed: false,
            intent: 'thanks'
          };
        case 'ambiguous':
          return {
            answer: "Could you please provide more details about what you're looking for?",
            sources: [],
            searchPerformed: false,
            intent: 'ambiguous'
          };
      }

      // For search queries, use the RAG chain
      const ragChain = await this.createRAGChain();
      
      const response = await ragChain.invoke({
        question,
        sessionId
      });

      // Get sources for the response
      const elasticsearchService = require('./elasticsearch');
      const sources = await elasticsearchService.hybridSearch(question, 'documents', 3);

      return {
        answer: response,
        sources: sources || [],
        searchPerformed: true,
        intent: 'search'
      };

    } catch (error) {
      console.error('LangChain processing error:', error);
      
      // Fallback response
      return {
        answer: "I encountered an error while processing your request. Please try again.",
        sources: [],
        searchPerformed: false,
        intent: 'error'
      };
    }
  }

  getGreetingResponse() {
    const greetings = [
      "Hello! How can I help you today?",
      "Hi there! What would you like to know?",
      "Hello! I'm ready to help answer your questions.",
      "Hi! How can I assist you today?"
    ];
    return greetings[Math.floor(Math.random() * greetings.length)];
  }
}

module.exports = new LangChainService();