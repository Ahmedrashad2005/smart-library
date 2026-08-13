# Catalog administration and NAWA Campus integration

`Book` remains the shared knowledge entity rather than a Campus-only record. The established Store-facing catalog and Phase 3 inventory continue to coexist with Phase 5.1 Campus holdings.

For Campus copies, administrators/librarians may assign a real home room and the supplied shelf-location code through existing copy create/update flows. The API checks that the selected section belongs to the same room. Operational status (`AVAILABLE`, `BORROWED`, `DAMAGED`, `MAINTENANCE`, and established lifecycle states) is separate from home location, so borrowing never hides where the copy belongs.

Structural library, floor, and room writes are ADMIN-only. Their public reads expose only the safe active hierarchy. This division lets librarians manage copies while reserving structural changes for administrators.

The public catalog exposes only active books. Librarians and administrators can choose **Active**, **Archived**, or **All** in the book and copy management pages. The selection is passed to the real API as `archiveState` and is retained when searching or paging.

| Resource    | Active default  | Archived/all access    | Roles                        |
| ----------- | --------------- | ---------------------- | ---------------------------- |
| Books       | Public          | `archiveState=archived | all`or`includeArchived=true` | LIBRARIAN, ADMIN |
| Book copies | Management only | `archiveState=archived | all`                         | LIBRARIAN, ADMIN |

Archived records are available after a reload to authorized management users. Restore is a real API operation followed by a list refresh. Book restore deliberately leaves archived copies archived. Copy restore validates its section/shelf, sets the copy to available, recalculates its parent book inventory counters, and records an audit event.
