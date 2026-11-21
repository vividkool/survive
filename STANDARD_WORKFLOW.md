# 標準開発ワークフロー V4.0 (Lightweight & Secure Architecture)

本ドキュメントは、全アプリケーション（ゲーム・個人ツール・業務SaaS）に共通する **「軽量・シンプル・低コスト・高セキュリティ」** の標準開発規約です。
アプリ規模に応じて **パターンA（軽量アプリ／ゲーム）** と **パターンB（マルチテナント業務SaaS）** の2プロファイルを使い分け、過剰設計を避けつつセキュリティの急所を確実に防御します。

---

## 1. アプリ別プロファイル選択（責務の引き算）

| 項目 | パターンA：軽量アプリ / ゲーム<br>(`effectpuzzle`, `survive`, `blind-action` 等) | パターンB：業務SaaS / マルチテナント<br>(`faxocr`, `household`, `excel-converter`, `catchat` 等) |
| :--- | :--- | :--- |
| **認証 (Auth)** | 匿名認証 または セッションID（MFA不要） | メール / Googleログイン ＋ **Custom Claims**（`companyId`, `role`） |
| **Firestore Rules** | 本人・ルーム参加者のみ許可 ＋ 改ざん禁止フィールド指定 | **Custom Claims 照合**（`get()` ゼロで課金ゼロ）＋ `role`/`companyId`/`usages` 書き換え禁止 |
| **フロントビルド** | `sourcemap: false` ＋ `esbuild.drop: ['console', 'debugger']` | 同左 |
| **Hostingヘッダー** | `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy` | 同左 ＋ 必要に応じ CORS ホワイトリスト |
| **バックエンド** | 原則不要（必要時のみ軽量 Functions） | 課金・クレジット加算・招待受諾・AI/OCR呼び出しのみ Functions 集約 |

---

## 2. 認証とセキュリティ基盤（全アプリ共通）

### 🔑 ローカル完結型セキュリティと鍵の保護
1. **シークレットのローカル管理**: APIキーやシークレットは `.gitignore` 済みの `.env.local` 等で管理し、絶対に GitHub へコミットしない。
2. **管理者URL・IDの「admin」排除**: ユーザーID「admin」や公開URL `/admin` は使用せず、UID や推測困難なパスを使用する。
3. **CORS ホワイトリスト**: バックエンドAPIで `origin: '*'` を禁止し、許可ドメインのみ明示する。

### 🛡️ 本番ビルド露出遮断（ASM 規約）
Vite 採用プロジェクトは `vite.config.ts` に以下を必須設定する：
```ts
export default defineConfig({
  build: {
    sourcemap: false,
  },
  esbuild: {
    drop: ['console', 'debugger'],
  },
});
```

### 🌐 外部セキュリティヘッダー（`firebase.json` 必須）
```json
{
  "source": "**",
  "headers": [
    { "key": "X-Content-Type-Options", "value": "nosniff" },
    { "key": "X-Frame-Options", "value": "SAMEORIGIN" },
    { "key": "Referrer-Policy", "value": "strict-origin-when-cross-origin" }
  ]
}
```

---

## 3. Firestore セキュリティルール標準（V4.0 鉄壁・軽量テンプレート）

> **⚠️ 絶対禁止事項**
> - `allow read, write: if true;` の本番放置
> - `users/{uid}` での `role` / `companyId` / `isPremium` フィールドのクライアント直接更新許可（権限昇格脆弱性）
> - `invitations/{id}` の `allow create, update, delete: if request.auth != null;`（他社データの改ざん・削除脆弱性）
> - `usages/{id}` のクライアントからの書き込み許可（クレジット上限の突破脆弱性）

### パターンA：軽量アプリ / ゲーム向けルール例
```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{uid} {
      allow read: if request.auth != null && request.auth.uid == uid;
      allow create: if request.auth != null && request.auth.uid == uid
        && (!('isPremium' in request.resource.data) || request.resource.data.isPremium == false)
        && (!('role' in request.resource.data) || request.resource.data.role == 'user');
      allow update: if request.auth != null && request.auth.uid == uid
        && !request.resource.data.diff(resource.data).affectedKeys().hasAny(['isPremium', 'role', 'companyId']);
    }

    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```

### パターンB：マルチテナント業務SaaS向けルール例（Custom Claims 推奨・`get()` ゼロ）
```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    function isSignedIn() { return request.auth != null; }
    function myCompany() { return request.auth.token.companyId; }
    function isCompanyAdmin() { return request.auth.token.role == 'admin'; }

    // 1. ユーザープロファイル（role / companyId のクライアント改ざん完全禁止）
    match /users/{uid} {
      allow read: if isSignedIn() && (request.auth.uid == uid || (isCompanyAdmin() && resource.data.companyId == myCompany()));
      allow create: if isSignedIn() && request.auth.uid == uid
        && (!('role' in request.resource.data) || request.resource.data.role == 'member');
      allow update: if isSignedIn() && request.auth.uid == uid
        && !request.resource.data.diff(resource.data).affectedKeys().hasAny(['role', 'companyId', 'isAdmin', 'isPremium']);
      allow delete: if isSignedIn() && (request.auth.uid == uid || (isCompanyAdmin() && resource.data.companyId == myCompany() && uid != request.auth.uid));
    }

    // 2. 招待データ（自社管理者のみ作成・削除、受諾時のみ pending -> accepted 更新可）
    match /invitations/{invitationId} {
      allow get: if true; // 未ログイン招待者の検証用（list不可）
      allow create, delete: if isSignedIn() && isCompanyAdmin()
        && (request.method == 'create' ? request.resource.data.companyId == myCompany() : resource.data.companyId == myCompany());
      allow update: if isSignedIn()
        && resource.data.status == 'pending'
        && request.resource.data.status == 'accepted'
        && request.resource.data.diff(resource.data).affectedKeys().hasOnly(['status', 'acceptedAt', 'acceptedBy']);
    }

    // 3. 組織データ（Custom Claims 照合で Firestore Read 課金ゼロ）
    match /companies/{companyId}/{document=**} {
      allow read, write: if isSignedIn() && myCompany() == companyId;
    }

    // 4. クレジット利用量（クライアント書き込み禁止・Admin SDK / Cloud Functions のみ加算）
    match /usages/{usageId} {
      allow read: if isSignedIn() && usageId.matches('^' + myCompany() + '_.*');
      allow write: if false;
    }

    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```

---

## 4. API保護・低負荷・耐障害性（シンプル3原則）

複雑な分散基盤（Pub/Sub・Saga等）は小〜中規模アプリでは導入せず、以下の3原則を徹底する：
1. **暴走防止（Rate Limit / クォータ防衛）**: フロントエンドの連続送信ガード（デバウンス・5分間上限）＋ HTTP 429 検知時の即時停止。
2. **タイムアウト ＆ リトライ上限**: 外部API呼び出しには必ずタイムアウト（10〜30秒）とリトライ上限（最大2回・指数バックオフ）を設定。
3. **冪等性（Idempotency）**: 課金・決済・データ作成APIは二重送信で重複実行されないよう、一意キーまたはトランザクションで保護する。

---

## 5. パフォーマンス・UI/UX・運用ルール

1. **低負荷・60fps 優先**: DOM 操作の差分更新、GPU合成（`transform` / `opacity`）の活用、重い `filter: blur()` の回避。
2. **ストレージの非公開原則**: 顧客ファイル（帳票・画像等）のバケットは非公開とし、有効期限付きの署名付きURL（Signed URL）で入出力する。
3. **データ最小化（TTL）**: 不要な一時データ・ログは30日程度で自動消去（TTL設定）する。
4. **デプロイ前チェック**: `npm run build` 通過確認 → `npm audit` で Critical / High が 0 件であることを確認 → `todo.md` / `checked.md` / `README.md` を更新して Push。
