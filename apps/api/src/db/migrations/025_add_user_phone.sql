-- Optional account contact number. Existing users retain NULL.
ALTER TABLE users ADD COLUMN phone VARCHAR(64);
