async function run() {
  const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
  if (!OPENROUTER_API_KEY) throw new Error("Missing OPENROUTER_API_KEY");
  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: "google/gemma-3-4b-it:free",
      messages: [{role: "user", content: "Hi"}]
    })
  });
  console.log("Status:", res.status);
  console.log("Response:", await res.text());
}
run();
