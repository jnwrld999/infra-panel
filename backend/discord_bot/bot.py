import discord
from discord.ext import commands
from backend.config import get_settings

settings = get_settings()

intents = discord.Intents.default()
intents.message_content = True
intents.dm_messages = True

bot = commands.Bot(command_prefix="!", intents=intents)

@bot.event
async def on_ready():
    print(f"[InfraPanel Bot] Logged in as {bot.user} (ID: {bot.user.id})")
    try:
        synced = await bot.tree.sync()
        print(f"[InfraPanel Bot] Synced {len(synced)} slash commands")
    except Exception as e:
        print(f"[InfraPanel Bot] Sync failed: {e}")

async def load_cogs():
    from backend.discord_bot.cogs import status as status_cog, management, admin
    await bot.add_cog(status_cog.StatusCog(bot))
    await bot.add_cog(management.ManagementCog(bot))
    await bot.add_cog(admin.AdminCog(bot))

async def send_dm(discord_id: str, message: str) -> bool:
    try:
        user = await bot.fetch_user(int(discord_id))
        await user.send(message)
        return True
    except Exception as e:
        print(f"[Bot] DM to {discord_id} failed: {e}")
        return False

def run():
    import asyncio
    async def main():
        await load_cogs()
        await bot.start(settings.discord_bot_token)
    asyncio.run(main())
