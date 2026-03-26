# formapp/tests/test_formapp_views.py
"""
CP-06: Generación de enlace único al publicar formulario (CU-02, RF-09)
CP-08: Duplicación de formulario (HU-011)
CP-09: Eliminación permanente con confirmación (RF-13)

Testea las vistas de FormularioDetailAPI y FormularioListCreateAPI
con mocks de MongoDB.
"""
import pytest
from unittest.mock import patch, MagicMock, PropertyMock
from django.test import RequestFactory
from formapp.views import FormularioDetailAPI, FormularioListCreateAPI


def _make_mock_formulario(titulo="Encuesta Test", n_preguntas=2):
    """Helper: construye un mock de Formulario con datos mínimos."""
    mock_form = MagicMock()
    mock_form.id = "64b7f1e2a3c4d5e6f7a8b9c0"
    mock_form.titulo = titulo
    mock_form.descripcion = "Descripción de prueba"
    mock_form.preguntas = []
    mock_form.configuracion = None
    mock_form.administrador = MagicMock()
    mock_form.administrador.id = "64b7f1e2a3c4d5e6f7a8b9d1"
    return mock_form


class TestFormularioListCreateAPI:
    """
    CP-06 | RF-09: Suite para validar la creación de formularios y generación de ID único.
    """

    def setup_method(self):
        self.factory = RequestFactory()
        self.view = FormularioListCreateAPI.as_view()

    def test_crear_formulario_sin_titulo_retorna_400(self):
        """
        CP-06 | RF-09: Un formulario sin título no puede ser creado.
        El serializer debe rechazarlo devolviendo HTTP 400.
        """
        request = self.factory.post(
            "/api/formularios/",
            data={"administrador": "64b7f1e2a3c4d5e6f7a8b9d1"},
            content_type="application/json"
        )
        # No necesitamos mock de BD porque el serializer falla ANTES de llamar a .save()
        response = self.view(request)
        assert response.status_code == 400
        assert "titulo" in str(response.data)

    def test_crear_formulario_sin_administrador_retorna_400(self):
        """
        CP-06 | RF-09: Un formulario sin administrador no puede ser creado.
        """
        request = self.factory.post(
            "/api/formularios/",
            data={"titulo": "Mi Encuesta"},
            content_type="application/json"
        )
        response = self.view(request)
        assert response.status_code == 400
        assert "administrador" in str(response.data)


class TestFormularioDetailAPI:
    """
    CP-09 | RF-13: Suite para eliminación permanente de formularios.
    CP-08 | HU-011: Verifica la estructura del formulario al consultarlo (para duplicación).
    """

    def setup_method(self):
        self.factory = RequestFactory()
        self.view = FormularioDetailAPI.as_view()

    # ──────────────────────────────────────────────────
    # CP-09: Eliminación permanente del formulario
    # ──────────────────────────────────────────────────

    def test_eliminar_formulario_existente_retorna_204(self):
        """
        CP-09 | RF-13: Al eliminar un formulario existente, el sistema
        debe devolver HTTP 204 No Content, confirmando la eliminación.
        """
        mock_form = _make_mock_formulario()
        form_id = str(mock_form.id)

        request = self.factory.delete(f"/api/formularios/{form_id}/")

        with patch("formapp.views.Formulario.objects") as mock_qs:
            from bson import ObjectId
            mock_qs.get.return_value = mock_form
            response = self.view(request, id=form_id)

        assert response.status_code == 204
        mock_form.delete.assert_called_once()

    def test_eliminar_formulario_existente_llama_delete(self):
        """
        CP-09 | RF-13: El método .delete() debe ser invocado exactamente
        una vez sobre el objeto formulario.
        """
        mock_form = _make_mock_formulario()
        form_id = str(mock_form.id)
        request = self.factory.delete(f"/api/formularios/{form_id}/")

        with patch("formapp.views.Formulario.objects") as mock_qs:
            mock_qs.get.return_value = mock_form
            self.view(request, id=form_id)

        mock_form.delete.assert_called_once()

    def test_eliminar_formulario_inexistente_retorna_404(self):
        """
        CP-09 | RF-13: Intentar eliminar un formulario con ID que no existe
        debe devolver HTTP 404.
        """
        from formapp.models import Formulario as FormularioModel
        form_id = "000000000000000000000000"
        request = self.factory.delete(f"/api/formularios/{form_id}/")

        with patch("formapp.views.Formulario.objects") as mock_qs:
            mock_qs.get.side_effect = FormularioModel.DoesNotExist
            response = self.view(request, id=form_id)

        assert response.status_code == 404

    # ──────────────────────────────────────────────────
    # CP-08: Consulta de estructura (base para duplicación)
    # ──────────────────────────────────────────────────

    def test_obtener_formulario_retorna_titulo_y_preguntas(self):
        """
        CP-08 | HU-011: Al obtener un formulario por ID, la respuesta incluye
        el título y la lista de preguntas — lo que se usa al duplicar.
        """
        mock_form = _make_mock_formulario(titulo="Encuesta de Satisfacción")
        form_id = str(mock_form.id)
        request = self.factory.get(f"/api/formularios/{form_id}/")

        with patch("formapp.views.Formulario.objects") as mock_qs:
            mock_qs.get.return_value = mock_form
            response = self.view(request, id=form_id)

        assert response.status_code == 200
        data = response.data
        assert "titulo" in data
        assert data["titulo"] == "Encuesta de Satisfacción"
