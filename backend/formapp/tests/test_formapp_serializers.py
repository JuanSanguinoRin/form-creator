# formapp/tests/test_serializers.py
"""
CP-04: Creación Dinámica de Campo de Texto (RF-04, RF-07) - PreguntaSerializer
CP-06: Generación de UUID/enlace único - FormularioSerializer estructura
CP-08: Duplicación de Formulario - estructura de preguntas con ConfiguracionFormularioSerializer
"""
import pytest
from formapp.serializers import (
    PreguntaSerializer,
    OpcionSerializer,
    ValidacionesSerializer,
    ConfiguracionFormularioSerializer,
)


class TestPreguntaSerializer:
    """
    CP-04 | RF-07: Suite para validar la creación de campos (preguntas)
    del constructor de formularios.
    """

    def test_pregunta_texto_libre_valida(self):
        """
        CP-04: Un campo tipo 'texto_libre' con validaciones de longitud
        debe ser válido — simula añadir campo "Texto Corto" al constructor.
        """
        data = {
            "id": 1,
            "tipo": "texto_libre",
            "enunciado": "¿Cuál es tu nombre completo?",
            "obligatorio": True,
            "validaciones": {
                "longitud_minima": 3,
                "longitud_maxima": 100
            }
        }
        serializer = PreguntaSerializer(data=data)
        assert serializer.is_valid(), f"Esperado válido, errores: {serializer.errors}"

    def test_pregunta_texto_libre_sin_validaciones_es_invalida(self):
        """
        CP-04: Un campo 'texto_libre' SIN validaciones de longitud debe
        ser rechazado por el serializer.
        """
        data = {
            "id": 1,
            "tipo": "texto_libre",
            "enunciado": "¿Algún comentario?",
        }
        serializer = PreguntaSerializer(data=data)
        assert not serializer.is_valid()
        assert "validaciones" in str(serializer.errors)

    def test_pregunta_opcion_multiple_requiere_opciones(self):
        """
        CP-04: Una pregunta de 'opcion_multiple' sin opciones debe
        ser rechazada, pues no tiene sentido sin alternativas.
        """
        data = {
            "id": 2,
            "tipo": "opcion_multiple",
            "enunciado": "¿Cuál es tu género?",
            "opciones": []   # lista vacía → inválido
        }
        serializer = PreguntaSerializer(data=data)
        assert not serializer.is_valid()
        assert "opciones" in str(serializer.errors)

    def test_pregunta_opcion_multiple_con_opciones_valida(self):
        """
        CP-04: Una pregunta de 'opcion_multiple' CON opciones es válida.
        """
        data = {
            "id": 2,
            "tipo": "opcion_multiple",
            "enunciado": "¿Cuál es tu género?",
            "opciones": [
                {"valor": "M", "texto": "Masculino", "orden": 1},
                {"valor": "F", "texto": "Femenino", "orden": 2},
            ]
        }
        serializer = PreguntaSerializer(data=data)
        assert serializer.is_valid(), f"Errores: {serializer.errors}"

    def test_pregunta_escala_numerica_requiere_rango(self):
        """
        CP-04: Una 'escala_numerica' sin valor_minimo o valor_maximo es inválida.
        """
        data = {
            "id": 3,
            "tipo": "escala_numerica",
            "enunciado": "Del 1 al 10, ¿cómo calificas el servicio?",
            "validaciones": {"valor_minimo": 1}  # falta valor_maximo
        }
        serializer = PreguntaSerializer(data=data)
        assert not serializer.is_valid()
        assert "validaciones" in str(serializer.errors)

    def test_pregunta_escala_numerica_con_rango_valida(self):
        """
        CP-04: Una 'escala_numerica' con ambos extremos es válida.
        """
        data = {
            "id": 3,
            "tipo": "escala_numerica",
            "enunciado": "Del 1 al 10, ¿cómo calificas el servicio?",
            "validaciones": {"valor_minimo": 1, "valor_maximo": 10}
        }
        serializer = PreguntaSerializer(data=data)
        assert serializer.is_valid(), f"Errores: {serializer.errors}"

    def test_tipo_de_pregunta_desconocido_es_invalido(self):
        """
        CP-04: Un tipo de pregunta no reconocido ('tipo_inventado') debe fallar.
        """
        data = {
            "id": 4,
            "tipo": "tipo_inventado",
            "enunciado": "Pregunta rara",
        }
        serializer = PreguntaSerializer(data=data)
        assert not serializer.is_valid()
        assert "tipo" in str(serializer.errors)

    def test_pregunta_sin_enunciado_es_invalida(self):
        """
        CP-04: Una pregunta sin enunciado no puede ser guardada.
        """
        data = {
            "id": 5,
            "tipo": "texto_libre",
            # Falta enunciado
            "validaciones": {"longitud_minima": 1, "longitud_maxima": 100}
        }
        serializer = PreguntaSerializer(data=data)
        assert not serializer.is_valid()
        assert "enunciado" in serializer.errors


class TestConfiguracionFormularioSerializer:
    """
    Suite para ConfiguracionFormularioSerializer.
    Cubre configuraciones de visibilidad y acceso al formulario.
    """

    def test_formulario_privado_sin_usuarios_autorizados_es_invalido(self):
        """
        CP-08: Un formulario privado con login requerido pero sin usuarios
        autorizados no debe poder guardarse.
        """
        data = {
            "requerir_login": True,
            "es_publico": False,
            "usuarios_autorizados": []   # vacío → error
        }
        serializer = ConfiguracionFormularioSerializer(data=data)
        assert not serializer.is_valid()
        assert "usuarios_autorizados" in str(serializer.errors)

    def test_formulario_privado_sin_login_es_invalido(self):
        """
        No tiene sentido configurar un formulario como privado
        si no requiere login.
        """
        data = {
            "requerir_login": False,
            "es_publico": False,
        }
        serializer = ConfiguracionFormularioSerializer(data=data)
        assert not serializer.is_valid()
        assert "es_publico" in str(serializer.errors)

    def test_formulario_publico_valido(self):
        """
        Un formulario público con login requerido es la config más común.
        """
        data = {
            "requerir_login": True,
            "es_publico": True,
        }
        serializer = ConfiguracionFormularioSerializer(data=data)
        assert serializer.is_valid(), f"Errores: {serializer.errors}"

    def test_emails_autorizados_se_normalizan_a_minusculas(self):
        """
        CP-08: Los emails con mayúsculas en la lista de autorizados
        deben ser normalizados a minúsculas y deduplicados.
        """
        data = {
            "requerir_login": True,
            "es_publico": False,
            "usuarios_autorizados": ["Usuario@Empresa.COM", "usuario@empresa.com"]  # duplicado
        }
        serializer = ConfiguracionFormularioSerializer(data=data)
        assert serializer.is_valid(), f"Errores: {serializer.errors}"
        emails = serializer.validated_data["usuarios_autorizados"]
        assert len(emails) == 1, "Se debería deduplicar el email repetido"
        assert emails[0] == "usuario@empresa.com"
