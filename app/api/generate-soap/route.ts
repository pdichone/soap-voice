import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

const SOAP_SYSTEM_PROMPT = `You are a medical documentation assistant for massage therapists. Convert the following session notes into a properly formatted SOAP note.

SOAP Format:
- Subjective: Client's reported symptoms, pain levels (1-10), concerns, goals
- Objective: Observable findings, areas worked, techniques used, tissue quality notes
- Assessment: Therapist's clinical interpretation, progress from previous sessions
- Plan: Recommendations, home care, suggested follow-up timing

Keep language professional but accessible. If information is missing for a section, note "Not reported" rather than making assumptions.

Return your response as a JSON object with exactly these keys: subjective, objective, assessment, plan. Each value should be a string.`;

export async function POST(request: Request) {
  try {
    const { transcript } = await request.json();

    if (!transcript || typeof transcript !== 'string') {
      return NextResponse.json({ error: 'No transcript provided' }, { status: 400 });
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'Anthropic API key not configured' }, { status: 500 });
    }

    const anthropic = new Anthropic({ apiKey });

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      system: SOAP_SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: `Here is the session transcript to convert into a SOAP note:\n\n${transcript}`,
        },
      ],
    });

    // Extract text content
    const textContent = message.content.find(c => c.type === 'text');
    if (!textContent || textContent.type !== 'text') {
      return NextResponse.json({ error: 'No response from AI' }, { status: 500 });
    }

    // Parse JSON from response
    let soapNote;
    try {
      // Try to extract JSON from the response (it might be wrapped in markdown code blocks)
      let jsonStr = textContent.text;
      const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) {
        jsonStr = jsonMatch[1];
      }
      soapNote = JSON.parse(jsonStr.trim());
    } catch {
      // If parsing fails, try to structure the response manually
      soapNote = {
        subjective: 'Unable to parse response',
        objective: 'Unable to parse response',
        assessment: 'Unable to parse response',
        plan: 'Unable to parse response',
      };
      console.error('Failed to parse SOAP note JSON:', textContent.text);
    }

    // Validate the response has all required fields
    const requiredFields = ['subjective', 'objective', 'assessment', 'plan'];
    for (const field of requiredFields) {
      if (typeof soapNote[field] !== 'string') {
        soapNote[field] = 'Not reported';
      }
    }

    return NextResponse.json({ soapNote });
  } catch (error) {
    console.error('SOAP generation error:', error);
    return NextResponse.json(
      { error: 'Failed to generate SOAP note' },
      { status: 500 }
    );
  }
}
