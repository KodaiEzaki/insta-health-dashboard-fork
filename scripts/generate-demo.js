#!/usr/bin/env node
/**
 * generate-demo.js
 * Lv1〜Lv5 のキャラが表示されるデモ用ダッシュボードを5つ生成し _dev-notes/demo/ に保存する
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(__dirname, '..', 'data');
const demoDir = path.join(__dirname, '..', '_dev-notes', 'demo');
const outputDir = path.join(__dirname, '..', 'output');

// 元のデータをバックアップ
const healthPath = path.join(dataDir, 'health-data.json');
const originalHealth = await fs.readFile(healthPath, 'utf-8');

// ベースデータ
const base = JSON.parse(originalHealth);

// デモパターン: { days, downstreamCount, expectedLevel }
const demos = [
  { days: 8,  downstream: 0, level: 1, desc: '8日経過・撮影0本' },
  { days: 5,  downstream: 0, level: 2, desc: '5日経過・撮影0本' },
  { days: 3,  downstream: 0, level: 3, desc: '3日経過・撮影0本' },
  { days: 2,  downstream: 0, level: 4, desc: '2日経過・撮影0本' },
  { days: 1,  downstream: 1, level: 5, desc: '1日経過・撮影1本' },
];

await fs.mkdir(demoDir, { recursive: true });

for (const demo of demos) {
  // health-data.json を書き換え
  const data = JSON.parse(JSON.stringify(base));
  data.checks.postPublish.daysSincePublish = demo.days;
  data.checks.postPublish.status = demo.days >= 7 ? 'danger' : demo.days >= 4 ? 'warning' : 'healthy';
  data.checks.postPublish.emoji = demo.days >= 7 ? '🔴' : demo.days >= 4 ? '🟡' : '🟢';
  data.checks.postPublish.statusLabel = demo.days >= 7 ? '危険' : demo.days >= 4 ? '注意' : '安全';
  data.checks.downstream.count = demo.downstream;
  data.checks.downstream.status = demo.downstream >= 1 ? 'healthy' : 'danger';
  data.checks.downstream.emoji = demo.downstream >= 1 ? '🟢' : '🔴';
  data.checks.downstream.statusLabel = demo.downstream >= 1 ? '安全' : '危険';

  await fs.writeFile(healthPath, JSON.stringify(data, null, 2));

  // ダッシュボード生成
  execSync('node scripts/generate-dashboard.js', { cwd: path.join(__dirname, '..'), stdio: 'pipe' });

  // 結果をデモフォルダにコピー
  const src = path.join(outputDir, 'dashboard.html');
  const dest = path.join(demoDir, `dashboard-lv${demo.level}.html`);
  await fs.copyFile(src, dest);
  console.log(`✅ Lv${demo.level} (${demo.desc}) → ${path.basename(dest)}`);
}

// 元データを復元
await fs.writeFile(healthPath, originalHealth);
console.log('\n🔄 health-data.json を元に戻しました');

// characterフォルダもデモ用にコピー
const charSrc = path.join(__dirname, '..', 'assets', 'character');
const charDest = path.join(demoDir, 'character');
await fs.mkdir(charDest, { recursive: true });
const files = await fs.readdir(charSrc);
for (const f of files) {
  await fs.copyFile(path.join(charSrc, f), path.join(charDest, f));
}
console.log('🎨 character/ をデモフォルダにコピーしました');
console.log('\n✨ 完了！ _dev-notes/demo/ で各HTMLを開いて確認できます');
