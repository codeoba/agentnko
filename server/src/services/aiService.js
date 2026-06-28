import { GoogleGenerativeAI } from '@google/generative-ai';
import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';

export async function askAI(prompt, systemPrompt, config) {
  const { provider, model, api_key, temperature } = config;
  const activeApiKey = api_key || getPlatformApiKey(provider);

  if (!activeApiKey) {
    throw new Error(`API key not configured for AI provider: ${provider}`);
  }

  try {
    switch (provider) {
      case 'gemini':
        return await callGemini(prompt, systemPrompt, activeApiKey, model, temperature);
      case 'openai':
        return await callOpenAI(prompt, systemPrompt, activeApiKey, model, temperature);
      case 'claude':
        return await callAnthropic(prompt, systemPrompt, activeApiKey, model, temperature);
      case 'openrouter':
        return await callOpenRouter(prompt, systemPrompt, activeApiKey, model, temperature);
      default:
        throw new Error(`Unknown AI provider: ${provider}`);
    }
  } catch (err) {
    console.error(`AI calling error with provider ${provider}:`, err);
    throw err;
  }
}

function getPlatformApiKey(provider) {
  switch (provider) {
    case 'gemini': return process.env.GEMINI_API_KEY;
    case 'openai': return process.env.OPENAI_API_KEY;
    case 'claude': return process.env.ANTHROPIC_API_KEY;
    case 'openrouter': return process.env.OPENROUTER_API_KEY;
    default: return null;
  }
}

async function callGemini(prompt, systemPrompt, apiKey, model = 'gemini-1.5-flash', temperature = 0.7) {
  const genAI = new GoogleGenerativeAI(apiKey);
  const aiModel = genAI.getGenerativeModel({
    model: model || 'gemini-1.5-flash',
    systemInstruction: systemPrompt
  });
  const result = await aiModel.generateContent({
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: { temperature: temperature }
  });
  return result.response.text();
}

async function callOpenAI(prompt, systemPrompt, apiKey, model = 'gpt-4o-mini', temperature = 0.7) {
  const openai = new OpenAI({ apiKey });
  const response = await openai.chat.completions.create({
    model: model || 'gpt-4o-mini',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: prompt }
    ],
    temperature: temperature
  });
  return response.choices[0]?.message?.content || '';
}

async function callAnthropic(prompt, systemPrompt, apiKey, model = 'claude-3-5-sonnet-20240620', temperature = 0.7) {
  const anthropic = new Anthropic({ apiKey });
  const response = await anthropic.messages.create({
    model: model || 'claude-3-5-sonnet-20240620',
    max_tokens: 1024,
    system: systemPrompt,
    messages: [{ role: 'user', content: prompt }],
    temperature: temperature
  });
  return response.content[0]?.text || '';
}

async function callOpenRouter(prompt, systemPrompt, apiKey, model = 'meta-llama/llama-3-8b-instruct:free', temperature = 0.7) {
  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://agentnko.com', // Optional, for OpenRouter analytics
      'X-Title': 'AgentNKO'
    },
    body: JSON.stringify({
      model: model || 'meta-llama/llama-3-8b-instruct:free',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: prompt }
      ],
      temperature: temperature
    })
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data?.error?.message || `OpenRouter returned status ${response.status}`);
  }
  return data.choices[0]?.message?.content || '';
}
