#!/usr/bin/env node
/**
 * fetch-data.js
 * Google Sheets API からレシピ進捗データを取得し data/sheets-data.json に保存する
 */

import 'dotenv/config';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { SPREADSHEET_ID, SHEETS_API_KEY, SHEETS_RANGE, PHASES } from '../config/settings.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function fetchSheetsData() {
  console.log('📊 Google Sheetsからデータを取得中...');

  if (!SPREADSHEET_ID) {
    console.error('❌ INSTA_SHEETS_SPREADSHEET_ID が設定されていません');
    process.exit(1);
  }
  if (!SHEETS_API_KEY) {
    console.error('❌ INSTA_SHEETS_API_KEY が設定されていません');
    process.exit(1);
  }

  const url =
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(SPREADSHEET_ID)}` +
    `/values/${encodeURIComponent(SHEETS_RANGE)}?key=${SHEETS_API_KEY}`;

  let response;
  try {
    response = await fetch(url);
  } catch (err) {
    console.error('❌ ネットワークエラー:', err.message);
    process.exit(1);
  }

  if (!response.ok) {
    const body = await response.text();
    console.error(`❌ Google Sheets API エラー (${response.status}):`, body);
    console.log('💡 スプレッドシートを「リンクを知っている人が閲覧可能」に設定してください');
    process.exit(1);
  }

  const data = await response.json();
  const rows = data.values || [];

  const validPhases = new Set(Object.values(PHASES));
  const recipes = rows
    .filter((row) => row.length >= 2 && row[1]?.trim())
    .map((row) => ({
      name: row[0]?.trim() || '(名前未設定)',
      phase: row[1]?.trim() || '',
      updatedAt: row[2]?.trim() || '',
      memo: row[3]?.trim() || '',
    }))
    .filter((r) => validPhases.has(r.phase));

  console.log(`✅ ${recipes.length}件のレシピを取得しました`);

  const breakdown = {};
  Object.values(PHASES).forEach((p) => {
    breakdown[p] = recipes.filter((r) => r.phase === p).length;
  });
  console.log('📋 フェーズ別:', breakdown);

  const outputDir = path.join(__dirname, '..', 'data');
  await fs.mkdir(outputDir, { recursive: true });
  await fs.writeFile(
    path.join(outputDir, 'sheets-data.json'),
    JSON.stringify({ recipes, fetchedAt: new Date().toISOString() }, null, 2),
  );

  console.log('💾 data/sheets-data.json に保存しました');
}

fetchSheetsData().catch((err) => {
  console.error('❌ 予期しないエラー:', err.message);
  process.exit(1);
});
