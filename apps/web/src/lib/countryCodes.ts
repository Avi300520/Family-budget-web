/* =============================================================================
   Shared country calling-code data + phone helpers.

   Single source of truth for the country-code selector used by BOTH the login
   screen and the "add family member" form. Hebrew-first display (RTL UI), but
   each entry also carries an English name so the list stays searchable and the
   Hebrew strings are easy to audit.

   Entries are stored in any order; `COUNTRIES` is sorted for display at module
   load (Israel pinned first, then alphabetically by Hebrew name). Add a country
   by appending one row to `RAW` — no other change required.
   ============================================================================= */

export interface Country {
  /** ISO 3166-1 alpha-2 code — the stable identity (multiple countries share a dial code). */
  iso2: string;
  /** Calling code WITH the leading "+", e.g. "+972". This is what is sent to the backend. */
  dial: string;
  /** English name (kept for searchability + auditability of the Hebrew names). */
  nameEn: string;
  /** Hebrew display name. */
  nameHe: string;
}

/** Default selection: Israel (Israel-first product). */
export const DEFAULT_COUNTRY_ISO = "IL";

// [iso2, dial(no +), nameEn, nameHe]
const RAW: ReadonlyArray<readonly [string, string, string, string]> = [
  ["IL", "972", "Israel", "ישראל"],
  ["US", "1", "United States", "ארצות הברית"],
  ["GB", "44", "United Kingdom", "בריטניה"],
  ["CA", "1", "Canada", "קנדה"],
  ["FR", "33", "France", "צרפת"],
  ["DE", "49", "Germany", "גרמניה"],
  ["AU", "61", "Australia", "אוסטרליה"],
  ["RU", "7", "Russia", "רוסיה"],
  ["AF", "93", "Afghanistan", "אפגניסטן"],
  ["AL", "355", "Albania", "אלבניה"],
  ["DZ", "213", "Algeria", "אלג'יריה"],
  ["AD", "376", "Andorra", "אנדורה"],
  ["AO", "244", "Angola", "אנגולה"],
  ["AR", "54", "Argentina", "ארגנטינה"],
  ["AM", "374", "Armenia", "ארמניה"],
  ["AT", "43", "Austria", "אוסטריה"],
  ["AZ", "994", "Azerbaijan", "אזרבייג'ן"],
  ["BS", "1", "Bahamas", "איי בהאמה"],
  ["BH", "973", "Bahrain", "בחריין"],
  ["BD", "880", "Bangladesh", "בנגלדש"],
  ["BB", "1", "Barbados", "ברבדוס"],
  ["BY", "375", "Belarus", "בלארוס"],
  ["BE", "32", "Belgium", "בלגיה"],
  ["BZ", "501", "Belize", "בליז"],
  ["BJ", "229", "Benin", "בנין"],
  ["BT", "975", "Bhutan", "בהוטן"],
  ["BO", "591", "Bolivia", "בוליביה"],
  ["BA", "387", "Bosnia and Herzegovina", "בוסניה והרצגובינה"],
  ["BW", "267", "Botswana", "בוצוואנה"],
  ["BR", "55", "Brazil", "ברזיל"],
  ["BN", "673", "Brunei", "ברוניי"],
  ["BG", "359", "Bulgaria", "בולגריה"],
  ["BF", "226", "Burkina Faso", "בורקינה פאסו"],
  ["BI", "257", "Burundi", "בורונדי"],
  ["KH", "855", "Cambodia", "קמבודיה"],
  ["CM", "237", "Cameroon", "קמרון"],
  ["CV", "238", "Cape Verde", "כף ורדה"],
  ["CF", "236", "Central African Republic", "הרפובליקה המרכז-אפריקאית"],
  ["TD", "235", "Chad", "צ'אד"],
  ["CL", "56", "Chile", "צ'ילה"],
  ["CN", "86", "China", "סין"],
  ["CO", "57", "Colombia", "קולומביה"],
  ["KM", "269", "Comoros", "קומורו"],
  ["CG", "242", "Congo (Republic)", "קונגו"],
  ["CD", "243", "Congo (DRC)", "קונגו (הרפובליקה הדמוקרטית)"],
  ["CR", "506", "Costa Rica", "קוסטה ריקה"],
  ["CI", "225", "Côte d'Ivoire", "חוף השנהב"],
  ["HR", "385", "Croatia", "קרואטיה"],
  ["CU", "53", "Cuba", "קובה"],
  ["CY", "357", "Cyprus", "קפריסין"],
  ["CZ", "420", "Czechia", "צ'כיה"],
  ["DK", "45", "Denmark", "דנמרק"],
  ["DJ", "253", "Djibouti", "ג'יבוטי"],
  ["DM", "1", "Dominica", "דומיניקה"],
  ["DO", "1", "Dominican Republic", "הרפובליקה הדומיניקנית"],
  ["EC", "593", "Ecuador", "אקוודור"],
  ["EG", "20", "Egypt", "מצרים"],
  ["SV", "503", "El Salvador", "אל סלבדור"],
  ["GQ", "240", "Equatorial Guinea", "גינאה המשוונית"],
  ["ER", "291", "Eritrea", "אריתריאה"],
  ["EE", "372", "Estonia", "אסטוניה"],
  ["SZ", "268", "Eswatini", "אסוואטיני"],
  ["ET", "251", "Ethiopia", "אתיופיה"],
  ["FJ", "679", "Fiji", "פיג'י"],
  ["FI", "358", "Finland", "פינלנד"],
  ["GA", "241", "Gabon", "גבון"],
  ["GM", "220", "Gambia", "גמביה"],
  ["GE", "995", "Georgia", "גאורגיה"],
  ["GH", "233", "Ghana", "גאנה"],
  ["GR", "30", "Greece", "יוון"],
  ["GD", "1", "Grenada", "גרנדה"],
  ["GT", "502", "Guatemala", "גואטמלה"],
  ["GN", "224", "Guinea", "גינאה"],
  ["GW", "245", "Guinea-Bissau", "גינאה-ביסאו"],
  ["GY", "592", "Guyana", "גיאנה"],
  ["HT", "509", "Haiti", "האיטי"],
  ["HN", "504", "Honduras", "הונדורס"],
  ["HK", "852", "Hong Kong", "הונג קונג"],
  ["HU", "36", "Hungary", "הונגריה"],
  ["IS", "354", "Iceland", "איסלנד"],
  ["IN", "91", "India", "הודו"],
  ["ID", "62", "Indonesia", "אינדונזיה"],
  ["IR", "98", "Iran", "איראן"],
  ["IQ", "964", "Iraq", "עיראק"],
  ["IE", "353", "Ireland", "אירלנד"],
  ["IT", "39", "Italy", "איטליה"],
  ["JM", "1", "Jamaica", "ג'מייקה"],
  ["JP", "81", "Japan", "יפן"],
  ["JO", "962", "Jordan", "ירדן"],
  ["KZ", "7", "Kazakhstan", "קזחסטן"],
  ["KE", "254", "Kenya", "קניה"],
  ["KI", "686", "Kiribati", "קיריבטי"],
  ["XK", "383", "Kosovo", "קוסובו"],
  ["KW", "965", "Kuwait", "כווית"],
  ["KG", "996", "Kyrgyzstan", "קירגיזסטן"],
  ["LA", "856", "Laos", "לאוס"],
  ["LV", "371", "Latvia", "לטביה"],
  ["LB", "961", "Lebanon", "לבנון"],
  ["LS", "266", "Lesotho", "לסוטו"],
  ["LR", "231", "Liberia", "ליבריה"],
  ["LY", "218", "Libya", "לוב"],
  ["LI", "423", "Liechtenstein", "ליכטנשטיין"],
  ["LT", "370", "Lithuania", "ליטא"],
  ["LU", "352", "Luxembourg", "לוקסמבורג"],
  ["MO", "853", "Macau", "מקאו"],
  ["MG", "261", "Madagascar", "מדגסקר"],
  ["MW", "265", "Malawi", "מלאווי"],
  ["MY", "60", "Malaysia", "מלזיה"],
  ["MV", "960", "Maldives", "האיים המלדיביים"],
  ["ML", "223", "Mali", "מאלי"],
  ["MT", "356", "Malta", "מלטה"],
  ["MH", "692", "Marshall Islands", "איי מרשל"],
  ["MR", "222", "Mauritania", "מאוריטניה"],
  ["MU", "230", "Mauritius", "מאוריציוס"],
  ["MX", "52", "Mexico", "מקסיקו"],
  ["FM", "691", "Micronesia", "מיקרונזיה"],
  ["MD", "373", "Moldova", "מולדובה"],
  ["MC", "377", "Monaco", "מונקו"],
  ["MN", "976", "Mongolia", "מונגוליה"],
  ["ME", "382", "Montenegro", "מונטנגרו"],
  ["MA", "212", "Morocco", "מרוקו"],
  ["MZ", "258", "Mozambique", "מוזמביק"],
  ["MM", "95", "Myanmar", "מיאנמר"],
  ["NA", "264", "Namibia", "נמיביה"],
  ["NR", "674", "Nauru", "נאורו"],
  ["NP", "977", "Nepal", "נפאל"],
  ["NL", "31", "Netherlands", "הולנד"],
  ["NZ", "64", "New Zealand", "ניו זילנד"],
  ["NI", "505", "Nicaragua", "ניקרגואה"],
  ["NE", "227", "Niger", "ניז'ר"],
  ["NG", "234", "Nigeria", "ניגריה"],
  ["KP", "850", "North Korea", "צפון קוריאה"],
  ["MK", "389", "North Macedonia", "צפון מקדוניה"],
  ["NO", "47", "Norway", "נורבגיה"],
  ["OM", "968", "Oman", "עומאן"],
  ["PK", "92", "Pakistan", "פקיסטן"],
  ["PW", "680", "Palau", "פלאו"],
  ["PS", "970", "Palestine", "פלסטין"],
  ["PA", "507", "Panama", "פנמה"],
  ["PG", "675", "Papua New Guinea", "פפואה גינאה החדשה"],
  ["PY", "595", "Paraguay", "פרגוואי"],
  ["PE", "51", "Peru", "פרו"],
  ["PH", "63", "Philippines", "הפיליפינים"],
  ["PL", "48", "Poland", "פולין"],
  ["PT", "351", "Portugal", "פורטוגל"],
  ["PR", "1", "Puerto Rico", "פוארטו ריקו"],
  ["QA", "974", "Qatar", "קטאר"],
  ["RO", "40", "Romania", "רומניה"],
  ["RW", "250", "Rwanda", "רואנדה"],
  ["KN", "1", "Saint Kitts and Nevis", "סנט קיטס ונוויס"],
  ["LC", "1", "Saint Lucia", "סנט לוסיה"],
  ["VC", "1", "Saint Vincent and the Grenadines", "סנט וינסנט והגרנדינים"],
  ["WS", "685", "Samoa", "סמואה"],
  ["SM", "378", "San Marino", "סן מרינו"],
  ["ST", "239", "Sao Tome and Principe", "סאו טומה ופרינסיפה"],
  ["SA", "966", "Saudi Arabia", "ערב הסעודית"],
  ["SN", "221", "Senegal", "סנגל"],
  ["RS", "381", "Serbia", "סרביה"],
  ["SC", "248", "Seychelles", "איי סיישל"],
  ["SL", "232", "Sierra Leone", "סיירה לאון"],
  ["SG", "65", "Singapore", "סינגפור"],
  ["SK", "421", "Slovakia", "סלובקיה"],
  ["SI", "386", "Slovenia", "סלובניה"],
  ["SB", "677", "Solomon Islands", "איי שלמה"],
  ["SO", "252", "Somalia", "סומליה"],
  ["ZA", "27", "South Africa", "דרום אפריקה"],
  ["KR", "82", "South Korea", "דרום קוריאה"],
  ["SS", "211", "South Sudan", "דרום סודאן"],
  ["ES", "34", "Spain", "ספרד"],
  ["LK", "94", "Sri Lanka", "סרי לנקה"],
  ["SD", "249", "Sudan", "סודאן"],
  ["SR", "597", "Suriname", "סורינאם"],
  ["SE", "46", "Sweden", "שוודיה"],
  ["CH", "41", "Switzerland", "שווייץ"],
  ["SY", "963", "Syria", "סוריה"],
  ["TW", "886", "Taiwan", "טייוואן"],
  ["TJ", "992", "Tajikistan", "טג'יקיסטן"],
  ["TZ", "255", "Tanzania", "טנזניה"],
  ["TH", "66", "Thailand", "תאילנד"],
  ["TL", "670", "Timor-Leste", "מזרח טימור"],
  ["TG", "228", "Togo", "טוגו"],
  ["TO", "676", "Tonga", "טונגה"],
  ["TT", "1", "Trinidad and Tobago", "טרינידד וטובגו"],
  ["TN", "216", "Tunisia", "תוניסיה"],
  ["TR", "90", "Turkey", "טורקיה"],
  ["TM", "993", "Turkmenistan", "טורקמניסטן"],
  ["TV", "688", "Tuvalu", "טובאלו"],
  ["UG", "256", "Uganda", "אוגנדה"],
  ["UA", "380", "Ukraine", "אוקראינה"],
  ["AE", "971", "United Arab Emirates", "איחוד האמירויות"],
  ["UY", "598", "Uruguay", "אורוגוואי"],
  ["UZ", "998", "Uzbekistan", "אוזבקיסטן"],
  ["VU", "678", "Vanuatu", "ונואטו"],
  ["VA", "379", "Vatican City", "הוותיקן"],
  ["VE", "58", "Venezuela", "ונצואלה"],
  ["VN", "84", "Vietnam", "וייטנאם"],
  ["YE", "967", "Yemen", "תימן"],
  ["ZM", "260", "Zambia", "זמביה"],
  ["ZW", "263", "Zimbabwe", "זימבבואה"],
];

/** Convert an ISO 3166-1 alpha-2 code to its flag emoji (regional indicators). */
export function isoToFlag(iso2: string): string {
  return iso2
    .toUpperCase()
    .replace(/[^A-Z]/g, "")
    .replace(/./g, (c) => String.fromCodePoint(127397 + c.charCodeAt(0)));
}

/** Pinned to the top, in this exact order, ahead of the dial-code sort. */
const PINNED_ORDER = ["IL", "US"];
const PINNED = new Set(PINNED_ORDER);

/** Numeric calling code (digits only) for sort comparisons. */
function dialNumber(c: Country): number {
  return Number(c.dial.slice(1));
}

/**
 * Full country list for display: Israel first, United States second, then all
 * remaining countries sorted by numeric calling code ascending. Ties (shared
 * dial codes, e.g. the many +1 countries) break by Hebrew name, then ISO code,
 * so the order is fully deterministic.
 */
export const COUNTRIES: Country[] = (() => {
  const all: Country[] = RAW.map(([iso2, dialDigits, nameEn, nameHe]) => ({
    iso2,
    dial: `+${dialDigits}`,
    nameEn,
    nameHe,
  }));
  const pinned = PINNED_ORDER
    .map((iso) => all.find((c) => c.iso2 === iso))
    .filter((c): c is Country => Boolean(c));
  const rest = all
    .filter((c) => !PINNED.has(c.iso2))
    .sort(
      (a, b) =>
        dialNumber(a) - dialNumber(b) ||
        a.nameHe.localeCompare(b.nameHe, "he") ||
        a.iso2.localeCompare(b.iso2),
    );
  return [...pinned, ...rest];
})();

const BY_ISO = new Map(COUNTRIES.map((c) => [c.iso2, c]));

export function countryByIso(iso2: string): Country | undefined {
  return BY_ISO.get(iso2);
}

/** Dial code (with "+") for an ISO code; falls back to the default country. */
export function dialForIso(iso2: string): string {
  return (BY_ISO.get(iso2) ?? BY_ISO.get(DEFAULT_COUNTRY_ISO))!.dial;
}

/** Readable option label, e.g. "🇮🇱 ישראל (+972)". */
export function countryLabel(c: Country): string {
  return `${isoToFlag(c.iso2)} ${c.nameHe} (${c.dial})`;
}

/**
 * Normalize a country dial code + local number into E.164.
 * Strips non-digits and a single leading-zero run from the local part.
 * Returns null when the result looks out of range (too short / too long).
 *
 * NOTE: keeps the exact behavior the members form relied on previously, so
 * existing Israeli-number entry (e.g. "050-123-4567" or "0501234567") still
 * normalizes to "+972501234567".
 */
export function toE164(dial: string, localNumber: string): string | null {
  const digits = localNumber.replace(/\D/g, "");
  const stripped = digits.replace(/^0+/, "");
  if (stripped.length < 7 || stripped.length > 13) return null;
  return `${dial}${stripped}`;
}
