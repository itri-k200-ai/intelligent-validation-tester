export const DUT_TYPES = ["SMO", "Near-RT RIC", "Non-RT RIC", "xApp", "rApp"] as const;
export const INTERFACES = ["O1", "A1", "E2"] as const;
export const AI_CASES = [
  "CCO",
  "ENERGY_SAVING",
  "NETWORK_OPT",
  "TRAFFIC_PREDICTION",
  "LOAD_BALANCING",
  "EDGE_COMPUTING",
] as const;
export const CATEGORIES = ["underground", "ground-floor", "high-floor"] as const;
export const REGIONS = ["domestic", "international"] as const;

export const STATUS_COLOR = {
  online: "green",
  offline: "gray",
  error: "red",
  passed: "green",
  failed: "red",
  running: "orange",
  pending: "gray",
  cancelled: "gray",
} as const;
