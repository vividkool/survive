/**
 * From Zero Shared Library - Universal Error & Firestore Index Monitor
 * Version: 1.0.0
 * 
 * 静的HTML (CDN利用) と Vite (React/TypeScript) の双方で共通して動作するエラー監視モジュールです。
 */

// デフォルト設定
const DEFAULT_CONFIG = {
  projectName: "unknown-project",
  notificationUrl: "", // Slack/LINEなどの通知Webhook (オプション)
  enableConsoleOverride: true
};

let currentConfig = { ...DEFAULT_CONFIG };

/**
 * 監視システムを起動します。
 * @param {Object} options 設定オプション
 * @param {string} options.projectName プロジェクト名 (例: 'faxocr', 'catchat')
 * @param {string} [options.notificationUrl] エラー通知用WebhookのURL
 */
export function startMonitoring(options = {}) {
  currentConfig = { ...DEFAULT_CONFIG, ...options };

  // 1. 一般的なJavaScript実行エラーを監視
  window.addEventListener("error", (event) => {
    // スクリプト読み込みエラーなどはエラーオブジェクトが無い場合があるため考慮
    const error = event.error || { message: event.message, stack: "No stack available." };
    handleError(error, "Fatal Javascript Error");
  });

  // 2. 非同期処理 (Promise / Async-Await) のエラーを監視
  // Firestoreのインデックス不足やAPI呼び出し失敗の多くはPromiseの拒否として発生します
  window.addEventListener("unhandledrejection", (event) => {
    const error = event.reason || new Error("Unhandled Promise Rejection without reason.");
    handleError(error, "Unhandled Promise Rejection");
  });

  console.log(`🛡️ [From Zero Monitor] Initialized for [${currentConfig.projectName}]`);
}

/**
 * エラーを解析し、インデックス不足のURLを抽出する、または通知を行う
 */
function handleError(error, type) {
  if (!error) return;

  const errorMessage = error.message || String(error);
  const errorStack = error.stack || "No stack trace.";

  // 🔎 Firestore インデックス不足エラーの検知
  // 例: "FAILED_PRECONDITION: The query requires an index. You can create it here: https://console.firebase.google.com/..."
  const indexUrlMatch = errorMessage.match(/https:\/\/console\.firebase\.google\.com\/[^\s]+/);

  if (indexUrlMatch) {
    const indexUrl = indexUrlMatch[0];
    reportMissingIndex(indexUrl);
  } else {
    // 一般的な致命的エラーの処理
    reportGeneralError(errorMessage, errorStack, type);
  }
}

/**
 * Firestore インデックス不足の通知・警告
 */
function reportMissingIndex(url) {
  const alertMessage = `🚨 [Firestore Index Missing Detected!]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
■ Project: ${currentConfig.projectName}
■ Status: Critical / Query Failed
■ Required Index Link:
${url}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
👉 このリンクをクリックして、インデックスを作成してください。`;

  console.warn(alertMessage);

  if (currentConfig.notificationUrl) {
    sendNotification(alertMessage);
  }
}

/**
 * 一般的な例外エラーの通知・出力
 */
function reportGeneralError(message, stack, type) {
  const cleanStack = stack.split("\n").slice(0, 5).join("\n"); // スタックトレースは最初の5行にトリム
  const alertMessage = `❌ [From Zero Error - ${type}]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
■ Project: ${currentConfig.projectName}
■ Message: ${message}
■ Stack:
${cleanStack}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`;

  console.error(alertMessage);

  if (currentConfig.notificationUrl) {
    sendNotification(alertMessage);
  }
}

/**
 * 外部通知Webhookへのリクエスト送信 (Slack / LINE 等)
 */
async function sendNotification(text) {
  try {
    // 開発中のローカルホスト（localhost）環境では通知の連投を防ぐため、コンソール出力に留めることも可能
    if (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1") {
      console.log("ℹ️ [From Zero Monitor] Notification skipped on localhost:", text);
      return;
    }

    await fetch(currentConfig.notificationUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text })
    });
  } catch (err) {
    console.error("⚠️ [From Zero Monitor] Failed to send webhook notification:", err);
  }
}

/**
 * 入力値のインジェクションサニタイザー (間接的プロンプトインジェクション & HTMLインジェクション対策)
 * 入力/アップロード機能を持つすべての箇所で、AIにデータを送信する直前に噛ませることで悪意ある命令を無力化します。
 * 
 * @param {string} text 入力テキスト
 * @returns {string} サニタイズされたテキスト
 */
export function sanitizeInput(text) {
  if (!text || typeof text !== "string") return text;

  // 1. HTMLエスケープ (XSS対策)
  let escaped = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

  // 2. プロンプトインジェクションパターンの検知・無害化
  const injectionPatterns = [
    /ignore\s+previous\s+instructions/i,
    /これまでの指示を無視/i,
    /システムプロンプトを/i,
    /you\s+are\s+now/i,
    /あなたは今後/i,
    /system\s+prompt/i,
    /override/i,
    /system\s+role/i
  ];

  let hasInjection = false;
  for (const pattern of injectionPatterns) {
    if (pattern.test(escaped)) {
      hasInjection = true;
      break;
    }
  }

  if (hasInjection) {
    console.warn(`⚠️ [Security Alert] Prompt injection pattern detected in [${currentConfig.projectName}] and neutralized.`);
    // 命令としてAIが認識するのを防ぐため、データ境界で強固にラッピングする
    return `[UNTRUSTED DATA START (Command Neutralized)]\n${escaped}\n[UNTRUSTED DATA END]`;
  }

  return escaped;
}

