"""Supabase Storage service for avatar uploads via REST API (no SDK needed)."""

import logging

import httpx

logger = logging.getLogger(__name__)


class SupabaseStorageService:
    """Upload / delete files from a public Supabase Storage bucket."""

    BUCKET = "avatars"

    def __init__(self, supabase_url: str, service_key: str):
        self.base_url = f"{supabase_url.rstrip('/')}/storage/v1"
        self.service_key = service_key
        self._bucket_ensured = False

    def _headers(self) -> dict[str, str]:
        return {
            "Authorization": f"Bearer {self.service_key}",
            "apikey": self.service_key,
        }

    def get_public_url(self, file_path: str) -> str:
        return f"{self.base_url}/object/public/{self.BUCKET}/{file_path}"

    async def _ensure_bucket(self, client: httpx.AsyncClient) -> None:
        """Create the bucket if it doesn't exist (once per process)."""
        if self._bucket_ensured:
            return
        headers = self._headers()
        headers["Content-Type"] = "application/json"
        resp = await client.post(
            f"{self.base_url}/bucket",
            json={"id": self.BUCKET, "name": self.BUCKET, "public": True},
            headers=headers,
        )
        if resp.status_code == 200:
            logger.info("Created Supabase bucket '%s'", self.BUCKET)
        elif resp.status_code == 409:
            # Already exists
            pass
        else:
            logger.warning(
                "Bucket creation returned %s: %s", resp.status_code, resp.text
            )
        self._bucket_ensured = True

    async def upload(
        self, file_path: str, data: bytes, content_type: str = "image/webp"
    ) -> str:
        """Upload (or overwrite) a file. Returns the public URL."""
        url = f"{self.base_url}/object/{self.BUCKET}/{file_path}"
        headers = self._headers()
        headers["Content-Type"] = content_type
        headers["x-upsert"] = "true"

        async with httpx.AsyncClient(timeout=30) as client:
            await self._ensure_bucket(client)
            resp = await client.put(url, content=data, headers=headers)
            if resp.status_code >= 400:
                logger.warning(
                    "Supabase upload failed: %s %s — %s",
                    resp.status_code, resp.reason_phrase, resp.text,
                )
            resp.raise_for_status()

        public_url = self.get_public_url(file_path)
        logger.debug("Uploaded %s → %s", file_path, public_url)
        return public_url

    async def delete(self, file_paths: list[str]) -> None:
        """Delete one or more files from the bucket."""
        url = f"{self.base_url}/object/{self.BUCKET}"
        headers = self._headers()
        headers["Content-Type"] = "application/json"

        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.request(
                "DELETE", url, json={"prefixes": file_paths}, headers=headers
            )
            resp.raise_for_status()

        logger.debug("Deleted from Supabase Storage: %s", file_paths)
