export type Country = {
  name: string;
  code: string;
  dialCode: string;
  currency: string;
  currencyName: string;
  currencySymbol: string;
  timezone: string;
};

/**
 * African countries used across the platform (org onboarding, driver phone
 * validation, currency display, etc.). Kept as a static constant for now —
 * safe to move to the DB if it ever needs to be tenant-configurable.
 */
export const COUNTRIES: Country[] = [
  { name: "Algeria", code: "DZ", dialCode: "+213", currency: "DZD", currencyName: "Algerian Dinar", currencySymbol: "دج", timezone: "Africa/Algiers" },
  { name: "Angola", code: "AO", dialCode: "+244", currency: "AOA", currencyName: "Angolan Kwanza", currencySymbol: "Kz", timezone: "Africa/Luanda" },
  { name: "Benin", code: "BJ", dialCode: "+229", currency: "XOF", currencyName: "West African CFA Franc", currencySymbol: "CFA", timezone: "Africa/Porto-Novo" },
  { name: "Botswana", code: "BW", dialCode: "+267", currency: "BWP", currencyName: "Botswana Pula", currencySymbol: "P", timezone: "Africa/Gaborone" },
  { name: "Burkina Faso", code: "BF", dialCode: "+226", currency: "XOF", currencyName: "West African CFA Franc", currencySymbol: "CFA", timezone: "Africa/Ouagadougou" },
  { name: "Burundi", code: "BI", dialCode: "+257", currency: "BIF", currencyName: "Burundian Franc", currencySymbol: "FBu", timezone: "Africa/Bujumbura" },
  { name: "Cabo Verde", code: "CV", dialCode: "+238", currency: "CVE", currencyName: "Cape Verdean Escudo", currencySymbol: "Esc", timezone: "Atlantic/Cape_Verde" },
  { name: "Cameroon", code: "CM", dialCode: "+237", currency: "XAF", currencyName: "Central African CFA Franc", currencySymbol: "FCFA", timezone: "Africa/Douala" },
  { name: "Central African Republic", code: "CF", dialCode: "+236", currency: "XAF", currencyName: "Central African CFA Franc", currencySymbol: "FCFA", timezone: "Africa/Bangui" },
  { name: "Chad", code: "TD", dialCode: "+235", currency: "XAF", currencyName: "Central African CFA Franc", currencySymbol: "FCFA", timezone: "Africa/Ndjamena" },
  { name: "Comoros", code: "KM", dialCode: "+269", currency: "KMF", currencyName: "Comorian Franc", currencySymbol: "CF", timezone: "Indian/Comoro" },
  { name: "Congo (DRC)", code: "CD", dialCode: "+243", currency: "CDF", currencyName: "Congolese Franc", currencySymbol: "FC", timezone: "Africa/Kinshasa" },
  { name: "Congo (Republic)", code: "CG", dialCode: "+242", currency: "XAF", currencyName: "Central African CFA Franc", currencySymbol: "FCFA", timezone: "Africa/Brazzaville" },
  { name: "Côte d'Ivoire", code: "CI", dialCode: "+225", currency: "XOF", currencyName: "West African CFA Franc", currencySymbol: "CFA", timezone: "Africa/Abidjan" },
  { name: "Djibouti", code: "DJ", dialCode: "+253", currency: "DJF", currencyName: "Djiboutian Franc", currencySymbol: "Fdj", timezone: "Africa/Djibouti" },
  { name: "Egypt", code: "EG", dialCode: "+20", currency: "EGP", currencyName: "Egyptian Pound", currencySymbol: "E£", timezone: "Africa/Cairo" },
  { name: "Equatorial Guinea", code: "GQ", dialCode: "+240", currency: "XAF", currencyName: "Central African CFA Franc", currencySymbol: "FCFA", timezone: "Africa/Malabo" },
  { name: "Eritrea", code: "ER", dialCode: "+291", currency: "ERN", currencyName: "Eritrean Nakfa", currencySymbol: "Nfk", timezone: "Africa/Asmara" },
  { name: "Eswatini", code: "SZ", dialCode: "+268", currency: "SZL", currencyName: "Swazi Lilangeni", currencySymbol: "E", timezone: "Africa/Mbabane" },
  { name: "Ethiopia", code: "ET", dialCode: "+251", currency: "ETB", currencyName: "Ethiopian Birr", currencySymbol: "Br", timezone: "Africa/Addis_Ababa" },
  { name: "Gabon", code: "GA", dialCode: "+241", currency: "XAF", currencyName: "Central African CFA Franc", currencySymbol: "FCFA", timezone: "Africa/Libreville" },
  { name: "Gambia", code: "GM", dialCode: "+220", currency: "GMD", currencyName: "Gambian Dalasi", currencySymbol: "D", timezone: "Africa/Banjul" },
  { name: "Ghana", code: "GH", dialCode: "+233", currency: "GHS", currencyName: "Ghanaian Cedi", currencySymbol: "GH₵", timezone: "Africa/Accra" },
  { name: "Guinea", code: "GN", dialCode: "+224", currency: "GNF", currencyName: "Guinean Franc", currencySymbol: "FG", timezone: "Africa/Conakry" },
  { name: "Guinea-Bissau", code: "GW", dialCode: "+245", currency: "XOF", currencyName: "West African CFA Franc", currencySymbol: "CFA", timezone: "Africa/Bissau" },
  { name: "Kenya", code: "KE", dialCode: "+254", currency: "KES", currencyName: "Kenyan Shilling", currencySymbol: "KSh", timezone: "Africa/Nairobi" },
  { name: "Lesotho", code: "LS", dialCode: "+266", currency: "LSL", currencyName: "Lesotho Loti", currencySymbol: "L", timezone: "Africa/Maseru" },
  { name: "Liberia", code: "LR", dialCode: "+231", currency: "LRD", currencyName: "Liberian Dollar", currencySymbol: "L$", timezone: "Africa/Monrovia" },
  { name: "Libya", code: "LY", dialCode: "+218", currency: "LYD", currencyName: "Libyan Dinar", currencySymbol: "ل.د", timezone: "Africa/Tripoli" },
  { name: "Madagascar", code: "MG", dialCode: "+261", currency: "MGA", currencyName: "Malagasy Ariary", currencySymbol: "Ar", timezone: "Indian/Antananarivo" },
  { name: "Malawi", code: "MW", dialCode: "+265", currency: "MWK", currencyName: "Malawian Kwacha", currencySymbol: "MK", timezone: "Africa/Blantyre" },
  { name: "Mali", code: "ML", dialCode: "+223", currency: "XOF", currencyName: "West African CFA Franc", currencySymbol: "CFA", timezone: "Africa/Bamako" },
  { name: "Mauritania", code: "MR", dialCode: "+222", currency: "MRU", currencyName: "Mauritanian Ouguiya", currencySymbol: "UM", timezone: "Africa/Nouakchott" },
  { name: "Mauritius", code: "MU", dialCode: "+230", currency: "MUR", currencyName: "Mauritian Rupee", currencySymbol: "₨", timezone: "Indian/Mauritius" },
  { name: "Morocco", code: "MA", dialCode: "+212", currency: "MAD", currencyName: "Moroccan Dirham", currencySymbol: "د.م.", timezone: "Africa/Casablanca" },
  { name: "Mozambique", code: "MZ", dialCode: "+258", currency: "MZN", currencyName: "Mozambican Metical", currencySymbol: "MT", timezone: "Africa/Maputo" },
  { name: "Namibia", code: "NA", dialCode: "+264", currency: "NAD", currencyName: "Namibian Dollar", currencySymbol: "N$", timezone: "Africa/Windhoek" },
  { name: "Niger", code: "NE", dialCode: "+227", currency: "XOF", currencyName: "West African CFA Franc", currencySymbol: "CFA", timezone: "Africa/Niamey" },
  { name: "Nigeria", code: "NG", dialCode: "+234", currency: "NGN", currencyName: "Nigerian Naira", currencySymbol: "₦", timezone: "Africa/Lagos" },
  { name: "Rwanda", code: "RW", dialCode: "+250", currency: "RWF", currencyName: "Rwandan Franc", currencySymbol: "FRw", timezone: "Africa/Kigali" },
  { name: "São Tomé and Príncipe", code: "ST", dialCode: "+239", currency: "STN", currencyName: "São Tomé and Príncipe Dobra", currencySymbol: "Db", timezone: "Africa/Sao_Tome" },
  { name: "Senegal", code: "SN", dialCode: "+221", currency: "XOF", currencyName: "West African CFA Franc", currencySymbol: "CFA", timezone: "Africa/Dakar" },
  { name: "Seychelles", code: "SC", dialCode: "+248", currency: "SCR", currencyName: "Seychellois Rupee", currencySymbol: "₨", timezone: "Indian/Mahe" },
  { name: "Sierra Leone", code: "SL", dialCode: "+232", currency: "SLE", currencyName: "Sierra Leonean Leone", currencySymbol: "Le", timezone: "Africa/Freetown" },
  { name: "Somalia", code: "SO", dialCode: "+252", currency: "SOS", currencyName: "Somali Shilling", currencySymbol: "Sh", timezone: "Africa/Mogadishu" },
  { name: "South Africa", code: "ZA", dialCode: "+27", currency: "ZAR", currencyName: "South African Rand", currencySymbol: "R", timezone: "Africa/Johannesburg" },
  { name: "South Sudan", code: "SS", dialCode: "+211", currency: "SSP", currencyName: "South Sudanese Pound", currencySymbol: "£", timezone: "Africa/Juba" },
  { name: "Sudan", code: "SD", dialCode: "+249", currency: "SDG", currencyName: "Sudanese Pound", currencySymbol: "ج.س", timezone: "Africa/Khartoum" },
  { name: "Tanzania", code: "TZ", dialCode: "+255", currency: "TZS", currencyName: "Tanzanian Shilling", currencySymbol: "TSh", timezone: "Africa/Dar_es_Salaam" },
  { name: "Togo", code: "TG", dialCode: "+228", currency: "XOF", currencyName: "West African CFA Franc", currencySymbol: "CFA", timezone: "Africa/Lome" },
  { name: "Tunisia", code: "TN", dialCode: "+216", currency: "TND", currencyName: "Tunisian Dinar", currencySymbol: "د.ت", timezone: "Africa/Tunis" },
  { name: "Uganda", code: "UG", dialCode: "+256", currency: "UGX", currencyName: "Ugandan Shilling", currencySymbol: "USh", timezone: "Africa/Kampala" },
  { name: "Zambia", code: "ZM", dialCode: "+260", currency: "ZMW", currencyName: "Zambian Kwacha", currencySymbol: "K", timezone: "Africa/Lusaka" },
  { name: "Zimbabwe", code: "ZW", dialCode: "+263", currency: "ZWL", currencyName: "Zimbabwean Dollar", currencySymbol: "$", timezone: "Africa/Harare" },
];

export const CURRENCIES = Array.from(
  new Map(COUNTRIES.map((c) => [c.currency, { code: c.currency, name: c.currencyName, symbol: c.currencySymbol }])).values(),
);

export function getCountryByCode(code: string) {
  return COUNTRIES.find((c) => c.code === code);
}

export function getTimezones() {
  return Array.from(new Set(COUNTRIES.map((c) => c.timezone))).sort();
}
