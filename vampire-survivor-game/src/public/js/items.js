// モジュール/アイテム定義マスタ
export const MODULE_TYPES = [
  {
    id: 'REPAIR_KIT',
    type: 'RESOURCE',
    name: '応急ナノ修理キット',
    icon: '🔧',
    description: '破壊された機体残骸から回収した応急修復用部品。自機を物理修復する。',
    effectText: '【即時効果】機体HPを 35 回復',
    contamination: 0,
    purgeDamage: 0,
    useOnAcquire: (player) => {
      player.hp = Math.min(player.maxHp, player.hp + 35);
      return "🔧 応急修理キットを使用し、機体HPが 35 回復しました！";
    }
  },
  {
    id: 'BATTERY_PACK',
    type: 'RESOURCE',
    name: '大容量予備バッテリーセル',
    icon: '🔋',
    description: '完全充電状態の予備バッテリーパック。コア電力を大きく充填する。',
    effectText: '【即時効果】バッテリーを 40% 充電',
    contamination: 0,
    purgeDamage: 0,
    useOnAcquire: (player) => {
      player.battery = Math.min(player.maxBattery, player.battery + 40);
      return "🔋 予備バッテリーを接続し、電力が 40% 充電されました！";
    }
  },
  {
    id: 'AMMO_BOX',
    type: 'RESOURCE',
    name: '未開封の消音実弾箱',
    icon: '📦',
    description: '軍用機体から落ちた未開封の実弾ケース。麻酔・消音弾を獲得する。',
    effectText: '【即時効果】実弾 AMMO +3 発補給',
    contamination: 0,
    purgeDamage: 0,
    useOnAcquire: (player) => {
      player.ammo = Math.min(player.maxAmmo, player.ammo + 3);
      return "📦 実弾箱から実弾を 3 発補給・回収しました！";
    }
  },
  {
    id: 'OPTIC_SENSOR',
    type: 'MODULE',
    name: '敵軍・高精度光学センサ',
    icon: '👁️',
    description: '視界・動体探知範囲を強化。しかし敵視線ログのハックにより汚染が侵入。',
    effectText: '【効果】AI誤作動率 -10% / 【リスク】汚染度 +20',
    contamination: 20,
    purgeDamage: 15,
    effect: (player) => { player.opticalBoost = true; }
  },
  {
    id: 'OVERCLOCK_CORE',
    type: 'MODULE',
    name: '軍用オーバークロック・コア',
    icon: '⚡',
    description: '自機行動効率を極限まで引き上げる。基板に敵バックドアプログラムが残存。',
    effectText: '【効果】毎ターンバッテリー回復 +3% / 【リスク】汚染度 +35',
    contamination: 35,
    purgeDamage: 25,
    effect: (player) => { player.batteryRegenBoost = true; }
  },
  {
    id: 'STEALTH_JAMMER',
    type: 'MODULE',
    name: 'ステルス・ジャミング素子',
    icon: '📡',
    description: '周波数を偽装し、敵からの被検知度を下げる。偽シグナルノイズが混入。',
    effectText: '【効果】家族パニック上昇率 -50% / 【リスク】汚染度 +25',
    contamination: 25,
    purgeDamage: 20,
    effect: (player) => { player.stealthBoost = true; }
  },
  {
    id: 'REINFORCED_ARMOR',
    type: 'MODULE',
    name: '敵ドローン複層強化装甲',
    icon: '🛡️',
    description: '敵機体から剥ぎ取った装甲板。物理攻撃を和らげるが重く電磁汚染を帯びる。',
    effectText: '【効果】最大HP +30 (現在HP回復) / 【リスク】汚染度 +15',
    contamination: 15,
    purgeDamage: 30,
    effect: (player) => { 
      player.maxHp += 30;
      player.hp = Math.min(player.maxHp, player.hp + 30);
    }
  }
];

export class ItemBox {
  constructor(x, y, moduleItem) {
    this.x = x;
    this.y = y;
    this.moduleItem = moduleItem || MODULE_TYPES[Math.floor(Math.random() * MODULE_TYPES.length)];
  }
}
