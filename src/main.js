import './style.css'
import { GoogleGenerativeAI } from '@google/generative-ai'

// --- Chatbot Logic ---

const API_KEY = import.meta.env.VITE_GEMINI_API_KEY
const MODEL_NAME = import.meta.env.VITE_GEMINI_MODEL || 'gemini-1.5-flash'

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
  age: '',
  activity: '',
  feeling: ''
}

let currentStep = 0
const steps = [
  { 
    field: 'goal', 
    question: (goal) => `¡Excelente elección! Veo que te interesa mejorar tu **${goal}**. Para darte una recomendación precisa, ¿podrías decirme qué edad tienes?` 
  },
  { 
    field: 'activity', 
    question: () => `¡Entendido! ¿Y cómo describirías tu nivel de actividad física actual? (Sedentario, Moderado, Activo)` 
  },
  { 
    field: 'feeling', 
    question: () => `Perfecto. Por último, cuéntame brevemente: ¿cuál es el mayor obstáculo que sientes hoy para alcanzar tu meta?` 
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
  addMessage('✨ Analizando tu perfil con nuestro sistema de nutrición celular...', true)
  
  if (!model) {
    setTimeout(() => {
      addMessage('Lo siento, el sistema de IA no está configurado correctamente (falta API Key). Por favor, contacta a un especialista por WhatsApp para tu diagnóstico.', true)
    }, 1500)
    return
  }

  try {
    const prompt = `
      Eres un asesor experto en nutrición celular de FuXion y Advanced Health. 
      Basado en estos datos del usuario:
      - Objetivo: ${userData.goal}
      - Edad: ${userData.age}
      - Nivel de actividad: ${userData.activity}
      - Obstáculo actual: ${userData.feeling}

      Genera un REPORTE DE BIENESTAR profesional y motivador en formato HTML (solo el contenido interno, usa clases como 'report-card', 'report-title').
      1. Saludo breve y validación del objetivo.
      2. Análisis de su situación actual.
      3. Recomendación de 1 o 2 productos FuXion específicos explicando el BENEFICIO CELULAR relacionado con su obstáculo.
      4. Mensaje de cierre invitando a la acción.
      
      IMPORTANTE: No uses markdown en la respuesta, usa etiquetas HTML estándar. Se breve pero muy profesional y empático.
    `

    const result = await model.generateContent(prompt)
    const response = await result.response
    const text = response.text()
    
    addMessage(text, true, true)
    
    // Add final CTAs
    const ctaDiv = document.createElement('div')
    ctaDiv.style.marginTop = '1rem'
    ctaDiv.style.display = 'flex'
    ctaDiv.style.flexDirection = 'column'
    ctaDiv.style.gap = '0.5rem'
    ctaDiv.innerHTML = `
      <a href="https://wa.me/573000000000?text=Hola!%20Acabo%20de%20hacer%20mi%20evaluación%20de%20${userData.goal}%20y%20quiero%20más%20información." target="_blank" class="btn btn-primary" style="width: 100%; text-align: center;">Hablar con Especialista (WhatsApp)</a>
      <button onclick="location.reload()" class="btn" style="background: #eee; width: 100%;">Volver a Empezar</button>
    `
    chatMessages.appendChild(ctaDiv)
    chatMessages.scrollTop = chatMessages.scrollHeight

  } catch (error) {
    console.error('Error with Gemini:', error)
    addMessage('Hubo un error al procesar tu reporte. Por favor, intenta de nuevo o contacta a un asesor.', true)
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
