import sys
import os
import time
from datetime import timedelta

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import pytest
from backend.core.security import (
    encrypt, decrypt, create_access_token, create_refresh_token, verify_token
)


def test_encrypt_decrypt_roundtrip():
    plaintext = "super_secret_value_123"
    ciphertext = encrypt(plaintext)
    assert ciphertext != plaintext
    result = decrypt(ciphertext)
    assert result == plaintext


def test_encrypt_produces_different_ciphertexts():
    plaintext = "same_value"
    ct1 = encrypt(plaintext)
    ct2 = encrypt(plaintext)
    # Fernet uses random IV so same plaintext produces different ciphertext
    assert ct1 != ct2


def test_create_and_verify_access_token():
    token = create_access_token({"sub": "756848540491448332"})
    payload = verify_token(token)
    assert payload is not None
    assert payload["sub"] == "756848540491448332"
    assert payload["type"] == "access"
    assert "jti" in payload


def test_create_and_verify_refresh_token():
    token = create_refresh_token("756848540491448332")
    payload = verify_token(token)
    assert payload is not None
    assert payload["sub"] == "756848540491448332"
    assert payload["type"] == "refresh"
    assert "jti" in payload


def test_invalid_token_returns_none():
    result = verify_token("this.is.not.a.valid.token")
    assert result is None


def test_tampered_token_returns_none():
    token = create_access_token({"sub": "123"})
    tampered = token[:-5] + "XXXXX"
    result = verify_token(tampered)
    assert result is None


def test_expired_token_returns_none():
    token = create_access_token({"sub": "123"}, expires_delta=timedelta(seconds=-1))
    result = verify_token(token)
    assert result is None
