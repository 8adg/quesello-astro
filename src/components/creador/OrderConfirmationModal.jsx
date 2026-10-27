import React, { useState, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import { STAMP_WIDTH_MM, STAMP_HEIGHT_MM } from './constants';
import StampCanvasPreview from './StampCanvasPreview';
import Icon from './Icon';
import { formatPrice } from './useStampProducts';
import { generateDeclaracionJuradaPDF } from '../../lib/declaracionJuradaGenerator';

export default function OrderConfirmationModal({
  isOpen,
  onClose,
  mode,
  price,
  product,
  professionalLines,
  schoolData,
  canvasRef
}) {
  const [step, setStep] = useState('form'); // 'form' | 'processing'
  const [nombre, setNombre] = useState('');
  const [apellido, setApellido] = useState('');
  const [dni, setDni] = useState('');
  const [telefono, setTelefono] = useState('');
  const [email, setEmail] = useState('');
  const [notas, setNotas] = useState('');
  const [aceptaDJ, setAceptaDJ] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const modalCanvasRef = useRef(null);

  if (!isOpen) return null;

  const productName = product?.descripcion || (mode === 'escolar' ? 'Sello Automático escolar' : 'Sello automático');

  const detailsDescription = mode === 'escolar'
    ? `Ícono #${schoolData.iconId} • ${schoolData.lineas.map((l) => l.texto).filter(Boolean).join(' / ')}`
    : professionalLines.map((l) => l.texto).filter(Boolean).join(' | ');

  const handleProcessOrder = async (e) => {
    e.preventDefault();
    setErrorMessage('');

    if (!nombre.trim()) return setErrorMessage('Ingresá tu nombre.');
    if (!apellido.trim()) return setErrorMessage('Ingresá tu apellido.');
    if (!dni.trim()) return setErrorMessage('Ingresá tu DNI o CUIT.');
    if (!telefono.trim()) return setErrorMessage('Ingresá un teléfono de contacto.');
    if (!aceptaDJ) return setErrorMessage('Debés tildar la declaración jurada de responsabilidad para continuar.');
    if (typeof price !== 'number') return setErrorMessage('No se pudo obtener el precio del producto.');

    const fullName = `${nombre.trim()} ${apellido.trim()}`.trim();

    setStep('processing');

    try {
      // 1. Siguiente número correlativo
      const { data: lastOne } = await supabase
        .from('presupuestos')
        .select('numero')
        .not('numero', 'ilike', 'W%')
        .eq('franquicia_id', 1)
        .order('id', { ascending: false })
        .limit(1);

      let nextNum = 1;
      if (lastOne && lastOne[0]?.numero) {
        const parsed = parseInt(lastOne[0].numero.split('-')[0]);
        if (!isNaN(parsed)) nextNum = parsed + 1;
      }
      const finalNro = `${nextNum.toString().padStart(5, '0')}-01`;
      const cleanClientName = fullName.replace(/\s+/g, '_');
      const safeClientFile = cleanClientName.toLowerCase().replace(/[^a-z0-9_-]/g, '');

      const activeTargetCanvas = canvasRef?.current?.exportCleanSVG ? canvasRef : modalCanvasRef;

      // 2. Generar y subir archivo SVG 100% vectorial a Supabase Storage (producción Láser Admin)
      let svgUrl = null;
      try {
        const targetCanvas = activeTargetCanvas.current;
        if (targetCanvas?.exportCleanSVG) {
          const cleanSvgString = await targetCanvas.exportCleanSVG();
          if (cleanSvgString) {
            const fileName = `sellos/${finalNro.toLowerCase()}_${safeClientFile}.svg`;
            const { error: uploadError } = await supabase.storage
              .from('catalogo')
              .upload(fileName, cleanSvgString, {
                contentType: 'image/svg+xml;charset=utf-8',
                upsert: true
              });

            if (!uploadError) {
              const { data: urlData } = supabase.storage.from('catalogo').getPublicUrl(fileName);
              svgUrl = urlData?.publicUrl || null;
            } else {
              console.error('Error subiendo SVG a Storage:', uploadError);
            }
          }
        }
      } catch (svgErr) {
        console.warn('Error subiendo SVG de producción a Supabase:', svgErr);
      }

      // 3. Generar y subir Declaración Jurada en PDF
      let djUrl = null;
      try {
        const djBlob = await generateDeclaracionJuradaPDF({
          orderNumber: finalNro,
          clientName: fullName,
          dni: dni.trim(),
          phone: telefono.trim(),
          email: email.trim(),
          mode,
          productName,
          detailsDescription,
          canvasRef: activeTargetCanvas
        });

        if (djBlob) {
          const djFileName = `declaraciones/${finalNro.toLowerCase()}_${safeClientFile}.pdf`;
          const { error: djUploadError } = await supabase.storage
            .from('catalogo')
            .upload(djFileName, djBlob, {
              contentType: 'application/pdf',
              upsert: true
            });

          if (!djUploadError) {
            const { data: djUrlData } = supabase.storage.from('catalogo').getPublicUrl(djFileName);
            djUrl = djUrlData?.publicUrl || null;
          } else {
            console.error('Error subiendo Declaración Jurada PDF a Storage:', djUploadError);
          }
        }
      } catch (djErr) {
        console.warn('Error generando o subiendo Declaración Jurada PDF:', djErr);
      }

      // 4. Observaciones con teléfono, DNI, notas y enlaces técnicos a SVG y DJ
      const contactParts = [
        `TEL: ${telefono.trim()}`,
        `DNI: ${dni.trim()}`,
        email.trim() ? `EMAIL: ${email.trim()}` : null,
        notas.trim() ? `NOTAS: ${notas.trim()}` : null
      ].filter(Boolean);
      const obsHeader = contactParts.join(' | ').toUpperCase();
      let obsText = obsHeader;
      if (svgUrl) obsText += ` | SVG: ${svgUrl}`;
      if (djUrl) obsText += ` | DJ: ${djUrl}`;

      // 5. Registrar Presupuesto
      const { data: budgetData, error: bError } = await supabase
        .from('presupuestos')
        .insert([{
          numero: finalNro,
          cliente: fullName.toUpperCase(),
          observaciones: obsText,
          total: price,
          estado: 'PENDIENTE',
          pagado: false,
          franquicia_id: 1,
          fecha: new Date().toLocaleDateString('es-AR'),
          token: Math.random().toString(36).substring(2, 10).toUpperCase()
        }])
        .select()
        .single();
      if (bError) throw bError;

      // 6. Ítem de presupuesto
      const { error: itemError } = await supabase.from('presupuesto_items').insert([{
        presupuesto_id: budgetData.id,
        descripcion: `${productName} - ${detailsDescription}`.toUpperCase(),
        cantidad: 1,
        precio_unitario: price,
        total: price
      }]);
      if (itemError) console.warn('Error al guardar items:', itemError);

      // 7. Redirigir a la página de confirmación /gracias
      const destUrl = `/gracias?pedido=${encodeURIComponent(finalNro)}&cliente=${encodeURIComponent(fullName.toUpperCase())}&total=${price}`;
      window.location.assign(destUrl);
    } catch (err) {
      console.error('Error procesando pedido:', err);
      setErrorMessage(err.message || 'Ocurrió un error al registrar el pedido.');
      setStep('form');
    }
  };

  const resetAndClose = () => {
    setStep('form');
    setErrorMessage('');
    onClose();
  };

  return (
    <div className="qc-backdrop" onClick={step === 'processing' ? undefined : resetAndClose}>
      <div className="qc-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="qc-handle" />
        <div className="qc-sheet-head">
          <h3 className="qc-sheet-title">
            {step === 'processing' ? 'Registrando pedido…' : 'Confirmá tu pedido'}
          </h3>
          {step !== 'processing' && (
            <button type="button" className="qc-close" onClick={resetAndClose} aria-label="Cerrar">
              <Icon name="x" size={18} />
            </button>
          )}
        </div>

        {/* Resumen del sello */}
        <div className="qc-order-stamp">
          <div className="st">
            <StampCanvasPreview
              ref={modalCanvasRef}
              mode={mode}
              professionalLines={professionalLines}
              schoolData={schoolData}
              showGuides={false}
            />
          </div>
          <div className="qc-order-line" style={{ width: '100%' }}>
            <div>
              <div className="qc-summary-name">{productName}</div>
              <div className="qc-summary-sub">{STAMP_WIDTH_MM} × {STAMP_HEIGHT_MM} mm</div>
            </div>
            <div className="qc-price">{formatPrice(price)}</div>
          </div>
        </div>

        {step === 'form' && (
          <form className="qc-form" onSubmit={handleProcessOrder}>
            {errorMessage && <div className="qc-error">{errorMessage}</div>}

            <div className="qc-pair" style={{ marginTop: 0 }}>
              <div className="qc-field">
                <label className="qc-label" htmlFor="qc-nombre">Nombre <span className="qc-req">*</span></label>
                <input id="qc-nombre" className="qc-input" type="text" required value={nombre}
                  onChange={(e) => setNombre(e.target.value)} placeholder="Ej: Martín" />
              </div>

              <div className="qc-field">
                <label className="qc-label" htmlFor="qc-apellido">Apellido <span className="qc-req">*</span></label>
                <input id="qc-apellido" className="qc-input" type="text" required value={apellido}
                  onChange={(e) => setApellido(e.target.value)} placeholder="Ej: Rossi" />
              </div>
            </div>

            <div className="qc-pair" style={{ marginTop: 0 }}>
              <div className="qc-field">
                <label className="qc-label" htmlFor="qc-dni">DNI / CUIT <span className="qc-req">*</span></label>
                <input id="qc-dni" className="qc-input" type="text" required value={dni}
                  onChange={(e) => setDni(e.target.value)} placeholder="Ej: 35.123.456" />
              </div>

              <div className="qc-field">
                <label className="qc-label" htmlFor="qc-tel">Teléfono / WhatsApp <span className="qc-req">*</span></label>
                <input id="qc-tel" className="qc-input" type="tel" required value={telefono}
                  onChange={(e) => setTelefono(e.target.value)} placeholder="Ej: 223 520 3360" />
              </div>
            </div>

            <div className="qc-field">
              <label className="qc-label" htmlFor="qc-mail">Email (opcional)</label>
              <input id="qc-mail" className="qc-input" type="email" value={email}
                onChange={(e) => setEmail(e.target.value)} placeholder="tucorreo@ejemplo.com" />
            </div>

            <div className="qc-field">
              <label className="qc-label" htmlFor="qc-notas">Notas (opcional)</label>
              <input id="qc-notas" className="qc-input" type="text" value={notas}
                onChange={(e) => setNotas(e.target.value)} placeholder="Ej: Enviar por Uber moto" />
            </div>

            {/* Checkbox de Declaración Jurada */}
            <div className="qc-field" style={{ marginTop: '4px', marginBottom: '8px' }}>
              <label style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '10px',
                cursor: 'pointer',
                fontSize: '12.5px',
                lineHeight: '1.45',
                color: '#495D56',
                background: 'rgba(237, 232, 211, 0.45)',
                padding: '12px 14px',
                borderRadius: '14px',
                border: '1.5px solid rgba(73, 93, 86, 0.2)'
              }}>
                <input
                  type="checkbox"
                  required
                  checked={aceptaDJ}
                  onChange={(e) => setAceptaDJ(e.target.checked)}
                  style={{ width: '18px', height: '18px', marginTop: '2px', accentColor: '#FF5E5E', cursor: 'pointer', flexShrink: 0 }}
                />
                <span>
                  <strong>Declaración jurada:</strong> Declaro bajo juramento ser titular o responsable legal de los datos, nombres y matrículas suministrados para este sello.
                </span>
              </label>
            </div>

            <button type="submit" className="btn qc-btn-block">
              Continuar al pago
              <Icon name="arrow-right" size={20} color="#FFFFFF" />
            </button>
          </form>
        )}

        {step === 'processing' && (
          <div className="qc-center" style={{ padding: '30px 20px' }}>
            <div className="qc-spinner" />
            <strong style={{ fontSize: '18px', marginTop: '12px' }}>Guardando tu pedido…</strong>
            <span className="qc-sheet-sub" style={{ textAlign: 'center', marginTop: '6px' }}>
              Generando los archivos de producción, declaración jurada y registrando tu orden.
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
