import * as path from 'path';
import type { Request } from 'express';

export function getValidPath(req: Request): string {
  let decodedPath: string = decodeURIComponent(req.path).normalize();
  // path are sent with a leading slash, remove it for s3 paths
  if (decodedPath.startsWith("/s3://")) {
    decodedPath = decodedPath.slice(1);
  }
  return decodedPath;
}

/**
 * Ensures that a path to check is a subfolder of a given parent folder.
 */
export function isSubfolder(parentFolder: string, pathToCheck: string): boolean {
  return !path.relative(parentFolder, pathToCheck).includes('..');
}
