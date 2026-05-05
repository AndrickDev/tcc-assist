class DatabaseError(Exception):
    """Base exception for database errors."""


class DatabaseUnavailable(DatabaseError):
    """Raised when Postgres cannot serve a database operation."""
