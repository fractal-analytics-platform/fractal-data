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
    expect(response.status).toHaveBeenCalledWith(404); //Should it be an http 400?
  });

  it("Invalid path request - s3", async () => {
    const request = getAnonymousMockedRequest(`s3://bucket`);
    const response = getMockedResponse();
    const authorizer = mockAuthorizer(true, true);
    await serveZarrData(authorizer, request, response);
    expect(response.status).toHaveBeenCalledWith(400);
    expect(response.send).toHaveBeenCalledWith("Invalid S3 URI format: s3://bucket. Expected format: s3://bucket/key");
  });

  it("Unauthorized request", async () => {
    const request = getAnonymousMockedRequest(`${tmpDir}/test1`);
    const response = getMockedResponse();
    const authorizer = mockAuthorizer(false, true);
    await serveZarrData(authorizer, request, response);
    expect(response.status).toHaveBeenCalledWith(401);
  });

  it("Unauthorized request - s3", async () => {
    const request = getAnonymousMockedRequest(`s3://bucket/key`);
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

  it("Forbidden request - s3", async () => {
    const request = getAnonymousMockedRequest(`s3://bucket/key`);
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

  it("File not found - s3", async () => {
    // Mock S3 client to throw NoSuchKey error
    const { mockClient } = await import("aws-sdk-client-mock");
    const { S3Client, GetObjectCommand } = await import("@aws-sdk/client-s3");
    const s3Mock = mockClient(S3Client);
    s3Mock.on(GetObjectCommand).rejects({
      name: "NoSuchKey",
      $metadata: {},
    });
    const request = getAnonymousMockedRequest(`s3://bucket/key`);
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
  // There is no s3 equivalent for directory so no test for that

  it("Read file request", async () => {
    const request = getAnonymousMockedRequest(`${tmpDir}/directory/foo`);
    const response = getMockedResponse();
    const authorizer = mockAuthorizer(true, true);
    await serveZarrData(authorizer, request, response);
    await vi.waitUntil(() => response.body === "012345");
    expect(response.setHeader).toHaveBeenCalledWith("Content-Length", 6);
  });

  it("Read file request - s3", async () => {
    // Mock S3 client to return test data
    const { mockClient } = await import("aws-sdk-client-mock");
    const { S3Client, GetObjectCommand } = await import("@aws-sdk/client-s3");
    const { Readable } = await import("stream");
    const s3Mock = mockClient(S3Client);
    const stream = new Readable();
    stream.push("012345");
    stream.push(null);
    s3Mock.on(GetObjectCommand).resolves({
      Body: stream,
      ContentLength: 6,
    });

    const request = getAnonymousMockedRequest(`s3://bucket/key`);
    const response = getMockedResponse();
    const authorizer = mockAuthorizer(true, true);
    await serveZarrData(authorizer, request, response);
    await vi.waitUntil(() => response.body === "012345");
    expect(response.setHeader).toHaveBeenCalledWith("Content-Length", 6);
    expect(response.body).toBe("012345");
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

  it("Range request - s3", async () => {
    const { mockClient } = await import("aws-sdk-client-mock");
    const { S3Client, GetObjectCommand } = await import("@aws-sdk/client-s3");
    const { Readable } = await import("stream");
    const { sdkStreamMixin } = await import("@smithy/util-stream");
    const s3Mock = mockClient(S3Client);

    let callCount = 0;
    s3Mock.on(GetObjectCommand).callsFake((input) => {
      callCount++;
      if (callCount === 1) {
        // First call - no range, return full content
        const stream1 = new Readable();
        stream1.push("012345");
        stream1.push(null);
        return {
          Body: sdkStreamMixin(stream1),
          ContentLength: 6,
        };
      } else {
        // Second call - with range
        const stream2 = new Readable();
        stream2.push("123");
        stream2.push(null);
        return {
          Body: sdkStreamMixin(stream2),
          ContentRange: "bytes 1-3/6",
          ContentLength: 3,
        };
      }
    });

    const request = getMockedRequestWithRange(`s3://bucket/key`, {
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

import { getRangeOptions } from "../src/data.js";
describe("getRangeOptions", () => {
  it("should return empty for no range header", () => {
    const response = getMockedResponse();
    const options = getRangeOptions(undefined, 6, response);
    expect(options).toEqual({});
    expect(response.setHeader).toHaveBeenCalledWith("Content-Length", 6);
  });

  it("should return 416 if range is invalid", () => {
    const response = getMockedResponse();
    const ranges = Object.assign([{ start: 2, end: 20 }], { type: 'bytes' });
    const options = getRangeOptions(ranges, 6, response);
    expect(options).toEqual({});
    expect(response.status).toHaveBeenCalledWith(416);
  });

  it("should return correct options for valid range", () => {
    const response = getMockedResponse();
    const ranges = Object.assign([{ start: 2, end: 5 }], { type: 'bytes' });
    const options = getRangeOptions(ranges, 6, response);
    expect(options).toEqual({ start: 2, end: 5 });
    expect(response.status).not.toHaveBeenCalledWith(416);
    expect(response.setHeader).toHaveBeenCalledWith("Content-Length", 4);
    expect(response.setHeader).toHaveBeenCalledWith("Content-Range", "bytes 2-5/6");
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
