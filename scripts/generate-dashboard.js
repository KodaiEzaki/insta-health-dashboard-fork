#!/usr/bin/env node
/**
 * generate-dashboard.js
 * health-data.json と ai-suggestions.json を読み込み、Tailwind CSS ベースの HTML ダッシュボードを生成する
 */

import 'dotenv/config';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { PHASES } from '../config/settings.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ステータス別スタイル定義
const STATUS_STYLES = {
  healthy: {
    border: 'border-emerald-500',
    bg: 'bg-emerald-50',
    countColor: 'text-emerald-600',
    badgeBg: 'bg-emerald-100',
    badgeText: 'text-emerald-700',
    icon: '✓',
    label: '安全',
  },
  warning: {
    border: 'border-amber-400',
    bg: 'bg-orange-50',
    countColor: 'text-amber-600',
    badgeBg: 'bg-amber-100',
    badgeText: 'text-amber-700',
    icon: '⚠',
    label: '注意',
  },
  danger: {
    border: 'border-rose-500',
    bg: 'bg-rose-50',
    countColor: 'text-rose-600',
    badgeBg: 'bg-rose-100',
    badgeText: 'text-rose-700',
    icon: '✕',
    label: '危険',
  },
};

// 優先度別スタイル定義（アドバイス）
const PRIORITY_STYLES = {
  high:   { bg: 'bg-rose-50',    badgeBg: 'bg-rose-100',    badgeText: 'text-rose-600',    label: '優先度：高', hover: 'hover:bg-rose-100/60' },
  medium: { bg: 'bg-amber-50',   badgeBg: 'bg-amber-100',   badgeText: 'text-amber-600',   label: '優先度：中', hover: 'hover:bg-amber-100/60' },
  low:    { bg: 'bg-emerald-50', badgeBg: 'bg-emerald-100', badgeText: 'text-emerald-600', label: '優先度：低', hover: 'hover:bg-emerald-100/60' },
};

const PRIORITY_ORDER = { high: 0, medium: 1, low: 2 };

function formatJST(isoString) {
  const d = new Date(isoString);
  return d.toLocaleString('ja-JP', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit',
  });
}

// 健康度カードのアイコン
const CHECK_ICONS = {
  upstream:   '📝',
  midstream:  '🔄',
  downstream: '📸',
  postPublish:'📣',
};

/**
 * キャラクターレベル判定
 * x: 最後の投稿からの日数, y: 撮影・編集の本数
 */
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

function postPublishCardHTML(check, downstreamCount) {
  if (!check) return '';
  const s = STATUS_STYLES[check.status] ?? STATUS_STYLES.healthy;
  const days = check.daysSincePublish ?? 0;
  const targetDays = 7; // 週1投稿目標
  const progressPct = Math.min(100, Math.round((days / targetDays) * 100));
  const remainDays = Math.max(0, targetDays - days);
  const lastDate = check.lastPublishedAt ?? '';

  return `
      <div class="${s.bg} border-l-4 ${s.border} rounded-2xl p-5 shadow hover:shadow-md transition-shadow mb-4">
        <div class="flex items-center justify-between gap-4">
          <div class="flex-1">
            <p class="text-xs text-stone-400 mb-1">最後の投稿から</p>
            <p class="text-4xl sm:text-5xl font-bold tabular-nums leading-none ${s.countColor}">
              ${days}<span class="text-base font-normal text-stone-400 ml-1">日経過</span>
            </p>
            ${lastDate ? `<p class="text-xs text-stone-400 mt-1">最終投稿日: ${lastDate}</p>` : ''}
            <div class="mt-3">
              <div class="flex justify-between text-xs text-stone-400 mb-1">
                <span>投稿サイクル（週1目標）</span>
                <span>残り${remainDays}日</span>
              </div>
              <div class="bg-stone-200 rounded-full h-2 overflow-hidden">
                <div class="${s.border.replace('border-', 'bg-')} rounded-full h-2 transition-all" style="width:${progressPct}%"></div>
              </div>
            </div>
          </div>
          <div class="shrink-0 flex flex-col items-center">
            <img src="character/Lv${getCharacterLevel(days, downstreamCount)}.png" alt="" class="w-[72px] h-[72px] object-contain" />
            <span class="inline-flex items-center gap-1 ${s.badgeBg} ${s.badgeText} text-xs font-semibold px-3 py-1 rounded-full -mt-2 shadow-sm">
              <span>${s.icon}</span><span>${s.label}</span>
            </span>
          </div>
        </div>
      </div>`;
}

// カード別の基準値説明
const CHECK_THRESHOLDS = {
  upstream:   '🟢6本〜 🟡3〜5本 🔴2本以下',
  midstream:  '🟢3本〜 🟡1〜2本 🔴0本',
  downstream: '🟢1本以上 🔴0本',
};

// カード別の内容説明
const CHECK_DESCRIPTIONS = {
  upstream:   'リサーチ〜試作の合計本数',
  midstream:  'レシピ作成〜試作の本数',
  downstream: '撮影中〜動画編集中の本数',
};

function healthCardHTML(check, checkKey) {
  if (!check) return '';
  const s = STATUS_STYLES[check.status] ?? STATUS_STYLES.healthy;
  const icon = CHECK_ICONS[checkKey] ?? '';
  const threshold = CHECK_THRESHOLDS[checkKey] ?? '';
  const description = CHECK_DESCRIPTIONS[checkKey] ?? '';

  return `
      <div class="${s.bg} border-l-4 ${s.border} rounded-2xl p-3 shadow hover:shadow-md transition-shadow">
        <p class="text-xs text-stone-400 mb-2 leading-tight">${icon} ${check.label.replace('（リサーチ〜試作）','').replace('（レシピ作成〜試作）','').replace('（撮影〜編集）','')}</p>
        <p class="text-2xl font-bold tabular-nums leading-none ${s.countColor}">
          ${check.count}<span class="text-xs font-normal text-stone-400 ml-0.5">本</span>
        </p>
        <span class="mt-2 inline-flex items-center gap-0.5 ${s.badgeBg} ${s.badgeText} text-[0.65rem] font-semibold px-1.5 py-0.5 rounded-full">
          <span>${s.icon}</span><span>${s.label}</span>
        </span>
        ${description ? `<p class="mt-1 text-[0.5rem] text-stone-400 leading-tight">${description}</p>` : ''}
        ${threshold ? `<p class="mt-1.5 text-[0.5rem] text-stone-500 leading-tight">${threshold}</p>` : ''}
      </div>`;
}

function phaseRowHTML(phaseName, count, maxCount, isLast) {
  const barWidth = maxCount > 0 ? Math.round((count / maxCount) * 100) : 0;
  const isPublished = phaseName === PHASES.published;
  const isEmpty = count === 0 && !isPublished;
  const barColor = isPublished ? 'bg-emerald-500' : isEmpty ? 'bg-rose-400' : 'bg-amber-400';
  const rowBg   = isEmpty ? 'bg-rose-50' : 'hover:bg-amber-50';
  const border   = isLast ? '' : 'border-b border-stone-100';
  return `
      <div class="flex items-center gap-3 px-4 min-h-[44px] ${border} ${rowBg} transition-colors">
        <span class="text-xs text-stone-500 w-28 shrink-0">${phaseName}</span>
        <div class="flex-1 bg-stone-100 rounded-full h-2 overflow-hidden">
          <div class="${barColor} rounded-full h-2" style="width:${Math.max(barWidth, isEmpty ? 3 : 0)}%"></div>
        </div>
        <span class="text-xs font-bold ${isEmpty ? 'text-rose-500' : 'text-stone-700'} w-5 text-right">${count}</span>
      </div>`;
}

// 進行中レシピタグ（制作進行・撮影編集のみ）
const ACTIVE_PHASES = {
  downstream: ['撮影中', '動画編集中'],
  midstream:  ['レシピ作成中', '試作中'],
};
const PHASE_ICONS = {
  '撮影中': '📷',
  '動画編集中': '🎬',
  'レシピ作成中': '✏️',
  '試作中': '🧪',
};

function activeRecipesHTML(recipes) {
  if (!recipes || recipes.length === 0) return '';

  const downstreamRecipes = recipes.filter(r => ACTIVE_PHASES.downstream.includes(r.phase));
  const midstreamRecipes  = recipes.filter(r => ACTIVE_PHASES.midstream.includes(r.phase));

  if (downstreamRecipes.length === 0 && midstreamRecipes.length === 0) return '';

  const renderTags = (list, colorClass) => list.map(r => `
          <span class="inline-flex items-center gap-1.5 ${colorClass} text-xs px-3 py-1.5 rounded-full">
            ${PHASE_ICONS[r.phase] ?? ''} ${r.name} <span class="text-stone-400">${r.phase}</span>
          </span>`).join('');

  return `
    <p class="text-xs font-semibold uppercase tracking-widest text-stone-400 mb-3">🍳 進行中レシピ</p>
    <div class="bg-white rounded-xl shadow-sm mb-6 overflow-hidden">
      ${downstreamRecipes.length > 0 ? `
      <div class="px-4 py-3 border-b border-stone-100">
        <p class="text-[0.65rem] font-bold text-stone-400 uppercase tracking-widest mb-2">撮影・編集フェーズ</p>
        <div class="flex flex-wrap gap-2">
          ${renderTags(downstreamRecipes, 'bg-emerald-50 border border-emerald-200 text-emerald-700')}
        </div>
      </div>` : ''}
      ${midstreamRecipes.length > 0 ? `
      <div class="px-4 py-3">
        <p class="text-[0.65rem] font-bold text-stone-400 uppercase tracking-widest mb-2">試作・制作フェーズ</p>
        <div class="flex flex-wrap gap-2">
          ${renderTags(midstreamRecipes, 'bg-amber-50 border border-amber-200 text-amber-700')}
        </div>
      </div>` : ''}
    </div>`;
}

function suggestionItemHTML(s, isLast) {
  const p = PRIORITY_STYLES[s.priority] ?? PRIORITY_STYLES.low;
  const border = isLast ? '' : 'border-b border-white';
  return `
      <div class="flex items-start gap-3 p-4 ${p.bg} ${border} ${p.hover} transition-colors">
        <span class="text-xl shrink-0">${s.icon}</span>
        <div>
          <span class="text-[0.65rem] font-bold ${p.badgeBg} ${p.badgeText} px-1.5 py-0.5 rounded">${p.label}</span>
          <p class="text-sm text-stone-700 mt-1.5 leading-relaxed">${s.message.replace(/\n/g, '<br>')}</p>
        </div>
      </div>`;
}

async function generateDashboard() {
  console.log('🎨 HTMLダッシュボードを生成中...');

  const healthDataPath = path.join(__dirname, '..', 'data', 'health-data.json');
  const suggestionsPath = path.join(__dirname, '..', 'data', 'ai-suggestions.json');

  let healthData, suggestionsData;
  try {
    healthData = JSON.parse(await fs.readFile(healthDataPath, 'utf-8'));
  } catch {
    console.error('❌ health-data.json が見つかりません。先に npm run calculate-health を実行してください');
    process.exit(1);
  }
  try {
    suggestionsData = JSON.parse(await fs.readFile(suggestionsPath, 'utf-8'));
  } catch {
    console.error('❌ ai-suggestions.json が見つかりません。先に npm run ai-suggestions を実行してください');
    process.exit(1);
  }

  const { countByPhase, checks, calculatedAt, recipes } = healthData;
  const morningMessage = suggestionsData.morningMessage || 'おはようございます ☀️';
  const suggestions = [...suggestionsData.suggestions].sort(
    (a, b) => (PRIORITY_ORDER[a.priority] ?? 99) - (PRIORITY_ORDER[b.priority] ?? 99),
  );

  const maxCount = Math.max(1, ...Object.values(countByPhase));

  const downstreamCount = checks.downstream?.count ?? 0;
  const postPublishHTML = checks.postPublish ? postPublishCardHTML(checks.postPublish, downstreamCount) : '';

  const healthCardsHTML = [
    checks.upstream    ? healthCardHTML(checks.upstream,    'upstream')    : '',
    checks.midstream   ? healthCardHTML(checks.midstream,   'midstream')   : '',
    checks.downstream  ? healthCardHTML(checks.downstream,  'downstream')  : '',
  ].join('');

  const phaseList = Object.values(PHASES);
  const phaseRowsHTML = phaseList
    .map((p, i) => phaseRowHTML(p, countByPhase[p] ?? 0, maxCount, i === phaseList.length - 1))
    .join('');

  const activeHTML = activeRecipesHTML(recipes ?? []);

  const suggestionsHTML = suggestions
    .map((s, i) => suggestionItemHTML(s, i === suggestions.length - 1))
    .join('');

  const html = `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>テストテスト</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <script>
    tailwind.config = {
      theme: {
        extend: {
          fontFamily: {
            sans: ['-apple-system', '"Hiragino Sans"', '"Hiragino Kaku Gothic ProN"', 'sans-serif'],
          },
        },
      },
    }
  </script>
</head>
<body class="bg-stone-100 font-sans text-stone-800 px-4 py-6 sm:px-6 sm:py-8">
  <div class="max-w-xl mx-auto">

    <header class="bg-gradient-to-r from-amber-100 to-orange-50 rounded-2xl p-4 mb-5 shadow-sm">
      <div class="flex items-center gap-2 mb-1">
        <span class="text-2xl">🌸</span>
        <h1 class="text-2xl sm:text-3xl font-bold tracking-tight text-amber-800">テストテスト</h1>
      </div>
      <p class="text-amber-600 text-sm font-medium mt-1">${morningMessage}</p>
      <p class="text-stone-400 text-xs mt-1">更新: ${formatJST(calculatedAt)}</p>
    </header>

    <p class="text-xs font-semibold uppercase tracking-widest text-stone-400 mb-3">📣 投稿後フォロー</p>
    ${postPublishHTML}

    <p class="text-xs font-semibold uppercase tracking-widest text-stone-400 mb-3">✅ 進捗チェック</p>
    <div class="grid grid-cols-3 gap-2 mb-6">
      ${healthCardsHTML}
    </div>

    ${activeHTML}

    <p class="text-xs font-semibold uppercase tracking-widest text-stone-400 mb-3">🤖 AIからのアドバイス</p>
    <div class="bg-white rounded-xl shadow-sm overflow-hidden mb-6">
      ${suggestionsHTML}
    </div>

    <p class="text-xs font-semibold uppercase tracking-widest text-stone-400 mb-3">📋 フェーズ別レシピ数</p>
    <div class="bg-white rounded-xl shadow-sm mb-8 overflow-hidden">
      ${phaseRowsHTML}
    </div>

  </div>
</body>
</html>`;

  const outputDir = path.join(__dirname, '..', 'output');
  await fs.mkdir(outputDir, { recursive: true });
  await fs.writeFile(path.join(outputDir, 'dashboard.html'), html);

  console.log('✅ output/dashboard.html を生成しました');
}

generateDashboard().catch((err) => {
  console.error('❌ 予期しないエラー:', err.message);
  process.exit(1);
});
