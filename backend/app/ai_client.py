import logging
import anthropic
from app.config import get_settings

logger = logging.getLogger(__name__)

_settings = get_settings()
_client = anthropic.AsyncAnthropic(api_key=_settings.anthropic_api_key) if _settings.anthropic_api_key else None

MODEL = "claude-haiku-4-5-20251001"
MAX_TOKENS = 1024


def is_configured() -> bool:
    return _client is not None


async def generate_text(prompt: str) -> str | None:
    """プロンプトを送信してテキストを生成する。未設定またはエラー時は None を返す。"""
    if not _client:
        return None
    try:
        message = await _client.messages.create(
            model=MODEL,
            max_tokens=MAX_TOKENS,
            messages=[{"role": "user", "content": prompt}],
        )
        return message.content[0].text.strip()
    except Exception as e:
        logger.error("Claude API error: %s", e)
        return None
