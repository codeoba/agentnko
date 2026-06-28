import { GoogleGenerativeAI } from '@google/generative-ai';

const apiKey = process.argv[2];

if (!apiKey) {
  console.error("Please provide your Gemini API key as an argument:");
  console.error("node test_gemini.js <YOUR_API_KEY>");
  process.exit(1);
}

const modelsToTest = [
  'gemini-1.5-flash',
  'gemini-1.5-flash-latest',
  'gemini-1.5-pro',
  'gemini-pro'
];

async function testModel(modelName) {
  console.log(`\nTesting model: ${modelName}...`);
  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const aiModel = genAI.getGenerativeModel({ model: modelName });
    const result = await aiModel.generateContent("Sema 'Habari za leo' tu.");
    console.log(`✅ SUCCESS [${modelName}]:`, result.response.text().trim());
    return true;
  } catch (err) {
    console.error(`❌ FAILED [${modelName}]:`, err.message);
    return false;
  }
}

async function run() {
  console.log("Starting Gemini API models connection tests...");
  let successCount = 0;
  for (const model of modelsToTest) {
    const ok = await testModel(model);
    if (ok) successCount++;
  }
  console.log(`\nTests finished. ${successCount} out of ${modelsToTest.length} models succeeded.`);
}

run().catch(console.error);
