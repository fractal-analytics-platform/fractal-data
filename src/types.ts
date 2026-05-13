export type AuthorizationScheme = "fractal-server"

export type Config = {
  port: number;
  bindAddress: string;
  fractalServerUrl: string;
  basePath: string;
  authorizationScheme: AuthorizationScheme;
  cacheExpirationTime: number;
  vizarrStaticFilesPath: string | undefined;
};

export type User = {
  email: string;
};
