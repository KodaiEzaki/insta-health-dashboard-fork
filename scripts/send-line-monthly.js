#!/usr/bin/env node
/**
 * send-line-monthly.js
 * 月次レポートをLINEに送信する。
 * - キャラクターの表情サマリー（泣いてた日数 / 喜んでた日数）
 * - 月間の投稿本数
 * - 1か月の振り返り一言（Gemini生成）
 */

import 'dotenv/config';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenerativeAI } from '@google/generative-ai';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const logPath = path.join(__dirname, '..', 'data', 'daily-log.json');
const healthPath = path.join(__dirname, '..', 'data', 'health-data.json');

// JST (UTC+9) での日付を取得し、月初1日でなければスキップ
const nowJst = new Date(Date.now() + 9 * 60 * 60 * 1000);
if (nowJst.getUTCDate() !== 1) {
  console.log(`ℹ️ 本日はJST ${nowJst.getUTCDate()}日のためスキップします（月初1日のみ送信）`);
  process.exit(0);
}

/**
 * レベルを感情カテゴリに分類
 */
function categorizeLevels(entries) {
  let crying = 0;
  let neutral = 0;
  let happy = 0;

  for (const entry of entries) {
    if (entry.level <= 2) crying++;
    else if (entry.level === 3) neutral++;
    else happy++;
  }

  return { crying, neutral, happy, total: entries.length };
}

/**
 * 月間の投稿数を計算
 * daily-log.json の daysSincePublish の変化から投稿回数を推定する
 * （日数がリセットされた＝新しい投稿があった）
 */
function countMonthlyPosts(entries) {
  if (entries.length <= 1) return 0;

  let posts = 0;
  for (let i = 1; i < entries.length; i++) {
    // daysSincePublish が前日より小さくなった = 新規投稿があった
    if (entries[i].daysSincePublish < entries[i - 1].daysSincePublish) {
      posts++;
    }
  }
  return posts;
}

/**
 * Geminiで月次振り返り一言を生成
 */
async function generateMonthlyMessage(stats, postCount) {
  const apiKey = process.env.INSTA_GEMINI_API_KEY;
  if (!apiKey) return null;

  const genAI = new GoogleGenerativeAI(apiKey);
  const models = ['gemini-2.5-flash', 'gemini-2.0-flash'];

  const prompt = `あなたは料理系Instagramアカウント運営者の進捗管理AIアシスタントです。
今月1か月間の結果をもとに、温かく励ます振り返りの一言を生成してください。

## 今月の結果
- 記録日数: ${stats.total}日
- 😢 泣き顔の日（投稿が滞っていた日）: ${stats.crying}日
- 😐 普通の日: ${stats.neutral}日
- 😊 笑顔の日（順調だった日）: ${stats.happy}日
- 📹 動画投稿数: ${postCount}本

## ルール
- 2〜3文で簡潔に（80〜120文字程度）
- 1か月の頑張りを認め、来月への前向きなメッセージを含める
- 絵文字は1〜2個使用OK
- 結果が良くても悪くても、優しく温かいトーンで
- 投稿数にも触れてください`;

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
function getFallbackMessage(stats, postCount) {
  if (postCount >= 4) return `今月は${postCount}本も投稿できました！素晴らしいペースです。来月もこの調子で 🎉`;
  if (postCount >= 2) return `今月は${postCount}本投稿できたね。着実に前に進んでいるよ。来月も一歩ずつ 💪`;
  if (postCount === 1) return `今月は1本投稿できました。まずは続けることが大事！来月も頑張ろう 🌱`;
  return '今月は投稿できなかったけど、準備は進んでいるはず。来月こそ1本出せるように頑張ろう 🌸';
}

async function sendMonthlyReport() {
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
    console.log('⚠️ daily-log.json がありません。月次レポートをスキップします');
    return;
  }

  // 直近30日分を取得
  const today = new Date();
  const monthAgo = new Date(today);
  monthAgo.setDate(monthAgo.getDate() - 30);
  const monthAgoStr = monthAgo.toISOString().split('T')[0];

  const monthEntries = log.filter((e) => e.date >= monthAgoStr);
  if (monthEntries.length === 0) {
    console.log('⚠️ 今月のログデータがありません。月次レポートをスキップします');
    return;
  }

  const stats = categorizeLevels(monthEntries);
  const postCount = countMonthlyPosts(monthEntries);

  // 振り返りメッセージ生成
  let reflectionMessage = await generateMonthlyMessage(stats, postCount);
  if (!reflectionMessage) {
    reflectionMessage = getFallbackMessage(stats, postCount);
  }

  // LINEメッセージ組み立て
  const text = [
    '📋 月間レポート',
    '',
    `📅 記録: ${stats.total}日`,
    `📹 動画投稿: ${postCount}本`,
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

  console.log('✅ 月次レポートを送信しました');
  console.log(`  📹 投稿: ${postCount}本`);
  console.log(`  😢 ${stats.crying}日 / 😐 ${stats.neutral}日 / 😊 ${stats.happy}日`);
  console.log(`  💬 ${reflectionMessage}`);
}

sendMonthlyReport().catch((err) => {
  console.error('❌ 月次レポート送信失敗:', err.message);
  process.exit(1);
});
