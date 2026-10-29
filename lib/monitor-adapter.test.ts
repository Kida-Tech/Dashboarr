// The adapters transitively import the config store (via services/*-api.ts),
// which loads AsyncStorage/SecureStore, native modules absent in the jest-expo
// node env. Shim them, and stub the two session fetchers so both adapters map
// the same SessionInfo, the way JellyStat's /proxy/getSessions passes
// Jellyfin's own payload through.
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
jest.mock("@/services/jellyfin-api", () => ({
  ...jest.requireActual("@/services/jellyfin-api"),
  getSessions: jest.fn(),
  getJellyfinImageSource: (item: { Id: string; ImageTags?: { Primary?: string } } | null) =>
    item?.ImageTags?.Primary
      ? { uri: `${item.Id}:${item.ImageTags.Primary}`, cacheKey: item.Id }
      : null,
}));
jest.mock("@/services/jellystat-api", () => ({
  getSessions: jest.fn(),
  getPlaybackActivity: jest.fn(async () => []),
}));

import { getSessions as getJellyfinSessions } from "@/services/jellyfin-api";
import { getSessions as getJellystatSessions } from "@/services/jellystat-api";
import { getMonitorAdapter, mergeMonitorActivity } from "./monitor-adapter";
import type { JellyfinSession } from "./types";

const jellyfinMock = getJellyfinSessions as jest.MockedFunction<typeof getJellyfinSessions>;
const jellystatMock = getJellystatSessions as jest.MockedFunction<typeof getJellystatSessions>;

function session(over: Partial<JellyfinSession> = {}): JellyfinSession {
  return {
    Id: "sess",
    ServerId: "srv",
    UserName: "carol",
    Client: "Jellyfin Web",
    DeviceName: "TV",
    RemoteEndPoint: "192.168.1.20",
    NowPlayingItem: {
      Id: "movie",
      Name: "Oppenheimer",
      Type: "Movie",
      RunTimeTicks: 1_000_000_000,
      ImageTags: { Primary: "tag" },
    },
    PlayState: { PositionTicks: 500_000_000, IsPaused: false, PlayMethod: "DirectPlay" },
    ...over,
  } as JellyfinSession;
}

type Source = { kind: "jellystat" | "jellyfin" | "emby"; id: string; isError?: boolean };

// Feeds each source's adapter output through the Activity tab's merge. A
// source with `isError` stands for a query whose latest poll failed while
// TanStack still holds its last good data.
async function activeStreams(sources: Source[]) {
  const results = await Promise.all(
    sources.map(async (s) => ({
      data: await getMonitorAdapter(s.kind).getActivity(s.id),
      isError: s.isError ?? false,
    })),
  );
  const { streams, streamCount } = mergeMonitorActivity(results);
  return { streams, count: streamCount };
}

beforeEach(() => {
  jellyfinMock.mockReset();
  jellystatMock.mockReset();
});

describe("Jellyfin + JellyStat active streams (#460)", () => {
  it("stamps the same session identity from both sources", async () => {
    jellyfinMock.mockResolvedValue([session()]);
    jellystatMock.mockResolvedValue([session()]);
    const [fromJellystat] = (await getMonitorAdapter("jellystat").getActivity("js1")).streams;
    const [fromJellyfin] = (await getMonitorAdapter("jellyfin").getActivity("jf1")).streams;
    expect(fromJellystat!.sessionIdentity).toBe("mediaserver:srv:sess");
    expect(fromJellyfin!.sessionIdentity).toBe(fromJellystat!.sessionIdentity);
    expect(fromJellystat!.key).not.toBe(fromJellyfin!.key);
  });

  it("shows one playback once, as the Jellyfin row with its poster", async () => {
    jellyfinMock.mockResolvedValue([session()]);
    jellystatMock.mockResolvedValue([session()]);
    const { streams, count } = await activeStreams([
      { kind: "jellystat", id: "js1" },
      { kind: "jellyfin", id: "jf1" },
    ]);
    expect(streams).toHaveLength(1);
    expect(streams[0]!.serviceId).toBe("jellyfin");
    expect(streams[0]!.poster).not.toBeNull();
    expect(count).toBe(1);
  });

  it("falls back to the JellyStat row while Jellyfin reports nothing", async () => {
    jellyfinMock.mockResolvedValue([]);
    jellystatMock.mockResolvedValue([session()]);
    const { streams, count } = await activeStreams([
      { kind: "jellystat", id: "js1" },
      { kind: "jellyfin", id: "jf1" },
    ]);
    expect(streams.map((s) => s.serviceId)).toEqual(["jellystat"]);
    expect(count).toBe(1);
  });

  // Jellyfin loaded once (e.g. on home Wi-Fi with a LAN-only URL) and now
  // fails every poll, while JellyStat keeps answering. The frozen Jellyfin row
  // must not hide the live JellyStat copy.
  it("prefers the live JellyStat row over a stale Jellyfin snapshot", async () => {
    jellyfinMock.mockResolvedValue([session()]);
    jellystatMock.mockResolvedValue([
      session({ PlayState: { PositionTicks: 900_000_000, IsPaused: true } }),
    ]);
    const { streams, count } = await activeStreams([
      { kind: "jellyfin", id: "jf1", isError: true },
      { kind: "jellystat", id: "js1" },
    ]);
    expect(streams.map((s) => s.serviceId)).toEqual(["jellystat"]);
    expect(streams[0]!.state).toBe("paused");
    expect(count).toBe(1);
  });

  it("still prefers the Jellyfin row when both sources are stale", async () => {
    jellyfinMock.mockResolvedValue([session()]);
    jellystatMock.mockResolvedValue([session()]);
    const { streams } = await activeStreams([
      { kind: "jellystat", id: "js1", isError: true },
      { kind: "jellyfin", id: "jf1", isError: true },
    ]);
    expect(streams.map((s) => s.serviceId)).toEqual(["jellyfin"]);
  });

  it("ignores a source that errored before it ever loaded", async () => {
    jellystatMock.mockResolvedValue([session()]);
    const jellystat = await getMonitorAdapter("jellystat").getActivity("js1");
    const { streams, streamCount } = mergeMonitorActivity([
      { data: undefined, isError: true },
      { data: jellystat, isError: false },
    ]);
    expect(streams.map((s) => s.serviceId)).toEqual(["jellystat"]);
    expect(streamCount).toBe(1);
  });

  it("keeps two real playbacks on different servers apart", async () => {
    // Same client on the same device: same session Id, different ServerId.
    jellyfinMock.mockResolvedValue([session()]);
    jellystatMock.mockResolvedValue([session({ ServerId: "other-srv" })]);
    const { streams, count } = await activeStreams([
      { kind: "jellystat", id: "js1" },
      { kind: "jellyfin", id: "jf1" },
    ]);
    expect(streams).toHaveLength(2);
    expect(count).toBe(2);
  });

  it("never merges sessions from a server that omits ServerId", async () => {
    jellyfinMock.mockResolvedValue([session({ ServerId: undefined })]);
    jellystatMock.mockResolvedValue([session({ ServerId: undefined })]);
    const { streams } = await activeStreams([
      { kind: "jellystat", id: "js1" },
      { kind: "jellyfin", id: "jf1" },
    ]);
    expect(streams).toHaveLength(2);
  });
});
