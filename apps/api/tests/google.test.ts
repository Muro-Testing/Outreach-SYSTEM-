import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const crawlWebsiteForContactData = vi.fn();
const normalizeBusinessEmail = vi.fn((value: string) => value || null);

vi.mock("../src/services/crawler.js", () => ({
  crawlWebsiteForContactData
}));

vi.mock("../src/services/email.js", () => ({
  normalizeBusinessEmail
}));

describe("google adapter", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllGlobals();
    process.env.GOOGLE_MAPS_API_KEY = "test-google-key";
    crawlWebsiteForContactData.mockReset();
    normalizeBusinessEmail.mockClear();
  });

  afterEach(() => {
    delete process.env.GOOGLE_MAPS_API_KEY;
  });

  it("uses Places API v1 text search successfully", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          places: [
            {
              id: "place-1",
              displayName: { text: "Bright Dental" },
              formattedAddress: "London, UK",
              types: ["dentist"]
            }
          ]
        })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          status: "OK",
          result: {
            formatted_phone_number: "+44 20 0000 0000",
            formatted_address: "1 High Street, London, UK",
            types: ["dentist"]
          }
        })
      });

    vi.stubGlobal("fetch", fetchMock);

    const { fetchGoogleLeads } = await import("../src/adapters/google.js");
    const leads = await fetchGoogleLeads({
      niche: "dentist",
      subNiche: "cosmetic dentistry",
      location: "London, UK",
      maxResults: 10
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0][0]).toBe("https://places.googleapis.com/v1/places:searchText");
    expect(fetchMock.mock.calls[0][1]).toMatchObject({
      method: "POST",
      headers: expect.objectContaining({
        "X-Goog-Api-Key": "test-google-key"
      })
    });
    expect(leads).toHaveLength(1);
    expect(leads[0]).toMatchObject({
      sourceName: "google",
      externalId: "place-1",
      name: "Bright Dental",
      locationText: "1 High Street, London, UK"
    });
  });

  it("falls back to legacy text search when Places API v1 fails", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        json: async () => ({
          error: {
            status: "INVALID_ARGUMENT",
            message: "API not enabled"
          }
        })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          status: "OK",
          results: [
            {
              place_id: "place-2",
              name: "Smile Studio",
              formatted_address: "Manchester, UK",
              types: ["dentist"]
            }
          ]
        })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          status: "OK",
          result: {
            formatted_address: "2 Market Street, Manchester, UK",
            types: ["dentist"]
          }
        })
      });

    vi.stubGlobal("fetch", fetchMock);

    const { fetchGoogleLeads } = await import("../src/adapters/google.js");
    const leads = await fetchGoogleLeads({
      niche: "dentist",
      subNiche: "",
      location: "Manchester, UK",
      maxResults: 10
    });

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(String(fetchMock.mock.calls[1][0])).toContain("/maps/api/place/textsearch/json?");
    expect(leads).toHaveLength(1);
    expect(leads[0]).toMatchObject({
      externalId: "place-2",
      name: "Smile Studio"
    });
  });
});
