DO
$$
BEGIN
	IF NOT EXISTS (
		SELECT 1
		FROM pg_catalog.pg_roles
		WHERE rolname = 'service_role'
	) THEN
		CREATE ROLE service_role;
	END IF;
END
$$;
