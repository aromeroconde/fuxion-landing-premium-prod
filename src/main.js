import './style.css'
import { GoogleGenerativeAI } from '@google/generative-ai'

// --- Chatbot Logic ---

const API_KEY = import.meta.env.VITE_GEMINI_API_KEY
const MODEL_NAME = import.meta.env.VITE_GEMINI_MODEL || 'gemini-2.0-flash'

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

let userData = {
  goal: '',
  biodata: '', // Age, Weight, Height, Gender
  sleep: '',   // Hours, quality
  nutrition: '', // Processed, focus, hydration
  activity: '', // Strength, cardio, sitting
  mental: '',   // Stress, purpose
  habits: ''    // Alcohol/Tabaco, main obstacle
}

let currentStep = 0
const steps = [
  {
    field: 'biodata',
    question: (goal) => `¡Excelente elección! Veo que te interesa mejorar tu **${goal}**. Para empezar, cuéntame: ¿Qué edad tienes, cuánto mides y pesas? (ej: 35 años, 170cm, 75kg)`
  },
  {
    field: 'sleep',
    question: () => `Perfecto. Hablemos de tu descanso: ¿Cuántas horas duermes en promedio y cómo calificarías la calidad de tu sueño del 1 al 10?`
  },
  {
    field: 'nutrition',
    question: () => `Entendido. Sobre tu alimentación: ¿Consumes alimentos procesados frecuentemente? ¿Cuánta agua bebes al día?`
  },
  {
    field: 'activity',
    question: () => `¡Muy bien! ¿Cómo es tu actividad física? ¿Haces ejercicio de fuerza o cardio? ¿Pasas muchas horas sentado?`
  },
  {
    field: 'mental',
    question: () => `Casi terminamos. ¿Cómo calificarías tu nivel de estrés diario y qué tal sientes tu sentido de propósito o conexión social?`
  },
  {
    field: 'habits',
    question: () => `Por último: ¿Consumes alcohol o tabaco con frecuencia? ¿Y cuál crees que es tu mayor obstáculo para lograr tu meta de ${userData.goal}?`
  }
]

function addMessage(text, isBot = true, isHTML = false) {
  const msgDiv = document.createElement('div')
  msgDiv.className = `msg ${isBot ? 'msg-bot' : 'msg-user'}`
  if (isHTML) {
    msgDiv.innerHTML = text
  } else {
    msgDiv.textContent = text
  }
  chatMessages.appendChild(msgDiv)
  chatMessages.scrollTop = chatMessages.scrollHeight
}

function openChat(goalTitle) {
  chatModal.style.display = 'flex'
  chatMessages.innerHTML = ''
  userData.goal = goalTitle
  currentStep = 0
  addMessage(steps[0].question(goalTitle))
}

async function handleUserInput() {
  const input = chatInput.value.trim()
  if (!input) return

  chatInput.value = ''
  addMessage(input, false)

  if (currentStep < steps.length) {
    const field = steps[currentStep].field
    userData[field] = input
    currentStep++

    if (currentStep < steps.length) {
      setTimeout(() => {
        addMessage(steps[currentStep].question())
      }, 600)
    } else {
      generateReport()
    }
  }
}

async function generateReport() {
  addMessage('🧬 Analizando tus marcadores biológicos y metas de bienestar...', true)

  if (!model) {
    setTimeout(() => {
      addMessage('Lo siento, el sistema de IA no está configurado (falta API Key). Por favor, contacta a un especialista por WhatsApp para tu diagnóstico.', true)
    }, 1500)
    return
  }

  try {
    const prompt = `
      Eres un Asesor de Bienestar de Élite de FuXion y Advanced Health. 
      Basado en este perfil profundo:
      - Meta Principal: ${userData.goal}
      - Bio Data: ${userData.biodata}
      - Sueño: ${userData.sleep}
      - Nutrición: ${userData.nutrition}
      - Actividad: ${userData.activity}
      - Equilibrio Mental: ${userData.mental}
      - Hábitos y Obstáculos: ${userData.habits}

      Genera un REPORTE DE BIENESTAR PREMIUM en HTML (solo el contenido interno) con este orden:
      1. EDAD BIOLÓGICA ESTIMADA: Calcula una edad biológica basada en su estilo de vida (si son saludables, resta años; si no, suma). Explica el porqué brevemente.
      2. ANÁLISIS DE RUTAS METABÓLICAS: Un resumen de 2-3 frases sobre cómo sus hábitos actuales afectan su meta.
      3. TU RUTINA IDEAL (Mañana, Tarde, Noche): Un plan de acción diario muy práctico.
      4. PRESCRIPCIÓN FUXION: Recomienda exactamente 2 productos FuXion explicando su tecnología (Clean Label, etc.) y cómo ayudan específicamente a sus obstáculos.
      
      Usa clases CSS: 'report-card' para el contenedor, 'report-title' para los encabezados.
      Sé inspirador, científico y profesional. No uses markdown, solo HTML.
    `

    const result = await model.generateContent(prompt)
    const response = await result.response
    const text = response.text()

    // Create a tab-simulated UI or a clean long-form report
    const reportHTML = `
      <div class="report-card">
        <div class="report-title">Tu Perfil Bio-Optimizado</div>
        ${text}
      </div>
    `

    addMessage(reportHTML, true, true)

    // Add final CTAs
    const ctaDiv = document.createElement('div')
    ctaDiv.style.marginTop = '1rem'
    ctaDiv.style.display = 'flex'
    ctaDiv.style.flexDirection = 'column'
    ctaDiv.style.gap = '0.5rem'
    ctaDiv.innerHTML = `
      <a href="https://wa.me/573000000000?text=Hola!%20Acabo%20de%20hacer%20mi%20evaluación%20celular%20de%20${userData.goal}%20y%20quiero%20empezar%20mi%20plan." target="_blank" class="btn btn-primary" style="width: 100%; text-align: center;">Hablar con Especialista (WhatsApp)</a>
      <button onclick="location.reload()" class="btn" style="background: #eee; width: 100%;">Volver a Evaluarme</button>
    `
    chatMessages.appendChild(ctaDiv)
    chatMessages.scrollTop = chatMessages.scrollHeight

  } catch (error) {
    console.error('Error with Gemini:', error)
    addMessage('Hubo un error técnico al generar tu reporte celular. Por favor, intenta de nuevo o solicita una asesoría manual por WhatsApp.', true)
  }
}

// --- Event Listeners ---

document.querySelectorAll('.goal-card').forEach(card => {
  card.addEventListener('click', (e) => {
    e.preventDefault()
    const goalTitle = card.querySelector('.goal-title').textContent
    openChat(goalTitle)
  })
})

chatSend.addEventListener('click', handleUserInput)
chatInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') handleUserInput()
})

closeChat.addEventListener('click', () => {
  chatModal.style.display = 'none'
})

chatModal.addEventListener('click', (e) => {
  if (e.target === chatModal) chatModal.style.display = 'none'
})
