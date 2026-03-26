# responseapp/tests/test_serializers.py
"""
CP-05: Validación de Campos Obligatorios al Responder (CU-01, RF-08)
       → Valida que preguntas obligatorias sin respuesta sean rechazadas.
"""
import pytest
from unittest.mock import patch, MagicMock
from responseapp.serializers import RespuestaFormularioSerializer


def _make_mock_formulario(preguntas):
    """
    Helper que construye un mock de Formulario con las preguntas dadas.
    Cada pregunta debe ser un dict con 'id', 'tipo', 'obligatorio' (y opcionalmente 'validaciones').
    """
    mock_preguntas = []
    for p in preguntas:
        mp = MagicMock()
        mp.id = p["id"]
        mp.tipo = p.get("tipo", "texto_libre")
        mp.obligatorio = p.get("obligatorio", False)
        mp.validaciones = None
        if p.get("validaciones"):
            v = MagicMock()
            v.valor_minimo = p["validaciones"].get("valor_minimo")
            v.valor_maximo = p["validaciones"].get("valor_maximo")
            v.longitud_minima = p["validaciones"].get("longitud_minima")
            v.longitud_maxima = p["validaciones"].get("longitud_maxima")
            mp.validaciones = v
        mock_preguntas.append(mp)

    mock_form = MagicMock()
    mock_form.preguntas = mock_preguntas
    mock_form.titulo = "Encuesta de Prueba"
    return mock_form


class TestRespuestaFormularioSerializer:
    """
    CP-05 | CU-01 | RF-08: Pruebas de validación al responder un formulario.
    Usa mocks de MongoDB para aislar completamente la BD.
    """

    def _get_serializer(self, data, mock_form):
        """Helper para obtener un serializer con el formulario mockeado."""
        with patch("responseapp.serializers.Formulario.objects") as mock_qs:
            mock_qs.get.return_value = mock_form
            # Necesitamos que la instancia del serializer valide con el form mockeado
            serializer = RespuestaFormularioSerializer(data=data)
            # Patchear la consulta durante la validación
            with patch("responseapp.serializers.Formulario.objects") as mock_qs2:
                mock_qs2.get.return_value = mock_form
                is_valid = serializer.is_valid()
            return serializer, is_valid

    def test_pregunta_obligatoria_sin_respuesta_es_rechazada(self):
        """
        CP-05 | RF-08: Si una pregunta es obligatoria y no se envía respuesta
        para ella, el serializer debe rechazar el envío del formulario.
        """
        mock_form = _make_mock_formulario([
            {"id": 1, "tipo": "texto_libre", "obligatorio": True},
        ])
        data = {
            "formulario": "64b7f1e2a3c4d5e6f7a8b9c0",  # ID mockeado
            "respuestas": []   # ← Sin responder la pregunta obligatoria
        }
        with patch("responseapp.serializers.Formulario.objects") as mock_qs:
            mock_qs.get.return_value = mock_form
            serializer = RespuestaFormularioSerializer(data=data)
            with patch("responseapp.serializers.Formulario.objects") as mock2:
                mock2.get.return_value = mock_form
                result = serializer.is_valid()

        assert not result, "Debería rechazarse al dejar una pregunta obligatoria sin responder."

    def test_pregunta_obligatoria_con_respuesta_vacia_es_rechazada(self):
        """
        CP-05 | RF-08: Un valor vacío (lista vacía []) en una pregunta
        obligatoria también debe ser rechazado.
        """
        mock_form = _make_mock_formulario([
            {"id": 1, "tipo": "texto_libre", "obligatorio": True},
        ])
        data = {
            "formulario": "64b7f1e2a3c4d5e6f7a8b9c0",
            "respuestas": [
                {"pregunta_id": 1, "tipo": "texto_libre", "valor": []}   # valor vacío
            ]
        }
        with patch("responseapp.serializers.Formulario.objects") as mock_qs:
            mock_qs.get.return_value = mock_form
            serializer = RespuestaFormularioSerializer(data=data)
            with patch("responseapp.serializers.Formulario.objects") as mock2:
                mock2.get.return_value = mock_form
                result = serializer.is_valid()

        assert not result, "Un valor vacío en campo obligatorio debe ser rechazado."

    def test_todas_las_obligatorias_respondidas_es_valido(self):
        """
        CP-05 | RF-08: Cuando todas las preguntas obligatorias tienen
        respuesta, el serializer debe ser válido.
        """
        mock_form = _make_mock_formulario([
            {"id": 1, "tipo": "texto_libre", "obligatorio": True},
            {"id": 2, "tipo": "opcion_multiple", "obligatorio": False},
        ])
        data = {
            "formulario": "64b7f1e2a3c4d5e6f7a8b9c0",
            "respuestas": [
                {"pregunta_id": 1, "tipo": "texto_libre", "valor": ["Mi respuesta completa"]}
                # La pregunta 2 no es obligatoria, no necesita respuesta
            ]
        }
        with patch("responseapp.serializers.Formulario.objects") as mock_qs:
            mock_qs.get.return_value = mock_form
            serializer = RespuestaFormularioSerializer(data=data)
            with patch("responseapp.serializers.Formulario.objects") as mock2:
                mock2.get.return_value = mock_form
                result = serializer.is_valid()

        assert result, f"Debería ser válido cuando se responden las obligatorias. Errores: {serializer.errors}"

    def test_formulario_inexistente_es_rechazado(self):
        """
        CP-06: Si el ID del formulario no existe en la BD, debe rechazarse.
        """
        from mongoengine.errors import DoesNotExist
        data = {
            "formulario": "000000000000000000000000",  # ID inexistente
            "respuestas": []
        }
        with patch("responseapp.serializers.Formulario.objects") as mock_qs:
            mock_qs.get.side_effect = DoesNotExist
            serializer = RespuestaFormularioSerializer(data=data)
            with patch("responseapp.serializers.Formulario.objects") as mock2:
                mock2.get.side_effect = DoesNotExist
                result = serializer.is_valid()

        assert not result, "Un ID de formulario inexistente debería rechazarse."
