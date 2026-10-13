# Meow - personal expense tracker (Android)

Meow is a private, offline personal expense tracker for Android, built with
React Native + Expo (SDK 57) + TypeScript + Expo Router. No login, no cloud,
no ads, no analytics. Your data stays on your phone.

**Status: Phase 3 (version 1.0.1).** You can add, edit and delete expenses (with Undo),
and browse, search, filter and sort them in History.

- App name: **Meow**
- Android package ID: `com.isujaykumar.meow` (never change it, or Android treats it as a different app)
- Version: 1.0.1 (versionCode 2)
- Currency: INR (Rs)

---

## How the APK is built (nothing to install on your computer)

GitHub Actions builds the app on GitHub's servers using
`.github/workflows/build-apk.yml` (named **Build Android APK**). It runs:

`npm ci` -> lint -> typecheck -> tests -> `npx expo prebuild --platform android --no-install`
-> `./gradlew assembleRelease` -> checks the APK exists and is not empty ->
prints the signing certificate -> uploads the APK.

It runs automatically on every push to `main`, and you can also start it by hand.

### Step by step

1. **Repository.** The code lives at https://github.com/iSujaykumar/my-expenses.
   (To create one yourself: on github.com click **+** -> **New repository**,
   name it `my-expenses`, click **Create repository**.)
2. **Push.** Any new code pushed to the `main` branch starts a build automatically.
3. **Open the Actions tab.** On the repository page, click **Actions** in the top menu.
4. **Run the workflow by hand (optional).** In the left list click **Build Android APK**,
   click the **Run workflow** button on the right, keep branch `main`, then click the
   green **Run workflow** button.
5. **Wait.** A yellow dot means running (about 15-20 minutes). A green tick means
   success. A red cross means failure (see Troubleshooting).
6. **Download.** Click the finished run, scroll to **Artifacts**, click
   **personal-expense-tracker-apk**. A ZIP file downloads. (You must be signed in to
   GitHub. Artifacts are deleted after 30 days.)
7. **Unzip.** On the phone, open the ZIP in the **Files** app and tap **Extract**.
   Or on a computer, double-click the ZIP and copy `app-release.apk` to the phone.
8. **Allow unknown sources.** Tap `app-release.apk`. Android says installing from this
   source is not allowed: tap **Settings**, turn on **Allow from this source** for
   the Files app (or browser), then press back.
9. **Install.** Tap **Install**. If Play Protect warns about an unknown app, tap
   **More details** -> **Install anyway** (the app is yours and is not on the Play Store).
10. **Open** Meow from your app drawer.

### Updating the app later

1. Download the APK from a newer green run (steps 3-7).
2. Tap it and choose **Update**. Do **not** uninstall first, because uninstalling deletes your data.
3. Updating only works while the new APK is signed with the **same key** as the
   installed one (see Signing). If Android says "App not installed" or
   "package conflicts with an existing package", the key changed.

---

## Signing (please read)

Android only installs signed APKs. This project uses no secret keys and no paid
service. The Expo template signs the release build with its **debug key**
(`android/app/debug.keystore`, password `android`, which is publicly known).

- Fine for **personal sideloading** on your own phone.
- Updates install over the old version **only while the signing key stays the same**.
- **Not suitable for Google Play**, and not secure: anyone can sign an APK with
  this public debug key. Publishing would need your own private upload key.

**Is the key stable between builds?** Yes, as far as we checked. `expo prebuild`
copies `android/app/debug.keystore` from the npm package
`expo-template-bare-minimum`. It is a fixed file inside that package, not generated
on each machine. Its SHA-256 is the same in the SDK 55, 56 and 57 templates
(`221e0a31...9f5e58`). Each workflow run prints the keystore file hash and the APK
certificate SHA-256 in the step "Show signing certificate fingerprint", so you can
compare runs. Risk: a future Expo SDK upgrade could ship a different keystore.
Check that step after any SDK upgrade.

---

## Using the app

- **Add an expense:** tap the green **Add expense** button (Home or History). Enter the amount,
  pick a category, and optionally add a description, date (defaults to today), time, merchant
  (recent ones are suggested), payment method, status and notes. Tap **Save expense**.
  If something is missing, the problem is shown in red under that field, and nothing you
  typed is lost.
- **Status:** *Paid* and *Pending* count as spending (Pending shows a badge). *Refunded*
  never counts in any total.
- **Edit:** tap any expense. **Delete** asks for confirmation, then shows **Undo** for a
  few seconds. Undo brings the expense back exactly as it was.
- **Leaving with unsaved changes:** the back arrow and Android's back button ask
  before discarding.
- **History tab:** expenses grouped by day with day totals. Search box (description,
  merchant, notes). Use the filter button to choose date range, category, merchant,
  payment method, status and sort order. The line under the search box shows how many
  expenses match and their total (refunded not counted). **Clear filters** resets everything.
- Light and dark mode follow your phone's setting.

## For developers

```bash
npm ci
npm run lint
npm run typecheck
npm test
npx expo start
```

The generated `android/` and `ios/` folders are not committed. CI recreates them with `expo prebuild`.

## Troubleshooting

| Problem | What to do |
| --- | --- |
| Run shows a red cross | Click the run, then the red step, and read the last lines. Common causes: `npm ci` failing (package-lock out of date: run `npm install` and commit `package-lock.json`), lint/typecheck/test errors, Gradle errors. |
| No **Run workflow** button | Sign in. You need write access, and the workflow file must be on `main`. |
| No **Artifacts** section | The run did not succeed, or it is older than 30 days. Run it again. |
| "App not installed" when updating | The signing key changed or the version is older. See Signing. |
| Install blocked | Allow unknown sources for the app you opened the APK from (step 8). |
| "There was a problem parsing the package" | The download is incomplete. Download and unzip again. |
