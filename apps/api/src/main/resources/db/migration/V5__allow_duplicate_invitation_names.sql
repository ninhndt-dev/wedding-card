ALTER TABLE personal_invitations DROP INDEX name_key;
CREATE INDEX invitations_name_key ON personal_invitations(name_key);
