import discord
from discord import app_commands
from discord.ext import commands
from backend.db.session import SessionLocal
from backend.db.models import AppLog, Approval
from backend.config import get_settings
from backend.discord_bot.cogs.status import get_user_role

OPERATOR_ROLES = {"owner", "admin", "operator"}


class ManagementCog(commands.Cog):
    def __init__(self, bot: commands.Bot):
        self.bot = bot

    @app_commands.command(name="restart", description="Restart a PM2 process on a server")
    async def restart(self, interaction: discord.Interaction, server_id: int, process: str):
        role = get_user_role(str(interaction.user.id))
        if role not in OPERATOR_ROLES:
            await interaction.response.send_message("❌ Insufficient permissions.", ephemeral=True)
            return

        from backend.db.models import Server
        from backend.services.service_manager import ServiceManager

        db = SessionLocal()
        try:
            server = db.query(Server).filter(Server.id == server_id).first()
            if not server:
                await interaction.response.send_message(f"❌ Server {server_id} not found.", ephemeral=True)
                return

            await interaction.response.defer()
            manager = ServiceManager(server)
            result = manager.pm2_action(process, "restart")
            if result.get("success"):
                await interaction.followup.send(f"✅ Process `{process}` restarted on `{server.name}`.")
            else:
                await interaction.followup.send(f"❌ Restart failed: {result.get('message', 'Unknown error')}")
        finally:
            db.close()

    @app_commands.command(name="suggest", description="Submit a suggestion or change request")
    async def suggest(self, interaction: discord.Interaction, type: str, description: str):
        role = get_user_role(str(interaction.user.id))
        if not role:
            await interaction.response.send_message("❌ You are not authorized.", ephemeral=True)
            return

        db = SessionLocal()
        try:
            approval = Approval(
                submitted_by=str(interaction.user.id),
                type=type,
                payload={"description": description},
                status="pending",
            )
            db.add(approval)
            db.commit()
            db.refresh(approval)

            # DM owner about it
            settings = get_settings()
            try:
                owner = await self.bot.fetch_user(int(settings.owner_discord_id))
                await owner.send(
                    f"📬 New suggestion (ID: {approval.id}) from <@{interaction.user.id}>:\n"
                    f"**Type:** {type}\n**Description:** {description}"
                )
            except Exception as e:
                print(f"[Bot] Could not DM owner: {e}")

            await interaction.response.send_message(
                f"✅ Suggestion submitted (ID: {approval.id}). The owner has been notified.",
                ephemeral=True,
            )
        finally:
            db.close()

    @app_commands.command(name="logs", description="View recent application logs")
    async def logs(self, interaction: discord.Interaction, category: str = "error"):
        role = get_user_role(str(interaction.user.id))
        if role not in OPERATOR_ROLES:
            await interaction.response.send_message("❌ Insufficient permissions.", ephemeral=True)
            return

        db = SessionLocal()
        try:
            entries = (
                db.query(AppLog)
                .filter(AppLog.category == category)
                .order_by(AppLog.timestamp.desc())
                .limit(10)
                .all()
            )
            embed = discord.Embed(title=f"Logs — {category}", color=discord.Color.orange())
            if not entries:
                embed.description = "No logs found."
            for entry in entries:
                ts = entry.timestamp.isoformat() if entry.timestamp else "?"
                embed.add_field(
                    name=f"[{entry.level}] {ts}",
                    value=entry.message[:1024],
                    inline=False,
                )
            await interaction.response.send_message(embed=embed)
        finally:
            db.close()
