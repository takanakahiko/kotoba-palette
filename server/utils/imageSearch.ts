interface BraveImageResult {
  properties: { url: string };
}

interface BraveImageResponse {
  results?: BraveImageResult[];
}

const BLOCKED_DOMAINS = ["mercari.com", "res.costowns.com"];

export async function imageSearch(word: string, env: { BRAVE_API_KEY: string }): Promise<string[]> {
  const { BRAVE_API_KEY: apiKey } = env;

  if (!apiKey) {
    throw new Error("BRAVE_API_KEY must be set");
  }

  const query = encodeURIComponent(word);
  const url = `https://api.search.brave.com/res/v1/images/search?q=${query}&count=20&search_lang=jp&safesearch=off`;

  const res = await fetch(url, {
    headers: {
      Accept: "application/json",
      "Accept-Encoding": "gzip",
      "X-Subscription-Token": apiKey,
    },
  });

  if (!res.ok) {
    throw new Error(`Brave Image Search API error: ${res.status}`);
  }

  const data = (await res.json()) as BraveImageResponse;

  if (!data.results || data.results.length === 0) {
    return [];
  }

  return data.results
    .map((item) => item.properties.url)
    .filter((url) => {
      try {
        const hostname = new URL(url).hostname;
        return !BLOCKED_DOMAINS.some((domain) => hostname === domain || hostname.endsWith(`.${domain}`));
      } catch {
        return false;
      }
    });
}
