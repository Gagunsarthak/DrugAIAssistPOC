const axios = require('axios');

class DeepSeekService {
  constructor() {
    this.apiKey = process.env.DEEPSEEK_API_KEY;
    this.baseURL = 'https://openrouter.ai/api/v1';
    this.modelName = process.env.DEEPSEEK_MODEL || 'deepseek/deepseek-r1-0528:free';
    this.temperature = 0.4;
    this.maxTokens = 500;
  }

  async generateCompletion(prompt) {
    try {
      console.log(`🤖 Calling DeepSeek with model: ${this.modelName}`);
      
      const response = await axios.post(
        `${this.baseURL}/chat/completions`,
        {
          model: this.modelName,
          messages: [
            {
              role: 'user',
              content: prompt
            }
          ],
          temperature: this.temperature,
          max_tokens: this.maxTokens
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
      console.error('❌ DeepSeek API error:', error.response?.data || error.message);
      throw new Error('DeepSeek API call failed');
    }
  }

  async checkHealth() {
    try {
      await this.generateCompletion('Hello');
      return true;
    } catch (error) {
      return false;
    }
  }
}

module.exports = new DeepSeekService();