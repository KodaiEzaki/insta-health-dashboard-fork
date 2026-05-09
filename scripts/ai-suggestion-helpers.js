/**
 * ai-suggestion-helpers.js
 * Gemini API が使えない場合のフォールバック提案ロジック
 */

export function generateFallbackSuggestions(healthData) {
  const { checks } = healthData;
  const suggestions = [];

  if (checks.downstream?.status === 'danger') {
    suggestions.push({
      priority: 'high',
      icon: '🔥',
      message: '撮影・編集中のレシピがゼロです。試作済みのレシピを撮影に進めましょう',
    });
  } else if (checks.downstream?.status === 'warning') {
    suggestions.push({
      priority: 'high',
      icon: '🔥',
      message: '下流の本数が少ないです。撮影スケジュールを確認してください',
    });
  }

  if (checks.midstream?.status === 'danger') {
    suggestions.push({
      priority: 'high',
      icon: '🔥',
      message: 'レシピ作成・試作がゼロです。リサーチ済みアイデアをすぐに着手してください',
    });
  } else if (checks.midstream?.status === 'warning') {
    suggestions.push({
      priority: 'medium',
      icon: '🧭',
      message: 'レシピ作成〜試作が少ないです。並行して複数本を進めましょう',
    });
  }

  if (checks.upstream?.status === 'danger') {
    suggestions.push({
      priority: 'high',
      icon: '🔥',
      message: 'ネタ切れ寸前です。今日はリサーチに時間を確保してください',
    });
  } else if (checks.upstream?.status === 'warning') {
    suggestions.push({
      priority: 'medium',
      icon: '🧭',
      message: '上流のストックが少なくなっています。リサーチを増やしましょう',
    });
  }

  if (checks.postPublish?.status === 'danger') {
    suggestions.push({
      priority: 'high',
      icon: '🔥',
      message: '投稿から日数が経っています。次の動画を撮影フェーズに進めましょう',
    });
  } else if (checks.postPublish?.status === 'warning') {
    suggestions.push({
      priority: 'medium',
      icon: '🧭',
      message: '次の投稿準備を急ぎましょう。撮影スケジュールを確保してください',
    });
  }

  // 全部安全な場合
  if (suggestions.length === 0) {
    suggestions.push({
      priority: 'low',
      icon: '🌱',
      message: '全ての指標が安全です。このペースを維持しましょう',
    });
  }

  // 不足分を low で補完して3件にする
  const fillers = [
    { priority: 'low', icon: '🌱', message: 'ストックが充実しています。品質を高める試作に挑戦してみましょう' },
    { priority: 'low', icon: '🌱', message: '過去の投稿のエンゲージメントを確認し、人気レシピのアレンジを検討しましょう' },
    { priority: 'medium', icon: '🧭', message: '定期的な投稿リズムを保つことが大切です。週間スケジュールを確認しましょう' },
  ];

  let i = 0;
  while (suggestions.length < 3) {
    suggestions.push(fillers[i % fillers.length]);
    i++;
  }

  return suggestions.slice(0, 3);
}

/**
 * フォールバック用の朝メッセージを生成
 */
export function generateFallbackMorningMessage(healthData) {
  const { checks } = healthData;
  const allHealthy = Object.values(checks).every((c) => c.status === 'healthy');
  if (allHealthy) return 'おはようございます！順調ですね ☀️';

  const hasDanger = Object.values(checks).some((c) => c.status === 'danger');
  if (hasDanger) return 'おはようございます。今日もがんばりましょう 💪';

  return 'おはようございます ☀️';
}
