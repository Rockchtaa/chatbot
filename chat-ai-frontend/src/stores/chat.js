import { defineStore } from "pinia";
import { ref } from "vue";
import axios from "axios";
import { useUserStore } from "./user";

export const useChatStore = defineStore("chat", () => {
  const messages = ref([]);
  const isLoading = ref(false);

  const userStore = useUserStore();

  const loadChatHistory = async () => {
    if (!userStore.userId) return;

    try {
      const response = await axios.post(
        `${import.meta.env.VITE_API_URL}/get-messages`,
        { userId: userStore.userId }
      );

      const chatHistory = response.data.chatHistory;

      if (!Array.isArray(chatHistory)) {
        console.error("Expected chatHistory to be an array. Got:", chatHistory);
        return;
      }
      console.log("chatHistory:", response.data.chatHistory);
      // Filter out messages with empty content
      if (!chatHistory.length) {
        console.error("No chat history found for user:", userStore.userId);
        return;
      }

      messages.value = chatHistory
        .flatMap((msg) => [
          { role: "user", content: msg.message },
          { role: "ai", content: msg.reply },
        ])
        .filter((msg) => msg.content);
    } catch (error) {
      console.error("Error loading chat history:", error);
    }
  };
  const sendMessage = async (message) => {

    if(!message.trim() || !userStore.userId) return;

    messages.value.push({ role: "user", content: message });
    isLoading.value = true;

    try {
      const response = await axios.post(
        `${import.meta.env.VITE_API_URL}/chat`,
        { userId: userStore.userId, message }
      );
      const reply = response.data.response;
      console.log("response:", response);

      console.log("reply:", reply);

      if (!reply || typeof reply !== "string") {
        console.error("Invalid reply format:", reply);
        return;
      }
      messages.value.push({ role: "ai", content: reply });
    } catch (error) {
      console.error("Error sending message:", error);
    }
    isLoading.value = false;
  };

  return { messages, loadChatHistory, sendMessage, isLoading };
});
