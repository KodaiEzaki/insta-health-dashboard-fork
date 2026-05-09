#!/usr/bin/env node
/**
 * calculate-health.js
 * sheets-data.json を読み込み、4つの健康度チェックを実行して data/health-data.json に保存する
 */

import 'dotenv/config';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import yaml from 'js-yaml';
import { PHASES, UPSTREAM_PHASES, MIDSTREAM_PHASES, DOWNSTREAM_PHASES } from '../config/settings.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function loadThresholds() {
  const p = path.join(__dirname, '..', 'config', 'health-thresholds.yaml');
  return yaml.load(await fs.readFile(p, 'utf-8'));
}

/**
 * 閾値に基づいてステータスを返す
 * @param {number} count
 * @param {number} healthy - この値以上で healthy
 * @param {number|undefined} warning - この値以上で warning（undefined なら warning なし）
 * @returns {'healthy'|'warning'|'danger'}
 */
function getStatus(count, healthy, warning) {
  if (count >= healthy) return 'healthy';
  if (warning !== undefined && count >= warning) return 'warning';
  return 'danger';
}

const STATUS_EMOJI  = { healthy: '🟢', warning: '🟡', danger: '🔴' };
const STATUS_LABEL  = { healthy: '安全', warning: '注意', danger: '危険' };

function toCheck(label, count, status, extra = {}) {
  return { label, count, status, emoji: STATUS_EMOJI[status], statusLabel: STATUS_LABEL[status], ...extra };
}

async function calculateHealth() {
  console.log('💊 健康度を計算中...');

  const dataPath = path.join(__dirname, '..', 'data', 'sheets-data.json');
  let sheetsData;
  try {
    sheetsData = JSON.parse(await fs.readFile(dataPath, 'utf-8'));
  } catch {
    console.error('❌ sheets-data.json が見つかりません。先に npm run fetch-data を実行してください');
    process.exit(1);
  }

  const { recipes } = sheetsData;
  const t = await loadThresholds();

  // フェーズ別カウント
  const countByPhase = {};
  Object.values(PHASES).forEach((p) => {
    countByPhase[p] = recipes.filter((r) => r.phase === p).length;
  });

  // チェック1: 上流ストック（リサーチ中 + レシピ作成中 + 試作中）
  const upstreamCount = UPSTREAM_PHASES.reduce((s, p) => s + countByPhase[p], 0);
  const upstreamStatus = getStatus(upstreamCount, t.upstream.healthy, t.upstream.warning);

  // チェック2: 中流進行（レシピ作成中 + 試作中）
  const midstreamCount = MIDSTREAM_PHASES.reduce((s, p) => s + countByPhase[p], 0);
  const midstreamStatus = getStatus(midstreamCount, t.midstream.healthy, t.midstream.warning);

  // チェック3: 下流進行（撮影中 + 動画編集中）
  const downstreamCount = DOWNSTREAM_PHASES.reduce((s, p) => s + countByPhase[p], 0);
  const downstreamStatus = getStatus(downstreamCount, t.downstream.healthy, undefined);

  // チェック4: 投稿後フォロー
  const publishedRecipes = recipes
    .filter((r) => r.phase === PHASES.published && r.updatedAt)
    .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));

  let postPublishCheck = null;
  if (publishedRecipes.length > 0) {
    // JST暦日ベースで日数を計算（UTC実行時のタイムゾーンズレを防ぐ）
    const nowJst = new Date(Date.now() + 9 * 60 * 60 * 1000);
    const todayJst = new Date(Date.UTC(nowJst.getUTCFullYear(), nowJst.getUTCMonth(), nowJst.getUTCDate()));
    const [y, m, d] = publishedRecipes[0].updatedAt.split('-').map(Number);
    const publishedDay = new Date(Date.UTC(y, m - 1, d));
    const daysSince = Math.floor((todayJst - publishedDay) / (1000 * 60 * 60 * 24));
    const hasDownstream = downstreamCount >= 1;

    let ppStatus;
    if (daysSince <= t.post_publish.healthy_days && hasDownstream) {
      ppStatus = 'healthy';
    } else if (daysSince <= t.post_publish.warning_days || hasDownstream) {
      ppStatus = 'warning';
    } else {
      ppStatus = 'danger';
    }

    postPublishCheck = toCheck(
      '投稿後フォロー',
      daysSince,
      ppStatus,
      { daysSincePublish: daysSince, hasDownstream, lastPublishedAt: publishedRecipes[0].updatedAt },
    );
  }

  const checks = {
    upstream:   toCheck('ストック（リサーチ〜試作）', upstreamCount, upstreamStatus),
    midstream:  toCheck('制作進行（レシピ作成〜試作）', midstreamCount, midstreamStatus),
    downstream: toCheck('撮影・編集（撮影〜編集）', downstreamCount, downstreamStatus),
    ...(postPublishCheck && { postPublish: postPublishCheck }),
  };

  const healthData = {
    calculatedAt: new Date().toISOString(),
    countByPhase,
    checks,
    recipes,
  };

  const outputDir = path.join(__dirname, '..', 'data');
  await fs.mkdir(outputDir, { recursive: true });
  await fs.writeFile(
    path.join(outputDir, 'health-data.json'),
    JSON.stringify(healthData, null, 2),
  );

  console.log('✅ 健康度計算完了:');
  Object.values(checks).forEach((c) => {
    console.log(`  ${c.emoji} ${c.label}: ${c.statusLabel}`);
  });
  console.log('💾 data/health-data.json に保存しました');
}

calculateHealth().catch((err) => {
  console.error('❌ 予期しないエラー:', err.message);
  process.exit(1);
});
