export function getEnv(key: string, fallback = ""): string {
  return process.env[key] ?? fallback;
}

export const env = {
  openrouterApiKey: () => getEnv("OPENROUTER_API_KEY"),
  openrouterSiteUrl: () => getEnv("OPENROUTER_SITE_URL", "https://trippilot.vercel.app"),
  openrouterAppName: () => getEnv("OPENROUTER_APP_NAME", "TripPilot AI"),
  publicDataApiKey: () => getEnv("PUBLIC_DATA_API_KEY"),
  exApiKey: () => getEnv("EX_API_KEY"),
  kiprisApiKey: () => getEnv("KIPRIS_API_KEY"),
  kosisApiKey: () => getEnv("KOSIS_API_KEY"),
  supabaseUrl: () => getEnv("NEXT_PUBLIC_SUPABASE_URL"),
  supabaseAnonKey: () => getEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
  freeTripLimit: () => parseInt(getEnv("FREE_TRIP_LIMIT", "3"), 10),
};
