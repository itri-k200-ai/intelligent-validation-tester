"""Base Django settings for the IVT project.

Shared settings for all environments. Environment-specific overrides
live in development.py / production.py / test.py.
"""
from datetime import timedelta
from pathlib import Path

import environ

BASE_DIR = Path(__file__).resolve().parent.parent.parent

env = environ.Env(
    DEBUG=(bool, False),
    USE_MOCK_CONNECTORS=(bool, True),
)
environ.Env.read_env(BASE_DIR / ".env")

SECRET_KEY = env("SECRET_KEY", default="dev-secret-change-me")
DEBUG = env("DEBUG")
ALLOWED_HOSTS = env.list("ALLOWED_HOSTS", default=["localhost", "127.0.0.1"])

INSTALLED_APPS = [
    "daphne",
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    # 3rd party
    "rest_framework",
    "rest_framework_simplejwt",
    "rest_framework_simplejwt.token_blacklist",
    "drf_spectacular",
    "corsheaders",
    "django_filters",
    "channels",
    # Local apps
    "apps.accounts",
    "apps.sites",
    "apps.duts",
    "apps.platforms",
    "apps.applications",
    "apps.scenarios",
    "apps.validations",
    "apps.reports",
    "apps.overview",
    "apps.documents",
    "apps.agent_sessions",
    "apps.selection",
    "apps.field_tests",
]

DOCUMENTS_BUCKET = "documents"

# MinIO 對外的 endpoint —— 給產 presigned URL 用，必須是 client 端
# 解析得到的 hostname（dev：localhost:9000；prod：放在 nginx 後面或
# 真實 DNS）。預設等於內網 endpoint，必要時用 env 覆蓋。
MINIO_PUBLIC_ENDPOINT = env("MINIO_PUBLIC_ENDPOINT", default="localhost:9000")

MIDDLEWARE = [
    "corsheaders.middleware.CorsMiddleware",
    "django.middleware.security.SecurityMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "config.urls"
WSGI_APPLICATION = "config.wsgi.application"
ASGI_APPLICATION = "config.asgi.application"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.debug",
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

DATABASES = {
    "default": env.db_url(
        "DATABASE_URL",
        default="postgres://ivt:ivtpass@localhost:5432/ivt",
    ),
}

AUTH_USER_MODEL = "accounts.User"

AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator"},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

LANGUAGE_CODE = "zh-hant"
TIME_ZONE = "Asia/Taipei"
USE_I18N = True
USE_TZ = True

STATIC_URL = "/static/"
STATIC_ROOT = BASE_DIR / "staticfiles"
MEDIA_URL = "/media/"
MEDIA_ROOT = BASE_DIR / "media"

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

# ------------------------------ DRF ------------------------------
REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": [
        "rest_framework_simplejwt.authentication.JWTAuthentication",
    ],
    "DEFAULT_PERMISSION_CLASSES": ["rest_framework.permissions.IsAuthenticated"],
    "DEFAULT_PAGINATION_CLASS": "core.pagination.StandardPagination",
    "PAGE_SIZE": 20,
    "DEFAULT_FILTER_BACKENDS": [
        "django_filters.rest_framework.DjangoFilterBackend",
        "rest_framework.filters.SearchFilter",
        "rest_framework.filters.OrderingFilter",
    ],
    "EXCEPTION_HANDLER": "core.exceptions.custom_exception_handler",
    "DEFAULT_SCHEMA_CLASS": "drf_spectacular.openapi.AutoSchema",
}

SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(hours=1),
    "REFRESH_TOKEN_LIFETIME": timedelta(days=7),
    "ROTATE_REFRESH_TOKENS": True,
    "BLACKLIST_AFTER_ROTATION": True,
    "USER_ID_FIELD": "id",
    "USER_ID_CLAIM": "user_id",
}

SPECTACULAR_SETTINGS = {
    "TITLE": "IVT API",
    "DESCRIPTION": "Intelligent Validation Tester API",
    "VERSION": "1.0.0",
    "SERVE_INCLUDE_SCHEMA": False,
}

# ------------------------------ CORS ------------------------------
CORS_ALLOWED_ORIGINS = env.list(
    "CORS_ORIGINS",
    default=["http://localhost:3000", "http://localhost"],
)
CORS_ALLOW_CREDENTIALS = True

# --------------------------- Wall selection ---------------------------
# 左 app(別團隊)回報選擇用的服務金鑰;中/右牆「目前選擇」狀態存的 Redis。
WALL_SERVICE_TOKEN = env("WALL_SERVICE_TOKEN", default="dev-wall-token")
WALL_STATE_REDIS_URL = env("REDIS_URL", default="redis://localhost:6379/0")

# ── 場域測試(智慧網路中牆)的外部平台 Performance_tester ──────────────
# 只有後端這台連得到場域網段,金鑰也只留在這裡 —— 前端一律打自己的
# /api/field-tests/*(見 apps/field_tests)。
PERF_TESTER_BASE = env("PERF_TESTER_BASE", default="http://localhost:8011/api")
# 平台目前 API_KEY 為空 = 免帶;設了就會自動帶 X-API-Key
PERF_TESTER_API_KEY = env("PERF_TESTER_API_KEY", default="")
# 實測 /live 1.7~3.9 秒;/robot 偶爾 5 秒但失敗已容錯。設太長會讓不通的那台
# 佔住 worker,連好的情境都排不到 —— 6 秒是量過的折衷。
PERF_TESTER_TIMEOUT = env.float("PERF_TESTER_TIMEOUT", default=6.0)
# 上游的階段名稱 → 前端的 before / after(對不到會按出現順序分配)
# 實測平台回的是「優化前 / 優化後」(pipeline plan 的 phase step);舊用詞一併留著
PERF_TESTER_PHASE_MAP = env.json(
    "PERF_TESTER_PHASE_MAP",
    default={"優化前": "before", "優化後": "after", "部署前": "before", "部署後": "after"},
)
# 共通性測試平台要牆面顯示某幾次歷史驗測時,IM adapter 會轉發
# POST /api/field-tests/history/ 過來。設了這個就要求對方帶 X-Notify-Token
# (內網服務對打,預設空 = 不驗)。
FIELD_TEST_NOTIFY_TOKEN = env("FIELD_TEST_NOTIFY_TOKEN", default="")
# IM adapter(共通性測試平台打進來的那一端)。平台通知「顯示某筆歷史」時 adapter
# 只是把它標成 notified,不會轉發,所以牆面輪詢時順便去問它的 /autoTest/history。
# 留空 = 不問(例如對方改成直接轉發給我們之後就可以關掉)。
FIELD_TEST_ADAPTER_BASE = env("FIELD_TEST_ADAPTER_BASE", default="")
# 情境 → 控制器(cid 來自 GET /api/ctrl-conns、ref 如 amr-01)與要跑的方案
FIELD_TEST_TARGETS = env.json(
    "FIELD_TEST_TARGETS",
    default={
        "outdoor": {"cid": "", "ref": "", "plan_id": ""},
        "indoor": {"cid": "", "ref": "", "plan_id": ""},
    },
)

# ------------------------------ Channels ------------------------------
CHANNEL_REDIS_URL = env("CHANNEL_REDIS_URL", default="redis://localhost:6379/3")
CHANNEL_LAYERS = {
    "default": {
        "BACKEND": "channels_redis.core.RedisChannelLayer",
        "CONFIG": {"hosts": [CHANNEL_REDIS_URL]},
    },
}

# ------------------------------ Celery ------------------------------
CELERY_BROKER_URL = env("CELERY_BROKER_URL", default="redis://localhost:6379/1")
CELERY_RESULT_BACKEND = env("CELERY_RESULT_BACKEND", default="redis://localhost:6379/2")
CELERY_TASK_SERIALIZER = "json"
CELERY_ACCEPT_CONTENT = ["json"]
CELERY_RESULT_SERIALIZER = "json"
CELERY_TIMEZONE = TIME_ZONE
CELERY_BEAT_SCHEDULE = {
    "dut-healthcheck": {
        "task": "apps.duts.tasks.healthcheck_all",
        "schedule": env.int("DUT_HEALTHCHECK_INTERVAL_SEC", default=60),
    },
}

# ------------------------------ Connectors ------------------------------
USE_MOCK_CONNECTORS = env("USE_MOCK_CONNECTORS")
O1_USERNAME = env("O1_USERNAME", default="")
O1_PASSWORD = env("O1_PASSWORD", default="")

# ------------------------------ MinIO ------------------------------
MINIO_ENDPOINT = env("MINIO_ENDPOINT", default="localhost:9000")
MINIO_ACCESS_KEY = env("MINIO_ACCESS_KEY", default="minioadmin")
MINIO_SECRET_KEY = env("MINIO_SECRET_KEY", default="minioadmin")
MINIO_BUCKET = env("MINIO_BUCKET", default="reports")

MEDIA_SERVER_API = env("MEDIA_SERVER_API", default="http://localhost:9997")
