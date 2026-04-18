import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import "../css/CreateForm.css";
import AuthModal from "../components/AuthModal";
import AnswerEditModal from "../components/AnswerEditModal";
import SingleResponseAuthModal from "../components/SingleResponseAuthModal";

function AnswerForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [formulario, setFormulario] = useState(null);
  const [respuestas, setRespuestas] = useState({});
  const [errors, setErrors] = useState({}); // 🆕 Estado para errores de validación
  const [mensaje, setMensaje] = useState("");
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [existingResponse, setExistingResponse] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [modalDismissed, setModalDismissed] = useState(false);
  const [showSingleResponseModal, setShowSingleResponseModal] = useState(false);
  const [enviarCopia, setEnviarCopia] = useState(false);

  // ⏱️ Inicio del contador de tiempo
  const [startTime] = useState(Date.now());

  const user = JSON.parse(localStorage.getItem("user") || "null");

  function Modal({ visible, title, message, onClose, actionLabel, onAction }) {
    if (!visible) return null;
    return (
      <div className="modal-overlay">
        <div className="modal-container">
          <h3>{title}</h3>
          <p>{message}</p>
          <div className="modal-actions">
            <button className="modal-btn-close" onClick={onClose}>Cerrar</button>
            {onAction && (
              <button className="modal-btn-action" onClick={onAction}>
                {actionLabel || "Acción"}
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  const precargarRespuestas = (respuestaExistente) => {
    if (!respuestaExistente || !respuestaExistente.respuestas) return;

    const respuestasPrecargadas = {};
    respuestaExistente.respuestas.forEach((r) => {
      respuestasPrecargadas[r.pregunta_id] = {
        tipo: r.tipo,
        valor: r.valor?.length > 1 ? r.valor : r.valor[0],
      };
    });

    setRespuestas(respuestasPrecargadas);
  };


  function getClientInfo() {
    const ua = navigator.userAgent || "";
    const lc = ua.toLowerCase();

    // Detección de navegador (orden importante)
    let browser = "Desconocido";
    if (/edg\//i.test(ua)) browser = "Edge";
    else if (/opr\//i.test(ua) || /opera/i.test(ua)) browser = "Opera";
    else if (/firefox/i.test(ua)) browser = "Firefox";
    else if (/chrome/i.test(ua) && !/edg\//i.test(ua) && !/opr\//i.test(ua)) browser = "Chrome";
    else if (/safari/i.test(ua) && !/chrome/i.test(ua)) browser = "Safari";

    // Detección de dispositivo
    let device = "Desktop";
    if (/mobile|android|iphone|ipod/i.test(lc)) device = "Móvil";
    else if (/tablet|ipad/i.test(lc)) device = "Tablet";

    console.log("🔍 Cliente detectado:", { browser, device });
    return { browser, device };
  }

  useEffect(() => {
    const ip = localStorage.getItem("client_ip") || "";

    fetch(`https://form-creator-production.up.railway.app/api/formularios/${id}/`)
      .then(res => res.json())
      .then(data => {
        setFormulario(data);

        // 🆕 VALIDACIÓN DE ACCESO: Si requiere login y es privado
        if (data.configuracion?.requerir_login && data.configuracion?.es_publico === false) {
          // Si no hay usuario logueado
          if (!user?.email) {
            setModal({
              visible: true,
              title: "Acceso restringido 🔒",
              message: "Este formulario es privado y requiere que inicies sesión para verificar tu acceso.",
              action: () => {
                localStorage.setItem(`pending_form_${id}`, id);
                navigate(`/login?next=/form/${id}/answer`);
              },
              actionLabel: "Iniciar sesión"
            });
            return;
          }

          // Si hay usuario, verificar si está en la lista de autorizados
          const usuariosAutorizados = data.configuracion?.usuarios_autorizados || [];
          const emailUsuario = user.email.toLowerCase();
          const tieneAcceso = usuariosAutorizados.map(e => e.toLowerCase()).includes(emailUsuario);

          if (!tieneAcceso) {
            setModal({
              visible: true,
              title: "Acceso denegado 🚫",
              message: `Este formulario es privado y tu cuenta (${user.email}) no está autorizada para responderlo. Contacta al administrador del formulario.`,
              action: () => navigate("/home"),
              actionLabel: "Volver al inicio"
            });
            return;
          }

          console.log("✅ Acceso autorizado para:", emailUsuario);
        }

        // Verificar si ya respondió
        fetch(`https://form-creator-production.up.railway.app/api/respuestas/?formulario=${id}`)
          .then(res => {
            if (!res.ok) throw new Error(`Error ${res.status}`);
            return res.json();
          })
          .then(data => {
            console.log("📋 Respuestas obtenidas:", data);

            if (!Array.isArray(data) || data.length === 0) {
              console.log("⚠️ No hay respuestas previas en el servidor.");
              return;
            }

            const match = data.find(r => {
              if (!r.respondedor) return false;
              const emailMatch = user?.email && r.respondedor.email === user.email;
              const ipMatch = !user?.email && r.respondedor.ip_address === ip;
              return emailMatch || ipMatch;
            });

            console.log("🔹 Resultado de match:", match);

            if (match) {
              setExistingResponse(match);
              if (!modalDismissed) {
                setShowModal(true);
              }
            }

          })
          .catch(err => console.error("❌ Error al verificar respuestas:", err));

        const hoy = new Date();
        const fechaLimite = data.configuracion?.fecha_limite
          ? new Date(data.configuracion.fecha_limite)
          : null;

        // Formulario cerrado por fecha límite
        if (fechaLimite && fechaLimite < hoy) {
          setModal({
            visible: true,
            title: "Formulario cerrado 🕒",
            message: "Este formulario ya no acepta respuestas porque la fecha límite ha pasado.",
            action: () => navigate("/home"),
          });
          return;
        }

        // Formulario no publicado (privado = true)
        if (data.configuracion?.privado === true) {
          setModal({
            visible: true,
            title: "Formulario no disponible 🚫",
            message: "El creador ha despublicado este formulario. Ya no puedes enviar respuestas.",
            action: () => navigate("/home"),
          });
          return;
        }
      })
      .catch(err => console.error(err));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, navigate]);

  useEffect(() => {
    const pending = localStorage.getItem(`pending_answers_${id}`);
    if (pending) {
      try {
        setRespuestas(JSON.parse(pending));
      } catch (e) { }
    }
  }, [id]);

  useEffect(() => {
    if (!formulario) return;
    const requiereLogin = formulario.configuracion?.requerir_login;
    const user = JSON.parse(localStorage.getItem("user") || "null");
    if (requiereLogin && !user) {
      setShowAuthModal(true);
    }
  }, [formulario]);

  function validateLogin() {
    const requiereLogin = formulario?.configuracion?.requerir_login;
    const user = JSON.parse(localStorage.getItem("user") || "null");
    return !requiereLogin || !!user;
  }

  const handleChange = (pregunta, value) => {
    let newValue = value;
    const { id: pid, tipo, validaciones } = pregunta;

    // 🔒 RESTRICCIÓN: Texto libre (Longitud máxima)
    if (tipo === "texto_libre" && validaciones?.longitud_maxima) {
      if (newValue.length > validaciones.longitud_maxima) {
        return; // Bloquear entrada si excede
      }
    }

    // 🔒 RESTRICCIÓN: Escala numérica
    if (tipo === "escala_numerica") {
      if (newValue === "") {
        // Permitir borrar
      } else {
        // Bloquear si no es número
        if (isNaN(newValue)) return;

        const num = parseFloat(newValue);

        // Auto-corregir máximo
        if (validaciones?.valor_maximo !== undefined && num > validaciones.valor_maximo) {
          newValue = validaciones.valor_maximo;
        }

        // Nota: No corregimos mínimo mientras escribe para no bloquear la entrada (ej: escribir "10" con min "5")
      }
    }

    setRespuestas((prev) => ({
      ...prev,
      [pid]: { tipo, valor: newValue },
    }));

    // 🆕 Limpiar error al modificar
    if (errors[`pregunta_${pid}`]) {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[`pregunta_${pid}`];
        return newErrors;
      });
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formulario) return;

    const user = JSON.parse(localStorage.getItem("user") || "null");
    const ip = localStorage.getItem("client_ip") || "";

    // 🆕 VALIDACIÓN ADICIONAL antes de enviar
    if (formulario.configuracion?.requerir_login && formulario.configuracion?.es_publico === false) {
      if (!user?.email) {
        setShowAuthModal(true);
        return;
      }

      const usuariosAutorizados = formulario.configuracion?.usuarios_autorizados || [];
      const emailUsuario = user.email.toLowerCase();
      const tieneAcceso = usuariosAutorizados.map(e => e.toLowerCase()).includes(emailUsuario);

      if (!tieneAcceso) {
        setMensaje("⚠️ No tienes autorización para responder este formulario");
        return;
      }
    }

    if (formulario.configuracion?.una_respuesta) {
      if (!user) {
        setShowSingleResponseModal(true);
        return;
      }
    }

    if (!validateLogin()) {
      localStorage.setItem(`pending_answers_${id}`, JSON.stringify(respuestas));
      setShowAuthModal(true);
      return;
    }

    // ⏱️ Calcular tiempo transcurrido
    const endTime = Date.now();
    const tiempoTotal = Math.round((endTime - startTime) / 1000); // Segundos

    const client = getClientInfo();

    const payload = {
      formulario: id,
      respondedor: {
        ip_address: ip,
        navegador: client.browser,     // ✅ Debe ser el valor detectado
        dispositivo: client.device,    // ✅ Debe ser el valor detectado
        ...(user?.email ? { email: user.email } : {}),
        ...(user?.nombre ? { nombre: user.nombre } : {}),
        ...(user?.uid ? { google_id: user.uid } : {}),
      },
      tiempo_completacion: tiempoTotal,
      enviar_copia: enviarCopia,
      respuestas: Object.entries(respuestas).map(([pid, { tipo, valor }]) => ({
        pregunta_id: Number(pid),
        tipo,
        valor: Array.isArray(valor) ? valor : [valor],
      })),
    };

    console.log("📤 Payload a enviar:", payload);

    const url = isEditing
      ? `https://form-creator-production.up.railway.app/api/respuestas/${existingResponse.id}/`
      : "https://form-creator-production.up.railway.app/api/respuestas/";
    const method = isEditing ? "PUT" : "POST";

    try {
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (res.ok) {
        setMensaje("✅ ¡Respuesta enviada correctamente!");
        localStorage.removeItem(`pending_answers_${id}`);
        const userData = JSON.parse(localStorage.getItem("user"));
        if (userData?.id) {
          navigate(`/editSuccess?edit=${isEditing}`);
        } else {
          navigate(`/thankyou?edit=${isEditing}`);
        }
      } else if (res.status === 400) {
        // 🆕 Manejo de errores de validación del backend
        const newErrors = {};
        let hasFieldErrors = false;

        // data puede ser { "pregunta_1": ["Error..."], "formulario": ["Error..."] }
        Object.keys(data).forEach((key) => {
          if (key.startsWith("pregunta_")) {
            newErrors[key] = Array.isArray(data[key]) ? data[key][0] : data[key];
            hasFieldErrors = true;
          }
        });

        if (hasFieldErrors) {
          setErrors(newErrors);
          setMensaje("💡 Por favor revisa los campos marcados en rojo para continuar");
        } else {
          setMensaje(`⚠️ Error: ${data.error || JSON.stringify(data)}`);
        }
      } else if (res.status === 401) {
        localStorage.setItem(`pending_answers_${id}`, JSON.stringify(respuestas));
        setShowAuthModal(true);
      } else {
        setMensaje(`⚠️ Error: ${data.error || JSON.stringify(data)}`);
      }
    } catch (err) {
      console.error("❌ Error al enviar respuesta:", err);
      setMensaje("⚠️ Error de conexión con el servidor.");
    }
  };

  const [modal, setModal] = useState({
    visible: false,
    title: "",
    message: "",
    action: null,
  });

  if (!formulario) return <div className="create-section-main">Cargando formulario...</div>;

  if (modal.visible) {
    return (
      <Modal
        visible={modal.visible}
        title={modal.title}
        message={modal.message}
        onClose={() => navigate("/home")}
        onAction={modal.action}
        actionLabel={modal.actionLabel || "Ir"}
      />
    );
  }

  return (
    <main className="create-form-main">
      <div className="create-back-container">
        <button
          className="create-btn-back"
          onClick={() => navigate("/home")}
        >
          <span className="create-back-arrow">←</span>
          Volver
        </button>
      </div>

      <section className="create-section-main">
        <section className="answer-header">
          <h2 className="answer-title">{formulario.titulo}</h2>
          {formulario.descripcion && (
            <p className="answer-description">{formulario.descripcion}</p>
          )}
        </section>

        <h3>Preguntas</h3>
        {formulario.preguntas.map((p, idx) => (
          <div key={p.id} className="create-question-card">
            <label className="create-label">
              {`${idx + 1}. ${p.enunciado}`}
              {p.obligatorio && <span style={{ color: "red" }}> *</span>}
            </label>

            {p.tipo === "texto_libre" && (
              <>
                <input
                  className="create-input"
                  type="text"
                  placeholder="Tu respuesta..."
                  value={respuestas[p.id]?.valor || ""}  // ⬅ precarga
                  onChange={(e) => handleChange(p, e.target.value)}
                />
                {/* Indicadores de longitud mejorados */}
                {(p.validaciones?.longitud_minima || p.validaciones?.longitud_maxima) && (
                  <small style={{ color: "gray", display: "block", marginTop: "4px" }}>
                    {/* Contador actual */}
                    {respuestas[p.id]?.valor?.length || 0} caracteres

                    {/* Rango permitido */}
                    {p.validaciones?.longitud_minima && p.validaciones?.longitud_maxima && (
                      <> (mínimo: {p.validaciones.longitud_minima}, máximo: {p.validaciones.longitud_maxima})</>
                    )}
                    {p.validaciones?.longitud_minima && !p.validaciones?.longitud_maxima && (
                      <> (mínimo: {p.validaciones.longitud_minima})</>
                    )}
                    {!p.validaciones?.longitud_minima && p.validaciones?.longitud_maxima && (
                      <> (máximo: {p.validaciones.longitud_maxima})</>
                    )}

                    {/* Advertencia visual si está debajo del mínimo */}
                    {p.validaciones?.longitud_minima &&
                      respuestas[p.id]?.valor &&
                      respuestas[p.id].valor.length > 0 &&
                      respuestas[p.id].valor.length < p.validaciones.longitud_minima && (
                        <span style={{ color: "#f59e0b", marginLeft: "8px" }}>
                          ⚠️ Faltan {p.validaciones.longitud_minima - respuestas[p.id].valor.length} caracteres más
                        </span>
                      )}
                  </small>
                )}
              </>
            )}

            {p.tipo === "opcion_multiple" && (
              <div className="create-options">
                <h4>Selecciona una opción</h4>
                {p.opciones.map((o) => (
                  <div key={o.valor} className="create-option-row">
                    <input
                      type="radio"
                      name={`pregunta_${p.id}`}
                      className="create-checkbox"
                      value={o.texto}
                      checked={respuestas[p.id]?.valor === o.texto}  // ⬅ precarga
                      onChange={(e) => handleChange(p, e.target.value)}
                    />
                    <label className="create-label">{o.texto}</label>
                  </div>
                ))}

                {/* ✅ Advertencia si es obligatoria y no está respondida */}
                {p.obligatorio && !respuestas[p.id]?.valor && (
                  <small style={{
                    color: "#f59e0b",
                    display: "block",
                    marginTop: "8px"
                  }}>
                    ⚠️ Esta pregunta es obligatoria, por favor selecciona una opción
                  </small>
                )}
              </div>
            )}

            {p.tipo === "checkbox" && (
              <div className="create-options">
                <h4>Selecciona una o más opciones</h4>
                {p.opciones.map((o) => (
                  <div key={o.valor} className="create-option-row">
                    <input
                      type="checkbox"
                      className="create-checkbox"
                      value={o.texto}
                      checked={respuestas[p.id]?.valor?.includes(o.texto) || false} // ⬅ precarga
                      onChange={(e) => {
                        const current = respuestas[p.id]?.valor || [];
                        if (e.target.checked)
                          handleChange(p, [...current, e.target.value]);
                        else
                          handleChange(p, current.filter((v) => v !== e.target.value));
                      }}
                    />
                    <label className="create-label">{o.texto}</label>
                  </div>
                ))}

                {/* ✅ Advertencia si es obligatoria y no hay selección */}
                {p.obligatorio && (!respuestas[p.id]?.valor || respuestas[p.id].valor.length === 0) && (
                  <small style={{
                    color: "#f59e0b",
                    display: "block",
                    marginTop: "8px"
                  }}>
                    ⚠️ Esta pregunta es obligatoria, por favor selecciona al menos una opción
                  </small>
                )}
              </div>
            )}

            {p.tipo === "escala_numerica" && (
              <div className="create-validations">
                <h4>Selecciona un valor numérico</h4>
                <input
                  className="create-input"
                  type="number"
                  min={p.validaciones?.valor_minimo || 0}
                  max={p.validaciones?.valor_maximo || 10}
                  value={respuestas[p.id]?.valor || ""} // ⬅ precarga
                  onChange={(e) => handleChange(p, e.target.value)}
                />
                {p.validaciones && (
                  <small style={{ color: "gray", display: "block", marginTop: "4px" }}>
                    Rango permitido: {p.validaciones.valor_minimo ?? 0} - {p.validaciones.valor_maximo ?? 10}

                    {/* Advertencias en tiempo real si está fuera del rango */}
                    {respuestas[p.id]?.valor !== "" && respuestas[p.id]?.valor !== undefined && (
                      <>
                        {parseFloat(respuestas[p.id].valor) < (p.validaciones.valor_minimo ?? 0) && (
                          <span style={{ color: "#f59e0b", marginLeft: "8px" }}>
                            ⚠️ El valor debe ser al menos {p.validaciones.valor_minimo ?? 0}
                          </span>
                        )}
                        {parseFloat(respuestas[p.id].valor) > (p.validaciones.valor_maximo ?? 10) && (
                          <span style={{ color: "#f59e0b", marginLeft: "8px" }}>
                            ⚠️ El valor no puede superar {p.validaciones.valor_maximo ?? 10}
                          </span>
                        )}
                      </>
                    )}
                  </small>
                )}

                {/* ✅ NUEVA: Advertencia si es obligatoria y está vacía */}
                {p.obligatorio && (respuestas[p.id]?.valor === "" || respuestas[p.id]?.valor === undefined) && (
                  <small style={{
                    color: "#f59e0b",
                    display: "block",
                    marginTop: "8px"
                  }}>
                    ⚠️ Esta pregunta es obligatoria, por favor ingresa un valor
                  </small>
                )}
              </div>
            )}

            {/* 🆕 Mostrar error específico de la pregunta */}
            {errors[`pregunta_${p.id}`] && (
              <div style={{
                backgroundColor: "#fee2e2",
                border: "1px solid #fca5a5",
                borderRadius: "8px",
                padding: "0.75rem",
                marginTop: "0.75rem",
                display: "flex",
                alignItems: "flex-start",
                gap: "0.5rem",
                animation: "slideIn 0.3s ease-out"
              }}>
                <span style={{ fontSize: "1.25rem", flexShrink: 0 }}>⚠️</span>
                <span style={{
                  color: "#991b1b",
                  fontSize: "0.875rem",
                  lineHeight: "1.5"
                }}>{errors[`pregunta_${p.id}`]}</span>
              </div>
            )}
          </div>
        ))}

        <hr className="create-divider" />

        {/* Contenedor para botón y checkbox alineados */}
        <div className="answer-submit-container">
          <button type="submit" className="create-btn-save" onClick={handleSubmit}>
            Enviar respuestas
          </button>

          {user && (
            <label className="answer-copy-checkbox">
              <input
                type="checkbox"
                checked={enviarCopia}
                onChange={(e) => setEnviarCopia(e.target.checked)}
              />
              <span>Guardar copia al correo</span>
            </label>
          )}
        </div>

        {mensaje && (
          <p style={{ marginTop: "1rem", color: mensaje.includes("Error") || mensaje.includes("autorización") ? "red" : "green", fontWeight: "600" }}>
            {mensaje}
          </p>
        )}

        <AnswerEditModal
          visible={showModal}
          onClose={() => {
            setShowModal(false);
            setModalDismissed(true);
          }}
        >
          {existingResponse && (
            <>
              <h2 className="text-xl font-semibold mb-2">Ya has respondido este formulario</h2>

              {formulario?.configuracion?.permitir_edicion ? (
                <>
                  <p className="mb-4">Puedes editar tu respuesta anterior. ¿Deseas hacerlo ahora?</p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        setIsEditing(true);
                        precargarRespuestas(existingResponse);
                        setShowModal(false);
                      }}
                      className="bg-blue-500 text-white px-4 py-2 rounded"
                    >
                      Editar mi respuesta
                    </button>
                    <button
                      onClick={() => {
                        setModalDismissed(true);
                        navigate("/");
                      }}
                      className="bg-gray-400 text-white px-4 py-2 rounded"
                    >
                      Cancelar
                    </button>
                  </div>
                </>
              ) : !formulario?.configuracion?.una_respuesta ? (
                <>
                  <p className="mb-4">
                    Ya has enviado una respuesta, pero este formulario permite varias. ¿Quieres enviar otra?
                  </p>
                  <button
                    onClick={() => setShowModal(false)}
                    className="bg-green-600 text-white px-4 py-2 rounded"
                  >
                    Enviar otra respuesta
                  </button>
                </>
              ) : (
                <>
                  <p className="mb-4">
                    Ya completaste este formulario y no se permiten nuevas respuestas.
                  </p>
                  <button
                    onClick={() => navigate("/")}
                    className="bg-gray-500 text-white px-4 py-2 rounded"
                  >
                    Volver al inicio
                  </button>
                </>
              )}
            </>
          )}
        </AnswerEditModal>
      </section>

      <aside className="create-sidebar">
        <h3 className="create-sidebar-title">🧾 Detalles</h3>
        <div className="create-config-group">
          <label className="create-config-label">
            <strong>Privado:</strong> {formulario.configuracion?.privado ? "Sí" : "No"}
          </label>
          <label className="create-config-label">
            <strong>Requiere login:</strong> {formulario.configuracion?.requerir_login ? "Sí" : "No"}
          </label>
          <label className="create-config-label">
            <strong>Fecha límite:</strong>{" "}
            {formulario.configuracion?.fecha_limite || "Sin límite"}
          </label>
          <label className="create-config-label">
            <strong>Respuestas múltiples:</strong>{" "}
            {formulario.configuracion?.una_respuesta ? "No" : "Sí"}
          </label>
        </div>
      </aside>

      {showAuthModal && (
        <AuthModal
          onClose={() => setShowAuthModal(false)}
          onLogin={() => {
            localStorage.setItem(`pending_answers_${id}`, JSON.stringify(respuestas));
            navigate(`/login?next=/form/${id}/answer`);
          }}
          onRegister={() => {
            localStorage.setItem(`pending_answers_${id}`, JSON.stringify(respuestas));
            navigate(`/register?next=/form/${id}/answer`);
          }}
          allowGuest={!formulario.configuracion?.requerir_login && !formulario.configuracion?.privado}
        />
      )}

      {showSingleResponseModal && (
        <SingleResponseAuthModal
          onLogin={() => {
            localStorage.setItem(`pending_answers_${id}`, JSON.stringify(respuestas));
            navigate(`/login?next=/form/${id}/answer`);
          }}
        />
      )}


    </main>
  );
}

export default AnswerForm;