import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from backend.services.embed_parser import parse_embeds


def test_parse_python_basic():
    source = """
embed = discord.Embed(title="Hello World", description="Some text", color=0x5865F2)
embed.add_field(name="Field 1", value="Value 1", inline=True)
embed.set_footer(text="Footer text")
embed.set_image(url="https://example.com/img.png")
embed.set_thumbnail(url="https://example.com/thumb.png")
embed.set_author(name="Bot Name")
"""
    result = parse_embeds(source, "python")
    assert len(result) == 1
    e = result[0]
    assert e["title"] == "Hello World"
    assert e["description"] == "Some text"
    assert e["color"] == 0x5865F2
    assert e["footer"] == "Footer text"
    assert e["image"] == "https://example.com/img.png"
    assert e["thumbnail"] == "https://example.com/thumb.png"
    assert e["author"] == "Bot Name"
    assert len(e["fields"]) == 1
    assert e["fields"][0] == {"name": "Field 1", "value": "Value 1", "inline": True}


def test_parse_python_no_embeds():
    source = "def hello():\n    pass\n"
    result = parse_embeds(source, "python")
    assert result == []


def test_parse_python_skips_variables():
    source = """
embed = discord.Embed(title=some_variable, description="Static text")
"""
    result = parse_embeds(source, "python")
    assert len(result) == 1
    assert result[0]["title"] is None
    assert result[0]["description"] == "Static text"


def test_parse_java_basic():
    source = """
EmbedBuilder builder = new EmbedBuilder()
    .setTitle("Java Embed")
    .setDescription("Java description")
    .setColor(0xFF5733)
    .addField("Name", "Value", true)
    .setFooter("Java footer")
    .setImage("https://example.com/image.png")
    .setThumbnail("https://example.com/thumb.png")
    .setAuthor("Author Name");
"""
    result = parse_embeds(source, "java")
    assert len(result) == 1
    e = result[0]
    assert e["title"] == "Java Embed"
    assert e["description"] == "Java description"
    assert e["color"] == 0xFF5733
    assert e["footer"] == "Java footer"
    assert e["image"] == "https://example.com/image.png"
    assert e["thumbnail"] == "https://example.com/thumb.png"
    assert e["author"] == "Author Name"
    assert e["fields"] == [{"name": "Name", "value": "Value", "inline": True}]


def test_parse_java_named_color():
    source = 'new EmbedBuilder().setTitle("test").setColor(Color.RED);'
    result = parse_embeds(source, "java")
    assert result[0]["color"] == 0xFF0000


def test_parse_nodejs_basic():
    source = """
const embed = new EmbedBuilder()
    .setTitle('Node Embed')
    .setDescription('Node description')
    .setColor(0x00FF00)
    .addFields({ name: 'Field', value: 'Val', inline: false })
    .setFooter({ text: 'Node footer' })
    .setImage('https://example.com/img.png')
    .setThumbnail('https://example.com/thumb.png')
    .setAuthor({ name: 'NodeBot' });
"""
    result = parse_embeds(source, "nodejs")
    assert len(result) == 1
    e = result[0]
    assert e["title"] == "Node Embed"
    assert e["description"] == "Node description"
    assert e["color"] == 0x00FF00
    assert e["footer"] == "Node footer"
    assert e["fields"] == [{"name": "Field", "value": "Val", "inline": False}]
    assert e["author"] == "NodeBot"


def test_parse_unknown_language():
    result = parse_embeds("some code", "cobol")
    assert result == []


def test_parse_multiple_python_embeds():
    source = """
embed1 = discord.Embed(title="First")
embed2 = discord.Embed(title="Second")
"""
    result = parse_embeds(source, "python")
    assert len(result) == 2
    assert result[0]["title"] == "First"
    assert result[1]["title"] == "Second"


def test_parse_python_field_isolation():
    source = """
embed1 = discord.Embed(title="First")
embed1.add_field(name="F1", value="V1", inline=True)
embed2 = discord.Embed(title="Second")
embed2.add_field(name="F2", value="V2", inline=False)
"""
    result = parse_embeds(source, "python")
    assert len(result) == 2
    assert result[0]["fields"] == [{"name": "F1", "value": "V1", "inline": True}]
    assert result[1]["fields"] == [{"name": "F2", "value": "V2", "inline": False}]
