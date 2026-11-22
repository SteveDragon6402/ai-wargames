import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { appUrl, getAppBaseUrl } from "./app-url";

const previous = {
  APP_URL: process.env.APP_URL,
  RAILWAY_PUBLIC_DOMAIN: process.env.RAILWAY_PUBLIC_DOMAIN,
  RAILWAY_STATIC_URL: process.env.RAILWAY_STATIC_URL,
};

afterEach(() => {
  for (const [key, value] of Object.entries(previous)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

describe("public site address", () => {
  it("keeps a local sign-in on this machine", () => {
    delete process.env.APP_URL;
    delete process.env.RAILWAY_PUBLIC_DOMAIN;
    delete process.env.RAILWAY_STATIC_URL;
    assert.equal(getAppBaseUrl("http://localhost:3000"), "http://localhost:3000");
  });

  it("sends a Railway sign-in to the public site, not the container", () => {
    delete process.env.APP_URL;
    process.env.RAILWAY_PUBLIC_DOMAIN = "wargameweb-production.up.railway.app";
    const url = appUrl("/home", "http://localhost:8080");
    assert.equal(url.href, "https://wargameweb-production.up.railway.app/home");
  });

  it("uses the forwarded host when Railway has not named the domain", () => {
    delete process.env.APP_URL;
    delete process.env.RAILWAY_PUBLIC_DOMAIN;
    delete process.env.RAILWAY_STATIC_URL;
    const url = appUrl("/", "http://localhost:8080", {
      host: "wargameweb-production.up.railway.app",
      proto: "https",
    });
    assert.equal(url.origin, "https://wargameweb-production.up.railway.app");
  });
});
