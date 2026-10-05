/** Pinned defaults for the Hollowmere spring. Tests and the sim both read these. */

export const SPRING_WEEKS = 12;
export const BREAD_PER_DAY = 1;
export const DAYS = 7;
export const EAT = BREAD_PER_DAY * DAYS;

export const UNIT_SLOTS = 10;
export const UNIT_MAX = 10;
export const START_GOLD = 120;
export const START_BREAD = 280;
export const START_MEN = 10;
export const FOOT_WAGE = 2;
export const CAVALRY_WAGE = 4;
export const START_MORALE = 70;
export const START_CONDITION = 80;
export const UNPAID_MORALE = 15;
export const IDLE_CONDITION = 3;
export const DESERT_LINE = 30;

export const GUARD_WAGE_CITY = 3;
export const GUARD_WAGE_VILLAGE = 1;
export const UNPAID_GUARD_MORALE = 10;

export const WOLF_BREAD = 40;
export const WOLF_FROM_WEEK = 3;
export const THORNBACK_WEEK = 9;
export const THORNBACK_KILL_FROM = 10;
export const REBELLION_WEEK = 10;
export const REBELLION_SIZE = 25;
export const REBELLION_MILITIA_DEAD = 10;
export const REBELLION_GUARDS_DEAD = 8;

export const PACK_WEEKS_OF_BREAD = 2;
export const RAID_BREAD = 80;
export const RAID_GOLD = 10;

export const REST_MORALE = 5;
export const REST_CONDITION = 5;
export const FIELD_BREAD = 3;
export const MERCHANT_GOLD = 1;
export const VILLAGE_DUTY_PER = 2;
export const CITY_DUTY_GOLD = 1;
export const PILLAGE_PEASANTS = 2;
export const PURSUIT_LEVY = 20;
export const INN_MESSAGES = 6;
export const INN_RUMOURS = 3;
export const SEARCH_FOOD_FLOOR = 1;
export const CROWN_BREAD_PER_GOLD = 2;

export const JOIN = {
  peasants: { morale: 55, condition: 60 },
  "village-guards": { morale: 50, condition: 65 },
  "crown-guards": { morale: 65, condition: 85 },
  nobles: { morale: 50, condition: 85 },
} as const;
