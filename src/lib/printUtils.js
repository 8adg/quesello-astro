import { supabase } from './supabase';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const sleep = ms => new Promise(res => setTimeout(res, ms));

const _CRC8_TABLE = [
  0x00, 0x07, 0x0e, 0x09, 0x1c, 0x1b, 0x12, 0x15, 0x38, 0x3f, 0x36, 0x31, 0x24, 0x23, 0x2a, 0x2d, 0x70, 0x77, 0x7e, 0x79, 0x6c, 0x6b, 0x62, 0x65, 0x48, 0x4f, 0x46, 0x41, 0x54, 0x53, 0x5a, 0x5d, 0xe0, 0xe7, 0xee, 0xe9, 0xfc, 0xfb, 0xf2, 0xf5, 0xd8, 0xdf, 0xd6, 0xd1, 0xc4, 0xc3, 0xca, 0xcd, 0x90, 0x97, 0x9e, 0x99, 0x8c, 0x8b, 0x82, 0x85, 0xa8, 0xaf, 0xa6, 0xa1, 0xb4, 0xb3, 0xba, 0xbd, 0xc7, 0xc0, 0xc9, 0xce, 0xdb, 0xdc, 0xd5, 0xd2, 0xff, 0xf8, 0xf1, 0xf6, 0xe3, 0xe4, 0xed, 0xea, 0xb7, 0xb0, 0xb9, 0xbe, 0xab, 0xac, 0xa5, 0xa2, 0x8f, 0x88, 0x81, 0x86, 0x93, 0x94, 0x9d, 0x9a, 0x27, 0x20, 0x29, 0x2e, 0x3b, 0x3c, 0x35, 0x32, 0x1f, 0x18, 0x11, 0x16, 0x03, 0x04, 0x0d, 0x0a, 0x57, 0x50, 0x59, 0x5e, 0x4b, 0x4c, 0x45, 0x42, 0x6f, 0x68, 0x61, 0x66, 0x73, 0x74, 0x7d, 0x7a, 0x89, 0x8e, 0x87, 0x80, 0x95, 0x92, 0x9b, 0x9c, 0xb1, 0xb6, 0xbf, 0xb8, 0xad, 0xaa, 0xa3, 0xa4, 0xf9, 0xfe, 0xf7, 0xf0, 0xe5, 0xe2, 0xeb, 0xec, 0xc1, 0xc6, 0xcf, 0xc8, 0xdd, 0xda, 0xd3, 0xd4, 0x69, 0x6e, 0x67, 0x60, 0x75, 0x72, 0x7b, 0x7c, 0x51, 0x56, 0x5f, 0x58, 0x4d, 0x4a, 0x43, 0x44, 0x19, 0x1e, 0x17, 0x10, 0x05, 0x02, 0x0b, 0x0c, 0x21, 0x26, 0x2f, 0x28, 0x3d, 0x3a, 0x33, 0x34, 0x4e, 0x49, 0x40, 0x47, 0x52, 0x55, 0x5c, 0x5b, 0x76, 0x71, 0x78, 0x7f, 0x6a, 0x6d, 0x64, 0x63, 0x3e, 0x39, 0x30, 0x37, 0x22, 0x25, 0x2c, 0x2b, 0x06, 0x01, 0x08, 0x0f, 0x1a, 0x1d, 0x14, 0x13, 0xae, 0xa9, 0xa0, 0xa7, 0xb2, 0xb5, 0xbc, 0xbb, 0x96, 0x91, 0x98, 0x9f, 0x8a, 0x8d, 0x84, 0x83, 0xde, 0xd9, 0xd0, 0xd7, 0xc2, 0xc5, 0xcc, 0xcb, 0xe6, 0xe1, 0xe8, 0xef, 0xfa, 0xfd, 0xf4, 0xf3
];

const calcCRC8 = (data) => {
  let crc = 0;
  for (let b of data) { crc = _CRC8_TABLE[(crc ^ b) & 0xFF]; }
  return crc & 0xFF;
};

const makeCommand = (cmd, payload) => {
  const ln = payload.length;
  const full = new Uint8Array(8 + ln);
  full[0] = 0x22; full[1] = 0x21;
  full[2] = cmd; full[3] = 0;
  full[4] = ln & 0xFF; full[5] = (ln >> 8) & 0xFF;
  full.set(payload, 6);
  full[6 + ln] = calcCRC8(payload);
  full[7 + ln] = 0xFF;
  return full;
};

export const handleDirectMeowPrint = async (p, setMsg, setLoading) => {
  if (!navigator.bluetooth) {
    setMsg({ text: "Tu navegador no soporta Bluetooth Web", type: 'error' });
    return;
  }
  setLoading(true);
  setMsg({ text: "🔍 ESCANEANDO...", type: 'success' });
  try {
    const device = await navigator.bluetooth.requestDevice({
      filters: [{ namePrefix: 'MXW' }, { namePrefix: 'GB' }, { namePrefix: 'Paperang' }, { namePrefix: 'Printer' }],
      optionalServices: ['0000ae30-0000-1000-8000-00805f9b34fb', 0xae30, 0xaf30, 0xff00]
    });

    setMsg({ text: "🔗 CONECTANDO A " + device.name + "...", type: 'success' });
    let server = await device.gatt.connect();
    await sleep(500);

    const services = await server.getPrimaryServices();
    let controlChar, dataChar;

    for (const s of services) {
      const chars = await s.getCharacteristics();
      for (const c of chars) {
        if (c.uuid.includes('ae01')) controlChar = c;
        if (c.uuid.includes('ae03')) dataChar = c;
      }
    }

    if (!controlChar) {
      for (const s of services) {
        const chars = await s.getCharacteristics();
        if (!controlChar) controlChar = chars.find(c => c.properties.write || c.properties.writeWithoutResponse);
        if (!dataChar) dataChar = chars.find(c => (c.properties.write || c.properties.writeWithoutResponse) && c !== controlChar);
      }
    }

    if (!controlChar) throw new Error("No se halló canal de control");
    if (!dataChar) dataChar = controlChar;

    setMsg({ text: "🎨 GENERANDO TICKET...", type: 'success' });
    const canvas = await generateTicketCanvas(p);
    const ctx = canvas.getContext('2d');
    const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    const rows = [];
    for (let y = 0; y < canvas.height; y++) {
      const row = new Uint8Array(canvas.width / 8);
      for (let x = 0; x < canvas.width; x++) {
        const idx = (y * canvas.width + x) * 4;
        if ((pixels[idx] + pixels[idx + 1] + pixels[idx + 2]) / 3 < 128) row[Math.floor(x / 8)] |= (1 << (x % 8));
      }
      rows.push(row);
    }

    setMsg({ text: "📤 ENVIANDO TICKET...", type: 'success' });

    await controlChar.writeValue(makeCommand(0xa1, new Uint8Array([0x00]))); await sleep(300);
    await controlChar.writeValue(makeCommand(0xa2, new Uint8Array([0x60]))); 

    const numLines = rows.length;
    const startPay = new Uint8Array([numLines & 0xFF, (numLines >> 8) & 0xFF, 0x30, 0x00]);
    await controlChar.writeValue(makeCommand(0xa9, startPay));
    await sleep(500);

    for (let i = 0; i < rows.length; i++) {
        try {
            await dataChar.writeValueWithoutResponse(rows[i]);
            await sleep(15); 
        } catch (bleErr) {
            console.warn("Retrying line...", i);
            await sleep(100);
            await dataChar.writeValueWithoutResponse(rows[i]);
        }
    }

    await controlChar.writeValue(makeCommand(0xad, new Uint8Array([0x00])));
    await sleep(500);

    setMsg({ text: "✅ ¡IMPRESIÓN FINALIZADA!", type: 'success' });
    await server.disconnect();
  } catch (e) { 
    console.error("Error Meow:", e); 
    setMsg({ text: "Error: " + e.message, type: 'error' }); 
  }
  setLoading(false);
};

export const generateTicketCanvas = async (p) => {
  const { data: items } = await supabase.from("presupuesto_items").select("*").eq("presupuesto_id", p.id);
  const canvas = document.createElement('canvas');
  canvas.width = 384;
  const ctx = canvas.getContext('2d');

  canvas.height = 630 + (items?.length || 0) * 25 + (p.observaciones ? 60 : 0);

  ctx.fillStyle = "white"; ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "black"; ctx.textBaseline = "top";

  const logoImg = new Image();
  logoImg.crossOrigin = "anonymous";
  logoImg.src = "/header-logo-hd.png"; 
  await new Promise(res => { 
    logoImg.onload = () => { console.log("Logo ticket cargado OK"); res(); }; 
    logoImg.onerror = () => { console.error("Error cargando logo ticket"); res(); }; 
  });

  if (logoImg.complete && logoImg.width > 0) {
    const logoW = 376; 
    const logoH = 62;  
    ctx.drawImage(logoImg, (384 - logoW) / 2, 10, logoW, logoH);
  }

  ctx.font = "bold 18px Courier New";
  ctx.fillText("PRESUPUESTO", 10, 85);
  ctx.textAlign = "right";
  ctx.font = "bold 14px Courier New";
  ctx.fillText("NO VÁLIDO COMO FACTURA", 374, 95);
  ctx.textAlign = "left";

  ctx.font = "bold 22px Courier New";
  ctx.fillText(`N° ${p.numero}`, 10, 125);
  ctx.font = "bold 18px Courier New";
  ctx.fillText(`CLIENTE: ${p.cliente?.toUpperCase() || "C. FINAL"}`, 10, 155);
  ctx.textAlign = "right";
  ctx.fillText(p.fecha || "", 374, 155);
  ctx.textAlign = "left";

  let currY = 190;
  ctx.font = "bold 16px Courier New";
  ctx.fillText("U", 10, currY);
  ctx.fillText("DESCRIPCION", 50, currY);
  ctx.fillText("TOTAL", 300, currY);
  ctx.beginPath(); ctx.moveTo(10, currY + 20); ctx.lineTo(374, currY + 20); ctx.stroke();
  currY += 30;

  ctx.font = "bold 16px Courier New";
  (items || []).forEach(it => {
    ctx.fillText(it.cantidad, 10, currY);
    ctx.fillText(it.descripcion.toUpperCase().substring(0, 18), 50, currY);
    ctx.textAlign = "right";
    ctx.fillText(`$${Math.floor(it.total).toLocaleString()}`, 374, currY);
    ctx.textAlign = "left";
    currY += 25;
  });

  if (p.observaciones) {
    ctx.font = "bold 16px Courier New";
    ctx.fillText("OBS: " + p.observaciones.toUpperCase(), 10, currY);
    currY += 35;
  }

  ctx.beginPath(); ctx.moveTo(10, currY); ctx.lineTo(374, currY); ctx.stroke();
  ctx.font = "bold 22px Courier New";
  ctx.fillText(p.pagado ? "PAGADO" : "IMPAGO", 10, currY + 10);
  ctx.textAlign = "right";
  ctx.fillText(`TOTAL: $${p.total?.toLocaleString()}`, 374, currY + 10);
  ctx.textAlign = "left";
  currY += 60;

  ctx.font = "bold 18px Courier New";
  ctx.textAlign = "center";
  ctx.fillText("www.quesello.com.ar", 192, currY);
  
  ctx.font = "bold 15px Courier New";
  ctx.fillText("PRESUPUESTO VÁLIDO POR 10 DIAS.", 192, currY + 30);
  ctx.fillText("DADO EL CONTEXTO INFLACIONARIO SE COBRARÁ", 192, currY + 55);
  ctx.fillText("EL TOTAL DEL VALOR POR ADELANTADO", 192, currY + 75);

  ctx.font = "bold 20px Courier New";
  ctx.fillText("ESCANEAR PARA RETIRAR", 192, currY + 110);

  const tk = p.token || "VALIDATION";
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(`https://quesello-site.web.app/pedidos/validar.html?id=${p.id}&tk=${tk}`)}`;
  const qrImg = new Image(); qrImg.crossOrigin = "anonymous"; qrImg.src = qrUrl;
  await new Promise((res) => {
    qrImg.onload = () => { ctx.drawImage(qrImg, 92, currY + 140, 200, 200); res(); };
    setTimeout(res, 2500);
  });

  return canvas;
};

export const handleClientSidePDF = async (p, setMsg, setLoading) => {
  setLoading(true); setMsg({ text: "📄 GENERANDO PDF...", type: 'success' });
  try {
    const { data: items } = await supabase.from("presupuesto_items").select("*").eq("presupuesto_id", p.id);
    const estimatedHeight = 115 + (items?.length || 0) * 8 + (p.observaciones ? 10 : 0) + 13.2;
    const doc = new jsPDF({ unit: 'mm', format: [57, estimatedHeight] });

    const [logoBase64, qrBase64] = await Promise.all([
      new Promise((res) => {
        const img = new Image(); 
        img.crossOrigin = "anonymous";
        img.onload = () => {
          const cv = document.createElement("canvas"); cv.width = img.width; cv.height = img.height;
          cv.getContext("2d").drawImage(img, 0, 0); res(cv.toDataURL("image/png"));
        }; 
        img.onerror = () => { console.error("Error PDF logo"); res(null); }; 
        img.src = "/header-logo-hd.png";
      }),
      new Promise((res) => {
        const tk = p.token || "VALIDATION";
        const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(`https://quesello-site.web.app/pedidos/validar.html?id=${p.id}&tk=${tk}`)}`;
        const img = new Image(); img.crossOrigin = "anonymous"; img.onload = () => {
          const cv = document.createElement("canvas"); cv.width = 250; cv.height = 250;
          cv.getContext("2d").drawImage(img, 0, 0); res(cv.toDataURL("image/png"));
        }; img.onerror = () => res(null); img.src = qrUrl;
        setTimeout(() => res(null), 2500);
      })
    ]);

    if (logoBase64) {
      const logoW = 47;
      const logoH = 7.7;
      doc.addImage(logoBase64, 'PNG', (57 - logoW) / 2, 5, logoW, logoH);
    }

    doc.setFontSize(8); doc.setFont("courier", "normal");
    doc.text("PRESUPUESTO", 2.5, 20);
    doc.text("NO VÁLIDO COMO FACTURA", 54.5, 25, { align: "right" });
    doc.setFont("courier", "bold"); doc.text(`N° ${p.numero}`, 2.5, 31);
    doc.text(`CLIENTE: ${p.cliente?.toUpperCase() || "C. FINAL"}`, 2.5, 36);
    doc.text(`${p.fecha || ''}`, 54.5, 36, { align: "right" });

    const rows = (items || []).map(it => [it.cantidad, it.descripcion.toUpperCase(), Math.floor(it.precio_unitario).toLocaleString(), Math.floor(it.total).toLocaleString()]);
    if (p.observaciones) rows.push(['', `OBSERVACIONES:\n${p.observaciones.toUpperCase()}`, '', '']);

    autoTable(doc, {
      head: [['U', 'DESCRIPCION', 'P.U.', 'TOTAL $']],
      body: rows,
      startY: 40,
      margin: { left: 2.5, right: 2.5 },
      tableWidth: 52,
      theme: 'grid',
      styles: { font: 'courier', fontSize: 7, cellPadding: 1, textColor: [0, 0, 0], lineColor: [0, 0, 0] },
      headStyles: { fillColor: [255, 255, 255], textColor: [0, 0, 0], fontStyle: 'bold', lineWidth: 0.2 },
      bodyStyles: { lineWidth: { left: 0.2, right: 0.2, top: 0, bottom: 0 } },
      columnStyles: { 0: { cellWidth: 4 }, 1: { cellWidth: 24 }, 2: { cellWidth: 12 }, 3: { cellWidth: 12 } },
      foot: [['', p.pagado ? 'PAGADO' : 'IMPAGO', 'TOTAL', p.total?.toLocaleString()]],
      footStyles: { fillColor: [255, 255, 255], textColor: [0, 0, 0], fontStyle: 'bold', lineWidth: 0.2 }
    });

    let finalY = doc.lastAutoTable.finalY + 8;
    doc.setFontSize(6); doc.setFont("courier", "normal");
    doc.text("www.quesello.com.ar", 28.5, finalY, { align: "center" });
    
    doc.text("PRESUPUESTO VÁLIDO POR 10 DIAS. DADO EL", 28.5, finalY + 4, { align: "center" });
    doc.text("CONTEXTO INFLACIONARIO SE COBRARÁ EL", 28.5, finalY + 7, { align: "center" });
    doc.text("TOTAL DEL VALOR POR ADELANTADO", 28.5, finalY + 10, { align: "center" });

    doc.setFontSize(8); doc.setFont("courier", "bold");
    doc.text("ESCANEAR PARA RETIRAR", 28.5, finalY + 18, { align: "center" });

    if (qrBase64) {
      doc.addImage(qrBase64, 'PNG', 16, finalY + 22, 25, 25);
    }
    
    doc.save(`Presupuesto_${p.numero}.pdf`);
    setMsg({ text: "✅ PDF GENERADO EXITOSAMENTE", type: 'success' });
  } catch (e) { 
    setMsg({ text: "Error: " + e.message, type: 'error' }); 
  }
  setLoading(false);
};
