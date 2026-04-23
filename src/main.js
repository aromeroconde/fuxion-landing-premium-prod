import './style.css'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { createClient } from '@supabase/supabase-js'

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
       - Salud y Diagnósticos: Hazlo en DOS RONDAS para no saturar:
         * RONDA 1 (Digestivo/Metabólico): Pregunta por Gastritis, Estreñimiento, Helicobacter, Reflujo, Hígado graso, Hipertensión, Diabetes/Glucosa alta, Colesterol/Triglicéridos.
         * RONDA 2 (Físico/Emocional/Otros): Pregunta por Artrosis/Artritis, Dolores, si es Deportista, Grasa visceral, Cálculos riñones, Retención líquidos/Cistitis, Caída de cabello, Ansiedad/Depresión, Sobrepeso, Cirugías, Pérdida de masa muscular.
       - Descanso (Horas y calidad de sueño).
       - Alimentación e Hidratación.
       - Actividad física / Sedentarismo.
       - Estrés y estado emocional.
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
      extractUserAge();
      generateReport();
    } else {
      addMessage(text, true);
    }
  } catch (error) {
    console.error("Gemini Response Error:", error);
    addMessage('Hubo un problema de conexión. Por favor, intenta de nuevo.', true);
  }
}

async function extractUserAge() {
  try {
    const extractionPrompt = "Basado en la conversación anterior, ¿qué edad tiene el usuario? Responde SOLO con el número (ej: 35). Si no lo sabes, responde '??'.";
    const result = await chatSession.sendMessage(extractionPrompt);
    const ageText = result.response.text().trim().match(/\d+/);
    window.userAge = ageText ? ageText[0] : '??';
  } catch (e) {
    window.userAge = '??';
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
          "lifestyleRecommendations": "Consejos integrales sobre sueño y control de estrés...",
          "nutritionTips": [
            { "title": "Tip Nutricional 1", "description": "Pauta de alimentación específica para su bio-disfunción..." },
            { "title": "Tip Nutricional 2", "description": "Pauta de alimentación específica..." }
          ],
          "exerciseTips": [
            { "title": "Movimiento Estratégico 1", "description": "Rutina o ejercicio recomendado..." },
            { "title": "Movimiento Estratégico 2", "description": "Rutina o ejercicio recomendado..." }
          ],
          "productsExtended": [
            { 
              "name": "Producto 1", 
              "fullDescription": "Descripción detallada del producto, sus componentes clave y por qué es vital para su metabolismo...",
              "howToUse": "Instrucciones precisas biomecánicas de consumo..."
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
  const data = currentReportData;
  if (!data) return null;
  const ext = data.pdfExtendedData || {};

  const products = ext.productsExtended || data.products || [];
  const productChunks = [];
  for (let i = 0; i < products.length; i += 2) {
    productChunks.push(products.slice(i, i + 2));
  }

  const finalPages = [
    // Page 1: COVER
    `<div class="pdf-page" style="padding: 0; min-height: 297mm; background: #344a3e; color: white; display: flex; flex-direction: column; overflow: hidden; position: relative;">
      <img src="pdf_cover.png" style="position: absolute; top:0; left:0; width:100%; height:100%; object-fit: cover; opacity: 0.4;">
      <div style="position: relative; z-index: 2; padding: 40mm 25mm; flex: 1; display: flex; flex-direction: column; justify-content: center;">
        <div style="font-size: 14px; letter-spacing: 5px; text-transform: uppercase; margin-bottom: 20px; opacity: 0.8;">Reporte Bio-Individual</div>
        <h1 style="font-size: 64px; margin: 0; line-height: 1.1; font-weight: 800; letter-spacing: -1px;">El Camino a tu <br><span style="color: #c9e2d1;">Mejor Versión</span></h1>
        <div style="width: 80px; height: 4px; background: #c9e2d1; margin: 40px 0;"></div>
        <p style="font-size: 20px; opacity: 0.9; max-width: 80%; line-height: 1.6;">Análisis clínico detallado preparado exclusivamente para <strong>${userName}</strong>.</p>
      </div>
      <div style="position: relative; z-index: 2; padding: 25mm; background: rgba(0,0,0,0.2); backdrop-filter: blur(10px); display: flex; justify-content: space-between; align-items: center;">
        <div>
          <div style="font-size: 12px; opacity: 0.7; text-transform: uppercase;">Emisión</div>
          <div style="font-size: 16px; font-weight: bold;">${new Date().toLocaleDateString()}</div>
        </div>
        <div style="text-align: right;">
          <div style="font-size: 12px; opacity: 0.7; text-transform: uppercase;">Institución</div>
          <div style="font-size: 16px; font-weight: bold;">Advanced Health</div>
        </div>
      </div>
    </div>`,

    // Page 2: CLINICAL DIAGNOSIS
    `<div class="pdf-page" style="padding: 25mm; min-height: 297mm; background: #fff; position: relative;">
      <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 40px;">
        <div>
          <h3 style="color: #344a3e; margin: 0; font-size: 14px; letter-spacing: 2px;">SECCIÓN 01</h3>
          <h2 style="color: #344a3e; margin: 5px 0 0; font-size: 28px;">Diagnóstico Biológico</h2>
        </div>
        <div style="background: #f0f7f2; padding: 15px 25px; border-radius: 15px; text-align: center; border: 1px solid #c9e2d1;">
          <div style="font-size: 10px; color: #344a3e; text-transform: uppercase; letter-spacing: 1px;">Edad Biológica</div>
          <div style="font-size: 32px; font-weight: 800; color: #344a3e;">${data.biologicalAge?.age || 'N/A'}</div>
          <div style="font-size: 12px; font-weight: bold; color: #8c9b8a;">${data.biologicalAge?.badge || ''}</div>
        </div>
      </div>

      <div style="margin-bottom: 40px;">
        <h4 style="color: #344a3e; border-bottom: 1px solid #eee; padding-bottom: 10px; font-size: 16px;">🔬 Análisis Metabólico Profundo</h4>
        <div style="font-size: 13px; line-height: 1.8; color: #444; margin-top: 15px;">${ext.detailedAnalysis || data.metabolicAnalysis}</div>
      </div>

      <div style="margin-bottom: 40px; background: #fbfbfb; padding: 30px; border-radius: 20px;">
        <h4 style="color: #344a3e; margin: 0 0 15px; font-size: 16px;">🧬 Fundamento Bioquímico</h4>
        <div style="font-size: 13px; line-height: 1.8; color: #555;">${ext.biologicalDeepDive || data.bioExplanation}</div>
      </div>
      
      <div style="position: absolute; bottom: 25mm; left: 25mm; right: 25mm; border-top: 1px solid #eee; padding-top: 20px; display: flex; justify-content: space-between; font-size: 10px; color: #999;">
        <span>FuXion Science Labs</span>
        <span>${userName} - Reporte Confidencial</span>
      </div>
    </div>`,

    // Page 3: THE PHILOSOPHY
    `<div class="pdf-page" style="padding: 0; min-height: 297mm; background: #f8f9f8; position: relative; display: flex; flex-direction: column;">
      <div style="height: 35%; position: relative; overflow: hidden;">
        <img src="Lab.png" style="width: 100%; height: 100%; object-fit: cover;">
        <div style="position: absolute; top:0; left:0; width:100%; height:100%; background: linear-gradient(rgba(0,0,0,0.4), transparent);"></div>
      </div>
      <div style="padding: 25mm; flex: 1;">
        <h2 style="color: #344a3e; font-size: 32px; margin-bottom: 20px;">Filosofía de Salud Plena</h2>
        <p style="font-size: 15px; line-height: 1.8; color: #444;">
          En FuXion, entendemos que la salud no es solo la ausencia de enfermedad, sino un estado de vitalidad óptima. 
          Nuestra tecnología de <strong>Fusión Nutracéutica®</strong> combina los conocimientos de culturas ancestrales (Andinas, Amazónicas, Mesoamericanas y Asiáticas) 
          con los últimos avances científicos en biotecnología aplicada a la nutrición humana.
        </p>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 30px; margin-top: 40px;">
          <div style="background: white; border-radius: 12px; height: 180px; overflow: hidden;">
            <img src="Lab.png" style="width: 100%; height: 100%; object-fit: cover;">
          </div>
          <div style="background: white; padding: 20px; border-radius: 12px; box-shadow: 0 4px 10px rgba(0,0,0,0.03);">
            <div style="font-size: 24px; margin-bottom: 10px;">⚡</div>
            <strong style="color: #344a3e;">Nutrición Celular</strong>
            <p style="font-size: 12px; color: #666; margin-top: 5px;">Activamos tu metabolismo con micro-nutrientes vivos.</p>
          </div>
        </div>
      </div>
    </div>`,

    // Page 4: ROADMAP
    `<div class="pdf-page" style="padding: 0; min-height: 297mm; background: #fff; position: relative; display: flex; flex-direction: column;">
      <div style="height: 30%; position: relative; overflow: hidden;">
        <img src="cocina.png" style="width: 100%; height: 100%; object-fit: cover; opacity: 0.8;">
        <div style="position: absolute; top: 0; left: 0; right: 0; bottom: 0; background: linear-gradient(135deg, rgba(52, 74, 62, 0.4), transparent);"></div>
        <div style="position: absolute; bottom: 15px; left: 25mm; color: white; text-shadow: 1px 1px 2px rgba(0,0,0,0.5);">
          <h3 style="margin: 0; font-size: 12px; letter-spacing: 2px;">SECCIÓN 02</h3>
          <h2 style="margin: 5px 0 0; font-size: 24px;">Tu Hoja de Ruta Diaria</h2>
        </div>
      </div>

      <div style="padding: 10mm 25mm; flex: 1;">
        <div style="position: relative; border-left: 2px solid #8c9b8a; padding-left: 30px; margin-left: 10px;">
          <div style="margin-bottom: 25px;">
            <div style="position: absolute; left: -8px; width: 14px; height: 14px; background: #344a3e; border-radius: 50%;"></div>
            <strong style="color: #344a3e; font-size: 15px; text-transform: uppercase;">🌅 Amanecer Vital</strong>
            <p style="font-size: 13px; color: #555; margin: 8px 0 0; line-height: 1.6;">${data.routine?.morning}</p>
          </div>
          <div style="margin-bottom: 25px;">
            <div style="position: absolute; left: -8px; width: 14px; height: 14px; background: #344a3e; border-radius: 50%;"></div>
            <strong style="color: #344a3e; font-size: 15px; text-transform: uppercase;">🌆 Energía de Tarde</strong>
            <p style="font-size: 13px; color: #555; margin: 8px 0 0; line-height: 1.6;">${data.routine?.afternoon}</p>
          </div>
          <div style="margin-bottom: 0;">
            <div style="position: absolute; left: -8px; width: 14px; height: 14px; background: #344a3e; border-radius: 50%;"></div>
            <strong style="color: #344a3e; font-size: 15px; text-transform: uppercase;">🌙 Regeneración Nocturna</strong>
            <p style="font-size: 13px; color: #555; margin: 8px 0 0; line-height: 1.6;">${data.routine?.night}</p>
          </div>
        </div>

        <div style="margin-top: 35px; padding: 25px; background: #f0f7f2; border-radius: 15px; border-left: 5px solid #344a3e;">
          <h4 style="margin: 0 0 10px; color: #344a3e; font-size: 16px;">💡 Recomendaciones de Estilo de Vida</h4>
          <p style="font-size: 13px; line-height: 1.6; color: #444; margin: 0;">${ext.lifestyleRecommendations || 'Prioriza el descanso de 7-8 horas y una hidratación constante durante el día.'}</p>
        </div>
      </div>
    </div>`,

    // Page 5: NUTRITION & EXERCISE
    `<div class="pdf-page" style="padding: 25mm; min-height: 297mm; background: #fff; position: relative;">
      <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 40px;">
        <div>
          <h3 style="color: #344a3e; margin: 0; font-size: 14px; letter-spacing: 2px;">SECCIÓN 03</h3>
          <h2 style="color: #344a3e; margin: 5px 0 0; font-size: 28px;">Bio-Hacking: Nutrición y Ejercicio</h2>
        </div>
      </div>

      <!-- Nutrition Section -->
      <div style="margin-bottom: 35px;">
        <h4 style="color: #344a3e; border-bottom: 2px solid #c9e2d1; padding-bottom: 10px; font-size: 18px; margin-bottom: 20px;">🥗 Hacks Nutricionales</h4>
        <div style="display: flex; flex-direction: column; gap: 15px;">
          ${ext.nutritionTips ? ext.nutritionTips.map(tip => `
            <div style="background: #fcfdfc; padding: 20px; border-radius: 12px; border-left: 4px solid #d4af37; box-shadow: 0 3px 10px rgba(0,0,0,0.02);">
              <strong style="color: #344a3e; font-size: 15px; display: block; margin-bottom: 5px;">${tip.title}</strong>
              <p style="font-size: 13px; color: #555; margin: 0; line-height: 1.6;">${tip.description}</p>
            </div>
          `).join('') : '<p style="font-size: 13px; color: #555;">Sigue las recomendaciones nutricionales de tu asesor.</p>'}
        </div>
      </div>

      <!-- Exercise Section -->
      <div style="margin-bottom: 30px;">
        <h4 style="color: #344a3e; border-bottom: 2px solid #c9e2d1; padding-bottom: 10px; font-size: 18px; margin-bottom: 20px;">⚡ Movimiento Estratégico</h4>
        <div style="display: flex; flex-direction: column; gap: 15px;">
          ${ext.exerciseTips ? ext.exerciseTips.map(tip => `
            <div style="background: #f0f7f2; padding: 20px; border-radius: 12px; border-left: 4px solid #8c9b8a; box-shadow: 0 3px 10px rgba(0,0,0,0.02);">
              <strong style="color: #344a3e; font-size: 15px; display: block; margin-bottom: 5px;">${tip.title}</strong>
              <p style="font-size: 13px; color: #555; margin: 0; line-height: 1.6;">${tip.description}</p>
            </div>
          `).join('') : '<p style="font-size: 13px; color: #555;">Inicia con 30 minutos de actividad cardiovascular diaria.</p>'}
        </div>
      </div>

      <div style="position: absolute; bottom: 25mm; left: 25mm; right: 25mm; border-top: 1px solid #eee; padding-top: 20px; display: flex; justify-content: space-between; font-size: 10px; color: #999;">
        <span>FuXion Science Labs</span>
        <span>Optimizando tu Rendimiento</span>
      </div>
    </div>`
  ];

  // Dynamically add Product Pages (Section 04)
  productChunks.forEach((chunk, pageIdx) => {
    finalPages.push(`
    <div class="pdf-page" style="padding: 25mm; min-height: 297mm; background: #f8f9f8; position: relative;">
        <div style="margin-bottom: 35px; border-bottom: 2px solid #344a3e; padding-bottom: 20px;">
          <h3 style="color: #344a3e; margin: 0; font-size: 14px; letter-spacing: 2px;">SECCIÓN 04 ${productChunks.length > 1 ? `(Pág. ${pageIdx + 1})` : ''}</h3>
          <h2 style="color: #344a3e; margin: 5px 0 0; font-size: 28px;">Tu Kit Nutracéutico Sugerido</h2>
        </div>

        <div style="display: flex; flex-direction: column; gap: 20px;">
          ${chunk.map((p) => `
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

        ${pageIdx === productChunks.length - 1 ? `
          <div style="position: absolute; bottom: 25mm; left: 25mm; right: 25mm; text-align: center;">
            <div style="width: 60px; height: 3px; background: #344a3e; margin: 0 auto 20px;"></div>
            <p style="font-size: 11px; color: #8c9b8a; line-height: 1.5; margin-bottom: 5px;">
              Este reporte es informativo y no pretende diagnosticar, tratar o curar enfermedades. Ante cualquier condición médica, consulte a su médico.
            </p>
            <p style="font-size: 11px; color: #8c9b8a; line-height: 1.5; margin-bottom: 15px;">
              La nutrición avanzada es un complemento de un estilo de vida saludable.
            </p>
            <div style="display: flex; justify-content: center; gap: 20px; align-items: center;">
              <span style="font-size: 14px; color: #344a3e; font-weight: bold; letter-spacing: 3px;">FuXion</span>
              <span style="width: 1px; height: 20px; background: #ddd;"></span>
              <span style="font-size: 14px; color: #344a3e; font-weight: bold; letter-spacing: 3px;">Advanced Health</span>
            </div>
          </div>
        ` : `
          <div style="position: absolute; bottom: 25mm; right: 25mm; font-size: 12px; color: #8c9b8a;">
            Continúa en la siguiente página →
          </div>
        `}
      </div >
    `);
  });

  const rawStyle = `
    @import url('https://fonts.googleapis.com/css2?family=Helvetica+Neue:wght@400;700;800&display=swap');
    
    * { box-sizing: border-box; }
    body { margin: 0; padding: 0; font-family: 'Helvetica Neue', Arial, sans-serif; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    h1, h2, h3, h4, h5, h6 { font-family: 'Helvetica Neue', Arial, sans-serif; font-weight: 800; }
  `;

  const combinedHtml = `
    <!DOCTYPE html>
    <html lang="es">
    <head>
      <meta charset="UTF-8">
      <style>
        ${rawStyle}
        body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; margin: 0; padding: 0; background: #fff; }
        .pdf-page {
          width: 8.5in;
          height: 11in;
          box-sizing: border-box;
          page-break-after: always;
          overflow: hidden;
          background: #fff;
        }
      </style>
    </head>
    <body>
      ${finalPages.join('')}
    </body>
    </html>
  `;

  const gotenbergUrl = '/gotenberg-api';
  const basicAuthUser = import.meta.env.VITE_GOTENBERG_USERNAME?.replace(/^"|"$/g, '');
  const basicAuthPass = import.meta.env.VITE_GOTENBERG_PASSWORD?.replace(/^"|"$/g, '');

  const headers = {};
  if (basicAuthUser && basicAuthPass) {
    headers['Authorization'] = 'Basic ' + btoa(basicAuthUser + ':' + basicAuthPass);
  }

  const formData = new FormData();
  formData.append('files', new Blob([combinedHtml], { type: 'text/html' }), 'index.html');

  try {
    const [coverRes, labRes, cocinaRes] = await Promise.all([
      fetch('/images/pdf_cover.png'),
      fetch('/images/Lab.png'),
      fetch('/images/cocina.png')
    ]);
    if (coverRes.ok) formData.append('files', await coverRes.blob(), 'pdf_cover.png');
    if (labRes.ok) formData.append('files', await labRes.blob(), 'Lab.png');
    if (cocinaRes.ok) formData.append('files', await cocinaRes.blob(), 'cocina.png');
  } catch (err) {
    console.error('Error fetching images for PDF:', err);
  }

  formData.append('paperWidth', '8.5');
  formData.append('paperHeight', '11');
  formData.append('marginTop', '0');
  formData.append('marginBottom', '0');
  formData.append('marginLeft', '0');
  formData.append('marginRight', '0');
  formData.append('printBackground', 'true');

  const res = await fetch(`${gotenbergUrl}/forms/chromium/convert/html`, {
    method: 'POST',
    headers,
    body: formData
  });

  if (!res.ok) {
    console.error('Gotenberg API error', await res.text());
    throw new Error('No se pudo generar el reporte premium con Gotenberg.');
  }

  return await res.blob();
}

async function downloadPDF() {
  const btns = document.querySelectorAll('.download-pdf-btn');
  const data = currentReportData;
  if (!data) {
    alert('No hay datos suficientes para generar el PDF. Por favor, realiza la evaluación de nuevo.');
    return;
  }

  // Si ya tenemos una URL de Supabase generada en saveLead, la usamos directamente
  if (window.lastGeneratedPdfUrl) {
    console.log('Descargando PDF desde URL existente:', window.lastGeneratedPdfUrl);
    window.open(window.lastGeneratedPdfUrl, '_blank');
    return;
  }

  // Fallback en caso de que saveLead haya fallado al subir pero queramos intentar generar localmente
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
  const leadEmail = document.getElementById('lead-email');
  const leadPhone = document.getElementById('lead-phone');

  submitBtn.disabled = true;
  submitBtn.textContent = 'Procesando...';

  const name = leadNameInput ? leadNameInput.value.trim() : userName;
  const email = leadEmail.value.trim();
  const phone = leadPhone.value.trim();

  // --- Validación Interna Robusta ---
  if (name.length < 3) {
    alert("Por favor, ingresa tu nombre completo (mínimo 3 caracteres).");
    submitBtn.disabled = false;
    submitBtn.textContent = 'Solicitar Reporte Personalizado';
    return;
  }

  const emailRegex = /^[\w-\.]+@([\w-]+\.)+[\w-]{2,4}$/;
  if (!emailRegex.test(email)) {
    alert("Por favor, ingresa un correo electrónico válido.");
    submitBtn.disabled = false;
    submitBtn.textContent = 'Solicitar Reporte Personalizado';
    return;
  }

  const phoneRegex = /^\d{7,15}$/;
  if (!phoneRegex.test(phone)) {
    alert("Por favor, ingresa un número de teléfono válido (solo números, entre 7 y 15 dígitos).");
    submitBtn.disabled = false;
    submitBtn.textContent = 'Solicitar Reporte Personalizado';
    return;
  }

  userName = name;

  try {
    // --- 1. Generar y Subir PDF Primero ---
    let pdfUrl = null;
    try {
      console.log('--- Iniciando Procesamiento de PDF ---');
      submitBtn.textContent = 'Personalizando tu Plan... ⏳';
      const pdfBlob = await generatePDFAttachment();
      const fileName = `Reporte_${name.replace(/\s+/g, '_')}_${Date.now()}.pdf`;

      submitBtn.textContent = 'Guardando en la Nube... ☁️';
      pdfUrl = await uploadPDFToStorage(pdfBlob, fileName);
    } catch (pdfErr) {
      console.error('Error crítico procesando PDF:', pdfErr);
    }

    // Guardar para el botón de descarga instantánea en la UI de éxito
    window.lastGeneratedPdfUrl = pdfUrl;

    // --- 2. Preparar Datos para Supabase (incluyendo pdf_url) ---
    const leadData = {
      name: name,
      email: email,
      phone: phone,
      biological_age: parseInt(currentReportData?.biologicalAge?.age) || null,
      goal: currentGoal,
      report_data: currentReportData,
      pdf_url: pdfUrl,
      status: 'new'
    };

    // --- 3. Guardar en Supabase ---
    submitBtn.textContent = 'Registrando Diagnóstico... 📑';
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

    // --- 4. Enviar Notificaciones ---
    submitBtn.textContent = 'Enviando Reporte por Email... 📧';
    await sendLeadEmails(leadData, pdfUrl);

    // Actualizar link de WhatsApp con mensaje de alta conversión enfocado en Hallazgos + Productos
    const productList = currentReportData?.products?.map(p => `• * ${p.name} * `).join('\n') || '• Kit Personalizado';
    const waGoal = currentGoal || 'Mejorar mi Salud';
    const waBadge = currentReportData?.biologicalAge?.badge || 'Alerta Metabólica';
    const realAgeNum = window.userAge || '??';
    const bioAgeNum = currentReportData?.biologicalAge?.age || '??';

    const waMsg = `¡Hola Camila! 🧬 Soy ${name}.Acabo de terminar mi análisis de salud en la web y me urge empezar.\n\n📌 * RESUMEN DE MI DIAGNÓSTICO:*\n• * Meta:* ${waGoal}\n• * Estado:* ${waBadge}(Edad Real: ${realAgeNum} - Biol: ${bioAgeNum}) \n\n📦 * MI KIT RECOMENDADO:*\n${productList}\n\nCamila, necesito que me asesores para empezar con estos productos.Mi correo es ${email}.`;

    if (finalWaLink) {
      finalWaLink.href = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(waMsg)}`;
    }

    // Mostrar Pantalla de Éxito
    leadFormContent.style.display = 'none';
    leadSuccess.style.display = 'block';

  } catch (error) {
    console.error('Error saving lead:', error);
    alert(`Lo sentimos, ocurrió un error al guardar tu reporte: ${error.message}. Por favor, toma una captura de pantalla e intenta de nuevo.`);
  } finally {
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
    console.log(`Subiendo PDF (${pdfBlob.size} bytes) a Supabase Storage...`);
    const { data, error } = await supabase.storage
      .from('reports-fuxion')
      .upload(fileName, pdfBlob, {
        cacheControl: '3600',
        upsert: true
      });

    if (error) {
      console.error('Error de subida Supabase (Detalle):', error);
      throw error;
    }

    console.log('Subida exitosa, obteniendo URL pública para:', fileName);
    const { data: { publicUrl } } = supabase.storage
      .from('reports-fuxion')
      .getPublicUrl(fileName);

    console.log('URL Pública obtenida:', publicUrl);
    return publicUrl;
  } catch (err) {
    console.error('Supabase Storage Exception:', err);
    return null;
  }
}

// --- Event Listeners ---

// Handle all PDF download buttons (including the one in success UI)
document.querySelectorAll('.pdf-download-btn').forEach(btn => {
  btn.addEventListener('click', downloadPDF);
});

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
