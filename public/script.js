document.addEventListener("DOMContentLoaded", function () {
    const chatBox = document.getElementById("chat-box");
    const userInput = document.getElementById("user-input");
    const sendButton = document.getElementById("send-button");

    let eventSource = null;

    function sendMessage() {
        const message = userInput.value.trim();
        if (message === "") return;

        displayMessage(message, "user-message");
        userInput.value = "";
        userInput.focus();

        let botMessage = displayMessage("...", "bot-message", true);
        let fullResponse = "";

        // Close previous event source if open
        if (eventSource) {
            eventSource.close();
        }

        eventSource = new EventSource(`/stream?prompt=${encodeURIComponent(message)}`);

        eventSource.onmessage = function (event) {
            try {
                if (event.data === "[DONE]") {
                    eventSource.close();
                    eventSource = null;

                    // Add copy buttons to code blocks
                    const codeBlocks = botMessage.querySelectorAll('pre code');
                    codeBlocks.forEach(codeBlock => {
                        const copyButton = document.createElement("button");
                        copyButton.innerHTML = '<i class="fas fa-copy"></i>';
                        copyButton.classList.add("copy-button");
                        copyButton.onclick = () => copyToClipboard(codeBlock.textContent, copyButton);
                        codeBlock.parentElement.appendChild(copyButton);
                    });

                    // Apply syntax highlighting
                    document.querySelectorAll('pre code').forEach((block) => {
                        hljs.highlightBlock(block);
                    });
                } else {
                    const responseData = JSON.parse(event.data);

                    if (responseData.error) {
                        botMessage.innerText = `⚠️ ${responseData.error}`;
                    } else if (responseData.text) {
                        fullResponse += responseData.text;
                        const processedText = processText(fullResponse);
                        botMessage.innerHTML = processedText;
                        chatBox.scrollTop = chatBox.scrollHeight;
                    }
                }
            } catch (error) {
                console.warn("⚠️ JSON Parse Error:", error);
                botMessage.innerText = "⚠️ Error processing response.";
            }
        };

        eventSource.onerror = function (event) {
            console.error("❌ EventSource Error:", event);
            if (eventSource) eventSource.close();
            botMessage.innerText = "⚠️ Connection lost. Try again.";
        };
    }

    sendButton.addEventListener("click", sendMessage);

    userInput.addEventListener("keypress", function (event) {
        if (event.key === "Enter" && !event.shiftKey) {
            event.preventDefault();
            sendMessage();
        }
    });

    function processText(text) {
        let output = "";
        let inCodeBlock = false;
        const lines = text.split('\n');

        for (const line of lines) {
            if (line.startsWith("```")) {
                if (inCodeBlock) {
                    output += "</code></pre>";
                    inCodeBlock = false;
                } else {
                    const lang = line.substring(3).trim();
                    output += `<pre><code class="${lang}">`;
                    inCodeBlock = true;
                }
            } else if (inCodeBlock) {
                // Only include code and code-related comments inside <code>
                output += `${escapeHtml(line)}\n`;
            } else {
                // Render non-code text outside <code> with proper line breaks
                output += `<p>${formatText(line)}</p>`;
            }
        }

        // Handle incomplete code blocks
        if (inCodeBlock) {
            output += "</code></pre>";
        }

        return output;
    }

    function escapeHtml(unsafe) {
        return unsafe.replace(/[&<>"']/g, function(m) {
            switch (m) {
                case '&':
                    return '&amp;';
                case '<':
                    return '&lt;';
                case '>':
                    return '&gt;';
                case '"':
                    return '&quot;';
                case '\'':
                    return '&#039;';
                default:
                    return m;
            }
        });
    }

    function formatText(text) {
        text = text.replace(/\*\*(.+?)\*\*/g, "<b>$1</b>"); // Bold
        text = text.replace(/\*(.+?)\*/g, "<i>$1</i>"); // Italic
        text = text.replace(/^# (.+)$/gm, "<h2>$1</h2>"); // Heading 2
        text = text.replace(/^## (.+)$/gm, "<h3>$1</h3>"); // Heading 3
        text = text.replace(/^### (.+)$/gm, "<h4>$1</h4>"); // Heading 4
        text = text.replace(/\n/g, "<br>"); // Line breaks
        return text;
    }

    function copyToClipboard(text, button) {
        navigator.clipboard.writeText(text).then(() => {
            button.innerHTML = '<i class="fas fa-check"></i>';
            setTimeout(() => {
                button.innerHTML = '<i class="fas fa-copy"></i>';
            }, 1500);
        }).catch(err => console.error("❌ Copy Error:", err));
    }

    function displayMessage(text, className, isTemporary = false) {
        const messageDiv = document.createElement("div");
        messageDiv.classList.add("message", className);
        messageDiv.innerHTML = text;
        chatBox.appendChild(messageDiv);
        chatBox.scrollTop = chatBox.scrollHeight;
        return messageDiv;
    }
});