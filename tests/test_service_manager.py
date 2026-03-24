import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import pytest
from unittest.mock import MagicMock, patch
from backend.services.service_manager import ServiceManager
from backend.db.models import Server


@pytest.fixture
def mock_server():
    server = MagicMock(spec=Server)
    server.host = "192.168.1.100"
    server.port = 22
    server.ssh_user = "root"
    server.ssh_key_path = None
    return server


def _make_ssh_mock(MockSSH, stdout="", stderr="", exit_code=0):
    mock_ssh_instance = MagicMock()
    mock_ssh_instance.run_command.return_value = {
        "success": exit_code == 0,
        "stdout": stdout,
        "stderr": stderr,
        "exit_code": exit_code,
    }
    MockSSH.return_value.__enter__ = MagicMock(return_value=mock_ssh_instance)
    MockSSH.return_value.__exit__ = MagicMock(return_value=False)
    return mock_ssh_instance


def test_systemd_restart(mock_server):
    with patch("backend.services.service_manager.SSHService") as MockSSH:
        mock_ssh = _make_ssh_mock(MockSSH)
        mgr = ServiceManager(mock_server)
        result = mgr.systemd_action("nginx", "restart")

    mock_ssh.run_command.assert_called_once_with("systemctl restart nginx")
    assert result["success"] is True


def test_docker_restart(mock_server):
    with patch("backend.services.service_manager.SSHService") as MockSSH:
        mock_ssh = _make_ssh_mock(MockSSH)
        mgr = ServiceManager(mock_server)
        result = mgr.docker_action("my_container", "restart")

    mock_ssh.run_command.assert_called_once_with("docker restart my_container")
    assert result["success"] is True


def test_pm2_restart(mock_server):
    with patch("backend.services.service_manager.SSHService") as MockSSH:
        mock_ssh = _make_ssh_mock(MockSSH)
        mgr = ServiceManager(mock_server)
        result = mgr.pm2_action("axellottentv-bot", "restart")

    mock_ssh.run_command.assert_called_once_with("pm2 restart axellottentv-bot --update-env")
    assert result["success"] is True


def test_injection_blocked(mock_server):
    mgr = ServiceManager(mock_server)
    result = mgr.systemd_action("nginx; rm -rf /", "restart")
    assert result["success"] is False
    assert result["message"] == "Invalid service name"
