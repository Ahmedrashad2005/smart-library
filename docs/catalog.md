# Phase 3 catalog administration

The public catalog exposes only active books. Librarians and administrators can choose **Active**, **Archived**, or **All** in the book and copy management pages. The selection is passed to the real API as `archiveState` and is retained when searching or paging.

| Resource    | Active default  | Archived/all access    | Roles                        |
| ----------- | --------------- | ---------------------- | ---------------------------- |
| Books       | Public          | `archiveState=archived | all`or`includeArchived=true` | LIBRARIAN, ADMIN |
| Book copies | Management only | `archiveState=archived | all`                         | LIBRARIAN, ADMIN |

Archived records are available after a reload to authorized management users. Restore is a real API operation followed by a list refresh. Book restore deliberately leaves archived copies archived. Copy restore validates its section/shelf, sets the copy to available, recalculates its parent book inventory counters, and records an audit event.
