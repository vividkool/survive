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
  }

  // ターン毎の負傷進行（時間経過ペナルティ）
  onTurnElapsed() {
    // 家族のHPが少しずつ減少（治療施設に急ぐ動機）
    this.familyHp = Math.max(0, this.familyHp - 1.5);
    
    // バッテリーの消費
    this.battery = Math.max(0, this.battery - 2);
    
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
