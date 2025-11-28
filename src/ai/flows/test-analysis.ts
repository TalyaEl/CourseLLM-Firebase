import { config } from 'dotenv';
config({ path: '.env.local' });

import { analyzeMessageFlow } from './analyze-message';
import { Client } from 'pg';

async function runIntegrationTest() {
  console.log("🚀 Starting DB Integration Test...");

  // --- Test Case 1: Concept Confusion ---
  console.log("\n--- Test Case 1: Struggling Student ---");
  
  const input1 = {
    message: "I really don't understand how recursion works, the base case makes no sense to me.",
    threadId: "test-thread-001", // חובה בשביל ה-DB
    messageId: "msg-001"         // חובה בשביל ה-DB
  };

  try {
    const result1 = await analyzeMessageFlow(input1);
    console.log("AI Output:", JSON.stringify(result1, null, 2));

    console.log("Verifying persistence in DB...");
    const client = new Client({ connectionString: process.env.DATABASE_URL });
    await client.connect();
    
    const res = await client.query("SELECT * FROM interaction_analysis WHERE message_id = $1", ['msg-001']);
    
    if (res.rows.length > 0) {
      console.log("✅ SUCCESS! Row found in DB:", res.rows[0]);
    } else {
      console.error("❌ FAILURE: Row NOT found in DB.");
    }
    await client.end();

  } catch (error) {
    console.error("❌ Test 1 Error:", error);
  }

  // --- Test Case 2: Off Topic ---
  console.log("\n--- Test Case 2: Off Topic ---");
  
  const input2 = {
    message: "Write me a poem about a cat coding in Java.",
    threadId: "test-thread-002",
    messageId: "msg-002"
  };

  try {
    const result2 = await analyzeMessageFlow(input2);
    console.log("AI Output:", JSON.stringify(result2, null, 2));
    // כאן אפשר להוסיף בדיקת DB נוספת אם רוצים, אבל הבנו את העקרון
  } catch (error) {
    console.error("❌ Test 2 Error:", error);
  }
}

runIntegrationTest();