import re
from typing import Optional


def _extract_string_kwarg(text: str, key: str) -> Optional[str]:
    """Extract a literal string value for a keyword argument, e.g. title="foo"."""
    m = re.search(rf'{key}\s*=\s*["\']([^"\'\\]*(?:\\.[^"\'\\]*)*)["\']', text)
    return m.group(1) if m else None


def _parse_python(source: str) -> list[dict]:
    embeds = []
    for m in re.finditer(r'(\w+)\s*=\s*discord\.Embed\(', source):
        var = m.group(1)
        window = source[m.start():m.start() + 1500]

        color = None
        color_m = re.search(r'colou?r\s*=\s*(0x[0-9a-fA-F]+|\d+)', window)
        if color_m:
            try:
                color = int(color_m.group(1), 0)
            except ValueError:
                pass

        # Find where the next embed starts (to bound method searches)
        next_m = re.search(r'\w+\s*=\s*discord\.Embed\(', source[m.end():])
        end_pos = m.end() + next_m.start() if next_m else len(source)
        embed_region = source[m.start():end_pos]

        fields = []
        for fm in re.finditer(
            rf'\.add_field\(\s*name\s*=\s*["\']([^"\']*)["\'][^)]*'
            rf'value\s*=\s*["\']([^"\']*)["\'][^)]*inline\s*=\s*(True|False)',
            embed_region,
        ):
            fields.append({"name": fm.group(1), "value": fm.group(2), "inline": fm.group(3) == "True"})

        def _method_str(method: str, kwarg: str, _region: str = embed_region) -> Optional[str]:
            pat = rf'\.{method}\(\s*{kwarg}\s*=\s*["\']([^"\']*)["\']'
            fm = re.search(pat, _region)
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

        def _chain_str(method: str, _chain: str = chain) -> Optional[str]:
            fm = re.search(rf'\.{method}\(\s*"([^"]*)"', _chain)
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

        def _chain_str(pattern: str, _chain: str = chain) -> Optional[str]:
            fm = re.search(pattern, _chain)
            return fm.group(1) if fm else None

        embeds.append({
            "title": _chain_str(r'\.setTitle\(\s*["\']([^"\']*)'),
            "description": _chain_str(r'\.setDescription\(\s*["\']([^"\']*)'),
            "color": color,
            "author": _chain_str(r'\.setAuthor\(\s*\{\s*name\s*:\s*["\']([^"\']*)'),
            "footer": _chain_str(r'\.setFooter\(\s*\{\s*text\s*:\s*["\']([^"\']*)'),
            "image": _chain_str(r'\.setImage\(\s*["\']([^"\']*)'),
            "thumbnail": _chain_str(r'\.setThumbnail\(\s*["\']([^"\']*)'),
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
