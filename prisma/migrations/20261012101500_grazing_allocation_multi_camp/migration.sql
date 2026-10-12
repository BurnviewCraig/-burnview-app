-- Allow a group to have more than one camp per date+session (e.g. Everfair
-- sometimes splits a session across two camps). Widen the uniqueness check
-- to include paddockId so multiple rows can share groupId+date+session as
-- long as each points at a different camp.
DROP INDEX "GrazingAllocation_groupId_date_session_key";

CREATE UNIQUE INDEX "GrazingAllocation_groupId_date_session_paddockId_key" ON "GrazingAllocation"("groupId", "date", "session", "paddockId");
