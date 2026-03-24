from pydantic_settings import BaseSettings, SettingsConfigDict
from functools import lru_cache


class Settings(BaseSettings):
    discord_bot_token: str = ""
    discord_client_id: str = ""
    discord_client_secret: str = ""
    discord_public_key: str = ""
    owner_discord_id: str = "756848540491448332"
    secret_key: str = "changeme"
    fernet_key: str = ""
    jwt_secret: str = "changeme"
    jwt_access_token_expire_minutes: int = 15
    jwt_refresh_token_expire_days: int = 7
    database_url: str = "sqlite:///./infra-panel.db"
    backend_port: int = 8000
    frontend_url: str = "http://localhost:3000"
    allowed_origins: str = "http://localhost:3000,http://localhost:5173"
    oauth2_redirect_uri: str = "http://localhost:8000/auth/discord/callback"

    @property
    def allowed_origins_list(self) -> list[str]:
        return [o.strip() for o in self.allowed_origins.split(",")]

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")


@lru_cache()
def get_settings() -> Settings:
    return Settings()
