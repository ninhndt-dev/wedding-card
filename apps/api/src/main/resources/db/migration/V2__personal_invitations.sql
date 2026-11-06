CREATE TABLE personal_invitations (
 id BIGINT PRIMARY KEY AUTO_INCREMENT,
 token VARCHAR(48) CHARACTER SET ascii COLLATE ascii_bin NOT NULL UNIQUE,
 name VARCHAR(100) NOT NULL,
 name_key VARCHAR(100) COLLATE utf8mb4_bin NOT NULL UNIQUE,
 phone VARCHAR(30) NOT NULL DEFAULT '',
 side VARCHAR(20) NOT NULL DEFAULT '',
 event VARCHAR(100) NOT NULL DEFAULT '',
 invited_count INT NOT NULL DEFAULT 0,
 note VARCHAR(1000) NOT NULL DEFAULT '',
 source_order INT NOT NULL DEFAULT 0,
 created TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
 updated TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
 CHECK (invited_count BETWEEN 0 AND 50)
) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

ALTER TABLE guests ADD COLUMN invitation_id BIGINT NULL,
 ADD INDEX guests_invitation(invitation_id,id),
 ADD CONSTRAINT guests_invitation_fk FOREIGN KEY (invitation_id) REFERENCES personal_invitations(id) ON DELETE SET NULL;
ALTER TABLE widget_submissions ADD COLUMN invitation_id BIGINT NULL,
 ADD INDEX submissions_invitation(invitation_id,id),
 ADD CONSTRAINT submissions_invitation_fk FOREIGN KEY (invitation_id) REFERENCES personal_invitations(id) ON DELETE SET NULL;
ALTER TABLE visit_events ADD COLUMN invitation_id BIGINT NULL,
 ADD INDEX visits_invitation(invitation_id,id),
 ADD CONSTRAINT visits_invitation_fk FOREIGN KEY (invitation_id) REFERENCES personal_invitations(id) ON DELETE SET NULL;
