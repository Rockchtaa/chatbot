// stores/chat.js
import { defineStore } from "pinia";
import { ref } from "vue";
import axios from "axios";
import { useUserStore } from "./user";

export const useChatStore = defineStore("chat", () => {
  const userStore = useUserStore();

  const conversations = ref([]); // List of conversations for the user
  const currentConversationId = ref(null); // ID of the currently active conversation
  const currentConversationTitle = ref(''); // Title of the currently active conversation
  const messages = ref([]); // Messages for the current conversation

  const isLoading = ref(false);
  const inputMessage = ref("");
   const showInitialOptions = ref(true);

  // --- Actions for Conversations ---

  const loadConversations = async () => {
    if (!userStore.isAuthenticated()) {
      conversations.value = [];
      return;
    }
    try {
      const response = await axios.get(`${import.meta.env.VITE_API_URL}/conversations`, {
        headers: {
          Authorization: `Bearer ${userStore.token}`,
        },
      });
      conversations.value = response.data.conversations;
      // If there are conversations, set the first one as active by default
      if (conversations.value.length > 0 && !currentConversationId.value) {
        setActiveConversation(conversations.value[0].id, conversations.value[0].title);
      } else if (conversations.value.length === 0) {
        // If no conversations, clear current conversation state
        currentConversationId.value = null;
        currentConversationTitle.value = '';
        messages.value = [];
      }
    } catch (error) {
      console.error("Error loading conversations:", error);
      if (axios.isAxiosError(error) && error.response?.status === 401) {
        userStore.logout();
      }
      conversations.value = [];
    }
  };

  const setActiveConversation = async (id, title) => {
    currentConversationId.value = id;
    currentConversationTitle.value = title;
    await loadChatMessages(); // Load messages for the newly active conversation
  };

  const startNewConversation = async () => {
    currentConversationId.value = null;
    currentConversationTitle.value = 'New Chat';
    messages.value = []; // Clear messages for a new conversation
    // Optionally, trigger a message send to implicitly create the conversation
    // Or let the first sendMessage create it.
  };

  const deleteConversation = async (id) => {
    if (!userStore.isAuthenticated()) return;
    if (!confirm('Are you sure you want to delete this conversation?')) return;

    try {
      await axios.delete(`${import.meta.env.VITE_API_URL}/conversations/${id}`, {
        headers: {
          Authorization: `Bearer ${userStore.token}`,
        },
      });
      // Remove from frontend list
      conversations.value = conversations.value.filter(conv => conv.id !== id);
      // If the deleted conversation was the active one, start a new one
      if (currentConversationId.value === id) {
        startNewConversation();
        // If there are still other conversations, activate the first one
        if (conversations.value.length > 0) {
            setActiveConversation(conversations.value[0].id, conversations.value[0].title);
        }
      }
    } catch (error) {
      console.error("Error deleting conversation:", error);
      if (axios.isAxiosError(error) && error.response?.status === 401) {
        userStore.logout();
      }
    }
  };

  // --- Actions for Chat Messages ---

  const loadChatMessages = async () => {
    if (!userStore.isAuthenticated() || !currentConversationId.value) {
      messages.value = [];
      return;
    }

    isLoading.value = true;
    try {
      const response = await axios.post(
        `${import.meta.env.VITE_API_URL}/get-messages`,
        { conversationId: currentConversationId.value },
        {
          headers: {
            Authorization: `Bearer ${userStore.token}`,
          },
        }
      );

      const chatHistory = response.data.chatHistory;
      if (!Array.isArray(chatHistory)) {
        console.error("Expected chatHistory to be an array. Got:", chatHistory);
        messages.value = [];
        return;
      }

      messages.value = chatHistory
        .flatMap((msg) => [
          {
            role: "user",
            content: msg.message,
            timestamp: new Date(msg.created_at).toLocaleTimeString(),
          },
          {
            role: "ai",
            content: msg.reply,
            formattedContent: formatMessage(msg.reply),
            timestamp: new Date(msg.created_at).toLocaleTimeString(),
          },
        ])
        .filter((msg) => msg.content);
    } catch (error) {
      console.error("Error loading chat messages:", error);
      if (axios.isAxiosError(error) && error.response?.status === 401) {
        userStore.logout();
      }
      messages.value = [];
    } finally {
      isLoading.value = false;
    }
  };

  const formatMessage = (text) => {
    // ... (your existing formatMessage function) ...
    if (!text) return '';
  
    // First process code blocks
    let formattedText = text.replace(/```([a-z]*)\n([\s\S]*?)\n```/g, (match, language, code) => {
      const lang = language || 'plaintext';
      return `<pre><code>${code}</code></pre>`;
    });
    
    // Then process the rest of the markdown
    return formattedText
      // Headers
      .replace(/^### (.*$)/gm, '<h3>$1</h3>')
      .replace(/^## (.*$)/gm, '<h2>$1</h2>')
      .replace(/^# (.*$)/gm, '<h1>$1</h1>')
      
      // Emphasis
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/~~(.*?)~~/g, '<s>$1</s>')
      
      // Links
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank">$1</a>')
      
      // Inline code
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      
      // Lists (unordered)
      .replace(/(?:^|\n)- (.*?)(?=\n|$)/g, '<li>$1</li>')
      .replace(/(?:^|\n)\* (.*?)(?=\n|$)/g, '<li>$1</li>')
      
      // Lists (ordered)
      .replace(/(?:^|\n)(\d+)\. (.*?)(?=\n|$)/g, '<li>$1. $2</li>')
      
      // Wrap lists properly
      .replace(/(?:\n<li>.*?<\/li>)+/g, match => `<ul>${match}</ul>`)
      
      // Blockquotes
      .replace(/(?:^|\n)> (.*?)(?=\n|$)/g, '<blockquote>$1</blockquote>')
      
      // Line breaks
      .replace(/\n/g, '<br>');
  };

  const sendMessage = async (message) => {
    if (!message.trim() || !userStore.isAuthenticated()) return;

    // Add user message to current view immediately
    messages.value.push({
      role: "user",
      content: message,
      timestamp: new Date().toLocaleTimeString(),
    });

    isLoading.value = true;
    inputMessage.value = ""; // Clear input immediately

    try {
      const payload = {
        message: message,
      };
      if (currentConversationId.value) {
        payload.conversationId = currentConversationId.value;
      }
         if (showInitialOptions.value) {
      showInitialOptions.value = false;
    }
      const response = await axios.post(
        `${import.meta.env.VITE_API_URL}/chat`,
        payload,
        {
          headers: {
            Authorization: `Bearer ${userStore.token}`,
          },
        }
      );

      const reply = response.data.response;
      const returnedConversationId = response.data.conversationId;
      const returnedConversationTitle = response.data.conversationTitle;

      if (!reply || typeof reply !== "string") {
        console.error("Invalid reply format:", reply);
        return;
      }

      // If a new conversation was created on the backend
      if (!currentConversationId.value && returnedConversationId) {
        currentConversationId.value = returnedConversationId;
        currentConversationTitle.value = returnedConversationTitle;
        // Add the new conversation to the list
        conversations.value.unshift({ // Add to the beginning to show as most recent
            id: returnedConversationId,
            title: returnedConversationTitle,
            created_at: new Date().toISOString(), // Use current time for display
            updated_at: new Date().toISOString(),
        });
      } else if (currentConversationId.value && returnedConversationId && currentConversationId.value === returnedConversationId) {
        // Update the updated_at timestamp for the existing conversation in the list
        const index = conversations.value.findIndex(c => c.id === currentConversationId.value);
        if (index !== -1) {
            conversations.value[index].updated_at = new Date().toISOString();
            // Re-sort to put the most recently updated conversation at the top
            conversations.value.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
        }
      }


      messages.value.push({
        role: "ai",
        content: reply,
        formattedContent: formatMessage(reply),
        timestamp: new Date().toLocaleTimeString(),
      });
    } catch (error) {
      console.error("Error sending message:", error);
      if (axios.isAxiosError(error) && error.response?.status === 401) {
        userStore.logout();
      }
    } finally {
      isLoading.value = false;
    }
  };

  // NEW ACTION: Send TimeTrack specific queries
const sendTimeTrackQuery = async (queryType, projectName = null) => {
    if (!userStore.isAuthenticated()) return;

    showInitialOptions.value = false;

    let userMessageContent = "";
    if (queryType === 'absences') {
        userMessageContent = "I asked about workers absent/on leave.";
    } else if (queryType === 'projects') {
        userMessageContent = projectName ? `I asked about project: ${projectName}.` : "I asked about worker projects.";
    }

    messages.value.push({
      role: "user",
      content: userMessageContent,
      timestamp: new Date().toLocaleTimeString(),
    });

    isLoading.value = true;
    try {
      const payload = { queryType, projectName };
      if (currentConversationId.value) {
        payload.conversationId = currentConversationId.value; // Send current convo ID
      }

      const response = await axios.post(
        `${import.meta.env.VITE_API_URL}/timetrack-query`,
        payload,
        {
          headers: {
            Authorization: `Bearer ${userStore.token}`,
          },
        }
      );
      const reply = response.data.response;
      const returnedConversationId = response.data.conversationId; // NEW
      const returnedConversationTitle = response.data.conversationTitle; // NEW


      if (!reply || typeof reply !== "string") {
        console.error("Invalid TimeTrack query reply format:", reply);
        return;
      }

      // Update conversation state based on backend response
      if (!currentConversationId.value && returnedConversationId) {
        currentConversationId.value = returnedConversationId;
        currentConversationTitle.value = returnedConversationTitle;
        conversations.value.unshift({ // Add to the beginning
            id: returnedConversationId,
            title: returnedConversationTitle,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
        });
      } else if (currentConversationId.value && returnedConversationId && currentConversationId.value === returnedConversationId) {
        const index = conversations.value.findIndex(c => c.id === currentConversationId.value);
        if (index !== -1) {
            conversations.value[index].updated_at = new Date().toISOString();
            conversations.value.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
        }
      }

      messages.value.push({
        role: "ai",
        content: reply,
        formattedContent: formatMessage(reply),
        timestamp: new Date().toLocaleTimeString(),
      });
    } catch (error) {
      console.error("Error sending TimeTrack query:", error);
      if (axios.isAxiosError(error) && error.response?.status === 401) {
        userStore.logout();
      }
      messages.value.push({ // Show an error message to the user
        role: 'ai',
        content: "Sorry, I encountered an error while fetching that information. Please try again later.",
        formattedContent: "Sorry, I encountered an error while fetching that information. Please try again later.",
        timestamp: new Date().toLocaleTimeString(),
      });
    } finally {
      isLoading.value = false;
    }
  };


  return {
    conversations,
    currentConversationId,
    currentConversationTitle,
    messages,
    isLoading,
    inputMessage,
    loadConversations,
    setActiveConversation,
    startNewConversation,
    deleteConversation,
    loadChatMessages,
    sendMessage,
    formatMessage,
    showInitialOptions,
    sendTimeTrackQuery,
  };
});