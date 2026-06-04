const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { status: 200, headers: corsHeaders })
  }

  try {
    const { imageBase64, mediaType } = await req.json()

    if (!imageBase64) {
      return new Response(JSON.stringify({ error: 'No image provided' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const apiKey = Deno.env.get('OPENAI_API_KEY')
    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'API key not configured on server' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const dataUrl = `data:${mediaType || 'image/jpeg'};base64,${imageBase64}`

    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        max_tokens: 300,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image_url',
                image_url: { url: dataUrl, detail: 'high' },
              },
              {
                type: 'text',
                text: `Look at this image and do two things:

1. Find any barcode on the item. Read the digits printed beneath or beside it (usually 8-13 digits). Return only the digits, no spaces or dashes.
2. Check whether a waste bin, trash can, or recycling bin is visible anywhere in the photo.

Reply ONLY with this JSON object and nothing else:
{"barcode": "digits here or null if not found", "hasWasteBin": true, "description": "one sentence about what you see"}`,
              },
            ],
          },
        ],
      }),
    })

    if (!res.ok) {
      const errText = await res.text()
      return new Response(JSON.stringify({ error: 'AI service error', detail: errText }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const aiResult = await res.json()
    const rawText = aiResult.choices?.[0]?.message?.content ?? ''

    let parsed
    try {
      const match = rawText.match(/\{[\s\S]*\}/)
      parsed = match
        ? JSON.parse(match[0])
        : { barcode: null, hasWasteBin: false, description: 'Could not analyse image.' }
    } catch (_) {
      parsed = { barcode: null, hasWasteBin: false, description: 'Could not analyse image.' }
    }

    if (parsed.barcode) {
      const digits = String(parsed.barcode).replace(/\D/g, '')
      parsed.barcode = digits.length >= 6 ? digits : null
    }

    return new Response(JSON.stringify(parsed), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
