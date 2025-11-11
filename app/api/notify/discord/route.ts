import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { gameName, winner, score, seriesUrl, team } = body

    // Validar dados
    if (!gameName || !winner || !score || !seriesUrl || !team) {
      return NextResponse.json(
        { error: 'Dados incompletos' },
        { status: 400 }
      )
    }

    // Obter URL do webhook (por time ou geral)
    const webhookUrl = process.env[`DISCORD_WEBHOOK_URL_${team}`] || process.env.DISCORD_WEBHOOK_URL

    if (!webhookUrl) {
      console.warn('Discord webhook URL não configurada')
      return NextResponse.json(
        { message: 'Webhook não configurado', skipped: true },
        { status: 200 }
      )
    }

    // Formatar mensagem
    const message = `**${winner}** venceu **${gameName}** por **${score}**\n${seriesUrl}`

    // Enviar para Discord
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        content: message,
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Erro ao enviar webhook Discord:', errorText)
      return NextResponse.json(
        { error: 'Falha ao enviar webhook' },
        { status: response.status }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Erro no webhook Discord:', error)
    return NextResponse.json(
      { error: error.message || 'Erro interno' },
      { status: 500 }
    )
  }
}

