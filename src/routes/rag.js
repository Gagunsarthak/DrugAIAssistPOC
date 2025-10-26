const express = require('express');
const llmService = require('../services/llmService');
const groqService = require('../services/groqService');
const elasticsearchService = require('../services/elasticsearch');

const router = express.Router();

// Existing RAG query endpoint
router.post('/query', async (req, res) => {
  try {
    const { question, sessionId = 'default' } = req.body;

    if (!question) {
      return res.status(400).json({ error: 'Question is required' });
    }

    console.log(`💬 Processing: "${question}"`);

    // Check for simple responses first
    const simpleResponse = llmService.getSimpleResponse(question);
    if (simpleResponse) {
      return res.json({
        question,
        answer: simpleResponse,
        sources: [],
        totalSources: 0,
        simpleResponse: true,
        provider: 'simple'
      });
    }

    // Use RAG chain
    const result = await llmService.ragChain(question, sessionId);

    res.json({
      question,
      answer: result.answer,
      sources: result.sources.map(doc => ({
        title: doc.title,
        score: doc.score ? doc.score.toFixed(4) : 'N/A',
        content: doc.content?.substring(0, 100) + '...'
      })),
      totalSources: result.sources.length,
      provider: result.provider,
      contextUsed: result.contextUsed
    });

  } catch (error) {
    console.error('RAG query error:', error);
    res.json({
      question: req.body.question,
      answer: "I'm here to help! What would you like to know?",
      sources: [],
      totalSources: 0,
      error: true,
      provider: 'error'
    });
  }
});

// NEW: Switch LLM provider
router.post('/switch-provider', async (req, res) => {
  try {
    const { provider } = req.body; // 'groq', 'deepseek', or 'fallback'
    
    if (!['groq', 'deepseek', 'fallback'].includes(provider)) {
      return res.status(400).json({ error: 'Provider must be groq, deepseek, or fallback' });
    }

    const newProvider = await llmService.switchProvider(provider);
    
    res.json({
      message: `Switched to ${newProvider} provider`,
      provider: newProvider,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// NEW: Test Groq directly
router.post('/test-groq', async (req, res) => {
  try {
    const { 
      prompt = 'Hello, who are you?',
      systemMessage = null 
    } = req.body;

    const response = await groqService.generateCompletion(prompt, systemMessage);
    
    res.json({
      provider: 'groq',
      model: groqService.model,
      response,
      prompt
    });
  } catch (error) {
    res.status(500).json({
      error: 'Groq test failed',
      message: error.message
    });
  }
});

// NEW: Get available Groq models
router.get('/groq-models', async (req, res) => {
  try {
    const models = await groqService.getAvailableModels();
    
    res.json({
      provider: 'groq',
      currentModel: groqService.model,
      availableModels: models
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to fetch Groq models',
      message: error.message
    });
  }
});

// NEW: Health check for all services
router.get('/health', async (req, res) => {
  try {
    const health = await llmService.checkHealth();
    
    res.json({
      status: 'OK',
      services: health,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      status: 'ERROR',
      message: error.message
    });
  }
});

// NEW: Compare providers
router.post('/compare-providers', async (req, res) => {
  try {
    const { question = 'What is machine learning?' } = req.body;

    const relevantDocs = await elasticsearchService.retrieveRelevantDocuments(question, 'salt', 3);
    const context = elasticsearchService.formatDocumentsForContext(relevantDocs);
    
    const prompt = llmService.getSystemPrompt()
      .replace('{context}', context)
      .replace('{input}', question);

    const results = {};

    // Test Groq
    try {
      results.groq = await groqService.generateCompletion(prompt);
    } catch (error) {
      results.groq = `Error: ${error.message}`;
    }

    // Test DeepSeek
    try {
      results.deepseek = await deepseekService.generateCompletion(prompt);
    } catch (error) {
      results.deepseek = `Error: ${error.message}`;
    }

    // Fallback
    results.fallback = llmService.formatSimpleResponse(relevantDocs, question);

    res.json({
      question,
      context: context.substring(0, 200) + '...',
      results,
      sources: relevantDocs.length
    });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;