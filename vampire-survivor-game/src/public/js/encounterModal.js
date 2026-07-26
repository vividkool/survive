// 移動後エンカウントモーダル制御クラス
export class EncounterModal {
  constructor(gameController) {
    this.game = gameController;
    this.modalOverlay = document.getElementById("encounter-modal-overlay");
    this.badgeEl = document.getElementById("encounter-badge");
    this.titleEl = document.getElementById("encounter-title");
    this.descEl = document.getElementById("encounter-desc");
    this.actionsContainer = document.getElementById("encounter-actions");

    this.flashOverlay = document.getElementById("flash-overlay");
    this.muzzleOverlay = document.getElementById("muzzle-overlay");
    this.gameSection = document.querySelector(".game-section");
  }

  show(faction, cell, isAmbushed = false) {
    this.modalOverlay.style.display = "flex";
    this.badgeEl.textContent = faction.badge;
    this.badgeEl.style.color = faction.color;
    this.titleEl.textContent = faction.name;
    this.descEl.textContent = isAmbushed 
      ? `🚨 【奇襲被弾】${faction.name}` 
      : faction.name;

    this.actionsContainer.innerHTML = "";

    // 生存者・中立勢力 (レジスタンス, 脆弱生存者)
    if (faction.id === 'RESISTANCE' || faction.id === 'WEAK_SURVIVOR') {
      this.createActionButton("🤝 交易（バッテリー⇄実弾交換）", "btn-cyan", () => this.handleTrade(faction));
      this.createActionButton("🚶 同行を依頼（家族パニック保護）", "btn-green", () => this.handleAccompany(faction, cell));
      this.createActionButton("🗣️ 情報交換（前方の戦況探知）", "btn-cyan", () => this.handleIntelShare(faction));
      this.createActionButton("👋 挨拶して通過", "btn-muted", () => this.close());
    } 
    // 敵対・掠奪勢力 (レイダー, 最新AI A, 最新AI B)
    else {
      // 自分から進んで敵地に侵入した場合のみ「隠密行動」が可能！
      if (!isAmbushed) {
        this.createActionButton("🥷 隠密行動 (足音を消して通過 / 遭遇回避)", "btn-green", () => this.handleStealthAction(faction, cell));
      }
      this.createActionButton("🎯 3レイヤー照準 (廃屋/廃車/がれき) 奇襲・スナイプ", "btn-red", () => this.handleTacticalSnipe(faction, cell));
      this.createActionButton("💥 即時先制射撃 (弾薬: -1)", "btn-orange", () => this.handlePreemptiveStrike(faction, cell));
      this.createActionButton("🛡️ 警戒防御で進入する", "btn-muted", () => this.handleAmbushRetreat(faction));
    }
  }

  // 隠密行動ハンドラー
  handleStealthAction(faction, cell) {
    // 隠密成功（戦闘を起こさず物資回収・隠避）
    this.game.addMessage('SYSTEM', `【隠密成功】${faction.name}のセンサーを掻い潜り、息を殺して物音を立てずに通過・移動を完了しました。`);
    this.close();
  }

  createActionButton(text, cssClass, onClick) {
    const btn = document.createElement("button");
    btn.className = `btn ${cssClass}`;
    btn.textContent = text;
    btn.onclick = onClick;
    this.actionsContainer.appendChild(btn);
  }

  close() {
    this.modalOverlay.style.display = "none";
    if (this.game.onResumeExploration) {
      this.game.onResumeExploration();
    }
  }

  // アクション: 交易
  handleTrade(faction) {
    if (this.game.player.battery >= 20) {
      this.game.player.battery -= 20;
      this.game.player.ammo = Math.min(this.game.player.maxAmmo, this.game.player.ammo + 2);
      this.game.addMessage('SYSTEM', `【交易成功】${faction.name}とバッテリー20%を提示し、貴重な実弾2発を受け取りました。`);
    } else {
      this.game.addMessage('SYSTEM', `【交易失敗】バッテリーが不足しています（20%必要）。`, true);
    }
    this.close();
  }

  // アクション: 同行
  handleAccompany(faction, cell) {
    this.game.player.familyPanic = Math.max(0, this.game.player.familyPanic - 25);
    cell.occupyingFaction = null; // ガードとして同行したためマスから移動
    this.game.addMessage('SYSTEM', `【護衛同行】${faction.name}が一時的に同行し、家族の不安を和らげました（パニック度 -25%）。`);
    this.close();
  }

  // アクション: 3レイヤー戦術スナイプ・奇襲モーダルの起動
  handleTacticalSnipe(faction, cell) {
    this.modalOverlay.style.display = "none"; // 遭遇モーダルを一時隠す
    if (this.game.openSnipeModal) {
      this.game.openSnipeModal(faction, cell);
    }
  }

  // アクション: 情報交換
  handleIntelShare(faction) {
    this.game.revealRandomFarCell();
    this.game.addMessage('SYSTEM', `【情報入手】${faction.name}から視界外の地形・音紋データをマップ上に共有してもらいました。`);
    this.close();
  }

  // アクション: 先制射撃（マズルフラッシュ＋画面振動演出）
  handlePreemptiveStrike(faction, cell) {
    if (this.game.player.ammo > 0) {
      this.game.player.ammo--;
      
      // 先制攻撃アニメーション演出
      this.triggerMuzzleFlashAnimation();
      this.triggerScreenShake();

      cell.occupyingFaction = null; // 先制撃破
      this.game.addMessage('SYSTEM', `【先制攻撃成功】マズルフラッシュ！ 弾薬1発を消費し、${faction.name}を被弾前に撃滅しました！`, true);
    } else {
      this.game.addMessage('SYSTEM', `【弾薬切れ】実弾がありません！ 被襲撃交戦に入ります。`, true);
      this.handleAmbushRetreat(faction);
      return;
    }
    this.close();
  }

  // アクション: 被襲撃・警戒交戦（赤フラッシュ＋ダメージ演出）
  handleAmbushRetreat(faction) {
    // 敵からの被襲撃アニメーション演出
    this.triggerRedAmbushFlash();
    this.triggerScreenShake();

    const damage = Math.floor(15 + Math.random() * 20);
    this.game.player.hp = Math.max(0, this.game.player.hp - damage);
    this.game.player.familyPanic = Math.min(100, this.game.player.familyPanic + 20);
    
    this.game.addMessage('SYSTEM', `【襲撃被弾】${faction.name}から猛烈な急襲を受けました！ プレイヤーが ${damage} ダメージを負いました！`, true);
    this.close();
  }

  // 画面アニメーション演出群
  triggerMuzzleFlashAnimation() {
    this.muzzleOverlay.classList.remove("active-muzzle");
    void this.muzzleOverlay.offsetWidth; // リフロー発生
    this.muzzleOverlay.classList.add("active-muzzle");
  }

  triggerRedAmbushFlash() {
    this.flashOverlay.classList.remove("active-red-flash");
    void this.flashOverlay.offsetWidth;
    this.flashOverlay.classList.add("active-red-flash");
  }

  triggerScreenShake() {
    this.gameSection.classList.remove("screen-shake");
    void this.gameSection.offsetWidth;
    this.gameSection.classList.add("screen-shake");
  }
}
