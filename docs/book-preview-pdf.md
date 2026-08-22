# Book Preview PDF

## Purpose and domain boundary

Delta University Library can attach one optional, authorized PDF preview to a bibliographic `Book`. It is intentionally separate from the cover image and from every physical `BookCopy`: copies, loans, reservations, availability counters, faculty links, and student records are not changed by preview operations.

The PDF is for a cover, title pages, table of contents, or other preview pages the university is authorized to provide. It is not a full ebook reader. The application does not parse, OCR, summarize, or extract a cover from it.

## Storage architecture

PostgreSQL stores only the generated storage key and safe display metadata. The PDF is stored by `BookAssetStorageService` under `BOOK_PREVIEW_STORAGE_DIR` with a generated UUID filename; the original filename is never used as a filesystem path. API responses never disclose the key or server path.

Local Docker development mounts a named `book_preview_uploads` volume at `/workspace/apps/backend/uploads/books/previews`, so normal container recreation preserves uploads. Uploaded files are ignored by Git.

Production backup must include both:

1. PostgreSQL.
2. The configured preview-file storage directory/volume.

A database backup alone does not contain the PDF bytes. The narrow storage service is the replacement boundary for future object storage.

The five approved local sample PDFs can be attached to their existing Campus bibliographic records without changing physical inventory by running `BOOK_PREVIEW_SOURCE_DIR=/path/to/files npm run prisma:import-book-previews --workspace=@smart-library/backend`. The source PDFs remain outside Git.

## Upload, replace, and delete

- `LIBRARIAN` and `ADMIN` can upload, replace, or remove a preview.
- Upload accepts multipart field `file` and validates a `.pdf` extension, `application/pdf` MIME type, non-empty content, `%PDF-` magic bytes, and the configured size limit.
- The default maximum is 20 MB (`BOOK_PREVIEW_MAX_MB=20`).
- A new file is validated and stored before the database reference changes. If the database transaction fails, the new file is removed and the prior reference remains. After a successful replacement, the old file is removed.
- Delete clears the reference transactionally, removes the stored asset safely, and is idempotent. The Book remains valid.
- Upload, replace, and delete create audit entries without recording filesystem paths.

Only upload preview material or content Delta University is authorized to provide.

## Student view flow

The public Book response contains only:

```json
{
  "preview": {
    "available": true,
    "url": "/books/<book-id>/preview-pdf",
    "originalName": "approved-preview.pdf",
    "size": 1048576,
    "updatedAt": "2026-08-22T10:00:00.000Z"
  }
}
```

Books without an asset return `available: false` and no fake call to action. An authenticated `MEMBER`, `LIBRARIAN`, or `ADMIN` fetches the secured stream with a bearer token. The frontend creates a short-lived browser Blob URL for the native PDF `<object>` and revokes it on exit. A visible “Open PDF” link is retained as the native-viewer fallback.

## API

| Method   | Endpoint                            | Access           | Purpose                            |
| -------- | ----------------------------------- | ---------------- | ---------------------------------- |
| `POST`   | `/api/v1/books/:bookId/preview-pdf` | LIBRARIAN, ADMIN | Upload or replace multipart `file` |
| `GET`    | `/api/v1/books/:bookId/preview-pdf` | Authenticated    | Stream inline `application/pdf`    |
| `DELETE` | `/api/v1/books/:bookId/preview-pdf` | LIBRARIAN, ADMIN | Remove preview idempotently        |

The stream uses `Content-Disposition: inline`, a safe fallback filename plus encoded display filename, `nosniff`, and private no-store caching.

## Known limitations

- One preview PDF per Book.
- Local filesystem storage is the current development implementation.
- No range-request subsystem or custom page-by-page renderer.
- Native PDF rendering quality depends on the browser; the open-PDF fallback remains available.
