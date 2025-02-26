const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
require("dotenv").config();

const app = express();

app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use(cors());

app.set("view engine", "ejs");
app.set("views", "views");
app.use(express.static("public"));

app.get("/", (req, res) => {
    res.render("index");
});

app.get("/stream", async (req, res) => {
    const { prompt } = req.query;
    console.log(`🔹 Received request: "${prompt}"`);

    if (!prompt) {
        return res.status(400).json({ error: "Prompt is required" });
    }

    try {
        console.log("🔹 Fetching AI response...");

        res.setHeader("Content-Type", "text/event-stream");
        res.setHeader("Cache-Control", "no-cache");
        res.setHeader("Connection", "keep-alive");

        const response = await fetch("http://localhost:11434/api/generate", { // Replace with your Ollama API URL
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                model: "mistral", // Replace with your model name
                prompt: prompt,
                stream: true
            }),
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error("❌ Ollama API Error:", errorText);
            throw new Error(`Ollama API Error: ${response.status}`);
        }

        if (!response.body) {
            throw new Error("No response body from AI model.");
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const textChunk = decoder.decode(value, { stream: true }).trim();
            const lines = textChunk.split("\n").filter(line => line.trim() !== "");

            lines.forEach(line => {
                if (line.startsWith("data:")) {
                    line = line.replace("data:", "").trim();
                }
                try {
                    const parsedJson = JSON.parse(line);
                    if (parsedJson.response) {
                        console.log("🔹 Streaming response:", parsedJson.response);

                        const escapedResponse = parsedJson.response
                            .replace(/\\n/g, '\n')
                            .replace(/\\"/g, '"');

                        res.write(`data: ${JSON.stringify({ text: escapedResponse })}\n\n`);
                    }
                } catch (jsonError) {
                    console.error("❌ JSON Parse Error:", jsonError);
                }
            });
        }

        res.write("data: [DONE]\n\n");
        res.end();

    } catch (error) {
        console.error("❌ Error fetching AI response:", error);
        res.write(`data: ${JSON.stringify({ error: error.message || "An error occurred" })}\n\n`);
        res.end();
    }
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`🚀 AI Server running on port ${port}`));