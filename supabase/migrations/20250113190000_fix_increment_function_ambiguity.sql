-- Fix ambiguous column reference in increment_user_query_count function
-- The column reference "queries_used_this_month" was ambiguous between PL/pgSQL variable and table column

CREATE OR REPLACE FUNCTION increment_user_query_count(user_id_param UUID)
RETURNS TABLE(id UUID, queries_used_this_month INTEGER) AS $$
BEGIN
    RETURN QUERY
    UPDATE users
    SET queries_used_this_month = users.queries_used_this_month + 1
    WHERE users.id = user_id_param
    RETURNING users.id, users.queries_used_this_month;
END;
$$ language 'plpgsql' SECURITY DEFINER;



