import * as fs from "fs";
import * as fsp from "fs/promises";
import type { Request, Response } from "express";
import { getValidPath } from "./path.js";
import { getLogger } from "./logger.js";
import { Authorizer } from "./authorizer.js";

const logger = getLogger();

export async function serveZarrData(
  authorizer: Authorizer,
  req: Request,
  res: Response
) {
  try {
    const completePath = getValidPath(req);
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

    let options = {};
    if (ranges && Array.isArray(ranges) && ranges.length === 1) {
      const [range] = ranges;
      const { start, end } = range;
      logger.trace("Requested byte range [%d, %d]", start, end);
      options = { start, end };
      res.setHeader("Content-Length", end - start + 1);
      res.setHeader("Content-Range", `bytes ${start}-${end}/${stats.size}`);
      res.status(206);
    } else {
      res.setHeader("Content-Length", stats.size);
    }

    const stream = fs.createReadStream(completePath, options);
    stream.pipe(res);
  } catch (err) {
    logger.error("Error reading file", err);
    return res.status(500).send("Internal Server Error").end();
  }
}
