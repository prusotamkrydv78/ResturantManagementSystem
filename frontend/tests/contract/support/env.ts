/**
 * What the contract tests need from the outside world.
 *
 * The super admin credentials are read from the environment and never defaulted.
 * They are the most privileged account on the platform, so a fallback baked into a
 * repository would be a credential in source control; a missing value fails loudly
 * with an instruction instead.
 */

/** Base URL of the running API, without a trailing slash. */
export const apiUrl = (process.env.RMS_API_URL ?? "http://localhost:5080").replace(
  /\/$/,
  "",
);

/**
 * The bootstrapped super admin, which is the only account that can create a
 * restaurant and a manager. Everything else the seed needs is created through it.
 */
export function superAdmin(): { email: string; password: string } {
  const email = process.env.RMS_SUPERADMIN_EMAIL;
  const password = process.env.RMS_SUPERADMIN_PASSWORD;

  if (!email || !password) {
    throw new Error(
      [
        "Contract tests need the super admin credentials in the environment.",
        "",
        "  RMS_SUPERADMIN_EMAIL     the bootstrapped super admin email",
        "  RMS_SUPERADMIN_PASSWORD  its password",
        "  RMS_API_URL              optional, defaults to http://localhost:5080",
        "",
        "These are the same values configured under Bootstrap:SuperAdmin for the API.",
        "They are deliberately not defaulted here: a working credential committed to",
        "a repository is a credential leak, however local the account.",
      ].join("\n"),
    );
  }

  return { email, password };
}

/**
 * The password given to every account the seed creates. These accounts live only
 * for the run and hold nothing, so a fixed value is fine and keeps the seed
 * readable; it still has to satisfy the password rules the API enforces.
 */
export const seededPassword = "Contract-Test-Pass-1";
