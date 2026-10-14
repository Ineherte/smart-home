// Umbral · facturas de Octopus y TIM desde tu Gmail (Google Apps Script, gratis).
// Cada hora busca los correos de Octopus y TIM con un PDF adjunto, se los manda a Umbral
// (función «bills») y les pone la etiqueta «umbral-facturas» para no repetirlos.
// En Umbral, el PDF queda en Documentos → Facturas y sus datos en Cuentas → Luz.
// Cómo ponerlo en marcha: supabase/functions/bills/LEEME.md
// El token NO va aquí: se guarda en Configuración del proyecto → Propiedades del script → SYNC_TOKEN.

const UMBRAL_URL = 'https://lnctwcizdjaeomvkcbst.supabase.co/functions/v1/bills';
const OWNER = 'Ines';
const SENDERS = 'from:(octopusenergy.it OR tim.it OR telecomitalia.it)';
const LABEL = 'umbral-facturas';

// La que se ejecuta cada hora: lo de los últimos 30 días que aún no se haya importado.
function importarFacturas() {
  importar_(`${SENDERS} has:attachment filename:pdf newer_than:30d -label:${LABEL}`, 20);
}

// Ejecútala una vez a mano: trae las facturas de los últimos 2 años (para tener historial).
function importarHistorial() {
  importar_(`${SENDERS} has:attachment filename:pdf newer_than:2y -label:${LABEL}`, 100);
}

function importar_(query, max) {
  const token = PropertiesService.getScriptProperties().getProperty('SYNC_TOKEN');
  if (!token) throw new Error('Falta SYNC_TOKEN en Configuración del proyecto → Propiedades del script');
  const label = GmailApp.getUserLabelByName(LABEL) || GmailApp.createLabel(LABEL);
  const threads = GmailApp.search(query, 0, max);
  console.log(`${threads.length} conversaciones con facturas`);
  threads.forEach((thread) => {
    let done = true;
    thread.getMessages().forEach((message) => {
      const pdfs = message.getAttachments({ includeInlineImages: false }).filter((file) => file.getContentType() === 'application/pdf' || /\.pdf$/i.test(file.getName()));
      pdfs.forEach((file) => {
        const response = UrlFetchApp.fetch(UMBRAL_URL, {
          method: 'post',
          contentType: 'application/json',
          headers: { 'x-sync-token': token },
          muteHttpExceptions: true,
          payload: JSON.stringify({
            owner: OWNER,
            file_name: file.getName(),
            pdf_base64: Utilities.base64Encode(file.getBytes()),
            subject: message.getSubject(),
            from: message.getFrom(),
            message_id: message.getId()
          })
        });
        const code = response.getResponseCode();
        console.log(`${file.getName()} → ${code} ${response.getContentText().slice(0, 200)}`);
        // Si falla Umbral (o el token), se reintenta en la próxima hora.
        if (code >= 500 || code === 401) done = false;
      });
    });
    if (done) thread.addLabel(label);
  });
}
