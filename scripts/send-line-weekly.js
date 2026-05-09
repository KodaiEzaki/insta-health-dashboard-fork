#!/usr/bin/env node
/**
 * send-line-weekly.js
 * 週次レポートをLINEに送信する。
 * - キャラクターの表情サマリー（泣いてた日数 / 喜んでた日数）
 * - 1週間の振り返り一言（Gemini生成）
 */

import 'dotenv/config';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenerativeAI } from '@google/generative-ai';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const logPath = path.join(__dirname, '..', 'data', 'daily-log.json');

/**
 * レベルを感情カテゴリに分類
 * Lv1-2: 泣き顔（😢）、Lv3: 普通（😐）、Lv4-5: 笑顔（😊）
 */
function categorizeLevels(entries) {
  let crying = 0;  // Lv1-2
  let neutral = 0; // Lv3
  let happy = 0;   // Lv4-5

  for (const entry of entries) {
    if (entry.level <= 2) crying++;
    else if (entry.level === 3) neutral++;
    else happy++;
  }

  return { crying, neutral, happy, total: entries.length };
}

/**
 * Geminiで週次振り返り一言を生成
 */
async function generateWeeklyMessage(stats) {
  const apiKey = process.env.INSTA_GEMINI_API_KEY;
  if (!apiKey) return null;

  const genAI = new GoogleGenerativeAI(apiKey);
  const models = ['gemini-2.5-flash', 'gemini-2.0-flash'];

  const prompt = `あなたは料理系Instagramアカウント運営者の進捗管理AIアシスタントです。
今週1週間の結果をもとに、温かく励ます振り返りの一言を生成してください。

## 今週の結果
- 記録日数: ${stats.total}日
- 😢 泣き顔の日（投稿が滞っていた日）: ${stats.crying}日
- 😐 普通の日: ${stats.neutral}日
- 😊 笑顔の日（順調だった日）: ${stats.happy}日

## ルール
- 1〜2文で簡潔に（60〜100文字程度）
- 励ましと来週への前向きなメッセージを含める
- 絵文字は1つだけ使用OK
- 結果が良くても悪くても、優しいトーンで`;

  for (const modelName of models) {
    try {
      const model = genAI.getGenerativeModel({ model: modelName });
      const result = await model.generateContent(prompt);
      const text = result.response.text().trim();
      if (text) return text;
    } catch (err) {
      console.log(`⚠️ ${modelName} 失敗: ${err.message}`);
    }
  }
  return null;
}

/**
 * フォールバック振り返りメッセージ
 */
function getFallbackMessage(stats) {
  if (stats.happy >= 5) return '素晴らしい1週間でした！この調子で来週も頑張ろう 🌟';
  if (stats.happy >= 3) return '良いペースで進められた1週間。来週もこの流れをキープしよう 💪';
  if (stats.crying >= 5) return '大変な1週間だったね。来週は少しずつペースを取り戻していこう 🌱';
  return '今週もお疲れさま。来週は1つずつ進めていこうね 🌸';
}

async function sendWeeklyReport() {
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  if (!token) {
    console.log('⚠️ LINE_CHANNEL_ACCESS_TOKEN が未設定。LINE通知をスキップします');
    return;
  }

  // 日次ログを読み込み
  let log = [];
  try {
    log = JSON.parse(await fs.readFile(logPath, 'utf-8'));
  } catch {
    console.log('⚠️ daily-log.json がありません。週次レポートをスキップします');
    return;
  }

  // 直近7日分を取得
  const today = new Date();
  const weekAgo = new Date(today);
  weekAgo.setDate(weekAgo.getDate() - 7);
  const weekAgoStr = weekAgo.toISOString().split('T')[0];

  const weekEntries = log.filter((e) => e.date >= weekAgoStr);
  if (weekEntries.length === 0) {
    console.log('⚠️ 今週のログデータがありません。週次レポートをスキップします');
    return;
  }

  const stats = categorizeLevels(weekEntries);

  // 振り返りメッセージ生成
  let reflectionMessage = await generateWeeklyMessage(stats);
  if (!reflectionMessage) {
    reflectionMessage = getFallbackMessage(stats);
  }

  // LINEメッセージ組み立て
  const text = [
    '📊 週間レポート',
    '',
    `📅 記録: ${stats.total}日`,
    '',
    `😢 泣き顔の日: ${stats.crying}日`,
    `😐 ふつうの日: ${stats.neutral}日`,
    `😊 笑顔の日: ${stats.happy}日`,
    '',
    '💬 振り返り',
    reflectionMessage,
  ].join('\n');

  const messages = [{ type: 'text', text }];

  const response = await fetch('https://api.line.me/v2/bot/message/broadcast', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ messages }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`LINE API エラー: ${response.status} ${body}`);
  }

  console.log('✅ 週次レポートを送信しました');
  console.log(`  😢 ${stats.crying}日 / 😐 ${stats.neutral}日 / 😊 ${stats.happy}日`);
  console.log(`  💬 ${reflectionMessage}`);
}

sendWeeklyReport().catch((err) => {
  console.error('❌ 週次レポート送信失敗:', err.message);
  process.exit(1);
});
