export function getAppUrl() {
  const appUrl = process.env.APP_URL;

  if (!appUrl) {
    if (process.env.NODE_ENV !== "production") {
      return "http://localhost:3000";
    }

    throw new Error("APP_URL environment variable is missing.");
  }

  const url = new URL(appUrl);

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("APP_URL must use HTTP or HTTPS.");
  }

  return url.origin;
}