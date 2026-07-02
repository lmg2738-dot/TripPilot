from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    database_url: str = "sqlite+aiosqlite:///./trippilot.db"

    openrouter_api_key: str = ""
    openrouter_site_url: str = "https://trippilot.ai"
    openrouter_app_name: str = "TripPilot AI"

    public_data_api_key: str = ""
    ex_api_key: str = ""
    kipris_api_key: str = ""
    kosis_api_key: str = ""

    supabase_url: str = ""
    supabase_anon_key: str = ""

    cors_origins: str = "http://localhost:3000"
    free_trip_limit: int = 3

    class Config:
        env_file = ".env"
        extra = "ignore"

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


settings = Settings()
