import 'dotenv/config';

// Google Sheets
export const SPREADSHEET_ID = process.env.INSTA_SHEETS_SPREADSHEET_ID || '';
export const SHEETS_API_KEY = process.env.INSTA_SHEETS_API_KEY || '';
export const SHEETS_RANGE = 'シート1!A2:D';

// フェーズ定義
export const PHASES = {
  research: 'リサーチ中',
  recipe: 'レシピ作成中',
  trial: '試作中',
  shooting: '撮影中',
  editing: '動画編集中',
  published: '投稿完了',
};

// 健康度チェック対象フェーズ
export const UPSTREAM_PHASES = [PHASES.research, PHASES.recipe, PHASES.trial];
export const MIDSTREAM_PHASES = [PHASES.recipe, PHASES.trial];
export const DOWNSTREAM_PHASES = [PHASES.shooting, PHASES.editing];
