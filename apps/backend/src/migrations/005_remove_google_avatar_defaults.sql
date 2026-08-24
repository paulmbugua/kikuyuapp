UPDATE users
SET avatar_url = NULL,
    avatar_key = NULL,
    updated_at = CURRENT_TIMESTAMP
WHERE avatar_key LIKE 'users/google-avatars/%';
