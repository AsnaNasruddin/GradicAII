from datetime import datetime, timezone
from typing import Optional


def to_naive_utc(dt: datetime) -> datetime:
    """Normalize any datetime to naive UTC for storage in the DB's naive DateTime columns.

    Timezone-aware input (e.g. a browser-sent ISO string ending in "Z") is converted to UTC
    and stripped of tzinfo. Naive input is assumed to already be UTC (true once every caller
    sends real UTC timestamps) and passed through unchanged.
    """
    if dt.tzinfo is not None:
        return dt.astimezone(timezone.utc).replace(tzinfo=None)
    return dt


def parse_utc_datetime(value: str) -> datetime:
    """Parse an ISO datetime string that may end in 'Z' (Python's stdlib fromisoformat
    only understands '+00:00' before 3.11) and normalize the result to naive UTC."""
    return to_naive_utc(datetime.fromisoformat(value.replace("Z", "+00:00")))


def iso_utc(dt: Optional[datetime]) -> Optional[str]:
    """Serialize a naive-UTC datetime back to an ISO string with an explicit 'Z' marker,
    so the frontend's `new Date(...)` parses it as UTC instead of the viewer's local time."""
    if dt is None:
        return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.isoformat().replace("+00:00", "Z")
