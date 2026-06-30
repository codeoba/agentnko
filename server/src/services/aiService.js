import { GoogleGenerativeAI } from '@google/generative-ai';
import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';

export async function askAI(prompt, systemPrompt, config, audioBase64 = null) {
  const { provider, model, api_key, temperature } = config;
  const activeApiKey = api_key || getPlatformApiKey(provider);

  if (!activeApiKey) {
    throw new Error(`API key not configured for AI provider: ${provider}`);
  }

  try {
    switch (provider) {
      case 'gemini':
        return await callGemini(prompt, systemPrompt, activeApiKey, model, temperature, audioBase64);
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

async function callGemini(prompt, systemPrompt, apiKey, model = 'gemini-2.0-flash', temperature = 0.7, audioBase64 = null) {
  const selectedModel = model || 'gemini-2.0-flash';
  let attempts = 0;
  const maxAttempts = 2;
  
  while (attempts < maxAttempts) {
    attempts++;
    try {
      const genAI = new GoogleGenerativeAI(apiKey);
      const aiModel = genAI.getGenerativeModel({
        model: selectedModel,
        systemInstruction: systemPrompt
      }, { apiVersion: 'v1beta' });
      
      const parts = [{ text: prompt }];
      if (audioBase64) {
        parts.unshift({
          inlineData: {
            data: audioBase64,
            mimeType: 'audio/ogg; codecs=opus'
          }
        });
      }

      const result = await aiModel.generateContent({
        contents: [{ role: 'user', parts: parts }],
        generationConfig: { temperature: temperature }
      });
      return result.response.text();
    } catch (err) {
      console.log(`Gemini call attempt ${attempts} failed for model ${selectedModel}:`, err.message || err);
      
      if (attempts < maxAttempts && (err.message.includes('503') || err.message.includes('429') || err.status === 503 || err.status === 429 || err.message.includes('overloaded') || err.message.includes('quota') || err.message.includes('limit'))) {
        console.log(`Temporary error detected. Waiting 2.5 seconds before retry...`);
        await new Promise(resolve => setTimeout(resolve, 2500));
        continue;
      }
      throw err;
    }
  }
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
  let selectedModel = model || 'meta-llama/llama-3-8b-instruct:free';
  if (selectedModel === 'gemini-2.0-flash' || selectedModel === 'gemini-2.5-flash' || selectedModel === 'google/gemini-2.0-flash' || selectedModel === 'google/gemini-2.0-flash-001' || selectedModel === 'google/gemini-2.0-flash-exp:free') {
    selectedModel = 'openrouter/free';
  } else if (selectedModel === 'gemini-1.5-flash' || selectedModel === 'google/gemini-1.5-flash' || selectedModel === 'google/gemini-flash-1.5') {
    selectedModel = 'openrouter/free';
  }

  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://agentnko.com', // Optional, for OpenRouter analytics
      'X-Title': 'AgentNKO'
    },
    body: JSON.stringify({
      model: selectedModel,
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
