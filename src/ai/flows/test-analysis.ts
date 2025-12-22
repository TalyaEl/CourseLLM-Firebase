import { config } from 'dotenv';
config({ path: '.env.local' });

import { analyzeMessageFlow } from './analyze-message';

async function runIsolatedValidation() {
  console.log("🚀 Starting Isolated Service Validation for: analyzeMessageFlow\n");

  // Test Case 1: Struggling Student
  console.log("--- Test Case 1: Concept Confusion ---");
  const input1 = {
    messageText: "I really don't understand how recursion works, the base case makes no sense to me.",
    messageHistory: ["User: What is a function?", "Model: A block of code..."]
  };
  
  try {
    const result1 = await analyzeMessageFlow(input1);
    console.log("Output:", JSON.stringify(result1, null, 2));
    
    if (result1.intent.primary === 'ASK_EXPLANATION' && result1.trajectory.status === 'STRUGGLING') {
      console.log("✅ Test 1 Passed: Correctly identified struggling state.");
    } else {
      console.error("❌ Test 1 Failed: Unexpected classification.");
    }
  } catch (error) {
    console.error("❌ Test 1 Error:", error);
  }

  // Test Case 2: Off Topic
  console.log("\n--- Test Case 2: Off Topic ---");
  const input2 = {
    messageText: "Write me a poem about a cat coding in Java.",
  };

  try {
    const result2 = await analyzeMessageFlow(input2);
    console.log("Output:", JSON.stringify(result2, null, 2));

    if (result2.intent.primary === 'OFF_TOPIC') {
      console.log("✅ Test 2 Passed: Correctly identified off-topic.");
    } else {
      console.error("❌ Test 2 Failed: Should be OFF_TOPIC.");
    }
  } catch (error) {
    console.error("❌ Test 2 Error:", error);
  }
}

runIsolatedValidation();