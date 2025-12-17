export type AuthorizationScheme =
  | "fractal-server"
  | "testing-basic-auth"
  | "none";

export type Config = {
  port: number;
  bindAddress: string;
  fractalServerUrl: string;
  basePath: string;
  authorizationScheme: AuthorizationScheme;
  cacheExpirationTime: number;
  testingUsername: string | null;
  testingPassword: string | null;
  vizarrStaticFilesPath: string | undefined;
};

export type User = {
  email: string;
};
