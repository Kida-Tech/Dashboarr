// Mock the storage layer before importing the store: storage.ts pulls in
// AsyncStorage/SecureStore at module load (native modules unavailable in the
// jest-expo node environment). getBoolean/setBoolean round-trip through
// storage.ts's synchronous in-memory cache, so persistence is still observable.
jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(async () => null),
    setItem: jest.fn(async () => {}),
    removeItem: jest.fn(async () => {}),
    getAllKeys: jest.fn(async () => []),
    multiGet: jest.fn(async () => []),
    multiSet: jest.fn(async () => {}),
    multiRemove: jest.fn(async () => {}),
  },
}));
jest.mock("expo-secure-store", () => ({
  getItemAsync: jest.fn(async () => null),
  setItemAsync: jest.fn(async () => {}),
  deleteItemAsync: jest.fn(async () => {}),
}));

import {
  deleteExclusionKey,
  getDeleteExclusionPref,
  setDeleteExclusionPref,
  type DeleteExclusionKind,
} from "./delete-options-store";
import { deleteKey, getString } from "./storage";

const KINDS: DeleteExclusionKind[] = ["radarr", "sonarr", "lidarr"];

beforeEach(() => {
  for (const kind of KINDS) deleteKey(deleteExclusionKey(kind));
});

describe("delete exclusion preference (#472)", () => {
  it("starts unchecked, like the *arr web UIs", () => {
    for (const kind of KINDS) expect(getDeleteExclusionPref(kind)).toBe(false);
  });

  it("remembers the last choice", () => {
    setDeleteExclusionPref("radarr", true);
    expect(getDeleteExclusionPref("radarr")).toBe(true);

    setDeleteExclusionPref("radarr", false);
    expect(getDeleteExclusionPref("radarr")).toBe(false);
  });

  it("keeps each service kind separate", () => {
    setDeleteExclusionPref("sonarr", true);

    expect(getDeleteExclusionPref("sonarr")).toBe(true);
    expect(getDeleteExclusionPref("radarr")).toBe(false);
    expect(getDeleteExclusionPref("lidarr")).toBe(false);
  });

  it("lives under a local ui.* key, outside the exported config", () => {
    setDeleteExclusionPref("lidarr", true);

    expect(deleteExclusionKey("lidarr")).toBe("ui.deleteExclusion.lidarr");
    expect(getString("ui.deleteExclusion.lidarr")).toBe("true");
  });
});
