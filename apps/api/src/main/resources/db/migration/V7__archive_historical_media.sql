ALTER TABLE media_assets ADD COLUMN archived TINYINT NOT NULL DEFAULT 0;
ALTER TABLE media_assets ADD CONSTRAINT media_archived_valid CHECK (archived IN (0,1));
