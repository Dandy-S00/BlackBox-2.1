import { describe, expect, it } from "vitest";
import { normalizeGatewayEndpoint } from "../lib/gateway-endpoint";
import { validateConfirmationPin, validateProfileName } from "../lib/gateway-profile-validation";

describe("device-local gateway connection", () => {
  it("normalizes a public HTTPS gateway endpoint", () => {
    expect(normalizeGatewayEndpoint(" https://gateway.example.com/ ")).toBe("https://gateway.example.com");
  });

  it("rejects localhost, HTTP, and malformed gateway endpoints", () => {
    expect(() => normalizeGatewayEndpoint("http://gateway.example.com")).toThrow("HTTPS");
    expect(() => normalizeGatewayEndpoint("https://localhost:8443")).toThrow("publicly reachable");
    expect(() => normalizeGatewayEndpoint("not-a-url")).toThrow("valid gateway URL");
  });

  it("validates profile names and short numeric confirmation PINs", () => {
    expect(validateProfileName("  Production  gateway ")).toBe("Production gateway");
    expect(() => validateProfileName("x")).toThrow("at least 2");
    expect(validateConfirmationPin("482916")).toBe("482916");
    expect(() => validateConfirmationPin("token-value")).toThrow("4–8 digit");
  });
});
