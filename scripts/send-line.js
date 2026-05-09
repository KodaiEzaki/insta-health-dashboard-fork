#!/usr/bin/env node
/**
 * send-line.js
 * LINE Messaging API Push で ダッシュボードURL + スクリーンショット画像を送信する
 *
 * 必要な環境変数:
 *   LINE_CHANNEL_ACCESS_TOKEN  — LINE Developers で発行した長期アクセストークン
 *   LINE_USER_ID               — 送信先のLINEユーザーID（uXXXX...形式）
 */

import 'dotenv/config';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function sendLineMessage() {
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  const userId = process.env.LINE_USER_ID;

  if (!token) {
    console.log('⚠️ LINE_CHANNEL_ACCESS_TOKEN が未設定。LINE通知をスキップします');
    return;
  }

  const domain = process.env.INSTA_SURGE_DOMAIN;
  const dashboardUrl = `https://${domain}`;
  const screenshotUrl = `https://${domain}/screenshot.png`;

  // AI提案データから朝のメッセージを取得
  let morningMessage = 'おはようございます ☀️';
  try {
    const raw = await fs.readFile(
      path.join(__dirname, '..', 'data', 'ai-suggestions.json'),
      'utf8'
    );
    const suggestions = JSON.parse(raw);
    if (suggestions.morningMessage) {
      morningMessage = suggestions.morningMessage;
    }
  } catch {
    // フォールバックメッセージをそのまま使用
  }

  const messages = [
    {
      type: 'text',
      text: `🌸 はるの朝れぽ\n\n${morningMessage}\n\n📊 ${dashboardUrl}`,
    },
    {
      type: 'image',
      originalContentUrl: screenshotUrl,
      previewImageUrl: screenshotUrl,
    },
  ];

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

  console.log('✅ LINE通知を送信しました');
}

sendLineMessage().catch((err) => {
  console.error('❌ LINE通知失敗:', err.message);
  process.exit(1);
});
