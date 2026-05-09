#!/usr/bin/env node
/**
 * save-daily-log.js
 * 毎日の実行時にキャラクターレベルと健康データのサマリーを data/daily-log.json に追記する。
 * 週次・月次レポートで「泣いていた日数」「喜んでいた日数」などを集計するためのデータソース。
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(__dirname, '..', 'data');
const logPath = path.join(dataDir, 'daily-log.json');
const healthPath = path.join(dataDir, 'health-data.json');

function getCharacterLevel(x, y) {
  if (x >= 8) return 1;
  if (x === 7) return y >= 1 ? 2 : 1;
  if (x === 6) return y >= 1 ? 2 : 1;
  if (x === 5) return y >= 1 ? 3 : 2;
  if (x === 4) return y >= 1 ? 3 : 2;
  if (x === 3) return y >= 1 ? 4 : 3;
  if (x === 2) return y >= 1 ? 5 : 4;
  return 5; // x=0,1
}

async function saveDailyLog() {
  // 健康データを読み込み
  const healthData = JSON.parse(await fs.readFile(healthPath, 'utf-8'));
  const { checks, countByPhase } = healthData;

  const daysSince = checks.postPublish?.daysSincePublish ?? 0;
  const downstreamCount = checks.downstream?.count ?? 0;
  const level = getCharacterLevel(daysSince, downstreamCount);

  const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

  const entry = {
    date: today,
    level,
    daysSincePublish: daysSince,
    downstreamCount,
    countByPhase,
    checks: {
      upstream: checks.upstream?.status,
      midstream: checks.midstream?.status,
      downstream: checks.downstream?.status,
      postPublish: checks.postPublish?.status,
    },
  };

  // 既存ログを読み込み（なければ空配列）
  let log = [];
  try {
    log = JSON.parse(await fs.readFile(logPath, 'utf-8'));
  } catch {
    // ファイルがなければ新規作成
  }

  // 同じ日付のエントリがあれば上書き、なければ追加
  const existingIndex = log.findIndex((e) => e.date === today);
  if (existingIndex >= 0) {
    log[existingIndex] = entry;
  } else {
    log.push(entry);
  }

  // 最大90日分を保持
  if (log.length > 90) {
    log = log.slice(-90);
  }

  await fs.writeFile(logPath, JSON.stringify(log, null, 2));
  console.log(`✅ 日次ログ保存: ${today} / Lv${level}`);
}

saveDailyLog().catch((err) => {
  console.error('❌ 日次ログ保存失敗:', err.message);
  process.exit(1);
});
