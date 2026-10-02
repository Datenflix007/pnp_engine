CREATE TABLE character_templates (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  avatar_url TEXT,
  class TEXT,
  attributes TEXT
);

CREATE TABLE character_assignments (
  player_id INTEGER,
  template_id INTEGER,
  FOREIGN KEY(player_id) REFERENCES players(id),
  FOREIGN KEY(template_id) REFERENCES character_templates(id)
);

CREATE TABLE roles (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  target TEXT
);