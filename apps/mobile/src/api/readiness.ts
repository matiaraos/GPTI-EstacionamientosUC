const apiUrl = process.env.EXPO_PUBLIC_API_URL?.trim().replace(/\/+$/, "");

export const hasApiUrl = Boolean(apiUrl);

export async function checkReadiness(): Promise<boolean> {
  if (!apiUrl) {
    throw new Error("Configura EXPO_PUBLIC_API_URL para conectarte a la API.");
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  try {
    const response = await fetch(`${apiUrl}/ready`, { signal: controller.signal });
    return response.ok;
  } finally {
    clearTimeout(timeout);
  }
}
