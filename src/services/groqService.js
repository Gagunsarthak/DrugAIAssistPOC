const axios = require('axios');

class GroqService {
  constructor() {
    this.apiKey = process.env.GROQ_API_KEY;
    this.baseURL = 'https://api.groq.com/openai/v1';
    this.model = process.env.GROQ_MODEL || 'llama-3.1-8b-instant';
    this.maxTokens = 1000;
    this.temperature = 0.5; // Lower for more consistent RAG responses
  }

  async generateCompletion(prompt, systemMessage = null) {
    try {
      const messages = [];

      // Add system message if provided
      if (systemMessage) {
        messages.push({
          role: 'system',
          content: systemMessage
        });
      }

      // Add user message
      messages.push({
        role: 'user',
        content: prompt
      });

      const response = await axios.post(
        `${this.baseURL}/chat/completions`,
        {
          model: this.model,
          messages: messages,
          temperature: this.temperature,
          max_tokens: this.maxTokens,
          stream: false
        },
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json'
          },
          timeout: 30000
        }
      );

      return response.data.choices[0].message.content;
    } catch (error) {
      console.error('❌ Groq API error:', error.response?.data || error.message);
      throw new Error(`Groq API call failed: ${error.response?.data?.error?.message || error.message}`);
    }
  }

  async generateRAGResponse(question, context) {
    const systemMessage = ` You are a medical expert with advanced knowledge in clinical reasoning, diagnostics, and treatment planning."

    "You are an assistant for question-answering tasks. "
    "Use the following pieces of retrieved context to answer "
    "the question. If you don't get the context along with the question, provide us with the most thoughtful answer you can. "
    "Write a response that appropriately completes the request."
"Before answering, think carefully about the question and create a step-by-step chain of thoughts to ensure a logical and accurate response."
"Please answer the following medical question with reference to the context if it exists.

CONTEXT:
${context}

INSTRUCTIONS:
1. Answer based ONLY on the provided context
2. If the context doesn't contain relevant correct information, use your own intelligence to answer that question"
3. Be concise and accurate
4. Cite information from the context when possible
5. Consider the content of a document will be in nested structur like body_v2 [*].body_text,body_v2 [*].title etc

QUESTION: ${question}

ANSWER:`;

    return await this.generateCompletion(systemMessage);
  }

  async checkHealth() {
    try {
      await this.generateCompletion('Hello', 'You are a test assistant. Respond with "OK"');
      return true;
    } catch (error) {
      console.error('❌ Groq health check failed:', error.message);
      return false;
    }
  }

  // Get available Groq models
  async getAvailableModels() {
    try {
      const response = await axios.get(`${this.baseURL}/models`, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        }
      });

      return response.data.data
        .filter(model => model.id.includes('groq'))
        .map(model => ({
          id: model.id,
          name: model.id.replace('groq/', ''),
          description: 'Groq model'
        }));
    } catch (error) {
      console.error('Error fetching Groq models:', error.message);
      return [];
    }
  }
}

module.exports = new GroqService();