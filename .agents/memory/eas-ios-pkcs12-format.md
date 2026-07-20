---
name: EAS iOS PKCS12 Format
description: EAS iOS builds fail with UNKNOWN_ERROR in Prepare credentials when using modern PKCS12 format; must use OpenSSL legacy format
---

## Rule

When creating a .p12 distribution certificate for EAS iOS builds, always use OpenSSL with legacy encryption (3DES + SHA-1). Python's cryptography library creates modern PKCS12 (AES-256-CBC + SHA-256 HMAC) which macOS `security import` cannot process on EAS build machines.

## Working Command

```bash
openssl pkcs12 -export \
  -in dist_cert.pem \
  -inkey dist_private.key \
  -out dist_cert.p12 \
  -passout pass:PASSWORD \
  -name "iPhone Distribution: NAME (TEAM_ID)" \
  -legacy \
  -keypbe PBE-SHA1-3DES \
  -certpbe PBE-SHA1-RC2-40 \
  -macalg SHA1
```

**Why:** EAS build machines (macOS) use `security import` to import the .p12 into the keychain. This command does not support PKCS12 v3 files created by Python's cryptography library (which uses SHA-256 HMAC and AES-256-CBC). The legacy format (3DES/RC2 + SHA-1) works universally with macOS.

**How to apply:** Every time a new distribution certificate .p12 needs to be created for EAS iOS builds, use the OpenSSL command above instead of Python's `pkcs12.serialize_key_and_certificates()`.

## Other Key Findings

- `credentialsSource` must be at the TOP LEVEL of the build profile, NOT inside the `ios` key
- `*.p12`, `*.key`, `*.mobileprovision` in `.gitignore` are NOT excluded when using `EAS_NO_VCS=1`
- `.easignore` must explicitly whitelist cert files: `!certs/dist_cert.p12`, `!certs/rawabi.mobileprovision`
- `ascAppId` in submit profile must be the NUMERIC App Store Connect ID (e.g., `6792793006`), not the bundle ID
- `provisioningProfilePath` is the correct field name in credentials.json (not `provisioningProfile.path`)
