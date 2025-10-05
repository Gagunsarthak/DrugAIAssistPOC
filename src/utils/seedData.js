require('dotenv').config();
const elasticsearchService = require('../services/elasticsearch');

const sampleDocuments = [
  {
    title: "Introduction to Artificial Intelligence",
    content: "Artificial Intelligence (AI) refers to the simulation of human intelligence in machines that are programmed to think like humans and mimic their actions. The term may also be applied to any machine that exhibits traits associated with a human mind such as learning and problem-solving.",
    keywords: ["AI", "machine learning", "intelligence"],
    category: "technology"
  },
  {
    title: "Machine Learning Basics",
    content: "Machine learning is a method of data analysis that automates analytical model building. It is a branch of artificial intelligence based on the idea that systems can learn from data, identify patterns and make decisions with minimal human intervention.",
    keywords: ["machine learning", "data analysis", "algorithms"],
    category: "technology"
  },
  {
    title: "Natural Language Processing",
    content: "Natural Language Processing (NLP) is a subfield of linguistics, computer science, and artificial intelligence concerned with the interactions between computers and human language, in particular how to program computers to process and analyze large amounts of natural language data.",
    keywords: ["NLP", "language processing", "text analysis"],
    category: "technology"
  }
];

async function seedData() {
  try {
    console.log('🤗 Seeding data with Hugging Face embeddings...\n');

    console.log('Checking Elasticsearch connection...');
    const isConnected = await elasticsearchService.checkConnection();
    
    if (!isConnected) {
      console.error('❌ Cannot connect to Elasticsearch');
      return;
    }

    console.log('✅ Elasticsearch connection successful');

    // Create index with vector support
    console.log('\nCreating index with vector support...');
    await elasticsearchService.createIndex('documents');

    console.log('\nSeeding sample data with embeddings...');
    
    let successCount = 0;
    for (const doc of sampleDocuments) {
      try {
        await elasticsearchService.indexDocument(doc, 'documents', true);
        console.log(`✅ Indexed with embedding: ${doc.title}`);
        successCount++;
        
        // Small delay to avoid overwhelming the system
        await new Promise(resolve => setTimeout(resolve, 500));
      } catch (docError) {
        console.error(`❌ Failed to index: ${doc.title}`, docError.message);
      }
    }

    console.log(`\n📊 Seeding completed: ${successCount}/${sampleDocuments.length} documents indexed with embeddings`);

  } catch (error) {
    console.error('❌ Error seeding data:', error.message);
  }
}

if (require.main === module) {
  seedData();
}

module.exports = { sampleDocuments, seedData };