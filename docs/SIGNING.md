# Code signing and notarisation

ClassGraph's release workflow signs the Windows and macOS builds **automatically once the right
GitHub secrets exist**. With no secrets, builds stay exactly as they are today: Windows unsigned,
macOS ad-hoc signed, so SmartScreen and Gatekeeper show a first-run warning.

Signing needs accounts that only the project owner can open, and each one costs money. Nothing
below has to be done for ClassGraph to keep working.

Add secrets under **GitHub → purysho/ClassGraph → Settings → Secrets and variables → Actions →
New repository secret**. Never commit any of these values.

---

## macOS: Developer ID signing and notarisation

**Needs:** an [Apple Developer Program](https://developer.apple.com/programs/) membership
(currently US$99 per year, individual or organisation).

1. In Xcode (**Settings → Accounts → Manage Certificates**) or on developer.apple.com, create a
   **Developer ID Application** certificate.
2. In Keychain Access, export that certificate _with its private key_ as a `.p12` file and choose
   an export password.
3. Encode it on one line:
   `base64 -i DeveloperID.p12 | tr -d '\n' > DeveloperID.p12.base64`
4. Create an **app-specific password** at [account.apple.com](https://account.apple.com) →
   Sign-In and Security → App-Specific Passwords.
5. Find your **Team ID** at developer.apple.com → Membership details.

| Secret                        | Value                                       |
| ----------------------------- | ------------------------------------------- |
| `MAC_CSC_LINK`                | contents of `DeveloperID.p12.base64`        |
| `MAC_CSC_KEY_PASSWORD`        | the `.p12` export password                  |
| `APPLE_ID`                    | the Apple ID email of the developer account |
| `APPLE_APP_SPECIFIC_PASSWORD` | the app-specific password                   |
| `APPLE_TEAM_ID`               | the 10-character Team ID                    |

With all five set, the workflow builds with the hardened runtime and
`build/entitlements.mac.plist`, notarises the DMG/ZIP build, and fails the release if
`codesign --verify` or `spctl --assess` rejects the app. With only the first two, it signs but
does not notarise. Gatekeeper still warns about un-notarised apps, so set all five.

**After the first notarised release**, macOS can also install updates in the app. That needs two
follow-up changes, kept separate so they can be tested: switch macOS from `notify` to `install`
in `src/update-policy.ts`, and publish `latest-mac.yml` with download names that match the
uploaded files (the workflow currently renames the macOS zips).

---

## Windows: choose one option

Since mid-2023, publicly trusted code-signing certificates must keep their private keys in
hardware or a cloud HSM. A downloadable `.pfx` file is therefore rarely available for new
certificates, and cloud signing is usually the practical route.

### Option A (recommended): Azure Trusted Signing

Microsoft's managed signing service. Pricing has been about US$10 per month for the basic tier,
and identity validation is required. Eligibility, particularly for individuals and by country,
has changed over time, so check Microsoft's current requirements before buying.

1. Create a Trusted Signing account and a **Public Trust** certificate profile in the Azure
   portal, and complete identity validation.
2. Create an app registration (service principal), give it the **Trusted Signing Certificate
   Profile Signer** role on the account, and create a client secret.

| Secret                      | Value                                                             |
| --------------------------- | ----------------------------------------------------------------- |
| `AZURE_TENANT_ID`           | directory (tenant) ID                                             |
| `AZURE_CLIENT_ID`           | application (client) ID of the app registration                   |
| `AZURE_CLIENT_SECRET`       | its client secret                                                 |
| `AZURE_SIGNING_ENDPOINT`    | e.g. `https://eus.codesigning.azure.net/` (your account's region) |
| `AZURE_SIGNING_ACCOUNT`     | Trusted Signing account name                                      |
| `AZURE_CERTIFICATE_PROFILE` | certificate profile name                                          |
| `AZURE_PUBLISHER_NAME`      | the publisher name exactly as on the certificate (CN)             |

### Option B: a certificate file you already have

If you hold an OV/EV code-signing certificate that can be exported as a `.pfx`:

| Secret                 | Value                                         |
| ---------------------- | --------------------------------------------- |
| `WIN_CSC_LINK`         | the `.pfx` encoded with `base64 -w0 cert.pfx` |
| `WIN_CSC_KEY_PASSWORD` | its password                                  |

With either option, the workflow signs the installer and app and fails the release unless
`Get-AuthenticodeSignature` reports **Valid**. A new certificate builds SmartScreen reputation
over time, so early downloads may still show a warning, but they show your publisher name.

---

## Checking a run

The **Configure … signing** steps in the _Desktop release_ workflow log which mode was used
(unsigned, signed, or signed and notarised) without printing any secret. Pull requests from forks
never receive secrets and always build unsigned.
