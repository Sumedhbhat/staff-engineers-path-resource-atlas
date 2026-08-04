CREATE TABLE resources (
  resource_order INTEGER PRIMARY KEY,
  chapter TEXT NOT NULL,
  category TEXT NOT NULL,
  title TEXT NOT NULL,
  appearance INTEGER NOT NULL,
  original_url TEXT NOT NULL,
  resolved_url TEXT NOT NULL,
  status INTEGER NOT NULL
);
