import { describe, expect, it, vi } from "vitest";

import {
  facebookEndpoints,
  fetchFacebookProfile,
  mapFacebookProfile,
  parseFacebookProfile,
} from "./facebook";
import { HOUSE_PLACEHOLDER_DOMAIN } from "./identity";
import { SocialProviderError } from "./errors";

describe("Facebook Login", () => {
  it("builds versioned Graph endpoints", () => {
    expect(facebookEndpoints("v21.0").authorize).toBe(
      "https://www.facebook.com/v21.0/dialog/oauth",
    );
    expect(facebookEndpoints("v21.0").token).toContain("/oauth/access_token");
    expect(facebookEndpoints("v21.0").userinfo).toContain(
      "fields=id,name,email,picture",
    );
  });

  it("maps a profile that includes an email", () => {
    const profile = parseFacebookProfile({
      id: "99",
      name: "Amina",
      email: "amina@example.com",
      picture: { data: { url: "https://cdn.example/a.jpg" } },
    });
    expect(mapFacebookProfile(profile)).toEqual({
      id: "99",
      name: "Amina",
      email: "amina@example.com",
      image: "https://cdn.example/a.jpg",
    });
  });

  it("uses a placeholder when Facebook withholds the email or picture", () => {
    const profile = parseFacebookProfile({ id: "42", name: "No Mail" });
    expect(profile.email).toBeNull();
    expect(profile.image).toBeNull();
    expect(mapFacebookProfile(profile).email).toBe(
      `fb.42${HOUSE_PLACEHOLDER_DOMAIN}`,
    );
  });

  it("rejects a profile without an id", () => {
    expect(() => parseFacebookProfile({ name: "x" })).toThrow(
      SocialProviderError,
    );
  });

  it("loads the profile with the bearer token and surfaces Graph errors", async () => {
    const fetchImpl = vi.fn(
      async () =>
        new Response(
          JSON.stringify({ id: "7", name: "Sara", email: "sara@example.com" }),
          { status: 200 },
        ),
    );
    const profile = await fetchFacebookProfile({
      accessToken: "token-1",
      version: "v21.0",
      fetchImpl,
    });
    expect(profile.id).toBe("7");
    const [url, init] = fetchImpl.mock.calls[0]!;
    expect(String(url)).toContain("graph.facebook.com/v21.0/me");
    expect((init as RequestInit).headers).toMatchObject({
      Authorization: "Bearer token-1",
    });

    const failing = vi.fn(
      async () =>
        new Response(
          JSON.stringify({ error: { message: "bad token", code: 190 } }),
          {
            status: 401,
          },
        ),
    );
    await expect(
      fetchFacebookProfile({ accessToken: "nope", fetchImpl: failing }),
    ).rejects.toThrow(/bad token/);
    await expect(fetchFacebookProfile({ accessToken: "  " })).rejects.toThrow(
      /access token/,
    );
  });
});
