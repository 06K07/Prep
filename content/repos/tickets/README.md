# Ticket Management System (pre-prod)

Support-desk backend: create tickets, assign, move through a workflow, list with
filters/pagination, and report SLA breaches.

Layers:  tests/test.cpp -> src/service.hpp -> src/workflow.hpp + src/store.hpp -> src/models.hpp

Workflow rules:
  OPEN -> IN_PROGRESS -> RESOLVED -> CLOSED
  IN_PROGRESS may go back to OPEN, RESOLVED may be reopened to IN_PROGRESS.
  CLOSED is terminal.

Listing: sorted by priority (CRITICAL first), then oldest first. Pages are 1-based.
SLA (hours to resolve): CRITICAL 4, HIGH 24, MEDIUM 72, LOW 168.
Only tickets still OPEN / IN_PROGRESS can breach an SLA.

Task: run the tests (run.sh) and make all of them pass without editing tests/.
