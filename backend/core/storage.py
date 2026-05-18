"""薄薄一層 MinIO helper。

對外只暴露三件事：upload bytes、產生 presigned download URL、刪掉
object。Bucket 不存在會自動建。所有設定走 Django settings。

目的是讓 documents app 不必直接碰 minio SDK；同時保留切到 S3 / GCS
時只改這個檔案的可能性。
"""

import hashlib
from datetime import timedelta
from io import BytesIO

from django.conf import settings
from minio import Minio


def _client(public: bool = False) -> Minio:
    """internal client (public=False) 給 server-server put/list；
    public client 給產 presigned URL —— URL 會 embed endpoint，所以
    必須是 client 端能解析的 hostname（dev 通常 localhost:9000）。

    塞死 region="us-east-1" 跳過 MinIO 的 get_bucket_location lookup：
    public client 從 container 內打 localhost:9000 是打不到的，硬塞
    region 就不會去 query。"""
    endpoint = settings.MINIO_PUBLIC_ENDPOINT if public else settings.MINIO_ENDPOINT
    return Minio(
        endpoint,
        access_key=settings.MINIO_ACCESS_KEY,
        secret_key=settings.MINIO_SECRET_KEY,
        secure=getattr(settings, "MINIO_SECURE", False),
        region="us-east-1",
    )


def _ensure_bucket(bucket: str) -> None:
    c = _client()
    if not c.bucket_exists(bucket):
        c.make_bucket(bucket)


def upload_bytes(
    bucket: str,
    key: str,
    data: bytes,
    content_type: str = "application/octet-stream",
) -> dict:
    """Put bytes → 回傳 {storage_key, size_bytes, sha256, content_type}."""
    _ensure_bucket(bucket)
    size = len(data)
    sha = hashlib.sha256(data).hexdigest()
    _client().put_object(
        bucket_name=bucket,
        object_name=key,
        data=BytesIO(data),
        length=size,
        content_type=content_type,
    )
    return {
        "storage_key": key,
        "size_bytes": size,
        "sha256": sha,
        "content_type": content_type,
    }


def presigned_download_url(bucket: str, key: str, expires_seconds: int = 3600) -> str:
    return _client(public=True).presigned_get_object(
        bucket_name=bucket,
        object_name=key,
        expires=timedelta(seconds=expires_seconds),
    )


def delete_object(bucket: str, key: str) -> None:
    try:
        _client().remove_object(bucket, key)
    except Exception:
        # 刪檔失敗不擋刪 DB row；object 變孤兒由 cron 收。
        pass
