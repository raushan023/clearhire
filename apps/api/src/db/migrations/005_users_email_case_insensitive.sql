CREATE UNIQUE INDEX idx_users_email_lower_unique
    ON users (LOWER(email));