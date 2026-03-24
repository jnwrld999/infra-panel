import discord
from discord import app_commands
from discord.ext import commands
from backend.db.session import SessionLocal
from backend.db.models import DiscordUser, Server
from backend.config import get_settings


def get_user_role(discord_id: str) -> str | None:
    settings = get_settings()
    if discord_id == settings.owner_discord_id:
        return "owner"
    db = SessionLocal()
    try:
        user = db.query(DiscordUser).filter(
            DiscordUser.discord_id == discord_id,
            DiscordUser.active == True,
            DiscordUser.verified == True,
        ).first()
        return user.role if user else None
    finally:
        db.close()


class StatusCog(commands.Cog):
    def __init__(self, bot: commands.Bot):
        self.bot = bot

    @app_commands.command(name="status", description="Show status of all servers")
    async def status(self, interaction: discord.Interaction):
        role = get_user_role(str(interaction.user.id))
        if not role:
            await interaction.response.send_message("❌ You are not authorized.", ephemeral=True)
            return

        db = SessionLocal()
        try:
            servers = db.query(Server).all()
            embed = discord.Embed(title="Server Status", color=discord.Color.blue())
            if not servers:
                embed.description = "No servers configured."
            for srv in servers:
                last_checked = srv.last_checked.isoformat() if srv.last_checked else "Never"
                embed.add_field(
                    name=srv.name,
                    value=f"Host: {srv.host}\nStatus: {srv.status}\nLast checked: {last_checked}",
                    inline=False,
                )
            await interaction.response.send_message(embed=embed)
        finally:
            db.close()

    @app_commands.command(name="ping", description="Check bot latency")
    async def ping(self, interaction: discord.Interaction):
        role = get_user_role(str(interaction.user.id))
        if not role:
            await interaction.response.send_message("❌ You are not authorized.", ephemeral=True)
            return
        latency_ms = round(self.bot.latency * 1000)
        await interaction.response.send_message(f"Pong! Latency: {latency_ms}ms")
