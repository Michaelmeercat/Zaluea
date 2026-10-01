import type { EnemyType, Variant } from '../core/types';

export interface MechanicTip {
  key: string;
  title: string;
  text: string;
  counters: string;
}

/** Tips shown before the first wave featuring a mechanic. */
export const ENEMY_TIPS: Partial<Record<EnemyType, MechanicTip>> = {
  skitter: { key: 'skitter', title: 'Fast enemies: Skitters', text: 'Skitters move almost twice as fast but have little health.', counters: 'Frost Warden slows them; Thorn Archers with Quick Draw keep up.' },
  bulwark: { key: 'bulwark', title: 'Armor: Bulwarks', text: 'Armor reduces each physical, fire or frost hit by 2 (min 1). Weak arrows barely scratch them.', counters: 'Archer Armor Breaker (Precision 3), Storm Engineer arcane, Alchemist Acid or Shrapnel Salts, Beacon Sunder Light.' },
  wisp: { key: 'wisp', title: 'Concealed: Wisps', text: 'Concealed enemies can only be targeted by guardians with detection.', counters: 'Archer Keen Eyes (Ranger 1), Storm Scanner (Devices 2), Beacon Revealing Light, Winter Field exposure, Lyra at level 5. Splash can still hit them incidentally.' },
  emberkin: { key: 'emberkin', title: 'Fire resistance: Emberkin', text: 'Emberkin take 75% less fire damage.', counters: 'Archers, Frost Wardens, Storm Engineers, or Alchemist Acid Conversion.' },
  frostling: { key: 'frostling', title: 'Frost resistance: Frostlings', text: 'Frostlings take 75% less frost damage, receive half-strength slows and cannot be frozen.', counters: 'Archers, Alchemists and Storm Engineers.' },
  broodpod: { key: 'broodpod', title: 'Splitting: Broodpods', text: 'Broodpods burst into three Sproutlings where they fall. If one escapes, its young never hatch.', counters: 'Splash damage handles the brood; place a guardian after your main killzone.' },
  mender: { key: 'mender', title: 'Healing: Menders', text: 'Menders heal nearby enemies by 8% every 3 seconds.', counters: 'Focus them with Strong targeting, or burst them with high single-target damage.' },
  brute: { key: 'brute', title: 'Giants: Rift Brutes', text: 'Brutes have 240 base health and release four Skitters on death. A leak costs 10 lives.', counters: 'Giant Hunter, Titan Breaker, Cataclysm, Marked Prey and Lyra at level 9 deal bonus damage.' },
  colossus: { key: 'colossus', title: 'BOSS: Rift Colossus', text: 'Phase 1 shields, phase 2 summons, phase 3 charges and hardens. Slows are half-strength; it cannot be frozen.', counters: 'Stack damage on its path. Anti-giant upgrades, Marked Prey and Lyra’s Time Anchor all help.' },
};

export const VARIANT_TIPS: Record<Variant, MechanicTip> = {
  concealed: { key: 'v-concealed', title: 'Concealed variants', text: 'Some ordinary enemies now arrive concealed.', counters: 'Make sure detection covers your whole path.' },
  regen: { key: 'v-regen', title: 'Regeneration', text: 'Regenerating enemies heal 8%/sec after 2.5s without taking damage.', counters: 'Keep constant pressure: burns, corrosion and auras keep them from healing.' },
  shield: { key: 'v-shield', title: 'Shields', text: 'Shielded enemies carry a bubble worth 50% of their health that absorbs damage first.', counters: 'High total damage: the shield behaves like extra health.' },
  armored: { key: 'v-armored', title: 'Reinforced armor', text: 'Reinforced enemies have +2 armor (Bulwarks reach 4).', counters: 'Arcane and acid ignore armor; Armor Breaker ignores it all.' },
};
