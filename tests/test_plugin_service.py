import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import pytest
from unittest.mock import MagicMock, patch
from backend.services.plugin_service import PluginService
from backend.db.models import Server


@pytest.fixture
def mock_server():
    server = MagicMock(spec=Server)
    server.host = "192.168.1.100"
    server.port = 22
    server.ssh_user = "root"
    server.ssh_key_path = None
    return server


def test_list_minecraft_plugins(mock_server):
    files = ["WorldEdit.jar", "Essentials.jar", "ViaVersion.jar.disabled"]

    with patch("backend.services.plugin_service.SSHService") as MockSSH:
        mock_ssh_instance = MagicMock()
        mock_ssh_instance.list_files.return_value = files
        MockSSH.return_value.__enter__ = MagicMock(return_value=mock_ssh_instance)
        MockSSH.return_value.__exit__ = MagicMock(return_value=False)

        svc = PluginService(mock_server)
        plugins = svc.list_minecraft_plugins("/opt/minecraft/plugins")

    assert len(plugins) == 3

    active_plugins = [p for p in plugins if p["status"] == "active"]
    disabled_plugins = [p for p in plugins if p["status"] == "disabled"]

    assert len(active_plugins) == 2
    assert len(disabled_plugins) == 1

    plugin_names = [p["name"] for p in plugins]
    assert "WorldEdit" in plugin_names
    assert "Essentials" in plugin_names
    assert "ViaVersion" in plugin_names

    disabled = disabled_plugins[0]
    assert disabled["name"] == "ViaVersion"
    assert disabled["filename"] == "ViaVersion.jar.disabled"


def test_disable_minecraft_plugin(mock_server):
    with patch("backend.services.plugin_service.SSHService") as MockSSH:
        mock_ssh_instance = MagicMock()
        mock_ssh_instance.run_command.return_value = {"success": True, "stdout": "", "stderr": "", "exit_code": 0}
        MockSSH.return_value.__enter__ = MagicMock(return_value=mock_ssh_instance)
        MockSSH.return_value.__exit__ = MagicMock(return_value=False)

        svc = PluginService(mock_server)
        result = svc.disable_minecraft_plugin("/opt/minecraft/plugins", "WorldEdit.jar")

    mock_ssh_instance.run_command.assert_called_once_with(
        "mv /opt/minecraft/plugins/WorldEdit.jar /opt/minecraft/plugins/WorldEdit.jar.disabled"
    )
    assert result["success"] is True


def test_path_traversal_blocked(mock_server):
    svc = PluginService(mock_server)
    result = svc.delete_plugin("/opt/minecraft/plugins", "../../../etc/passwd.jar")
    assert result["success"] is False
    assert result["message"] == "Invalid filename"
