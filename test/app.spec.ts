import { describe, it, expect, vi, beforeAll, afterAll } from "vitest";
import {
  getMockedResponse,
  mockConfig,
  getAnonymousMockedRequest,
  getMockedRequestWithRange,
} from "./mock";
import fs from "fs";
import os from "os";
import path from "path";

vi.mock("../src/config.js", () => {
  return mockConfig({
    authorizationScheme: "fractal-server",
  });
});

import { serveZarrData } from "../src/data";
import { Authorizer } from "../src/authorizer";

describe("Serving data", () => {
  const tmpDir = path.join(os.tmpdir(), "fractal-data-app-test");

  beforeAll(() => {
    // Create test files
    const dir = path.join(tmpDir, "directory");
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, "foo"), "012345");
  });

  afterAll(() => {
    fs.rmSync(tmpDir, { recursive: true });
  });

  it("Invalid path request", async () => {
    const request = getAnonymousMockedRequest(`${tmpDir}/../invalid/path`);
    const response = getMockedResponse();
    const authorizer = mockAuthorizer(true, true);
    await serveZarrData(authorizer, request, response);
    expect(response.status).toHaveBeenCalledWith(404);
  });

  it("Unauthorized request", async () => {
    const request = getAnonymousMockedRequest(`${tmpDir}/test1`);
    const response = getMockedResponse();
    const authorizer = mockAuthorizer(false, true);
    await serveZarrData(authorizer, request, response);
    expect(response.status).toHaveBeenCalledWith(401);
  });

  it("Forbidden request", async () => {
    const request = getAnonymousMockedRequest(`${tmpDir}/test1`);
    const response = getMockedResponse();
    const authorizer = mockAuthorizer(true, false);
    await serveZarrData(authorizer, request, response);
    expect(response.status).toHaveBeenCalledWith(403);
  });

  it("File not found", async () => {
    const request = getAnonymousMockedRequest(`${tmpDir}/test2`);
    const response = getMockedResponse();
    const authorizer = mockAuthorizer(true, true);
    await serveZarrData(authorizer, request, response);
    expect(response.status).toHaveBeenCalledWith(404);
  });

  it("File is directory", async () => {
    const request = getAnonymousMockedRequest(`${tmpDir}/directory`);
    const response = getMockedResponse();
    const authorizer = mockAuthorizer(true, true);
    await serveZarrData(authorizer, request, response);
    expect(response.status).toHaveBeenCalledWith(400);
  });

  it("Read file request", async () => {
    const request = getAnonymousMockedRequest(`${tmpDir}/directory/foo`);
    const response = getMockedResponse();
    const authorizer = mockAuthorizer(true, true);
    await serveZarrData(authorizer, request, response);
    await vi.waitUntil(() => response.body === "012345");
    expect(response.setHeader).toHaveBeenCalledWith("Content-Length", 6);
  });

  it("Range request", async () => {
    const request = getMockedRequestWithRange(`${tmpDir}/directory/foo`, {
      start: 1,
      end: 3,
    });
    const response = getMockedResponse();
    const authorizer = mockAuthorizer(true, true);
    await serveZarrData(authorizer, request, response);
    expect(response.status).toHaveBeenCalledWith(206);
    expect(response.setHeader).toHaveBeenCalledWith(
      "Content-Range",
      "bytes 1-3/6"
    );
    expect(response.setHeader).toHaveBeenCalledWith("Content-Length", 3);
    await vi.waitUntil(() => response.body === "123");
  });
});

function mockAuthorizer(valid: boolean, authorized: boolean): Authorizer {
  return {
    async isUserValid() {
      return valid;
    },
    async isUserAuthorized() {
      return authorized;
    },
  };
}
