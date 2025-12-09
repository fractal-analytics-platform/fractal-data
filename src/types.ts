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

export type OAuthAccountRead = {
  id: number;
  account_email: string;
  oauth_name: string;
};

export type User = {
  id: number;
  email: string;
  is_active: boolean;
  is_superuser: boolean;
  is_verified: boolean;
  group_ids_names: [number, string][] | null;
  oauth_accounts: OAuthAccountRead[];
  profile_id: number | null;
  project_dirs: string[];
  slurm_accounts: string[];
};
