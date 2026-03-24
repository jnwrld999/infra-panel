import functools
import discord
from discord import app_commands
from discord.ext import commands
from backend.db.session import SessionLocal
from backend.db.models import Approval, DiscordUser, AuditLog
from backend.config import get_settings
from backend.discord_bot.cogs.status import get_user_role
from datetime import datetime, timezone

VALID_ROLES = {"viewer", "operator", "admin"}


def require_owner_discord(func):
    @functools.wraps(func)
    async def wrapper(self, interaction: discord.Interaction, *args, **kwargs):
        role = get_user_role(str(interaction.user.id))
        if role != "owner":
            await interaction.response.send_message("❌ Nur für Owner.", ephemeral=True)
            return
        return await func(self, interaction, *args, **kwargs)
    return wrapper


class AdminCog(commands.Cog):
    def __init__(self, bot: commands.Bot):
        self.bot = bot

    @app_commands.command(name="approve", description="Approve a pending suggestion")
    @require_owner_discord
    async def approve(self, interaction: discord.Interaction, approval_id: int):
        db = SessionLocal()
        try:
            approval = db.query(Approval).filter(Approval.id == approval_id).first()
            if not approval:
                await interaction.response.send_message(f"❌ Approval {approval_id} not found.", ephemeral=True)
                return

            approval.status = "approved"
            approval.reviewed_by = str(interaction.user.id)
            approval.reviewed_at = datetime.now(timezone.utc)
            db.commit()

            # DM the submitter
            try:
                submitter = await self.bot.fetch_user(int(approval.submitted_by))
                await submitter.send(f"✅ Your suggestion (ID: {approval_id}) has been **approved**!")
            except Exception as e:
                print(f"[Bot] Could not DM submitter: {e}")

            await interaction.response.send_message(f"✅ Approval {approval_id} approved.", ephemeral=True)
        finally:
            db.close()

    @app_commands.command(name="deny", description="Deny a pending suggestion")
    @require_owner_discord
    async def deny(self, interaction: discord.Interaction, approval_id: int, reason: str = ""):
        db = SessionLocal()
        try:
            approval = db.query(Approval).filter(Approval.id == approval_id).first()
            if not approval:
                await interaction.response.send_message(f"❌ Approval {approval_id} not found.", ephemeral=True)
                return

            approval.status = "denied"
            approval.reviewed_by = str(interaction.user.id)
            approval.reviewed_at = datetime.now(timezone.utc)
            if reason:
                approval.notes = reason
            db.commit()

            # DM the submitter
            try:
                submitter = await self.bot.fetch_user(int(approval.submitted_by))
                msg = f"❌ Your suggestion (ID: {approval_id}) has been **denied**."
                if reason:
                    msg += f"\nReason: {reason}"
                await submitter.send(msg)
            except Exception as e:
                print(f"[Bot] Could not DM submitter: {e}")

            await interaction.response.send_message(f"✅ Approval {approval_id} denied.", ephemeral=True)
        finally:
            db.close()

    @app_commands.command(name="adduser", description="Add a Discord user to InfraPanel")
    @require_owner_discord
    async def adduser(self, interaction: discord.Interaction, discord_id: str, role: str = "viewer"):
        if role not in VALID_ROLES:
            await interaction.response.send_message(
                f"❌ Invalid role. Must be one of: {', '.join(VALID_ROLES)}", ephemeral=True
            )
            return

        db = SessionLocal()
        try:
            existing = db.query(DiscordUser).filter(DiscordUser.discord_id == discord_id).first()
            if existing:
                await interaction.response.send_message(
                    f"❌ User {discord_id} already exists.", ephemeral=True
                )
                return

            new_user = DiscordUser(
                discord_id=discord_id,
                username=discord_id,
                role=role,
                verified=True,
                active=True,
                added_by=str(interaction.user.id),
            )
            db.add(new_user)

            audit = AuditLog(
                actor_discord_id=str(interaction.user.id),
                action="adduser",
                target=discord_id,
                details=f"Role: {role}",
            )
            db.add(audit)
            db.commit()

            # DM new user welcome message
            try:
                new_discord_user = await self.bot.fetch_user(int(discord_id))
                await new_discord_user.send(
                    f"👋 Welcome to InfraPanel! You have been added with the role **{role}**."
                )
            except Exception as e:
                print(f"[Bot] Could not DM new user {discord_id}: {e}")

            await interaction.response.send_message(
                f"✅ User {discord_id} added with role **{role}**.", ephemeral=True
            )
        finally:
            db.close()
