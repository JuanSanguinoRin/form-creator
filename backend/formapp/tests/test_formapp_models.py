# formapp/tests/test_models.py
"""
Pruebas unitarias para los modelos embebidos de formapp.
Se prueba la lógica de negocio interna de los modelos SIN
necesidad de conectarse a MongoDB (sin instanciar Document completo).
"""
import pytest
from formapp.models import ConfiguracionFormulario


class TestConfiguracionFormulario:
    """
    CP-05 | CU-01 | RF-08: Pruebas para la lógica de acceso al formulario.
    Verifica el método tiene_acceso() que controla si un usuario puede responder.
    """

    def test_formulario_sin_login_permite_siempre_acceso(self):
        """
        Si requerir_login=False, CUALQUIER persona puede responder,
        independientemente de si es pública o privada.
        """
        config = ConfiguracionFormulario(
            requerir_login=False,
            es_publico=False  # privado, pero sin login
        )
        assert config.tiene_acceso("cualquiera@ejemplo.com") is True
        assert config.tiene_acceso(None) is True

    def test_formulario_publico_con_login_permite_cualquier_usuario(self):
        """
        Si requerir_login=True y es_publico=True, cualquier usuario
        autenticado puede responder.
        """
        config = ConfiguracionFormulario(
            requerir_login=True,
            es_publico=True
        )
        assert config.tiene_acceso("usuario@empresa.com") is True

    def test_formulario_privado_permite_usuario_autorizado(self):
        """
        CP-05: Un usuario cuyo email está en la lista de autorizados
        puede responder el formulario privado.
        """
        config = ConfiguracionFormulario(
            requerir_login=True,
            es_publico=False,
            usuarios_autorizados=["juandavid@empresa.com", "nicolas@empresa.com"]
        )
        assert config.tiene_acceso("juandavid@empresa.com") is True

    def test_formulario_privado_bloquea_usuario_no_autorizado(self):
        """
        CP-05: Un usuario que NO está en la lista de autorizados debe
        ser bloqueado al intentar responder un formulario privado.
        """
        config = ConfiguracionFormulario(
            requerir_login=True,
            es_publico=False,
            usuarios_autorizados=["juandavid@empresa.com"]
        )
        assert config.tiene_acceso("intruso@otrodominio.com") is False

    def test_formulario_privado_con_lista_vacia_bloquea_a_todos(self):
        """
        CP-05: Un formulario privado con lista de autorizados vacía
        no debe permitir acceso a nadie.
        """
        config = ConfiguracionFormulario(
            requerir_login=True,
            es_publico=False,
            usuarios_autorizados=[]
        )
        assert config.tiene_acceso("alguien@ejemplo.com") is False

    def test_verificacion_acceso_es_case_insensitive(self):
        """
        CP-05: La validación de email en usuarios_autorizados debe ser
        insensible a mayúsculas/minúsculas.
        """
        config = ConfiguracionFormulario(
            requerir_login=True,
            es_publico=False,
            usuarios_autorizados=["Usuario@Empresa.COM"]
        )
        assert config.tiene_acceso("usuario@empresa.com") is True
        assert config.tiene_acceso("USUARIO@EMPRESA.COM") is True
