export type Paginated<T> = {
  items: T[];
  total: number;
  page: number;
  limit: number;
};

export type ApiError = {
  error: { code: string; message: string; details?: Record<string, unknown> };
};

export type DutType = "SMO" | "Near-RT RIC" | "Non-RT RIC" | "xApp" | "rApp";
export type PlatformType = "SMO" | "Near-RT RIC" | "Non-RT RIC";
export type AppType = "xApp" | "rApp";
export type Region = "domestic" | "international";
export type Category =
  | "indoor"
  | "outdoor"
  | "underground"
  | "ground-floor"
  | "high-floor";

export const CATEGORY_LABEL: Record<Category, string> = {
  indoor: "室內",
  outdoor: "室外",
  underground: "地下樓層",
  "ground-floor": "地面樓層",
  "high-floor": "高樓層",
};
export type Interface = "O1" | "A1" | "E2";
export type Role = "admin" | "platform_vendor" | "app_vendor" | "viewer";
