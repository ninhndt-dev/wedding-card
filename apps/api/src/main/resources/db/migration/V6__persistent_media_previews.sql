CREATE TABLE media_previews (
 filename VARCHAR(80) CHARACTER SET ascii NOT NULL,
 size INT NOT NULL,
 mime VARCHAR(80) NOT NULL,
 content MEDIUMBLOB NOT NULL,
 PRIMARY KEY (filename, size),
 FOREIGN KEY (filename) REFERENCES media_assets(filename) ON DELETE CASCADE,
 CHECK (size IN (480, 960, 1440))
);
