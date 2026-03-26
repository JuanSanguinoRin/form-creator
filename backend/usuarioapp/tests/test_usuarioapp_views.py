# usuarioapp/tests/test_usuarioapp_views.py
"""
CP-01: Login con credenciales válidas (HU-002, RF-03)
CP-02: Login con contraseña incorrecta (RF-04)
CP-03: Registro con email duplicado (RF-01)

Testea la lógica de la vista UsuarioLoginAPI sin base de datos real,
usando mocks de MongoEngine y Django Test Client (RequestFactory).
"""
import pytest
from unittest.mock import patch, MagicMock
from django.test import RequestFactory
from usuarioapp.views import UsuarioLoginAPI


class TestUsuarioLoginAPI:
    """
    CP-01 | CP-02 | RF-03 | RF-04:
    Suite para validar el login tradicional (email + clave_hash).
    """

    def setup_method(self):
        self.factory = RequestFactory()
        self.view = UsuarioLoginAPI.as_view()

    # ──────────────────────────────────────────────────
    # CP-01: Login con credenciales válidas
    # ──────────────────────────────────────────────────

    def test_login_credenciales_validas_retorna_200(self):
        """
        CP-01 | RF-03: Cuando el email y la clave_hash coinciden con un
        usuario existente, el sistema responde HTTP 200 con datos del usuario.
        """
        mock_user = MagicMock()
        mock_user.nombre = "Juan David"
        mock_user.email = "juandavid@empresa.com"
        mock_user.id = "64b7f1e2a3c4d5e6f7a8b9c0"

        request = self.factory.post(
            "/api/usuarios/login/",
            data={"email": "juandavid@empresa.com", "clave_hash": "clave_correcta"},
            content_type="application/json"
        )

        with patch("usuarioapp.views.Usuario.objects") as mock_qs:
            mock_qs.return_value.first.return_value = mock_user
            mock_qs.side_effect = lambda **kw: MagicMock(first=lambda: mock_user)

            response = self.view(request)

        assert response.status_code == 200
        assert "usuario" in response.data or "message" in response.data

    def test_login_retorna_mensaje_exito(self):
        """
        CP-01 | RF-03: La respuesta de login exitoso contiene el mensaje
        'Inicio de sesión exitoso'.
        """
        mock_user = MagicMock()
        mock_user.nombre = "Usuario Test"
        mock_user.email = "test@empresa.com"

        request = self.factory.post(
            "/api/usuarios/login/",
            data={"email": "test@empresa.com", "clave_hash": "hash_valido"},
            content_type="application/json"
        )

        with patch("usuarioapp.views.Usuario.objects") as mock_qs:
            mock_qs.side_effect = lambda **kw: MagicMock(first=lambda: mock_user)
            response = self.view(request)

        assert response.status_code == 200
        assert "Inicio de sesión exitoso" in response.data.get("message", "")

    # ──────────────────────────────────────────────────
    # CP-02: Login con contraseña incorrecta
    # ──────────────────────────────────────────────────

    def test_login_contrasena_incorrecta_retorna_401(self):
        """
        CP-02 | RF-04: Cuando la clave_hash NO coincide con el usuario en BD,
        el sistema responde HTTP 401 Unauthorized.
        """
        request = self.factory.post(
            "/api/usuarios/login/",
            data={"email": "juandavid@empresa.com", "clave_hash": "clave_incorrecta"},
            content_type="application/json"
        )

        with patch("usuarioapp.views.Usuario.objects") as mock_qs:
            # Simula que la query email+clave_hash no encontró ningún usuario
            mock_qs.side_effect = lambda **kw: MagicMock(first=lambda: None)
            response = self.view(request)

        assert response.status_code == 401
        assert "error" in response.data
        assert "Credenciales incorrectas" in str(response.data["error"])

    def test_login_contrasena_incorrecta_no_retorna_datos_usuario(self):
        """
        CP-02 | RF-04: El sistema NO debe filtrar datos del usuario si las
        credenciales son inválidas; la respuesta solo incluye un mensaje de error.
        """
        request = self.factory.post(
            "/api/usuarios/login/",
            data={"email": "juandavid@empresa.com", "clave_hash": "clave_wronggg"},
            content_type="application/json"
        )

        with patch("usuarioapp.views.Usuario.objects") as mock_qs:
            mock_qs.side_effect = lambda **kw: MagicMock(first=lambda: None)
            response = self.view(request)

        assert "usuario" not in response.data
        assert response.status_code == 401

    # ──────────────────────────────────────────────────
    # CP-02 variante: campos faltantes
    # ──────────────────────────────────────────────────

    def test_login_sin_email_retorna_400(self):
        """
        CP-02: Si no se envía el campo 'email', la vista rechaza
        la petición con HTTP 400 antes de consultar la BD.
        """
        request = self.factory.post(
            "/api/usuarios/login/",
            data={"clave_hash": "alguna_clave"},
            content_type="application/json"
        )
        response = self.view(request)
        assert response.status_code == 400
        assert "error" in response.data

    def test_login_sin_clave_retorna_400(self):
        """
        CP-02: Si no se envía la 'clave_hash', la vista rechaza
        la petición con HTTP 400.
        """
        request = self.factory.post(
            "/api/usuarios/login/",
            data={"email": "juandavid@empresa.com"},
            content_type="application/json"
        )
        response = self.view(request)
        assert response.status_code == 400
        assert "error" in response.data
