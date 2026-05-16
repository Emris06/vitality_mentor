import { faker } from '@faker-js/faker';
import { fakerSeedFrom, seedRng, randomSeed } from './seed';

/**
 * A synthetic individual customer. Every record carries `synthetic: true`
 * so it can never be mistaken for real customer data downstream.
 *
 * Names are drawn from a hand-curated pool of plausible Uzbek-style first
 * and last names. We deliberately do NOT use real public figures.
 */
export interface SyntheticPerson {
  synthetic: true;
  seed: string;
  fullName: string;
  firstName: string;
  lastName: string;
  patronymic: string;
  dob: string; // ISO date
  gender: 'M' | 'F';
  passportNumber: string; // AA1234567
  inn: string; // 14 digit STIR
  phone: string; // +998 9X XXX XX XX
  address: {
    line1: string;
    district: string;
    region: string;
    country: 'UZ';
  };
  occupation: string;
  monthlyIncomeUzs: number;
}

// Curated Uzbek-style name pools. These are common everyday names, NOT
// real public figures. The banned list below catches any accidental
// overlap with real-world public individuals.
const FIRST_M = [
  'Akmal', 'Bekzod', 'Davron', 'Eldor', 'Farrukh', 'Gulom', 'Husan',
  'Ilhom', 'Jasur', 'Komil', 'Lazizbek', 'Murod', 'Nodir', 'Oybek',
  'Rustam', 'Sardor', 'Temur', 'Ulugbek', 'Vohid', 'Zafar',
];
const FIRST_F = [
  'Aziza', 'Barno', 'Dilnoza', 'Elnura', 'Feruza', 'Gulnora', 'Hilola',
  'Iroda', 'Jamila', 'Kamola', 'Lola', 'Madina', 'Nargiza', 'Oysha',
  'Rayhona', 'Saodat', 'Tursunoy', 'Umida', 'Yulduz', 'Zarina',
];
const LAST = [
  'Ahmedov', 'Bobojonov', 'Choriev', 'Davlatov', 'Ergashev', 'Fayzullaev',
  'Gulomov', 'Hakimov', 'Ismoilov', 'Jurayev', 'Kosimov', 'Latipov',
  'Mahmudov', 'Nazarov', 'Otajonov', 'Pirnazarov', 'Rashidov', 'Sodikov',
  'Tursunov', 'Umarov', 'Vahobov', 'Yusupov', 'Zokirov',
];
const PATRONYMIC_SUFFIX_M = 'ovich';
const PATRONYMIC_SUFFIX_F = 'ovna';

const REGIONS: { region: string; districts: string[] }[] = [
  { region: 'Tashkent', districts: ['Chilonzor', 'Mirzo Ulug‘bek', 'Yunusobod', 'Yashnobod', 'Sergeli'] },
  { region: 'Samarkand', districts: ['Bagishamol', 'Siyob', 'Temiryo‘l'] },
  { region: 'Bukhara', districts: ['Markaziy', 'Sharq', 'Gijduvon'] },
  { region: 'Fergana', districts: ['Beshariq', 'Quva', 'Margilon'] },
  { region: 'Andijan', districts: ['Andijon shahar', 'Asaka', 'Xonobod'] },
  { region: 'Namangan', districts: ['Namangan shahar', 'Chust', 'Pop'] },
];

const OCCUPATIONS = [
  'Software engineer', 'Accountant', 'Teacher', 'Doctor', 'Shopkeeper',
  'Driver', 'Construction worker', 'Bank clerk', 'University student',
  'Retired', 'Restaurant owner', 'Pharmacist',
];

/**
 * Names we explicitly forbid generating. Includes well-known public-figure
 * surnames and any name token that should never appear in synthetic data.
 * If any of these leaks into a generated record we throw — that's a bug.
 *
 * NOTE: this is a small defense-in-depth check, not a complete deny list.
 * The real safety guarantee comes from the curated pools above.
 */
const BANNED_TOKENS = [
  'Karimov',
  'Karimova',
  'Mirziyoyev',
  'Mirziyoyeva',
  'Aripov',
  'Inoyatov',
];

function bannedTokensInName(name: string): string[] {
  const lower = name.toLowerCase();
  return BANNED_TOKENS.filter((t) => lower.includes(t.toLowerCase()));
}

function pick<T>(rng: () => number, arr: readonly T[]): T {
  const idx = Math.floor(rng() * arr.length);
  // arr is non-empty by construction in this module.
  return arr[idx] as T;
}

function digits(rng: () => number, n: number): string {
  let out = '';
  for (let i = 0; i < n; i++) out += Math.floor(rng() * 10).toString();
  return out;
}

function passportNumber(rng: () => number): string {
  const letterA = 65;
  const a = String.fromCharCode(letterA + Math.floor(rng() * 26));
  const b = String.fromCharCode(letterA + Math.floor(rng() * 26));
  return `${a}${b}${digits(rng, 7)}`;
}

function uzbekPhone(rng: () => number): string {
  // +998 9X XXX XX XX  (mobile carriers use 90-99)
  const carrier = 90 + Math.floor(rng() * 10);
  const a = digits(rng, 3);
  const b = digits(rng, 2);
  const c = digits(rng, 2);
  return `+998 ${carrier} ${a} ${b} ${c}`;
}

function isoDateInPast(rng: () => number, minYearsAgo: number, maxYearsAgo: number): string {
  const now = new Date();
  const years = minYearsAgo + rng() * (maxYearsAgo - minYearsAgo);
  const ms = now.getTime() - years * 365.25 * 24 * 3600 * 1000;
  const d = new Date(ms);
  return d.toISOString().slice(0, 10);
}

/**
 * Generate a synthetic person. Pass the same `seed` to get the same record.
 *
 * @throws if any banned real-world name token leaks into the output. This
 *         is a safety check; it should never fire with the curated pools.
 */
export function generatePerson(seed?: string): SyntheticPerson {
  const effectiveSeed = seed ?? randomSeed();
  const rng = seedRng(effectiveSeed);
  faker.seed(fakerSeedFrom(effectiveSeed));

  const gender: 'M' | 'F' = rng() < 0.5 ? 'M' : 'F';
  const firstName = pick(rng, gender === 'M' ? FIRST_M : FIRST_F);
  const lastName = pick(rng, LAST);
  // Patronymic is built from a different first-name root to stay believable.
  const patronymicRoot = pick(rng, FIRST_M).replace(/[aeiou]+$/i, '');
  const patronymic = `${patronymicRoot}${gender === 'M' ? PATRONYMIC_SUFFIX_M : PATRONYMIC_SUFFIX_F}`;

  const regionEntry = pick(rng, REGIONS);
  const district = pick(rng, regionEntry.districts);
  const streetNumber = 1 + Math.floor(rng() * 200);
  const apt = 1 + Math.floor(rng() * 120);
  // We don't try to localize the street name — Latin-script transliteration
  // is acceptable for the demo and matches how iSpring exports look.
  const streetName = faker.location.street();
  const line1 = `${streetName} ${streetNumber}, kv. ${apt}`;

  const fullName = `${lastName} ${firstName} ${patronymic}`;

  const banned = bannedTokensInName(fullName);
  if (banned.length > 0) {
    throw new Error(
      `synth-data safety: generated name "${fullName}" hit banned token(s) [${banned.join(', ')}] for seed "${effectiveSeed}"`,
    );
  }

  return {
    synthetic: true,
    seed: effectiveSeed,
    fullName,
    firstName,
    lastName,
    patronymic,
    dob: isoDateInPast(rng, 18, 70),
    gender,
    passportNumber: passportNumber(rng),
    inn: digits(rng, 14),
    phone: uzbekPhone(rng),
    address: {
      line1,
      district,
      region: regionEntry.region,
      country: 'UZ',
    },
    occupation: pick(rng, OCCUPATIONS),
    monthlyIncomeUzs: 2_000_000 + Math.floor(rng() * 28_000_000),
  };
}

export const __testOnly = { bannedTokensInName, BANNED_TOKENS };
