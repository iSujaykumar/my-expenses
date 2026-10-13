# Meow - personal expense tracker (Android)

Meow is a private, offline personal expense tracker for Android, built with
React Native + Expo (SDK 57) + TypeScript + Expo Router. No login, no cloud,
no ads, no analytics. Your data stays on your phone.

**Status: Phase 6 (version 1.1.0), feature complete.** Add, edit and delete expenses (with Undo);
History with search, filters and sorting; monthly dashboard; Reports; categories; budgets;
recurring expenses with "Due soon"; CSV export; full JSON backup and restore; theme, date
format and week-start settings; optional sample data.

- App name: **Meow**
- Android package ID: `com.isujaykumar.meow` (never change it, or Android treats it as a different app)
- Version: 1.1.0 (versionCode 5)
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

1. **Export a backup first** (Settings → Backup, export & restore → Export backup) and save it off the phone.
2. Download the APK from a newer green run (steps 3-7).
3. Tap it and choose **Update**. Do **not** uninstall first, because uninstalling deletes your data.
   The database upgrades itself on first open (for example, 1.1.0 adds the recurring tables) and keeps your data.
4. Updating only works while the new APK is signed with the **same key** as the
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

The APK signing certificate SHA-256 has been `fac61745dc0903786fb9ede62a962b399f7348f0bb6f899b8332667591033b9c` in every build so far.

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
- **Home (dashboard):** use the arrows to switch months. Shows the month total (paid +
  pending), the year total, number of expenses, average per day (current month: days so far;
  past months: all days; future months: none), comparison with the previous month, budgets,
  a category chart with a text list of amounts and percentages, and recent expenses.
- **Settings → Categories:** create, rename, recolour, change icon, archive or unarchive.
  Archived categories are hidden when adding expenses but stay in history and totals. You can
  move a category's expenses to another category (amounts and dates never change), and
  delete a category only once it has no expenses.
- **Settings → Budgets:** optional overall and per-category monthly budgets, each with an
  on/off switch. A calm warning shows at 80% used, and a clear note at 100% or more.
- Theme: Follow phone / Light / Dark (Settings).

## Reports, export, backup and settings

**Reports tab.** Pick Month, Year or Custom range. You see the total, the average per day, a comparison with the previous month or year, a trend chart (daily, weekly or monthly; weeks start on the day chosen in Settings), and breakdowns by category, merchant and payment method. Every number has a short "How this is calculated" note. The rule is always the same: **Paid and Pending count, Refunded never counts.** Days with no spending count as ₹0. If a period is still running, it is marked "In progress", and its average uses only the days so far. Grey bars mean a partial week or month. Tap "Show as table" to see every chart value as text.

**Export CSV** (Settings → Backup, export & restore) makes a spreadsheet with one row per expense: ISO date (YYYY-MM-DD), amount in rupees with 2 decimals, the same amount in paise, category and merchant names, payment method, status, and whether it counts as spending. Text that starts with `=`, `+`, `-` or `@` gets a leading `'` so spreadsheet apps cannot run it as a formula. A CSV cannot be imported back; use a backup for that.

**Full backup (JSON)** contains everything: expenses, categories, merchants, budgets and settings, plus `format_version`, the app version and `exported_at`. You choose where to save it from the Android share menu. Nothing is ever uploaded by the app.

**Restore.** Choose a backup file. The whole file is checked *before anything is written*, and you see a preview: how many records are new, already on the phone, or invalid (with reasons). Then choose:
- **Merge (add new)**: only adds what is missing. Nothing on the phone is changed or deleted.
- **Replace everything**: deletes all data on the phone and restores the backup exactly. You are offered "Back up current data first". This runs as a single database transaction, so if anything fails, nothing changes. Replace is refused if the file has any invalid record.

**How duplicates are detected (Merge).** Every record has a permanent random ID that is created once and never changes, and it is stored in the backup. If a record's ID already exists on the phone, it is the same record, so it is skipped and the phone's copy is kept. This means importing the same backup twice adds nothing the second time. Categories and merchants with the same name (ignoring capital letters) are treated as the same, and imported expenses are linked to the existing one. A budget for a category that already has a budget is skipped. Settings always keep the phone's values when merging.

**Settings.** Theme (Follow phone / Light / Dark), date format (used throughout the app), week start (Monday/Sunday, used by weekly reports), links to Categories and Budgets, Backup & restore, and **Reset all data**, which only works after you type `DELETE`. Afterwards the starter categories come back.

**Privacy.** Your data stays on the phone. The app has no account and makes no network calls. The data is **not encrypted** by the app, so use your phone's screen lock. Uninstalling Meow or using "Clear storage" deletes everything permanently unless you exported a backup. Exported files are not encrypted either.

## Recurring expenses

Settings → **Recurring expenses** → **Add recurring expense**: name, amount, category, payment method, **Weekly** (repeats on the weekday of the first date) or **Monthly** (on a day 1-31; if a month is shorter, the last day is used, e.g. 31 → 30 Apr, 28 Feb, or 29 Feb in leap years). You can edit, pause/resume or delete a template. Edits affect only future occurrences; deleting a template keeps expenses it already recorded.

On Home, **Due soon** lists occurrences due in the next 7 days, plus missed ones from the last 60 days. Tap **Record** to save it as a Paid expense dated on its due date, or **Skip**. Each (template, due date) can be recorded **only once**: double taps, repeated taps or reopening the app can never create a duplicate (enforced by a database key, not just the button).

**Meow does not send notifications and has no background jobs.** Nothing is recorded automatically; you only see due items when you open the app.

## Sample data (optional)

Settings → **Load sample expenses** shows your own list of 38 purchases (two-amount entries such as "Tissue 196 and 99" and "Bra 221 and 1243" are split into two expenses, and "Amazon Now" into 8). The count and total shown are calculated from the list, never typed in. All dates start as **today** because the real dates are unknown: use **Set one date for all…** or tap any date to change it. You can also edit each expense later like any other. Uncertain items are marked ⚑ and explained in the preview and in the expense notes: the Amazon Now orders (no item description), Comfort (unclear), Cat shoes (unclear), Flipkart 2200 (no item), and Airtel recharge 548 (the extra "8788" in the original note was not used, because its meaning is unknown). Category suggestions: Electronics, Clothing, Groceries, Pets, Health & Fitness, Home, Bills & Utilities, Shopping, Gifts.

Nothing is added until you confirm. Loading again adds nothing that is already there. **Remove sample expenses** deletes exactly the samples (their IDs start with `sample_v1_`) and never touches your own expenses.

## Complete workflow (suggested)

1. Install the APK (below). Open Meow. The starter categories are ready.
2. Optional: Settings → set the theme, date format and week start.
3. Optional: Settings → Budgets: set an overall monthly budget and any category budgets.
4. Optional: Settings → Recurring expenses: add rent, phone and gym bills.
5. Every day: tap **Add expense**. Mark pending payments as Pending and refunds as Refunded.
6. Check **Home** for this month and **Due soon**, **History** to find anything, and **Reports** for trends.
7. Once a week or month: Settings → Backup, export & restore → **Export backup**, and save it to Google Drive, email it to yourself, or copy it to a computer.

## Backup advice

- Your data lives **only** in the app on this phone. Uninstalling, "Clear storage", a factory reset, or losing the phone deletes it.
- Export a **backup (JSON)** regularly, and always **before updating** the app or resetting the phone. Keep at least two recent copies in different places.
- A **CSV** is for spreadsheets only; it cannot be restored. Use the JSON backup to restore.
- Backups are not encrypted. Store them somewhere private.
- Backups do **not** include recurring templates (you would need to recreate them). They do include every expense, category, merchant, budget and setting.
- To move to a new phone: export a backup, install Meow on the new phone, then Restore → Replace everything.

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
| "Could not open the expense database" on start | Tap **Try again**. If it continues, the database is newer than this app version (install the newer APK), or storage is damaged. Restore your latest backup after reinstalling. |
| Restore says the file is invalid or newer | Pick a file made by Meow's **Export backup** (not the CSV). Files made by a newer Meow version need that newer version. |
| Replace is greyed out | The backup has invalid records; Replace is blocked so a broken file can't wipe your data. Use Merge, or fix the file. |
| A recurring bill isn't in Due soon | It only shows within 7 days of the due date (and 60 days after it). Check it isn't paused, and that it wasn't already recorded or skipped. |
| No reminder came | Meow has no notifications by design. Open the app to see Due soon. |
| Share sheet / file picker does nothing | Make sure a Files, Drive or email app is installed. Try again. |
| Text looks cut off with very large fonts | Please report the screen. Most text wraps, but this was not checked on a real device. |
