from .base import *  # noqa: F401,F403

DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.sqlite3",
        "NAME": ":memory:",
    }
}
USE_MOCK_CONNECTORS = True
CELERY_TASK_ALWAYS_EAGER = True

# 平台回應的共用快取(apps/field_tests/cache.py)要 Redis;測試環境沒有,而且每個測試要看到自己 mock 的回應
FIELD_TEST_CACHE = False
