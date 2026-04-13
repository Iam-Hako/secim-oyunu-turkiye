export default async function handler(request, response) {
  if (request.method !== 'POST') {
    return response.status(405).json({ error: 'Method Not Allowed' });
  }

  const { prompt } = request.body;
  const apiKey = process.env.GROQ_API_KEY;

  if (!apiKey) {
    return response.status(500).json({ error: 'API Key not configured on server' });
  }

  try {
    const groqResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: "llama-3.1-8b-instant",
        messages: [
          { role: "system", content: "Sen bir Türk siyasetçisisin. Dilin sert, iddialı ve yerel olmalı." },
          { role: "user", content: prompt }
        ],
        temperature: 0.85,
        response_format: { type: "json_object" }
      })
    });

    const data = await groqResponse.json();
    return response.status(200).json(data);
  } catch (error) {
    console.error("API Proxy Error:", error);
    return response.status(500).json({ error: 'Internal Server Error' });
  }
}
