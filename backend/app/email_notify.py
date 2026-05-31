import smtplib
import logging
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from app.config import get_settings

logger = logging.getLogger(__name__)


def send_review_notification(book_title: str, subject: str, instructor_name: str, layers: list[dict]) -> None:
    settings = get_settings()
    if not settings.smtp_user or not settings.smtp_password:
        return

    layer_lines = "\n".join(
        f"  ・レイヤー{lr['layer']}: {'★' * lr['rating']}{'☆' * (5 - lr['rating'])} ({lr['rating']}/5)"
        for lr in sorted(layers, key=lambda x: x["layer"])
    )

    body = f"""\
新しいレビューが投稿されました。

【参考書】{book_title}（{subject}）
【講師】{instructor_name}
【評価】
{layer_lines}
"""

    msg = MIMEMultipart()
    msg["From"] = settings.smtp_user
    msg["To"] = settings.notification_email
    msg["Subject"] = f"【レビュー通知】{book_title}"
    msg.attach(MIMEText(body, "plain", "utf-8"))

    try:
        with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=10) as smtp:
            smtp.starttls()
            smtp.login(settings.smtp_user, settings.smtp_password)
            smtp.sendmail(settings.smtp_user, settings.notification_email, msg.as_string())
    except Exception as e:
        logger.warning("メール送信失敗: %s", e)
