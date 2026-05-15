# Privacy Policy — So nhan xet - AI

**Effective date:** 2026-05-15
**Version:** 1.0
**Applies to:** Chrome Extension "Sổ nhận xét - AI" (all versions)

---

## 30-second summary

- We **DO NOT collect** student names, grades, or any student data.
- Student data **never leaves** the teacher's machine. All comment generation happens locally in the browser.
- Only **3 pieces of data** leave the teacher's machine: teacher's phone number, activation code, and device fingerprint — solely for license verification.
- The extension is **open-source** — anyone can inspect the code.

---

## 1. Who we are

"So nhan xet - AI" is developed and maintained by **Chung Tran** (Vice Principal, Dien Lien Elementary School, Quang Chau commune, Nghe An province, Vietnam), in personal capacity, serving the community of elementary teachers using the Vnedu platform.

Contact: chungsongthinh@gmail.com

## 2. Data we DO NOT collect

The extension **does not transmit** any of the following:

- Student names
- Grades, evaluations
- Class names, school names, specific subjects per class
- Parent contact information
- Any content displayed on the Vnedu page

All reading of student data and generation of comments happen **entirely locally** in the teacher's Chrome browser. No intermediate server receives this data.

## 3. Data we DO collect (for license activation only)

When a teacher registers and activates a license, our license system (Google Apps Script + Google Sheet self-hosted by the author) stores:

| Field | Purpose | Who sees it |
|---|---|---|
| Teacher's full name (self-entered) | Display in admin sheet to confirm payment | Admin (author) only |
| Teacher's phone number | Identify teacher for login + device reset | Admin only |
| 6-character activation code (server-generated) | Match against bank transfer note | Admin only |
| Device fingerprint (SHA-256 hash) | Prevent code-sharing across multiple machines | Admin only |
| Registration / payment / activation / expiration dates | License lifecycle management | Admin only |
| Last check timestamp | Detect anomalies | Admin only |

**Note:** This data is stored in the author's private Google Sheet, never shared with third parties, never sold, never used for advertising. The Sheet exists solely for license administration — similar to a small shop's customer registry.

## 4. Permissions requested

| Permission | Why needed |
|---|---|
| `storage` | Save teacher's personal settings (sidebar font-size, template preferences) and cache the activation code |
| `host_permissions: *.vnedu.vn` | Read/write Vnedu page DOM to generate and apply comments |
| `host_permissions: script.google.com` | Call the license server to verify activation |

The extension **does not request** sensitive permissions such as `tabs`, `cookies`, `webRequest`, `history`, or `geolocation`.

## 5. Third parties

The extension does not share data with any third parties.

The license infrastructure uses Google services (Google Apps Script, Google Sheets) — meaning only Google (as infrastructure provider) can technically observe traffic to the server. Please refer to [Google's Privacy Policy](https://policies.google.com/privacy) if interested. The author has no mechanism for Google to read Sheet contents beyond standard storage.

## 6. Teacher rights

At any time, teachers have the right to:

- **Request deletion** of all license registration info — submit via email; the author will delete within 7 days.
- **Request export** of personal data.
- **Request device reset** when changing machines or reinstalling Windows.
- **Uninstall the extension** any time via `chrome://extensions/` — after uninstallation, no further connection exists from the teacher's machine to our system.

## 7. Children (COPPA)

This extension is intended for **teachers** (adults), **not** for students. While the extension reads student names on the teacher's screen to generate comments, that information:

- Never leaves the teacher's machine
- Is not persisted after the teacher closes the Vnedu tab
- Is not linked to any student identifier

Because no children's data is collected or transmitted, the product complies with the spirit of COPPA and Vietnam's Child Information Safety Law.

## 8. Technical security

- All communication with the license server uses **HTTPS**.
- Device fingerprint is a **one-way hash** (SHA-256) — cannot be reversed to original information.
- Extension source code is **open** — anyone can audit.

## 9. Policy changes

When the policy changes, the new version will be published at the official URL with an effective date. Material changes (expanding data collection scope) will be announced directly in the sidebar before taking effect.

## 10. Contact

Any questions about this Privacy Policy:

- Email: chungsongthinh@gmail.com
- Author: Chung Tran — Dien Lien Elementary School, Quang Chau commune, Nghe An province, Vietnam
