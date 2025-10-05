const express = require('express');
const llmService = require('../services/llmservice');
const elasticsearchService = require('../services/elasticsearch');

const router = express.Router();

// Simple RAG endpoint - just like your Python version
router.post('/query', async (req, res) => {
  try {
    const { question, sessionId = 'default' } = req.body;

    if (!question) {
      return res.status(400).json({ error: 'Question is required' });
    }

    console.log(`💬 Processing: "${question}"`);

    // Check for simple responses first (bypasses everything for common queries)
    const simpleResponse = llmService.getSimpleResponse?.(question);
    if (simpleResponse) {
      return res.json({
        question,
        answer: simpleResponse,
        sources: [],
        totalSources: 0,
        simpleResponse: true
      });
    }

    // Single RAG chain call - just like Python's rag_chain.invoke()
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
      fallback: result.fallback || false
    });

  } catch (error) {
    console.error('RAG query error:', error);
    
    // FALLBACK: Show Elasticsearch data instead of generic error
    try {
      const relevantDocs = await elasticsearchService.retrieveRelevantDocuments(question, 'documents', 3);
      
      if (relevantDocs.length > 0) {
        // Format the Elasticsearch results into a helpful response
        const answer = formatElasticsearchFallback(relevantDocs, question);
        
        return res.json({
          question,
          answer: answer,
          sources: relevantDocs.map(doc => ({
            title: doc.title,
            score: doc.score ? doc.score.toFixed(4) : 'N/A',
            content: doc.content?.substring(0, 100) + '...'
          })),
          totalSources: relevantDocs.length,
          fallback: true,
          error: true
        });
      } else {
        // No documents found
        return res.json({
          question,
          answer: "I searched my knowledge base but couldn't find specific information about that. Could you try rephrasing your question or ask about a different topic?",
          sources: [],
          totalSources: 0,
          fallback: true,
          error: true
        });
      }
    } catch (fallbackError) {
      // Even the fallback search failed
      console.error('Fallback also failed:', fallbackError);
      return res.json({
        question,
        answer: "I'm here to help! I can search for information in my knowledge base. What would you like to know?",
        sources: [],
        totalSources: 0,
        fallback: true,
        error: true
      });
    }
  }
});

// Helper function to format Elasticsearch results when LLM fails
function formatElasticsearchFallback(documents, question) {
  if (documents.length === 0) {
    return "I couldn't find any relevant information in my knowledge base.";
  }
  
  const topDoc = documents[0];
  const otherDocs = documents.slice(1);
  
  let response = `I found ${documents.length} relevant document(s) about "${question}". Here's the most relevant information:\n\n`;
  response += `**${topDoc.title}**\n`;
  response += `${topDoc.content.substring(0, 400)}${topDoc.content.length > 400 ? '...' : ''}\n`;
  
  if (otherDocs.length > 0) {
    response += `\nOther relevant documents:\n`;
    otherDocs.forEach((doc, index) => {
      response += `• ${doc.title} (score: ${doc.score ? doc.score.toFixed(4) : 'N/A'})\n`;
    });
  }
  
  response += `\nThis information was retrieved directly from the knowledge base.`;
  
  return response;
}

// Test endpoint
router.post('/test-rag', async (req, res) => {
  try {
    const { question = 'What is Acne?' } = req.body;
    const result = await llmService.ragChain(question);
    
    res.json({
      question,
      answer: result.answer,
      sourcesCount: result.sources.length,
      fallback: result.fallback || false
    });
  } catch (error) {
    // Show Elasticsearch data even in test endpoint
    try {
      const relevantDocs = await elasticsearchService.retrieveRelevantDocuments(question, 'documents', 3);
      const answer = formatElasticsearchFallback(relevantDocs, question);
      
      res.json({
        question,
        answer: answer,
        sourcesCount: relevantDocs.length,
        fallback: true,
        error: error.message
      });
    } catch (fallbackError) {
      res.status(500).json({ 
        error: error.message,
        fallbackError: fallbackError.message 
      });
    }
  }
});

// Health check endpoint
router.get('/health', async (req, res) => {
  try {
    const esHealth = await elasticsearchService.checkConnection();
    res.json({
      elasticsearch: esHealth ? 'connected' : 'disconnected',
      status: 'ok'
    });
  } catch (error) {
    res.status(500).json({
      elasticsearch: 'error',
      status: 'error',
      message: error.message
    });
  }
});

module.exports = router;