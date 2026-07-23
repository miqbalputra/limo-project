# Server Layer

Folder ini menampung kode server-only sesuai layering PRD:

- `auth`: session dan actor resolution
- `db`: Prisma singleton
- `dal`: scoped data reads
- `policies`: RBAC dan ownership checks
- `repositories`: query persistence
- `services`: business logic
- `providers`: payment, notification, storage adapters
- `validation`: schema boundary
- `errors`: domain/application errors
- `logging`: structured logging
- `security`: crypto, origin check, filename sanitization

Business logic tidak boleh bergantung pada `Request`/`Response`.
