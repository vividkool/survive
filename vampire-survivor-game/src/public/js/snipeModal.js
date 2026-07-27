// 3レイヤー（廃屋・廃車・がれき）構造 攻撃・スナイプ・奇襲モーダル制御クラス
export class SnipeModal {
  constructor(gameController) {
    this.game = gameController;
    this.modalOverlay = document.getElementById("snipe-modal-overlay");
    this.crosshair = document.getElementById("snipe-crosshair");
    this.layerBuilding = document.getElementById("layer-building");
    this.layerVehicle = document.getElementById("layer-vehicle");
    this.layerRubble = document.getElementById("layer-rubble");
    this.ammoCountEl = document.getElementById("snipe-ammo-count");
    this.threatStatusEl = document.getElementById("snipe-threat-status");
    this.targetInfoEl = document.getElementById("snipe-target-info");
    this.closeBtn = document.getElementById("snipe-close-btn");

    this.currentFaction = null;
    this.currentCell = null;
    this.selectedTarget = null; // { layer: 'building'|'vehicle'|'rubble', type: 'enemy'|'trap'|'cover' }

    this.initEvents();
  }

  initEvents() {
    if (this.closeBtn) {
      this.closeBtn.onclick = () => this.close();
    }

    // レイヤー内のターゲットクリック/タッチ
    const setupLayerTargets = (layerEl, layerName) => {
      if (!layerEl) return;
      layerEl.querySelectorAll(".snipe-target").forEach((target) => {
        target.addEventListener("click", (e) => {
          e.stopPropagation();
          this.handleTargetSelect(target, layerName);
        });
      });
    };

    setupLayerTargets(this.layerBuilding, "廃屋 (奥景)");
    setupLayerTargets(this.layerVehicle, "廃車 (中景)");
    setupLayerTargets(this.layerRubble, "がれき (手前)");

    // スコープのクロスヘア位置連動
    const stage = document.getElementById("snipe-stage");
    if (stage) {
      stage.addEventListener("mousemove", (e) => {
        const rect = stage.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        if (this.crosshair) {
          this.crosshair.style.left = `${x}px`;
          this.crosshair.style.top = `${y}px`;
        }
      });
    }
  }

  show(faction, cell) {
    this.currentFaction = faction;
    this.currentCell = cell;
    this.selectedTarget = null;
    this.updateTargetInfo("ターゲットを選択してください（廃屋・廃車・がれきの影を精査中）");

    if (this.ammoCountEl) {
      this.ammoCountEl.textContent = this.game.player.ammo;
    }
    if (this.threatStatusEl) {
      this.threatStatusEl.textContent = "隠密状態 (STRENGTH: UNDETECTED)";
      this.threatStatusEl.style.color = "var(--accent-green)";
    }

    // ランダムに敵の潜伏場所を更新配置
    this.randomizeTargetPositions();

    this.modalOverlay.style.display = "flex";
  }

  close() {
    this.modalOverlay.style.display = "none";
    if (this.game.onResumeExploration) {
      this.game.onResumeExploration();
    }
  }

  randomizeTargetPositions() {
    // 廃屋・廃車・がれきに敵シルエット・ハッキングポイントを割り当て
    const targets = [
      { id: "target-building", name: "廃屋の2階窓（スナイパーAI）", layer: "廃屋 (奥景)", hitRate: 70, type: "SNIPE" },
      { id: "target-vehicle", name: "廃車の陰（巡回ドローン）", layer: "廃車 (中景)", hitRate: 85, type: "AMBUSH" },
      { id: "target-rubble", name: "がれき裏（警戒センサー）", layer: "がれき (手前)", hitRate: 95, type: "TRAP" }
    ];

    targets.forEach(t => {
      const el = document.getElementById(t.id);
      if (el) {
        el.dataset.name = t.name;
        el.dataset.hitrate = t.hitRate;
        el.dataset.type = t.type;
        el.classList.remove("destroyed", "selected");
      }
    });
  }

  handleTargetSelect(targetEl, layerName) {
    document.querySelectorAll(".snipe-target").forEach(el => el.classList.remove("selected"));
    targetEl.classList.add("selected");

    const name = targetEl.dataset.name || "不明な反応";
    const hitRate = targetEl.dataset.hitrate || 80;
    const type = targetEl.dataset.type || "SNIPE";

    this.selectedTarget = {
      element: targetEl,
      name,
      hitRate: parseInt(hitRate, 10),
      type,
      layerName
    };

    let actionPrompt = "";
    if (type === "SNIPE") actionPrompt = "【超遠距離スナイプ】外すと激しい発砲音で位置が即時露見";
    else if (type === "AMBUSH") actionPrompt = "【中距離側面奇襲】車体を盾に隠密撃滅";
    else actionPrompt = "【近接トラップ仕掛け】がれきにトラップを設置し自滅を誘う";

    this.updateTargetInfo(`[${layerName}] ${name} | 予想命中率: ${hitRate}% | ${actionPrompt}`);
    this.renderActionButtons();
  }

  updateTargetInfo(text) {
    if (this.targetInfoEl) {
      this.targetInfoEl.textContent = text;
    }
  }

  renderActionButtons() {
    const container = document.getElementById("snipe-action-buttons");
    if (!container) return;
    container.innerHTML = "";

    if (!this.selectedTarget) return;

    // 1. 乗っ取り・同士討ち射撃実行ボタン (実弾消費またはハッキング実行)
    const executeBtn = document.createElement("button");
    executeBtn.className = "btn btn-red";
    executeBtn.textContent = `🤖 乗っ取りスナイプ / 同士討ちトリガー発動`;
    executeBtn.onclick = () => this.executeAttack();

    // 2. ⚡ 環境起爆・ハッキング爆破ボタン
    const hackExplodeBtn = document.createElement("button");
    hackExplodeBtn.className = "btn btn-orange";
    hackExplodeBtn.textContent = `💥 カメラ視界経由で高圧線/燃料缶を遠隔起爆 (バッテリー: -10%)`;
    hackExplodeBtn.onclick = () => this.executeHackExplosion();

    // キャンセルボタン
    const cancelBtn = document.createElement("button");
    cancelBtn.className = "btn btn-muted";
    cancelBtn.textContent = `↩️ 接続切断・手動切離し`;
    cancelBtn.onclick = () => this.close();

    container.appendChild(executeBtn);
    container.appendChild(hackExplodeBtn);
    container.appendChild(cancelBtn);
  }

  // ⚡ カメラ視界経由の環境遠隔起爆
  executeHackExplosion() {
    if (this.game.player.battery < 10) {
      this.updateTargetInfo("【バッテリー不足】遠隔オーバーロード爆発には電力10%が必要です。");
      return;
    }

    this.game.player.battery -= 10;
    if (this.selectedTarget && this.selectedTarget.element) {
      this.selectedTarget.element.classList.add("destroyed");
    }

    if (this.currentCell) {
      this.currentCell.occupyingFaction = null; // 敵爆滅
    }

    this.game.triggerMuzzleFlashAnimation?.();
    this.game.triggerScreenShake?.();

    this.game.addMessage(
      "SYSTEM",
      `【環境遠隔起爆成功！】乗っ取った敵カメラの視界から ${this.selectedTarget ? this.selectedTarget.name : "周辺設備"} の燃料缶へ信号を送信！ 敵AIユニットを大爆発で撃滅し、同士討ちパニックを誘発しました！`,
      true
    );
    this.close();
  }

  // 攻撃実行ロジック
  executeAttack() {
    if (this.game.player.ammo <= 0) {
      this.updateTargetInfo("【弾薬切れ】実弾がありません！ 射撃不可能です。");
      return;
    }

    if (!this.selectedTarget) return;

    this.game.player.ammo--;
    if (this.ammoCountEl) this.ammoCountEl.textContent = this.game.player.ammo;

    const roll = Math.random() * 100;
    const isHit = roll <= this.selectedTarget.hitRate;

    if (isHit) {
      // 命中・撃破
      this.selectedTarget.element.classList.add("destroyed");
      this.game.triggerMuzzleFlashAnimation?.();
      this.game.triggerScreenShake?.();

      if (this.currentCell) {
        this.currentCell.occupyingFaction = null; // 敵撃滅
      }

      this.game.addMessage(
        "SYSTEM",
        `【レイヤー攻撃成功】${this.selectedTarget.layerName}の${this.selectedTarget.name}へのピンポイント攻撃が成功！ 一撃で沈めました！`,
        true
      );
      this.close();
    } else {
      // 外れた場合：残弾減少＋発砲音が周囲に伝わり位置露見！
      this.game.triggerRedAmbushFlash?.();
      this.game.triggerScreenShake?.();

      if (this.threatStatusEl) {
        this.threatStatusEl.textContent = "警報発令！ 発砲音により敵に位置が暴露！";
        this.threatStatusEl.style.color = "var(--accent-red)";
      }

      // 敵からのカウンターダメージ
      const counterDamage = Math.floor(10 + Math.random() * 15);
      this.game.player.hp = Math.max(0, this.game.player.hp - counterDamage);

      this.game.addMessage(
        "SYSTEM",
        `【エイム失敗！】${this.selectedTarget.layerName}への射撃を外しました！ 轟音により周囲のAIロボットに位置が露見し、反撃を受けました（-${counterDamage} HP）`,
        true
      );

      this.updateTargetInfo("位置が露見しました！ 迅速に追撃するか離脱してください！");
    }
  }

  // トラップ設置ロジック
  executeTrap() {
    if (this.game.player.battery < 15) {
      this.updateTargetInfo("【バッテリー不足】トラップの起動には15%の電力が必要です。");
      return;
    }

    this.game.player.battery -= 15;
    if (this.currentCell) {
      this.currentCell.occupyingFaction = null; // トラップにより無効化
    }

    this.game.addMessage(
      "SYSTEM",
      `【トラップ完了】${this.selectedTarget ? this.selectedTarget.layerName : "現場"}に高圧電磁トラップを仕掛け、敵の追撃を阻止して安全に離脱しました。`
    );
    this.close();
  }
}
