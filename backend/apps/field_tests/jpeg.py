"""場域攝影機影像的重新壓縮。

平台吐出來的 JPEG 幾乎沒壓(640×360 一張 60~170 KB,實測用品質 70 重壓只剩
約 16 KB,肉眼看不出差別)。室內四支鏡頭每秒 5 張,一個觀看者就要 ~15 Mbps,
走外網 / iframe 的那端頻寬一不夠,MJPEG 就越積越慢、回放圖也要等很久。
所以經過我們這裡的影像一律先重壓再送出去。

壓失敗(上游送來不是完整的 JPEG 等)就原樣送,不要讓畫面因此斷掉。
settings.FIELD_CAMERA_JPEG_QUALITY = 0 可以整個關掉。
"""

from __future__ import annotations

import io
import logging
import re
from collections.abc import Iterator

from django.conf import settings
from PIL import Image

logger = logging.getLogger(__name__)

BOUNDARY = "frame"
MJPEG_CONTENT_TYPE = f"multipart/x-mixed-replace; boundary={BOUNDARY}"

_SOI = b"\xff\xd8"
_EOI = b"\xff\xd9"
_LENGTH = re.compile(rb"content-length:\s*(\d+)", re.IGNORECASE)
# 找不到下一張的開頭時,緩衝最多留這麼多(只會是 part 的表頭,很短)
_MAX_HEAD = 64 * 1024


def quality() -> int:
    return int(getattr(settings, "FIELD_CAMERA_JPEG_QUALITY", 70) or 0)


def recompress(data: bytes) -> bytes:
    """單張 JPEG 重壓;沒變小或壓失敗就回原本那張。"""
    q = quality()
    if not q:
        return data
    try:
        with Image.open(io.BytesIO(data)) as im:
            out = io.BytesIO()
            im.convert("RGB").save(out, "JPEG", quality=q, optimize=False)
    except Exception:  # noqa: BLE001 —— 壞圖就原樣送,不要讓影像斷掉
        return data
    small = out.getvalue()
    return small if len(small) < len(data) else data


def frames(chunks: Iterator[bytes]) -> Iterator[bytes]:
    """把上游的 MJPEG(multipart)拆成一張張 JPEG。

    優先照 part 表頭的 Content-Length 切(平台有帶);沒帶就找 JPEG 的結尾標記。
    """
    buf = bytearray()
    for chunk in chunks:
        buf += chunk
        while True:
            soi = buf.find(_SOI)
            if soi < 0:
                if len(buf) > _MAX_HEAD:
                    del buf[:-1]
                break
            m = _LENGTH.search(buf, 0, soi)
            if m:
                end = soi + int(m.group(1))
            else:
                eoi = buf.find(_EOI, soi + 2)
                end = eoi + 2 if eoi >= 0 else -1
            if end < 0 or len(buf) < end:
                break
            yield bytes(buf[soi:end])
            del buf[:end]


def mjpeg(chunks: Iterator[bytes]) -> Iterator[bytes]:
    """上游 MJPEG → 重壓過的 MJPEG(固定用我們自己的 boundary)。"""
    try:
        for jpg in frames(chunks):
            small = recompress(jpg)
            yield (
                f"--{BOUNDARY}\r\nContent-Type: image/jpeg\r\n"
                f"Content-Length: {len(small)}\r\n\r\n"
            ).encode() + small + b"\r\n"
    finally:
        # 觀看者斷線時 StreamingHttpResponse 會 close 這個產生器 —— 往下關,上游連線才會放掉
        close = getattr(chunks, "close", None)
        if close:
            close()
