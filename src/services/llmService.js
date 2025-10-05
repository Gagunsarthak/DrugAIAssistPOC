const deepseekService = require('./deepseek');
const elasticsearchService = require('./elasticsearch');

class LLMService {
  getSystemPrompt() {
    return `You are a medical expert with advanced knowledge in clinical reasoning, diagnostics, and treatment planning.

You are an assistant for question-answering tasks. 
Use the following pieces of retrieved context to answer the question. If you don't get the context along with the question, provide us with the most thoughtful answer you can. 
Write a response that appropriately completes the request.

Before answering, think carefully about the question and create a step-by-step chain of thoughts to ensure a logical and accurate response.

Please answer the following medical question with reference to the context if it exists.

### Instruction:

{context}

{input}`;
  }

  async ragChain(input) {
    try {
      console.log('🔄 Starting RAG chain...');
      
      // 1. Retrieve documents from Elasticsearch
      const relevantDocs = await elasticsearchService.retrieveRelevantDocuments(input, 'documents', 5);
      
      // 2. Format context
      const context = relevantDocs.map(doc => 
        `Title: ${doc.title}\nContent: ${doc.content}`
      ).join('\n\n');
      
      // 3. Build prompt
      const prompt = this.getSystemPrompt()
        .replace('{context}', context)
        .replace('{input}', input);
      
      console.log('🤖 Calling DeepSeek...');
      
      // 4. Generate answer
      const answer = await deepseekService.generateCompletion(prompt);
      
      return {
        answer: answer.trim(),
        sources: relevantDocs,
        contextUsed: context.length > 0
      };
      
    } catch (error) {
      console.error('❌ RAG chain error:', error);
      
      // FALLBACK: Show the Elasticsearch data we obtained
      try {
        const relevantDocs = await elasticsearchService.retrieveRelevantDocuments(input, 'documents', 3);
        
        if (relevantDocs.length > 0) {
          // Format the Elasticsearch results into a helpful response
          const topDoc = relevantDocs[0];
          const answer = this.formatElasticsearchResults(relevantDocs, input);
          
          return {
            answer: answer,
            sources: relevantDocs,
            contextUsed: true,
            fallback: true
          };
        } else {
          // No documents found in Elasticsearch
          return {
            answer: "I searched my knowledge base but couldn't find specific information about that. Could you try rephrasing your question or ask about a different topic?",
            sources: [],
            contextUsed: false,
            fallback: true
          };
        }
      } catch (fallbackError) {
        // Even the fallback search failed
        return {
          answer: "I'm here to help! I can search for information in my knowledge base. What would you like to know?",
          sources: [],
          contextUsed: false,
          fallback: true
        };
      }
    }
  }

  formatElasticsearchResults(documents, question) {
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
        response += `• ${doc.title}\n`;
      });
    }
    
    response += `\nThis information was retrieved from my knowledge base using semantic search.`;
    
    return response;
  }

  // Simple responses for common queries (bypasses LLM when needed)
  getSimpleResponse(input) {
    const lowerInput = input.toLowerCase().trim();
    const simpleResponses = {
      'hi': 'Hello! I can help you search for information in my knowledge base. What would you like to know?',
      'hello': 'Hi there! I\'m ready to help you find information. What topic are you interested in?',
      'introduce yourself': 'I\'m a search assistant that can find and present information from my knowledge base. Ask me anything!',
      'who are you': 'I\'m an AI assistant that searches through documents to find relevant information for you.',
      'what can you do': 'I can search my knowledge base for information and present it to you in a helpful way. Try asking me about any topic!',
      'thanks': 'You\'re welcome! Let me know if you need more information.',
      'thank you': 'Happy to help! Feel free to ask if you have more questions.'
    };
    
    return simpleResponses[lowerInput];
  }
}

module.exports = new LLMService();