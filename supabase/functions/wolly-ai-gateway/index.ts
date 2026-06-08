import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.43.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Soglie di budget configurabili
const LIMIT_USER_MONTHLY_USD = parseFloat(Deno.env.get('LIMIT_USER_MONTHLY_USD') || '1.00') // default tester: 1$
const LIMIT_ADMIN_MONTHLY_USD = 20.00 // default admin: 20$
const LIMIT_GLOBAL_MONTHLY_USD = parseFloat(Deno.env.get('LIMIT_GLOBAL_MONTHLY_USD') || '30.00') // Tetto globale di 30$ mensili

// Inizializza il client amministrativo per il DB (bypassa RLS per somma costi e scrittura log)
const supabaseUrl = Deno.env.get('SUPABASE_URL') || ''
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)

async function getUserIdAndRoleFromAuth(authHeader: string | null): Promise<{ id: string; role: string; monthlyLimit: number } | null> {
  if (!authHeader) return null
  try {
    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token)
    if (authError || !user) {
      console.error('[wolly-ai-gateway] Auth error:', authError?.message)
      return null
    }

    // Carica il ruolo dell'utente dal suo profilo
    const { data: profileData, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single()

    let role = 'user'
    let monthlyLimit = LIMIT_USER_MONTHLY_USD

    if (profileError) {
      console.warn('[wolly-ai-gateway] Could not fetch profile role, using default config:', profileError.message)
    }

    if (profileData) {
      role = profileData.role || 'user'
      
      // Imposta il limite di default in base al ruolo
      if (role === 'admin') {
        monthlyLimit = LIMIT_ADMIN_MONTHLY_USD
      } else {
        monthlyLimit = LIMIT_USER_MONTHLY_USD
      }

      // Se esiste la colonna per il limite personalizzato, la utilizziamo (sovrascrive il default del ruolo)
      if (profileData.monthly_limit_usd !== undefined && profileData.monthly_limit_usd !== null) {
        monthlyLimit = parseFloat(profileData.monthly_limit_usd)
      }
    }

    return {
      id: user.id,
      role,
      monthlyLimit
    }
  } catch (err) {
    console.error('[wolly-ai-gateway] Auth exception:', err)
    return null
  }
}

Deno.serve(async (req) => {
  const version = "0.0.2"
  console.log(`[wolly-ai-gateway] Running Version: ${version}`)

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const url = new URL(req.url)
    const action = url.searchParams.get('action')
    console.log(`[wolly-ai-gateway] Action: ${action} | Method: ${req.method} | Content-Type: ${req.headers.get('content-type')}`)

    // 1. AUTENTICAZIONE E RESOLUTION UTENTE
    const authHeader = req.headers.get('Authorization')
    const authInfo = await getUserIdAndRoleFromAuth(authHeader)

    if (!authInfo) {
      return new Response(JSON.stringify({ error: 'Utente non autenticato o sessione scaduta.' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const userId = authInfo.id
    const userRole = authInfo.role
    const userLimit = authInfo.monthlyLimit

    // 2. CONTROLLO BUDGET MENSILE DINAMICO (CIRCUIT BREAKER)
    const startOfMonth = new Date()
    startOfMonth.setDate(1)
    startOfMonth.setHours(0, 0, 0, 0)
    const startOfMonthStr = startOfMonth.toISOString()

    const { data: spendData, error: spendError } = await supabaseAdmin.rpc('get_monthly_spend', {
      user_uuid: userId,
      start_date: startOfMonthStr
    })

    if (spendError) {
      console.error('[wolly-ai-gateway] RPC get_monthly_spend error:', spendError)
    }

    let userSpend = 0
    let globalSpend = 0
    if (spendData && spendData.length > 0) {
      userSpend = parseFloat(spendData[0].user_total) || 0
      globalSpend = parseFloat(spendData[0].global_total) || 0
    }

    console.log(`[wolly-ai-gateway] User: ${userId} (Role: ${userRole}) | Spend User: $${userSpend.toFixed(5)} / $${userLimit.toFixed(2)} | Spend Global: $${globalSpend.toFixed(5)} / $${LIMIT_GLOBAL_MONTHLY_USD.toFixed(2)}`)

    // Verifica limite globale
    if (globalSpend >= LIMIT_GLOBAL_MONTHLY_USD) {
      console.warn(`[wolly-ai-gateway] Global budget exceeded: $${globalSpend.toFixed(5)} >= $${LIMIT_GLOBAL_MONTHLY_USD}`)
      return new Response(JSON.stringify({ error: 'Budget mensile globale esaurito.' }), {
        status: 503,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Verifica limite utente (incluso admin, ma con limite di 20$)
    if (userSpend >= userLimit) {
      console.warn(`[wolly-ai-gateway] User budget exceeded for ${userId}: $${userSpend.toFixed(5)} >= $${userLimit}`)
      return new Response(JSON.stringify({ error: 'Hai superato la soglia di utilizzo mensile.' }), {
        status: 429,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Helper per recuperare le chiavi dai segreti Supabase
    const getSecret = (key: string): string | undefined => {
      return Deno.env.get(key) || Deno.env.get(`EXPO_PUBLIC_${key}`)
    }

    // ─── CHAT COMPLETION (GROQ) ──────────────────────────────────────────────────
    if (action === 'chat') {
      const { messages, model, max_tokens, temperature, response_format } = await req.json()
      const apiKey = getSecret('GROQ_FINANCE_API')

      if (!apiKey) {
        throw new Error('Missing GROQ_FINANCE_API secret in Supabase.')
      }

      console.log(`[wolly-ai-gateway] Calling Groq Chat with model: ${model}`)
      const startTime = Date.now()
      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: model || 'llama-3.3-70b-versatile',
          messages,
          max_tokens: max_tokens || 150,
          temperature: temperature ?? 0.1,
          response_format,
        }),
      })

      const responseText = await response.text()
      const durationMs = Date.now() - startTime

      if (response.status === 200) {
        try {
          const resJson = JSON.parse(responseText)
          const usage = resJson.usage
          const prompt_tokens = usage?.prompt_tokens || 0
          const completion_tokens = usage?.completion_tokens || 0
          const total_tokens = usage?.total_tokens || 0
          // Costo Llama 3.3: $0.59/1M input, $0.79/1M output
          const cost_usd = (prompt_tokens * 0.59 + completion_tokens * 0.79) / 1000000

          await supabaseAdmin.from('analysis_logs').insert({
            user_id: userId,
            created_at: new Date().toISOString(),
            method_used: 'chat',
            duration_ms: durationMs,
            prompt_tokens,
            completion_tokens,
            total_tokens,
            cost_usd,
            status_code: '200'
          })
          console.log(`[wolly-ai-gateway] Logged Chat Cost: $${cost_usd.toFixed(6)}`)
        } catch (e) {
          console.error('[wolly-ai-gateway] Error logging chat cost:', e)
        }
      }

      return new Response(responseText, {
        status: response.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // ─── GOOGLE CLOUD VISION ──────────────────────────────────────────────────────
    if (action === 'vision') {
      const body = await req.json()
      const apiKey = getSecret('CLOUD_VISION_API')

      if (!apiKey) {
        throw new Error('Missing CLOUD_VISION_API secret in Supabase.')
      }

      console.log(`[wolly-ai-gateway] Calling Google Vision API`)
      const response = await fetch(`https://vision.googleapis.com/v1/images:annotate?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      const responseText = await response.text()

      if (response.status === 200) {
        try {
          const cost_usd = 0.0015 // Tariffa fissa per richiesta Vision OCR
          
          await supabaseAdmin.from('parsing_logs').insert({
            user_id: userId,
            start_time: new Date().toISOString(),
            end_time: new Date().toISOString(),
            method_used: 'photo',
            status_code: '200',
            cost_usd,
            tokens: { description: 'Google Vision OCR request' }
          })
          console.log(`[wolly-ai-gateway] Logged Vision Cost: $${cost_usd.toFixed(6)}`)
        } catch (e) {
          console.error('[wolly-ai-gateway] Error logging vision cost:', e)
        }
      }

      return new Response(responseText, {
        status: response.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // ─── AUDIO TRANSCRIPTION (GROQ WHISPER) ──────────────────────────────────────
    if (action === 'transcribe') {
      const apiKey = getSecret('GROQ_FINANCE_API')
      if (!apiKey) {
        throw new Error('Missing GROQ_FINANCE_API secret in Supabase.')
      }

      const contentType = req.headers.get('content-type') || ''
      if (!contentType.includes('multipart/form-data')) {
        throw new Error(`Content-type must be multipart/form-data. Received: ${contentType}`)
      }

      const clientFormData = await req.formData()
      const file = clientFormData.get('file')
      const model = (clientFormData.get('model') as string) || 'whisper-large-v3-turbo'
      const language = (clientFormData.get('language') as string) || 'it'
      const responseFormat = (clientFormData.get('response_format') as string) || 'json'

      if (!file) {
        throw new Error('No file provided in the request.')
      }

      const groqFormData = new FormData()
      groqFormData.append('file', file)
      groqFormData.append('model', model)
      groqFormData.append('language', language)
      groqFormData.append('response_format', responseFormat)

      console.log(`[wolly-ai-gateway] Forwarding audio file to Groq Whisper. Size: ${file.size} bytes`)
      const response = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
        },
        body: groqFormData,
      })

      const responseText = await response.text()

      if (response.status === 200) {
        try {
          const cost_usd = 0.0001 // Tariffa fissa stimata per una transazione vocale (Whisper)
          
          await supabaseAdmin.from('parsing_logs').insert({
            user_id: userId,
            start_time: new Date().toISOString(),
            end_time: new Date().toISOString(),
            method_used: 'voice',
            status_code: '200',
            cost_usd,
            tokens: { description: 'Groq Whisper STT request' }
          })
          console.log(`[wolly-ai-gateway] Logged Transcribe Cost: $${cost_usd.toFixed(6)}`)
        } catch (e) {
          console.error('[wolly-ai-gateway] Error logging transcribe cost:', e)
        }
      }

      return new Response(responseText, {
        status: response.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    console.log(`[wolly-ai-gateway] Action "${action}" not recognized.`)
    return new Response(JSON.stringify({ error: 'Azione non valida' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (error: any) {
    console.error(`[wolly-ai-gateway] Error occurred: ${error.message}`)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
