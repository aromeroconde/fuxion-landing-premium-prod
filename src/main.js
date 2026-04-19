import './style.css'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { createClient } from '@supabase/supabase-js'
import { jsPDF } from 'jspdf'
import html2canvas from 'html2canvas'
import emailjs from '@emailjs/browser'

// --- Supabase Config ---
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY
const supabase = createClient(supabaseUrl, supabaseAnonKey)

// EmailJS Configuration
const EMAILJS_SERVICE_ID = import.meta.env.VITE_EMAILJS_SERVICE_ID
const EMAILJS_PUBLIC_KEY = import.meta.env.VITE_EMAILJS_PUBLIC_KEY
const EMAILJS_CUSTOMER_TEMPLATE = import.meta.env.VITE_EMAILJS_CUSTOMER_TEMPLATE
const EMAILJS_TEAM_TEMPLATE = import.meta.env.VITE_EMAILJS_TEAM_TEMPLATE

if (EMAILJS_PUBLIC_KEY && EMAILJS_PUBLIC_KEY !== 'YOUR_PUBLIC_KEY') {
  emailjs.init(EMAILJS_PUBLIC_KEY);
}

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

const WHATSAPP_NUMBER = import.meta.env.VITE_WHATSAPP_NUMBER || '573007044302';

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
       - Edad/Peso/Sexo y ESTATURA. (IMPORTANTE: Solo atender a personas de 15 años o más. Si es menor, dile amablemente que por ahora solo puedes asesorar a mayores de 15 años).
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
      Considéra su relación PESO/ESTATURA para dar un diagnóstico preciso.
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

  } catch (error) {
    console.error('Report Generation Error:', error);
    addMessage('Hubo un problema al generar el tablero visual. Por favor, hablemos por WhatsApp para darte los resultados.', true);
  }
}

async function generatePDFAttachment() {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const pdfContainer = document.createElement('div');
  pdfContainer.id = 'print-template';
  pdfContainer.style.position = 'fixed';
  pdfContainer.style.left = '-9999px';
  pdfContainer.style.top = '0';
  pdfContainer.style.width = '210mm'; // A4 Width
  pdfContainer.style.backgroundColor = '#ffffff';
  pdfContainer.style.fontFamily = "'Segoe UI', Roboto, sans-serif";

  const data = currentReportData;
  const ext = data.pdfExtendedData || {};
  const today = new Date().toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' });

  // Helper for gauge color
  const getGaugeColor = (age) => {
    if (age <= 25) return '#2e7d32'; // Optimal
    if (age <= 40) return '#f9a825'; // Warning
    return '#c62828'; // Critical
  };

  const sections = [
    // Page 1: COVER PAGE
    `<div class="pdf-page" style="padding: 0; min-height: 297mm; display: flex; flex-direction: column; position: relative; background: #344a3e;">
      <div style="height: 60%; width: 100%; position: relative; overflow: hidden;">
        <img src="/images/pdf_cover.png" style="width: 100%; height: 100%; object-fit: cover; opacity: 0.8;">
        <div style="position: absolute; bottom: 0; left: 0; right: 0; height: 150px; background: linear-gradient(transparent, #344a3e);"></div>
      </div>
      
      <div style="padding: 40px; color: white; flex-grow: 1; display: flex; flex-direction: column; justify-content: center; text-align: left;">
        <h1 style="font-size: 48px; margin: 0; font-weight: 800; line-height: 1;">REPORTE DE<br>BIENESTAR</h1>
        <div style="width: 60px; height: 6px; background: #8c9b8a; margin: 25px 0;"></div>
        <p style="font-size: 20px; text-transform: uppercase; letter-spacing: 2px; color: #8c9b8a; margin-bottom: 40px;">Evaluación Nutracéutica de Alta Precisión</p>
        
        <div style="margin-top: auto;">
          <p style="font-size: 16px; margin: 0; opacity: 0.7;">PREPARADO PARA:</p>
          <h2 style="font-size: 32px; margin: 5px 0 0;">${userName}</h2>
          <p style="font-size: 14px; margin: 10px 0 0; color: #8c9b8a;">${today}</p>
        </div>
      </div>
      
      <div style="padding: 20px 40px; background: rgba(0,0,0,0.2); display: flex; justify-content: space-between; align-items: center;">
         <span style="font-size: 12px; letter-spacing: 1px;">FU XION / ADVANCED HEALTH</span>
         <span style="font-size: 12px; opacity: 0.5;">© 2026 CLINICAL SERIES</span>
      </div>
    </div>`,

    // Page 2: BIOLOGICAL ANALYSIS & GAUGE
    `<div class="pdf-page" style="padding: 25mm; min-height: 297mm; background: #fff;">
      <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 40px;">
        <div>
          <h3 style="color: #344a3e; margin: 0; font-size: 14px; letter-spacing: 2px;">SECCIÓN 01</h3>
          <h2 style="color: #344a3e; margin: 5px 0 0; font-size: 28px;">Diagnóstico Biológico</h2>
        </div>
        <div style="text-align: right;">
           <div style="font-size: 12px; color: #8c9b8a;">ESTADO DE SALUD</div>
           <div style="font-size: 14px; font-weight: bold; color: ${getGaugeColor(data.biologicalAge.age)};">${data.biologicalAge.badge}</div>
        </div>
      </div>

      <div style="display: flex; gap: 30px; align-items: center; background: #f8f9f8; padding: 30px; border-radius: 20px; margin-bottom: 40px;">
        <div style="flex: 1; text-align: center; position: relative;">
          <div style="font-size: 80px; font-weight: 800; color: #344a3e; line-height: 1;">${data.biologicalAge.age}</div>
          <div style="font-size: 12px; color: #8c9b8a; letter-spacing: 2px;">EDAD BIOLÓGICA</div>
        </div>
        <div style="flex: 2;">
          <h4 style="margin: 0 0 10px; color: #344a3e;">¿Qué significa esto?</h4>
          <p style="font-size: 13px; line-height: 1.6; color: #555; margin: 0;">${ext.biologicalDeepDive || data.bioExplanation}</p>
        </div>
      </div>

      <div style="margin-bottom: 40px;">
        <h3 style="color: #344a3e; border-bottom: 1px solid #eee; padding-bottom: 15px; font-size: 18px;">🧬 Análisis Situacional</h3>
        <p style="line-height: 1.8; color: #333; font-size: 14px; text-align: justify; margin-top: 20px;">${ext.detailedAnalysis || data.metabolicAnalysis}</p>
      </div>

      <div style="background: #344a3e; color: white; padding: 25px; border-radius: 15px;">
        <h4 style="margin: 0 0 10px; color: #8c9b8a; font-size: 14px;">NOTA CLÍNICA</h4>
        <p style="font-size: 13px; line-height: 1.5; margin: 0; opacity: 0.9;">Tu cuerpo está enviando señales claras a través de tus indicadores metabólicos. Este reporte es el primer paso para corregir la trayectoria biológica y optimizar tu rendimiento sistémico.</p>
      </div>
    </div>`,

    // Page 3: SCIENCE & PHILOSOPHY (FuXion)
    `<div class="pdf-page" style="padding: 0; min-height: 297mm; background: #fff; position: relative;">
      <div style="height: 35%; position: relative;">
        <img src="/images/pdf_science.png" style="width: 100%; height: 100%; object-fit: cover;">
        <div style="position: absolute; top: 0; left: 0; right: 0; bottom: 0; background: rgba(52, 74, 62, 0.4);"></div>
        <div style="position: absolute; bottom: 30px; left: 25mm; color: white;">
          <h3 style="margin: 0; font-size: 14px; letter-spacing: 2px;">LA CIENCIA DETRÁS</h3>
          <h2 style="margin: 5px 0 0; font-size: 32px;">Filosofía FuXion</h2>
        </div>
      </div>

      <div style="padding: 25mm;">
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 40px;">
          <div>
            <h4 style="color: #344a3e; font-size: 18px; margin-bottom: 15px;">El Poder de los Nutracéuticos</h4>
            <p style="font-size: 13px; line-height: 1.7; color: #555; text-align: justify;">
              En FuXion, rescatamos conocimientos ancestrales de culturas milenarias (Amazónicas, Andinas y Orientales) y los fusionamos con la biotecnología moderna. 
              Extraemos solo el <strong>principio activo</strong> de las plantas y frutas, eliminando azúcares y rellenos innecesarios.
            </p>
          </div>
          <div>
            <h4 style="color: #344a3e; font-size: 18px; margin-bottom: 15px;">Advanced Health</h4>
            <p style="font-size: 13px; line-height: 1.7; color: #555; text-align: justify;">
              Como tu socio en bienestar integral, Advanced Health utiliza herramientas de personalización avanzadas para asegurar que cada recomendación se alinee perfectamente con tus metas de vitalidad y longevidad.
            </p>
          </div>
        </div>

        <div style="margin-top: 50px; border-top: 1px solid #eee; padding-top: 40px;">
          <div style="background: #f8f9f8; padding: 25px; border-radius: 10px; display: flex; align-items: center; gap: 20px;">
             <div style="font-size: 30px;">🧪</div>
             <div>
               <h4 style="margin: 0; color: #344a3e;">Nuestra Promesa</h4>
               <p style="font-size: 12px; color: #666; margin: 5px 0 0;">Certificaciones Clean Label: Productos 100% naturales, sin GMO, ni colorantes artificiales. Ciencia pura en cada sobre.</p>
             </div>
          </div>
        </div>
      </div>
    </div>`,

    // Page 4: PERSONALIZED ROADMAP
    `<div class="pdf-page" style="padding: 0; min-height: 297mm; background: #fff; position: relative;">
      <div style="height: 25%; position: relative;">
        <img src="/images/pdf_lifestyle.png" style="width: 100%; height: 100%; object-fit: cover; opacity: 0.7;">
        <div style="position: absolute; top: 0; left: 0; right: 0; bottom: 0; background: linear-gradient(135deg, rgba(52, 74, 62, 0.8), transparent);"></div>
        <div style="position: absolute; bottom: 30px; left: 25mm; color: white;">
          <h3 style="margin: 0; font-size: 14px; letter-spacing: 2px;">SECCIÓN 02</h3>
          <h2 style="margin: 5px 0 0; font-size: 32px;">Tu Hoja de Ruta Diaria</h2>
        </div>
      </div>

      <div style="padding: 20mm 25mm;">
        <div style="position: relative; border-left: 2px solid #8c9b8a; padding-left: 30px; margin-left: 10px;">
          <div style="margin-bottom: 30px;">
            <div style="position: absolute; left: -8px; width: 14px; height: 14px; background: #344a3e; border-radius: 50%;"></div>
            <strong style="color: #344a3e; font-size: 15px; text-transform: uppercase;">🌅 Amanecer Vital</strong>
            <p style="font-size: 13px; color: #555; margin: 8px 0 0; line-height: 1.6;">${data.routine.morning}</p>
          </div>
          <div style="margin-bottom: 30px;">
            <div style="position: absolute; left: -8px; width: 14px; height: 14px; background: #344a3e; border-radius: 50%;"></div>
            <strong style="color: #344a3e; font-size: 15px; text-transform: uppercase;">🍛 Nutrición Meridiana</strong>
            <p style="font-size: 13px; color: #555; margin: 8px 0 0; line-height: 1.6;">${data.routine.noon || 'Mantén un almuerzo rico en fibras y proteínas magras.'}</p>
          </div>
          <div style="margin-bottom: 30px;">
            <div style="position: absolute; left: -8px; width: 14px; height: 14px; background: #344a3e; border-radius: 50%;"></div>
            <strong style="color: #344a3e; font-size: 15px; text-transform: uppercase;">🌆 Energía de Tarde</strong>
            <p style="font-size: 13px; color: #555; margin: 8px 0 0; line-height: 1.6;">${data.routine.afternoon}</p>
          </div>
          <div style="margin-bottom: 0;">
            <div style="position: absolute; left: -8px; width: 14px; height: 14px; background: #344a3e; border-radius: 50%;"></div>
            <strong style="color: #344a3e; font-size: 15px; text-transform: uppercase;">🌙 Regeneración Nocturna</strong>
            <p style="font-size: 13px; color: #555; margin: 8px 0 0; line-height: 1.6;">${data.routine.night}</p>
          </div>
        </div>

        <div style="margin-top: 40px; padding: 25px; background: #f0f7f2; border-radius: 15px; border-left: 5px solid #344a3e;">
          <h4 style="margin: 0 0 10px; color: #344a3e; font-size: 16px;">💡 Recomendaciones de Estilo de Vida</h4>
          <p style="font-size: 13px; line-height: 1.6; color: #444; margin: 0;">${ext.lifestyleRecommendations || 'Prioriza el descanso de 7-8 horas y una hidratación constante durante el día.'}</p>
        </div>
      </div>
    </div>`,

    // Page 5: NUTRACEUTICAL KIT
    `<div class="pdf-page" style="padding: 25mm; min-height: 297mm; background: #f8f9f8; position: relative;">
      <div style="margin-bottom: 35px; border-bottom: 2px solid #344a3e; padding-bottom: 20px;">
        <h3 style="color: #344a3e; margin: 0; font-size: 14px; letter-spacing: 2px;">SECCIÓN 03</h3>
        <h2 style="color: #344a3e; margin: 5px 0 0; font-size: 28px;">Tu Kit Nutracéutico Sugerido</h2>
      </div>

      <div style="display: flex; flex-direction: column; gap: 20px;">
        ${(ext.productsExtended || data.products).map((p, idx) => `
          <div style="background: #fff; border-radius: 12px; padding: 25px; box-shadow: 0 4px 15px rgba(0,0,0,0.05); position: relative; overflow: hidden;">
            <div style="position: absolute; top: 0; left: 0; width: 5px; height: 100%; background: #344a3e;"></div>
            <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 12px;">
              <strong style="color: #344a3e; font-size: 22px;">${p.name}</strong>
              <span style="font-size: 10px; color: #8c9b8a; font-weight: bold; text-transform: uppercase;">Aliado Principal</span>
            </div>
            <p style="font-size: 13px; color: #555; margin: 0 0 15px; line-height: 1.6;">${p.fullDescription || p.benefit}</p>
            <div style="background: #f0f7f2; padding: 12px; border-radius: 8px; display: flex; align-items: center; gap: 10px;">
               <span style="font-size: 18px;">🔔</span>
               <div>
                 <strong style="font-size: 11px; color: #344a3e;">PROTOCOLO DE USO</strong>
                 <p style="font-size: 12px; color: #444; margin: 0;">${p.howToUse || 'Consultar guía de empaque.'}</p>
               </div>
            </div>
          </div>
        `).join('')}
      </div>

      <div style="position: absolute; bottom: 25mm; left: 25mm; right: 25mm; text-align: center;">
        <div style="width: 60px; height: 3px; background: #344a3e; margin: 0 auto 20px;"></div>
        <p style="font-size: 11px; color: #8c9b8a; line-height: 1.5; margin-bottom: 15px;">
          Este reporte clínico digital optimiza funciones biológicas a través de nutrición avanzada.
        </p>
        <div style="display: flex; justify-content: center; gap: 20px; align-items: center;">
          <span style="font-size: 14px; color: #344a3e; font-weight: bold; letter-spacing: 3px;">FU XION</span>
          <span style="width: 1px; height: 20px; background: #ddd;"></span>
          <span style="font-size: 14px; color: #344a3e; font-weight: bold; letter-spacing: 3px;">ADVANCED HEALTH</span>
        </div>
      </div>
    </div>`
  ];

  document.body.appendChild(pdfContainer);

  for (let i = 0; i < sections.length; i++) {
    pdfContainer.innerHTML = sections[i];
    // We add a delay to ensure heavy images load/render
    await new Promise(r => setTimeout(r, 200));
    const canvas = await html2canvas(pdfContainer, {
      scale: 2,
      useCORS: true,
      backgroundColor: '#ffffff'
    });
    const imgData = canvas.toDataURL('image/jpeg', 0.90);

    if (i > 0) doc.addPage();
    doc.addImage(imgData, 'JPEG', 0, 0, 210, 297, undefined, 'FAST');
  }

  document.body.removeChild(pdfContainer);
  return doc.output('blob');
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
    btn.innerHTML = '⏳ Generando Reporte Premium...';
  });

  try {
    const pdfBlob = await generatePDFAttachment();
    const url = URL.createObjectURL(pdfBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Reporte_Bienestar_${userName.replace(/\s+/g, '_')}.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    btns.forEach(btn => {
      btn.innerHTML = '✅ Reporte Generado';
      setTimeout(() => {
        btn.disabled = false;
        btn.innerHTML = btn.dataset.originalText || '📄 Descargar Versión PDF';
      }, 3000);
    });

  } catch (error) {
    console.error('Error generating PDF:', error);
    alert('Hubo un error al generar el PDF. Por favor, intenta de nuevo.');
    btns.forEach(btn => {
      btn.disabled = false;
      btn.innerHTML = btn.dataset.originalText || '📄 Descargar Versión PDF';
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

    // Generate and Upload PDF for Email Link
    let pdfUrl = null;
    try {
      console.log('--- Iniciando Procesamiento de PDF ---');
      submitBtn.textContent = 'Enviando a Storage... ☁️';
      const pdfBlob = await generatePDFAttachment();
      const fileName = `Reporte_${name.replace(/\s+/g, '_')}_${Date.now()}.pdf`;
      pdfUrl = await uploadPDFToStorage(pdfBlob, fileName);
    } catch (pdfErr) {
      console.error('Error crítico procesando PDF:', pdfErr);
    }

    // Trigger Automated Emailing
    submitBtn.textContent = 'Enviando Email... 📧';
    await sendLeadEmails(leadData, pdfUrl);

    // Show Success UI
    leadFormContent.style.display = 'none';
    leadSuccess.style.display = 'block';

  } catch (error) {
    console.error('Error saving lead:', error);
    alert('Ocurrió un error. Por favor intenta de nuevo o contacta por WhatsApp.');
  } finally {
    const submitBtn = document.getElementById('submit-lead');
    submitBtn.disabled = false;
    submitBtn.textContent = 'Solicitar Reporte Personalizado';
  }
}

async function sendLeadEmails(leadData, pdfUrl) {
  if (!EMAILJS_PUBLIC_KEY || EMAILJS_PUBLIC_KEY === 'YOUR_PUBLIC_KEY') {
    console.warn('EmailJS: No se han configurado los IDs reales en el archivo .env. Los correos no se enviarán.');
    return;
  }

  try {
    // 1. Notificación al Equipo (contacto@advancedhealth.com.co)
    await emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEAM_TEMPLATE, {
      team_email: 'contacto@advancedhealth.com.co',
      lead_name: leadData.name,
      lead_email: leadData.email,
      lead_phone: leadData.phone,
      lead_goal: leadData.goal,
      biological_age: leadData.biological_age,
      metabolic_analysis: leadData.report_data?.metabolicAnalysis?.substring(0, 500),
      pdf_url: pdfUrl // Link to the PDF in Supabase Storage
    });

    // 2. Reporte al Cliente
    await emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_CUSTOMER_TEMPLATE, {
      user_name: leadData.name,
      user_email: leadData.email,
      goal: leadData.goal,
      biological_age: leadData.biological_age,
      analysis: leadData.report_data?.metabolicAnalysis,
      routine_morning: leadData.report_data?.routine?.morning,
      routine_noon: leadData.report_data?.routine?.noon,
      routine_afternoon: leadData.report_data?.routine?.afternoon,
      routine_night: leadData.report_data?.routine?.night,
      product_suggestions: leadData.report_data?.products?.map(p => p.name).join(', '),
      pdf_url: pdfUrl // Link to the PDF in Supabase Storage
    });

    console.log('Emails sent successfully via EmailJS with PDF link');
  } catch (error) {
    console.error('EmailJS Error:', error);
  }
}

/**
 * Uploads a PDF to Supabase Storage and returns the public URL.
 */
async function uploadPDFToStorage(pdfBlob, fileName) {
  try {
    const { data, error } = await supabase.storage
      .from('reports-fuxion')
      .upload(fileName, pdfBlob, {
        cacheControl: '3600',
        upsert: true
      });

    if (error) {
      console.error('Error de subida Supabase:', error.message);
      throw error;
    }

    const { data: { publicUrl } } = supabase.storage
      .from('reports-fuxion')
      .getPublicUrl(fileName);

    return publicUrl;
  } catch (err) {
    console.error('Supabase Storage Exception:', err);
    return null;
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
