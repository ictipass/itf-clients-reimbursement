# Document Storage

The app stores uploaded file binaries outside PostgreSQL and keeps document metadata in the database.

## Storage Provider

New uploads are controlled by:

```env
STORAGE_PROVIDER="local"
```

or:

```env
STORAGE_PROVIDER="vercel_blob"
```

or:

```env
STORAGE_PROVIDER="s3"
```

Each `Document` row also stores its own `storageProvider`, so older files remain traceable if the preferred provider changes later.

For local development, uploaded files are stored under `LOCAL_STORAGE_ROOT`, which defaults to `storage/uploads`. This folder is intentionally ignored by git and must not be placed under `public`.

Hosted adapters are implemented for **private Vercel Blob** and **private S3**. They use the same
authenticated document routes and store the provider on each document, so changing the default
provider affects only new uploads. Do not configure `STORAGE_PROVIDER=local` on Vercel: its
filesystem is not persistent document storage.

For Blob, create a **private** store, connect it separately to Preview and Production, and set
`BLOB_READ_WRITE_TOKEN` in each environment. Use `STORAGE_PROVIDER=vercel_blob`. Blob URLs in
the database are metadata only; never display them to users in place of authenticated routes.

For S3, create a private bucket with public access blocked and default encryption enabled. Set
`STORAGE_PROVIDER=s3`, `S3_BUCKET`, `S3_REGION`, and standard AWS SDK credentials/role settings.
Grant only the required object read/write permissions. Use separate buckets or credentials for
Preview and Production. Bucket changes require migration because each document retains its bucket.

### Existing local documents

Run this on the machine containing `LOCAL_STORAGE_ROOT` and against the intended database:

```cmd
set STORAGE_PROVIDER=vercel_blob
npm run storage:migrate
npm run storage:migrate -- --apply
```

The first command is a dry run. The apply command verifies each source checksum, uploads a copy,
reads it back, verifies its checksum again, and only then updates that document's provider/key.
It never deletes local originals; failed documents stay `LOCAL` and can be retried. Back up the
database and local upload directory first. Do not deploy a database containing `LOCAL` records
to Vercel until those records are migrated or the old files remain available to that deployment.

### Remaining Vercel upload limit

The existing server-action and route upload forms accept up to 10 MB, but Vercel Functions limit
request bodies to 4.5 MB. Hosted adapters do not bypass that limit. Direct-to-storage uploads
with scoped, authenticated upload authorization and server-side validation are the next slice;
until then, **do not claim the full 10 MB upload workflow is ready for Vercel**. The company
evidence download route now streams hosted files; other generated-document download routes
still buffer files and must be audited for large output before production.

## Provider Metadata

The `Document` model stores:

- `storageProvider`: local disk, Vercel Blob, or S3
- `bucket`: bucket/store name where applicable
- `objectKey`: provider object key/path
- `url`: provider URL, not necessarily public
- `etag`: provider integrity/cache metadata
- `versionId`: object version where supported
- `checksum`: application-computed checksum
- `mimeType`
- `fileSize`
- `access`: private or public

Most ITF evidence should be private. Uploaded files are downloaded through an authenticated route, not served directly from a public folder.

The current company evidence download route is:

```text
/registry/[companyId]/evidence/[documentId]
```

The route verifies the active company/document relationship and the current user's organization access before reading from storage.

For reviewer-friendly previews, the same protected route supports inline viewing for PDF, JPEG, and PNG:

```text
/registry/[companyId]/evidence/[documentId]?disposition=inline
```

## E-Forms Versus Uploads

ITF forms should be structured e-forms in the application, not ordinary uploads.

Examples:

- Form 7A maps to `Company`, `ComplianceYear`, and `ComplianceBranchReturn`.
- Form 4A maps to `TrainingRequest` and `TrainingParticipant`.
- TR Form 1 maps to `ReimbursementClaim`.
- TR Form 2A maps to `ReimbursementClaimLine`.

Uploaded documents are supporting evidence, such as:

- CAC certificate
- Tax Clearance Certificate
- Audited account
- Contribution receipt
- Attendance sheet
- Payment receipt
- Training report
- Training photo
- Certificate
- Signed declaration
- Official stamped copy
- Other supporting evidence

## Upload Security

The local upload flow is intentionally restrictive:

- Files are stored outside `public`.
- Original filenames are sanitized and used only for display.
- Object keys are random, not user-controlled.
- Allowed file types are limited to PDF, JPEG, and PNG for this first slice.
- File signatures are checked in addition to browser-provided MIME type.
- HTML, SVG, JavaScript, and Office documents are blocked in this first slice.
- Files are recorded as private metadata.
- Downloads use `Content-Disposition`, `X-Content-Type-Options: nosniff`, and `Content-Security-Policy: sandbox`.
- Inline previews are only allowed for the restricted upload types: PDF, JPEG, and PNG.

This reduces the risk of uploaded documents being executed by a browser or treated as trusted application content.

## Packages

These packages are already present in the project dependencies and are used by the hosted adapters.

For Vercel Blob:

```bash
npm install @vercel/blob
```

For S3:

```bash
npm install @aws-sdk/client-s3 @aws-sdk/s3-request-presigner
```
