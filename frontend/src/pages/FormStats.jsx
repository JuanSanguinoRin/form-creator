import React, { useState, useEffect, useRef } from "react";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import { useParams, useNavigate } from "react-router-dom";
import {
    PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
    BarChart, Bar, XAxis, YAxis, CartesianGrid, LineChart, Line
} from "recharts";
import "../css/CreateForm.css";
import "../css/FormStats.css";

const COLORS = ["#0088FE", "#00C49F", "#FFBB28", "#FF8042", "#8884d8", "#82ca9d", "#FF6B6B", "#4ECDC4"];

export default function FormStats() {
    const { formId } = useParams();
    const navigate = useNavigate();
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [isExportingPDF, setIsExportingPDF] = useState(false);
    const printRef = useRef(null);

    // --- Util: detectar navegador y tipo de dispositivo ---
    function getClientInfo() {
        const ua = navigator.userAgent || "";
        const uaLC = ua.toLowerCase();

        // Navegadores (orden importante: Edge antes que Chrome; Opera antes que Chrome)
        let browser = "Unknown";
        if (/edg\//i.test(ua)) browser = "Edge";
        else if (/opr\//i.test(ua) || /opera/i.test(ua)) browser = "Opera";
        else if (/firefox/i.test(ua)) browser = "Firefox";
        else if (/chrome/i.test(ua) && !/edg\//i.test(ua) && !/opr\//i.test(ua)) browser = "Chrome";
        else if (/safari/i.test(ua) && !/chrome/i.test(ua)) browser = "Safari";
        else if (/msie|trident/i.test(ua)) browser = "Internet Explorer";

        // Device
        const isMobile = /android|iphone|ipad|ipod|mobile|iemobile|opera mini/i.test(uaLC);
        const isTablet = /ipad|tablet/i.test(uaLC);
        const device = isTablet ? "Tablet" : (isMobile ? "Mobile" : "Desktop");

        return { browser, device, userAgent: ua };
    }

    // --- Envía una visita al backend (opcional, puedes quitarlo si no quieres registrar la vista aquí) ---
    useEffect(() => {
        const sendVisit = async () => {
            try {
                const info = getClientInfo();
                // Cambia esta URL por la correcta en tu API (o muévelo a la página del formulario)
                await fetch(`https://form-creator-production.up.railway.app/api/formularios/${formId}/visita/`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ browser: info.browser, device: info.device }),
                });
            } catch (err) {
                // No rompas la UI por esto — solo avisa en consola
                console.warn("No se pudo enviar la visita:", err);
            }
        };

        // Si no quieres enviar visitas desde la pantalla de estadísticas,
        // comenta la siguiente línea.
        sendVisit();
    }, [formId]);

    const normalizeName = (name) => {
        if (name === "Unknown") return "Desconocido";
        return name;
    }

    // --- Normalizador: acepta varias formas que pueda devolver tu backend ---
    const normalizeSeries = (arr) => {
        if (!Array.isArray(arr)) return [];
        return arr.map(item => {
            const name = normalizeName(
                item.name || item.browser || item.device || item.label || item.key || item[0] || "Desconocido"
            );
            const value = (item.value ?? item.count ?? item.cantidad ?? item.y ?? item.v ?? 0);
            return { name, value };
        });
    };

    useEffect(() => {
        const fetchStats = async () => {
            try {
                const res = await fetch(`https://form-creator-production.up.railway.app/api/formularios/${formId}/estadisticas/`);
                if (!res.ok) throw new Error("No se pudieron cargar las estadísticas");
                const data = await res.json();
                console.log("📊 Estadísticas recibidas (raw):", data);

                // Normalizar estructuras que usamos en los gráficos
                const dispositivos = normalizeSeries(data.dispositivos || data.devices || data.devices_stats);
                const navegadores = normalizeSeries(data.navegadores || data.browsers || data.browser_stats);

                // Normalizar preguntas/respuestas (si es necesario)
                const preguntas = (data.preguntas || []).map(p => {
                    const datos = Array.isArray(p.datos) ? p.datos.map(d => {
                        const name = d.name || d.label || d.opcion || d.texto || d.key || d[0] || "Valor";
                        const value = (d.value ?? d.count ?? d.cantidad ?? 0);
                        return { ...d, name, value };
                    }) : [];
                    return { ...p, datos };
                });

                const normalized = {
                    ...data,
                    dispositivos,
                    navegadores,
                    preguntas,
                };

                setStats(normalized);
            } catch (err) {
                console.error(err);
                setError(err.message || String(err));
            } finally {
                setLoading(false);
            }
        };

        fetchStats();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [formId]);

    const handleExport = () => {
        window.open(`https://form-creator-production.up.railway.app/api/formularios/${formId}/exportar/`, '_blank');
    };

    const handleExportPDF = async () => {
        const element = printRef.current;
        if (!element) return;

        setIsExportingPDF(true);
        try {
            const canvas = await html2canvas(element, {
                scale: 2,
                useCORS: true,
                logging: false,
                backgroundColor: "#ffffff"
            });
            const imgData = canvas.toDataURL("image/png");

            const pdf = new jsPDF("p", "mm", "a4");
            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfHeight = pdf.internal.pageSize.getHeight();

            const imgHeight = (canvas.height * pdfWidth) / canvas.width;
            let heightLeft = imgHeight;
            let position = 0;

            pdf.addImage(imgData, "PNG", 0, position, pdfWidth, imgHeight);
            heightLeft -= pdfHeight;

            while (heightLeft > 0) {
                position = heightLeft - imgHeight;
                pdf.addPage();
                pdf.addImage(imgData, "PNG", 0, position, pdfWidth, imgHeight);
                heightLeft -= pdfHeight;
            }

            pdf.save(`Estadisticas_Formulario_${formId}.pdf`);
        } catch (error) {
            console.error("Error al generar PDF:", error);
            alert("Hubo un error al generar el PDF. Por favor, intenta de nuevo.");
        } finally {
            setIsExportingPDF(false);
        }
    };

    if (loading) return (
        <div className="create-form-main">
            <div className="stats-loading">Cargando estadísticas...</div>
        </div>
    );

    if (error) return (
        <div className="create-form-main">
            <div className="stats-error">Error: {error}</div>
        </div>
    );

    if (!stats) return null;

    return (
        <main className="create-form-main">
            {/* Botón Volver */}
            <div className="create-back-container">
                <button
                    className="create-btn-back"
                    onClick={() => navigate("/home")}
                >
                    <span className="create-back-arrow">←</span>
                    Volver
                </button>
            </div>

            {/* Sección principal */}
            <section className="create-section-main" ref={printRef}>
                <div className="stats-header">
                    <h2>📊 Estadísticas del Formulario</h2>
                </div>

                {/* Gráficos en grid horizontal */}
                <div className="stats-charts-grid">
                    {/* Dispositivos (Gráfico Circular) */}
                    <div className="stats-chart-card">
                        <h3>📱 Dispositivos</h3>
                        {stats.dispositivos && stats.dispositivos.length > 0 ? (
                            <ResponsiveContainer width="100%" height={250}>
                                <PieChart>
                                    <Pie
                                        data={stats.dispositivos}
                                        cx="50%"
                                        cy="50%"
                                        nameKey="name"
                                        dataKey="value"
                                        labelLine={false}
                                        // label recibe payload y percent dependiendo de la versión de recharts
                                        label={({ payload, percent }) => `${(payload && payload.name) || ""} ${(percent ? (percent * 100).toFixed(0) : 0)}%`}
                                        outerRadius={80}
                                        fill="#8884d8"
                                    >
                                        {stats.dispositivos.map((entry, index) => (
                                            <Cell key={`cell-d-${index}`} fill={COLORS[index % COLORS.length]} />
                                        ))}
                                    </Pie>
                                    <Tooltip />
                                </PieChart>
                            </ResponsiveContainer>
                        ) : (
                            <p className="stats-no-data">Sin datos</p>
                        )}
                    </div>

                    {/* Navegadores (Gráfico Circular) */}
                    <div className="stats-chart-card">
                        <h3>🌐 Navegadores</h3>
                        {stats.navegadores && stats.navegadores.length > 0 ? (
                            <ResponsiveContainer width="100%" height={250}>
                                <PieChart>
                                    <Pie
                                        data={stats.navegadores}
                                        cx="50%"
                                        cy="50%"
                                        nameKey="name"
                                        dataKey="value"
                                        labelLine={false}
                                        label={({ payload, percent }) => `${(payload && payload.name) || ""} ${(percent ? (percent * 100).toFixed(0) : 0)}%`}
                                        outerRadius={80}
                                        fill="#82ca9d"
                                    >
                                        {stats.navegadores.map((entry, index) => (
                                            <Cell key={`cell-n-${index}`} fill={COLORS[index % COLORS.length]} />
                                        ))}
                                    </Pie>
                                    <Tooltip />
                                </PieChart>
                            </ResponsiveContainer>
                        ) : (
                            <p className="stats-no-data">Sin datos de navegadores</p>
                        )}
                    </div>

                    {/* Respuestas por fecha (Gráfico de Línea) */}
                    <div className="stats-chart-card stats-chart-full">
                        <h3>📅 Respuestas por Fecha</h3>
                        {stats.respuestas_por_fecha && stats.respuestas_por_fecha.length > 0 ? (
                            <ResponsiveContainer width="100%" height={250}>
                                <LineChart data={stats.respuestas_por_fecha}>
                                    <CartesianGrid strokeDasharray="3 3" />
                                    <XAxis dataKey="fecha" />
                                    <YAxis allowDecimals={false} />
                                    <Tooltip />
                                    <Line type="monotone" dataKey="cantidad" stroke="#8884d8" strokeWidth={2} name="Respuestas" />
                                </LineChart>
                            </ResponsiveContainer>
                        ) : (
                            <p className="stats-no-data">Sin datos</p>
                        )}
                    </div>
                </div>

                {/* Análisis por pregunta */}
                <div className="stats-questions-section">
                    <h3>📋 Análisis por Pregunta</h3>
                    {stats.preguntas.map((p) => {
                        const isChart = ["opcion_multiple", "checkbox", "escala_numerica"].includes(p.tipo);
                        const chartData = isChart ? [...(p.datos || [])].sort((a, b) => b.value - a.value) : [];

                        const formattedType = p.tipo ? p.tipo.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase()) : p.tipo;

                        return (
                            <div key={p.id} className="create-question-card">
                                <h4>{p.enunciado}</h4>
                                <div className="stats-question-meta">
                                    <span className="stats-badge">Tipo: {formattedType}</span>
                                    <span className="stats-badge">Respuestas: {p.total_respuestas}</span>
                                </div>

                                {p.total_respuestas > 0 ? (
                                    <div className="stats-question-content">
                                        {isChart && (
                                            <ResponsiveContainer width="100%" height={300}>
                                                <BarChart data={chartData} layout="horizontal">
                                                    <CartesianGrid strokeDasharray="3 3" />
                                                    <XAxis dataKey="name" />
                                                    <YAxis allowDecimals={false} />
                                                    <Tooltip />
                                                    <Bar dataKey="value" name="Respuestas">
                                                        {chartData.map((entry, index) => (
                                                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                                        ))}
                                                    </Bar>
                                                </BarChart>
                                            </ResponsiveContainer>
                                        )}

                                        {p.tipo === "texto_libre" && (
                                            <div className="stats-text-responses">
                                                <h5>Últimas 10 respuestas:</h5>
                                                <ul>
                                                    {(p.datos || []).slice(-10).reverse().map((d, idx) => (
                                                        <li key={idx}>{d.texto || d.name || d.value || JSON.stringify(d)}</li>
                                                    ))}
                                                </ul>
                                            </div>
                                        )}
                                    </div>
                                ) : (
                                    <p className="stats-no-data">Sin respuestas aún.</p>
                                )}
                            </div>
                        );
                    })}
                </div>
            </section>

            {/* Panel lateral */}
            <aside className="create-sidebar">
                <h3 className="create-sidebar-title">ℹ️ Información</h3>

                <div className="create-config-group">
                    <button className="create-btn-save" onClick={handleExport} style={{ width: '100%', marginBottom: '10px' }}>
                        📥 Exportar CSV
                    </button>
                    <button 
                        className="create-btn-save" 
                        onClick={handleExportPDF} 
                        disabled={isExportingPDF}
                        style={{ width: '100%', marginBottom: '20px', backgroundColor: isExportingPDF ? '#aaa' : '#D9534F' }}
                    >
                        {isExportingPDF ? "⏳ Generando PDF..." : "📄 Exportar PDF"}
                    </button>

                    <div className="stats-info-item">
                        <strong>Total de respuestas:</strong>
                        <span>{stats.total_respuestas}</span>
                    </div>
                    <div className="stats-info-item">
                        <strong>Tiempo promedio:</strong>
                        <span>{stats.tiempo_promedio ? `${Math.round(stats.tiempo_promedio)}s` : "N/A"}</span>
                    </div>

                    <hr style={{ margin: '15px 0', border: 'none', borderTop: '1px solid #E0E0E0' }} />

                    <h4 style={{ fontSize: '0.95rem', color: '#2D5F5D', marginBottom: '10px' }}>📱 Dispositivos</h4>
                    {stats.dispositivos && stats.dispositivos.length > 0 ? (
                        stats.dispositivos.map((d, idx) => (
                            <div key={idx} className="stats-info-item">
                                <span>{d.name}</span>
                                <span>{d.value}</span>
                            </div>
                        ))
                    ) : (
                        <span style={{ fontSize: '0.85rem', color: '#999' }}>Sin datos</span>
                    )}

                    <hr style={{ margin: '15px 0', border: 'none', borderTop: '1px solid #E0E0E0' }} />

                    <h4 style={{ fontSize: '0.95rem', color: '#2D5F5D', marginBottom: '10px' }}>🌐 Navegadores</h4>
                    {stats.navegadores && stats.navegadores.length > 0 ? (
                        stats.navegadores.map((n, idx) => (
                            <div key={idx} className="stats-info-item">
                                <span>{n.name}</span>
                                <span>{n.value}</span>
                            </div>
                        ))
                    ) : (
                        <span style={{ fontSize: '0.85rem', color: '#999' }}>Sin datos</span>
                    )}
                </div>
            </aside>
        </main>
    );
}
