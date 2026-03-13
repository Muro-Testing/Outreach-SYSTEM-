import { describe, expect, it } from "vitest";
import { extractDomain, normalizeRawLead } from "../src/services/normalize.js";

describe("normalize", () => {
  it("extracts canonical domain", () => {
    expect(extractDomain("https://www.Example.com/path")).toBe("example.com");
  });

  it("rejects leads with no usable contact/location context", () => {
    const lead = normalizeRawLead({
      sourceName: "google",
      name: "No Data Co",
      raw: {}
    });
    expect(lead).toBeNull();
  });

  it("accepts leads without email when website exists", () => {
    const lead = normalizeRawLead({
      sourceName: "google",
      name: "Website Only Co",
      website: "https://website-only.co.uk",
      raw: {}
    });
    expect(lead).not.toBeNull();
    expect(lead?.email).toBeNull();
  });

  it("rejects image filename disguised as email", () => {
    const lead = normalizeRawLead({
      sourceName: "google",
      name: "Bad Email Co",
      email: "cc_logo_without_face_1_100x@2x.png",
      website: "bad-email.co",
      raw: {}
    });
    expect(lead?.email).toBeNull();
  });

  it("normalizes valid lead", () => {
    const lead = normalizeRawLead({
      sourceName: "apify",
      name: "Bright Dental",
      email: "INFO@BRIGHT.COM",
      website: "bright.com",
      description: "dental clinic in city center",
      raw: {}
    });
    expect(lead?.email).toBe("info@bright.com");
    expect(lead?.websiteDomain).toBe("bright.com");
    expect(lead?.whatTheyDoSummary).toContain("Dental");
  });
});
