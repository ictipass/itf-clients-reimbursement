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

Most ITF evidence should be private. Uploaded files should be downloaded through an authenticated route later, not served directly from a public folder.

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

This reduces the risk of uploaded documents being executed by a browser or treated as trusted application content.

## Packages

These packages are already present in the project dependencies.

For Vercel Blob:

```bash
npm install @vercel/blob
```

For S3:

```bash
npm install @aws-sdk/client-s3 @aws-sdk/s3-request-presigner
```
