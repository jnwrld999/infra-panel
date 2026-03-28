from datetime import datetime, timezone
from typing import Optional
from sqlalchemy import (
    Column, Integer, String, Boolean, DateTime, Text, JSON,
    ForeignKey, Index
)
from sqlalchemy.orm import relationship
from backend.db.base import Base


def utcnow():
    return datetime.now(timezone.utc)


class Server(Base):
    __tablename__ = "servers"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    host = Column(String(255), nullable=False)
    port = Column(Integer, default=22)
    ssh_user = Column(String(128), default="root")
    ssh_key_path = Column(String(512), nullable=True)
    ssh_key_content_encrypted = Column(Text, nullable=True)
    description = Column(Text, nullable=True)
    tags = Column(JSON, default=list)
    status = Column(String(64), default="unknown")
    status_message = Column(Text, nullable=True)
    last_checked = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), default=utcnow)

    bots = relationship("Bot", back_populates="server")
    plugins = relationship("Plugin", back_populates="server")
    app_logs = relationship("AppLog", back_populates="server")


class DiscordUser(Base):
    __tablename__ = "discord_users"

    id = Column(Integer, primary_key=True, index=True)
    discord_id = Column(String(64), unique=True, nullable=False, index=True)
    username = Column(String(255), nullable=False)
    role = Column(String(64), default="viewer")
    verified = Column(Boolean, default=False)
    active = Column(Boolean, default=True)
    added_by = Column(String(64), nullable=True)
    added_at = Column(DateTime(timezone=True), default=utcnow)
    last_action = Column(DateTime(timezone=True), nullable=True)
    language = Column(String(16), default="en")
    avatar = Column(String(64), nullable=True)


class Bot(Base):
    __tablename__ = "bots"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    server_id = Column(Integer, ForeignKey("servers.id"), nullable=True)
    token_encrypted = Column(Text, nullable=True)
    type = Column(String(64), default="discord")
    status = Column(String(64), default="stopped")
    description = Column(Text, nullable=True)
    owner_discord_id = Column(String, nullable=True)  # Discord ID des Bot-Owners
    created_at = Column(DateTime(timezone=True), default=utcnow)

    server = relationship("Server", back_populates="bots")
    whitelist = relationship("BotWhitelist", back_populates="bot")
    plugins = relationship("Plugin", back_populates="bot")


class BotWhitelist(Base):
    __tablename__ = "bot_whitelists"

    id = Column(Integer, primary_key=True, index=True)
    bot_id = Column(Integer, ForeignKey("bots.id"), nullable=False)
    discord_user_id = Column(String(64), nullable=False)
    added_by = Column(String(64), nullable=True)
    added_at = Column(DateTime(timezone=True), default=utcnow)

    bot = relationship("Bot", back_populates="whitelist")


class Plugin(Base):
    __tablename__ = "plugins"

    id = Column(Integer, primary_key=True, index=True)
    bot_id = Column(Integer, ForeignKey("bots.id"), nullable=True)
    server_id = Column(Integer, ForeignKey("servers.id"), nullable=True)
    name = Column(String(255), nullable=False)
    filename = Column(String(512), nullable=True)
    type = Column(String(64), default="jar")
    status = Column(String(64), default="active")
    last_modified = Column(DateTime(timezone=True), nullable=True)

    bot = relationship("Bot", back_populates="plugins")
    server = relationship("Server", back_populates="plugins")



class TokenBlocklist(Base):
    __tablename__ = "token_blocklist"

    id = Column(Integer, primary_key=True, index=True)
    jti = Column(String(128), unique=True, nullable=False, index=True)
    expires_at = Column(DateTime(timezone=True), nullable=False)
    blocked_at = Column(DateTime(timezone=True), default=utcnow)
    reason = Column(String(255), nullable=True)


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, index=True)
    timestamp = Column(DateTime(timezone=True), default=utcnow, index=True)
    actor_discord_id = Column(String(64), nullable=True)
    action = Column(String(255), nullable=False)
    target = Column(String(255), nullable=True)
    details = Column(Text, nullable=True)
    ip_address = Column(String(64), nullable=True)


class Approval(Base):
    __tablename__ = "approvals"

    id = Column(Integer, primary_key=True, index=True)
    submitted_by = Column(String(64), nullable=False)
    type = Column(String(128), nullable=False)
    payload = Column(JSON, default=dict)
    status = Column(String(64), default="pending")
    reviewed_by = Column(String(64), nullable=True)
    reviewed_at = Column(DateTime(timezone=True), nullable=True)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), default=utcnow)


class AppLog(Base):
    __tablename__ = "app_logs"

    id = Column(Integer, primary_key=True, index=True)
    timestamp = Column(DateTime(timezone=True), default=utcnow, index=True)
    level = Column(String(16), default="INFO")
    category = Column(String(128), nullable=True)
    server_id = Column(Integer, ForeignKey("servers.id"), nullable=True)
    discord_user_id = Column(String(64), nullable=True)
    message = Column(Text, nullable=False)
    details = Column(JSON, default=dict)

    server = relationship("Server", back_populates="app_logs")
