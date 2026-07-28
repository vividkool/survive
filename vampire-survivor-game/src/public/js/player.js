class Player {
  constructor(gridX, gridY) {
    this.gridX = gridX; // 10x10 グリッド上のX
    this.gridY = gridY; // 10x10 グリッド上のY
    
    // サバイバルステータス
    this.hp = 100;
    this.maxHp = 100;
    this.ammo = 8;
    this.maxAmmo = 20;
    this.battery = 100;
    this.maxBattery = 100;
    
    // 家族の負傷状態・パニック
    this.familyHp = 90; // 治療目的のため、最初から少し負傷している
    this.maxFamilyHp = 100;
    this.familyPanic = 10;

    // 📦 ItemBox / モジュールインベントリ (最大3枠制限)
    this.inventory = []; // 最大3つのモジュール所持
    this.equippedModules = []; // 組み込み装着中のモジュール
    this.contamination = 0; // バックドア汚染度 (%/数値)
    
    // パッシブ効果フラグ
    this.opticalBoost = false;
    this.batteryRegenBoost = false;
    this.stealthBoost = false;
  }

  // モジュールの装備組み込み
  equipModule(index) {
    if (index < 0 || index >= this.inventory.length) return false;

    const mod = this.inventory.splice(index, 1)[0];
    this.equippedModules.push(mod);

    // 汚染度の増加
    this.contamination += mod.contamination;

    // モジュール固有の効果発動
    if (mod.effect) {
      mod.effect(this);
    }

    return mod;
  }

  // モジュールの外す・パージ (物理切断ダメージ発生)
  purgeModule(equippedIndex) {
    if (equippedIndex < 0 || equippedIndex >= this.equippedModules.length) return null;

    const mod = this.equippedModules.splice(equippedIndex, 1)[0];

    // 汚染度の減少
    this.contamination = Math.max(0, this.contamination - mod.contamination);

    // 強制パージ（外す）に伴う自機回路物理切断ダメージ！
    const damage = mod.purgeDamage || 20;
    this.hp = Math.max(0, this.hp - damage);

    // パッシブフラグのリセット・再計算
    this.recalculatePassiveEffects();

    return { mod, damage };
  }

  // 装備中モジュールの効果再計算
  recalculatePassiveEffects() {
    this.opticalBoost = this.equippedModules.some(m => m.id === 'OPTIC_SENSOR');
    this.batteryRegenBoost = this.equippedModules.some(m => m.id === 'OVERCLOCK_CORE');
    this.stealthBoost = this.equippedModules.some(m => m.id === 'STEALTH_JAMMER');
  }

  // ターン毎の負傷進行（時間経過ペナルティ）
  onTurnElapsed() {
    // 家族のHPが少しずつ減少（治療施設に急ぐ動機）
    const panicDmg = this.stealthBoost ? 0.75 : 1.5;
    this.familyHp = Math.max(0, this.familyHp - panicDmg);
    
    // バッテリーの消費 (オーバークロック・コア装備時は回復)
    if (this.batteryRegenBoost) {
      this.battery = Math.min(this.maxBattery, this.battery + 1);
    } else {
      this.battery = Math.max(0, this.battery - 2);
    }
    
    // バッテリーが切れると家族のパニック上昇と生存ダメージ
    if (this.battery <= 0) {
      this.familyPanic = Math.min(100, this.familyPanic + 8);
      this.familyHp = Math.max(0, this.familyHp - 3);
      this.hp = Math.max(0, this.hp - 2);
    }
  }

  moveTo(x, y) {
    this.gridX = x;
    this.gridY = y;
  }
}
