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

      Genera un REPORTE DE BIENESTAR PREMIUM. DEBES RESPONDER ÚNICAMENTE CON UN JSON VÁLIDO. No uses formato markdown alrededor del JSON, solo el objeto JSON puro con esta estructura exacta:
      {
        "biologicalAge": {
          "age": "X años",
          "explanation": "Breve explicación..."
        },
        "metabolicAnalysis": "Resumen de 2 frases...",
        "routine": {
          "morning": ["Acción 1", "Acción 2"],
          "afternoon": ["Acción 1", "Acción 2"],
          "night": ["Acción 1", "Acción 2"]
        },
        "products": [
          {
            "name": "Nombre Producto 1",
            "benefit": "Por qué lo necesita..."
          },
          {
            "name": "Nombre Producto 2",
            "benefit": "Por qué lo necesita..."
          }
        ]
      }
    `

    const result = await model.generateContent(prompt)
    const response = await result.response
    let text = response.text()

    // Clean potential markdown blocks
    text = text.replace(/```json/gi, '').replace(/```/g, '').trim()
    const data = JSON.parse(text)

    // Create a beautifully structured UI template for the report
    const reportHTML = `
      <div class="premium-report">
        <div class="pr-header">
          <h3>Tu Plan Bio-Optimizado</h3>
          <div class="pr-age-badge">Edad Biológica Estimada: <strong>${data.biologicalAge.age}</strong></div>
          <p class="pr-subtitle">${data.biologicalAge.explanation}</p>
        </div>
        
        <div class="pr-section">
          <h4><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align: middle;"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg> Análisis Metabólico</h4>
          <p>${data.metabolicAnalysis}</p>
        </div>

        <div class="pr-section">
          <h4><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align: middle;"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg> Rutina Ideal</h4>
          <ul class="pr-routine">
            <li><span class="pr-time">🌤️ Mañana:</span> <span class="pr-action">${data.routine.morning.join(' • ')}</span></li>
            <li><span class="pr-time">☀️ Tarde:</span> <span class="pr-action">${data.routine.afternoon.join(' • ')}</span></li>
            <li><span class="pr-time">🌙 Noche:</span> <span class="pr-action">${data.routine.night.join(' • ')}</span></li>
          </ul>
        </div>

        <div class="pr-section">
          <h4><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align: middle;"><path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"></path></svg> Prescripción FuXion</h4>
          <div class="pr-products">
            ${data.products.map(p => `
              <div class="pr-product">
                <div class="pr-product-name">${p.name}</div>
                <div class="pr-product-desc">${p.benefit}</div>
              </div>
            `).join('')}
          </div>
        </div>
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

document.querySelectorAll('.start-eval-btn').forEach(btn => {
  btn.addEventListener('click', (e) => {
    e.preventDefault()
    openChat('Bienestar General')
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
