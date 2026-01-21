import * as fs from "fs";
import * as fsp from "fs/promises";
import type { Request, Response } from "express";
import type { Ranges, Result as RangeParserResult } from "range-parser";
import { getValidPath } from "./path.js";
import { getLogger } from "./logger.js";
import { Authorizer } from "./authorizer.js";
import { S3 } from '@aws-sdk/client-s3';
import { get } from "http";
const s3 = new S3();

const logger = getLogger();

export async function serveZarrData(
  authorizer: Authorizer,
  req: Request,
  res: Response
) {
  try {
    const completePath = getValidPath(req);
    const is_s3 = completePath.startsWith('s3://');
    const validUser = await authorizer.isUserValid(req);
    if (!validUser) {
      logger.info("Unauthorized request: %s", req.path.normalize());
      return res.status(401).send("Unauthorized").end();
    }
    const authorized = await authorizer.isUserAuthorized(completePath, req);
    if (!authorized) {
      logger.info("Forbidden request: %s", req.path.normalize());
      return res.status(403).send("Forbidden").end();
    }
    if (!is_s3) {

      if (!fs.existsSync(completePath)) {
        logger.info("File not found: %s", completePath);
        return res.status(404).send("Not Found").end();
      }
      if (fs.lstatSync(completePath).isDirectory()) {
        logger.info("Path is directory: %s", completePath);
        return res.status(400).send("Is directory").end();
      }
      logger.trace("Path to load: %s", completePath);

      const stats = await fsp.stat(completePath);
      const ranges = req.range(stats.size);
      let options = getRangeOptions(ranges, stats.size, res);

      //if range is invalid, get the whole object and returns 416
      const stream = fs.createReadStream(completePath, options);
      stream.pipe(res);
    }
    else {
      // get bucket and key from URI
      let bucket: string = "";
      let key: string = "";
      try {
        const s3Match = completePath.match(/^s3:\/\/([^\/]+)\/(.+)$/);
        if (!s3Match) {
          const errorMsg = `Invalid S3 URI format: ${completePath}. Expected format: s3://bucket/key`;
          logger.info(errorMsg);
          return res.status(400).send(errorMsg).end();
        }
        bucket = s3Match[1];
        key = s3Match[2];
      }
      catch (parseError) {
        logger.info("Invalid S3 path: %s", completePath);
        return res.status(400).send("Invalid S3 path").end();
      }

      try {

        const s3Response = await s3.getObject({
          Bucket: bucket,
          Key: key
        });
        const objectSize = Number(s3Response.ContentLength);
        const ranges = req.range(objectSize);
        let options = getRangeOptions(ranges, objectSize, res);
        // For range requests, fetch only the requested range from S3
        if (options && 'start' in options && 'end' in options) {
          const rangeResponse = await s3.getObject({
            Bucket: bucket,
            Key: key,
            Range: `bytes=${options.start}-${options.end}`
          });
          const rangeStream = rangeResponse.Body as NodeJS.ReadableStream;
          rangeStream.pipe(res);
        } else {
          //if range is invalid, get the whole object and returns 416
          const s3Stream = s3Response.Body as NodeJS.ReadableStream;
          s3Stream.pipe(res);
        }
      } catch (s3Error) {
        if (s3Error.name === 'NoSuchKey' || s3Error.$metadata?.httpStatusCode === 404) {
          logger.info("S3 object not found: %s", completePath);
          return res.status(404).send("Not Found").end();
        }
        throw s3Error;
      }
    }

  } catch (err) {
    logger.error("Error reading file", err);
    return res.status(500).send("Internal Server Error").end();
  }
}

export function getRangeOptions(ranges: Ranges | RangeParserResult | undefined, size: number, res: Response) {
  let options = {};
  if (ranges && Array.isArray(ranges) && ranges.length === 1) {
    const [range] = ranges;
    const { start, end } = range;
    logger.trace("Requested byte range [%d, %d]", start, end);
    if (start >= size || end >= size) { // ranges are 0-indexed
      res.setHeader("Content-Range", `bytes */${size}`);
      res.status(416);
      return options;
    }
    options = { start, end };
    res.setHeader("Content-Length", end - start + 1);
    res.setHeader("Content-Range", `bytes ${start}-${end}/${size}`);
    res.status(206);
  } else {
    res.setHeader("Content-Length", size);
  }
  return options;
}