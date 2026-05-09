#!/usr/bin/env node
/**
 * generate-ai-suggestions.js
 * health-data.json を読み込み、Gemini API で改善提案を生成して data/ai-suggestions.json に保存する
 * Gemini API が使えない場合はフォールバック提案を生成する
 */

import 'dotenv/config';
import { GoogleGenerativeAI } from '@google/generative-ai';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { PHASES } from '../config/settings.js';
import { generateFallbackSuggestions, generateFallbackMorningMessage } from './ai-suggestion-helpers.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function buildContext(healthData) {
  const { countByPhase, checks } = healthData;

  const lines = [
    '### フェーズ別レシピ本数',
    ...Object.values(PHASES).map((p) => `- ${p}: ${countByPhase[p] ?? 0}本`),
    '',
    '### 健康度チェック結果',
    ...Object.values(checks).map((c) => {
      if (c.label === '投稿後フォロー') {
        return `- ${c.emoji} ${c.label}: ${c.statusLabel}（最終投稿から${c.daysSincePublish}日経過、下流${c.hasDownstream ? 'あり' : 'なし'}）`;
      }
      return `- ${c.emoji} ${c.label}: ${c.count}本 / ${c.statusLabel}`;
    }),
  ];

  return lines.join('\n');
}

async function generateAISuggestions() {
  console.log('🤖 AI提案を生成中...');

  const dataPath = path.join(__dirname, '..', 'data', 'health-data.json');
  let healthData;
  try {
    healthData = JSON.parse(await fs.readFile(dataPath, 'utf-8'));
  } catch {
    console.error('❌ health-data.json が見つかりません。先に npm run calculate-health を実行してください');
    process.exit(1);
  }

  const apiKey = process.env.INSTA_GEMINI_API_KEY;
  let suggestions;
  let morningMessage = '';
  let source = 'gemini';

  if (!apiKey) {
    console.warn('⚠️  INSTA_GEMINI_API_KEY が未設定のためフォールバック提案を使用します');
    suggestions = generateFallbackSuggestions(healthData);
    morningMessage = generateFallbackMorningMessage(healthData);
    source = 'fallback';
  } else {
    const models = ['gemini-2.5-flash', 'gemini-2.0-flash'];
    let succeeded = false;

    for (const modelName of models) {
      try {
        const promptPath = path.join(__dirname, '..', 'config', 'ai-prompts', 'unified.md');
        const accountContextPath = path.join(__dirname, '..', 'config', 'account-context.md');
        const promptTemplate = await fs.readFile(promptPath, 'utf-8');
        const accountContext = await fs.readFile(accountContextPath, 'utf-8');
        const context = buildContext(healthData);
        const prompt = promptTemplate
          .replace('{{ACCOUNT_CONTEXT}}', accountContext)
          .replace('{{CONTEXT}}', context);

        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: modelName });
        const result = await model.generateContent(prompt);
        const text = result.response.text().trim();

        // JSON部分を抽出
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (!jsonMatch) throw new Error('JSONが見つかりませんでした');
        const parsed = JSON.parse(jsonMatch[0]);
        suggestions = parsed.suggestions ?? parsed;
        morningMessage = parsed.morningMessage ?? '';

        console.log(`✅ Gemini API (${modelName}) で提案を生成しました`);
        succeeded = true;
        break;
      } catch (err) {
        console.warn(`⚠️  ${modelName} エラー:`, err.message);
      }
    }

    if (!succeeded) {
      console.warn('→ 全モデル失敗。フォールバック提案を使用します');
      suggestions = generateFallbackSuggestions(healthData);
      morningMessage = generateFallbackMorningMessage(healthData);
      source = 'fallback';
    }
  }

  const outputDir = path.join(__dirname, '..', 'data');
  await fs.mkdir(outputDir, { recursive: true });
  await fs.writeFile(
    path.join(outputDir, 'ai-suggestions.json'),
    JSON.stringify({ suggestions, morningMessage, source, generatedAt: new Date().toISOString() }, null, 2),
  );

  console.log(`💾 data/ai-suggestions.json に保存しました（source: ${source}）`);
  if (morningMessage) console.log(`  🌸 ${morningMessage}`);
  suggestions.forEach((s) => console.log(`  ${s.icon} [${s.priority}] ${s.message}`));
}

generateAISuggestions().catch((err) => {
  console.error('❌ 予期しないエラー:', err.message);
  process.exit(1);
});
