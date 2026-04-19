import './style.css'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { createClient } from '@supabase/supabase-js'
import { jsPDF } from 'jspdf'
import html2canvas from 'html2canvas'

// --- Supabase Config ---
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY
const supabase = createClient(supabaseUrl, supabaseAnonKey)

// --- Chatbot Logic ---

const API_KEY = import.meta.env.VITE_GEMINI_API_KEY
const MODEL_NAME = import.meta.env.VITE_GEMINI_MODEL || 'gemini-flash-latest'

let genAI = null
let model = null
if (API_KEY && API_KEY !== 'your_api_key_here') {
  genAI = new GoogleGenerativeAI(API_KEY)
  model = genAI.getGenerativeModel({ model: MODEL_NAME })
}

const chatModal = document.getElementById('chat-modal')
const chatMessages = document.getElementById('chat-messages')
const chatInput = document.getElementById('chat-input')
const chatSend = document.getElementById('chat-send')
const closeChat = document.getElementById('close-chat')

// Report Modal Elements
const reportModal = document.getElementById('report-modal')
const closeReport = document.getElementById('close-report')
const reportAgeBadge = document.getElementById('report-age-badge')
const reportMetabolic = document.getElementById('report-metabolic')
const reportBioExplanation = document.getElementById('report-bio-explanation')
const routineMorning = document.getElementById('routine-morning')
const routineAfternoon = document.getElementById('routine-afternoon')
const routineNight = document.getElementById('routine-night')
const reportProductsContainer = document.getElementById('report-products')
const finalWaLink = document.getElementById('final-wa-link')

// Lead Form Elements
const leadForm = document.getElementById('lead-form')
const leadFormContent = document.getElementById('lead-form-content')
const leadSuccess = document.getElementById('lead-success')
const leadEmail = document.getElementById('lead-email')
const leadPhone = document.getElementById('lead-phone')

let chatSession = null;
let currentGoal = '';
let isGeneratingReport = false;
let currentReportData = null;
let userName = 'Usuario';

const WHATSAPP_NUMBER = '573007044302';

function addMessage(text, isBot = true, isHTML = false) {
  const msgDiv = document.createElement('div')
  msgDiv.className = `msg ${isBot ? 'msg-bot' : 'msg-user'}`

  if (isHTML) {
    msgDiv.innerHTML = text
  } else {
    let formattedText = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    formattedText = formattedText.replace(/\n\*/g, '<br>•');
    formattedText = formattedText.replace(/\n-/g, '<br>•');
    msgDiv.innerHTML = formattedText
  }

  chatMessages.appendChild(msgDiv)
  chatMessages.scrollTop = chatMessages.scrollHeight
}

async function openChat(goalTitle) {
  chatModal.style.display = 'flex'
  chatMessages.innerHTML = ''
  currentGoal = goalTitle
  isGeneratingReport = false
  userName = 'Usuario';

  if (!model) {
    addMessage('Lo siento, la inteligencia artificial no está encendida (falta API Key). Por favor, contacta a un especialista en el botón de abajo.', true)
    const ctaDiv = document.createElement('div')
    ctaDiv.style.marginTop = '1rem'
    ctaDiv.innerHTML = `<a href="https://wa.me/${WHATSAPP_NUMBER}?text=Hola!%20Quiero%20empezar%20mi%20plan%20de%20${encodeURIComponent(goalTitle)}." target="_blank" class="btn btn-primary" style="width: 100%; text-align: center;">Hablar por WhatsApp</a>`
    chatMessages.appendChild(ctaDiv)
    return
  }

  const systemInstruction = `
    Eres Camila, una Asesora de Bienestar Profesional de FuXion y Advanced Health.
    Tu objetivo es evaluar la salud del usuario de forma conversacional, amigable, empática y MUY humana.
    
    El usuario ha indicado que le interesa: "${goalTitle}".
    
    INSTRUCCIONES CLAVES:
    1. Saluda como Camila y menciona su interés en "${goalTitle}". Di que le harás unas preguntas rápidas para conocerlo.
    2. Haz SIEMPRE SOLO UNA PREGUNTA (o dos muy cortas y relacionadas) a la vez.
    3. A través de la conversación, debes indagar sobre estos pilares:
       - Edad/Peso/Sexo. (IMPORTANTE: Solo atender a personas de 15 años o más. Si es menor, dile amablemente que por ahora solo puedes asesorar a mayores de 15 años).
       - Antecedentes de salud: Pregunta si tiene alguna enfermedad de base o diagnóstico como hipertensión, cardiopatías, colesterol, diabetes, embarazo o lactancia.
       - Descanso (Horas y calidad).
       - Alimentación e Hidratación.
       - Actividad física / Sedentarismo.
       - Estrés y estado emocional.
       - Obstáculos principales.
    4. IMPORTANTE: Antes de terminar, cuando ya tengas los datos de salud, PREGUNTA EL NOMBRE del usuario para "guardar su progreso y personalizar su hoja de ruta".
    5. CUANDO TENGAS EL NOMBRE Y LA INFO, dile de forma natural que vas a analizar sus datos para crear su reporte.
    6. AL FINAL DE ESE ÚLTIMO MENSAJE, escribe EXACTAMENTE: [REPORT_READY].
  `;

  chatSession = model.startChat({
    history: [
      { role: "user", parts: [{ text: systemInstruction }] },
      { role: "model", parts: [{ text: "Entendido, soy Camila. Iniciaré la conversación enfocada en conocer al usuario con empatía y calidez, asegurándome de pedir su nombre al final." }] }
    ]
  });

  try {
    const result = await chatSession.sendMessage(`Hola, quiero iniciar mi evaluación enfocada en mejorar mi: ${goalTitle}`);
    const text = result.response.text();
    addMessage(text.replace('[REPORT_READY]', ''), true);
  } catch (error) {
    console.error("Gemini Error:", error);
    addMessage('Hubo un error de conexión inicial.', true);
  }
}

async function handleUserInput() {
  if (isGeneratingReport || !chatSession) return;

  const input = chatInput.value.trim();
  if (!input) return;

  chatInput.value = '';
  addMessage(input, false);

  try {
    const result = await chatSession.sendMessage(input);
    const text = result.response.text();

    if (text.includes('[REPORT_READY]')) {
      isGeneratingReport = true;
      const cleanText = text.replace('[REPORT_READY]', '').trim();
      if (cleanText) addMessage(cleanText, true);

      // Intentar extraer el nombre del historial (heurística simple o pedirlo específicamente)
      extractUserName();
      generateReport();
    } else {
      addMessage(text, true);
    }
  } catch (error) {
    console.error("Gemini Response Error:", error);
    addMessage('Hubo un problema de conexión. Por favor, intenta de nuevo.', true);
  }
}

async function extractUserName() {
  try {
    const extractionPrompt = "Basado en la conversación anterior, ¿cuál es el nombre del usuario? Responde SOLO con el nombre. Si no lo sabes, responde 'Usuario'.";
    const result = await chatSession.sendMessage(extractionPrompt);
    userName = result.response.text().trim();
  } catch (e) {
    userName = 'Usuario';
  }
}

async function generateReport() {
  addMessage('🧬 Generando tu Plan de Transformación Personalizado...', true)

  try {
    const jsonPrompt = `
      Genera el REPORTE DE BIENESTAR PREMIUM (JSON) personalizado para ${userName}.
      IMPORTANTE: Los productos FuXion recomendados DEBEN incluirse dentro de los pasos de la "routine".
      SOLO RESPONDE CON EL JSON.

      REGLAS DURAS DE RECOMENDACIÓN (SÍGUELAS ESTRICTAMENTE):
      - Si el usuario tiene HIPERTENSIÓN o CARDIOPATÍA: NO RECOMENDAR "Vita Xtra T+" ni "Termo T3".
      - Si la usuaria está EMBARAZADA o en periodo de LACTANCIA: NO RECOMENDAR "Café" (ninguno), ni "Vita Xtra T+", ni "Termo T3".
      - Solo recomendar productos adecuados según su perfil de salud reportado.

      {
        "biologicalAge": { "age": "X años", "badge": "Nivel Óptimo/Alerta", "explanation": "..." },
        "metabolicAnalysis": "Resumen corto para la web...",
        "bioExplanation": "Explicación técnica corta para la web...",
        "routine": {
          "morning": "Acción mañana...",
          "afternoon": "Acción tarde...",
          "night": "Acción noche..."
        },
        "products": [
          { "name": "Producto 1", "benefit": "Beneficio corto...", "cta": "Comprar ahora" }
        ],
        "pdfExtendedData": {
          "detailedAnalysis": "Un análisis profundo y profesional de la condición del usuario (3-4 párrafos)...",
          "biologicalDeepDive": "Explicación detallada de los procesos bioquímicos afectados...",
          "lifestyleRecommendations": "Consejos adicionales sobre sueño, estrés y actividad física...",
          "productsExtended": [
            { 
              "name": "Producto 1", 
              "fullDescription": "Descripción detallada del producto, sus componentes clave y por qué es vital para este caso específico...",
              "howToUse": "Instrucciones precisas de consumo..."
            }
          ]
        }
      }
    `;

    const result = await chatSession.sendMessage(jsonPrompt);
    let text = result.response.text();
    let cleanText = text.replace(/```json/gi, '').replace(/```/g, '').trim();
    const firstBrace = cleanText.indexOf('{');
    const lastBrace = cleanText.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace !== -1) cleanText = cleanText.substring(firstBrace, lastBrace + 1);

    const data = JSON.parse(cleanText);
    currentReportData = data;

    // Populate Modal
    reportAgeBadge.innerHTML = `<span>Plan de Transformación para: ${userName}</span>`;
    document.getElementById('report-title').textContent = `Reporte de Bienestar para ${userName}`;

    reportAgeBadge.innerHTML = `<span>Edad Biológica: ${data.biologicalAge.age}</span> • <strong>${data.biologicalAge.badge}</strong>`;
    reportMetabolic.textContent = data.metabolicAnalysis;
    reportBioExplanation.textContent = data.bioExplanation;
    routineMorning.textContent = data.routine.morning;
    routineAfternoon.textContent = data.routine.afternoon;
    routineNight.textContent = data.routine.night;

    reportProductsContainer.innerHTML = data.products.map(p => `
      <div class="pr-card">
        <h5>${p.name}</h5>
        <p>${p.benefit}</p>
        <a href="https://wa.me/${WHATSAPP_NUMBER}?text=Hola!%20Quiero%20comprar%20${p.name}%20como%20parte%20de%20mi%20plan%20con%20Camila." target="_blank" class="btn btn-primary btn-sm">${p.cta}</a>
      </div>
    `).join('');

    // Reset Form
    leadFormContent.style.display = 'block';
    leadSuccess.style.display = 'none';

    // Show Report Modal
    chatModal.style.display = 'none';
    reportModal.style.display = 'block';

    // Add Download PDF Button to both containers to ensure visibility
    const containers = ['lead-form-content', 'lead-success'];
    containers.forEach(containerId => {
      const container = document.getElementById(containerId);
      if (container && !container.querySelector('.download-pdf-btn')) {
        const downloadBtn = document.createElement('button');
        downloadBtn.className = 'btn btn-secondary download-pdf-btn';
        downloadBtn.style.width = '100%';
        downloadBtn.style.marginTop = '1rem';
        downloadBtn.style.backgroundColor = '#f0f0f0';
        downloadBtn.style.color = 'var(--color-primary)';
        downloadBtn.style.border = '1px solid var(--color-primary)';
        downloadBtn.innerHTML = '📄 Descargar Versión PDF (BETA)';
        downloadBtn.onclick = downloadPDF;
        container.appendChild(downloadBtn);
      }
    });

  } catch (error) {
    console.error('Report Generation Error:', error);
    addMessage('Hubo un problema al generar el tablero visual. Por favor, hablemos por WhatsApp para darte los resultados.', true);
  }
}

async function downloadPDF() {
  const btns = document.querySelectorAll('.download-pdf-btn');
  const data = currentReportData;

  if (!data) {
    alert('No hay datos suficientes para generar el PDF. Por favor, realiza la evaluación de nuevo.');
    return;
  }

  btns.forEach(btn => {
    btn.disabled = true;
    btn.dataset.originalText = btn.innerHTML;
    btn.innerHTML = '⏳ Generando PDF Profesional...';
  });

  try {
    // Create the Template Container
    const pdfContainer = document.createElement('div');
    pdfContainer.id = 'pdf-template';

    // Page 1: Diagnosis
    const page1 = document.createElement('div');
    page1.className = 'pdf-page';
    page1.innerHTML = `
      <div class="pdf-header">
        <div class="pdf-logo">FuXion & Advanced Health</div>
        <div style="text-align: right; font-size: 10px;">ID: ${Date.now()}</div>
      </div>
      <div class="pdf-title">Plan de Transformación Personalizado</div>
      <div class="pdf-badge">Edad Biológica: ${data.biologicalAge.age} • ${data.biologicalAge.badge}</div>
      
      <div class="pdf-section-title">Análisis Metabólico Profundo</div>
      <div class="pdf-content">${data.pdfExtendedData?.detailedAnalysis || data.metabolicAnalysis}</div>
      
      <div class="pdf-section-title">Explicación Bioquímica Detallada</div>
      <div class="pdf-content">${data.pdfExtendedData?.biologicalDeepDive || data.bioExplanation}</div>
      
      <div class="pdf-footer">
        <span>Preparado por Camila - Especialista en Nutrición IA</span>
        <span>Página 1</span>
      </div>
    `;
    pdfContainer.appendChild(page1);

    // Page 2: Routine
    const page2 = document.createElement('div');
    page2.className = 'pdf-page';
    page2.innerHTML = `
      <div class="pdf-header">
        <div class="pdf-logo">FuXion Plan</div>
      </div>
      <div class="pdf-section-title">Tu Rutina Diaria de Bienestar</div>
      
      <div class="pdf-routine-box">
        <strong>🌅 Mañana (Activación):</strong><br>
        <div class="pdf-content">${data.routine.morning}</div>
      </div>
      <div class="pdf-routine-box">
        <strong>☀️ Tarde (Consolidación):</strong><br>
        <div class="pdf-content">${data.routine.afternoon}</div>
      </div>
      <div class="pdf-routine-box">
        <strong>🌙 Noche (Recuperación):</strong><br>
        <div class="pdf-content">${data.routine.night}</div>
      </div>

      <div class="pdf-section-title">Recomendaciones de Estilo de Vida</div>
      <div class="pdf-content">${data.pdfExtendedData?.lifestyleRecommendations || 'Consulta con tu asesor para más detalles sobre hábitos saludables.'}</div>

      <div class="pdf-footer">
        <span>© 2026 FuXion & Advanced Health</span>
        <span>Página 2</span>
      </div>
    `;
    pdfContainer.appendChild(page2);

    // Page 3: Products
    const page3 = document.createElement('div');
    page3.className = 'pdf-page';
    page3.innerHTML = `
      <div class="pdf-header">
        <div class="pdf-logo">Productos FuXion</div>
      </div>
      <div class="pdf-section-title">Sugerencias Nutracéuticas</div>
      
      ${(data.pdfExtendedData?.productsExtended || data.products).map(p => `
        <div class="pdf-product-card">
          <strong style="color: #344a3e; font-size: 16px;">${p.name}</strong>
          <div class="pdf-content" style="margin-top: 8px;">${p.fullDescription || p.benefit}</div>
          ${p.howToUse ? `<div class="pdf-content" style="margin-top: 5px; font-weight: 600;">Modo de uso: ${p.howToUse}</div>` : ''}
        </div>
      `).join('')}

      <div style="margin-top: 30px; padding: 20px; border: 2px dashed #8c9b8a; border-radius: 12px; font-size: 13px; font-style: italic;">
        Nota: Estas recomendaciones son generadas por nuestro sistema inteligente basado en tu perfil. Consulta con tu asesor para personalizar las cantidades.
      </div>

      <div class="pdf-footer">
        <span>www.advancedhealth.fuxion.com</span>
        <span>Página 3</span>
      </div>
    `;
    pdfContainer.appendChild(page3);

    document.body.appendChild(pdfContainer);

    const pdf = new jsPDF('p', 'mm', 'a4');
    const pdfPages = pdfContainer.querySelectorAll('.pdf-page');

    for (let i = 0; i < pdfPages.length; i++) {
      const canvas = await html2canvas(pdfPages[i], {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff'
      });

      const imgData = canvas.toDataURL('image/png');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;

      if (i > 0) pdf.addPage();
      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight, undefined, 'FAST');
    }

    pdf.save(`Reporte_Bienestar_${userName.replace(/\s+/g, '_')}.pdf`);

    // Cleanup
    document.body.removeChild(pdfContainer);

    btns.forEach(btn => {
      btn.innerHTML = '✅ PDF Descargado';
      setTimeout(() => {
        btn.disabled = false;
        btn.innerHTML = btn.dataset.originalText || '📄 Descargar Versión PDF (BETA)';
      }, 3000);
    });

  } catch (error) {
    console.error('Error generating PDF:', error);
    alert('Hubo un error al generar el PDF. Por favor, intenta de nuevo.');
    btns.forEach(btn => {
      btn.disabled = false;
      btn.innerHTML = btn.dataset.originalText || '📄 Descargar Versión PDF (BETA)';
    });
  }
}

async function saveLead(e) {
  e.preventDefault();
  const submitBtn = document.getElementById('submit-lead');
  const leadNameInput = document.getElementById('lead-name');

  submitBtn.disabled = true;
  submitBtn.textContent = 'Enviando...';

  const name = leadNameInput ? leadNameInput.value : userName;
  const email = leadEmail.value;
  const phone = leadPhone.value;

  const leadData = {
    name: name,
    email: email,
    phone: phone,
    biological_age: parseInt(currentReportData?.biologicalAge?.age) || null,
    goal: currentGoal,
    report_data: currentReportData,
    status: 'new'
  };

  try {
    const response = await fetch(`${supabaseUrl}/rest/v1/fuxion_leads`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': supabaseAnonKey,
        'Authorization': `Bearer ${supabaseAnonKey}`,
        'Prefer': 'return=minimal'
      },
      body: JSON.stringify(leadData)
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }

    // Generate WhatsApp Summary Message
    const ageInfo = currentReportData?.biologicalAge ? `Edad Biol: ${currentReportData.biologicalAge.age} (${currentReportData.biologicalAge.badge})` : '';
    const metabolicRes = currentReportData?.metabolicAnalysis ? currentReportData.metabolicAnalysis.substring(0, 150) + "..." : '';

    const waMsg = `¡Hola Camila! 👋 Soy ${name}. Acabo de completar mi evaluación de ${currentGoal} en la web.
    
📌 *Resumen de mi Reporte:*
- ${ageInfo}
- Objetivo: ${currentGoal}
- Análisis: ${metabolicRes}

Me gustaría recibir mi plan detallado en PDF y coordinar mi asesoría. Mi correo es ${email}.`;

    finalWaLink.href = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(waMsg)}`;

    // Show Success UI
    leadFormContent.style.display = 'none';
    leadSuccess.style.display = 'block';

  } catch (error) {
    console.error('Error saving lead:', error);
    alert('Hubo un error al guardar tus datos. Por favor, intenta de nuevo o contacta directamente por WhatsApp.');
    submitBtn.disabled = false;
    submitBtn.textContent = 'Solicitar Reporte Personalizado';
  }
}

// --- Event Listeners ---

leadForm.addEventListener('submit', saveLead);

document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.style.display = 'none');

    btn.classList.add('active');
    const target = document.getElementById(btn.dataset.tab);
    if (target) target.style.display = 'block';
  });
});

closeChat.addEventListener('click', () => { chatModal.style.display = 'none'; });
closeReport.addEventListener('click', () => { reportModal.style.display = 'none'; });

document.querySelectorAll('.goal-card, .start-eval-btn').forEach(el => {
  el.addEventListener('click', (e) => {
    e.preventDefault();
    const title = el.querySelector('.goal-title')?.textContent || 'Bienestar General';
    openChat(title);
  });
});

chatSend.addEventListener('click', handleUserInput);
chatInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') handleUserInput(); });
