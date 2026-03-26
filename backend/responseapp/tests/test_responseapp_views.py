# responseapp/tests/test_responseapp_views.py
"""
CP-07: Actualización de Gráficos en Tiempo Real (RF-11)
       → Verifica la lógica del endpoint de estadísticas
         (FormularioEstadisticasAPI) que alimenta los gráficos de Recharts.

CP-10: Exportación de Datos a CSV (RF-10)
       → Verifica que el endpoint FormularioExportarAPI genera un CSV
         con las cabeceras correctas y una fila por respuesta.
"""
import pytest
import io
import csv as csv_module
from unittest.mock import patch, MagicMock
from datetime import datetime
from django.test import RequestFactory
from responseapp.views import FormularioEstadisticasAPI, FormularioExportarAPI


def _make_mock_form_con_respuestas(n_respuestas=3):
    """
    Helper: construye un Formulario mockeado con preguntas y respuestas
    de opción múltiple para probar estadísticas y CSV.
    """
    # Pregunta 1: opción múltiple
    mock_pregunta = MagicMock()
    mock_pregunta.id = 1
    mock_pregunta.enunciado = "¿Cómo nos conociste?"
    mock_pregunta.tipo = "opcion_multiple"

    # Respuestas al formulario
    respuestas_objs = []
    opciones = ["Redes sociales", "Recomendación", "Google"]
    for i in range(n_respuestas):
        mock_resp = MagicMock()
        mock_resp.fecha_envio = datetime(2024, 1, i + 1, 10, 0, 0)
        mock_resp.tiempo_completacion = 30 + i * 10
        mock_resp.dispositivo = "Desktop"
        mock_resp.navegador = "Chrome"
        mock_resp.respondedor = MagicMock()
        mock_resp.respondedor.email = f"usuario{i}@empresa.com"
        mock_resp.respondedor.nombre = f"Usuario {i}"

        resp_pregunta = MagicMock()
        resp_pregunta.pregunta_id = 1
        resp_pregunta.tipo = "opcion_multiple"
        resp_pregunta.valor = [opciones[i % len(opciones)]]
        mock_resp.respuestas = [resp_pregunta]
        respuestas_objs.append(mock_resp)

    mock_form = MagicMock()
    mock_form.id = "64b7f1e2a3c4d5e6f7a8b9c0"
    mock_form.titulo = "Encuesta de Satisfacción"
    mock_form.descripcion = "Test"
    mock_form.preguntas = [mock_pregunta]
    mock_form.administrador = MagicMock()

    return mock_form, respuestas_objs


class TestFormularioEstadisticasAPI:
    """
    CP-07 | RF-11: Suite para validar el endpoint de estadísticas que
    alimenta los gráficos de Recharts en el dashboard.
    """

    def setup_method(self):
        self.factory = RequestFactory()
        self.view = FormularioEstadisticasAPI.as_view()

    def test_estadisticas_formulario_con_respuestas_retorna_200(self):
        """
        CP-07 | RF-11: El endpoint /estadisticas/ retorna HTTP 200 con datos
        de respuestas cuando el formulario existe y tiene respuestas.
        """
        mock_form, respuestas = _make_mock_form_con_respuestas(3)
        form_id = str(mock_form.id)

        request = self.factory.get(f"/api/formularios/{form_id}/estadisticas/")

        with patch("responseapp.views.Formulario.objects") as mock_form_qs, \
             patch("responseapp.views.RespuestaFormulario.objects") as mock_resp_qs:
            mock_form_qs.get.return_value = mock_form
            mock_resp_qs.return_value = MagicMock(count=lambda: 3, __iter__=lambda s: iter(respuestas))

            response = self.view(request, id=form_id)

        assert response.status_code == 200

    def test_estadisticas_contiene_total_respuestas(self):
        """
        CP-07 | RF-11: La respuesta de estadísticas incluye el campo
        'total_respuestas' con el número correcto de respuestas recibidas.
        """
        mock_form, respuestas = _make_mock_form_con_respuestas(3)
        form_id = str(mock_form.id)
        request = self.factory.get(f"/api/formularios/{form_id}/estadisticas/")

        with patch("responseapp.views.Formulario.objects") as mock_form_qs, \
             patch("responseapp.views.RespuestaFormulario.objects") as mock_resp_qs:
            mock_form_qs.get.return_value = mock_form
            mock_resp_qs.return_value = MagicMock(
                count=lambda: len(respuestas), __iter__=lambda s: iter(respuestas)
            )
            response = self.view(request, id=form_id)

        assert response.data["total_respuestas"] == 3

    def test_estadisticas_contiene_datos_de_preguntas(self):
        """
        CP-07 | RF-11: La sección 'preguntas' de estadísticas contiene
        los datos agrupados necesarios para renderizar las gráficas (RF-11).
        """
        mock_form, respuestas = _make_mock_form_con_respuestas(3)
        form_id = str(mock_form.id)
        request = self.factory.get(f"/api/formularios/{form_id}/estadisticas/")

        with patch("responseapp.views.Formulario.objects") as mock_form_qs, \
             patch("responseapp.views.RespuestaFormulario.objects") as mock_resp_qs:
            mock_form_qs.get.return_value = mock_form
            mock_resp_qs.return_value = MagicMock(
                count=lambda: len(respuestas), __iter__=lambda s: iter(respuestas)
            )
            response = self.view(request, id=form_id)

        preguntas = response.data.get("preguntas", [])
        assert len(preguntas) >= 1
        # Cada pregunta tiene campo 'datos' con agrupación de opciones
        primera = preguntas[0]
        assert "id" in primera
        assert "enunciado" in primera
        assert "datos" in primera

    def test_estadisticas_formulario_sin_respuestas_retorna_total_cero(self):
        """
        CP-07 | RF-11: Si el formulario no tiene respuestas aún,
        el endpoint retorna total_respuestas=0 sin errores.
        """
        mock_form = MagicMock()
        mock_form.id = "64b7f1e2a3c4d5e6f7a8b9c0"
        mock_form.preguntas = []
        form_id = str(mock_form.id)
        request = self.factory.get(f"/api/formularios/{form_id}/estadisticas/")

        with patch("responseapp.views.Formulario.objects") as mock_form_qs, \
             patch("responseapp.views.RespuestaFormulario.objects") as mock_resp_qs:
            mock_form_qs.get.return_value = mock_form
            mock_resp_qs.return_value = MagicMock(count=lambda: 0, __iter__=lambda s: iter([]))
            response = self.view(request, id=form_id)

        assert response.status_code == 200
        assert response.data["total_respuestas"] == 0

    def test_estadisticas_formulario_inexistente_retorna_404(self):
        """
        CP-07: Si el ID del formulario no existe, el endpoint retorna HTTP 404.
        """
        from mongoengine.errors import DoesNotExist
        form_id = "000000000000000000000000"
        request = self.factory.get(f"/api/formularios/{form_id}/estadisticas/")

        with patch("responseapp.views.Formulario.objects") as mock_form_qs:
            mock_form_qs.get.side_effect = DoesNotExist
            response = self.view(request, id=form_id)

        assert response.status_code == 404


class TestFormularioExportarAPI:
    """
    CP-10 | RF-10: Suite para validar la exportación de respuestas a CSV.
    Verifica estructura del archivo, cabeceras y contenido por fila.
    """

    def setup_method(self):
        self.factory = RequestFactory()
        self.view = FormularioExportarAPI.as_view()

    def test_exportar_csv_retorna_content_type_correcto(self):
        """
        CP-10 | RF-10: La respuesta del endpoint de exportación debe tener
        Content-Type 'text/csv' para que el navegador descargue el archivo.
        """
        mock_form, respuestas = _make_mock_form_con_respuestas(2)
        form_id = str(mock_form.id)
        request = self.factory.get(f"/api/formularios/{form_id}/exportar/")

        with patch("responseapp.views.Formulario.objects") as mock_form_qs, \
             patch("responseapp.views.RespuestaFormulario.objects") as mock_resp_qs:
            mock_form_qs.get.return_value = mock_form
            mock_resp_qs.return_value = iter(respuestas)
            response = self.view(request, id=form_id)

        assert "text/csv" in response["Content-Type"]

    def test_exportar_csv_tiene_header_content_disposition(self):
        """
        CP-10 | RF-10: La respuesta incluye Content-Disposition con
        'attachment' para forzar la descarga del archivo en el navegador.
        """
        mock_form, respuestas = _make_mock_form_con_respuestas(2)
        form_id = str(mock_form.id)
        request = self.factory.get(f"/api/formularios/{form_id}/exportar/")

        with patch("responseapp.views.Formulario.objects") as mock_form_qs, \
             patch("responseapp.views.RespuestaFormulario.objects") as mock_resp_qs:
            mock_form_qs.get.return_value = mock_form
            mock_resp_qs.return_value = iter(respuestas)
            response = self.view(request, id=form_id)

        assert "attachment" in response["Content-Disposition"]

    def test_exportar_csv_cabeceras_estandar(self):
        """
        CP-10 | RF-10: El CSV generado debe contener las cabeceras estándar:
        Fecha, Dispositivo, Navegador, Tiempo (s), Email, Nombre.
        """
        mock_form, respuestas = _make_mock_form_con_respuestas(1)
        form_id = str(mock_form.id)
        request = self.factory.get(f"/api/formularios/{form_id}/exportar/")

        with patch("responseapp.views.Formulario.objects") as mock_form_qs, \
             patch("responseapp.views.RespuestaFormulario.objects") as mock_resp_qs:
            mock_form_qs.get.return_value = mock_form
            mock_resp_qs.return_value = iter(respuestas)
            response = self.view(request, id=form_id)

        # Leer contenido del CSV
        csv_content = b"".join(response.streaming_content) if hasattr(response, "streaming_content") else response.content
        reader = csv_module.reader(io.StringIO(csv_content.decode("utf-8")))
        headers = next(reader)

        assert "Fecha" in headers
        assert "Dispositivo" in headers
        assert "Navegador" in headers
        assert "Tiempo (s)" in headers
        assert "Email" in headers
        assert "Nombre" in headers

    def test_exportar_csv_incluye_enunciado_de_preguntas_en_cabeceras(self):
        """
        CP-10 | RF-10: Las cabeceras del CSV incluyen el enunciado de cada
        pregunta del formulario como columna dinámica.
        """
        mock_form, respuestas = _make_mock_form_con_respuestas(1)
        form_id = str(mock_form.id)
        request = self.factory.get(f"/api/formularios/{form_id}/exportar/")

        with patch("responseapp.views.Formulario.objects") as mock_form_qs, \
             patch("responseapp.views.RespuestaFormulario.objects") as mock_resp_qs:
            mock_form_qs.get.return_value = mock_form
            mock_resp_qs.return_value = iter(respuestas)
            response = self.view(request, id=form_id)

        csv_content = b"".join(response.streaming_content) if hasattr(response, "streaming_content") else response.content
        reader = csv_module.reader(io.StringIO(csv_content.decode("utf-8")))
        headers = next(reader)

        # "¿Cómo nos conociste?" es el enunciado de la pregunta mockeada
        assert "¿Cómo nos conociste?" in headers

    def test_exportar_csv_una_fila_por_respuesta(self):
        """
        CP-10 | RF-10: El CSV exportado debe contener exactamente una fila
        de datos por cada respuesta registrada (sin contar la cabecera).
        """
        n = 3
        mock_form, respuestas = _make_mock_form_con_respuestas(n)
        form_id = str(mock_form.id)
        request = self.factory.get(f"/api/formularios/{form_id}/exportar/")

        with patch("responseapp.views.Formulario.objects") as mock_form_qs, \
             patch("responseapp.views.RespuestaFormulario.objects") as mock_resp_qs:
            mock_form_qs.get.return_value = mock_form
            mock_resp_qs.return_value = iter(respuestas)
            response = self.view(request, id=form_id)

        csv_content = b"".join(response.streaming_content) if hasattr(response, "streaming_content") else response.content
        reader = csv_module.reader(io.StringIO(csv_content.decode("utf-8")))
        rows = list(reader)
        # rows[0] = cabeceras, rows[1..n] = una por cada respuesta
        data_rows = rows[1:]
        assert len(data_rows) == n

    def test_exportar_csv_formulario_inexistente_retorna_404(self):
        """
        CP-10: Si el formulario no existe, el endpoint retorna HTTP 404.
        """
        from mongoengine.errors import DoesNotExist
        form_id = "000000000000000000000000"
        request = self.factory.get(f"/api/formularios/{form_id}/exportar/")

        with patch("responseapp.views.Formulario.objects") as mock_form_qs:
            mock_form_qs.get.side_effect = DoesNotExist
            response = self.view(request, id=form_id)

        assert response.status_code == 404
