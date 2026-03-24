import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import pytest
from unittest.mock import MagicMock, patch, PropertyMock
import paramiko

from backend.services.ssh_service import SSHService
from backend.db.models import Server


def make_server(**kwargs):
    server = Server()
    server.id = kwargs.get("id", 1)
    server.name = kwargs.get("name", "test-server")
    server.host = kwargs.get("host", "192.168.1.1")
    server.port = kwargs.get("port", 22)
    server.ssh_user = kwargs.get("ssh_user", "root")
    server.ssh_key_path = kwargs.get("ssh_key_path", None)
    server.ssh_key_content_encrypted = kwargs.get("ssh_key_content_encrypted", None)
    return server


def test_ssh_service_init():
    server = make_server()
    svc = SSHService(server)
    assert svc.server is server
    assert svc.client is None


@patch("backend.services.ssh_service.paramiko.SSHClient")
def test_connect_success(mock_client_cls):
    mock_client = MagicMock()
    mock_client_cls.return_value = mock_client

    server = make_server(host="10.0.0.1", port=22, ssh_user="admin")
    svc = SSHService(server)
    svc.connect(timeout=5)

    mock_client_cls.assert_called_once()
    mock_client.set_missing_host_key_policy.assert_called_once()
    mock_client.connect.assert_called_once_with(
        hostname="10.0.0.1",
        port=22,
        username="admin",
        timeout=5,
    )
    assert svc.client is mock_client


@patch("backend.services.ssh_service.paramiko.SSHClient")
def test_run_command(mock_client_cls):
    mock_client = MagicMock()
    mock_client_cls.return_value = mock_client

    # Build fake stdout/stderr channel objects
    mock_stdout = MagicMock()
    mock_stdout.read.return_value = b"hello world\n"
    mock_stdout.channel.recv_exit_status.return_value = 0
    mock_stderr = MagicMock()
    mock_stderr.read.return_value = b""
    mock_client.exec_command.return_value = (MagicMock(), mock_stdout, mock_stderr)

    server = make_server()
    svc = SSHService(server)
    svc.client = mock_client  # inject already-connected client

    result = svc.run_command("echo hello world")

    assert result["stdout"] == "hello world\n"
    assert result["stderr"] == ""
    assert result["exit_code"] == 0
    assert result["success"] is True


@patch("backend.services.ssh_service.paramiko.SSHClient")
def test_list_files(mock_client_cls):
    mock_client = MagicMock()
    mock_client_cls.return_value = mock_client

    mock_stdout = MagicMock()
    mock_stdout.read.return_value = b"/srv/bots/bot1.jar\n/srv/bots/bot2.jar\n"
    mock_stdout.channel.recv_exit_status.return_value = 0
    mock_stderr = MagicMock()
    mock_stderr.read.return_value = b""
    mock_client.exec_command.return_value = (MagicMock(), mock_stdout, mock_stderr)

    server = make_server()
    svc = SSHService(server)
    svc.client = mock_client

    files = svc.list_files("/srv/bots", "*.jar")
    assert files == ["bot1.jar", "bot2.jar"]


@patch("backend.services.ssh_service.paramiko.SSHClient")
def test_test_connection_success(mock_client_cls):
    mock_client = MagicMock()
    mock_client_cls.return_value = mock_client

    mock_stdout = MagicMock()
    mock_stdout.read.return_value = b"pong\n"
    mock_stdout.channel.recv_exit_status.return_value = 0
    mock_stderr = MagicMock()
    mock_stderr.read.return_value = b""
    mock_client.exec_command.return_value = (MagicMock(), mock_stdout, mock_stderr)

    server = make_server()
    svc = SSHService(server)

    result = svc.test_connection()

    assert result["success"] is True
    assert result["message"] == "Connection OK"
    assert result["response"] == "pong"


@patch("backend.services.ssh_service.paramiko.SSHClient")
def test_test_connection_auth_failure(mock_client_cls):
    mock_client = MagicMock()
    mock_client_cls.return_value = mock_client
    mock_client.connect.side_effect = paramiko.AuthenticationException("Auth failed")

    server = make_server()
    svc = SSHService(server)

    result = svc.test_connection()

    assert result["success"] is False
    assert result["message"] == "Authentication failed"
