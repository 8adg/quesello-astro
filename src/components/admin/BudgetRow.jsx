import React, { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { getOrderSvgUrl, getOrderDjUrl, downloadSvgDirect, downloadPdfDirect } from './svgOrderUtils';

function extractPhoneFromObs(observaciones) {
  if (!observaciones || typeof observaciones !== 'string') return null;
  const match = observaciones.match(/TEL:\s*([+\d\s()-]{6,20})/i);
  if (!match) return null;
  const raw = match[1].trim();
  const digits = raw.replace(/\D/g, '');
  if (digits.length < 6) return null;
  const waDigits = digits.startsWith('54') ? digits : `549${digits.replace(/^0+/, '')}`;
  return { raw, waDigits };
}

export default function BudgetRow({
  id_db,
  numero,
  cliente,
  retiro,
  total,
  pagado,
  estado,
  observaciones,
  onEdit,
  onRefresh,
  onPrint,
  onDelete,
}) {
  const [updating, setUpdating] = useState(false);

  const svgUrl = getOrderSvgUrl(observaciones, numero, cliente);
  const djUrl = getOrderDjUrl(observaciones, numero, cliente);
  const phoneInfo = extractPhoneFromObs(observaciones);

  const togglePago = async () => {
    setUpdating(true);
    await supabase.from('presupuestos').update({ pagado: !pagado }).eq('id', id_db);
    onRefresh();
    setUpdating(false);
  };

  const updateEstado = async (nuevoEstado) => {
    setUpdating(true);
    await supabase.from('presupuestos').update({ estado: nuevoEstado }).eq('id', id_db);
    onRefresh();
    setUpdating(false);
  };

  const getStatusStyle = (est) => {
    if (est === 'ENTREGADO') return { bg: '#D1FAE5', color: '#065F46' };
    if (est === 'EN PROCESO') return { bg: '#EAE4CE', color: '#8B1E1E' };
    if (est === 'PAUSADO') return { bg: '#f1f5f9', color: '#475569' };
    if (est === 'PENDIENTE') return { bg: '#FEF3C7', color: '#92400E' };
    return { bg: '#EAE4CE', color: '#8B1E1E' };
  };

  const currentStatus = getStatusStyle(estado);

  const formattedRetiro = (() => {
    if (!retiro) return 'Sin fecha';
    const d = new Date(retiro);
    if (isNaN(d.getTime())) return retiro;
    return d
      .toLocaleString('es-AR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
      .replace(/\//g, '-')
      .replace(',', '');
  })();

  return (
    <>
      {/* =========================================
          TARJETA MOBILE (FIEL A LA CAPTURA)
         ========================================= */}
      <div
        className="budget-card-mobile"
        style={{
          opacity: updating ? 0.6 : 1,
          pointerEvents: updating ? 'none' : 'auto',
        }}
      >
        {/* Fila 1: N° y Total */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
          <div>
            <div style={{ fontSize: '12.5px', fontWeight: 700, color: '#6E5D46', marginBottom: '2px' }}>N°</div>
            <div style={{ fontSize: '20px', fontWeight: 800, color: '#725438', letterSpacing: '-0.01em' }}>{numero}</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '12.5px', fontWeight: 600, color: '#6E5D46', marginBottom: '1px' }}>Total</div>
            <div style={{ fontSize: '26px', fontWeight: 800, color: '#A91D54', lineHeight: 1.1 }}>
              ${total?.toLocaleString('es-AR')}
            </div>
          </div>
        </div>

        {/* Fila 2: Cliente y Retiro */}
        <div style={{ marginBottom: '14px' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '13px', fontWeight: 600, color: '#6E5D46' }}>Cliente</span>
            <span style={{ fontSize: '19px', fontWeight: 800, color: '#5E7358' }}>
              {cliente?.toUpperCase() || 'SIN NOMBRE'}
            </span>
          </div>
          <div style={{ fontSize: '14.5px', fontWeight: 700, color: '#725438', marginTop: '4px' }}>
            Retiro: {formattedRetiro}
          </div>
        </div>

        {/* Fila 3: Cobro y Estado Entrega */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
          <div>
            <div style={{ fontSize: '12.5px', fontWeight: 600, color: '#6E5D46', marginBottom: '6px' }}>Cobro</div>
            <button
              type="button"
              onClick={togglePago}
              style={{
                width: '100%',
                height: '42px',
                borderRadius: '14px',
                border: 'none',
                cursor: 'pointer',
                background: pagado ? '#D1FAE5' : '#FADBD8',
                color: pagado ? '#065F46' : '#992B2B',
                fontSize: '12.5px',
                fontWeight: 800,
                textTransform: 'uppercase',
                fontFamily: 'Inter, sans-serif',
              }}
            >
              {pagado ? 'PAGADO' : 'IMPAGO'}
            </button>
          </div>

          <div>
            <div style={{ fontSize: '12.5px', fontWeight: 600, color: '#6E5D46', marginBottom: '6px' }}>Estado Entrega</div>
            <div className="select-wrapper" style={{ width: '100%' }}>
              <select
                value={estado}
                onChange={(e) => updateEstado(e.target.value)}
                style={{
                  width: '100%',
                  height: '42px',
                  borderRadius: '14px',
                  border: 'none',
                  fontWeight: 800,
                  fontSize: '12px',
                  background: currentStatus.bg,
                  color: currentStatus.color,
                  cursor: 'pointer',
                  outline: 'none',
                  textAlign: 'center',
                  textTransform: 'uppercase',
                  fontFamily: 'Inter, sans-serif',
                }}
              >
                <option value="PAUSADO">BORRADOR</option>
                <option value="PENDIENTE">PRE-PEDIDO</option>
                <option value="EN PROCESO">EN PROCESO</option>
                <option value="EN PUNTO DE ENTREGA">PUNTO ENTREGA</option>
                <option value="ENTREGADO">ENTREGADO</option>
              </select>
            </div>
          </div>
        </div>

        {/* Chips rápidos si el pedido web incluye WhatsApp, SVG o DJ */}
        {(phoneInfo || svgUrl || djUrl) && (
          <div
            style={{
              display: 'flex',
              gap: '8px',
              flexWrap: 'wrap',
              marginBottom: '14px',
              paddingTop: '4px',
            }}
          >
            {phoneInfo && (
              <a
                href={`https://api.whatsapp.com/send?phone=${phoneInfo.waDigits}&text=${encodeURIComponent(
                  `Hola ${cliente || ''}! Te escribimos de Queselló por tu pedido #${numero}.`
                )}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '5px',
                  height: '30px',
                  padding: '0 10px',
                  borderRadius: '10px',
                  background: '#DCFCE7',
                  border: '1px solid #86EFAC',
                  color: '#166534',
                  fontSize: '11.5px',
                  fontWeight: 800,
                  textDecoration: 'none',
                }}
              >
                <span>💬</span>
                <span>WhatsApp ({phoneInfo.raw})</span>
              </a>
            )}
            {svgUrl && (
              <button
                type="button"
                onClick={() => downloadSvgDirect(svgUrl, `sello_${numero}.svg`)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  height: '30px',
                  padding: '0 10px',
                  borderRadius: '10px',
                  background: '#FEE2E2',
                  border: '1px solid #FCA5A5',
                  color: '#DC2626',
                  fontSize: '11px',
                  fontWeight: 800,
                  cursor: 'pointer',
                }}
              >
                <img src="https://api.iconify.design/lucide/download.svg?color=%23DC2626" style={{ width: '13px', height: '13px' }} alt="" />
                <span>SVG</span>
              </button>
            )}
            {djUrl && (
              <button
                type="button"
                onClick={() => downloadPdfDirect(djUrl, `declaracion_jurada_${numero}.pdf`)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  height: '30px',
                  padding: '0 10px',
                  borderRadius: '10px',
                  background: '#EFF6FF',
                  border: '1px solid #93C5FD',
                  color: '#1D4ED8',
                  fontSize: '11px',
                  fontWeight: 800,
                  cursor: 'pointer',
                }}
              >
                <img src="https://api.iconify.design/lucide/file-text.svg?color=%231D4ED8" style={{ width: '13px', height: '13px' }} alt="" />
                <span>DJ</span>
              </button>
            )}
          </div>
        )}

        {/* Fila 4: Editar / Imprimir / Eliminar */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-around',
            alignItems: 'center',
            paddingTop: '6px',
          }}
        >
          <button
            type="button"
            onClick={onEdit}
            style={{
              border: 'none',
              background: 'transparent',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '7px',
              padding: '6px 10px',
              color: '#5C4D3C',
              fontSize: '13.5px',
              fontWeight: 600,
              fontFamily: 'Inter, sans-serif',
            }}
          >
            <img src="https://api.iconify.design/lucide/square-pen.svg?color=%231a202c" style={{ width: '20px', height: '20px' }} alt="" />
            <span>Editar</span>
          </button>

          <button
            type="button"
            onClick={() => onPrint()}
            style={{
              border: 'none',
              background: 'transparent',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '7px',
              padding: '6px 10px',
              color: '#5C4D3C',
              fontSize: '13.5px',
              fontWeight: 600,
              fontFamily: 'Inter, sans-serif',
            }}
          >
            <img src="https://api.iconify.design/lucide/printer.svg?color=%231a202c" style={{ width: '20px', height: '20px' }} alt="" />
            <span>Imprimir</span>
          </button>

          <button
            type="button"
            onClick={onDelete}
            style={{
              border: 'none',
              background: 'transparent',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '7px',
              padding: '6px 10px',
              color: '#5C4D3C',
              fontSize: '13.5px',
              fontWeight: 600,
              fontFamily: 'Inter, sans-serif',
            }}
          >
            <img src="https://api.iconify.design/lucide/trash-2.svg?color=%231a202c" style={{ width: '20px', height: '20px' }} alt="" />
            <span>Eliminar</span>
          </button>
        </div>
      </div>

      {/* =========================================
          FILA DESKTOP (DISEÑO ORIGINAL)
         ========================================= */}
      <div
        className="budget-row-desktop"
        style={{
          background: 'white',
          borderRadius: '24px',
          padding: '20px 30px',
          alignItems: 'center',
          gap: '20px',
          boxShadow: '0 4px 20px rgba(0,0,0,0.01)',
          opacity: updating ? 0.6 : 1,
          pointerEvents: updating ? 'none' : 'auto',
          fontFamily: 'Inter',
        }}
      >
        {/* Folio */}
        <div style={{ width: '110px', fontSize: '18px', fontWeight: 700, color: '#4b3b28' }}>{numero}</div>

        {/* Info Cliente */}
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: '17px', fontWeight: 500, color: '#5E7358' }}>
            {cliente?.toUpperCase() || 'SIN NOMBRE'}
          </div>
          <div style={{ fontSize: '11px', color: 'rgb(100, 116, 139)', fontWeight: 400, marginTop: '4px' }}>
            Retiro: {formattedRetiro}
          </div>
        </div>

        {/* Monto Total */}
        <div style={{ width: '120px', fontSize: '20px', fontWeight: 500, color: '#8E1F52', textAlign: 'center' }}>
          ${total?.toLocaleString('es-AR')}
        </div>

        {/* Estado Pago */}
        <div style={{ width: '110px', display: 'flex', justifyContent: 'center' }}>
          <button
            onClick={togglePago}
            style={{
              width: '95px',
              height: '36px',
              borderRadius: '15px',
              border: 'none',
              cursor: 'pointer',
              background: pagado ? '#D1FAE5' : '#FEE2E2',
              color: pagado ? '#065F46' : '#8B1E1E',
              fontSize: '11px',
              fontWeight: 900,
              textTransform: 'uppercase',
            }}
          >
            {pagado ? 'PAGADO' : 'IMPAGO'}
          </button>
        </div>

        {/* Dropdown Estado */}
        <div className="select-wrapper" style={{ width: '155px' }}>
          <select
            value={estado}
            onChange={(e) => updateEstado(e.target.value)}
            style={{
              width: '100%',
              height: '38px',
              borderRadius: '15px',
              border: 'none',
              fontWeight: 900,
              fontSize: '11px',
              background: currentStatus.bg,
              color: currentStatus.color,
              cursor: 'pointer',
              outline: 'none',
              textAlign: 'center',
              textTransform: 'uppercase',
            }}
          >
            <option value="PAUSADO">BORRADOR</option>
            <option value="PENDIENTE">PRE-PEDIDO</option>
            <option value="EN PROCESO">EN PROCESO</option>
            <option value="EN PUNTO DE ENTREGA">PUNTO ENTREGA</option>
            <option value="ENTREGADO">ENTREGADO</option>
          </select>
        </div>

        {/* Acciones */}
        <div style={{ display: 'flex', gap: '8px', minWidth: '200px', justifyContent: 'center', alignItems: 'center' }}>
          {phoneInfo && (
            <a
              href={`https://api.whatsapp.com/send?phone=${phoneInfo.waDigits}&text=${encodeURIComponent(
                `Hola ${cliente || ''}! Te escribimos de Queselló por tu pedido #${numero}.`
              )}`}
              target="_blank"
              rel="noopener noreferrer"
              title={`Escribir por WhatsApp (${phoneInfo.raw})`}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                height: '32px',
                padding: '0 8px',
                borderRadius: '10px',
                background: '#DCFCE7',
                border: '1px solid #86EFAC',
                color: '#166534',
                fontSize: '11px',
                fontWeight: 800,
                textDecoration: 'none',
              }}
            >
              WA
            </a>
          )}
          {svgUrl && (
            <button
              type="button"
              onClick={() => downloadSvgDirect(svgUrl, `sello_${numero}.svg`)}
              title="Descargar SVG de producción para Inkscape (Láser)"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '4px',
                height: '32px',
                padding: '0 8px',
                borderRadius: '10px',
                background: '#FEE2E2',
                border: '1px solid #FCA5A5',
                color: '#DC2626',
                fontSize: '11px',
                fontWeight: 800,
                cursor: 'pointer',
              }}
            >
              <img src="https://api.iconify.design/lucide/download.svg?color=%23DC2626" style={{ width: '14px', height: '14px' }} alt="Descargar SVG" />
              <span>SVG</span>
            </button>
          )}
          {djUrl && (
            <button
              type="button"
              onClick={() => downloadPdfDirect(djUrl, `declaracion_jurada_${numero}.pdf`)}
              title="Descargar Declaración Jurada de Autenticidad (PDF)"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '4px',
                height: '32px',
                padding: '0 8px',
                borderRadius: '10px',
                background: '#EFF6FF',
                border: '1px solid #93C5FD',
                color: '#1D4ED8',
                fontSize: '11px',
                fontWeight: 800,
                cursor: 'pointer',
              }}
            >
              <img src="https://api.iconify.design/lucide/file-text.svg?color=%231D4ED8" style={{ width: '14px', height: '14px' }} alt="Descargar DJ" />
              <span>DJ</span>
            </button>
          )}
          <button onClick={onEdit} style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: '5px' }}>
            <img src="https://api.iconify.design/lucide/edit-3.svg?color=%231a202c" style={{ width: '22px' }} alt="Edit" />
          </button>
          <button onClick={() => onPrint()} style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: '5px' }}>
            <img src="https://api.iconify.design/lucide/printer.svg?color=%234b3b28" style={{ width: '22px' }} alt="Print" />
          </button>
          <button onClick={onDelete} style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: '5px' }}>
            <img src="https://api.iconify.design/lucide/trash-2.svg?color=%231a202c" style={{ width: '22px' }} alt="Delete" />
          </button>
        </div>
      </div>

      <style>{`
        .budget-card-mobile {
          display: none;
        }
        .budget-row-desktop {
          display: flex;
        }
        @media (max-width: 768px) {
          .budget-card-mobile {
            display: block;
            background: #FAF9F5;
            border-radius: 26px;
            padding: 20px 22px;
            box-shadow: 0 4px 18px rgba(0, 0, 0, 0.03);
            font-family: 'Inter', sans-serif;
          }
          .budget-row-desktop {
            display: none !important;
          }
        }
      `}</style>
    </>
  );
}
