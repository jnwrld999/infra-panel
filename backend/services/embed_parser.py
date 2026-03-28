import re
from typing import Optional


def _extract_string_kwarg(text: str, key: str) -> Optional[str]:
    """Extract a literal string value for a keyword argument, e.g. title="foo"."""
    m = re.search(rf'{key}\s*=\s*["\']([^"\'\\]*(?:\\.[^"\'\\]*)*)["\']', text)
    return m.group(1) if m else None


def _extract_string_arg(text: str) -> Optional[str]:
    """Extract the first literal string positional argument."""
    m = re.match(r'\s*["\']([^"\'\\]*(?:\\.[^"\'\\]*)*)["\']', text)
    return m.group(1) if m else None


def _parse_python(source: str) -> list[dict]:
    embeds = []
    for m in re.finditer(r'(\w+)\s*=\s*discord\.Embed\(', source):
        var = m.group(1)
        window = source[m.start():m.start() + 600]

        color = None
        color_m = re.search(r'colou?r\s*=\s*(0x[0-9a-fA-F]+|\d+)', window)
        if color_m:
            try:
                color = int(color_m.group(1), 0)
            except ValueError:
                pass

        fields = []
        for fm in re.finditer(
            rf'{re.escape(var)}\.add_field\(\s*name\s*=\s*["\']([^"\']*)["\'][^)]*'
            rf'value\s*=\s*["\']([^"\']*)["\'][^)]*inline\s*=\s*(True|False)',
            source,
        ):
            fields.append({"name": fm.group(1), "value": fm.group(2), "inline": fm.group(3) == "True"})

        def _method_str(method: str, kwarg: str) -> Optional[str]:
            pat = rf'{re.escape(var)}\.{method}\(\s*{kwarg}\s*=\s*["\']([^"\']*)["\']'
            fm = re.search(pat, source)
            return fm.group(1) if fm else None

        embeds.append({
            "title": _extract_string_kwarg(window, "title"),
            "description": _extract_string_kwarg(window, "description"),
            "color": color,
            "author": _method_str("set_author", "name"),
            "footer": _method_str("set_footer", "text"),
            "image": _method_str("set_image", "url"),
            "thumbnail": _method_str("set_thumbnail", "url"),
            "fields": fields,
        })
    return embeds


_JAVA_COLORS = {
    "Color.RED": 0xFF0000, "Color.BLUE": 0x0000FF, "Color.GREEN": 0x008000,
    "Color.YELLOW": 0xFFFF00, "Color.ORANGE": 0xFF8800, "Color.CYAN": 0x00FFFF,
    "Color.MAGENTA": 0xFF00FF, "Color.WHITE": 0xFFFFFF, "Color.BLACK": 0x000000,
    "Color.GRAY": 0x808080, "Color.GREY": 0x808080, "Color.PINK": 0xFFB6C1,
}


def _parse_java(source: str) -> list[dict]:
    embeds = []
    for m in re.finditer(r'new\s+EmbedBuilder\(\)', source):
        chain = source[m.start():m.start() + 1500]

        color = None
        color_m = re.search(
            r'\.setColor\(\s*(0x[0-9a-fA-F]+|\d+|Color\.\w+|new\s+Color\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\))',
            chain,
        )
        if color_m:
            raw = color_m.group(1)
            if raw.startswith("0x") or raw.isdigit():
                try:
                    color = int(raw, 0)
                except ValueError:
                    pass
            elif raw in _JAVA_COLORS:
                color = _JAVA_COLORS[raw]
            elif raw.startswith("new Color(") and color_m.group(2):
                r2, g2, b2 = int(color_m.group(2)), int(color_m.group(3)), int(color_m.group(4))
                color = (r2 << 16) | (g2 << 8) | b2

        fields = []
        for fm in re.finditer(r'\.addField\(\s*"([^"]*)"\s*,\s*"([^"]*)"\s*,\s*(true|false)', chain):
            fields.append({"name": fm.group(1), "value": fm.group(2), "inline": fm.group(3) == "true"})

        def _chain_str(method: str) -> Optional[str]:
            fm = re.search(rf'\.{method}\(\s*"([^"]*)"', chain)
            return fm.group(1) if fm else None

        embeds.append({
            "title": _chain_str("setTitle"),
            "description": _chain_str("setDescription"),
            "color": color,
            "author": _chain_str("setAuthor"),
            "footer": _chain_str("setFooter"),
            "image": _chain_str("setImage"),
            "thumbnail": _chain_str("setThumbnail"),
            "fields": fields,
        })
    return embeds


def _parse_nodejs(source: str) -> list[dict]:
    embeds = []
    for m in re.finditer(r'new\s+EmbedBuilder\(\)', source):
        chain = source[m.start():m.start() + 1500]

        color = None
        color_m = re.search(r'\.setColor\(\s*(0x[0-9a-fA-F]+|\d+)', chain)
        if color_m:
            try:
                color = int(color_m.group(1), 0)
            except ValueError:
                pass

        fields = []
        for fm in re.finditer(
            r'name\s*:\s*["\']([^"\']*)["\'][^}]*value\s*:\s*["\']([^"\']*)["\'][^}]*inline\s*:\s*(true|false)',
            chain,
        ):
            fields.append({"name": fm.group(1), "value": fm.group(2), "inline": fm.group(3) == "true"})

        def _chain_str(pattern: str) -> Optional[str]:
            fm = re.search(pattern, chain)
            return fm.group(1) if fm else None

        embeds.append({
            "title": _chain_str(r'\.setTitle\(\s*["\']([^"\'"]*)'),
            "description": _chain_str(r'\.setDescription\(\s*["\']([^"\'"]*)'),
            "color": color,
            "author": _chain_str(r'\.setAuthor\(\s*\{\s*name\s*:\s*["\']([^"\'"]*)'),
            "footer": _chain_str(r'\.setFooter\(\s*\{\s*text\s*:\s*["\']([^"\'"]*)'),
            "image": _chain_str(r'\.setImage\(\s*["\']([^"\'"]*)'),
            "thumbnail": _chain_str(r'\.setThumbnail\(\s*["\']([^"\'"]*)'),
            "fields": fields,
        })
    return embeds


def parse_embeds(source: str, language: str) -> list[dict]:
    """Parse embed definitions from source code. Returns list of embed dicts."""
    if language == "python":
        return _parse_python(source)
    elif language == "java":
        return _parse_java(source)
    elif language in ("nodejs", "javascript", "typescript"):
        return _parse_nodejs(source)
    return []
