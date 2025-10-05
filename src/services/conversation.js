class ConversationService {
    constructor() {
      this.sessions = new Map();
      this.sessionTimeout = 30 * 60 * 1000; // 30 minutes
    }
  
    // Create or get session
    getSession(sessionId) {
      this.cleanupExpiredSessions();
      
      if (!this.sessions.has(sessionId)) {
        this.sessions.set(sessionId, {
          id: sessionId,
          createdAt: new Date(),
          lastActivity: new Date(),
          messages: [],
          context: [] // Store previous search contexts for follow-ups
        });
      }
      
      const session = this.sessions.get(sessionId);
      session.lastActivity = new Date();
      return session;
    }
  
    // Add message to conversation history
    addMessage(sessionId, role, content, sources = null) {
      const session = this.getSession(sessionId);
      const message = {
        role,
        content,
        timestamp: new Date(),
        sources
      };
      
      session.messages.push(message);
      
      // Keep only last 20 messages to prevent memory issues
      if (session.messages.length > 20) {
        session.messages = session.messages.slice(-20);
      }
      
      return message;
    }
  
    // Add context for follow-up questions
    addContext(sessionId, question, sources, searchResults) {
      const session = this.getSession(sessionId);
      session.context.push({
        question,
        sources,
        searchResults,
        timestamp: new Date()
      });
      
      // Keep only last 5 contexts
      if (session.context.length > 5) {
        session.context = session.context.slice(-5);
      }
    }
  
    // Get conversation history for context
    getConversationHistory(sessionId, maxMessages = 10) {
      const session = this.getSession(sessionId);
      return session.messages.slice(-maxMessages);
    }
  
    // Get recent context for follow-up questions
    getRecentContext(sessionId) {
      const session = this.getSession(sessionId);
      if (session.context.length === 0) return null;
      
      return session.context[session.context.length - 1];
    }
  
    // Build context for follow-up questions
    buildFollowUpContext(currentQuestion, sessionId) {
      const recentContext = this.getRecentContext(sessionId);
      const conversationHistory = this.getConversationHistory(sessionId, 5);
      
      if (!recentContext) {
        return {
          shouldUseVectorSearch: true,
          context: ""
        };
      }
  
      // Check if this is a follow-up to the last question
      const isFollowUp = this.isFollowUpQuestion(currentQuestion, recentContext.question);
      
      if (isFollowUp) {
        return {
          shouldUseVectorSearch: false,
          context: this.buildContextFromPreviousResults(recentContext),
          previousQuestion: recentContext.question,
          sources: recentContext.sources
        };
      } else {
        return {
          shouldUseVectorSearch: true,
          context: ""
        };
      }
    }
  
    // Simple follow-up detection
    isFollowUpQuestion(currentQuestion, previousQuestion) {
      const followUpIndicators = [
        'it', 'that', 'this', 'they', 'them', 'those', 'these',
        'more', 'further', 'another', 'else', 'what about', 'how about',
        'explain', 'elaborate', 'clarify', 'tell me more'
      ];
      
      const currentLower = currentQuestion.toLowerCase();
      const previousLower = previousQuestion.toLowerCase();
      
      // If question is very short or uses pronouns, likely a follow-up
      if (currentLower.split(' ').length <= 3) return true;
      
      // Check for follow-up indicators
      return followUpIndicators.some(indicator => 
        currentLower.includes(indicator)
      );
    }
  
    // Build context from previous search results
    buildContextFromPreviousResults(recentContext) {
      return `Previous question: ${recentContext.question}
  
  Previous search results:
  ${recentContext.searchResults.map((doc, index) => 
    `[Document ${index + 1}] ${doc.title}: ${doc.content}`
  ).join('\n\n')}`;
    }
  
    // Clean up expired sessions
    cleanupExpiredSessions() {
      const now = new Date();
      for (const [sessionId, session] of this.sessions.entries()) {
        if (now - session.lastActivity > this.sessionTimeout) {
          this.sessions.delete(sessionId);
        }
      }
    }
  
    // Get session stats
    getStats() {
      return {
        activeSessions: this.sessions.size,
        totalMessages: Array.from(this.sessions.values())
          .reduce((sum, session) => sum + session.messages.length, 0)
      };
    }
  }
  
  module.exports = new ConversationService();