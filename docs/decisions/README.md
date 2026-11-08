# Decision records

This folder holds Curved's architecture decision records (ADRs). Each record explains one decision, the options considered, and why we chose one. The format follows [MADR](https://adr.github.io/madr/).

## Records

| Number                                  | Decision                | Status   |
| --------------------------------------- | ----------------------- | -------- |
| [0001](0001-tech-stack.md)              | Tech stack              | accepted |
| [0002](0002-development-conventions.md) | Development conventions | accepted |

## Writing a record

1. Copy [template.md](template.md) to `NNNN-title-with-dashes.md`, using the next number.
2. Set the status to `proposed` and open a pull request.
3. Change the status to `accepted` or `rejected` when the pull request is decided, and add the record to the table above.

Do not change the content of an accepted record. To change a decision, write a new record, then set the old record's status to `superseded by NNNN`.

Statuses: `proposed`, `accepted`, `rejected`, `deprecated`, `superseded by NNNN`.
