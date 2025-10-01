import { defineStore } from "pinia";
import { ref } from "vue";
import axios from "axios";

export const useChatStore = defineStore("chat", () => {
  const messages = ref([]);
  const isLoading = ref(false);
  const inputMessage = ref("");

  const loadChatHistory = async () => {
    try {
      const response = await axios.get(
        `${import.meta.env.VITE_API_URL}/get-messages`
      );

      const chatHistory = response.data.chatHistory;

      if (!Array.isArray(chatHistory)) {
        console.error("Expected chatHistory to be an array. Got:", chatHistory);
        return;
      }

      if (!chatHistory.length) {
        console.log("No chat history found");
        return;
      }

      messages.value = chatHistory
        .flatMap((msg) => [
          {
            role: "user",
            content: msg.message,
            timestamp: new Date(
              msg.created_at || Date.now()
            ).toLocaleTimeString(),
          },
          {
            role: "ai",
            content: msg.reply,
            formattedContent: formatMessage(msg.reply),
            timestamp: new Date(
              msg.created_at || Date.now()
            ).toLocaleTimeString(),
          },
        ])
        .filter((msg) => msg.content);
    } catch (error) {
      console.error("Error loading chat history:", error);
    }
  };

  const formatMessage = (text) => {
    if (!text) return '';
  
    let formattedText = text.replace(/```([a-z]*)\n([\s\S]*?)\n```/g, (match, language, code) => {
      const lang = language || 'plaintext';
      return `<pre><code>${code}</code></pre>`;
    });
    
    return formattedText
      .replace(/^### (.*$)/gm, '<h3>$1</h3>')
      .replace(/^## (.*$)/gm, '<h2>$1</h2>')
      .replace(/^# (.*$)/gm, '<h1>$1</h1>')
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/~~(.*?)~~/g, '<s>$1</s>')
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank">$1</a>')
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      .replace(/(?:^|\n)- (.*?)(?=\n|$)/g, '<li>$1</li>')
      .replace(/(?:^|\n)\* (.*?)(?=\n|$)/g, '<li>$1</li>')
      .replace(/(?:^|\n)(\d+)\. (.*?)(?=\n|$)/g, '<li>$1. $2</li>')
      .replace(/(?:\n<li>.*?<\/li>)+/g, match => `<ul>${match}</ul>`)
      .replace(/(?:^|\n)> (.*?)(?=\n|$)/g, '<blockquote>$1</blockquote>')
      .replace(/\n/g, '<br>');
  };

  const sendMessage = async (message) => {
    if (!message.trim()) return;

    messages.value.push({
      role: "user",
      content: message,
      timestamp: new Date().toLocaleTimeString(),
    });

    isLoading.value = true;

    try {
      const response = await axios.post(
        `${import.meta.env.VITE_API_URL}/chat`,
        { message }
      );
      const reply = response.data.response;

      if (!reply || typeof reply !== "string") {
        console.error("Invalid reply format:", reply);
        return;
      }

      messages.value.push({
        role: "ai",
        content: reply,
        formattedContent: formatMessage(reply),
        timestamp: new Date().toLocaleTimeString(),
      });
    } catch (error) {
      console.error("Error sending message:", error);
    }

    isLoading.value = false;
    inputMessage.value = "";
  };

  return { messages, loadChatHistory, sendMessage, isLoading, inputMessage };
});