/** Country list + phone helpers for the "Phone" sign-in tab. Validation here is a first check only: the server decides. */
export interface Country { code: string; name: string; dial: string; min: number; max: number }
export const COUNTRIES: Country[] = [
  { code: 'IN', name: 'India', dial: '+91', min: 10, max: 10 },
  { code: 'US', name: 'United States', dial: '+1', min: 10, max: 10 },
  { code: 'GB', name: 'United Kingdom', dial: '+44', min: 10, max: 10 },
  { code: 'SG', name: 'Singapore', dial: '+65', min: 8, max: 8 },
];
export const DEFAULT_COUNTRY = COUNTRIES[0];
export const countryByCode = (c: string | null | undefined) => COUNTRIES.find((x) => x.code === c) ?? DEFAULT_COUNTRY;

/** Digits only; a single leading trunk "0" is dropped for UK-style input. */
export function nationalDigits(raw: string, country: Country): string {
  let d = raw.replace(/[０-９]/g, (x) => String.fromCharCode(x.charCodeAt(0) - 0xfee0)).replace(/\D/g, '');
  if (country.code === 'GB' && d.startsWith('0')) d = d.slice(1);
  return d.slice(0, country.max);
}
export function validatePhone(raw: string, country: Country): string {
  const d = nationalDigits(raw, country);
  if (!d) return 'Enter your phone number.';
  if (d.length < country.min) return `Enter a valid ${country.name} phone number.`;
  if (country.code === 'IN' && !/^[6-9]/.test(d)) return 'Enter a valid India phone number.';
  return '';
}
export const toE164 = (raw: string, country: Country) => `${country.dial}${nationalDigits(raw, country)}`;
/** "+91 98765 43210" for display while typing. */
export function formatNational(raw: string, country: Country): string {
  const d = nationalDigits(raw, country);
  return d.length > 5 ? `${d.slice(0, 5)} ${d.slice(5)}` : d;
}
/** Masked label for the verification screen: "+91 ······ 3210" / "r•••@example.com". */
export function maskTarget(channel: 'email' | 'phone', value: string): string {
  if (channel === 'phone') {
    const c = COUNTRIES.find((x) => value.startsWith(x.dial));
    if (!c) return value;
    return `${c.dial} ······ ${value.slice(-4)}`;
  }
  const [u, d] = value.split('@');
  return d ? `${u.slice(0, 1)}•••@${d}` : value;
}
