import { defineStore } from "pinia";
import { ref } from "vue";
import axios from "axios";
import { useUserStore } from "./user";

export const useChatStore = defineStore("chat", () => {
  const messages = ref([]);

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


  return { messages, loadChatHistory };
});
