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
  viewerStaticFilesPath: string | undefined;
};

export type User = {
  id: number;
  email: string;
  is_active: boolean;
  is_superuser: boolean;
  is_verified: boolean;
  username: string | null;
};
