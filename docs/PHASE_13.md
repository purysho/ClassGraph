# ClassGraph — Phase 13 Recovery Log

**Phase:** 13 — Optional password protection for class files  
**Branch:** `claude/intelligent-cerf-9dyifr`  
**Base:** `main` after Phase 12  
**Status:** Implemented — PR open  
**Last updated:** 2026-10-06

## Problem

DESIGN.md §11 required encryption to be considered before ClassGraph persistently stores
identifiable student data. Class files are readable JSON in `Documents/ClassGraph`, a folder that
OneDrive, iCloud Drive and similar services often sync.

## Design

- **Optional, per class.** A teacher turns it on from the **Password…** button in the class
  header. Unprotected classes behave exactly as before.
- **File format:** `classgraph-protected-project` v1, a JSON envelope. Only the random project ID
  is readable, because the library uses it to find a renamed file. The full Exchange v1 project
  is encrypted with **AES-256-GCM**, keyed by **scrypt** (N=2^17, r=8, p=1, 16-byte salt; about
  0.4 s per unlock). Format, version and project ID are authenticated, so moving a header onto
  another file fails.
- **No recovery.** There is no master key or reset. The teacher must type the password twice and
  tick a box acknowledging that a forgotten password cannot be recovered.
- **Keys live only in memory** in the main process, for classes unlocked in the current session.
  Quitting, or **Lock now**, forgets them.
- **A locked class is never written as plain JSON.** Saving a protected class whose key is not
  in memory fails with `CG-2016` instead of overwriting the encrypted file.
- **Safety copies:** turning protection on deletes this class's existing plain automatic copies
  (found by project ID, including folders from before a rename). New copies stay encrypted.
  Changing the password re-encrypts the copies with the new password.
- **Backups:** **Backup JSON** saves an encrypted copy for protected classes. A readable copy is a
  separate, confirmed action (**Save an unprotected copy…**). Restoring a protected backup asks
  for its password and keeps it protected.
- **Not covered:** DOCX/PDF/JSON reports the teacher exports, copies they saved themselves
  before turning protection on, and v0.7 legacy files. The UI says so.

## Error codes

- `CG-2015` restoring a protected backup needs its password
- `CG-2016` the class is locked
- `CG-2017` wrong password
- `CG-2018` password shorter than 8 characters
- `CG-2019` the class has no password
- `CG-2027` damaged protected file

## Deliverables

- [x] `src/project-crypto.ts`: envelope, scrypt, AES-256-GCM.
- [x] `FileProjectStore`: discovers protected files, holds keys, protect/unlock/change/unprotect/
      lock, encrypted safety copies and backups, protected restore.
- [x] API: `/api/projects/unlock`, `/api/protection/{status,enable,change,disable,lock,import}`,
      `/api/export/backup`.
- [x] Desktop **Backup JSON** goes through the store, so protected classes stay encrypted.
- [x] UI: **Password…** page, unlock screen (saved-class list, startup, protected restore),
      lock icon in the saved-class list.

## Verification

- [x] `npm run check`: format, lint, strict typecheck, 231 tests, build.
- [x] Unit tests cover round trip, wrong password, swapped header, damaged envelope, locked
      load/save refusal, plain safety copies removed across a rename, backup re-encryption on
      password change, unprotect, short passwords, encrypted vs plain backup, protected restore,
      and the API.
- [x] Browser development mode, end to end: created a class with a Chinese name; two readable
      files existed before protection and none after protecting, editing, backing up, restoring and
      locking; a wrong password was rejected; the encrypted backup restored into an empty library
      with its password; the password was changed and then removed.
