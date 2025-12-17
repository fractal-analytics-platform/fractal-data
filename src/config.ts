import * as dotenv from "dotenv";
import { getLogger } from "./logger.js";
import { AuthorizationScheme, Config } from "./types";

// Loading environment variables
dotenv.config();

const logger = getLogger();

function getRequiredEnv(envName: string) {
  const value = process.env[envName];
  if (!value) {
    logger.error(
      "Missing required environment variable %s. Check the configuration.",
      envName
    );
    process.exit(1);
  }
  return value;
}

/**
 * @returns the service configuration
 */
function loadConfig(): Config {
  const port = process.env.PORT ? parseInt(process.env.PORT) : 3000;
  const bindAddress = process.env.BIND_ADDRESS || "0.0.0.0";
  const fractalServerUrl = getRequiredEnv("FRACTAL_SERVER_URL");

  const validAuthorizationSchemes = [
    "fractal-server",
  ];
  const authorizationScheme = getRequiredEnv("AUTHORIZATION_SCHEME");
  if (!validAuthorizationSchemes.includes(authorizationScheme)) {
    logger.error(
      'Invalid authorization scheme "%s", allowed values: %s',
      authorizationScheme,
      validAuthorizationSchemes.map((v) => `"${v}"`).join(", ")
    );
    process.exit(1);
  }

  let testingUsername: string | null = null;
  let testingPassword: string | null = null;
  
  // Cookie cache TTL in seconds
  const cacheExpirationTime = process.env.CACHE_EXPIRATION_TIME
    ? parseInt(process.env.CACHE_EXPIRATION_TIME)
    : 60;

  let basePath = process.env.BASE_PATH || "/data";
  if (!basePath.endsWith("/")) {
    basePath += "/";
  }

  const vizarrStaticFilesPath = process.env.VIZARR_STATIC_FILES_PATH;

  logger.debug("PORT: %s", port);
  logger.debug("BIND_ADDRESS: %s", bindAddress);
  logger.debug("FRACTAL_SERVER_URL: %s", fractalServerUrl);
  logger.debug("BASE_PATH: %s", basePath);
  logger.debug("AUTHORIZATION_SCHEME: %s", authorizationScheme);
  logger.debug("CACHE_EXPIRATION_TIME: %d", cacheExpirationTime);

  if (vizarrStaticFilesPath) {
    logger.debug("VIZARR_STATIC_FILES_PATH: %s", vizarrStaticFilesPath);
  }

  return {
    port,
    bindAddress,
    fractalServerUrl,
    basePath,
    authorizationScheme: authorizationScheme as AuthorizationScheme,
    cacheExpirationTime,
    testingUsername,
    testingPassword,
    vizarrStaticFilesPath,
  };
}

let config: Config | null = null;

/**
 * Loads the configuration from environment variables.
 * @returns the service configuration
 */
export function getConfig(): Config {
  if (config === null) {
    config = loadConfig();
  }
  return config;
}
